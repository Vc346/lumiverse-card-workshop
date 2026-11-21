const ACCENTS = {
  theme: "var(--lumiverse-accent, #8c70c7)",
  ocean: "#569cb6",
  amber: "#b38436",
  rose: "#b66a92",
};

const STAMP = "forge_tracker_tag";

export function trackerTag(script) {
  const tag = script.metadata?.[STAMP];
  return typeof tag === "string" ? tag : null;
}

export function trackerSnapshot(script) {
  if (!script) return null;
  return JSON.stringify([
    script.id, script.name, script.find_regex, script.replace_string, script.flags,
    script.scope, script.scope_id, script.target, script.placement, script.disabled,
  ]);
}

export function trackerScript({ tag, title, accent }) {
  const color = ACCENTS[accent];
  const escaped = title.replace(/[&<>"'$]/g, (character) => "&#" + character.charCodeAt(0) + ";");
  return {
    name: title + " · Tracker display",
    find_regex: "^<" + tag + ">[\\t ]*\\r?\\n([^<>]{1,8000}?)\\r?\\n</" + tag + ">[\\t ]*$",
    replace_string: '<details style="border:1px solid var(--lumiverse-border);border-inline-start:3px solid ' +
      color + ';border-radius:8px;padding:8px 12px;background:var(--lumiverse-fill-subtle)">' +
      '<summary>' + escaped + '</summary><div style="white-space:pre-wrap;overflow-wrap:anywhere">$1</div></details>',
    flags: "gm",
    placement: ["ai_output"],
    target: "display",
  };
}

export function trackerProposal(value) {
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

export function trackerStamp(tag) {
  return { [STAMP]: tag };
}
