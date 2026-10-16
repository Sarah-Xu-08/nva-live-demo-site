/* Author-entered preferences. Physical timing comes from production replay;
   this editor never imports or runs a PE classifier. */
(() => {
  "use strict";
  const clone = v => JSON.parse(JSON.stringify(v));
  const defaults = { acquire: "acquired", receive: "received", supply: "supplied", add: "added", plate: "plated", serve: "served" };
  const names = { acquire: "Acquire", receive: "Receive", supply: "Supply", add: "Add ingredient", plate: "Plate", serve: "Serve" };
  const items = { onion: "onion", tomato: "tomato", dish: "plate", soup: "soup" };
  const directions = { acquire: "AI collects an item from a source or available counter.", receive: "Human → AI: AI takes the item handed over on a handoff counter.", supply: "AI → Human: AI places the item on a handoff counter for the human.", add: "AI adds the ingredient to an accepted pot.", plate: "AI uses a plate to take ready soup from an accepted pot.", serve: "AI delivers carried soup to an accepted serving station." };
  const key = t => JSON.stringify(t);
  const title = t => `${names[t.type]} · ${items[t.item]}${t.recipe !== "any" && t.item === "soup" ? ` (${t.recipe})` : ""}`;
  const n = (tag, text) => { const e = document.createElement(tag); if (text != null) e.textContent = TrialEditorTiles.text(text); return e; };
  window.TrialSubtasks = { create(config) {
    const ids = ["select", "remove", "form", "type", "item", "direction", "recipe-field", "recipe", "goal-mode", "goals-field", "goals", "goal-help", "action-mode", "target-field", "target", "action-field", "action", "reference-field", "reference", "coordination", "activation", "ending", "review-notes", "hint-evidence", "context-evidence", "nonpe-evidence", "review", "apply", "reset", "suggest", "warnings", "hint", "form-status", "bands", "begin", "finish", "begin-current", "finish-current", "range-status", "version-scope", "speed-scope", "template"];
    const el = Object.fromEntries([...ids, 'summary'].map(id => [id, document.getElementById(`subtask-${id}`)]));
    let draft, preview, prefs, fixtures = [], selectedId, selectedStartRow, formTask, busy = true, pendingForm = false, blocks = [];
    const defaultTask = () => ({ id: "new-task", type: "acquire", item: "onion", recipe: "any", goal: { mode: "selected", tiles: [] }, action_preference: { mode: "target", coordination: "avoid_blocking" }, timing: { start: { kind: "initial" }, activation: "always", completion: "acquired", end: { kind: "trial_end" } }, evidence: { hint_sentences: [], context_rows: [], nonpe_rows: [] } });
    const blockTitle = b => `${b.start_tick}–${b.end_tick} · ${b.task_id ? title(prefs.tasks.find(t => t.id === b.task_id)) : "Undecided"}`;
    const selected = s => [...s.selectedOptions].map(o => o.value);
    const fill = (select, values, chosen) => {
      const want = Array.isArray(chosen) ? chosen : [chosen];
      const valuesWithMissing = values.slice();
      want.filter(v => v && !values.some(([id]) => id === v)).forEach(v => {
        const tile = /^\[\d+,\d+\]$/.test(v) ? JSON.parse(v) : null;
        valuesWithMissing.push([v, `Missing reference · ${tile ? TrialEditorTiles.location(tile) : v}`]);
      });
      select.replaceChildren(...valuesWithMissing.map(([value, label]) => { const o = n("option", label); o.value = value; o.selected = want.includes(value); return o; }));
    };
    const referenceValues = (context = false) => preview.reference_rows.map((r, i) => [r.id, `Action ${i} · AI ${r.ai}${r.note ? " · " + r.note : ""}`]).filter((_, i) => !context || preview.reference_rows[i].shared);
    const allowedItems = type => type === "add" ? ["onion", "tomato"] : ["plate", "serve"].includes(type) ? ["soup"] : type === "acquire" ? ["onion", "tomato", "dish"] : Object.keys(items);
    const eligible = task => fixtures.filter(f => task.type === "acquire" ? f.cell === ({ onion: "O", tomato: "T", dish: "D" })[task.item] || f.cell === "X" : ["receive", "supply"].includes(task.type) ? f.cell === "X" : ["add", "plate"].includes(task.type) ? f.cell === "P" : f.cell === "S");
    const standard = task => eligible(task).filter(f => task.type === "acquire" ? f.cell !== "X" || f.items.includes(task.item) : ["receive", "supply"].includes(task.type) ? f.shared : true).map(f => f.tile);
    function formChanged(event) {
      if (event?.target !== el.review && el.review.value === "reviewed") el.review.value = "needs_review";
      pendingForm = true; config.onPending(true); el["form-status"].textContent = "Form changes are not applied yet. Use Apply to selected block before validating or saving.";
    }
    function applied() { pendingForm = false; config.onPending(false); el["form-status"].textContent = ""; }
    function currentTask() { return prefs?.tasks.find(t => t.id === selectedId); }
    function targets(update = false) {
      const candidates = eligible(formTask), goalMode = el["goal-mode"].value;
      let tiles = goalMode === "any" ? (update ? standard(formTask) : formTask.goal.tiles) : (update ? selected(el.goals).map(JSON.parse).filter(t => candidates.some(f => key(f.tile) === key(t))) : formTask.goal.tiles);
      const listed = goalMode === "any" ? candidates.filter(f => tiles.some(t => key(t) === key(f.tile))) : candidates;
      fill(el.goals, listed.map(f => [key(f.tile), f.label]), tiles.map(key));
      el.goals.disabled = busy || goalMode === "any";
      const accepted = candidates.filter(f => tiles.some(t => key(t) === key(f.tile)));
      const oldTarget = el.target.value || (formTask.action_preference.tile && key(formTask.action_preference.tile));
      fill(el.target, accepted.map(f => [key(f.tile), f.label]), accepted.some(f => key(f.tile) === oldTarget) ? oldTarget : accepted[0] && key(accepted[0].tile));
    }
    function dependentFields(changedType = false) {
      const allowed = allowedItems(formTask.type);
      if (!allowed.includes(formTask.item)) formTask.item = allowed[0];
      fill(el.item, allowed.map(i => [i, preview.subtask_options.items[i]]), formTask.item);
      el["recipe-field"].hidden = formTask.item !== "soup";
      el.direction.textContent = directions[formTask.type];
      el["goal-help"].textContent = "Choose the intended target reached by this subtask in nonPE, then use the same preferred target.";
      const readiness = ["always", ...(["acquire", "receive"].includes(formTask.type) ? ["empty_hand"] : ["holds_item"]), ...(formTask.type === "receive" ? ["counter_item"] : []), ...(formTask.type === "plate" ? ["pot_ready"] : []), ...(formTask.type === "add" ? ["pot_accepts"] : [])];
      fill(el.activation, readiness.map(k => [k, preview.subtask_options.activations[k]]), changedType ? "always" : formTask.timing.activation);
      targets(changedType); displayModes();
    }
    function displayModes() {
      const mode = el["action-mode"].value;
      for (const [id, match] of [["target-field", "target"], ["action-field", "action"], ["reference-field", "reference"]]) el[id].hidden = mode !== match;
    }
    function renderForm() {
      const task = currentTask() || defaultTask(); el.form.hidden = false;
      formTask = clone(task); applied();
      const block = blocks[Number(el.select.value)] || blocks[0];
      const rangeOptions = preview.rows.map((r, i) => [r.id, `Step ${i} · AI ${r.ai}${r.marker ? " · " + r.marker : ""}`]);
      fill(el.begin, rangeOptions, block?.start_row || preview.rows[0]?.id);
      fill(el.finish, rangeOptions, block?.end_row || preview.rows[0]?.id);
      fill(el.template, [["", "Keep the current fields"], ...prefs.tasks.map(t => [t.id, title(t)])], "");
      highlightRange();
      fill(el.type, Object.entries(preview.subtask_options.types), task.type);
      el.recipe.value = task.recipe; el["goal-mode"].value = task.goal.mode;
      el["action-mode"].value = task.action_preference.mode;
      fill(el.action, ["NORTH", "SOUTH", "EAST", "WEST", "STAY", "INTERACT"].map(k => [k, k]), task.action_preference.action || "STAY");
      fill(el.reference, referenceValues(), task.action_preference.row_ids || []);
      fill(el.coordination, Object.entries(preview.subtask_options.coordination), task.action_preference.coordination || "unspecified");
      fill(el["hint-evidence"], preview.subtask_options.hint_sentences.map(s => [s, s]), task.evidence.hint_sentences);
      fill(el["context-evidence"], referenceValues(true), task.evidence.context_rows);
      fill(el["nonpe-evidence"], referenceValues(), task.evidence.nonpe_rows);
      el.review.value = preview.subtask_timing.review_status;
      el.ending.value = prefs.ending || "complete";
      el["review-notes"].replaceChildren(...(task.review_notes || []).map(note => n("p", note)));
      el.target.value = ""; dependentFields(); setBusy(busy);
    }
    function collect() {
      const task = clone(formTask); task.type = el.type.value; task.item = el.item.value; task.recipe = task.item === "soup" ? el.recipe.value : "any";
      task.goal = { mode: el["goal-mode"].value, tiles: selected(el.goals).map(JSON.parse) };
      const mode = el["action-mode"].value;
      task.action_preference = { mode, coordination: el.coordination.value };
      if (mode === "target") { if (!el.target.value) throw new Error("Select at least one accepted target before choosing a preferred target."); task.action_preference.tile = JSON.parse(el.target.value); }
      if (mode === "action") task.action_preference.action = el.action.value;
      if (mode === "reference") { task.action_preference.row_ids = selected(el.reference); if (!task.action_preference.row_ids.length) throw new Error("Select at least one nonPE reference action."); }
      task.timing = { start: {kind: "initial"}, activation: el.activation.value, completion: defaults[task.type], end: {kind: "trial_end"} };
      task.evidence = { hint_sentences: selected(el["hint-evidence"]), context_rows: selected(el["context-evidence"]), nonpe_rows: selected(el["nonpe-evidence"]) };
      delete task.prerequisite_id;
      return task;
    }
    function highlightRange() {
      const a = preview?.rows.findIndex(r => r.id === el.begin.value), b = preview?.rows.findIndex(r => r.id === el.finish.value);
      const valid = a >= 0 && b >= a;
      document.querySelectorAll("#editor-timeline button").forEach(button => button.classList.toggle("subtask-range-selected", valid && Number(button.dataset.index) >= a && Number(button.dataset.index) <= b));
      el["range-status"].textContent = valid ? `Steps ${a}–${b} · ${b-a+1} actions, inclusive` : "Begin step must precede or equal end step.";
      el.bands.querySelectorAll("button").forEach(button => button.classList.toggle("editing", button.dataset.blockIndex === el.select.value));
    }
    function chooseBlock(index) {
      const block = blocks[index]; if (!block) return;
      selectedId = block.task_id; selectedStartRow = block.start_row; el.select.value = String(index); renderForm();
    }
    function pendingFields() {
      return pendingForm ? { task: clone(formTask), values: Object.fromEntries(
        [...el.form.querySelectorAll("select")].map(field => [field.id.slice("subtask-".length), selected(field)])) } : null;
    }
    function restorePending(saved) {
      if (!saved) return;
      const values = saved.values;
      formTask = clone(saved.task);
      formTask.type = values.type[0]; formTask.item = values.item[0]; formTask.recipe = values.recipe[0];
      formTask.goal = { mode: values["goal-mode"][0], tiles: values.goals.map(JSON.parse) };
      if (values.target[0]) formTask.action_preference.tile = JSON.parse(values.target[0]);
      el["goal-mode"].value = formTask.goal.mode; el["action-mode"].value = values["action-mode"][0];
      dependentFields();
      for (const [id, chosen] of Object.entries(values)) {
        fill(el[id], [...el[id].options].map(option => [option.value, option.textContent]), chosen);
      }
      if (el.review.value === "reviewed") el.review.value = "needs_review";
      formChanged(); highlightRange(); setBusy(busy);
    }
    function render(nextDraft, nextPreview, preservePending = true) {
      const pending = preservePending && draft?.alias === nextDraft.alias && preview?.version === nextPreview.version ? pendingFields() : null;
      if (draft?.alias !== nextDraft.alias || preview?.version !== nextPreview.version) selectedStartRow = null;
      draft = nextDraft; preview = nextPreview; prefs = clone(draft.subtask_preferences || { schema_version: 1, review_status: "draft", tasks: [] });
      fixtures = TrialEditorTiles.fixtures(draft, preview.subtask_options.fixtures);
      blocks = preview.subtask_timing.editable_blocks;
      const wanted = preview.rows.findIndex(r => r.id === selectedStartRow);
      const index = Math.max(0, blocks.findIndex(b => wanted >= b.start_tick && wanted <= b.end_tick));
      fill(el.select, blocks.map((b, i) => [String(i), blockTitle(b)]), String(index));
      el.hint.textContent = TrialEditorTiles.text(draft.human_expectation);
      const undecided = blocks.filter(b => !b.task_id).length;
      el.summary.textContent = `${blocks.length} blocks · ${undecided} Undecided · ${preview.subtask_timing.explicit ? "Edited ranges" : "Suggested physical phases"}`;
      el.warnings.replaceChildren(...[...(preview.subtask_timing.notes || []), ...preview.subtask_timing.warnings].map(w => n("p", w)));
      if (preview.subtask_timing.review_status === "needs_review") el.warnings.prepend(n("p", "This version’s preferences need review against the Briefing and replay."));
      el.bands.replaceChildren(...blocks.map((block, i) => {
        const button = n("button", blockTitle(block)); button.type = "button"; button.dataset.blockIndex = String(i);
        button.dataset.taskId = block.task_id || ""; button.dataset.startTick = block.start_tick; button.dataset.endTick = block.end_tick;
        button.classList.toggle("undecided", !block.task_id);
        button.addEventListener("click", () => { chooseBlock(i); config.onJump(block.start_tick); }); return button;
      }));
      chooseBlock(index);
      restorePending(pending);
    }
    function setBusy(value) {
      busy = value;
      document.getElementById("editor-panel-subtasks").querySelectorAll("button, select").forEach(e => { e.disabled = busy || !draft; });
      el.remove.disabled ||= !blocks.length;
      if (formTask) el.goals.disabled ||= el["goal-mode"].value === "any";
      el.bands.querySelectorAll("button").forEach(b => { b.disabled = busy; });
      if (pendingForm) {
        for (const id of ["select", "remove", "suggest"]) el[id].disabled = true;
        el.bands.querySelectorAll("button").forEach(b => { b.disabled = true; });
      }
    }
    function showState(tick, phase) {
      el.bands.querySelectorAll("button").forEach(b => b.classList.toggle("active", (tick < 0 ? 0 : tick) >= Number(b.dataset.startTick) && (tick < 0 ? 0 : tick) <= Number(b.dataset.endTick)));
    }
    el.select.addEventListener("change", () => chooseBlock(Number(el.select.value)));
    el.template.addEventListener("change", () => {
      if (!el.template.value) return;
      const begin = el.begin.value, finish = el.finish.value;
      selectedId = el.template.value; renderForm(); el.begin.value = begin; el.finish.value = finish; formChanged(); highlightRange();
    });
    for (const field of ["begin", "finish"]) {
      el[field].addEventListener("change", highlightRange);
      el[`${field}-current`].addEventListener("click", () => {
        const row = preview.rows[config.getTick()];
        if (!row) { config.onError("Select a step first."); return; }
        el[field].value = row.id; formChanged(); highlightRange();
      });
    }
    el.form.addEventListener("change", formChanged);
    el.type.addEventListener("change", () => { formTask.type = el.type.value; dependentFields(true); });
    el.item.addEventListener("change", () => { formTask.item = el.item.value; dependentFields(true); });
    el["goal-mode"].addEventListener("change", () => targets(true));
    el.goals.addEventListener("change", () => targets(true));
    el["action-mode"].addEventListener("change", displayModes);
    async function applyBlock(task) {
      const a = preview.rows.findIndex(r => r.id === el.begin.value), b = preview.rows.findIndex(r => r.id === el.finish.value);
      if (a < 0 || b < a) throw new Error("Begin step must precede or equal end step.");
      selectedStartRow = el.begin.value;
      await config.onBlock({task, start_row: el.begin.value, end_row: el.finish.value,
        version_scope: el["version-scope"].value, speed_scope: el["speed-scope"].value,
        review_status: task ? el.review.value : "draft", ending: el.ending.value});
    }
    el.form.addEventListener("submit", async e => {
      e.preventDefault();
      try { await applyBlock(collect()); } catch (error) { config.onError(error.message); }
    });
    el.reset.addEventListener("click", () => chooseBlock(Number(el.select.value)));
    el.remove.addEventListener("click", async () => {
      try { await applyBlock(null); } catch (error) { config.onError(error.message); }
    });
    el.suggest.addEventListener("click", () => { applied(); config.onSuggest(); });
    return { render, showState, setBusy, highlightRange, describe(info) { const task = prefs?.tasks.find(t => t.id === (info?.expected_task_id || info?.pending_id)); return task ? `${title(task)} · ${info.status}` : info?.status === "undecided" ? "Undecided" : info?.status === "not_specified" ? "Further task not specified · review" : "Assigned work complete"; }, hasPending: () => pendingForm,
      hintChanged(text) { if (!draft) return; const pending = pendingFields(); el.hint.textContent = TrialEditorTiles.text(text); preview.subtask_options.hint_sentences = text.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(Boolean); Object.values(draft.subtask_preferences?.version_reviews || {}).forEach(record => { if (record.status === "reviewed") record.status = "needs_review"; }); preview.subtask_timing.review_status = draft.subtask_preferences?.version_reviews?.[preview.version]?.status || draft.subtask_preferences?.review_status || "draft"; renderForm(); restorePending(pending); el.warnings.replaceChildren(n("p", "Briefing changed. Review the goal, action, timing and Briefing evidence before marking the sequence reviewed.")); } };
  }};
})();
