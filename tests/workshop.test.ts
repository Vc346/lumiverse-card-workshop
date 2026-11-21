import { test, expect } from "bun:test";
import { registerInlineTracker, workshop } from "../src/workshop";

function fixture() {
  const data = new Map(),
    cards = [],
    books = [],
    entries = [],
    scripts = [],
    calls = [];
  let answer;
  function collection(list) {
    return {
      list: async () => ({ data: structuredClone(list), total: list.length }),
      get: async (id) => structuredClone(list.find((row) => row.id === id)),
      create: async (body) => {
        const row = { id: crypto.randomUUID(), world_book_ids: [], ...body };
        list.push(row);
        return structuredClone(row);
      },
      update: async (id, patch) => {
        const row = list.find((row) => row.id === id);
        Object.assign(row, patch);
        return structuredClone(row);
      },
    };
  }
  const host = {
    characters: collection(cards),
    regex_scripts: {
      ...collection(scripts),
      list: async ({ scope, scopeId }) => {
        const data = scripts.filter((script) => script.scope === scope && script.scope_id === scopeId);
        return { data: structuredClone(data), total: data.length };
      },
      create: async (body) => collection(scripts).create({ ...body, can_mutate: true }),
    },
    world_books: {
      ...collection(books),
      entries: {
        ...collection(entries),
        list: async (book) => {
          const data = entries.filter((e) => e.world_book_id === book);
          return { data, total: data.length };
        },
        create: async (book, body) =>
          collection(entries).create({ world_book_id: book, ...body }),
      },
    },
    presets: collection([
      {
        id: "preset",
        name: "Writer",
        prompt_order: [
          { enabled: true, content: "Slow pacing" },
          { enabled: false, content: "Disabled prompt" },
        ],
      },
    ]),
    connections: { list: async () => [] },
    generate: {
      quiet: async (request) => {
        calls.push(request);
        return { content: typeof answer === "string" ? answer : JSON.stringify(answer) };
      },
    },
    userStorage: {
      exists: async (path, user) => data.has(user + path),
      getJson: async (path, { userId }) =>
        structuredClone(data.get(userId + path)),
      setJson: async (path, value, { userId }) =>
        data.set(userId + path, structuredClone(value)),
      move: async (from, to, user) => {
        data.set(user + to, data.get(user + from));
        data.delete(user + from);
      },
    },
  };
  return {
    host,
    cards,
    books,
    entries,
    scripts,
    calls,
    respond: (value) => (answer = value),
  };
}
test("brainstorm, revise, selectively apply, resume and detect concurrent edits", async () => {
  const f = fixture();
  const run = workshop(f.host);
  let { session: s } = await run("alice", {
    action: "start",
    kind: "scenario",
    title: "Archive",
    presetId: "preset",
    connectionId: "nano",
  });
  const cmd = async (action, extra = {}) => {
    s = (await run("alice", { action, id: s.id, rev: s.rev, ...extra }))
      .session;
  };
  f.respond({ reply: "Try contrasting rhythms.", changes: [] });
  await cmd("talk", { text: "Give me two options." });
  expect(f.cards).toHaveLength(0);
  expect(f.calls[0].connection_id).toBe("nano");
  expect(f.calls[0].userId).toBe("alice");
  expect(f.calls[0].messages[0].content).toContain("You’re Murasaki");
  expect(f.calls[0].messages[0].content).toContain("Return one JSON object");
  const reference = JSON.parse(f.calls[0].messages[1].content.split("\n")[1]);
  expect(reference.card.system_prompt).toContain("player’s persona alone");
  expect(f.calls[0].messages[1].content).toContain("Slow pacing");
  expect(f.calls[0].messages[1].content).not.toContain("Disabled prompt");
  const changes = [
    {
      target: "card",
      field: "description",
      value: "Mara speaks in fragments.",
    },
    {
      target: "new_lore",
      field: "entry",
      value: { comment: "A secret", content: "Ivo has the key.", key: ["Ivo"] },
    },
    {
      target: "template",
      field: "inline_tracker",
      value: "Track who knows the secret.",
    },
  ];
  f.respond({ reply: "Here are my edits.", changes });
  await cmd("talk", {
    text: "Apply the second idea and propose lore and tracker changes.",
  });
  expect(
    (await workshop(f.host)("alice", { action: "open", id: s.id })).session
      .pending,
  ).toEqual(s.pending);
  await cmd("review", {
    decision: "apply",
    ids: [s.pending[0].id, s.pending[1].id],
  });
  expect(f.cards[0].description).toBe(changes[0].value);
  expect(f.cards[0].system_prompt).toBe(reference.card.system_prompt);
  expect(f.cards[0].world_book_ids).toEqual([f.books[0].id]);
  expect(f.entries[0].content).toBe("Ivo has the key.");
  expect(s.pending).toHaveLength(1);
  await cmd("review", { decision: "apply", ids: [s.pending[0].id] });
  const { overview } = await run("alice", { action: "open", id: s.id });
  expect(overview.card.description).toBe(changes[0].value);
  expect(overview.card.personality).toBe("");
  expect(overview.templates.inline_tracker).toBe(changes[2].value);
  expect(overview.books[0].entries).toEqual([
    { id: f.entries[0].id, ...changes[1].value },
  ]);
  f.cards[0].description = "Edited in Lumiverse.";
  const refreshed = await run("alice", { action: "open", id: s.id });
  expect(refreshed.overview.card.description).toBe("Edited in Lumiverse.");
  expect(refreshed.session.rev).toBe(s.rev);
  expect(f.cards[0].extensions.voidverse_author.inline_tracker).toBe(
    changes[2].value,
  );
  f.respond({
    reply: "Two revisions.",
    changes: [
      { ...changes[0], value: "Mara whispers." },
      {
        target: "lore",
        entryId: f.entries[0].id,
        field: "content",
        value: "It was a copy.",
      },
    ],
  });
  await cmd("talk", { text: "Revise both." });
  f.entries[0].content = "Manual edit";
  await expect(
    cmd("review", { decision: "apply", ids: s.pending.map((p) => p.id) }),
  ).rejects.toThrow("changed");
  s = (await run("alice", { action: "open", id: s.id })).session;
  expect(s.pending).toHaveLength(1);
  expect(f.cards[0].description).toBe("Mara whispers.");
  expect(f.entries[0].content).toBe("Manual edit");
  await cmd("review", { decision: "discard", ids: [s.pending[0].id] });
  expect((await run("bob", { action: "home" })).sessions).toEqual([]);
  await expect(run("bob", { action: "open", id: s.id })).rejects.toThrow(
    "unavailable",
  );
  await expect(
    run("alice", { action: "talk", rev: 0, id: s.id, text: "stale" }),
  ).rejects.toThrow("changed");
});

test("alternate greetings preserve order and detect edits made after a proposal", async () => {
  const f = fixture();
  const run = workshop(f.host);
  await f.host.characters.create({
    name: "Archive",
    alternate_greetings: ["The doors open.", "The lights go out."],
  });
  const [card] = f.cards;
  const { session } = await run("alice", { action: "start", cardId: card.id });
  const value = ["Mara unlocks the archive.", "Ivo knocks twice."];
  f.respond({
    reply: "Here are two alternate openings.",
    changes: [{ target: "card", field: "alternate_greetings", value }],
  });
  const propose = (rev) =>
    run("alice", { action: "talk", id: session.id, rev, text: "Revise the alternate greetings." });
  const first = (await propose(session.rev)).session;
  expect(first.pending[0].before).toEqual(card.alternate_greetings);
  const apply = (s) =>
    run("alice", {
      action: "review",
      id: s.id,
      rev: s.rev,
      decision: "apply",
      ids: [s.pending[0].id],
    });
  const applied = (await apply(first)).session;
  expect(card.alternate_greetings).toEqual(value);

  const revised = (await propose(applied.rev)).session;
  card.alternate_greetings = [...value].reverse();
  await expect(apply(revised)).rejects.toThrow("changed since proposal");
  expect(card.alternate_greetings).toEqual([...value].reverse());
});

test("fenced proposals with surrounding prose reach Review without exposing JSON", async () => {
  const f = fixture();
  const run = workshop(f.host);
  const { session } = await run("alice", { action: "start", title: "Slipway" });
  const entry = { comment: "Tides and Weather", key: ["tide"], content: "The tide turns fast." };
  const change = { target: "new_lore", field: "entry", value: entry };
  const talk = (s) => run("alice", { action: "talk", id: s.id, rev: s.rev, text: "Draft a lore entry." });
  const fence = String.fromCharCode(96).repeat(3);
  f.respond("Here’s what I’d add.\n\n" + fence + "json\n" +
    JSON.stringify({ reply: "The tide makes a good clock for the scene.", changes: [change] }) +
    "\n" + fence + "\n\nWe can narrow the keyword later.");
  const { session: proposed } = await talk(session);
  expect(proposed.pending[0].value).toEqual(entry);
  expect(proposed.messages.at(-1).content).toBe(
    "Here’s what I’d add.\n\nThe tide makes a good clock for the scene.\n\nWe can narrow the keyword later.",
  );
  f.respond("One more entry.\n" + fence + 'json\n{"changes": [\n' + fence);
  await expect(talk(proposed)).rejects.toThrow("invalid proposal JSON");
  const { session: reopened } = await run("alice", { action: "open", id: session.id });
  expect(reopened.pending).toEqual(proposed.pending);
  expect(reopened.messages).toEqual(proposed.messages);
  await run("alice", {
    action: "review", id: reopened.id, rev: reopened.rev,
    decision: "apply", ids: [reopened.pending[0].id],
  });
  expect(f.entries[0].content).toBe(entry.content);
});

test("requires both Loom inputs before saving a proposed summary user prompt", async () => {
  const f = fixture();
  const run = workshop(f.host);
  const { session } = await run("alice", { action: "start", title: "Slipway" });
  const talk = (value) => {
    f.respond({
      reply: "Here is a template.",
      changes: [{ target: "template", field: "summary_user_prompt", value }],
    });
    return run("alice", { action: "talk", id: session.id, rev: session.rev, text: "Draft the user prompt." });
  };
  await expect(talk("Read {{existingSummary}}.")).rejects.toThrow("{{conversation}}");
  const value = "{{existingSummary}}\nUpdate from these events:\n{{conversation}}";
  const { session: proposed } = await talk(value);
  const { overview } = await run("alice", {
    action: "review", id: proposed.id, rev: proposed.rev,
    decision: "apply", ids: [proposed.pending[0].id],
  });
  expect(overview.templates.summary_user_prompt).toBe(value);
});

test("approves and revises passive tracker regex for just the active card", async () => {
  const f = fixture();
  const run = workshop(f.host);
  let { session } = await run("alice", { action: "start", title: "Slipway" });
  const change = {
    target: "tracker_regex", field: "display",
    value: { tag: "scene_state", title: "Tide $1 & weather", accent: "ocean", sample: "Tide: falling" },
  };
  async function propose(title = change.value.title) {
    f.respond({ reply: "Here is the display rule.", changes: [
      { ...change, value: { ...change.value, title } },
    ] });
    session = (await run("alice", {
      action: "talk", id: session.id, rev: session.rev, text: "Style this tracker.",
    })).session;
  }
  async function apply() {
    const result = await run("alice", {
      action: "review", id: session.id, rev: session.rev,
      decision: "apply", ids: [session.pending[0].id],
    });
    session = result.session;
    return result.overview;
  }
  await propose();
  expect(f.scripts).toHaveLength(0);
  const overview = await apply();
  expect(overview.trackerRules[0].tag).toBe("scene_state");
  expect(f.scripts[0]).toMatchObject({
    scope: "character", scope_id: session.cardId, target: "display", placement: ["ai_output"],
  });
  const { find_regex, flags, replace_string } = f.scripts[0];
  const sample = "The hull creaks.\n<scene_state>\nTide: falling\n</scene_state>\nShe turns.";
  const output = sample.replace(new RegExp(find_regex, flags), replace_string);
  expect(output).toContain("The hull creaks.\n<details");
  expect(output).toContain("Tide &#36;1 &#38; weather");
  expect(output).toContain("Tide: falling</div></details>\nShe turns.");
  expect("<scene_state>\n<script>\n</scene_state>".replace(new RegExp(find_regex, flags), replace_string))
    .toBe("<scene_state>\n<script>\n</scene_state>");
  await propose("New tracker title");
  await apply();
  expect(f.scripts).toHaveLength(1);
  expect(f.scripts[0].name).toBe("New tracker title · Tracker display");
  await propose("Another title");
  f.scripts[0].replace_string = "Manual edit";
  await expect(apply()).rejects.toThrow("changed since proposal");
  expect(f.scripts[0].replace_string).toBe("Manual edit");
});

test("the inline tracker macro resolves the card and user from each generation", async () => {
  let macro;
  const calls = [];
  const tracker = new Map([
    ["alice/card-a", "Track {{user}}’s location."],
    ["alice/card-b", "Track the tide."],
    ["bob/card-a", "Track the time."],
  ]);
  registerInlineTracker({
    registerMacro: (definition) => { macro = definition; },
    characters: {
      get: async (id, userId) => {
        calls.push([id, userId]);
        return { extensions: { voidverse_author: { inline_tracker: tracker.get(userId + "/" + id) } } };
      },
    },
  });
  const resolve = (characterId, userId) => macro.handler({ env: { extra: { characterId, userId } } });
  expect(macro.name).toBe("forgeInlineTracker");
  expect(await resolve("card-a", "alice")).toBe("Track {{user}}’s location.");
  expect(await resolve("card-b", "alice")).toBe("Track the tide.");
  expect(await resolve("card-a", "bob")).toBe("Track the time.");
  tracker.set("alice/card-a", "Track the ferry schedule.");
  expect(await resolve("card-a", "alice")).toBe("Track the ferry schedule.");
  expect(await resolve("card-empty", "alice")).toBe("");
  expect(await resolve("card-a", undefined)).toBe("");
  expect(calls).toHaveLength(5);
});
