import { test, expect } from "bun:test";
import { workshop } from "../src/workshop";

function fixture() {
  const data = new Map(),
    cards = [],
    books = [],
    entries = [],
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
        return { content: JSON.stringify(answer) };
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
  expect(f.cards[0].system_prompt).toContain("ensemble");
  expect(f.cards[0].world_book_ids).toEqual([f.books[0].id]);
  expect(f.entries[0].content).toBe("Ivo has the key.");
  expect(s.pending).toHaveLength(1);
  await cmd("review", { decision: "apply", ids: [s.pending[0].id] });
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
