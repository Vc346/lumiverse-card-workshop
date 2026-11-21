import { hasSummaryInputs, missingSummaryInputs } from "./summary-prompts";

const CONFIG_KEY = "summary:prompt_sync";
const defaults = { enabled: false, fallback: "", fallbackUser: "", original: null };

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

  async function readLoom() {
    return (await api("settings/summarization"))?.value ?? {};
  }

  async function writePrompts(value, systemPrompt, userPrompt, current = () => !disposed) {
    if (!current() || (
      (value.systemPromptOverride ?? null) === systemPrompt &&
      (value.userPromptOverride ?? null) === userPrompt
    )) return;
    await api("settings/summarization", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        value: { ...value, systemPromptOverride: systemPrompt, userPromptOverride: userPrompt },
      }),
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
      let systemPrompt = usablePrompt(config.fallback);
      let userPrompt = usablePrompt(config.fallbackUser);
      if (typeof id === "string" && id && current()) {
        const chat = await api("chats/" + encodeURIComponent(id) + "?messages=false");
        if (chat?.character_id && current()) {
          const card = await api("characters/" + encodeURIComponent(chat.character_id));
          const templates = card?.extensions?.voidverse_author;
          systemPrompt = usablePrompt(templates?.summary_prompt) ?? systemPrompt;
          const customUserPrompt = usablePrompt(templates?.summary_user_prompt);
          if (customUserPrompt && hasSummaryInputs(customUserPrompt)) userPrompt = customUserPrompt;
        }
      }
      if (!current()) return;
      const loom = await readLoom();
      if (!current()) return;
      if (config.originalUser === undefined) {
        // Older installs only replaced the system prompt. Capture the user prompt
        // before the first sync that can replace it.
        config.originalUser = loom.userPromptOverride ?? null;
        await settings.set(CONFIG_KEY, config);
      }
      await writePrompts(loom, systemPrompt, userPrompt ?? config.originalUser, current);
    });
  }

  async function save(enabled, fallback, fallbackUser = "") {
    if (fallbackUser.trim() && !hasSummaryInputs(fallbackUser))
      throw new Error(missingSummaryInputs);
    await enqueue(async () => {
      if (disposed) return;
      const previous = await load();
      let original = previous.original;
      let originalUser = previous.originalUser;
      if (enabled && !previous.enabled) {
        const loom = await readLoom();
        original = loom.systemPromptOverride ?? null;
        originalUser = loom.userPromptOverride ?? null;
      } else if (!enabled && previous.enabled) {
        const loom = await readLoom();
        const userPrompt = originalUser === undefined ? loom.userPromptOverride ?? null : originalUser;
        await writePrompts(loom, original, userPrompt);
        original = null;
        originalUser = null;
      }
      if (!disposed) await settings.set(CONFIG_KEY, { enabled, fallback, fallbackUser, original, originalUser });
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
