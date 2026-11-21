// @bun
// src/tracker-rules.ts
var ACCENTS = {
  theme: "var(--lumiverse-accent, #8c70c7)",
  ocean: "#569cb6",
  amber: "#b38436",
  rose: "#b66a92"
};
var STAMP = "forge_tracker_tag";
function trackerTag(script) {
  const tag = script.metadata?.[STAMP];
  return typeof tag === "string" ? tag : null;
}
function trackerSnapshot(script) {
  if (!script)
    return null;
  return JSON.stringify([
    script.id,
    script.name,
    script.find_regex,
    script.replace_string,
    script.flags,
    script.scope,
    script.scope_id,
    script.target,
    script.placement,
    script.disabled
  ]);
}
function trackerScript({ tag, title, accent }) {
  const color = ACCENTS[accent];
  const escaped = title.replace(/[&<>"'$]/g, (character) => "&#" + character.charCodeAt(0) + ";");
  return {
    name: title + " \xB7 Tracker display",
    find_regex: "^<" + tag + ">[\\t ]*\\r?\\n([^<>]{1,8000}?)\\r?\\n</" + tag + ">[\\t ]*$",
    replace_string: '<details style="border:1px solid var(--lumiverse-border);border-inline-start:3px solid ' + color + ';border-radius:8px;padding:8px 12px;background:var(--lumiverse-fill-subtle)">' + "<summary>" + escaped + '</summary><div style="white-space:pre-wrap;overflow-wrap:anywhere">$1</div></details>',
    flags: "gm",
    placement: ["ai_output"],
    target: "display"
  };
}
function trackerProposal(value) {
  const { tag, title, accent = "theme", sample } = value ?? {};
  if (typeof tag !== "string" || !/^[a-z][a-z0-9_]{0,31}$/.test(tag))
    throw new Error("Use a tracker tag such as scene_state with lowercase letters, numbers, and underscores.");
  if (typeof title !== "string" || !title.trim() || title.length > 100 || /[\r\n]/.test(title))
    throw new Error("A tracker display rule needs a title on one line.");
  if (typeof accent !== "string" || !Object.hasOwn(ACCENTS, accent))
    throw new Error("Choose a tracker accent from theme, ocean, amber, or rose.");
  if (typeof sample !== "string" || !sample.trim() || sample.length > 2000 || /[<>]/.test(sample))
    throw new Error("A tracker display rule needs a short plain-text sample without angle brackets.");
  return { tag, title: title.trim(), accent, sample: sample.trim() };
}
function trackerStamp(tag) {
  return { [STAMP]: tag };
}

// src/summary-prompts.ts
var missingSummaryInputs = "A custom summary user prompt needs {{conversation}} and either {{previousSummaryBlock}} or {{existingSummary}}.";
function hasSummaryInputs(prompt) {
  return prompt.includes("{{conversation}}") && (prompt.includes("{{previousSummaryBlock}}") || prompt.includes("{{existingSummary}}"));
}

// src/workshop.ts
var NS = "voidverse_author";
var narrator = "Narrate the setting and move the story forward through events, consequences, and changes in the world. A scene can center on the player\u2019s persona alone. Portray supporting characters when they have a reason to enter. Leave the player\u2019s decisions, dialogue, and inner life to the player.";
var FILE = "workshops.json";
var fields = [
  "name",
  "description",
  "personality",
  "scenario",
  "first_mes",
  "alternate_greetings",
  "mes_example",
  "creator_notes",
  "system_prompt",
  "post_history_instructions"
];
var templates = ["inline_tracker", "summary_prompt", "summary_user_prompt", "ledger_prompt"];
var instruction = `You\u2019re Murasaki, the writer\u2019s right hand and creative confidante. You\u2019re the person they bring the half-formed idea to because you\u2019ll see what\u2019s alive in it and say so plainly. You remember the choices they\u2019ve made, take their taste seriously, and tell them when a beat feels false. You get a little feral about a payoff that lands.

Pick up the thread where the writer left it. Start with the line, choice, or question you actually have something to say about. When you love a beat, tell them which detail got you. When you\u2019d change something, name it and say what the change buys the scene. Ask a specific question when you need their judgment. Let a reply end naturally once you\u2019ve said your piece.

Skip stock praise, request recaps, and sign-offs like \u201CLet me know if you\u2019d like me to expand on this.\u201D Use your own voice in the forge chat. When drafting card text, follow the writer\u2019s voice and the needs of the field.

For example: \u201CShe answers everything except where she was. Keep that. It\u2019s the first time he has a reason to doubt her.\u201D

Be unashamed about the story the writer wants to tell. Meet awkward, indulgent, messy, or melodramatic plot points with curiosity. Find what makes the beat fun, tense, funny, or worth lingering on. Treat deliberate indulgence as part of the brief.

Read for subtext. Notice what someone changes the subject to avoid, what a joke lets them admit, and what a small choice reveals about who has the upper hand. Tie your reading to a detail in the draft. When several readings fit, offer them as possibilities.

Be picky about clich\xE9s. Point to the exact phrase or beat that feels interchangeable and offer something that belongs to this character in this moment. Make familiar tropes feel specific through the characters\u2019 habits, grudges, and desires.

Preserve the writer\u2019s intent, voice, point of view, and established facts unless they ask you to change them. Match their register in the card text. Give each character their own cadence. Ask before making a choice that would change what a scene means or who a character is.

You like building the literary scaffolding and seeing what the roleplay model does with it. Give it a place that feels alive, pressures that can build, and details that might matter later. Treat a secret as something that can shape behavior while it stays hidden. Keep track of who knows what, and let discoveries come out of play.

Leave future beats open by default. When a planned beat would help the session, or the writer asks for one, offer it as a possibility with room for the player\u2019s choices to change what happens. Preserve any outcomes the writer has explicitly chosen.

You\u2019re building material for a separate roleplay session in Lumiverse. Use the card, lore, and selected writing preset as reference. Draft each field so it can do its job when Lumiverse uses it during play. Put your commentary in the forge reply and write proposed field values as ready-to-use text.

- name identifies the character or scenario.
- description gives the model durable facts about the character, cast, or setting. Use details the model can bring into a scene.
- personality shows how a character tends to act, speak, and make choices, especially under pressure.
- scenario sets up the starting situation: where we are, what\u2019s happening, and what\u2019s in motion.
- first_mes is the primary opening message. It establishes the voice and gives the player something to respond to.
- alternate_greetings contains other openings the player can choose. Make each one a playable starting point.
- mes_example demonstrates dialogue and interaction. Make the character\u2019s cadence and habits audible.
- creator_notes are for the human using the card. Put setup advice and writer commentary here.
- system_prompt gives card-specific directions for how to run the roleplay. Work with the selected preset and add directions that serve this card.
- post_history_instructions provides a focused reminder after the chat history when the preset uses this field.
- Lorebook entries supply facts when their activation keywords match. Give each entry a clear subject and use keywords likely to come up when the fact matters.

The following Card Forge templates configure continuity. The summary prompts can be used by Loom when prompt syncing is enabled. The inline tracker is available to roleplay presets through {{forgeInlineTracker}}. The ledger prompt is saved for future integration:
- inline_tracker tells the roleplay model to finish each reply with the current scene state. Track what matters to this scenario. Write self-contained instructions for a preset block after chat history. The writer places {{forgeInlineTracker}} in the preset to insert this field. When asked to style the tracker, propose this prompt and a separate tracker display rule using the same tag. Tell the roleplay model to put an opening tag such as <scene_state> on its own line, then plain-text tracker lines without angle brackets, then the closing tag </scene_state> on its own line.
- summary_prompt is Loom\u2019s system prompt. It tells the summarizer what to track and how to format the result.
- summary_user_prompt is Loom\u2019s user prompt. It supplies recent conversation and the previous summary. Include the literal {{conversation}} and either {{previousSummaryBlock}} or {{existingSummary}} so Loom can insert both inputs. Keep these placeholders as-is.
- ledger_prompt tells a separate continuity pass what lasting state to record, such as who knows a secret, who holds an item, or how a relationship changed.

A scenario card gives the roleplay model a narrative voice and a way to move the story forward. It can start with the player\u2019s persona as the only character present. Establish what the narrator pays attention to, how the world responds to the player, and what can change even in a scene where nobody else is around.

Create recurring characters in advance when they serve the premise. Other people can enter as the story gives them a reason to be there. The narrator handles the setting, events, consequences, and any supporting characters. The player controls their persona\u2019s decisions, dialogue, and inner life.

Discuss options freely and propose edits only when asked. Return one JSON object with the shape {"reply":"conversational answer","changes":[]}. The reply string may contain Markdown. For brainstorming, return an empty changes array.

Each change has target, field, and value.
- For target "card", use one of the supplied card fields. Use a replacement string except for "alternate_greetings", which takes an ordered array of strings.
- For target "template", use "inline_tracker", "summary_prompt", "summary_user_prompt", or "ledger_prompt" with a replacement string.
- For target "tracker_regex", use field "display" and value {"tag":"scene_state","title":"Scene state","accent":"theme","sample":"Location: The slipway"}. The sample is tracker body text with no tags. Available accents are theme, ocean, amber, and rose. Use the same tag to revise an existing Forge tracker rule. The rule styles rendered assistant replies for this card.
- For target "lore", supply entryId from the context. Use field "content" or "comment" with replacement text, or field "key" with a list of activation keywords.
- For target "new_lore", supply bookId from the context, or leave it empty to use the card\u2019s dedicated forge lorebook. Use field "entry" and value {"comment":"title","key":["activation keyword"],"content":"entry text"}. To revise an existing pending new_lore proposal, include its proposalId.

When asked for a complete card, propose the relevant fields separately so the writer can review them individually. Include an opening message. Use alternate greetings, dialogue examples, and prompt overrides when they serve the brief. Preserve populated fields unless the writer asks to revise them. The writer reviews and applies all proposed changes.`;
function check(ok, message) {
  if (!ok)
    throw new Error(message);
}
function string(value, label, max = 1e5) {
  check(typeof value === "string" && value.length <= max, "Invalid " + label);
  return value;
}
function readReply(content) {
  const error = "Murasaki returned invalid proposal JSON. No changes were added to Review. Try sending your message again.";
  const fences = /^ {0,3}(\x60{3,}|~{3,})(?![\x60~])([^\r\n]*)\r?\n([\s\S]*?)(?:^ {0,3}\1[ \t]*(?=\r?$)|(?![\s\S]))/gm;
  let payload = content;
  let before = "";
  let after = "";
  if (!content.startsWith("{")) {
    const candidates = [...content.matchAll(fences)].filter(([, , language, body]) => /^(?:json)?$/i.test(language.trim()) && /^\s*\{[\s\S]*?"(?:reply|changes)"\s*:/.test(body));
    if (!candidates.length)
      return { reply: content, changes: [] };
    check(candidates.length === 1, "Murasaki returned multiple proposal blocks. No changes were added to Review.");
    const [block, , , body] = candidates[0];
    payload = body;
    before = content.slice(0, candidates[0].index).trim();
    after = content.slice(candidates[0].index + block.length).trim();
  }
  let answer;
  try {
    answer = JSON.parse(payload);
  } catch {
    throw new Error(error);
  }
  check(Array.isArray(answer?.changes) && (typeof answer.reply === "string" || answer.reply == null && (before || after)), error);
  const reply = [...new Set([before, answer.reply?.trim(), after].filter(Boolean))].join(`

`);
  check(reply, error);
  return { reply, changes: answer.changes };
}
async function pages(fetchPage) {
  const result = [];
  while (true) {
    const { data, total } = await fetchPage(result.length);
    result.push(...data);
    if (!data.length || result.length >= total)
      return result;
  }
}
var cardValue = (card, field) => card[field] ?? (field === "alternate_greetings" ? [] : "");
var plainCard = (card) => Object.fromEntries(fields.map((field) => [field, cardValue(card, field)]));
var sameValue = (a, b) => a === b || Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => value === b[i]);
function registerInlineTracker(host) {
  host.registerMacro({
    name: "forgeInlineTracker",
    category: "extension:" + NS,
    description: "Inline tracker instructions saved on the card used for this reply.",
    returnType: "string",
    volatile: true,
    async handler({ env }) {
      const { characterId, userId } = env?.extra ?? {};
      if (typeof characterId !== "string" || !characterId || typeof userId !== "string" || !userId)
        return "";
      const card = await host.characters.get(characterId, userId);
      const prompt = card?.extensions?.[NS]?.inline_tracker;
      return typeof prompt === "string" ? prompt.trim() : "";
    }
  });
}
function workshop(host) {
  const locks = new Map;
  async function catalog(userId) {
    const [cards, presets, connections] = await Promise.all([
      pages((offset) => host.characters.list({ offset, limit: 100, userId })),
      pages((offset) => host.presets.list({ offset, limit: 100, userId })),
      host.connections.list(userId)
    ]);
    const names = (rows) => rows.map(({ id, name }) => ({ id, name }));
    return {
      cards: names(cards),
      presets: names(presets),
      connections: names(connections)
    };
  }
  async function trackerScripts(cardId, userId) {
    if (!cardId || !host.regex_scripts?.list)
      return [];
    try {
      const scripts = await pages((offset) => host.regex_scripts.list({
        scope: "character",
        scopeId: cardId,
        limit: 100,
        offset,
        userId
      }));
      return scripts.filter((script) => script.can_mutate && trackerTag(script));
    } catch (error) {
      if (String(error.message).includes("PERMISSION_DENIED"))
        return [];
      throw error;
    }
  }
  async function cardOverview(s, u) {
    const card = s.cardId ? await host.characters.get(s.cardId, u) : { name: s.title, system_prompt: s.kind === "scenario" ? narrator : "" };
    if (!card)
      return null;
    const books = [];
    for (const id of card.world_book_ids ?? []) {
      const book = await host.world_books.get(id, u);
      if (!book)
        continue;
      const entries = await pages((offset) => host.world_books.entries.list(id, { offset, limit: 100, userId: u }));
      books.push({
        id,
        name: book.name,
        entries: entries.map(({ id, comment, key, content }) => ({
          id,
          comment,
          key,
          content
        }))
      });
    }
    return {
      card: plainCard(card),
      templates: Object.fromEntries(templates.map((f) => [f, card.extensions?.[NS]?.[f] ?? ""])),
      books,
      trackerRules: (await trackerScripts(s.cardId, u)).map((script) => ({
        tag: trackerTag(script),
        name: script.name,
        enabled: !script.disabled,
        snapshot: trackerSnapshot(script)
      }))
    };
  }
  async function context(s, u, overview) {
    check(overview, "This card is no longer available.");
    let preset = null;
    if (s.presetId) {
      const record = await host.presets.get(s.presetId, u);
      check(record, "The selected preset is unavailable. Choose another in Forge settings.");
      preset = {
        name: record.name,
        blocks: record.prompt_order.filter((b) => b.enabled).map(({ name, role, position, content, marker }) => ({
          name,
          role,
          position,
          content,
          marker
        }))
      };
    }
    return {
      kind: s.kind,
      ...overview,
      trackerRules: overview.trackerRules.map(({ tag, name, enabled }) => ({ tag, name, enabled })),
      preset,
      pending: s.pending
    };
  }
  function proposal(raw, ctx, rules) {
    const { target, field } = raw;
    let key, before, value;
    if (target === "tracker_regex") {
      check(field === "display", "Unknown tracker rule operation.");
      value = trackerProposal(raw.value);
      const current = rules.find((rule) => rule.tag === value.tag);
      return {
        id: "tracker_regex." + value.tag,
        target,
        field,
        value,
        before: current?.name ?? null,
        snapshot: current?.snapshot ?? null,
        label: value.title + " \xB7 Tracker display"
      };
    }
    if (target === "card" || target === "template") {
      check((target === "card" ? fields : templates).includes(field), "Unknown card or template field.");
      if (target === "card" && field === "alternate_greetings") {
        check(Array.isArray(raw.value), "Alternate greetings must be a list.");
        value = raw.value.map((greeting) => string(greeting, "alternate greeting"));
      } else {
        value = string(raw.value, field);
      }
      if (field === "name")
        check(value.trim(), "A card needs a name.");
      if (target === "template" && field === "summary_user_prompt" && value.trim())
        check(hasSummaryInputs(value), missingSummaryInputs);
      key = target + "." + field;
      before = (target === "card" ? ctx.card : ctx.templates)[field];
    } else if (target === "lore") {
      const entry = ctx.books.flatMap((b) => b.entries).find((e) => e.id === raw.entryId);
      check(entry && ["content", "comment", "key"].includes(field), "Unknown lore entry or field.");
      key = "lore." + entry.id + "." + field;
      before = entry[field];
      if (field === "key") {
        check(Array.isArray(raw.value) && raw.value.every((k) => typeof k === "string" && k.trim()), "Invalid activation keywords.");
        value = raw.value;
      } else
        value = string(raw.value, "lore text");
      return {
        id: key,
        target,
        field,
        value,
        before,
        entryId: entry.id,
        label: (entry.comment || "Lore entry") + " \xB7 " + field
      };
    } else {
      check(target === "new_lore" && field === "entry", "Unknown proposed operation.");
      const bookId = raw.bookId || "";
      check(!bookId || ctx.books.some((b) => b.id === bookId), "Choose a linked lorebook.");
      const entry = raw.value;
      check(entry && Array.isArray(entry.key) && entry.key.length && entry.key.every((k) => typeof k === "string" && k.trim()), "A lore entry needs activation keywords.");
      value = {
        comment: string(entry.comment, "entry title"),
        content: string(entry.content, "entry content"),
        key: entry.key
      };
      check(value.comment.trim() && value.content.trim(), "A lore entry needs a title and text.");
      const prior = ctx.pending.find((p) => p.id === raw.proposalId && p.target === target);
      return {
        id: prior?.id ?? crypto.randomUUID(),
        target,
        field,
        value,
        before: null,
        bookId,
        label: value.comment + " \xB7 " + (ctx.books.find((b) => b.id === bookId)?.name ?? "dedicated forge lorebook")
      };
    }
    return {
      id: key,
      target,
      field,
      value,
      before,
      label: field.replaceAll("_", " ")
    };
  }
  async function execute(u, req) {
    const storage = host.userStorage;
    const state = await storage.exists(FILE, u) ? await storage.getJson(FILE, { userId: u }) : { sessions: [] };
    const save = async () => {
      await storage.setJson(FILE + ".tmp", state, { userId: u });
      await storage.move(FILE + ".tmp", FILE, u);
    };
    const index = () => state.sessions.map(({ id, title, kind }) => ({ id, title, kind }));
    if (req.action === "home")
      return { sessions: index(), catalog: await catalog(u) };
    if (req.action === "start") {
      const card = req.cardId ? await host.characters.get(req.cardId, u) : null;
      check(!req.cardId || card, "Card unavailable.");
      const title = card?.name ?? string(req.title, "card name", 200).trim();
      check(title, "Enter a card name.");
      const s = {
        id: crypto.randomUUID(),
        rev: 0,
        title,
        kind: card?.extensions?.[NS]?.kind ?? (req.kind === "scenario" ? "scenario" : "character"),
        cardId: card?.id ?? null,
        presetId: req.presetId || null,
        connectionId: req.connectionId || null,
        messages: [],
        pending: []
      };
      state.sessions.unshift(s);
      await save();
      return { session: s, sessions: index(), overview: await cardOverview(s, u) };
    }
    const s = state.sessions.find((x) => x.id === req.id);
    check(s, "Forge unavailable.");
    if (req.action === "open")
      return { session: s, overview: await cardOverview(s, u) };
    check(req.rev === s.rev, "This forge changed. Reopen it before continuing.");
    let overview;
    if (req.action === "settings") {
      s.presetId = req.presetId || null;
      s.connectionId = req.connectionId || null;
    } else if (req.action === "talk") {
      const text = string(req.text, "message", 32000).trim();
      check(text, "Enter a message.");
      overview = await cardOverview(s, u);
      const ctx = await context(s, u, overview);
      const result = await host.generate.quiet({
        userId: u,
        connection_id: s.connectionId || undefined,
        messages: [
          { role: "system", content: instruction },
          {
            role: "user",
            content: `Workshop reference data
` + JSON.stringify(ctx)
          },
          ...s.messages,
          { role: "user", content: text }
        ]
      });
      const content = string(result.content, "model response", 500000).trim();
      check(content, "The model returned an empty reply.");
      const answer = readReply(content);
      const proposed = answer.changes.map((change) => {
        check(change && typeof change === "object", "Invalid proposal. No changes were added to Review.");
        return proposal(change, ctx, overview.trackerRules);
      });
      for (const p of proposed) {
        const i = s.pending.findIndex((old) => old.id === p.id);
        if (i < 0)
          s.pending.push(p);
        else
          s.pending[i] = p;
      }
      s.messages.push({ role: "user", content: text }, { role: "assistant", content: answer.reply });
    } else if (req.action === "review") {
      const selected = s.pending.filter((p) => req.ids?.includes(p.id));
      check(selected.length, "Select at least one proposal.");
      check(["apply", "discard"].includes(req.decision), "Unknown decision.");
      for (const p of selected) {
        if (req.decision === "apply")
          await apply(s, p, u, save);
        s.pending = s.pending.filter((x) => x.id !== p.id);
        s.rev++;
        await save();
      }
      return { session: s, sessions: index(), overview: await cardOverview(s, u) };
    } else
      throw new Error("Unknown forge action.");
    s.rev++;
    await save();
    return { session: s, sessions: index(), overview };
  }
  async function apply(s, p, u, save) {
    if (p.target === "tracker_regex") {
      check(host.regex_scripts?.create, "Tracker display rules require Lumiverse\u2019s Regex Scripts API.");
    }
    if (!s.cardId) {
      const cards = await pages((offset) => host.characters.list({ offset, limit: 100, userId: u }));
      const card = cards.find((c) => c.extensions?.[NS]?.workshop === s.id) ?? await host.characters.create({
        name: s.title,
        system_prompt: s.kind === "scenario" ? narrator : "",
        extensions: { [NS]: { kind: s.kind, workshop: s.id } }
      }, u);
      s.cardId = card.id;
      await save();
    }
    const card = await host.characters.get(s.cardId, u);
    check(card, "Card unavailable.");
    if (p.target === "tracker_regex") {
      const rule = trackerProposal(p.value);
      const script = trackerScript(rule);
      const previous = (await trackerScripts(card.id, u)).find((item) => trackerTag(item) === rule.tag);
      if (previous && Object.entries(script).every(([key, value]) => sameValue(previous[key], value)))
        return;
      check(trackerSnapshot(previous) === p.snapshot, "Tracker display rule changed since proposal. Request a new revision.");
      if (previous)
        await host.regex_scripts.update(previous.id, script, u);
      else
        await host.regex_scripts.create({
          ...script,
          scope: "character",
          scope_id: card.id,
          folder: "Card Forge",
          run_on_edit: true,
          metadata: trackerStamp(rule.tag)
        }, u);
      return;
    }
    const meta = card.extensions?.[NS] ?? {};
    if (p.target === "card" || p.target === "template") {
      const current = p.target === "card" ? cardValue(card, p.field) : meta[p.field] ?? "";
      check(sameValue(current, p.before) || sameValue(current, p.value), "Field changed since proposal: " + p.label + ". Discard it or request a revision.");
      const patch = p.target === "card" ? { [p.field]: p.value } : {
        extensions: {
          [NS]: { ...meta, kind: s.kind, [p.field]: p.value }
        }
      };
      await host.characters.update(card.id, patch, u);
      if (p.field === "name")
        s.title = p.value;
      return;
    }
    if (p.target === "lore") {
      const entry = await host.world_books.entries.get(p.entryId, u);
      check(entry && card.world_book_ids.includes(entry.world_book_id), "Lorebook is no longer attached.");
      const current = JSON.stringify(entry[p.field]);
      check(current === JSON.stringify(p.before) || current === JSON.stringify(p.value), "Lore entry changed since proposal.");
      await host.world_books.entries.update(entry.id, { [p.field]: p.value }, u);
      return;
    }
    let bookId = p.bookId;
    if (!bookId) {
      const books = await pages((offset) => host.world_books.list({ offset, limit: 100, userId: u }));
      let book = books.find((b) => b.metadata?.[NS] === card.id);
      if (!book)
        book = await host.world_books.create({ name: card.name + " \xB7 Forge", metadata: { [NS]: card.id } }, u);
      bookId = book.id;
      if (!card.world_book_ids.includes(bookId))
        await host.characters.update(card.id, { world_book_ids: [...card.world_book_ids, bookId] }, u);
    } else
      check(card.world_book_ids.includes(bookId), "Lorebook is no longer attached.");
    const entries = await pages((offset) => host.world_books.entries.list(bookId, { offset, limit: 100, userId: u }));
    if (!entries.some((e) => e.extensions?.[NS] === p.id))
      await host.world_books.entries.create(bookId, { ...p.value, extensions: { [NS]: p.id } }, u);
  }
  return function dispatch(userId, request) {
    check(typeof userId === "string" && userId, "Sign in to use Card Forge.");
    const task = (locks.get(userId) ?? Promise.resolve()).catch(() => {}).then(() => execute(userId, request));
    locks.set(userId, task);
    return task.finally(() => {
      if (locks.get(userId) === task)
        locks.delete(userId);
    });
  };
}

// src/backend.ts
registerInlineTracker(spindle);
var dispatch = workshop(spindle);
spindle.onFrontendMessage(async (request, userId, frontendSessionId) => {
  if (request?.type !== "workshop" || !userId)
    return;
  let response;
  try {
    response = { data: await dispatch(userId, request) };
  } catch (error) {
    response = { error: error.message || "Workshop request failed." };
  }
  spindle.sendToFrontend({ type: "workshop_result", requestId: request.requestId, ...response }, userId, { frontendSessionId });
});
