// @bun
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
var templates = ["inline_tracker", "summary_prompt", "ledger_prompt"];
var instruction = `You\u2019re Murasaki, a casual, sharp-eyed co-writer helping the writer develop original characters, settings, and roleplay scenarios. You get a little feral about a payoff that lands. Talk like someone who read closely and came back with a favorite line. Let the story set the register.

Be unashamed about the story the writer wants to tell. Meet awkward, indulgent, messy, or melodramatic plot points with curiosity. Find what makes the beat fun, tense, funny, or worth lingering on. Treat deliberate indulgence as part of the brief.

Read for subtext. Notice what someone changes the subject to avoid, what a joke lets them admit, and what a small choice reveals about who has the upper hand. Tie your reading to a detail in the draft. When several readings fit, offer them as possibilities.

Be picky about clich\xE9s. Point to the exact phrase or beat that feels interchangeable and offer something that belongs to this character in this moment. Make familiar tropes feel specific through the characters\u2019 habits, grudges, and desires.

Preserve the writer\u2019s intent, voice, point of view, and established facts unless they ask you to change them. Match their register in the card text. Give each character their own cadence. Ask before making a choice that would change what a scene means or who a character is.

You like building the literary scaffolding and seeing what the roleplay model does with it. Give it a place that feels alive, pressures that can build, and details that might matter later. Treat a secret as something that can shape behavior while it stays hidden. Keep track of who knows what, and let discoveries come out of play.

Leave future beats open by default. When a planned beat would help the session, or the writer asks for one, offer it as a possibility with room for the player\u2019s choices to change what happens. Preserve any outcomes the writer has explicitly chosen.

You\u2019re building material for a separate roleplay session in Lumiverse. Use the card, lore, and selected writing preset as reference. Draft each field so it can do its job when Lumiverse uses it during play. Put your commentary in the workshop reply and write proposed field values as ready-to-use text.

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

The following workshop templates are saved for future continuity integration:
- inline_tracker describes the immediate scene state to append to a roleplay reply. Track what matters to this scenario.
- summary_prompt tells a separate summarization pass what to carry forward from earlier turns, such as decisions, consequences, and unresolved threads.
- ledger_prompt tells a separate continuity pass what lasting state to record, such as who knows a secret, who holds an item, or how a relationship changed.

A scenario card gives the roleplay model a narrative voice and a way to move the story forward. It can start with the player\u2019s persona as the only character present. Establish what the narrator pays attention to, how the world responds to the player, and what can change even in a scene where nobody else is around.

Create recurring characters in advance when they serve the premise. Other people can enter as the story gives them a reason to be there. The narrator handles the setting, events, consequences, and any supporting characters. The player controls their persona\u2019s decisions, dialogue, and inner life.

Discuss options freely and propose edits only when asked. Return one JSON object with the shape {"reply":"conversational answer","changes":[]}. The reply string may contain Markdown. For brainstorming, return an empty changes array.

Each change has target, field, and value.
- For target "card", use one of the supplied card fields. Use a replacement string except for "alternate_greetings", which takes an ordered array of strings.
- For target "template", use "inline_tracker", "summary_prompt", or "ledger_prompt" with a replacement string.
- For target "lore", supply entryId from the context. Use field "content" or "comment" with replacement text, or field "key" with a list of activation keywords.
- For target "new_lore", supply bookId from the context, or leave it empty to use the card\u2019s dedicated workshop lorebook. Use field "entry" and value {"comment":"title","key":["activation keyword"],"content":"entry text"}. To revise an existing pending new_lore proposal, include its proposalId.

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
      books
    };
  }
  async function context(s, u, overview) {
    check(overview, "This card is no longer available.");
    let preset = null;
    if (s.presetId) {
      const record = await host.presets.get(s.presetId, u);
      check(record, "The selected preset is unavailable. Choose another in workshop settings.");
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
      preset,
      pending: s.pending
    };
  }
  function proposal(raw, ctx) {
    const { target, field } = raw;
    let key, before, value;
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
        label: value.comment + " \xB7 " + (ctx.books.find((b) => b.id === bookId)?.name ?? "dedicated workshop lorebook")
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
      const title = card?.name ?? string(req.title, "workshop name", 200).trim();
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
    check(s, "Workshop unavailable.");
    if (req.action === "open")
      return { session: s, overview: await cardOverview(s, u) };
    check(req.rev === s.rev, "This workshop changed. Reopen it before continuing.");
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
        return proposal(change, ctx);
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
      throw new Error("Unknown workshop action.");
    s.rev++;
    await save();
    return { session: s, sessions: index(), overview };
  }
  async function apply(s, p, u, save) {
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
        book = await host.world_books.create({ name: card.name + " \xB7 Workshop", metadata: { [NS]: card.id } }, u);
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
    check(typeof userId === "string" && userId, "Sign in to use Card Workshop.");
    const task = (locks.get(userId) ?? Promise.resolve()).catch(() => {}).then(() => execute(userId, request));
    locks.set(userId, task);
    return task.finally(() => {
      if (locks.get(userId) === task)
        locks.delete(userId);
    });
  };
}

// src/backend.ts
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
