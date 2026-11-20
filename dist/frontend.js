// src/frontend.ts
var fieldLabels = {
  name: "Name",
  description: "Description",
  personality: "Personality",
  scenario: "Scenario",
  first_mes: "Opening message",
  alternate_greetings: "Alternate greetings",
  mes_example: "Example dialogue",
  creator_notes: "Creator notes",
  system_prompt: "System prompt",
  post_history_instructions: "Post-history instructions",
  inline_tracker: "Inline tracker prompt",
  summary_prompt: "Summary prompt",
  ledger_prompt: "Ledger prompt"
};
function setup(ctx) {
  const tab = ctx.ui.registerDrawerTab({
    id: "card-workshop",
    title: "Card Workshop"
  });
  const root = document.createElement("section");
  root.className = "vv-author";
  tab.root.appendChild(root);
  const removeStyle = ctx.dom.addStyle(`
    .vv-author {padding:12px; display:grid; gap:12px; color:var(--lumiverse-text); font:inherit; overflow-wrap:anywhere}
    .vv-author label,.vv-author details,.vv-author article {display:grid; gap:5px}
    .vv-author button,.vv-author select,.vv-author textarea,.vv-author input:not([type=checkbox]) {font:inherit;color:inherit;background:var(--lumiverse-fill);border:1px solid var(--lumiverse-border);border-radius:var(--lumiverse-radius,8px);padding:8px;min-width:0;max-width:100%}
    .vv-author select option {color:CanvasText;background:Canvas}
    .vv-author button {cursor:pointer}
    .vv-author button:disabled {opacity:.55}
    .vv-author textarea {width:100%;box-sizing:border-box}
    .vv-author p,.vv-author pre {margin:0;white-space:pre-wrap;font:inherit}
    .vv-author.vv-editor {box-sizing:border-box;height:var(--vv-height,65vh);display:flex;flex-direction:column;overflow:auto}
    .vv-author .vv-controls {max-height:42%;flex:none;overflow:auto;display:grid;gap:8px}
    .vv-author .vv-controls:has([data-section="overview"][open]) {max-height:65%}
    .vv-author .vv-preview {display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--lumiverse-text-muted);font-size:.88em}
    .vv-author details[open] > summary > .vv-preview {display:none}
    .vv-author h3 {margin:0}
    .vv-author .vv-log {flex:1 1 auto;min-height:0;overflow:auto;display:grid;align-content:start;gap:10px}
    .vv-author .vv-composer {flex:none;display:grid;gap:6px}
    .vv-author .vv-composer textarea {font-size:max(16px,1em);resize:vertical}
    .vv-author .vv-proposal {display:grid;grid-template-columns:auto minmax(0,1fr);align-items:start;gap:6px}
    .vv-author details > summary {cursor:pointer}
    .vv-author details[open] > summary {margin-bottom:6px}
    .vv-author article,.vv-author details {border:1px solid var(--lumiverse-border);padding:10px;border-radius:8px}
    .vv-author .vv-actions {display:flex;gap:6px;flex-wrap:wrap}
    .vv-author .vv-status {color:var(--lumiverse-text-muted)}
  `);
  let library, sessions = [], session = null, overview = null, busy = false, status = "", alive = true;
  let draft = "", setupCard = "", setupTitle = "", setupKind = "character", preset = "", connection = "";
  let selected = new Set;
  let openSections = new Set;
  let viewportFrame = 0;
  const viewport = window.visualViewport;
  function fitEditor() {
    if (viewportFrame)
      return;
    viewportFrame = window.requestAnimationFrame(() => {
      viewportFrame = 0;
      if (!session || !root.getClientRects().length)
        return;
      const top = root.getBoundingClientRect().top;
      let bottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight);
      for (let parent = root.parentElement;parent; parent = parent.parentElement) {
        if (/^(auto|scroll|hidden|clip)$/.test(getComputedStyle(parent).overflowY))
          bottom = Math.min(bottom, parent.getBoundingClientRect().bottom);
      }
      root.style.setProperty("--vv-height", Math.max(1, Math.floor(bottom - top)) + "px");
    });
  }
  const resize = new ResizeObserver(fitEditor);
  resize.observe(root);
  viewport?.addEventListener("resize", fitEditor);
  viewport?.addEventListener("scroll", fitEditor);
  window.addEventListener("resize", fitEditor);
  root.addEventListener("focusin", fitEditor);
  let sequence = 0;
  const waiting = new Map;
  const unsubscribe = ctx.onBackendMessage((msg) => {
    if (msg?.type !== "workshop_result")
      return;
    const finish = waiting.get(msg.requestId);
    if (finish)
      finish(msg);
  });
  function rpc(payload) {
    const requestId = globalThis.crypto?.randomUUID?.() ?? Date.now() + "-" + ++sequence;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => finish({
        error: "Request timed out. Reopen the workshop to check its saved state."
      }), 300000);
      function finish(msg) {
        clearTimeout(timeout);
        waiting.delete(requestId);
        if (msg.error)
          reject(new Error(msg.error));
        else
          resolve(msg.data);
      }
      waiting.set(requestId, finish);
      try {
        ctx.sendToBackend({ type: "workshop", requestId, ...payload });
      } catch (error) {
        finish({ error: error.message });
      }
    });
  }
  async function run(action, args = {}) {
    if (busy)
      return;
    busy = true;
    status = action === "talk" ? "Writing…" : "Loading…";
    render();
    try {
      const data = await rpc({
        action: action === "refresh" ? "open" : action,
        id: session?.id,
        rev: session?.rev,
        ...args
      });
      if (data.overview !== undefined)
        overview = data.overview;
      if (data.catalog)
        library = data.catalog;
      if (data.sessions)
        sessions = data.sessions;
      if (data.session) {
        session = data.session;
        if (action !== "refresh") {
          preset = session.presetId || "";
          connection = session.connectionId || "";
        }
      }
      if (["open", "start", "talk"].includes(action))
        draft = "";
      selected = new Set;
      status = "";
    } catch (error) {
      status = error.message;
      if (session && action === "review") {
        try {
          const data = await rpc({ action: "open", id: session.id });
          session = data.session;
          overview = data.overview;
        } catch {}
      }
    } finally {
      busy = false;
      if (alive)
        render();
    }
  }
  function element(parent, tag, text = "") {
    const el = document.createElement(tag);
    el.textContent = text;
    parent.appendChild(el);
    return el;
  }
  function button(parent, label, fn) {
    const b = element(parent, "button", label);
    b.type = "button";
    b.disabled = busy;
    b.onclick = fn;
    return b;
  }
  function select(parent, label, options, current, onChange) {
    const input = element(element(parent, "label", label), "select");
    for (const { id, name } of options)
      element(input, "option", name).value = id;
    input.value = current;
    input.disabled = busy;
    input.onchange = () => onChange(input.value);
  }
  const option = (id, name) => ({ id, name });
  function selectors(parent) {
    select(parent, "Writing preset", [option("", "No preset"), ...library.presets], preset, (v) => preset = v);
    select(parent, "LLM connection", [option("", "Active Lumiverse connection"), ...library.connections], connection, (v) => connection = v);
  }
  function home() {
    element(root, "h3", "Workshops");
    for (const item of sessions)
      button(root, item.title, () => run("open", { id: item.id }));
    element(root, "h3", "Start a workshop");
    select(root, "Card", [option("", "New card"), ...library.cards], setupCard, (v) => {
      setupCard = v;
      render();
    });
    if (!setupCard) {
      const input = element(element(root, "label", "Card name"), "input");
      input.value = setupTitle;
      input.oninput = () => setupTitle = input.value;
    }
    select(root, "Workshop type", [
      option("character", "Character"),
      option("scenario", "Ensemble scenario")
    ], setupKind, (v) => setupKind = v);
    selectors(root);
    button(root, "Start workshop", () => run("start", {
      title: setupTitle,
      kind: setupKind,
      cardId: setupCard,
      presetId: preset,
      connectionId: connection
    }));
  }
  function editor() {
    const controls = element(root, "div");
    controls.className = "vv-controls";
    button(controls, "← Workshops", () => {
      session = null;
      draft = "";
      preset = "";
      connection = "";
      selected.clear();
      run("home");
    });
    element(controls, "h3", session.title);
    const settings = disclosure(controls, "settings", "Workshop settings");
    selectors(settings);
    button(settings, "Save settings", () => run("settings", { presetId: preset, connectionId: connection }));
    proposals(controls);
    cardAndLore(controls);
    const log = element(root, "div");
    log.className = "vv-log";
    for (const message of session.messages) {
      const row = element(log, "article");
      element(row, "strong", message.role === "user" ? "You" : "Author");
      element(row, "p", message.content);
    }
    log.scrollTop = log.scrollHeight;
    const composer = element(root, "div");
    composer.className = "vv-composer";
    const input = element(element(composer, "label", "Workshop message"), "textarea");
    input.rows = 3;
    input.value = draft;
    input.disabled = busy;
    input.oninput = () => draft = input.value;
    button(composer, "Send", () => run("talk", { text: draft }));
  }
  function disclosure(parent, id, title) {
    const details = element(parent, "details");
    details.dataset.section = id;
    details.open = openSections.has(id);
    element(details, "summary", title);
    return details;
  }
  function displayValue(parent, value) {
    if (Array.isArray(value) && value.length) {
      const list = element(parent, "ol");
      for (const item of value)
        element(element(list, "li"), "p", item);
    } else {
      element(parent, "p", value?.length ? value : "(empty)");
    }
  }
  function preview(details, value) {
    if (!value)
      return;
    const text = element(details.querySelector("summary"), "span", value);
    text.className = "vv-preview";
  }
  function cardAndLore(parent) {
    const section = disclosure(parent, "overview", "Card & lore");
    button(section, "Refresh from Lumiverse", () => run("refresh"));
    if (!overview) {
      element(section, "p", "The linked card is unavailable.");
      return;
    }
    const { card, templates, books } = overview;
    const pending = new Set(session.pending.map((p) => p.id));
    for (const [target, label, fields] of [
      ["card", "Card fields", card],
      ["template", "Workshop prompts", templates]
    ]) {
      element(section, "strong", label);
      for (const [field, value] of Object.entries(fields)) {
        const id = target + "." + field;
        const snippet = (Array.isArray(value) ? value[0] : value)?.trim();
        const state = snippet ? session.cardId ? "Saved" : "Draft" : "Empty";
        const details = disclosure(section, "current:" + id, fieldLabels[field] + " · " + state + (pending.has(id) ? " · Pending edit" : ""));
        preview(details, snippet?.split(`
`)[0]);
        displayValue(details, value);
      }
    }
    element(section, "strong", "Lorebooks");
    const drafts = session.pending.filter((p) => p.target === "new_lore");
    if (!books.length)
      element(section, "p", "No linked lorebooks. Ask the workshop to draft an entry to start one.");
    for (const book of books) {
      const group = disclosure(section, "book:" + book.id, book.name + " (" + book.entries.length + ")");
      if (!book.entries.length)
        element(group, "p", "No saved entries.");
      for (const entry of book.entries) {
        const hasEdit = session.pending.some((p) => p.target === "lore" && p.entryId === entry.id);
        const details = disclosure(group, "entry:" + entry.id, (entry.comment || "Untitled entry") + (hasEdit ? " · Pending edit" : ""));
        preview(details, entry.content?.trim().split(`
`)[0]);
        element(details, "strong", "Activation keywords");
        displayValue(details, entry.key);
        element(details, "strong", "Entry text");
        displayValue(details, entry.content);
      }
    }
    for (const draft of drafts) {
      const details = disclosure(section, "lore-draft:" + draft.id, draft.label + " · Pending");
      preview(details, draft.value.content.trim().split(`
`)[0]);
      element(details, "strong", "Activation keywords");
      displayValue(details, draft.value.key);
      element(details, "strong", "Entry text");
      displayValue(details, draft.value.content);
      element(details, "p", "Apply this entry from Proposed changes.");
    }
  }
  function proposals(parent) {
    const review = disclosure(parent, "proposals", "Proposed changes (" + session.pending.length + ")");
    if (!session.pending.length) {
      element(review, "p", "No pending changes. Ask the workshop to draft or revise a field.");
      return;
    }
    if (!session.cardId)
      element(review, "p", "Applying your first selection creates this card in the library.");
    for (const p of session.pending) {
      const row = element(review, "div");
      row.className = "vv-proposal";
      const box = element(row, "input");
      box.type = "checkbox";
      box.setAttribute("aria-label", "Select " + p.label);
      box.checked = selected.has(p.id);
      box.disabled = busy;
      box.onchange = () => box.checked ? selected.add(p.id) : selected.delete(p.id);
      const details = disclosure(row, "proposal:" + p.id, p.label);
      if (p.before !== null) {
        element(details, "strong", "Current value");
        displayValue(details, p.before);
      }
      element(details, "strong", "Proposed value");
      displayValue(details, p.target === "new_lore" ? p.value.key.join(", ") + `
` + p.value.content : p.value);
    }
    const actions = element(review, "div");
    actions.className = "vv-actions";
    for (const [decision, label] of [
      ["apply", "Apply selected"],
      ["discard", "Discard selected"]
    ])
      button(actions, label, () => run("review", { decision, ids: [...selected] }));
  }
  function render() {
    const scope = session?.id ?? "";
    const sameSession = root.dataset.session === scope;
    const controlsScroll = sameSession ? root.querySelector(".vv-controls")?.scrollTop ?? 0 : 0;
    if (sameSession) {
      openSections = new Set(Array.from(root.querySelectorAll("details[data-section][open]"), (details) => details.dataset.section));
    } else {
      openSections.clear();
    }
    root.dataset.session = scope;
    root.classList.toggle("vv-editor", Boolean(session));
    root.replaceChildren();
    if (library) {
      if (session)
        editor();
      else
        home();
    }
    if (status) {
      const p = element(root, "p", status);
      p.className = "vv-status";
      p.setAttribute("role", "status");
    }
    if (!library && !busy)
      button(root, "Reload workshop", () => run("home"));
    const controls = root.querySelector(".vv-controls");
    if (controls)
      controls.scrollTop = controlsScroll;
    fitEditor();
  }
  run("home");
  return () => {
    alive = false;
    unsubscribe();
    resize.disconnect();
    viewport?.removeEventListener("resize", fitEditor);
    viewport?.removeEventListener("scroll", fitEditor);
    window.removeEventListener("resize", fitEditor);
    root.removeEventListener("focusin", fitEditor);
    window.cancelAnimationFrame(viewportFrame);
    for (const finish of waiting.values())
      finish({ error: "Workshop closed" });
    removeStyle();
    tab.destroy();
  };
}
export {
  setup
};
