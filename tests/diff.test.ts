import { test, expect } from "bun:test";
import { diffLines, diffSequence } from "../src/diff";

test("diffSequence finds minimal insertions, deletions, and unchanged items", () => {
  expect(diffSequence(["a", "b", "c"], ["a", "x", "c", "d"])).toEqual([
    { type: "equal", value: "a" },
    { type: "del", value: "b" },
    { type: "add", value: "x" },
    { type: "equal", value: "c" },
    { type: "add", value: "d" },
  ]);
});

test("diffLines highlights inline word changes on modified lines", () => {
  const result = diffLines(
    "Keep Asuka guarded in texts.\nLeave her schedule intact.",
    "Keep Asuka deadpan and guarded in texts.\nLeave her schedule intact.",
  );
  expect(result.removed).toBe(1);
  expect(result.added).toBe(1);
  expect(result.rows[0]).toEqual({
    type: "del",
    text: "Keep Asuka guarded in texts.",
    parts: [{ type: "equal", text: "Keep Asuka guarded in texts." }],
  });
  expect(result.rows[1]).toEqual({
    type: "add",
    text: "Keep Asuka deadpan and guarded in texts.",
    parts: [
      { type: "equal", text: "Keep Asuka " },
      { type: "add", text: "deadpan and " },
      { type: "equal", text: "guarded in texts." },
    ],
  });
  expect(result.rows[2]).toEqual({ type: "equal", text: "Leave her schedule intact." });
});

test("diffLines collapses long unchanged spans with context lines", () => {
  const before = Array.from({ length: 12 }, (_, i) => `Line ${i + 1}`).join("\n");
  const after = Array.from({ length: 12 }, (_, i) => (i === 1 ? "Line 2 updated" : `Line ${i + 1}`)).join("\n");
  const result = diffLines(before, after, 2);
  expect(result.added).toBe(1);
  expect(result.removed).toBe(1);
  expect(result.rows.map((row) => row.type)).toEqual([
    "equal", // Line 1
    "del",   // Line 2
    "add",   // Line 2 updated
    "equal", // Line 3
    "equal", // Line 4
    "skip",  // Lines 5..12 (8 lines)
  ]);
  expect(result.rows.at(-1)).toEqual({ type: "skip", count: 8 });
});

test("diffLines omits inline highlights for completely rewritten lines", () => {
  const result = diffLines("Alpha beta gamma", "Completely different sentence here");
  expect(result.rows[0].type).toBe("del");
  expect(result.rows[1].type).toBe("add");
  expect("parts" in result.rows[0] && result.rows[0].parts).toBeFalsy();
  expect("parts" in result.rows[1] && result.rows[1].parts).toBeFalsy();
});
