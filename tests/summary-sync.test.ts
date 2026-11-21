import { expect, test } from "bun:test";
import { createSummarySync } from "../src/summary-sync";

function fixture(initialConfig?, cardUserPrompt?) {
  let config = initialConfig;
  const native = { mode: "auto", messageLimitCount: 30, userPromptOverride: "Use the transcript.", systemPromptOverride: "Original" };
  const writes = [];
  const resolveCard = (id) => id === "custom"
    ? { extensions: { voidverse_author: { summary_prompt: "Track the tide.", summary_user_prompt: cardUserPrompt } } }
    : { extensions: {} };
  const settings = {
    get: async (key) => {
      expect(key).toMatch(/^[a-z][a-z0-9_]*:[A-Za-z0-9._-]+$/);
      return structuredClone(config);
    },
    set: async (key, value) => {
      expect(key).toMatch(/^[a-z][a-z0-9_]*:[A-Za-z0-9._-]+$/);
      config = structuredClone(value);
    },
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

test("upgrades an enabled install and switches or restores both Loom prompts", async () => {
  const cardUser = "{{previousSummaryBlock}} Follow the tide. {{conversation}}";
  const genericUser = "{{existingSummary}} Track continuity. {{conversation}}";
  const f = fixture({ enabled: true, fallback: "Generic", original: "Original" }, cardUser);
  f.native.systemPromptOverride = "Track the tide.";
  const sync = createSummarySync(f.settings, f.api);
  await sync.follow("custom");
  expect(f.native.userPromptOverride).toBe(cardUser);
  await sync.follow("ordinary");
  expect(f.native.userPromptOverride).toBe("Use the transcript.");
  await sync.save(true, "Generic", genericUser);
  await sync.follow("ordinary");
  expect(f.native.userPromptOverride).toBe(genericUser);
  await sync.follow("custom");
  expect(f.native.userPromptOverride).toBe(cardUser);
  await expect(sync.save(true, "Generic", "{{conversation}}")).rejects.toThrow("{{existingSummary}}");
  expect((await sync.load()).fallbackUser).toBe(genericUser);
  await sync.save(false, "", "");
  expect(f.native).toMatchObject({
    systemPromptOverride: "Original",
    userPromptOverride: "Use the transcript.",
    messageLimitCount: 30,
  });
});
