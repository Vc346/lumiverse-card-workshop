const CONFIG_KEY = "summary:prompt_sync";
const defaults = { enabled: false, fallback: "", original: null };

async function request(path, options = {}) {
  const response = await fetch("/api/v1/" + path, {
    credentials: "same-origin",
    signal: AbortSignal.timeout(12000),
    ...options,
  });
  if (response.status === 404 && !options.method) return null;
  if (!response.ok) throw new Error("Lumiverse request failed (" + response.status + ").");
  return response.json();
}

function usablePrompt(value) {
  return typeof value === "string" && value.trim() ? value : null;
}

export function createSummarySync(settings, api = request) {
  let pending = Promise.resolve();
  let revision = 0;
  let disposed = false;

  function enqueue(operation) {
    const task = pending.then(operation);
    pending = task.catch(() => {});
    return task;
  }

  async function load() {
    return { ...defaults, ...(await settings.get(CONFIG_KEY)) };
  }

  async function writePrompt(prompt, current = () => !disposed) {
    const row = await api("settings/summarization");
    const value = row?.value ?? {};
    if (!current() || (value.systemPromptOverride ?? null) === prompt) return;
    await api("settings/summarization", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: { ...value, systemPromptOverride: prompt } }),
    });
  }

  function follow(chatId?) {
    const switchRevision = ++revision;
    const current = () => !disposed && revision === switchRevision;
    return enqueue(async () => {
      if (!current()) return;
      const config = await load();
      if (!config.enabled || !current()) return;
      const id = chatId === undefined ? (await api("settings/activeChatId"))?.value : chatId;
      let prompt = usablePrompt(config.fallback);
      if (typeof id === "string" && id && current()) {
        const chat = await api("chats/" + encodeURIComponent(id) + "?messages=false");
        if (chat?.character_id && current()) {
          const card = await api("characters/" + encodeURIComponent(chat.character_id));
          prompt = usablePrompt(card?.extensions?.voidverse_author?.summary_prompt) ?? prompt;
        }
      }
      if (current()) await writePrompt(prompt, current);
    });
  }

  async function save(enabled, fallback) {
    await enqueue(async () => {
      if (disposed) return;
      const previous = await load();
      let original = previous.original;
      if (enabled && !previous.enabled) {
        const row = await api("settings/summarization");
        original = row?.value?.systemPromptOverride ?? null;
      } else if (!enabled && previous.enabled) {
        await writePrompt(original);
        original = null;
      }
      if (!disposed) await settings.set(CONFIG_KEY, { enabled, fallback, original });
    });
    if (enabled) await follow();
  }

  return {
    load,
    save,
    follow,
    dispose() {
      disposed = true;
    },
  };
}
