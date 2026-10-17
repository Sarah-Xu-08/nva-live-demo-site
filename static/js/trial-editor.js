/* Data-only authoring: every preview and transform uses the production server engine. */
(() => {
  "use strict";
  const ids = ["check-playback", "check-subtasks", "check-hint", "library", "trial", "next-trial", "version", "speed", "scope", "status", "dirty", "undo", "redo", "revert", "export", "play", "prev", "next", "initial", "state-phase", "playhead", "playhead-label", "timeline", "critical", "critical-time", "correction", "correction-time", "mark-critical", "mark-correction", "show-critical", "show-correction", "reset-critical", "reset-correction", "speed-table", "hint", "hint-preview", "human", "ai", "note", "row-scope", "apply-action", "insert", "delete", "trim-start", "trim-end", "trim-summary", "set-start", "set-end", "trim", "validate", "save", "reload", "validation", "review", "review-versions", "review-data", "review-confirm", "accept-checks", "json", "action-table", "state-json", "draft-caption", "original-caption", "review-status-toggle", "review-status-panel", "review-status-refresh", "review-status-close", "review-status-filter", "review-status-summary", "review-status-rows"];
  const el = Object.fromEntries(ids.map(id => [id, document.getElementById(`editor-${id}`)]));
  const reopenDialog = document.getElementById("editor-reopen-dialog");
  const root = document.getElementById("trial-editor");
  const clone = data => JSON.parse(JSON.stringify(data));
  const speeds = [750];
  const reviewSections = ["playback", "subtasks", "hint"];
  const state = { catalog: null, draft: null, original: null, originalCache: {}, undo: [], redo: [], drafts: new Map(), tick: 0, phase: "after", busy: false, playing: false, validation: null, games: [], gameKey: null, generation: 0 };
  let pendingSubtask = false;
  const subtasks = window.TrialSubtasks.create({
    onChange: preferences => mutate({ kind: "preferences", preferences }),
    onBlock: operation => mutate({ kind: "subtask_block", ...operation }),
    onSuggest: () => mutate({ kind: "suggest_subtasks" }),
    onJump: tick => { pause(); showTick(tick); }, getTick: () => state.tick,
    onError: message => status(message, true),
    onPending: value => { pendingSubtask = value; controls(); }
  });
  const sec = ms => `${(ms / 1000).toFixed(2)} s`;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const dirty = () => state.draft && !same(state.draft, state.original);
  const version = () => el.version.value;
  const speed = () => Number(el.speed.value);
  const selected = () => state.preview?.rows[state.tick];
  function status(message, error = false) { el.status.textContent = TrialEditorTiles.text(message); el.status.classList.toggle("error", error); }
  function node(tag, text, className) { const n = document.createElement(tag); if (text != null) n.textContent = TrialEditorTiles.text(text); if (className) n.className = className; return n; }
  async function api(path, data) {
    const url = `/api/trial-editor/${path}`;
    const response = await fetch(url, data === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!(response.headers.get("Content-Type") || "").includes("application/json")) {
      const help = response.status >= 500
        ? "The local app returned a server error. Check its terminal output and try again."
        : "Trial Editor requires the local app server. Start it with python live_demo/app.py and open the URL printed in its terminal.";
      throw new Error(`${help} (${url}: HTTP ${response.status}, expected JSON.)`);
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
    return result;
  }
  function pause() { state.playing = false; clearTimeout(state.timer); el.play.textContent = "Play draft"; }
  function controls() {
    const loaded = Boolean(state.draft && state.preview);
    for (const id of ["check-playback", "check-subtasks", "check-hint", "trial", "version", "speed", "scope", "library", "revert", "export", "play", "prev", "next", "initial", "show-critical", "show-correction", "reset-critical", "reset-correction", "state-phase", "playhead", "critical", "mark-critical", "human", "ai", "note", "apply-action", "insert", "delete", "trim-start", "trim-end", "set-start", "set-end", "trim", "hint", "validate"]) el[id].disabled = state.busy || !loaded;
    const nextTrial = el.trial.options[el.trial.selectedIndex + 1];
    el["next-trial"].disabled = state.busy || !loaded || pendingSubtask || !nextTrial;
    el["next-trial"].title = nextTrial ? `Next: ${nextTrial.textContent}` : "Last trial in this library";
    el.undo.disabled = state.busy || !state.undo.length;
    el.redo.disabled = state.busy || !state.redo.length;
    el["show-correction"].disabled = el["reset-correction"].disabled = el.correction.disabled = el["mark-correction"].disabled = state.busy || !loaded || version() === "nonPE";
    for (const id of ["apply-action", "insert", "delete", "mark-critical", "mark-correction", "set-start", "set-end"]) if (!selected()) el[id].disabled = true;
    el.save.disabled = state.busy || !dirty() || !state.validation?.valid;
    el.reload.disabled = state.busy;
    el["review-status-toggle"].disabled = state.busy || !state.catalog;
    el["review-status-refresh"].disabled = state.busy;
    el["review-status-rows"].querySelectorAll("button").forEach(button => { button.disabled = state.busy || pendingSubtask; });
    el["accept-checks"].disabled = state.busy || !state.validation || !el["review-confirm"].checked;
    el.dirty.textContent = dirty() ? "Unsaved draft" : "Saved revision";
    el.dirty.classList.toggle("dirty", dirty());
    root.setAttribute("aria-busy", String(state.busy));
    el.timeline.querySelectorAll("button").forEach(button => { button.disabled = state.busy; });
    el["action-table"].style.pointerEvents = state.busy ? "none" : "";
    // Pending preference fields protect saving and selection, not playback editing.
    // The Subtasks panel retains them when a physical edit refreshes the replay.
    if (pendingSubtask) for (const id of ["check-subtasks", "check-hint", "trial", "version", "speed", "library", "revert", "export", "undo", "redo", "validate", "save", "accept-checks"]) el[id].disabled = true;
    subtasks.setBusy(state.busy || !loaded);
  }
  async function work(fn) {
    if (state.busy) return;
    pause(); state.busy = true; controls();
    try { await fn(); } catch (error) { if (state.preview) { renderTiming(); renderReviewChecks(); } status(error.message, true); }
    finally { state.busy = false; controls(); }
  }
  function invalidate() { state.validation = null; el.validation.replaceChildren(); el["review-data"].replaceChildren(); el["review-versions"].replaceChildren(); el["review-confirm"].checked = false; controls(); }
  function remember() {
    state.undo.push(clone(state.draft)); if (state.undo.length > 60) state.undo.shift(); state.redo = []; invalidate();
  }
  function stash() {
    if (state.draft) state.drafts.set(state.draft.alias, { draft: clone(state.draft), original: clone(state.original), sha: state.baseSha, undo: clone(state.undo), redo: clone(state.redo), version: version(), tick: state.tick });
  }
  function options(select, values) { select.replaceChildren(...values.map(([value, label]) => { const o = node("option", label); o.value = value; return o; })); }
  function populateLibraries() {
    const current = el.library.value;
    const categories = new Map(state.catalog.designs.filter(d => d.category).map(d => [d.category.id, d.category.label]));
    options(el.library, [["recording", "60-trial collaboration roster"], ["all", "All saved designs"],
      ...Array.from(categories, ([id, label]) => [`category:${id}`, label])]);
    el.library.value = [...el.library.options].some(o => o.value === current) ? current : "all";
  }
  function pairChecked(design) {
    return design.versions.includes("nonPE") && design.versions.length > 1 &&
      design.versions.every(v => design.review_checks?.[v]?.playback && design.review_checks?.[v]?.subtasks);
  }
  function filteredDesigns(preserveOrder = false) {
    const filter = el.library.value;
    const designs = (state.catalog?.designs || []).filter(d => filter === "all" ||
      (filter === "recording" ? d.recording_references.some(ref => ref.profile === "collaboration_50") :
        filter === `category:${d.category?.id}`)).sort((a, b) => Number(pairChecked(b)) - Number(pairChecked(a)));
    if (preserveOrder) {
      // Saving a Briefing may clear the other checks. Update badges without moving
      // the current design past trials the author has not visited yet.
      const positions = new Map([...el.trial.options].map((option, index) => [option.value, index]));
      designs.sort((a, b) => (positions.get(a.alias) ?? positions.size) - (positions.get(b.alias) ?? positions.size));
    }
    return designs;
  }
  function populateTrials(preferred, preserveOrder = false) {
    const designs = filteredDesigns(preserveOrder);
    options(el.trial, designs.map(d => [d.alias, `${pairChecked(d) ? "✓ Both checked · " : ""}${d.alias} · ${d.title}${Object.values(d.review_checks || {}).some(r => r.playback || r.subtasks) ? ` · checks ${Object.values(d.review_checks).reduce((n, r) => n + Number(r.playback) + Number(r.subtasks), 0)}/${d.versions.length * 2}` : ""}`]));
    if (designs.some(d => d.alias === preferred)) el.trial.value = preferred;
    renderReviewStatus();
  }
  function renderReviewStatus() {
    const designs = filteredDesigns(true), rows = [];
    let total = 0, playback = 0, subtasksChecked = 0, hintChecked = 0;
    for (const design of designs) {
      let trialCellAdded = false;
      const shown = [];
      for (const v of design.versions) {
        const checks = design.review_checks?.[v] || {};
        total++; playback += Number(Boolean(checks.playback)); subtasksChecked += Number(Boolean(checks.subtasks)); hintChecked += Number(Boolean(checks.hint));
        const complete = checks.playback && checks.subtasks;
        if ((el["review-status-filter"].value === "complete" && !complete) || (el["review-status-filter"].value === "incomplete" && complete)) continue;
        shown.push([v, checks]);
      }
      for (const [v, checks] of shown) {
        const row = node("tr"); row.dataset.alias = design.alias; row.dataset.version = v;
        row.classList.toggle("current", design.alias === state.draft?.alias && v === version());
        const openButton = (label, targetVersion, className) => {
          const button = node("button", label, className); button.type = "button";
          button.disabled = state.busy || pendingSubtask;
          button.addEventListener("click", async () => {
            await work(async () => {
              if (pendingSubtask) return;
              el.trial.value = design.alias;
              await loadTrial(design.alias, targetVersion);
              setReviewStatusOpen(false);
            });
            el["review-status-toggle"].focus();
          });
          return button;
        };
        if (!trialCellAdded) {
          const cell = node("td"); cell.rowSpan = shown.length; cell.className = "editor-review-trial";
          cell.append(openButton(design.title, undefined, "editor-review-trial-button"), node("span", design.alias, "editor-small"));
          row.append(cell); trialCellAdded = true;
        }
        const cell = node("td"); cell.append(openButton(v, v)); row.append(cell);
        for (const section of reviewSections) {
          const cell = node("td"), checked = Boolean(checks[section]);
          cell.append(node("span", checked ? "✓ Checked" : "○ Not checked", `editor-review-badge ${checked ? "checked" : "unchecked"}`));
          row.append(cell);
        }
        rows.push(row);
      }
    }
    if (!rows.length) { const row = node("tr"), cell = node("td", "No versions match this filter."); cell.colSpan = 5; row.append(cell); rows.push(row); }
    el["review-status-summary"].textContent = `${designs.length} trials · ${total} versions · Playback ${playback}/${total} checked · Subtasks ${subtasksChecked}/${total} checked · Briefing ${hintChecked}/${total} checked`;
    el["review-status-rows"].replaceChildren(...rows);
  }
  function setReviewStatusOpen(open) {
    el["review-status-panel"].hidden = !open;
    el["review-status-toggle"].setAttribute("aria-expanded", String(open));
    if (!open) return;
    renderReviewStatus();
    el["review-status-panel"].scrollIntoView({block: "nearest"});
  }
  async function refreshReviewStatus(preserveOrder = false) {
    state.catalog = await api("catalog");
    populateLibraries(); populateTrials(state.draft?.alias, preserveOrder);
  }
  async function loadTrial(alias, preferredVersion, reopen = false) {
    stash();
    const cached = !reopen && state.drafts.get(alias);
    const source = cached || await api(`trials/${encodeURIComponent(alias)}`);
    state.draft = clone(cached ? cached.draft : source.definition);
    state.original = clone(cached ? cached.original : source.definition);
    if (!cached && source.normalized_review) {
      // Preserve saved completion checks when editing Briefing text in older files.
      state.draft.editor_review = clone(source.normalized_review);
      state.original.editor_review = clone(source.normalized_review);
    }
    state.baseSha = cached ? cached.sha : source.source_sha256;
    state.undo = cached ? cached.undo : []; state.redo = cached ? cached.redo : [];
    state.originalCache = {}; state.tick = cached ? cached.tick : -1; state.phase = "after"; el["state-phase"].value = "after";
    options(el.version, Object.keys(state.draft.variants).map(v => [v, v]));
    if (state.draft.variants[preferredVersion || cached?.version]) el.version.value = preferredVersion || cached.version;
    el.hint.value = state.draft.human_expectation;
    invalidate(); await refresh();
    status(`Opened ${alias}, revision ${state.original.revision}. Human is gray; AI partner is blue. Drafts stay available when switching designs.`);
  }
  function makeGames() {
    const grid = state.draft.layout.grid;
    const compare = document.getElementById("editor-compare").checked;
    document.getElementById("editor-compare-label").textContent = version() === "nonPE" ? "Compare saved revision" : "Compare nonPE version";
    document.getElementById("editor-reference-title").textContent = version() === "nonPE" ? "Saved revision" : "nonPE version · current draft";
    document.getElementById("editor-original-panel").hidden = !compare;
    document.getElementById("editor-boards").classList.toggle("comparing", compare);
    const width = document.getElementById("editor-draft-board").parentElement.clientWidth || 600;
    const key = JSON.stringify([grid, speed(), compare, Math.round(width / 20)]);
    if (state.gameKey === key) return;
    state.games.forEach(g => g.close()); state.games = []; state.gameKey = key;
    const Game = window.Overcooked.OvercookedGame.OvercookedGame;
    const tile = Math.min(compare ? 58 : 76, Math.floor(width / grid[0].length), Math.floor(440 / grid.length));
    (compare ? ["draft", "original"] : ["draft"]).forEach(kind => {
      const container = document.getElementById(`editor-${kind}-board`); container.replaceChildren();
      const game = new Game({ start_grid: grid, container_id: container.id, tileSize: tile, gameWidth: tile * grid[0].length, gameHeight: tile * grid.length, ANIMATION_DURATION: Math.round(.75 * speed()), assets_loc: "static/assets/warm/", chef_atlas: "chefs-onion-preview", COOK_TIME: 2, explosion_time: Number.MAX_SAFE_INTEGER, DELIVERY_REWARD: 20, player_colors: { 0: "gray", 1: "blue" } });
      game.state = physical(kind === "draft" || version() !== "nonPE" ? state.draft.initial_state : state.original.initial_state); game.init(); state.games.push(game);
    });
  }
  function physical(raw) {
    const value = clone(raw);
    value.players.forEach(p => { if (p.held_object === null) delete p.held_object; });
    return window.Overcooked.OvercookedMDP.OvercookedState.from_object(value);
  }
  async function refresh(preferredId, preservePending = true) {
    const generation = ++state.generation;
    const draft = clone(state.draft), v = version(), s = speed();
    const originalKey = `${v}:${s}`;
    const referencePromise = v === "nonPE"
      ? state.originalCache[originalKey] || api("preview", { definition: state.original, version: v, speed_ms: s })
      : api("preview", { definition: draft, version: "nonPE", speed_ms: s });
    const results = await Promise.all([Promise.all(speeds.map(interval => api("preview", { definition: draft, version: v, speed_ms: interval }))), referencePromise]);
    if (generation !== state.generation) return;
    state.speedPreviews = results[0]; state.preview = results[0].find(p => p.speed_ms === s);
    if (v === "nonPE") state.originalCache[originalKey] = results[1];
    state.referencePreview = results[1];
    if (preferredId) { const index = state.preview.rows.findIndex(r => r.id === preferredId); if (index >= 0) state.tick = index; }
    state.tick = Math.max(-1, Math.min(state.tick, state.preview.rows.length - 1));
    el["trim-start"].value = 0; el["trim-end"].value = state.preview.rows.length - 1;
    el["trim-start"].max = state.preview.rows.length - 1; el["trim-end"].max = state.preview.rows.length - 1;
    renderTrimBounds();
    subtasks.render(state.draft, state.preview, preservePending); renderTimeline(); subtasks.highlightRange(); renderTiming(); renderReviewChecks(); renderReviewStatus(); updateJSON(); makeGames(); showTick(state.tick);
  }
  function renderTimeline() {
    const rows = state.preview.rows;
    el.playhead.max = rows.length - 1;
    el.timeline.replaceChildren(...rows.map((r, i) => {
      const button = node("button", String(i), [r.shared || ["baseline", "follows"].includes(r.baseline_scope) ? "shared" : "", r.marker || ""].join(" ")); button.type = "button"; button.dataset.index = i;
      button.title = TrialEditorTiles.text(`${i}: Human ${r.human}, AI ${r.ai}${r.note ? " — " + r.note : ""}`);
      button.addEventListener("click", () => { pause(); showTick(i); });
      if (r.marker) { const badge = node("span", r.marker === "critical" ? "crit" : "corr", "editor-marker"); badge.draggable = true; badge.addEventListener("dragstart", e => e.dataTransfer.setData("text/plain", r.marker)); button.append(badge); }
      button.addEventListener("dragover", e => e.preventDefault());
      button.addEventListener("drop", e => { e.preventDefault(); const marker = e.dataTransfer.getData("text/plain"); if (["critical", "correction"].includes(marker)) mutate({ kind: "marker", marker, phase: state.phase, row_id: r.id }); });
      return button;
    }));
    el["action-table"].replaceChildren(...rows.map((r, i) => {
      const tr = node("tr"); tr.dataset.index = i; tr.tabIndex = 0;
      const scope = {baseline: "nonPE baseline", follows: "Follows nonPE", override: "PE override", version: "Version"}[r.baseline_scope] || (r.shared ? "Preparation" : "Version");
      [i, sec(i * speed()), r.human, r.ai, r.marker ? `${r.marker} · ${scope}` : scope, subtasks.describe(state.preview.subtask_timing.states[i]), r.note || ""].forEach(value => tr.append(node("td", value)));
      tr.addEventListener("click", () => { pause(); showTick(i); });
      tr.addEventListener("keydown", e => { if (e.key === "Enter" && !state.busy) { pause(); showTick(i); } });
      return tr;
    }));
  }
  function renderReviewChecks() {
    const checks = state.preview?.review_checks || {};
    for (const section of reviewSections) el[`check-${section}`].checked = Boolean(checks[section]);
  }
  function renderTiming() {
    const p = state.preview;
    el.critical.max = el.correction.max = p.rows.length - 1;
    el.critical.value = p.critical_tick; el.correction.value = p.correction_tick ?? p.critical_tick;
    el["critical-time"].textContent = `Action ${p.critical_tick} · ${sec(p.critical_tick * speed())} onset · ${p.event_state_phases.critical || "after"} state`;
    el["correction-time"].textContent = p.correction_tick == null ? "No correction in nonPE" : `Action ${p.correction_tick} · ${sec(p.correction_tick * speed())} · delay ${sec((p.correction_tick - p.critical_tick) * speed())} · ${p.event_state_phases.correction || "after"} state`;
    const table = node("table"), head = node("tr"); ["Step", "Critical onset", "Correction onset", "Length"].forEach(t => head.append(node("th", t))); table.append(head);
    state.speedPreviews.forEach(r => { const tr = node("tr"); [ `${r.speed_ms} ms`, sec(r.critical_tick * r.speed_ms), r.correction_tick == null ? "—" : sec(r.correction_tick * r.speed_ms), sec(r.duration_ms) ].forEach(t => tr.append(node("td", t))); table.append(tr); });
    el["speed-table"].replaceChildren(table);
  }
  function updateJSON() { el.json.textContent = JSON.stringify(state.draft, null, 2); el["hint-preview"].textContent = TrialEditorTiles.text(state.draft.human_expectation); }
  function renderTrimBounds() { el["trim-summary"].textContent = `Retain actions ${el["trim-start"].value}–${el["trim-end"].value} (inclusive)`; }
  function showTick(index, animate = false) {
    if (!state.preview) return;
    state.tick = Math.max(-1, Math.min(index, state.preview.rows.length - 1));
    const r = selected(), phase = state.phase;
    const raw = state.tick < 0 ? state.draft.initial_state : state.preview.frames[state.tick][phase];
    const reference = state.referencePreview, nonpe = version() !== "nonPE";
    let referenceIndex = r ? reference.rows.findIndex(row => row.id === r.id) : -1;
    if (r && nonpe && referenceIndex < 0) {
      const prefix = version().replaceAll("+", "-") + "-";
      const counterpart = r.id.startsWith(prefix) ? "nonPE-" + r.id.slice(prefix.length) : null;
      referenceIndex = reference.rows.findIndex(row => row.id === counterpart);
    }
    const matched = referenceIndex >= 0;
    const completed = r && !matched && state.tick >= reference.rows.length;
    if (r && !matched) referenceIndex = Math.min(state.tick, reference.rows.length - 1);
    const referencePhase = completed ? "after" : phase;
    const referenceRaw = referenceIndex < 0 ? (nonpe ? state.draft : state.original).initial_state : reference.frames[referenceIndex][referencePhase];
    state.games.forEach((g, i) => { const value = physical(i ? referenceRaw : raw); if (animate) g.drawState(value); else g.drawSnapshot(value); });
    const time = state.tick < 0 ? 0 : (state.tick + (phase === "after" ? 1 : 0)) * speed();
    el["playhead-label"].textContent = r ? `Action ${state.tick} · ${phase} · state at ${sec(time)}` : "Initial state · 0.00 s";
    el.playhead.value = Math.max(0, state.tick);
    el["draft-caption"].textContent = r ? `${phase} action ${state.tick}: Human ${r.human} · AI ${r.ai}${r.marker ? " · " + r.marker : ""}` : "Complete initial state";
    const referenceName = nonpe ? "nonPE" : "saved";
    const referenceRow = reference.rows[referenceIndex];
    el["original-caption"].textContent = referenceIndex < 0 ? `${referenceName} initial state`
      : `${referencePhase} ${referenceName} action ${referenceIndex}: Human ${referenceRow.human} · AI ${referenceRow.ai} · ${matched ? "corresponding action" : completed ? "completed; final state" : "same elapsed step"}`;
    root.querySelectorAll("[data-index]").forEach(n => { const current = Number(n.dataset.index) === state.tick; n.classList.toggle("selected", current); if (n.tagName === "BUTTON") n.setAttribute("aria-pressed", String(current)); });
    if (r) { el.human.value = r.human; el.ai.value = r.ai; el.note.value = r.note || ""; }
    const scopeText = {
      baseline: "nonPE baseline preparation: changes carry to PE rows still following it. PE overrides are preserved.",
      follows: "Follows nonPE preparation. Editing actions creates an override for this PE version only.",
      override: "PE override: action changes stay in this version; nonPE changes preserve this row.",
      version: `Action ${state.tick}: edits affect ${version()} at every playback speed.`
    };
    el["row-scope"].textContent = r ? (scopeText[r.baseline_scope] || scopeText.version) +
      (r.baseline_scope === "override" && state.tick < state.preview.critical_tick ? " This override precedes critical onset; review the event timing." : "") : "Select an action to edit.";
    el["state-json"].textContent = JSON.stringify(raw, null, 2); controls();
    subtasks.showState(state.tick, phase);
    for (const id of ["apply-action", "insert", "delete", "mark-critical", "mark-correction", "set-start", "set-end"]) if (!r) el[id].disabled = true;
    el.prev.disabled ||= state.tick < 0; el.next.disabled ||= state.tick >= state.preview.rows.length - 1;
  }
  async function commit(result, rowId, message, preservePending = true) { remember(); state.draft = result; el.hint.value = state.draft.human_expectation; await refresh(rowId, preservePending); status(message || "Draft updated. Validate all versions and speeds before saving."); }
  function op(operation) { return { version: version(), speed_ms: speed(), scope: el.scope.value, row_id: selected()?.id, ...operation }; }
  function mutate(operation) { return work(async () => {
    const result = await api("transform", { definition: state.draft, operation: op(operation) });
    if (operation.kind === "suggest_subtasks") {
      // An already running server may still have the earlier drafting defaults.
      // Its observed nonPE interaction target supplies the current editor defaults.
      for (const task of result.definition.subtask_preferences.tasks) {
        const tile = task.action_preference.tile;
        task.goal = { mode: "selected", tiles: [tile] };
        task.action_preference = { mode: "target", tile, coordination: "avoid_blocking" };
      }
    }
    await commit(result.definition, operation.row_id || selected()?.id, undefined, !["subtask_block", "preferences", "suggest_subtasks"].includes(operation.kind));
  }); }
  function play() {
    if (state.busy || !state.preview) return;
    if (state.playing) { pause(); return; }
    state.phase = "after"; el["state-phase"].value = "after";
    if (state.tick >= state.preview.rows.length - 1) showTick(-1);
    state.playing = true; el.play.textContent = "Pause draft";
    const next = () => {
      if (!state.playing) return;
      if (state.tick >= state.preview.rows.length - 1) { pause(); return; }
      showTick(state.tick + 1, true); state.timer = setTimeout(next, speed());
    };
    next();
  }
  function renderValidation(report) {
    state.validation = report; el["review-confirm"].checked = false;
    el.validation.replaceChildren(node("p", report.valid ? `Passed ${report.replays} production replays. Checkpoints, collisions and recording roster are valid.` : `${report.issues.length} validation issue(s). Inspect the draft and the states below.`, report.valid ? "editor-validation-ok" : "editor-validation-issues"));
    if (report.issues.length) { const list = node("ul", null, "editor-validation-issues"); report.issues.forEach(issue => list.append(node("li", `${issue.version || "Roster"}${issue.speed_ms ? " · " + issue.speed_ms + " ms" : ""}: ${issue.message}`))); el.validation.append(list); }
    const choices = node("div", null, "editor-review-choices");
    Object.keys(state.draft.variants).forEach(v => { const label = node("label", null, "editor-inline"), input = node("input"); input.type = "checkbox"; input.value = v; input.checked = report.issues.some(i => i.version === v) || v === version(); input.addEventListener("change", () => { el["review-confirm"].checked = false; controls(); }); label.append(input, document.createTextNode(v)); choices.append(label); });
    el["review-versions"].replaceChildren(choices);
    el["review-data"].replaceChildren(...report.review.filter(r => r.speed_ms === 750).map(r => { const details = node("details", null, "editor-review-item"); details.append(node("summary", `${r.version} · ${r.speed_ms} ms · collisions: ${r.collisions.length ? r.collisions.join(", ") : "none"} · critical ${r.critical_tick}${r.correction_tick == null ? "" : " · correction " + r.correction_tick}`), node("pre", JSON.stringify(r.checkpoints, null, 2))); return details; }));
    controls();
  }
  async function validate() { status("Replaying every version at all four speeds and checking the recording roster…"); const report = await api("validate", { definition: state.draft }); renderValidation(report); status(report.valid ? "Validation passed. The draft can be saved." : "Validation found differences. Review the physical results before accepting updated checkpoints.", !report.valid); }
  async function reload() {
    const result = await api("reload", {});
    state.catalog = await api("catalog");
    populateLibraries();
    const alias = state.draft?.alias;
    const design = state.catalog.designs.find(d => d.alias === alias);
    if (design?.category && el.library.value.startsWith("category:")) el.library.value = `category:${design.category.id}`;
    populateTrials(alias);
    if (el.trial.value && el.trial.value !== alias) await loadTrial(el.trial.value);
    window.dispatchEvent(new CustomEvent("trial-library-reloaded", { detail: { alias: state.draft?.alias, version: version() } }));
    status(`Library reloaded (${result.designs} designs). New sessions use saved revisions; existing previews keep their frozen definition.`);
  }
  let opening;
  function open(detail) {
    if (opening) return opening;
    opening = (async () => {
      if (state.draft && state.preview) { makeGames(); showTick(state.tick); }
      else {
        let failure;
        await work(async () => {
          try {
            state.catalog = await api("catalog"); populateLibraries();
            const preferred = detail?.alias;
            const design = state.catalog.designs.find(d => d.alias === preferred);
            if (design && !design.recording_references.some(ref => ref.profile === "collaboration_50")) el.library.value = design.category ? `category:${design.category.id}` : "all";
            populateTrials(preferred); await loadTrial(el.trial.value, detail?.version);
          } catch (error) { failure = error; throw error; }
        });
        if (failure) throw failure;
      }
      await window.DemoLoading?.waitForRenderer(state.games, () => document.body.dataset.experimentMode !== "editor");
    })().finally(() => { opening = null; });
    return opening;
  }
  ["STAY", "NORTH", "SOUTH", "EAST", "WEST", "INTERACT"].forEach(action => { options(el.human, [...el.human.options].map(o => [o.value, o.textContent]).concat([[action, action]])); options(el.ai, [...el.ai.options].map(o => [o.value, o.textContent]).concat([[action, action]])); });
  el.trial.addEventListener("change", () => work(() => loadTrial(el.trial.value)));
  el["next-trial"].addEventListener("click", () => work(async () => {
    if (pendingSubtask) return;
    const next = el.trial.options[el.trial.selectedIndex + 1];
    if (!next) return;
    el.trial.value = next.value;
    await loadTrial(next.value);
  }));
  el["review-status-toggle"].addEventListener("click", () => work(async () => {
    const open = el["review-status-panel"].hidden;
    if (open) await refreshReviewStatus(true);
    setReviewStatusOpen(open);
  }));
  el["review-status-refresh"].addEventListener("click", () => work(refreshReviewStatus));
  el["review-status-close"].addEventListener("click", () => { setReviewStatusOpen(false); el["review-status-toggle"].focus(); });
  el["review-status-filter"].addEventListener("change", renderReviewStatus);
  el.library.addEventListener("change", () => work(async () => { const alias = state.draft?.alias; populateTrials(alias); await loadTrial(el.trial.value); }));
  [el.version, el.speed].forEach(select => select.addEventListener("change", () => work(async () => { invalidate(); await refresh(); })));
  el.scope.addEventListener("change", () => showTick(state.tick));
  el.play.addEventListener("click", play);
  el.prev.addEventListener("click", () => { pause(); showTick(state.tick - 1); }); el.next.addEventListener("click", () => { pause(); showTick(state.tick + 1); }); el.initial.addEventListener("click", () => { pause(); showTick(-1); });
  el.playhead.addEventListener("input", () => { pause(); showTick(Number(el.playhead.value)); });
  el["state-phase"].addEventListener("change", () => { pause(); state.phase = el["state-phase"].value; showTick(state.tick); });
  ["critical", "correction"].forEach(marker => { el[marker].addEventListener("change", () => { const row = state.preview.rows[Number(el[marker].value)]; mutate({ kind: "marker", marker, phase: state.phase, row_id: row.id }); }); el[`mark-${marker}`].addEventListener("click", () => mutate({ kind: "marker", marker, phase: state.phase })); });
  function showEvent(marker) {
    pause();
    const tick = state.preview[`${marker}_tick`];
    if (tick == null) return;
    state.phase = state.preview.event_state_phases[marker] || "after";
    el["state-phase"].value = state.phase; showTick(tick);
    status(`Showing ${state.phase} action ${tick}, the marked ${marker} state. Onset: ${sec(tick * speed())}.`);
  }
  ["critical", "correction"].forEach(marker => {
    el[`show-${marker}`].addEventListener("click", () => showEvent(marker));
    el[`reset-${marker}`].addEventListener("click", () => work(async () => {
      const result = await api("transform", { definition: state.draft, operation: op({kind:"reset_marker", marker, base_sha256:state.baseSha}) });
      await commit(result.definition); showEvent(marker);
      status(`Restored the saved ${marker} marker and event state. Other draft edits are retained; validate before saving.`);
    }));
  });
  ["playback", "subtasks"].forEach(section => el[`check-${section}`].addEventListener("change", () => mutate({kind:"review_check", section, checked:el[`check-${section}`].checked})));
  el["check-hint"].addEventListener("change", () => work(async () => {
    if (pendingSubtask) throw new Error("Apply or reset the Subtask form before saving Briefing checks.");
    const result = await api("transform", { definition: state.draft, operation: op({kind:"review_check", section:"hint", checked:el["check-hint"].checked}) });
    await commit(result.definition, selected()?.id);
    const previousSha = state.baseSha;
    try {
      await validate();
      if (!state.validation.valid) {
        status("Briefing checks synced across nonPE and PE in the draft, but not saved. Resolve the validation issues, then save the trial.", true);
        return;
      }
      await saveDraft();
      status(`Saved revision ${state.draft.revision}. Briefing checks are synced across nonPE and PE.`);
    } catch (error) {
      if (state.baseSha !== previousSha) throw new Error(`Saved revision ${state.draft.revision}, but the preview could not refresh: ${error.message}`);
      throw new Error(`Briefing checks synced in the draft, but not saved: ${error.message}`);
    }
  }));
  el.hint.addEventListener("focus", () => { state.hintUndoStarted = false; });
  el.hint.addEventListener("input", () => { if (!state.hintUndoStarted) { remember(); state.hintUndoStarted = true; } state.draft.human_expectation = el.hint.value; Object.values(state.draft.editor_review?.versions || {}).forEach(record => { record.hint = {checked:false}; }); if (state.preview) state.preview.review_checks = {...state.preview.review_checks,hint:false}; renderReviewChecks(); if (state.draft.subtask_preferences?.review_status === "reviewed") state.draft.subtask_preferences.review_status = "needs_review"; invalidate(); updateJSON(); subtasks.hintChanged(el.hint.value); status("Briefing updated for every version. Only Briefing checked was cleared; Playback and Subtasks checks are preserved."); });
  el["apply-action"].addEventListener("click", () => mutate({ kind: "action", human: el.human.value, ai: el.ai.value, note: el.note.value }));
  el.insert.addEventListener("click", () => mutate({ kind: "insert" })); el.delete.addEventListener("click", () => mutate({ kind: "delete" }));
  el["set-start"].addEventListener("click", () => { el["trim-start"].value = state.tick; renderTrimBounds(); }); el["set-end"].addEventListener("click", () => { el["trim-end"].value = state.tick; renderTrimBounds(); });
  ["trim-start", "trim-end"].forEach(id => el[id].addEventListener("input", renderTrimBounds));
  el.trim.addEventListener("click", () => work(async () => {
    const first = Number(el["trim-start"].value), last = Number(el["trim-end"].value), rows = state.preview.rows;
    if (!Number.isInteger(first) || !Number.isInteger(last) || first < 0 || first > last || last >= rows.length) throw new Error("Choose valid first and last action numbers.");
    if (first > 0 && version() !== "nonPE") throw new Error("Trim the beginning from nonPE; the starting state is shared by every version. You can trim this PE version’s end here.");
    let result = state.draft;
    if (first > 0) result = (await api("transform", { definition: result, operation: op({ kind: "trim_start", row_id: rows[first].id }) })).definition;
    if (last < rows.length - 1) result = (await api("transform", { definition: result, operation: op({ kind: "trim_end", row_id: rows[last].id }) })).definition;
    if (result === state.draft) { status("Trim bounds already match the whole trial."); return; }
    await commit(result, selected()?.id, `Draft shortened. The retained initial state includes inventories, counters and pots. Validate before saving.`);
  }));
  ["undo", "redo"].forEach(direction => el[direction].addEventListener("click", () => work(async () => { const from = state[direction], to = state[direction === "undo" ? "redo" : "undo"]; if (!from.length) return; to.push(clone(state.draft)); state.draft = from.pop(); el.hint.value = state.draft.human_expectation; invalidate(); await refresh(); status(`Draft ${direction} complete.`); })));
  el.revert.addEventListener("click", () => {
    if (state.busy || pendingSubtask || !state.draft || reopenDialog.open) return;
    pause();
    document.getElementById("editor-reopen-trial").textContent = `${state.draft.title} · ${state.draft.alias}`;
    reopenDialog.returnValue = "cancel";
    document.body.classList.add("editor-reopen-open");
    reopenDialog.showModal();
  });
  reopenDialog.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;
    const cancel = document.getElementById("editor-reopen-cancel");
    const confirm = document.getElementById("editor-reopen-confirm");
    if (event.shiftKey && document.activeElement === cancel) {
      event.preventDefault();
      confirm.focus();
    } else if (!event.shiftKey && document.activeElement === confirm) {
      event.preventDefault();
      cancel.focus();
    }
  });
  reopenDialog.addEventListener("close", () => {
    document.body.classList.remove("editor-reopen-open");
    if (reopenDialog.returnValue !== "reopen") return;
    work(async () => { const alias = state.draft.alias; state.drafts.delete(alias); await loadTrial(alias, version(), true); state.drafts.delete(alias); });
  });
  el.export.addEventListener("click", () => { const a = node("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(state.draft, null, 2) + "\n"], { type: "application/json" })); a.download = `${state.draft.alias}-draft.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); });
  el.validate.addEventListener("click", () => work(validate));
  el["review-confirm"].addEventListener("change", controls);
  el["accept-checks"].addEventListener("click", () => work(async () => { const versions = [...el["review-versions"].querySelectorAll("input:checked")].map(input => input.value); if (!versions.length) throw new Error("Choose at least one reviewed version."); const result = await api("transform", { definition: state.draft, operation: op({ kind: "accept_checks", versions, reviewed_sha256: state.validation.draft_sha256 }) }); await commit(result.definition, selected()?.id); await validate(); }));
  async function saveDraft() {
    status("Validating and writing the canonical JSON revision…");
    const saved = await api(`trials/${encodeURIComponent(state.draft.alias)}/save`, { definition: state.draft, base_sha256: state.baseSha });
    state.draft = clone(saved.definition); state.original = clone(saved.definition); state.baseSha = saved.source_sha256; state.originalCache = {}; state.undo = []; state.redo = []; state.drafts.delete(state.draft.alias);
    const design = state.catalog.designs.find(d => d.alias === state.draft.alias);
    if (design) design.review_checks = Object.fromEntries(design.versions.map(v => [v, Object.fromEntries(reviewSections.map(section => [section,Boolean(state.draft.editor_review?.versions?.[v]?.[section]?.checked)]))]));
    populateTrials(state.draft.alias, true); invalidate(); await refresh();
    status(`Saved revision ${saved.definition.revision}. Previous revision kept in history. Reload the library before starting new sessions.`);
  }
  el.save.addEventListener("click", () => work(saveDraft));
  el.reload.addEventListener("click", () => work(reload));
  document.getElementById("editor-compare").addEventListener("change", () => { pause(); makeGames(); showTick(state.tick); });
  const tabs = ["playback", "subtasks"];
  function tab(name) {
    tabs.forEach(id => { const button = document.getElementById(`editor-tab-${id}`); button.setAttribute("aria-selected", String(id === name)); button.tabIndex = id === name ? 0 : -1; document.getElementById(`editor-panel-${id}`).hidden = id !== name; });
  }
  tabs.forEach(name => { const button = document.getElementById(`editor-tab-${name}`); button.addEventListener("click", () => tab(name)); button.addEventListener("keydown", e => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) { e.preventDefault(); const next = e.key === "Home" ? "playback" : e.key === "End" ? "subtasks" : tabs.find(id => id !== name); tab(next); document.getElementById(`editor-tab-${next}`).focus(); } }); });
  document.getElementById("editor-tool").addEventListener("change", e => { root.querySelectorAll("[data-editor-tool]").forEach(panel => { panel.hidden = panel.dataset.editorTool !== e.target.value; }); });
  root.querySelectorAll(".subtask-group").forEach(group => group.addEventListener("toggle", () => { if (group.open) root.querySelectorAll(".subtask-group").forEach(other => { if (other !== group) other.open = false; }); }));
  window.addEventListener("trial-editor-open", e => {
    window.TrialEditorReady = open(e.detail);
    // The workspace controller displays this error; also handle the promise
    // when an obsolete editor request completes after switching away.
    window.TrialEditorReady.catch(() => {});
  });
  window.addEventListener("trial-editor-close", () => { pause(); if (reopenDialog.open) { reopenDialog.returnValue = "cancel"; reopenDialog.close(); } });
  window.addEventListener("pagehide", pause);
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
})();
