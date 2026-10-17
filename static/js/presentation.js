/* Guided presentation curates metadata; PlayingSessions remains the replay engine. */
(() => {
  const $ = id => document.getElementById(id);
  const copy = value => JSON.parse(JSON.stringify(value));
  const pct = value => `${(100 * value).toFixed(1)}%`;
  const colors = ['#7b8188', '#d783a6', '#4f83cc'];
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
      this.header.innerHTML = '<span>Presentation set</span><select id="presentation-set" aria-label="Presentation set"></select>';
      $('playing-condition').closest('label').before(this.header);
      const edit = document.createElement('button');
      edit.hidden = true; edit.id = 'presentation-edit'; edit.type = 'button'; edit.className = 'presentation-only'; edit.textContent = 'Edit presentation set';
      $('playing-random').after(edit);
      this.card = document.createElement('section'); this.card.className = 'presentation-only presentation-card';
      this.card.hidden = true; this.card.setAttribute('aria-live', 'polite');
      this.card.innerHTML = '<div class="presentation-card-title"><strong id="presentation-heading">Guided presentation</strong><span id="presentation-condition"></span></div><div id="presentation-story"><p>Read the Briefing to begin. Playback will pause after the critical action.</p></div><div id="presentation-evidence"></div><button id="presentation-continue" type="button" hidden>Continue →</button>';
      document.querySelector('.eeg-sidebar').prepend(this.card);
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
          <label>Why SPE or RPE+SPE<textarea id="presentation-explanation" rows="3" maxlength="4000"></textarea></label>
          <label>Correct decoder highlight<select id="presentation-highlight"></select></label>
          <label class="presentation-checkbox"><input id="presentation-comparison" type="checkbox">Show nonPE → PE comparison when supported</label>
          <canvas id="presentation-preview" aria-label="Reviewed full-trial probability trace"></canvas><p id="presentation-preview-detail"></p>
        </div></div><div class="presentation-editor-footer"><span id="presentation-editor-status" role="status"></span><button type="button" id="presentation-save-copy">Save as new set</button><button type="button" id="presentation-save">Save set</button></div>`;
      document.body.append(this.dialog);
      edit.onclick = () => this.openEditor();
      $('presentation-set').onchange = async () => {
        this.selected = copy(this.sets.find(s => s.id === $('presentation-set').value));
        player.populate(); await player.prepare();
      };
      $('presentation-continue').onclick = () => player.resume();
      $('presentation-entries').onchange = () => this.editEntry();
      $('presentation-name').oninput = () => { this.draft.name = $('presentation-name').value; };
      for (const key of ['expectation', 'happened', 'explanation']) $('presentation-' + key).oninput = () => {
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
    get active() { return this.player.active && $('experiment-mode').value === 'presentation'; }
    label(recording) { return `${recording.session} · Trial ${recording.trial_number} · ${recording.design} · ${recording.condition}`; }
    async load() {
      const [catalogue, saved] = await Promise.all([this.player.host.api('/api/presentation/catalogue'), this.player.host.api('/api/presentation/sets')]);
      this.candidates = catalogue.candidates;
      this.sets = saved.sets.length ? saved.sets : [catalogue.suggested_set];
      this.selected = this.selected && this.sets.find(s => s.id === this.selected.id) || copy(this.sets[0]);
      this.renderSets();
    }
    renderSets() {
      $('presentation-set').replaceChildren(...this.sets.map(s => new Option(s.name, s.id)));
      $('presentation-set').value = this.selected.id;
    }
    get entries() { return this.selected?.entries || []; }
    get entry() { return this.entries.find(e => e.recording_id === $('playing-recording').value); }
    visibility() {
      document.querySelectorAll('.presentation-only').forEach(e => e.hidden = !this.active);
      if (window.StaticReplay) {
        $('presentation-edit').hidden = true;
        this.header.hidden = true;
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
    reset() { this.info = null; this.update(null); }
    update(info = this.info) {
      this.info = info;
      if (!this.active) return;
      const time = this.player.viewEnd;
      const shown = info && time >= info.action_stop - 1e-8;
      const visibleEvidence = shown && info?.evidence && info.evidence.at <= time
        && info.evidence.available_elapsed <= time + 1e-9;
      const signature = JSON.stringify([this.player.session?.session_id, shown, visibleEvidence,
        visibleEvidence ? Math.min(info.evidence.interval.end, time) : null, info?.evidence_error,
        this.player.state, this.player.commandPending]);
      if (signature === this.lastRender) return;
      this.lastRender = signature;
      $('presentation-condition').textContent = info?.condition || '';
      $('presentation-heading').textContent = shown ? 'Critical action' : 'Guided presentation';
      const story = $('presentation-story'); story.replaceChildren();
      if (shown) for (const [title, key] of [['Human expectation', 'expectation'], ['What happened', 'happened'], [`Why ${info.condition}`, 'explanation']]) {
        const label = document.createElement('strong'); label.textContent = title;
        const text = document.createElement('p'); text.textContent = info[key];
        if (key === 'expectation' && visibleEvidence) {
          const details = document.createElement('details'), summary = document.createElement('summary');
          summary.textContent = title; details.append(summary, text); story.append(details);
        } else {
          const group = document.createElement('div'); group.className = 'presentation-story-row';
          group.append(label, document.createTextNode(' · '), text); story.append(group);
        }
      } else {
        const text = document.createElement('p'); text.textContent = window.StaticReplay
          ? 'Playback pauses after the critical action. Continue to the saved prediction highlight.'
          : 'Playback pauses after the critical action. Continue to the verified decoder highlight.'; story.append(text);
      }
      const area = $('presentation-evidence'); area.replaceChildren();
      const evidence = info?.evidence;
      if (shown && evidence && evidence.at <= time && evidence.available_elapsed <= time + 1e-9) {
        const intervalEnd = Math.min(evidence.interval.end, time);
        const title = document.createElement('strong'); title.className = 'presentation-verified';
        title.textContent = `Correct ${info.condition} · ${pct(evidence.probability)} at ${evidence.at.toFixed(2)} s`;
        title.style.color = colors[evidence.label];
        const detail = document.createElement('p');
        detail.textContent = `Selected pause · margin ${(100 * evidence.margin).toFixed(1)} pp · observed correct span ${Math.max(0, intervalEnd - evidence.interval.start).toFixed(2)} s (${evidence.interval.start.toFixed(2)}–${intervalEnd.toFixed(2)} s). ${window.StaticReplay ? 'Saved analysis result; no decoding runs here.' : 'Verified from EEG.'}`;
        area.append(title, detail);
        if (evidence.comparison) {
          const c = evidence.comparison, comparison = document.createElement('p');
          comparison.textContent = `From ${c.at.toFixed(2)} s: nonPE ${pct(c.before[0])} → ${pct(c.after[0])} (${c.nonpe_change_pp.toFixed(1)} pp); ${info.condition} ${pct(c.before[evidence.label])} → ${pct(c.after[evidence.label])} (+${c.pe_change_pp.toFixed(1)} pp).`;
          area.append(comparison);
        }
      } else if (shown) {
        const text = document.createElement('p'); text.textContent = info.evidence_error || 'Continue to the selected correct prediction.'; area.append(text);
      }
      $('presentation-continue').hidden = this.player.state !== 'PAUSED' || time >= this.player.session?.duration;
      $('presentation-continue').disabled = this.player.commandPending;
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
      for (const key of ['expectation', 'happened', 'explanation']) {
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
        $('presentation-highlight').append(...trace.rows.filter(r => r.eligible).map(r => new Option(
          `${r.sample_elapsed.toFixed(3)} s · ${pct(r.probabilities[r.annotation])} · margin ${(r.margin * 100).toFixed(1)} pp · span ${r.interval.duration.toFixed(2)} s`, r.sample_index)));
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
      const x = t => 35 + t / this.trace.duration * (width - 50), y = p => 160 - 145 * p;
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
          if (!row.probabilities) { previous = null; continue; }
          if (previous == null || row.sample_elapsed - previous > .094) ctx.moveTo(x(row.sample_elapsed), y(row.probabilities[i]));
          else ctx.lineTo(x(row.sample_elapsed), y(row.probabilities[i])); previous = row.sample_elapsed;
        } ctx.stroke();
      });
      ctx.strokeStyle = '#566d56'; ctx.setLineDash([3,3]); ctx.beginPath(); ctx.moveTo(x(this.trace.critical), 10); ctx.lineTo(x(this.trace.critical), 162); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillText(`Critical ${this.trace.critical.toFixed(2)} s`, Math.min(width - 100, x(this.trace.critical) + 3), 180);
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
        this.renderSets(); this.dialog.close(); this.player.populate(); await this.player.prepare();
      } catch (error) { $('presentation-editor-status').textContent = error.message; }
      finally { $('presentation-save').disabled = $('presentation-save-copy').disabled = false; }
    }
  };
})();
