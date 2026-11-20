// src/frontend.ts
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
    .vv-author .vv-log {max-height:46vh;overflow:auto;display:grid;gap:10px}
    .vv-author article,.vv-author details {border:1px solid var(--lumiverse-border);padding:10px;border-radius:8px}
    .vv-author .vv-actions {display:flex;gap:6px;flex-wrap:wrap}
    .vv-author .vv-status {color:var(--lumiverse-text-muted)}
  `);
  let library, sessions = [], session = null, busy = false, status = "", alive = true;
  let draft = "", setupCard = "", setupTitle = "", setupKind = "character", preset = "", connection = "";
  let selected = new Set;
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
        action,
        id: session?.id,
        rev: session?.rev,
        ...args
      });
      if (data.catalog)
        library = data.catalog;
      if (data.sessions)
        sessions = data.sessions;
      if (data.session) {
        session = data.session;
        preset = session.presetId || "";
        connection = session.connectionId || "";
      }
      if (["open", "start", "talk"].includes(action))
        draft = "";
      selected = new Set;
      status = "";
    } catch (error) {
      status = error.message;
      if (session && action === "review") {
        try {
          session = (await rpc({ action: "open", id: session.id })).session;
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
    button(root, "← Workshops", () => {
      session = null;
      draft = "";
      preset = "";
      connection = "";
      selected.clear();
      run("home");
    });
    element(root, "h3", session.title);
    const settings = element(root, "details");
    element(settings, "summary", "Workshop settings");
    selectors(settings);
    button(settings, "Save settings", () => run("settings", { presetId: preset, connectionId: connection }));
    const log = element(root, "div");
    log.className = "vv-log";
    for (const message of session.messages) {
      const row = element(log, "article");
      element(row, "strong", message.role === "user" ? "You" : "Author");
      element(row, "p", message.content);
    }
    log.scrollTop = log.scrollHeight;
    const input = element(element(root, "label", "Workshop message"), "textarea");
    input.rows = 3;
    input.value = draft;
    input.disabled = busy;
    input.oninput = () => draft = input.value;
    button(root, "Send", () => run("talk", { text: draft }));
    if (!session.pending.length)
      return;
    element(root, "h3", "Review proposed changes");
    if (!session.cardId)
      element(root, "p", "Applying your first selection creates this card in the library.");
    for (const p of session.pending) {
      const row = element(root, "article");
      const label = element(row, "label");
      const box = element(label, "input");
      box.type = "checkbox";
      box.checked = selected.has(p.id);
      box.disabled = busy;
      box.onchange = () => box.checked ? selected.add(p.id) : selected.delete(p.id);
      label.append(document.createTextNode(p.label));
      if (p.before !== null) {
        const details = element(row, "details");
        element(details, "summary", "Current value");
        element(details, "p", p.before || "(empty)");
      }
      element(row, "strong", "Proposed value");
      element(row, "p", p.target === "new_lore" ? p.value.key.join(", ") + `
` + p.value.content : p.value);
    }
    const actions = element(root, "div");
    actions.className = "vv-actions";
    for (const [decision, label] of [
      ["apply", "Apply selected"],
      ["discard", "Discard selected"]
    ])
      button(actions, label, () => run("review", { decision, ids: [...selected] }));
  }
  function render() {
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
  }
  run("home");
  return () => {
    alive = false;
    unsubscribe();
    for (const finish of waiting.values())
      finish({ error: "Workshop closed" });
    removeStyle();
    tab.destroy();
  };
}
export {
  setup
};
