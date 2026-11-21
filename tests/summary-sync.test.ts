import { expect, test } from "bun:test";
import { createSummarySync } from "../src/summary-sync";

function fixture() {
  let config;
  const native = { mode: "auto", messageLimitCount: 30, userPromptOverride: "Use the transcript.", systemPromptOverride: "Original" };
  const writes = [];
  const resolveCard = (id) => id === "custom"
    ? { extensions: { voidverse_author: { summary_prompt: "Track the tide." } } }
    : { extensions: {} };
  const settings = {
    get: async () => structuredClone(config),
    set: async (_, value) => { config = structuredClone(value); },
  };
  const api = async (path, options) => {
    if (path === "settings/activeChatId") return { value: "custom" };
    if (path === "settings/summarization") {
      if (options?.method === "PUT") {
        const { value } = JSON.parse(options.body);
        writes.push(value.systemPromptOverride);
        Object.assign(native, value);
      }
      return { value: { ...native } };
    }
    if (path.startsWith("chats/")) return { character_id: path.split(/[/?]/)[1] };
    if (path.startsWith("characters/")) return resolveCard(path.split("/")[1]);
    throw new Error(path);
  };
  return { native, writes, settings, api };
}

test("uses card prompts and a saved fallback while preserving other Loom settings", async () => {
  const f = fixture();
  const sync = createSummarySync(f.settings, f.api);
  await sync.follow("custom");
  expect(f.writes).toEqual([]);
  await sync.save(true, "Remember open questions.");
  await sync.follow("ordinary");
  await sync.follow("custom");
  await sync.follow("custom");
  await sync.follow(null);
  expect(f.writes).toEqual([
    "Track the tide.", "Remember open questions.", "Track the tide.", "Remember open questions.",
  ]);
  expect(f.native).toMatchObject({ mode: "auto", messageLimitCount: 30, userPromptOverride: "Use the transcript." });
  expect((await sync.load()).fallback).toBe("Remember open questions.");
  await sync.save(true, " ");
  await sync.follow("ordinary");
  expect(f.native.systemPromptOverride).toBeNull();
  await sync.save(false, "");
  await sync.follow("custom");
  expect(f.native.systemPromptOverride).toBe("Original");
});

test("a slow card lookup cannot overwrite the prompt for a newer chat switch", async () => {
  const f = fixture();
  const started = Promise.withResolvers();
  const release = Promise.withResolvers();
  const sync = createSummarySync(f.settings, async (path, options) => {
    if (path.startsWith("chats/slow")) {
      started.resolve();
      await release.promise;
      return { character_id: "custom" };
    }
    return f.api(path, options);
  });
  await sync.save(true, "Generic");
  await sync.follow("ordinary");
  const stale = sync.follow("slow");
  await started.promise;
  const latest = sync.follow("ordinary");
  release.resolve();
  await Promise.all([stale, latest]);
  expect(f.writes).toEqual(["Track the tide.", "Generic"]);
});
