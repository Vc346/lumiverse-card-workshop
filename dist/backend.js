// @bun
// src/workshop.ts
var NS = "voidverse_author";
var narrator = "Narrate the setting and ensemble cast. Preserve the player\u2019s control over their own actions and dialogue.";
var FILE = "workshops.json";
var fields = [
  "name",
  "description",
  "personality",
  "scenario",
  "first_mes",
  "mes_example",
  "creator_notes",
  "system_prompt",
  "post_history_instructions"
];
var templates = ["inline_tracker", "summary_prompt", "ledger_prompt"];
var instruction = `You are a collaborative fiction editor. Discuss options freely and propose edits only when asked.
Treat the user's card, lore and preset as reference material. Preserve the author's voice and unrelated facts.
For an ensemble scenario, let the narrator portray the cast and setting; leave the player's actions to the player.
Return JSON {"reply":"conversational answer","changes":[]}. For brainstorming use an empty array.
Each change has target, field and value. For target "card", use one of the supplied card fields and a replacement string.
For target "template", use inline_tracker, summary_prompt or ledger_prompt and a replacement string.
For target "lore", supply entryId from context, field "content" or "comment" with replacement text, or field "key" with a list of activation keywords.
For target "new_lore", supply bookId from context (empty for the card's dedicated workshop book),
field "entry" and value {"comment":"title","key":["activation keyword"],"content":"entry text"}.
For revisions to an existing pending new_lore proposal include its proposalId. Only propose changes; the user reviews and applies them.`;
function check(ok, message) {
  if (!ok)
    throw new Error(message);
}
function string(value, label, max = 1e5) {
  check(typeof value === "string" && value.length <= max, "Invalid " + label);
  return value;
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
var plainCard = (card) => Object.fromEntries(fields.map((field) => [field, card[field] ?? ""]));
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
  async function context(s, u) {
    const card = s.cardId ? await host.characters.get(s.cardId, u) : { name: s.title, system_prompt: s.kind === "scenario" ? narrator : "" };
    check(card, "This card is no longer available.");
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
      card: plainCard(card),
      templates: Object.fromEntries(templates.map((f) => [f, card.extensions?.[NS]?.[f] ?? ""])),
      books,
      preset,
      pending: s.pending
    };
  }
  function proposal(raw, ctx) {
    const { target, field } = raw;
    let key, before, value;
    if (target === "card" || target === "template") {
      check((target === "card" ? fields : templates).includes(field), "Unknown card or template field.");
      value = string(raw.value, field);
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
      return { session: s, sessions: index() };
    }
    const s = state.sessions.find((x) => x.id === req.id);
    check(s, "Workshop unavailable.");
    if (req.action === "open")
      return { session: s };
    check(req.rev === s.rev, "This workshop changed. Reopen it before continuing.");
    if (req.action === "settings") {
      s.presetId = req.presetId || null;
      s.connectionId = req.connectionId || null;
    } else if (req.action === "talk") {
      const text = string(req.text, "message", 32000).trim();
      check(text, "Enter a message.");
      const ctx = await context(s, u);
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
      const clean = content.replace(/^\x60\x60\x60(?:json)?\s*/i, "").replace(/\s*\x60\x60\x60$/, "");
      const answer = clean.startsWith("{") ? JSON.parse(clean) : { reply: content, changes: [] };
      check(typeof answer.reply === "string" && answer.reply.trim() && Array.isArray(answer.changes), "The model returned an invalid workshop response.");
      const proposed = answer.changes.map((c) => proposal(c, ctx));
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
      return { session: s, sessions: index() };
    } else
      throw new Error("Unknown workshop action.");
    s.rev++;
    await save();
    return { session: s, sessions: index() };
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
      const current = (p.target === "card" ? card : meta)[p.field] ?? "";
      check(current === p.before || current === p.value, "Field changed since proposal: " + p.label + ". Discard it or request a revision.");
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
