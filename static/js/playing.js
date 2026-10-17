/* Playing owns its inference stream and retained plots; Recording keeps its UI. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const WINDOW = 1.5;
  const COLORS = ["#7b8188", "#d783a6", "#4f83cc"];
  const colorsForEvidence = (label, alpha) => label === 1 ? `rgba(215,131,166,${alpha})` : `rgba(79,131,204,${alpha})`;
  const CHANNELS = ["AF3", "F7", "F3", "FC5", "T7", "O1"];
  const CHANNEL_INDICES = [0, 1, 2, 3, 4, 6];
  window.PlayingSessions = class {
    constructor(host) {
      this.host = host;
      this.active = false;
      this.generation = 0;
      this.state = "IDLE";
      this.raw = [];
      this.probabilities = [];
      this.gameHistory = [];
      this.elapsed = 0;
      this.viewEnd = 0;
      this.setupHeader = document.querySelector(".hybrid-header");
      this.setupHeader.id = "playing-setup-header";
      this.setupBar = document.createElement("button");
      this.setupBar.id = "playing-setup-bar";
      this.setupBar.type = "button";
      this.setupBar.textContent = "⌄  Session setup";
      this.setupBar.setAttribute("aria-controls", this.setupHeader.id);
      this.setupBar.setAttribute("aria-expanded", "false");
      this.setupBar.setAttribute("aria-label", "Show session setup");
      document.body.append(this.setupBar);
      for (const element of [this.setupBar, this.setupHeader]) {
        element.addEventListener("pointerenter", () => this.showSetup(true));
        element.addEventListener("pointerleave", () => this.deferSetupClose());
        element.addEventListener("focusin", () => this.showSetup(true));
        element.addEventListener("focusout", () => this.deferSetupClose());
      }
      this.setupBar.addEventListener("click", () => this.showSetup(true));
      document.addEventListener("keydown", event => {
        if (event.key === "Tab") this.setupKeyboard = true;
      });
      document.addEventListener("pointerdown", event => {
        this.setupKeyboard = false;
        if (!this.setupHeader.contains(event.target) && !this.setupBar.contains(event.target)) this.showSetup(false);
      });
      this.briefingControl = document.querySelector(".hint-control");
      this.briefingHome = document.createComment("Briefing position outside Playing");
      this.briefingControl.before(this.briefingHome);
      const gameSupport = document.createElement("div");
      gameSupport.className = "playing-only playing-game-support";
      document.querySelector(".game-window").after(gameSupport);
      this.briefingSlot = document.createElement("div");
      this.briefingSlot.className = "playing-only playing-briefing-slot";
      gameSupport.append(this.briefingSlot);
      const history = document.createElement("section");
      history.className = "playing-only playing-history";
      history.setAttribute("aria-label", "Trial history");
      history.innerHTML = '<div><strong>Trial history</strong><output id="playing-time-range">0.00 s</output></div><div><button id="playing-history-left" type="button" aria-label="Earlier game, EEG and probabilities">←</button><input id="playing-history" type="range" min="0" max="0" step="any" value="0" aria-label="Shared game, EEG and probability timeline"><button id="playing-history-right" type="button" aria-label="Later game, EEG and probabilities">→</button></div><small id="playing-history-help">Both panels show the latest 1.5 seconds.</small>';
      gameSupport.append(history);
      for (const id of ["playing-participant", "playing-session-type", "playing-condition"]) {
        $(id).addEventListener("change", () => this.selectionChanged(id));
      }
      $("playing-recording").addEventListener("change", () => this.prepare());
      $("playing-playback-rate").addEventListener("change", () => this.prepare());
      $("playing-previous").addEventListener("click", () => this.choose("previous"));
      $("playing-next").addEventListener("click", () => this.choose("next"));
      $("playing-random").addEventListener("click", () => this.choose("random"));
      $("pause-button").addEventListener("click", () => this.pause());
      $("resume-button").addEventListener("click", () => this.resume());
      $("playing-history").addEventListener("input", () => this.pan(Number($("playing-history").value)));
      $("playing-history-left").addEventListener("click", () => this.pan(this.viewEnd - .5));
      $("playing-history-right").addEventListener("click", () => this.pan(this.viewEnd + .5));
      this.resize = new ResizeObserver(() => this.scheduleDraw());
      this.resize.observe($("eeg-waveform"));
      this.resize.observe($("probability-chart"));
      // The host updates its CSS display scale in the same resize event. Draw
      // after those listeners so canvas pixels follow the final displayed size.
      window.addEventListener("resize", () => this.scheduleDraw());
      document.addEventListener("fullscreenchange", () => this.scheduleDraw());
      document.addEventListener("focusmodechange", () => this.scheduleDraw());
      this.guide = new window.PresentationGuide(this);
      this.keyboard = window.KeyboardOnly ? new window.KeyboardOnly() : null;
    }
    get presenting() { return this.guide.active; }
    get keyboardSelected() { return !this.presenting && !!this.keyboard?.panel && $("playing-session-type").value === "keyboard"; }
    get recorded() { return this.presenting || $("playing-session-type").value === "pre_recorded"; }
    get participant() { return this.catalogue?.participants.find(p => p.id === $("playing-participant").value); }
    get matching() {
      if (this.presenting) return this.guide.entries.map(e => this.participant?.recordings.find(r => r.id === e.recording_id)).filter(Boolean);
      return (this.participant?.recordings || []).filter(r => $("playing-condition").value === "All"
        || r.condition === $("playing-condition").value);
    }
    get busy() { return ["FIXATION", "RUNNING"].includes(this.state); }
    get reviewing() { return ["PAUSED", "COMPLETE"].includes(this.state); }
    get timelineStart() { return this.presenting ? (this.session?.playback_start || 0) : 0; }
    get focused() {
      // The setup disclosure is shared by all session modes, independently of
      // Playing's inference lifecycle.
      return ["recording", "play", "presentation"].includes(document.body.dataset.experimentMode)
        && document.body.classList.contains("is-focus-mode");
    }
    showSetup(open) {
      clearTimeout(this.setupClose);
      open = this.focused && open;
      document.body.classList.toggle("playing-setup-open", open);
      this.setupBar.setAttribute("aria-expanded", String(open));
      this.setupHeader.inert = this.focused && !open;
    }
    deferSetupClose() {
      clearTimeout(this.setupClose);
      this.setupClose = setTimeout(() => {
        const hovered = this.setupHeader.matches(":hover") || this.setupBar.matches(":hover");
        const focused = this.setupKeyboard && (this.setupHeader.contains(document.activeElement) || document.activeElement === this.setupBar);
        if (!hovered && !focused) this.showSetup(false);
      }, 200);
    }
    syncSetup() {
      this.setupKeyboard = false;
      this.showSetup(false);
    }
    scheduleDraw() {
      if (!this.active || this.drawPending) return;
      this.drawPending = requestAnimationFrame(() => { this.drawPending = null; this.draw(); });
    }
    async activate() {
      this.active = true;
      this.syncSetup();
      if (this.keyboardSelected) {
        this.state = "KEYBOARD"; this.host.release(); this.visibility(); this.syncControls();
        await this.keyboard.activate(); return;
      }
      this.briefingSlot.append(this.briefingControl);
      this.state = "PREPARING";
      const generation = ++this.generation;
      this.visibility();
      this.syncControls();
      try {
        const [catalogue, recordingNames] = await Promise.all([
          this.host.api("/api/playing/catalogue"),
          fetch("static/data/recording-names.json?v=f75fc7ab2d3b")
            .then(response => response.ok ? response.json() : {})
            .catch(() => ({})),
        ]);
        if (!this.active || generation !== this.generation) return;
        this.catalogue = catalogue;
        this.recordingNames = recordingNames;
        $("playing-participant").replaceChildren(...this.catalogue.participants.map(p => new Option(p.label, p.id)));
        if (!this.participant?.available) throw new Error(this.participant?.error || "Participant catalogue unavailable");
        if (this.presenting) await this.guide.load();
        if (!this.active || generation !== this.generation) return;
        this.populate();
        if (!this.recorded) this.host.selectLive();
        await this.prepare();
      } catch (error) { if (generation === this.generation) this.unavailable(error); }
    }
    async cancel() {
      const generation = ++this.generation;
      await this.keyboard?.deactivate();
      window.clearTimeout(this.poll);
      this.stream?.close();
      this.stream = null;
      const id = this.session?.session_id;
      this.session = null;
      this.commandPending = false;
      this.host.release();
      $("pre-scenario-overlay").hidden = true;
      if (id) await this.host.api(`/api/session/${id}/stop`, {method: "POST", body: "{}"});
      return generation;
    }
    async deactivate() {
      this.active = false;
      this.syncSetup();
      this.briefingHome.after(this.briefingControl);
      await this.cancel();
      this.state = "IDLE";
      delete document.body.dataset.playingState;
      this.visibility();
      // Restore legacy backing sizes and labels along with its separate histories.
      for (const [id, height] of [["eeg-waveform", 228], ["probability-chart", 170]]) {
        $(id).width = 360; $(id).height = height;
      }
      document.querySelector(".eeg-card-heading h2").textContent = "EEG · last 1.8 s";
    }
    recordingLabel(recording) {
      const name = this.recordingNames?.[recording.design]
        || recording.design.replace(/^[A-Z]?\d+[a-z]?\s*·\s*/i, "");
      return `${name} · ${recording.session}-${String(recording.trial_number).padStart(2, "0")}`;
    }
    populate() {
      const old = $("playing-recording").value;
      $("playing-recording").replaceChildren(...this.matching.map(r => {
        const option = new Option(`${this.recordingLabel(r)}${r.available ? "" : " · unavailable"}`, r.id);
        option.title = `${r.session} · Trial ${r.trial_number} · ${r.design}`;
        return option;
      }));
      if (this.matching.some(r => r.id === old)) $("playing-recording").value = old;
    }
    async selectionChanged(id) {
      try {
        const generation = await this.cancel();
        if (!this.active || generation !== this.generation) return;
        this.state = "IDLE";
        this.visibility();
        if (this.keyboardSelected || !this.catalogue) { await this.activate(); return; }
        this.populate();
        if (id === "playing-session-type" && !this.recorded) this.host.selectLive();
        await this.prepare();
      } catch (error) { this.unavailable(error); }
    }
    async changeLive(change) {
      try {
        const generation = await this.cancel();
        if (!this.active || generation !== this.generation) return;
        change();
        await this.prepare();
      } catch (error) { this.unavailable(error); }
    }
    async choose(mode) {
      const choices = this.matching;
      if (!choices.length) return;
      const current = $("playing-recording").value;
      const index = choices.findIndex(r => r.id === current);
      if (mode === "previous" && index <= 0) return;
      const alternatives = choices.filter(r => r.id !== current);
      const pool = alternatives.length ? alternatives : choices;
      const next = mode === "random" ? pool[Math.floor(Math.random() * pool.length)]
        : mode === "previous" ? choices[index - 1] : choices[(index + 1) % choices.length];
      $("playing-recording").value = next.id;
      await this.prepare();
    }
    async prepare() {
      if (this.keyboardSelected) return;
      let generation;
      try {
        generation = await this.cancel();
        if (!this.active || generation !== this.generation) return;
        this.state = "PREPARING";
        this.guide.reset();
        this.raw = []; this.probabilities = []; this.gameHistory = []; this.elapsed = 0; this.viewEnd = 0;
        for (const id of ["rpe-value", "spe-value", "nonpe-value"]) $(id).textContent = "—";
        $("decoded-class").textContent = "Unavailable";
        $("decoder-confidence").textContent = "Preparing recorded EEG";
        this.visibility(); this.syncControls(); this.draw();
        if (this.presenting && !this.matching.length) throw new Error("No trials in this presentation set. Use Edit presentation set to add recordings.");
        const chosen = this.matching.find(r => r.id === $("playing-recording").value);
        if (this.recorded && !chosen?.available) throw new Error(chosen?.error || "Original recording unavailable");
        const request = {experiment_mode: this.presenting ? "presentation" : "play",
          playing_session_type: this.recorded ? "pre_recorded" : "real_time",
          ...(this.presenting ? {presentation_entry: this.guide.entry} : {}),
          participant_id: $("playing-participant").value,
          ...(this.recorded ? {recorded_source_id: chosen.id,
            playback_rate: Number($("playing-playback-rate").value)} : this.host.liveSelection())};
        const session = await this.host.api("/api/session", {method: "POST", body: JSON.stringify(request)});
        if (!this.active || generation !== this.generation) {
          await this.host.api(`/api/session/${session.session_id}/stop`, {method: "POST", body: "{}"}); return;
        }
        this.session = session;
        this.gameHistory.push(this.host.mount(session));
        await this.host.ready(() => !this.active || generation !== this.generation);
        if (!this.active || generation !== this.generation) return;
        this.applyState(session);
        this.stream = window.StaticReplay ? window.StaticReplay.stream(session.session_id)
          : new EventSource(`/api/session/${session.session_id}/playing-events`);
        this.stream.addEventListener("playing_state", event => {
          if (generation === this.generation) this.applyState(JSON.parse(event.data));
        });
        this.stream.addEventListener("playing_frame", event => {
          if (generation === this.generation) {
            try { this.frame(JSON.parse(event.data)); } catch (error) { this.playbackCommand("pause"); this.unavailable(error); }
          }
        });
        this.stream.onerror = () => {
          if (generation === this.generation && !["COMPLETE", "UNAVAILABLE"].includes(this.state))
            $("playback-status").textContent = "Playback connection interrupted · reconnecting";
        };
        const pollPreparation = async () => {
          if (generation !== this.generation || this.state !== "PREPARING") return;
          try {
            const status = await this.host.api(`/api/session/${session.session_id}`);
            if (generation !== this.generation) return;
            this.applyState(status);
            this.poll = setTimeout(pollPreparation, 500);
          } catch (error) { if (generation === this.generation) this.unavailable(error); }
        };
        this.poll = setTimeout(pollPreparation, 500);
      } catch (error) { if (this.active && generation === this.generation) this.unavailable(error); }
    }
    async confirm() {
      if (this.state !== "BRIEFING" || this.starting) return;
      const generation = this.generation;
      this.starting = true; this.syncControls();
      try {
        const state = await this.host.api(`/api/session/${this.session.session_id}/hint-confirmed`, {method: "POST", body: "{}"});
        if (generation === this.generation) this.applyState(state);
      } catch (error) {
        if (generation === this.generation) $("playback-status").textContent = error.message;
      } finally { this.starting = false; this.syncControls(); }
    }
    async playbackCommand(action, payload = {}) {
      if (!this.active || !this.recorded || !this.session || this.commandPending) return;
      const generation = this.generation;
      this.commandPending = true; this.syncControls();
      try {
        // State changes arrive on the ordered event stream, after all preceding
        // game/EEG frames. An HTTP response must not overtake those frames.
        await this.host.api(`/api/session/${this.session.session_id}/${action}`,
          {method: "POST", body: JSON.stringify(payload)});
      } catch (error) {
        if (generation === this.generation) {
          this.commandPending = false; this.syncControls();
          $("playback-status").textContent = error.message;
        }
      }
    }
    pause() { if (this.busy) return this.playbackCommand("pause"); }
    resume() {
      if (this.reviewing && this.viewEnd < this.session.duration)
        return this.playbackCommand("resume", {source_time: this.viewEnd});
    }
    unavailable(error) {
      this.state = "UNAVAILABLE";
      this.stream?.close();
      this.host.release();
      $("playback-status").textContent = `Unavailable · ${error.message || error}`;
      $("decoder-confidence").textContent = "EEG or saved decoder unavailable";
      this.host.status("Playing unavailable", false);
      this.syncControls();
    }
    applyState(session) {
      if (this.session && session.revision < this.session.revision) return;
      const previousRevision = this.session?.revision;
      this.session = session;
      this.state = session.lifecycle_state;
      if (["PREPARING", "BRIEFING"].includes(this.state)) this.elapsed = this.viewEnd = session.elapsed;
      this.commandPending = false;
      if (session.error) { this.unavailable(session.error); return; }
      if (this.state === "RESTORING" && previousRevision !== session.revision) {
        this.elapsed = this.viewEnd = session.elapsed;
        this.raw = this.raw.filter(row => row.time <= this.elapsed);
        this.probabilities = this.probabilities.filter(row => row.sample_elapsed <= this.elapsed);
        this.gameHistory = this.gameHistory.filter(row => row.at <= this.elapsed);
        this.showGame(this.elapsed, true); this.draw();
      }
      const text = {PREPARING: `Preparing EEG prefix · ${Math.round(session.preparation_progress * 100)}%`,
        BRIEFING: "Read the Briefing, then confirm to begin", FIXATION: "Fixation", RUNNING: "Watch the collaboration",
        PAUSED: "Paused · move Trial history, then Resume", RESTORING: "Restoring EEG at the selected time…",
        COMPLETE: this.presenting ? "Complete · Replay, Previous, or Next" : "Complete · Replay, Next, or Random"}[this.state] || this.state;
      $("playback-status").textContent = text;
      this.host.status(text, this.state !== "PREPARING");
      if (this.state === "BRIEFING") $("decoder-confidence").textContent = "";
      if (this.state === "RESTORING") $("decoder-confidence").textContent = "Restoring causal decoder state";
      if (this.state === "COMPLETE" && !this.recorded) this.stream?.close();
      if (this.reviewing) { this.elapsed = session.elapsed; this.pan(this.elapsed); }
      this.guide.update(session.presentation);
      this.readout(this.viewEnd); this.draw();
      this.syncControls();
    }
    frame(frame) {
      if (frame.revision !== this.session.revision) return;
      this.elapsed = frame.elapsed;
      this.state = frame.state;
      frame.timestamps.forEach((time, i) => this.raw.push({time, values: frame.samples[i]}));
      this.probabilities.push(...frame.predictions.map(row => ({...row, display_elapsed: frame.elapsed})));
      for (const action of frame.actions) {
        const snapshot = this.host.action(action, this.recorded);
        if (snapshot) this.gameHistory.push(snapshot);
      }
      // Recorded animation uses the same source time as the EEG, including
      // partial moves after a seek. No independent tween can run while paused.
      if (this.recorded) this.showGame(this.elapsed);
      $("pre-scenario-overlay").hidden = this.state !== "FIXATION";
      this.viewEnd = this.elapsed;
      this.readout(this.viewEnd); this.guide.update(frame.presentation);
      $("playback-status").textContent = this.state === "FIXATION" ? "Fixation" : "Watch the collaboration";
      this.syncControls(); this.draw();
    }
    visibility() {
      const active = this.active;
      $("briefing-title").classList.toggle("visually-hidden", !active);
      document.body.dataset.playingSession = active ? $("playing-session-type").value : "";
      document.querySelectorAll("[data-playing-field]").forEach(e => e.hidden = !active);
      $("playing-participant").closest("label").hidden = !active || this.keyboardSelected;
      document.querySelectorAll("[data-playing-recorded]").forEach(e => e.hidden = !active || !this.recorded);
      for (const id of ["playing-trial-navigation", "playing-next", "playing-random"]) $(id).hidden = !active || !this.recorded;
      $("playing-previous").hidden = !this.presenting;
      if (!active) for (const id of ["pause-button", "resume-button"]) $(id).hidden = true;
      if (!active) {
        this.guide.visibility();
        document.querySelector(".lsl-marker-controls").hidden = false;
        document.querySelector(".speed-hover-control").hidden = false;
        $("eeg-connect").hidden = false;
        return;
      }
      if (this.keyboardSelected) {
        for (const id of ["participant-id", "class-filter", "scenario-select", "layout-select", "eeg-stream-select"])
          $(id).closest("label").hidden = true;
        for (const id of ["decoder-field", "eeg-top-connect", "eeg-connect"]) $(id).hidden = true;
        this.guide.visibility();
        return;
      }
      $("participant-id").closest("label").hidden = true;
      $("decoder-field").hidden = true;
      for (const id of ["class-filter", "scenario-select", "layout-select", "eeg-stream-select"])
        $(id).closest("label").hidden = this.recorded;
      $("eeg-top-connect").hidden = this.recorded;
      $("eeg-connect").hidden = this.recorded;
      document.querySelector(".lsl-marker-controls").hidden = true;
      document.querySelector(".speed-hover-control").hidden = this.recorded;
      document.querySelector(".eeg-card-heading h2").textContent = "EEG · 1.5 s";
      $("eeg-waveform").setAttribute("aria-label", "Six-channel EEG · shared 1.5-second timeline");
      $("probability-chart").setAttribute("aria-label", "RPE, SPE and nonPE probabilities · shared 1.5-second timeline");
      this.guide.visibility();
      this.status(this.host.eegStatus());
    }
    status(status) {
      if (!this.active || this.keyboardSelected) return;
      if (this.recorded) {
        $("eeg-connection").textContent = "Recorded EEG";
        $("eeg-quality").textContent = "128 Hz · 14 channels";
        $("eeg-quality-detail").textContent = window.StaticReplay
          ? "Recorded signals and saved predictions · replay only"
          : "Original samples · causal decoding during playback";
        $("eeg-connection").closest(".status-chip").classList.remove("is-alert");
      } else {
        $("eeg-connection").textContent = status?.mode === "live" ? status.status : "Live EEG required";
        $("eeg-quality").textContent = "128 Hz · 14 channels";
        $("eeg-quality-detail").textContent = "Mean of five saved session models · no retraining";
      }
    }
    syncControls() {
      if (!this.active) return;
      if (this.keyboardSelected) { document.body.dataset.playingState = "KEYBOARD"; $("experiment-mode").disabled = false; return; }
      document.body.dataset.playingState = this.state;
      $("start-button").hidden = true;
      $("start-recording-session").hidden = true;
      $("reset-button").textContent = this.busy || ["PREPARING", "RESTORING"].includes(this.state) ? "Cancel" : "Replay";
      $("reset-button").disabled = false;
      $("pause-button").hidden = !this.recorded || !this.busy;
      $("pause-button").disabled = !this.busy || this.commandPending;
      $("resume-button").hidden = !this.recorded || !(this.reviewing || this.state === "RESTORING");
      $("resume-button").disabled = !this.reviewing || this.commandPending || this.viewEnd >= this.session?.duration;
      $("confirm-hint").hidden = !["PREPARING", "BRIEFING"].includes(this.state);
      $("confirm-hint").disabled = this.state !== "BRIEFING" || this.starting;
      $("confirm-hint").textContent = "I’ve read the Briefing";
      $("playing-playback-rate").disabled = this.busy || ["PAUSED", "RESTORING"].includes(this.state);
      document.querySelector(".hint-control").classList.toggle("hint-required", ["PREPARING", "BRIEFING"].includes(this.state));
      $("trial-briefing").setAttribute("role", "region");
      $("control-state").textContent = this.state === "BRIEFING" ? "Ready" : this.state.toLowerCase();
      $("session-progress").textContent = this.recorded ? `${this.matching.length} picked recordings` : "Live EEG";
      $("resume-button").textContent = this.presenting ? "Continue" : "Resume";
      // Selectors stay available so changing source always cancels obsolete work.
      for (const id of ["experiment-mode", "class-filter", "scenario-select", "layout-select", "movement-speed", "eeg-stream-select", "eeg-top-connect", "eeg-connect"])
        $(id).disabled = id === "movement-speed" && (this.recorded || this.starting
          || this.busy || ["PAUSED", "RESTORING"].includes(this.state));
      $("playing-next").disabled = $("playing-random").disabled = !this.matching.length;
      $("playing-previous").disabled = this.matching.findIndex(r => r.id === $("playing-recording").value) <= 0;
      for (const id of ["playing-history", "playing-history-left", "playing-history-right"])
        $(id).disabled = !this.reviewing || this.elapsed <= 0 || this.commandPending;
      this.guide.update();
      $("playing-history-help").textContent = this.presenting ? "Shaded bands: correct PE · ring: selected pause point. Pause to seek; Continue resumes all views." : this.reviewing
        ? this.recorded ? "Move all three views together, then Resume from the selected time." : "Scroll game, EEG and probabilities together."
        : this.recorded ? "Pause to move Trial history, then Resume. Both plots show 1.5 seconds."
        : "Both panels show the latest 1.5 seconds.";
    }
    async reset() {
      if (this.busy || ["PREPARING", "RESTORING"].includes(this.state)) {
        try { await this.cancel(); this.state = "CANCELLED"; this.syncControls(); }
        catch (error) { this.unavailable(error); }
      } else await this.prepare();
    }
    pan(end) {
      if (!this.reviewing || this.commandPending) return;
      this.viewEnd = Math.max(this.timelineStart, Math.min(this.elapsed, end)); this.draw();
      const time = Math.min(this.elapsed, this.viewEnd);
      this.showGame(time);
      const fixation = time < this.session.fixation_seconds;
      $("pre-scenario-overlay").hidden = !fixation;
      $("playback-status").textContent = `${this.state === "PAUSED" ? "Paused" : "Game"} at ${time.toFixed(2)} s${fixation ? " · Fixation" : ""}`;
      this.readout(this.viewEnd); this.guide.update();
      this.syncControls();
    }
    readout(time) {
      if (['PREPARING', 'BRIEFING', 'RESTORING', 'UNAVAILABLE', 'CANCELLED', 'IDLE'].includes(this.state)) return;
      const fixation = this.recorded && this.session && time < this.session.fixation_seconds
        && !['IDLE', 'PREPARING', 'BRIEFING', 'UNAVAILABLE', 'CANCELLED'].includes(this.state);
      const result = this.probabilities.filter(r => r.sample_elapsed <= time
        && (r.display_elapsed ?? r.available_elapsed) <= time + 1e-9 && r.sample_elapsed >= time - WINDOW
        && (!this.recorded || r.sample_elapsed >= this.session.fixation_seconds)).at(-1);
      for (const [i, id] of ['nonpe-value', 'spe-value', 'rpe-value'].entries())
        $(id).textContent = fixation ? '33.3%' : result?.probabilities?.[i] == null ? '—' : `${(result.probabilities[i] * 100).toFixed(1)}%`;
      $('decoded-class').textContent = fixation ? 'Fixation' : result?.decoded_class || 'UNAVAILABLE';
      $('decoder-confidence').textContent = fixation ? 'Equal baseline · display only' : result?.valid
        ? '10 pp margin · observation only' : result?.reason === 'missing_eeg' ? 'EEG unavailable' : 'Waiting for a valid prediction';
    }
    showGame(time, restore = false) {
      const snapshot = this.gameHistory.filter(row => row.at <= time).at(-1);
      if (snapshot) this.host.showHistory(snapshot, time, this.session.playback.animation_ms || 375, restore);
    }
    canvas(id) {
      const canvas = $(id), width = canvas.clientWidth, height = canvas.clientHeight;
      const ratio = (canvas.getBoundingClientRect().width / Math.max(1, width)) * (window.devicePixelRatio || 1);
      const pw = Math.max(1, Math.round(width * ratio)), ph = Math.max(1, Math.round(height * ratio));
      if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
      const ctx = canvas.getContext("2d"); ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
      const style = getComputedStyle(canvas);
      return {ctx, width, height, text: style.color, grid: style.borderTopColor, surface: style.backgroundColor};
    }
    draw() {
      if (!this.active || this.keyboardSelected) return;
      const start = this.presenting ? this.timelineStart : Math.max(0, this.viewEnd - WINDOW);
      const span = this.presenting ? Math.max(.001, (this.session?.duration || WINDOW) - start) : WINDOW;
      const axes = (id, probabilities) => {
        const {ctx, width, height, text, grid, surface} = this.canvas(id);
        const left = 36, right = width - 10, top = 12, bottom = height - 25;
        ctx.font = '11px system-ui'; ctx.lineWidth = 1;
        for (let i = 0; i <= 3; i++) {
          const x = left + (right - left) * i / 3;
          ctx.strokeStyle = grid; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
          ctx.fillStyle = text; ctx.textAlign = i === 3 ? 'right' : 'left';
          ctx.fillText(`${(start + i * span / 3).toFixed(2)} s`, x, height - 6);
        }
        if (probabilities) for (const value of [0, .5, 1]) {
          const y = bottom - value * (bottom - top);
          ctx.strokeStyle = grid; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
          ctx.fillStyle = text; ctx.textAlign = 'left'; ctx.fillText(`${Math.round(value * 100)}`, 3, y + 3);
        }
        if (this.presenting || this.viewEnd < WINDOW) {
          const cursor = left + (this.viewEnd - start) / span * (right - left);
          ctx.strokeStyle = text; ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.moveTo(cursor, top); ctx.lineTo(cursor, bottom); ctx.stroke(); ctx.setLineDash([]);
        }
        return {ctx, top, bottom, left, right, text, surface, x: time => left + (time - start) / span * (right - left)};
      };
      const p = axes("probability-chart", true);
      const rows = this.probabilities.filter(r => r.sample_elapsed >= start && r.sample_elapsed <= this.viewEnd
        && (r.display_elapsed ?? r.available_elapsed) <= this.viewEnd + 1e-9 && (!this.recorded || r.sample_elapsed >= this.session?.fixation_seconds));
      if (this.presenting) for (const interval of window.PresentationGuide.correctIntervals(rows)) {
        p.ctx.fillStyle = colorsForEvidence(interval.label, .12);
        p.ctx.fillRect(p.x(interval.start), p.top,
          Math.max(2, p.x(interval.end) - p.x(interval.start)), p.bottom - p.top);
      }
      if (this.recorded && !this.presenting && this.session && !['IDLE', 'PREPARING', 'BRIEFING', 'CANCELLED', 'UNAVAILABLE'].includes(this.state)) {
        const end = Math.min(this.viewEnd, this.session.fixation_seconds);
        if (end >= start) {
          p.ctx.strokeStyle = '#7b8188'; p.ctx.lineWidth = 2; p.ctx.setLineDash([3, 3]);
          const y = p.bottom - (p.bottom - p.top) / 3;
          p.ctx.beginPath(); p.ctx.moveTo(p.x(start), y); p.ctx.lineTo(p.x(end), y); p.ctx.stroke(); p.ctx.setLineDash([]);
        }
      }
      COLORS.forEach((color, channel) => {
        p.ctx.strokeStyle = color; p.ctx.lineWidth = 2; p.ctx.beginPath(); let last = null;
        for (const row of rows) {
          const value = row.probabilities?.[channel], t = row.sample_elapsed;
          if (value == null || !Number.isFinite(value)) { last = null; continue; }
          const x = p.x(t), y = p.bottom - value * (p.bottom - p.top);
          if (last == null || t - last > .094) p.ctx.moveTo(x, y); else p.ctx.lineTo(x, y);
          last = t;
        }
        p.ctx.stroke();
      });
      const e = axes("eeg-waveform", false);
      if (this.presenting && this.guide.info) {
        const info = this.guide.info;
        if (info.critical_onset <= this.viewEnd) for (const chart of [p, e]) {
          chart.ctx.strokeStyle = '#63765b'; chart.ctx.setLineDash([4, 3]);
          chart.ctx.beginPath(); chart.ctx.moveTo(chart.x(info.critical_onset), chart.top);
          chart.ctx.lineTo(chart.x(info.critical_onset), chart.bottom); chart.ctx.stroke(); chart.ctx.setLineDash([]);
        }
        const evidence = info.evidence;
        if (evidence && evidence.at <= this.viewEnd && evidence.available_elapsed <= this.viewEnd + 1e-9 && this.viewEnd >= info.action_stop) {
          p.ctx.strokeStyle = COLORS[evidence.label]; p.ctx.fillStyle = p.surface; p.ctx.lineWidth = 3;
          p.ctx.beginPath(); p.ctx.arc(p.x(evidence.at), p.bottom - evidence.probability * (p.bottom - p.top), 5, 0, Math.PI * 2); p.ctx.fill(); p.ctx.stroke();
        }
      }
      const raw = this.raw.filter(r => r.time >= start && r.time <= this.viewEnd);
      CHANNEL_INDICES.forEach((channel, index) => {
        const values = raw.map(r => r.values[channel]).filter(v => v != null && Number.isFinite(v)).sort((a, b) => a - b);
        const median = values[Math.floor(values.length / 2)] || 0;
        const scale = Math.max(25, Math.min(250, (values.at(-1) - values[0]) || 25));
        const rowHeight = (e.bottom - e.top) / 6, center = e.top + (index + .5) * rowHeight;
        e.ctx.fillStyle = e.text; e.ctx.textAlign = 'left'; e.ctx.fillText(CHANNELS[index], 2, center + 3);
        e.ctx.strokeStyle = e.text; e.ctx.lineWidth = 1.15; e.ctx.beginPath(); let last = null;
        for (const row of raw) {
          const value = row.values[channel];
          if (value == null || !Number.isFinite(value)) { last = null; continue; }
          const x = e.x(row.time), y = center - Math.max(-.45, Math.min(.45, (value - median) / scale)) * rowHeight;
          if (last == null || row.time - last > 1.5 / 128) e.ctx.moveTo(x, y); else e.ctx.lineTo(x, y);
          last = row.time;
        }
        e.ctx.stroke();
      });
      $("playing-history").min = String(this.timelineStart);
      // Keep a fixed full-trial scale; elapsed limits seeking, not the axis.
      $("playing-history").max = String(Math.max(this.timelineStart, this.session?.duration ?? this.elapsed));
      $("playing-history").value = String(this.viewEnd);
      $("playing-time-range").textContent = `${this.viewEnd.toFixed(2)} s · ${start.toFixed(2)}–${(start + span).toFixed(2)} s`;
    }
  };
})();
