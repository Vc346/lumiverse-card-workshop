import MarkdownIt from "markdown-it";

const markdown = new MarkdownIt({ html: false, breaks: true });
markdown.validateLink = (url) => /^(https?:\/\/|mailto:)/i.test(url);
// Show image descriptions without making requests to model-supplied URLs.
markdown.renderer.rules.image = (tokens, index) =>
  markdown.utils.escapeHtml(tokens[index].content);

const fieldLabels = {
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
  ledger_prompt: "Ledger prompt",
};

const loreFieldLabels = { content: "Entry text", comment: "Entry title", key: "Activation keywords" };

function proposalLabel(proposal) {
  if (proposal.target === "card" || proposal.target === "template")
    return fieldLabels[proposal.field] ?? proposal.label;
  if (proposal.target === "lore" && loreFieldLabels[proposal.field]) {
    const suffix = " · " + proposal.field;
    if (proposal.label.endsWith(suffix))
      return proposal.label.slice(0, -suffix.length) + " · " + loreFieldLabels[proposal.field];
  }
  return proposal.label;
}

const tabs = [
  { id: "chat", label: "Chat", icon: "M3 4h18v12H8l-5 4V4z" },
  { id: "review", label: "Review", icon: "M6 3h12v18H6z M9 12l2 2 4-5" },
  { id: "card", label: "Card & lore", icon: "M3 5h7l2 2h9v12H3z M7 12h10 M7 15h7" },
  { id: "settings", label: "Workshop settings", icon: "M4 6h16 M4 12h16 M4 18h16 M8 4v4 M16 10v4 M10 16v4" },
];

export function setup(ctx) {
  const tab = ctx.ui.registerDrawerTab({
    id: "card-workshop",
    title: "Card Workshop",
  });
  const root = document.createElement("section");
  root.className = "vv-author";
  tab.root.appendChild(root);
  const removeStyle = ctx.dom.addStyle(`
    .vv-author {
      box-sizing: border-box;
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      width: 100%;
      min-width: 0;
      max-width: 100%;
      gap: 12px;
      padding: 12px;
      color: var(--lumiverse-text);
      font: inherit;
      overflow-wrap: anywhere;
    }
    .vv-author :where(.vv-panel, .vv-log, .vv-composer, .vv-picker, article, details, summary) {
      min-width: 0;
      max-width: 100%;
      box-sizing: border-box;
    }
    .vv-author :where(.vv-field, .vv-picker, .vv-panel:not([data-view="chat"]), .vv-log, details[open]) {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 8px;
    }
    .vv-author :where(.vv-button, .vv-input) {
      box-sizing: border-box;
      min-width: 0;
      max-width: 100%;
      min-height: 40px;
      padding: 8px 12px;
      border: 1px solid var(--lumiverse-border);
      border-radius: var(--lumiverse-radius, 8px);
      background: var(--lumiverse-fill-subtle);
      color: inherit;
      font: inherit;
    }
    .vv-author .vv-button { cursor: pointer; font-weight: 600 }
    .vv-author .vv-button:disabled { opacity: .55; cursor: default }
    .vv-author .vv-primary {
      background: var(--lumiverse-accent, #8c70c7);
      color: var(--lumiverse-accent-fg, #fff);
      border-color: transparent;
    }
    .vv-author :where(.vv-button, .vv-input, summary):focus-visible {
      outline: 2px solid var(--lumiverse-accent, #8c70c7);
      outline-offset: -2px;
    }
    .vv-author select option { color: CanvasText; background: Canvas }
    .vv-author :where(p, pre) { margin: 0; white-space: pre-wrap; font: inherit }
    .vv-author h3 { margin: 0 }
    .vv-author.vv-editor {
      height: var(--vv-height, 65vh);
      display: flex;
      flex-direction: column;
      overflow: hidden auto;
    }
    .vv-author .vv-heading {
      flex: none;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 6px;
      min-width: 0;
      padding-bottom: 6px;
      border-bottom: 1px solid var(--lumiverse-border);
    }
    .vv-author .vv-heading h3 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
    .vv-author .vv-tabs { display: flex; gap: 2px }
    .vv-author .vv-icon-button {
      display: grid;
      place-items: center;
      position: relative;
      box-sizing: border-box;
      width: clamp(32px, 10vw, 42px);
      height: 44px;
      min-height: 44px;
      padding: 0;
      background: transparent;
      border-color: transparent;
      color: var(--lumiverse-text-muted);
    }
    .vv-author .vv-icon-button[aria-selected="true"] {
      background: var(--lumiverse-fill-subtle);
      border-bottom: 2px solid var(--lumiverse-accent, #8c70c7);
      color: var(--lumiverse-accent, #8c70c7);
    }
    .vv-author .vv-count {
      position: absolute;
      top: 1px;
      right: 0;
      min-width: 14px;
      padding: 1px 3px;
      border-radius: 10px;
      background: var(--lumiverse-accent, #8c70c7);
      color: var(--lumiverse-accent-fg, #fff);
      font-size: 10px;
      line-height: 12px;
    }
    .vv-author .vv-panel {
      flex: 1 1 auto;
      min-height: 0;
      overflow: hidden auto;
      align-content: start;
    }
    .vv-author .vv-panel[data-view="chat"] {
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow: hidden;
    }
    .vv-author .vv-log {
      flex: 1 1 auto;
      min-height: 0;
      overflow: hidden auto;
      align-content: start;
      gap: 16px;
      padding: 2px 2px 10px;
    }
    .vv-author details {
      padding: 10px;
      border: 1px solid var(--lumiverse-border);
      border-radius: var(--lumiverse-radius, 8px);
      background: var(--lumiverse-fill-subtle);
    }
    .vv-author .vv-message {
      --vv-message-accent: var(--lumiverse-accent, #8c70c7);
      display: grid;
      grid-template-columns: 28px minmax(0, 1fr);
      align-items: start;
      gap: 8px;
    }
    .vv-author .vv-message[data-role="user"] {
      --vv-message-accent: var(--lumiverse-text);
      grid-template-columns: minmax(0, 1fr) 28px;
      padding-inline-start: min(8%, 40px);
    }
    .vv-author .vv-avatar {
      display: grid;
      place-items: center;
      aspect-ratio: 1;
      border-radius: 50%;
      background: var(--lumiverse-fill);
      background: color-mix(in srgb, var(--vv-message-accent) 17%, var(--lumiverse-fill));
      color: var(--vv-message-accent);
      font-size: .8em;
      font-weight: 700;
    }
    .vv-author .vv-message[data-role="user"] .vv-avatar {
      grid-column: 2;
      grid-row: 1;
    }
    .vv-author .vv-bubble {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      min-width: 0;
      gap: 6px;
      padding: 10px 12px;
      border: 1px solid var(--lumiverse-border);
      border-inline-start: 3px solid var(--vv-message-accent);
      border-radius: 4px 14px 14px;
      background: var(--lumiverse-fill);
      background: color-mix(in srgb, var(--vv-message-accent) 10%, var(--lumiverse-fill));
    }
    .vv-author .vv-message[data-role="user"] .vv-bubble {
      grid-column: 1;
      grid-row: 1;
      justify-self: end;
      max-width: 100%;
      box-sizing: border-box;
      border-inline-start: 1px solid var(--lumiverse-border);
      border-radius: 14px 4px 14px 14px;
      background: var(--lumiverse-fill-subtle);
    }
    .vv-author .vv-message strong { color: var(--vv-message-accent); font-size: .85em }
    .vv-author .vv-message p { line-height: 1.55 }
    .vv-author .vv-markdown { min-width: 0; overflow-x: auto; line-height: 1.55 }
    .vv-author .vv-markdown :is(p, li, pre) { white-space: normal }
    .vv-author .vv-markdown > :first-child { margin-top: 0 }
    .vv-author .vv-markdown > :last-child { margin-bottom: 0 }
    .vv-author .vv-markdown > * + * { margin-top: .65em }
    .vv-author .vv-markdown :is(ul, ol) { padding-inline-start: 1.35em }
    .vv-author .vv-markdown :is(h1, h2, h3, h4, h5, h6) {
      margin-bottom: .25em;
      font-size: 1.05em;
      font-weight: 700;
    }
    .vv-author .vv-markdown strong { color: inherit; font-size: inherit }
    .vv-author .vv-markdown a { color: var(--lumiverse-accent); text-decoration: underline }
    .vv-author .vv-markdown blockquote {
      margin-inline: 0;
      padding-inline-start: .75em;
      border-inline-start: 2px solid var(--lumiverse-accent);
    }
    .vv-author .vv-markdown pre {
      padding: .6em;
      white-space: pre-wrap;
      border-radius: 4px;
      background: var(--lumiverse-fill-subtle);
    }
    .vv-author .vv-markdown code { font-family: ui-monospace, monospace }
    .vv-author .vv-markdown table { border-collapse: collapse }
    .vv-author .vv-markdown :is(th, td) { padding: .3em .5em; border: 1px solid var(--lumiverse-border) }
    .vv-author .vv-log .vv-status { padding-inline-start: 36px; font-size: .875em }
    .vv-author details > summary { cursor: pointer; font-weight: 600 }
    .vv-author .vv-preview {
      display: block;
      min-width: 0;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--lumiverse-text-muted);
      font-size: .88em;
      font-weight: 400;
    }
    .vv-author details[open] > summary > .vv-preview { display: none }
    .vv-author .vv-value {
      min-width: 0;
      padding: 10px 12px;
      border: 1px solid var(--lumiverse-border);
      border-radius: 4px;
      background: var(--lumiverse-fill);
      background: color-mix(in srgb, var(--lumiverse-accent, #8c70c7) 10%, var(--lumiverse-fill-subtle, transparent));
      line-height: 1.55;
    }
    .vv-author .vv-value ol { margin: 0; padding-inline-start: 1.35em }
    .vv-author .vv-value li + li { margin-block-start: 8px }
    .vv-author .vv-composer {
      flex: none;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: end;
      gap: 8px;
      padding: 8px;
      border: 1px solid var(--lumiverse-border);
      border-radius: 18px;
      background: var(--lumiverse-fill-subtle);
    }
    .vv-author .vv-composer:focus-within { border-color: var(--lumiverse-accent) }
    .vv-author .vv-composer textarea {
      width: 100%;
      border-radius: 12px;
      font-size: max(16px, 1em);
      resize: none;
    }
    .vv-author .vv-composer button { border-radius: 12px; min-height: 44px }
    .vv-author .vv-proposal {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      align-items: start;
      gap: 8px;
    }
    .vv-author .vv-proposal input { margin: 12px 4px; accent-color: var(--lumiverse-accent) }
    .vv-author .vv-actions { display: flex; gap: 8px; flex-wrap: wrap }
    .vv-author .vv-status { color: var(--lumiverse-text-muted) }
  `);
  let library,
    sessions = [],
    session = null,
    overview = null,
    busy = false,
    status = "",
    alive = true;
  let draft = "",
    setupCard = "",
    setupTitle = "",
    setupKind = "character",
    preset = "",
    connection = "";
  const components = [];
  function destroyComponents() {
    for (const component of components.splice(0)) component.destroy();
  }
  let selected = new Set();
  let activeTab = "chat";
  const openSections = new Map();
  const scrollPositions = new Map();
  let viewportFrame = 0;
  const viewport = window.visualViewport;

  function fitEditor() {
    if (viewportFrame) return;
    viewportFrame = window.requestAnimationFrame(() => {
      viewportFrame = 0;
      if (!session || !root.getClientRects().length) return;
      const top = root.getBoundingClientRect().top;
      let bottom =
        (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight);
      for (let parent = root.parentElement; parent; parent = parent.parentElement) {
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
  const waiting = new Map();
  const unsubscribe = ctx.onBackendMessage((msg) => {
    if (msg?.type !== "workshop_result") return;
    const finish = waiting.get(msg.requestId);
    if (finish) finish(msg);
  });
  function rpc(payload) {
    const requestId = globalThis.crypto?.randomUUID?.() ?? Date.now() + "-" + ++sequence;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () =>
          finish({
            error:
              "Request timed out. Reopen the workshop to check its saved state.",
          }),
        300000,
      );
      function finish(msg) {
        clearTimeout(timeout);
        waiting.delete(requestId);
        if (msg.error) reject(new Error(msg.error));
        else resolve(msg.data);
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
    if (busy) return;
    busy = true;
    status = action === "talk" ? "Writing…" : "Loading…";
    render(action === "talk");
    try {
      const data = await rpc({
        action: action === "refresh" ? "open" : action,
        id: session?.id,
        rev: session?.rev,
        ...args,
      });
      if (data.overview !== undefined) overview = data.overview;
      if (data.catalog) library = data.catalog;
      if (data.sessions) sessions = data.sessions;
      if (data.session) {
        session = data.session;
        if (action !== "refresh") {
          preset = session.presetId || "";
          connection = session.connectionId || "";
        }
      }
      if (["open", "start", "talk"].includes(action)) draft = "";
      selected = new Set();
      status = "";
    } catch (error) {
      status = error.message;
      // A host write may already have succeeded when a later proposal failed.
      if (session && action === "review") {
        try {
          const data = await rpc({ action: "open", id: session.id });
          session = data.session;
          overview = data.overview;
        } catch {}
      }
    } finally {
      busy = false;
      if (alive) render(action === "talk");
    }
  }
  function element(parent, tag, text = "") {
    const el = document.createElement(tag);
    el.textContent = text;
    parent.appendChild(el);
    return el;
  }
  function button(parent, label, fn, primary = false) {
    const b = element(parent, "button", label);
    b.className = primary ? "vv-button vv-primary" : "vv-button";
    b.type = "button";
    b.disabled = busy;
    b.onclick = fn;
    return b;
  }
  function select(parent, label, options, current, onChange) {
    if (ctx.components?.mountSelect) {
      const picker = element(parent, "div");
      picker.className = "vv-picker";
      element(picker, "span", label);
      const fallback = options.find(({ id }) => id === "");
      components.push(ctx.components.mountSelect(element(picker, "div"), {
        ariaLabel: label,
        value: current,
        options: options.filter(({ id }) => id !== "").map(({ id, name }) => ({
          value: id,
          label: name,
        })),
        placeholder: fallback?.name ?? label,
        clearable: Boolean(fallback),
        clearLabel: fallback?.name,
        disabled: busy,
        onChange,
      }));
      return;
    }
    const field = element(parent, "label", label);
    field.className = "vv-field";
    const input = element(field, "select");
    input.className = "vv-input";
    for (const { id, name } of options)
      element(input, "option", name).value = id;
    input.value = current;
    input.disabled = busy;
    input.onchange = () => onChange(input.value);
  }
  const option = (id, name) => ({ id, name });
  function selectors(parent) {
    select(
      parent,
      "Writing preset",
      [option("", "No preset"), ...library.presets],
      preset,
      (v) => (preset = v),
    );
    select(
      parent,
      "LLM connection",
      [option("", "Active Lumiverse connection"), ...library.connections],
      connection,
      (v) => (connection = v),
    );
  }
  function home() {
    element(root, "h3", "Workshops");
    for (const item of sessions)
      button(root, item.title, () => run("open", { id: item.id }));
    element(root, "h3", "Start a workshop");
    select(
      root,
      "Card",
      [option("", "New card"), ...library.cards],
      setupCard,
      (v) => {
        setupCard = v;
        queueMicrotask(render);
      },
    );
    if (!setupCard) {
      const label = element(root, "label", "Card name");
      label.className = "vv-field";
      const input = element(label, "input");
      input.className = "vv-input";
      input.value = setupTitle;
      input.oninput = () => (setupTitle = input.value);
    }
    select(
      root,
      "Workshop type",
      [
        option("character", "Character"),
        option("scenario", "Scenario"),
      ],
      setupKind,
      (v) => (setupKind = v),
    );
    selectors(root);
    button(root, "Start workshop", () =>
      run("start", {
        title: setupTitle,
        kind: setupKind,
        cardId: setupCard,
        presetId: preset,
        connectionId: connection,
      }),
      true,
    );
  }
  function iconButton(parent, label, path, onClick) {
    const control = button(parent, "", onClick);
    control.classList.add("vv-icon-button");
    control.setAttribute("aria-label", label);
    control.title = label;
    const ns = "http://www.w3.org/2000/svg";
    const icon = document.createElementNS(ns, "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("width", "19");
    icon.setAttribute("height", "19");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-width", "1.7");
    icon.setAttribute("stroke-linecap", "round");
    icon.setAttribute("stroke-linejoin", "round");
    const shape = document.createElementNS(ns, "path");
    shape.setAttribute("d", path);
    icon.appendChild(shape);
    control.appendChild(icon);
    return control;
  }
  function activateTab(id) {
    if (activeTab === id) return;
    activeTab = id;
    render();
    root.querySelector('[role="tab"][aria-selected="true"]')?.focus();
  }
  function editor() {
    const heading = element(root, "div");
    heading.className = "vv-heading";
    iconButton(heading, "Back to workshops", "M19 12H5 M11 6l-6 6 6 6", () => {
      session = null;
      draft = "";
      preset = "";
      connection = "";
      selected.clear();
      run("home");
    });
    const title = element(heading, "h3", session.title);
    title.title = session.title;
    const tablist = element(heading, "div");
    tablist.className = "vv-tabs";
    tablist.setAttribute("role", "tablist");
    tablist.setAttribute("aria-label", "Workshop views");
    const prefix = "vv-workshop-" + session.id;
    const panelId = prefix + "-panel";
    tabs.forEach(({ id, label, icon }, index) => {
      const tab = iconButton(tablist, label, icon, () => activateTab(id));
      tab.disabled = false;
      tab.id = prefix + "-" + id;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(activeTab === id));
      tab.setAttribute("aria-controls", panelId);
      tab.tabIndex = activeTab === id ? 0 : -1;
      if (id === "review" && session.pending.length) {
        const count = session.pending.length;
        tab.setAttribute("aria-label", "Review (" + count + " pending)");
        const badge = element(tab, "span", count > 99 ? "99+" : String(count));
        badge.className = "vv-count";
        badge.setAttribute("aria-hidden", "true");
      }
      tab.onkeydown = (event) => {
        const next = {
          ArrowLeft: (index + tabs.length - 1) % tabs.length,
          ArrowRight: (index + 1) % tabs.length,
          Home: 0,
          End: tabs.length - 1,
        }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        activateTab(tabs[next].id);
      };
    });
    const panel = element(root, "section");
    panel.className = "vv-panel";
    panel.id = panelId;
    panel.dataset.view = activeTab;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", prefix + "-" + activeTab);
    panel.tabIndex = 0;
    if (activeTab === "chat") chat(panel);
    else if (activeTab === "review") proposals(panel);
    else if (activeTab === "card") cardAndLore(panel);
    else {
      element(panel, "h3", "Workshop settings");
      selectors(panel);
      button(panel, "Save settings", () =>
        run("settings", { presetId: preset, connectionId: connection }),
      );
    }
  }
  function chat(panel) {
    const log = element(panel, "div");
    log.className = "vv-log";
    log.setAttribute("aria-label", "Workshop conversation");
    for (const message of session.messages) {
      const row = element(log, "article");
      row.className = "vv-message";
      row.dataset.role = message.role;
      const isUser = message.role === "user";
      const avatar = element(row, "span", isUser ? "Y" : "M");
      avatar.className = "vv-avatar";
      avatar.setAttribute("aria-hidden", "true");
      const bubble = element(row, "div");
      bubble.className = "vv-bubble";
      element(bubble, "strong", isUser ? "You" : "Murasaki");
      if (isUser) {
        element(bubble, "p", message.content);
      } else {
        const rendered = ctx.dom.inject(bubble, markdown.render(message.content));
        rendered.classList.add("vv-markdown");
      }
    }
    if (status === "Writing…") showStatus(log);
    const composer = element(panel, "div");
    composer.className = "vv-composer";
    const input = element(composer, "textarea");
    input.className = "vv-input";
    input.setAttribute("aria-label", "Workshop message");
    input.placeholder = "Message Murasaki…";
    input.rows = 2;
    input.value = draft;
    input.disabled = busy;
    input.oninput = () => (draft = input.value);
    button(composer, "Send", () => run("talk", { text: draft }), true);
  }
  function disclosure(parent, id, title) {
    const details = element(parent, "details");
    details.dataset.section = id;
    details.open = openSections.get(activeTab)?.has(id) ?? false;
    element(details, "summary", title);
    return details;
  }
  function displayValue(parent, value) {
    const panel = element(parent, "div");
    panel.className = "vv-value";
    if (Array.isArray(value) && value.length) {
      const list = element(panel, "ol");
      for (const item of value) element(element(list, "li"), "p", item);
    } else {
      element(panel, "p", value?.length ? value : "(empty)");
    }
  }
  function preview(details, value) {
    if (!value) return;
    const characters = Array.from(value.slice(0, 200));
    const snippet = characters.length > 96 ? characters.slice(0, 96).join("") + "…" : value;
    const text = element(details.querySelector("summary"), "span", snippet);
    text.className = "vv-preview";
  }
  function cardAndLore(parent) {
    const section = parent;
    element(section, "h3", "Card & lore");
    button(section, "Refresh from Lumiverse", () => run("refresh"));
    if (!overview) {
      element(section, "p", "The linked card is unavailable.");
      return;
    }
    const { card, templates, books } = overview;
    const pending = new Set(session.pending.map((p) => p.id));
    for (const [target, label, fields] of [
      ["card", "Card fields", card],
      ["template", "Workshop prompts", templates],
    ]) {
      element(section, "strong", label);
      for (const [field, value] of Object.entries(fields)) {
        const id = target + "." + field;
        const snippet = (Array.isArray(value) ? value[0] : value)?.trim();
        const state = snippet ? (session.cardId ? "Saved" : "Draft") : "Empty";
        const details = disclosure(
          section,
          "current:" + id,
          fieldLabels[field] + " · " + state + (pending.has(id) ? " · Pending edit" : ""),
        );
        preview(details, snippet?.split("\n")[0]);
        displayValue(details, value);
      }
    }
    element(section, "strong", "Lorebooks");
    const drafts = session.pending.filter((p) => p.target === "new_lore");
    if (!books.length)
      element(section, "p", "No linked lorebooks. Ask the workshop to draft an entry to start one.");
    for (const book of books) {
      const group = disclosure(section, "book:" + book.id, book.name + " (" + book.entries.length + ")");
      if (!book.entries.length) element(group, "p", "No saved entries.");
      for (const entry of book.entries) {
        const hasEdit = session.pending.some((p) => p.target === "lore" && p.entryId === entry.id);
        const details = disclosure(group, "entry:" + entry.id,
          (entry.comment || "Untitled entry") + (hasEdit ? " · Pending edit" : ""));
        preview(details, entry.content?.trim().split("\n")[0]);
        element(details, "strong", "Activation keywords");
        displayValue(details, entry.key);
        element(details, "strong", "Entry text");
        displayValue(details, entry.content);
      }
    }
    for (const draft of drafts) {
      const details = disclosure(section, "lore-draft:" + draft.id, draft.label + " · Pending");
      preview(details, draft.value.content.trim().split("\n")[0]);
      element(details, "strong", "Activation keywords");
      displayValue(details, draft.value.key);
      element(details, "strong", "Entry text");
      displayValue(details, draft.value.content);
      element(details, "p", "Apply this entry from the Review tab.");
    }
  }
  function proposals(parent) {
    const review = parent;
    element(review, "h3", "Proposed changes");
    if (!session.pending.length) {
      element(review, "p", "No pending changes. Ask the workshop to draft or revise a field.");
      return;
    }
    if (!session.cardId)
      element(
        review,
        "p",
        "Applying your first selection creates this card in the library.",
      );
    for (const p of session.pending) {
      const label = proposalLabel(p);
      const row = element(review, "div");
      row.className = "vv-proposal";
      const box = element(row, "input");
      box.type = "checkbox";
      box.setAttribute("aria-label", "Select " + label);
      box.checked = selected.has(p.id);
      box.disabled = busy;
      box.onchange = () =>
        box.checked ? selected.add(p.id) : selected.delete(p.id);
      const details = disclosure(row, "proposal:" + p.id, label);
      if (p.before !== null) {
        element(details, "strong", "Current value");
        displayValue(details, p.before);
      }
      element(details, "strong", "Proposed value");
      displayValue(
        details,
        p.target === "new_lore" ? p.value.key.join(", ") + "\n" + p.value.content : p.value,
      );
    }
    const actions = element(review, "div");
    actions.className = "vv-actions";
    for (const [decision, label] of [
      ["apply", "Apply selected"],
      ["discard", "Discard selected"],
    ])
      button(actions, label, () => run("review", { decision, ids: [...selected] }), decision === "apply");
  }
  function clearMarkdown() {
    for (const message of root.querySelectorAll(".vv-markdown")) ctx.dom.uninject(message);
  }
  function showStatus(parent) {
    const line = element(parent, "p", status);
    line.className = "vv-status";
    line.setAttribute("role", "status");
  }
  function render(followChat = false) {
    const scope = session?.id ?? "";
    const previous = root.querySelector(".vv-panel");
    if (root.dataset.session !== scope) {
      activeTab = "chat";
      openSections.clear();
      scrollPositions.clear();
    } else if (previous) {
      const view = previous.dataset.view;
      openSections.set(view, new Set(
        Array.from(previous.querySelectorAll("details[data-section][open]"),
          (details) => details.dataset.section),
      ));
      scrollPositions.set(view, (previous.querySelector(".vv-log") ?? previous).scrollTop);
    }
    if (followChat) scrollPositions.delete("chat");
    root.dataset.session = scope;
    root.classList.toggle("vv-editor", Boolean(session));
    destroyComponents();
    clearMarkdown();
    root.replaceChildren();
    if (library) {
      if (session) editor();
      else home();
    }
    if (status && (status !== "Writing…" || activeTab !== "chat")) showStatus(root);
    if (!library && !busy) button(root, "Reload workshop", () => run("home"));
    const panel = root.querySelector(".vv-panel");
    const scroll = panel?.querySelector(".vv-log") ?? panel;
    if (scroll) {
      scroll.scrollTop = scrollPositions.get(activeTab) ??
        (activeTab === "chat" ? scroll.scrollHeight : 0);
    }
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
    for (const finish of waiting.values()) finish({ error: "Workshop closed" });
    destroyComponents();
    clearMarkdown();
    removeStyle();
    tab.destroy();
  };
}
