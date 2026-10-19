/* Guided presentation curates metadata; PlayingSessions remains the replay engine. */
(() => {
  const $ = id => document.getElementById(id);
  const copy = value => JSON.parse(JSON.stringify(value));
  const pct = value => `${(100 * value).toFixed(1)}%`;
  const colors = ['#7b8188', '#d783a6', '#4f83cc'];
  const defaultPredictionText = 'Here, the EEG prediction matches the recorded action label.';
  const textFields = ['expectation', 'happened', 'explanation', 'prediction_text'];
  const directions = {NORTH: [0, -1], SOUTH: [0, 1], EAST: [1, 0], WEST: [-1, 0]};
  const svgNS = 'http://www.w3.org/2000/svg';
  const svgNode = (name, attributes) => {
    const node = document.createElementNS(svgNS, name);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    return node;
  };
  const overlaps = (a, b) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
    * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  window.PresentationGuide = class {
    static correctIntervals(rows) {
      const intervals = []; let previous = null;
      for (const row of rows) {
        const label = row.correct_pe_label, time = row.sample_elapsed;
        if (!row.valid || ![1, 2].includes(label)) { previous = null; continue; }
        if (!previous || previous.label !== label || time - previous.end > .094) {
          previous = {label, start: time, end: time}; intervals.push(previous);
        } else previous.end = time;
      }
      return intervals;
    }
    constructor(player) {
      this.player = player;
      this.header = document.createElement('label');
      this.header.className = 'presentation-only'; this.header.hidden = true;
      this.header.innerHTML = '<span>PE trial type</span><select id="presentation-type" aria-label="PE trial type"><option value="SPE">SPE</option><option value="RPE+SPE">RPE</option></select>';
      $('playing-condition').closest('label').before(this.header);
      const edit = document.createElement('button');
      edit.hidden = true; edit.id = 'presentation-edit'; edit.type = 'button'; edit.className = 'presentation-only'; edit.textContent = 'Edit presentation set';
      $('playing-random').after(edit);
      this.buildCallouts();
      this.dialog = document.createElement('dialog'); this.dialog.id = 'presentation-editor';
      this.dialog.innerHTML = `<form method="dialog" class="presentation-editor-heading"><h2>Edit presentation set</h2><button aria-label="Close presentation editor">Close</button></form>
        <p>Choose from the 108 final-demo picks. The preview below uses reviewed predictions; presentation playback recomputes EEG and verifies each highlight.</p>
        <div class="presentation-editor-layout"><div class="presentation-roster">
          <label>Set name<input id="presentation-name" maxlength="120"></label>
          <label>Trials in presentation order<select id="presentation-entries" size="8" aria-label="Trials in presentation order"></select></label>
          <div class="presentation-editor-buttons"><button type="button" id="presentation-up">Move up</button><button type="button" id="presentation-down">Move down</button><button type="button" id="presentation-remove">Remove</button></div>
          <label>Add a final-demo pick<select id="presentation-add-recording"></select></label><button type="button" id="presentation-add">Add recording</button>
        </div><div class="presentation-editor-detail">
          <label>Human expectation<textarea id="presentation-expectation" rows="2" maxlength="4000"></textarea></label>
          <label>What happened<textarea id="presentation-happened" rows="2" maxlength="4000"></textarea></label>
          <label>EEG prediction callout<textarea id="presentation-prediction_text" rows="3" maxlength="4000"></textarea></label>
          <label>Why SPE or RPE+SPE<textarea id="presentation-explanation" rows="3" maxlength="4000"></textarea></label>
          <label>Correct decoder highlight<select id="presentation-highlight"></select></label>
          <label class="presentation-checkbox"><input id="presentation-comparison" type="checkbox">Show nonPE → PE comparison when supported</label>
          <canvas id="presentation-preview" aria-label="Reviewed full-trial probability trace"></canvas><p id="presentation-preview-detail"></p>
        </div></div><div class="presentation-editor-footer"><span id="presentation-editor-status" role="status"></span><button type="button" id="presentation-save-copy">Save as new set</button><button type="button" id="presentation-save">Save set</button></div>`;
      document.body.append(this.dialog);
      edit.onclick = () => this.openEditor();
      $('presentation-type').onchange = () => player.selectionChanged('presentation-type');
      $('presentation-entries').onchange = () => this.editEntry();
      $('presentation-name').oninput = () => { this.draft.name = $('presentation-name').value; };
      for (const key of textFields) $('presentation-' + key).oninput = () => {
        if (this.editing) this.editing[key] = $('presentation-' + key).value;
      };
      $('presentation-highlight').onchange = () => {
        if (!this.editing) return;
        this.editing.highlight_sample_index = $('presentation-highlight').value === '' ? null : Number($('presentation-highlight').value);
        this.drawPreview();
      };
      $('presentation-comparison').onchange = () => { if (this.editing) this.editing.show_comparison = $('presentation-comparison').checked; };
      $('presentation-up').onclick = () => this.reorder(-1);
      $('presentation-down').onclick = () => this.reorder(1);
      $('presentation-remove').onclick = () => {
        const index = $('presentation-entries').selectedIndex;
        if (index < 0) return;
        this.draft.entries.splice(index, 1); this.renderRoster(Math.max(0, index - 1));
      };
      $('presentation-add').onclick = () => {
        const candidate = this.candidates.find(c => c.id === $('presentation-add-recording').value);
        if (!candidate || this.draft.entries.some(e => e.recording_id === candidate.id)) return;
        this.draft.entries.push(copy(candidate.draft)); this.renderRoster(this.draft.entries.length - 1);
      };
      $('presentation-save').onclick = () => this.save(false);
      $('presentation-save-copy').onclick = () => this.save(true);
    }
    buildCallouts() {
      this.mapWindow = document.querySelector('.game-window');
      this.mapLayer = document.createElement('div');
      this.mapLayer.className = 'presentation-map-layer'; this.mapLayer.hidden = true;
      this.mapSvg = svgNode('svg', {'aria-hidden': 'true', class: 'presentation-map-indicators'});
      this.card = document.createElement('section');
      this.card.id = 'presentation-action-callout';
      this.card.className = 'presentation-callout presentation-card';
      this.card.setAttribute('aria-labelledby', 'presentation-heading');
      this.card.setAttribute('aria-live', 'polite');
      this.card.innerHTML = `<div class="presentation-callout-heading"><span class="presentation-callout-number" aria-hidden="true">1</span>
        <strong id="presentation-heading">What happened</strong>
        <button type="button" class="presentation-callout-close" aria-label="Hide action explanation">×</button></div>
        <div id="presentation-story"></div><div class="presentation-callout-footer"></div>`;
      this.mapLayer.append(this.mapSvg, this.card); this.mapWindow.append(this.mapLayer);
      this.mapDock = document.createElement('div'); this.mapDock.className = 'presentation-map-dock'; this.mapDock.hidden = true;
      (document.querySelector('.playing-game-support') || this.mapWindow).after(this.mapDock);
      this.signalColumn = document.querySelector('.eeg-sidebar');
      this.evidenceOverlay = document.createElement('div'); this.evidenceOverlay.className = 'presentation-evidence-overlay'; this.evidenceOverlay.hidden = true;
      this.evidenceCard = document.createElement('section');
      this.evidenceCard.id = 'presentation-prediction-callout';
      this.evidenceCard.className = 'presentation-callout presentation-prediction-callout';
      this.evidenceCard.setAttribute('aria-labelledby', 'presentation-prediction-heading');
      this.evidenceCard.setAttribute('aria-live', 'polite');
      this.evidenceCard.innerHTML = `<div class="presentation-callout-heading"><span class="presentation-callout-number" aria-hidden="true">2</span>
        <strong id="presentation-prediction-heading">The EEG prediction</strong><button type="button" class="presentation-callout-close" aria-label="Hide prediction explanation">×</button></div>
        <div id="presentation-evidence"></div><div class="presentation-callout-footer"></div>`;
      this.evidenceSvg = svgNode('svg', {'aria-hidden': 'true', hidden: '', class: 'presentation-evidence-leader'});
      this.probabilityPanel = document.querySelector('.decoder-panel-card');
      this.evidenceOverlay.append(this.evidenceSvg, this.evidenceCard);
      this.signalColumn.append(this.evidenceOverlay);
      this.continueHome = document.createComment('Continue outside Presentation callouts');
      $('resume-button').before(this.continueHome);
      this.mapReopen = this.makeReopen('Show action explanation', this.card.id);
      this.evidenceReopen = this.makeReopen('Show prediction explanation', this.evidenceCard.id);
      this.continueHome.parentNode.append(this.mapReopen, this.evidenceReopen);
      for (const [card, reopen, field] of [[this.card, this.mapReopen, 'actionDismissed'], [this.evidenceCard, this.evidenceReopen, 'evidenceDismissed']]) {
        reopen.onclick = () => { this[field] = false; this.update(); card.querySelector('.presentation-callout-close').focus({preventScroll: true}); };
        const close = () => { this[field] = true; this.update(); reopen.focus({preventScroll: true}); };
        card.querySelector('.presentation-callout-close').onclick = close;
        card.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } });
      }
      this.player.resize.observe(this.mapWindow);
      this.player.resize.observe(this.card);
      this.player.resize.observe(this.evidenceCard);
    }
    makeReopen(label, controls) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'presentation-reopen';
      button.textContent = label; button.setAttribute('aria-controls', controls);
      button.setAttribute('aria-expanded', 'false'); button.hidden = true; return button;
    }
    syncContinue() {
      const button = $('resume-button');
      const card = this.annotating && !button.hidden && (!this.evidenceCard.hidden ? this.evidenceCard : !this.card.hidden ? this.card : null);
      if (card) {
        const footer = card.querySelector('.presentation-callout-footer');
        if (button.parentNode !== footer) footer.append(button);
      } else if (this.continueHome.nextSibling !== button) this.continueHome.after(button);
    }
    layout(charts) {
      if (!this.annotating) return;
      this.layoutMap();
      if (this.visibleEvidence || !this.evidenceCard.hidden) this.layoutEvidence(charts.p);
    }
    layoutMap() {
      const canvas = this.mapWindow.querySelector('canvas'), grid = this.player.session?.playback.layout_grid;
      const current = this.player.gameHistory.filter(row => row.at <= this.player.viewEnd).at(-1);
      const critical = this.player.gameHistory.filter(row => row.actions && row.at <= this.info.critical_onset + 1e-6).at(-1);
      if (!canvas || !grid?.length || !current) return;
      const kitchen = this.mapWindow.getBoundingClientRect(), column = this.mapWindow.closest('.stage-center');
      const scale = kitchen.width / this.mapWindow.offsetWidth;
      // Compact kitchens leave useful space beside the canvas for their note.
      this.mapLayer.style.left = `${(column.getBoundingClientRect().left - kitchen.left) / scale}px`;
      this.mapLayer.style.width = `${column.clientWidth}px`;
      const bounds = this.mapLayer.getBoundingClientRect(), board = canvas.getBoundingClientRect();
      const width = this.mapLayer.clientWidth, height = this.mapWindow.clientHeight;
      const origin = {x: (board.left - bounds.left) / scale, y: (board.top - bounds.top) / scale};
      const tw = board.width / scale / grid[0].length;
      // Raised countertops reserve space above the physical floor/agent grid.
      const th = board.height / scale / KitchenStyle.dimensions(grid).height;
      origin.y += KitchenStyle.gridOffset(th);
      const elevation = KitchenStyle.gridOffset(th);
      const counterAt = position => 'XOTDPS'.includes(grid[position[1]]?.[position[0]] || '?');
      const center = (position, raised = false) => ({x: origin.x + (position[0] + .5) * tw, y: origin.y + (position[1] + .5) * th - (raised ? elevation : 0)});
      const tileBox = (position, pad = 0, raised = false) => ({x: origin.x + position[0] * tw - pad, y: origin.y + position[1] * th - pad - (raised ? elevation : 0), width: tw + 2 * pad, height: th + 2 * pad});
      const actorBox = (position, pad = 0) => {
        const box = tileBox(position, pad); box.y += KitchenStyle.actorOffset(th); return box;
      };
      const style = getComputedStyle(this.mapWindow), actorColors = [style.getPropertyValue('--human').trim(), style.getPropertyValue('--ai').trim()];
      this.mapSvg.setAttribute('viewBox', `0 0 ${width} ${height}`); this.mapSvg.replaceChildren();
      const protectedBoxes = [], fixtures = [], floor = [];
      grid.forEach((row, y) => [...row].forEach((cell, x) => {
        if (!['X', ' ', '1', '2'].includes(cell)) fixtures.push(tileBox([x, y], 3, true));
        else if (cell !== 'X') floor.push(tileBox([x, y]));
      }));
      for (const object of Object.values(current.state.objects || {})) if (object.position) protectedBoxes.push(tileBox(object.position, 3, counterAt(object.position)));
      const progress = Math.min(1, Math.max(0, (this.player.viewEnd - current.at) * 1000 / (this.player.session.playback.animation_ms || 375)));
      const positions = current.state.players.map((actor, i) => {
        const from = current.before?.players[i].position, to = actor.position;
        const motion = current.motion?.[i];
        const amount = KitchenMotion.fraction(progress, motion?.wasMoving, motion?.continues);
        return from && Math.abs(from[0] - to[0]) + Math.abs(from[1] - to[1]) === 1
          ? to.map((value, axis) => from[axis] + (value - from[axis]) * amount) : to;
      });
      const matching = critical && positions.every((position, i) => position.every((v, axis) => Math.abs(v - critical.state.players[i].position[axis]) < .01));
      const floorMarks = [];
      positions.forEach((position, i) => {
        const color = actorColors[i], actor = i === 0 ? 'human' : 'ai';
        protectedBoxes.push(actorBox(position, 4), tileBox(position, 3));
        const [x, y] = position, inset = .07, leg = .19;
        const left = x + inset, right = x + 1 - inset, top = y + inset, bottom = y + 1 - inset;
        floorMarks.push({kind: 'bracket', actor, color, position, segments: [
          [[left, top + leg], [left, top], [left + leg, top]],
          [[right - leg, top], [right, top], [right, top + leg]],
          [[left, bottom - leg], [left, bottom], [left + leg, bottom]],
          [[right - leg, bottom], [right, bottom], [right, bottom - leg]],
        ]});
        if (!matching || !critical.before) return;
        const from = critical.before.players[i], action = critical.actions[i];
        const delta = directions[action] || (action === 'INTERACT' ? from.orientation : null);
        if (!delta) return;
        const target = from.position.map((v, axis) => v + delta[axis]);
        const raised = action === 'INTERACT' && counterAt(target);
        protectedBoxes.push(tileBox(target, 6, raised));
        if (action !== 'INTERACT') {
          // A southern worktop covers the boots. Keep one shared floor lane
          // just above that lip so both directions into a tile stay readable.
          const contact = Math.min(KitchenStyle.actorGround(1), 1 - KitchenStyle.gridOffset(1) - .1);
          const start = [from.position[0] + .5, from.position[1] + contact];
          // Leave more room at an occupied destination so the arriving chef
          // does not cover the arrowhead on the floor beneath it.
          const gap = positions.some(p => p.every((v, axis) => Math.abs(v - target[axis]) < .01)) ? .33 : .11;
          const end = [target[0] + .5 - delta[0] * gap, target[1] + contact - delta[1] * gap];
          const [ux, uy] = delta;
          floorMarks.push({kind: 'movement', actor, color, target, segments: [
            [start, end],
            [[end[0] - ux * .13 - uy * .075, end[1] - uy * .13 + ux * .075], end,
              [end[0] - ux * .13 + uy * .075, end[1] - uy * .13 - ux * .075]],
          ]});
          return;
        }
        const start = center(from.position), end = center(target, raised);
        start.y += KitchenStyle.actorGround(th) - th / 2;
        if (!raised) end.y += KitchenStyle.actorGround(th) - th / 2;
        const dx = end.x - start.x, dy = end.y - start.y, length = Math.hypot(dx, dy), ux = dx / length, uy = dy / length;
        // Interaction pointers are shorter and lift to the worktop; movement
        // arrows remain on the floor and never run across a carried item.
        const sx = end.x - ux * Math.min(length * .42, tw * .38), sy = end.y - uy * Math.min(length * .42, th * .38);
        const ex = end.x - ux * 7, ey = end.y - uy * 7;
        const d = `M ${sx} ${sy} L ${ex} ${ey} M ${ex - ux * 7 - uy * 4} ${ey - uy * 7 + ux * 4} L ${ex} ${ey} L ${ex - ux * 7 + uy * 4} ${ey - uy * 7 - ux * 4}`;
        this.mapSvg.append(svgNode('path', {d, fill: 'none', stroke: 'white', 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'}),
          svgNode('path', {d, fill: 'none', stroke: color, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'data-action-actor': actor, 'data-action-kind': 'interaction'}));
      });
      this.player.host.floorIndicators(floorMarks);
      const anchor = center(positions[1] || positions[0]);
      if (this.card.hidden) return;
      if (this.card.parentNode !== this.mapLayer) this.mapLayer.append(this.card);
      this.card.classList.remove('is-docked');
      this.card.style.width = `${Math.min(340, width * .46)}px`;
      this.card.style.maxHeight = `${Math.min(260, height - 24)}px`;
      const card = {width: this.card.offsetWidth, height: this.card.offsetHeight};
      const findSpace = () => {
        let best = null;
        for (let y = 12; y + card.height <= height - 12; y += 12) for (let x = 12; x + card.width <= width - 12; x += 12) {
          const candidate = {...card, x, y};
          if (protectedBoxes.some(box => overlaps(candidate, box) > 0)) continue;
          const score = 10 * fixtures.reduce((sum, box) => sum + overlaps(candidate, box), 0)
            + floor.reduce((sum, box) => sum + overlaps(candidate, box), 0)
            + Math.hypot(x + card.width / 2 - anchor.x, y + card.height / 2 - anchor.y);
          if (!best || score < best.score) best = {...candidate, score};
        }
        return best;
      };
      let best = null;
      if (width * scale >= 500) {
        best = findSpace();
        // Bound long authored notes to a safe map region before docking below it.
        for (const cap of [220, 180, 150]) if (!best && card.height > cap) {
          this.card.style.maxHeight = `${cap}px`; card.height = this.card.offsetHeight;
          best = findSpace();
        }
      }
      this.mapDock.hidden = !!best;
      this.card.classList.toggle('is-docked', !best);
      if (!best) {
        this.mapDock.append(this.card); this.card.style.width = ''; this.card.style.maxHeight = '';
        this.card.style.left = this.card.style.top = '';
        return;
      }
      this.card.style.left = `${best.x}px`; this.card.style.top = `${best.y}px`;
      const edge = {x: Math.max(best.x + 14, Math.min(best.x + card.width - 14, anchor.x)), y: Math.max(best.y + 14, Math.min(best.y + card.height - 14, anchor.y))};
      const dx = edge.x - anchor.x, dy = edge.y - anchor.y;
      const toOutline = Math.min(tw * .43 / Math.max(.001, Math.abs(dx)), th * .43 / Math.max(.001, Math.abs(dy)));
      const end = {x: anchor.x + dx * toOutline, y: anchor.y + dy * toOutline};
      const d = `M ${edge.x} ${edge.y} L ${end.x} ${end.y}`;
      this.mapSvg.prepend(svgNode('path', {d, stroke: 'white', 'stroke-width': 5}), svgNode('path', {d, stroke: '#111', 'stroke-width': 1.5}));
    }
    layoutEvidence(chart) {
      const canvas = $('probability-chart'), bounds = this.signalColumn.getBoundingClientRect(), plot = canvas.getBoundingClientRect();
      const scale = bounds.width / this.signalColumn.offsetWidth, evidence = this.info.evidence;
      const width = this.signalColumn.clientWidth, height = this.signalColumn.clientHeight;
      const panelTop = (this.probabilityPanel.getBoundingClientRect().top - bounds.top) / scale;
      // Float over the lower EEG panel, outside both cards' layout and clipping.
      this.evidenceCard.style.width = `${Math.min(360, width - 32)}px`;
      this.evidenceCard.style.maxHeight = `${Math.max(96, Math.min(240, panelTop - 40))}px`;
      this.evidenceCard.style.left = '16px';
      this.evidenceCard.style.top = `${Math.max(12, panelTop - this.evidenceCard.offsetHeight - 12)}px`;
      if (!evidence) return;
      const point = {x: (plot.left - bounds.left) / scale + chart.x(evidence.at), y: (plot.top - bounds.top) / scale + chart.bottom - evidence.probability * (chart.bottom - chart.top)};
      this.evidenceSvg.setAttribute('viewBox', `0 0 ${width} ${height}`); this.evidenceSvg.replaceChildren();
      if (this.evidenceCard.hidden) return;
      const card = this.evidenceCard.getBoundingClientRect();
      const edge = {x: Math.max((card.left - bounds.left) / scale + 14, Math.min((card.right - bounds.left) / scale - 14, point.x)), y: (card.bottom - bounds.top) / scale};
      const distance = Math.hypot(edge.x - point.x, edge.y - point.y);
      const end = {x: point.x + (edge.x - point.x) / distance * 7, y: point.y + (edge.y - point.y) / distance * 7};
      const d = `M ${edge.x} ${edge.y} L ${end.x} ${end.y}`;
      this.evidenceSvg.append(svgNode('path', {d, fill: 'none', stroke: 'white', 'stroke-width': 5}), svgNode('path', {d, fill: 'none', stroke: '#111', 'stroke-width': 1.5}));
    }
    get active() { return this.player.active && $('experiment-mode').value === 'presentation'; }
    get annotating() { return this.active && this.info && this.player.reviewing && !this.player.commandPending && this.player.viewEnd >= this.info.action_stop - 1e-8; }
    get visibleEvidence() {
      const evidence = this.info?.evidence, time = this.player.viewEnd;
      return this.active && this.info && time >= this.info.action_stop - 1e-8 && evidence
        && !(this.info.checkpoint === 'action' && Math.abs(time - this.player.elapsed) <= 1e-8)
        && evidence.at <= time && evidence.available_elapsed <= time + 1e-9;
    }
    label(recording) { return `${this.player.recordingLabel(recording)} · ${recording.condition}`; }
    async load() {
      const [catalogue, saved] = await Promise.all([this.player.host.api('/api/presentation/catalogue'), this.player.host.api('/api/presentation/sets')]);
      this.candidates = catalogue.candidates;
      this.sets = saved.sets.length ? saved.sets : [catalogue.suggested_set];
      this.selected = this.selected && this.sets.find(s => s.id === this.selected.id) || copy(this.sets[0]);
      this.renderTypes();
    }
    renderTypes() {
      const select = $('presentation-type');
      const conditions = new Set(this.entries.map(e => e.condition
        || this.candidates.find(c => c.id === e.recording_id)?.condition));
      for (const option of select.options) option.disabled = !conditions.has(option.value);
      if (!conditions.has(select.value)) select.value = [...select.options].find(option => !option.disabled)?.value || '';
    }
    get type() { return $('presentation-type').value; }
    get entries() { return this.selected?.entries || []; }
    get entry() { return this.entries.find(e => e.recording_id === $('playing-recording').value); }
    visibility() {
      document.querySelectorAll('.presentation-only').forEach(e => e.hidden = !this.active);
      if (!this.active) {
        this.player.host.floorIndicators();
        this.mapLayer.hidden = this.mapDock.hidden = this.evidenceOverlay.hidden = this.mapReopen.hidden = this.evidenceReopen.hidden = true;
        this.evidenceSvg.toggleAttribute('hidden', true);
        this.syncContinue();
      }
      if (window.StaticReplay) {
        $('presentation-edit').hidden = true;
        $('playing-participant').closest('label').hidden = true;
      }
      if (this.active) {
        $('playing-session-type').closest('label').hidden = true;
        $('playing-condition').closest('label').hidden = true;
        $('playing-random').hidden = true;
        document.querySelector('.eeg-card-heading h2').textContent = 'EEG · full trial';
        $('eeg-waveform').setAttribute('aria-label', 'Six-channel EEG · full trial timeline');
        $('probability-chart').setAttribute('aria-label', 'RPE, SPE and nonPE probabilities · full trial timeline');
      }
    }
    reset() {
      this.actionDismissed = this.evidenceDismissed = false; this.lastRender = null;
      this.update(null);
    }
    update(info = this.info) {
      this.info = info;
      if (!this.active) { this.syncContinue(); return; }
      const time = this.player.viewEnd;
      const shown = !!this.annotating, visibleEvidence = shown && !!this.visibleEvidence;
      if (!shown) this.player.host.floorIndicators();
      const error = shown && !visibleEvidence && info.evidence_error;
      const actionAvailable = shown && ((!visibleEvidence && !error) || time >= this.player.session.duration);
      this.mapLayer.hidden = !shown;
      this.card.hidden = !actionAvailable || this.actionDismissed;
      this.mapReopen.hidden = !actionAvailable || !this.actionDismissed;
      this.evidenceCard.hidden = !shown || this.evidenceDismissed || (!visibleEvidence && !error);
      this.evidenceOverlay.hidden = this.evidenceCard.hidden;
      this.evidenceReopen.hidden = !shown || !this.evidenceDismissed || (!visibleEvidence && !error);
      this.evidenceSvg.toggleAttribute('hidden', !visibleEvidence || this.evidenceCard.hidden);
      if (this.card.hidden) this.mapDock.hidden = true;
      this.syncContinue();
      const signature = JSON.stringify([this.player.session?.session_id, shown, visibleEvidence,
        visibleEvidence ? Math.min(info.evidence.interval.end, time) : null, info?.evidence_error,
        this.player.state, this.player.commandPending, this.actionDismissed, this.evidenceDismissed, shown ? time : null]);
      if (signature === this.lastRender) return;
      this.lastRender = signature;
      $('presentation-heading').textContent = 'What happened';
      $('presentation-story').textContent = shown ? info.happened || 'No explanation supplied.' : '';
      const area = $('presentation-evidence'); area.replaceChildren();
      if (visibleEvidence) {
        area.textContent = info.prediction_text ?? this.entry?.prediction_text ?? defaultPredictionText;
        $('presentation-prediction-heading').textContent = window.StaticReplay ? 'The recorded prediction' : 'The EEG prediction';
      } else if (error) {
        $('presentation-prediction-heading').textContent = 'EEG result unavailable';
        const text = document.createElement('p'); text.textContent = error; area.append(text);
      }
      this.player.scheduleDraw();
    }
    async openEditor() {
      if (this.player.busy) await this.player.pause();
      this.draft = copy(this.selected); $('presentation-name').value = this.draft.name;
      $('presentation-editor-status').textContent = 'Changes are saved separately from recordings and final-demo picks.';
      $('presentation-add-recording').replaceChildren(...this.candidates.map(c => new Option(this.label(c), c.id)));
      this.dialog.showModal(); this.renderRoster(0);
    }
    renderRoster(index) {
      $('presentation-entries').replaceChildren(...this.draft.entries.map(e => {
        const c = this.candidates.find(c => c.id === e.recording_id); return new Option(c ? this.label(c) : e.recording_id, e.recording_id);
      }));
      $('presentation-entries').selectedIndex = Math.min(index, this.draft.entries.length - 1);
      this.editEntry();
    }
    reorder(offset) {
      const index = $('presentation-entries').selectedIndex, next = index + offset;
      if (index < 0 || next < 0 || next >= this.draft.entries.length) return;
      [this.draft.entries[index], this.draft.entries[next]] = [this.draft.entries[next], this.draft.entries[index]];
      this.renderRoster(next);
    }
    async editEntry() {
      const token = this.editToken = (this.editToken || 0) + 1;
      this.editing = this.draft.entries[$('presentation-entries').selectedIndex];
      this.trace = null;
      if (this.editing && this.editing.prediction_text == null) this.editing.prediction_text = defaultPredictionText;
      for (const key of textFields) {
        $('presentation-' + key).value = this.editing?.[key] || '';
        $('presentation-' + key).disabled = !this.editing;
      }
      $('presentation-comparison').checked = Boolean(this.editing?.show_comparison);
      $('presentation-highlight').replaceChildren(new Option('Action explanation only', ''));
      this.drawPreview();
      if (!this.editing) return;
      try {
        const trace = await this.player.host.api(`/api/presentation/trace?recording_id=${encodeURIComponent(this.editing.recording_id)}`);
        if (token !== this.editToken) return;
        this.trace = trace;
        const start = trace.playback_start || 0;
        $('presentation-highlight').append(...trace.rows.filter(r => r.eligible).map(r => new Option(
          `${(r.sample_elapsed - start).toFixed(3)} s · ${pct(r.probabilities[r.annotation])} · margin ${(r.margin * 100).toFixed(1)} pp · span ${r.interval.duration.toFixed(2)} s`, r.sample_index)));
        $('presentation-highlight').value = this.editing.highlight_sample_index ?? '';
        this.drawPreview();
      } catch (error) { if (token === this.editToken) $('presentation-preview-detail').textContent = error.message; }
    }
    drawPreview() {
      const canvas = $('presentation-preview'), width = canvas.clientWidth || 600, height = 190, ratio = window.devicePixelRatio || 1;
      canvas.width = width * ratio; canvas.height = height * ratio;
      const ctx = canvas.getContext('2d'); ctx.scale(ratio, ratio);
      ctx.clearRect(0, 0, width, height);
      if (!this.trace) { $('presentation-preview-detail').textContent = this.editing ? 'Loading reviewed trace…' : 'Add a recording to begin.'; return; }
      const start = this.trace.playback_start || 0;
      const x = t => 35 + (t - start) / (this.trace.duration - start) * (width - 50), y = p => 160 - 145 * p;
      for (const interval of window.PresentationGuide.correctIntervals(this.trace.rows)) {
        ctx.fillStyle = interval.label === 1 ? 'rgba(215,131,166,.12)' : 'rgba(79,131,204,.12)';
        ctx.fillRect(x(interval.start), 15, Math.max(2, x(interval.end) - x(interval.start)), 145);
      }
      const style = getComputedStyle(canvas);
      ctx.font = '11px system-ui'; ctx.fillStyle = style.color;
      for (const p of [0, .5, 1]) { ctx.fillText(pct(p), 0, y(p)); ctx.strokeStyle = style.borderTopColor; ctx.beginPath(); ctx.moveTo(35, y(p)); ctx.lineTo(width-15, y(p)); ctx.stroke(); }
      colors.forEach((color, i) => {
        ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); let previous = null;
        for (const row of this.trace.rows) {
          if (!row.probabilities || row.sample_elapsed < start) { previous = null; continue; }
          if (previous == null || row.sample_elapsed - previous > .094) ctx.moveTo(x(row.sample_elapsed), y(row.probabilities[i]));
          else ctx.lineTo(x(row.sample_elapsed), y(row.probabilities[i])); previous = row.sample_elapsed;
        } ctx.stroke();
      });
      ctx.strokeStyle = '#566d56'; ctx.setLineDash([3,3]); ctx.beginPath(); ctx.moveTo(x(this.trace.critical), 10); ctx.lineTo(x(this.trace.critical), 162); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillText('0 s', 35, 180);
      ctx.fillText(`Critical ${(this.trace.critical - start).toFixed(2)} s`, Math.min(width - 100, x(this.trace.critical) + 3), 180);
      const selected = this.trace.rows.find(r => r.sample_index === this.editing?.highlight_sample_index);
      if (selected?.eligible) { ctx.strokeStyle = colors[selected.annotation]; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x(selected.sample_elapsed), y(selected.probabilities[selected.annotation]), 5, 0, Math.PI*2); ctx.stroke(); }
      $('presentation-preview-detail').textContent = this.trace.error || `Reviewed predictions · shaded bands: correct PE after critical onset · ring: selected pause point. ${this.trace.rows.filter(r => r.eligible).length} valid correct highlight points. Fixation is excluded from evidence.`;
    }
    async save(asNew) {
      const payload = copy(this.draft); if (asNew) delete payload.id;
      $('presentation-save').disabled = $('presentation-save-copy').disabled = true;
      try {
        const saved = await this.player.host.api('/api/presentation/sets', {method: 'POST', body: JSON.stringify(payload)});
        this.sets = this.sets.filter(s => s.id !== saved.id && s.id !== 'suggested'); this.sets.push(saved); this.selected = saved;
        this.renderTypes(); this.dialog.close(); this.player.populate(); await this.player.prepare();
      } catch (error) { $('presentation-editor-status').textContent = error.message; }
      finally { $('presentation-save').disabled = $('presentation-save-copy').disabled = false; }
    }
  };
})();
