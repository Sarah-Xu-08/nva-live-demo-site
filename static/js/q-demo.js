(function () {
  "use strict";

  // Re-enable the Preview mode in the web UI without changing its playback/API.
  const PREVIEW_MODE_ENABLED = false;
  const PRE_SCENARIO_FIXATION_MS = 2000;
  const MOCK_EEG_SOURCE = "mock-eeg";
  const DISPLAY_REFERENCE = { width: 1440, height: 900, gameHeight: 450 };

  const LAYOUTS = {
    compact_demo: { label: "Loading", grid: ["XXXXXXX", "X1   2X", "XXXXXXX"] },
  };
  const elements = {
    systemStatus: document.getElementById("system-status"),
    controlState: document.getElementById("control-state"),
    start: document.getElementById("start-button"),
    startRecording: document.getElementById("start-recording-session"),
    recordingCounts: document.getElementById("recording-counts"),
    recordingNonpeCount: document.getElementById("recording-nonpe-count"),
    recordingPeCount: document.getElementById("recording-pe-count"),
    recordingSpeed: document.getElementById("recording-speed"),
    recordingCountError: document.getElementById("recording-count-error"),
    instructionsEnabled: document.getElementById("instructions-enabled"),
    ratingsEnabled: document.getElementById("ratings-enabled"),
    sessionProgress: document.getElementById("session-progress"),
    confirmHint: document.getElementById("confirm-hint"),
    hintControl: document.querySelector(".hint-control"),
    briefing: document.getElementById("trial-briefing"),
    pause: document.getElementById("pause-button"),
    resume: document.getElementById("resume-button"),
    reset: document.getElementById("reset-button"),
    valueMapToggle: document.getElementById("value-map-toggle"),
    heatLegend: document.getElementById("heat-legend"),
    speed: document.getElementById("movement-speed"),
    speedValue: document.getElementById("movement-speed-value"),
    speedTiming: document.getElementById("movement-speed-timing"),
    eegConnection: document.getElementById("eeg-connection"),
    decoderIntent: document.getElementById("decoder-intent"),
    decoderConfidence: document.getElementById("decoder-confidence"),
    decoderAction: document.getElementById("decoder-action"),
    decoderSource: document.getElementById("decoder-source"),
    revisions: document.getElementById("revision-count"),
    sessionLabel: document.getElementById("session-label"),
    container: document.getElementById("overcooked"),
    stage: document.querySelector(".stage"),
    displaySurface: document.querySelector(".display-surface"),
    gameHeading: document.querySelector(".game-heading"),
    focusModeToggle: document.getElementById("focus-mode-toggle"),
    preScenarioOverlay: document.getElementById("pre-scenario-overlay"),
    layout: document.getElementById("layout-select"),
    category: document.getElementById("trial-category"),
    scenario: document.getElementById("scenario-select"),
    exampleSelectLabel: document.getElementById("example-select-label"),
    playbackStatus: document.getElementById("playback-status"),
    exampleReviewControl: document.getElementById("example-review-control"),
    exampleClass: document.getElementById("example-class"),
    exampleTiming: document.getElementById("example-timing"),
    exampleRepair: document.getElementById("example-repair"),
    exampleEvidence: document.getElementById("example-evidence"),
    orderList: document.getElementById("order-list"),
    mismatchPanel: document.getElementById("mismatch-panel"),
    mismatchType: document.getElementById("mismatch-type"),
    mismatchCount: document.getElementById("mismatch-count"),
    mismatchTitle: document.getElementById("mismatch-title"),
    mismatchDetail: document.getElementById("mismatch-detail"),
    mismatchTile: document.getElementById("mismatch-tile"),
    mismatchResume: document.getElementById("mismatch-resume"),
    briefingTitle: document.getElementById("briefing-title"),
    briefingExpectation: document.getElementById("briefing-expectation"),
    classFilter: document.getElementById("class-filter"),
    experimentMode: document.getElementById("experiment-mode"),
    participantId: document.getElementById("participant-id"),
    decoderSelect: document.getElementById("decoder-select"),
    decoderField: document.getElementById("decoder-field"),
    decoderPanel: document.querySelector(".decoder-panel-card"),
    rawEegPanel: document.getElementById("raw-eeg-panel"),
    rawEegControls: document.getElementById("recording-eeg-controls"),
    rawEegToggle: document.getElementById("raw-eeg-toggle"),
    probabilityToggle: document.getElementById("probability-toggle"),
    eegConnect: document.getElementById("eeg-connect"),
    eegTopConnect: document.getElementById("eeg-top-connect"),
    eegStreamSelect: document.getElementById("eeg-stream-select"),
    eegBadge: document.getElementById("eeg-badge"),
    eegStreamLabel: document.getElementById("eeg-stream-label"),
    eegQuality: document.getElementById("eeg-quality"),
    eegQualityDetail: document.getElementById("eeg-quality-detail"),
    eegBuffer: document.getElementById("eeg-buffer"),
    eegDecoderStatus: document.getElementById("eeg-decoder-status"),
    eegSampleRate: document.getElementById("eeg-sample-rate"),
    eegWaveform: document.getElementById("eeg-waveform"),
    probabilityChart: document.getElementById("probability-chart"),
    decodedClass: document.getElementById("decoded-class"),
    rpeValue: document.getElementById("rpe-value"),
    speValue: document.getElementById("spe-value"),
    trialPhase: document.getElementById("trial-phase-badge"),
    undecidedPanel: document.getElementById("undecided-panel"),
    undecidedReason: document.getElementById("undecided-reason"),
    retryEvent: document.getElementById("retry-event"),
  };

  if (PREVIEW_MODE_ENABLED) {
    elements.experimentMode.prepend(new Option("Preview · no EEG needed", "preview", true, true));
    document.body.dataset.experimentMode = "preview";
  }

  const runtime = {
    displayScale: 1,
    game: null,
    state: null,
    sessionId: null,
    librarySession: false,
    trialId: null,
    trialNumber: 0,
    trialCount: 0,
    hintConfirmed: false,
    instructionsEnabled: false,
    ratingsEnabled: false,
    trialsWatched: 0,
    responsesSubmitted: 0,
    stopPending: false,
    trajectoryLength: 0,
    tick: 0,
    score: 0,
    revisions: 0,
    running: false,
    paused: false,
    pausedForMismatch: false,
    pausedMismatchId: null,
    pendingAck: null,
    mismatchCount: 0,
    mismatchMarker: null,
    timer: null,
    requestInFlight: false,
    heatmapTiles: new Map(),
    valueMapVisible: true,
    rawEegVisible: true,
    playingRawEegVisible: true,
    playingProbabilityVisible: true,
    layoutName: "random3_symmetric",
    scenarioName: "split_work",
    tileSize: 104,
    scenarios: [],
    recordingSessions: [],
    recordingSessionId: "custom_critical",
    categories: [],
    categoryId: "recording_library",
    classes: [],
    layouts: [],
    playbackSpeeds: [],
    selectedScenarioId: null,
    selectedScenario: null,
    trialMode: false,
    trialPhase: "READY",
    eventSource: null,
    trialPoll: null,
    signalHistory: Array.from({ length: 6 }, () => []),
    signalChannels: ["AF3", "F7", "F3", "FC5", "T7", "O1"],
    probabilityHistory: [],
    eventWindowResults: new Map(),
    decoderResultHandled: false,
    experimentMode: elements.experimentMode.value,
    editorOpen: false,
    playback: null,
    clock: null,
    correctionDelayMs: null,
    arming: false,
    runId: null,
    autoEegPause: false,
    eegStatus: null,
    eegReconnectTimer: null,
    eegScanTimer: null,
    eegScanning: false,
    eegConnecting: false,
    eegSourceChoice: null,
    eegSourceOptionsKey: null,
    eegAvailableStreams: [],
    decoders: [],
  };

  const RESULT_THEME_CLASSES = [
    "result-nonpe", "result-rpe", "result-spe", "result-rpe-spe",
    "result-undecided", "result-pending",
  ];
  const RESULT_PRESENTATIONS = {
    nonPE: {
      title: "nonPE",
      explanation: "The EEG result suggests that your expectation and the AI's current goal and action are aligned.",
    },
    RPE: {
      title: "RPE",
      explanation: "The EEG result suggests that the AI's current goal differs from what you expected.",
    },
    SPE: {
      title: "SPE",
      explanation: "The EEG result suggests that you and the AI share the same goal, but the AI's immediate action may conflict with yours.",
    },
    "RPE+SPE": {
      title: "RPE + SPE",
      explanation: "The EEG result suggests that both the AI's goal and its immediate action differ from what you expected.",
    },
    UNDECIDED: {
      title: "Undecided",
      explanation: "The EEG signal did not contain enough usable information to choose a result.",
    },
  };

  function resultThemeClass(result) {
    if (result === "RPE+SPE") return "result-rpe-spe";
    if (result === "RPE") return "result-rpe";
    if (result === "SPE") return "result-spe";
    if (result === "nonPE") return "result-nonpe";
    if (result === "UNDECIDED") return "result-undecided";
    return "result-pending";
  }

  function setResultTheme(element, result) {
    if (!element) return;
    element.classList.remove(...RESULT_THEME_CLASSES);
    element.classList.add(resultThemeClass(result));
  }

  function showDecodedResult(result, supplementalText) {
    const presentation = RESULT_PRESENTATIONS[result] || RESULT_PRESENTATIONS.UNDECIDED;
    setResultTheme(elements.mismatchPanel, result);
    setResultTheme(elements.decodedClass, result);
    elements.mismatchType.textContent = "EEG event result";
    elements.mismatchCount.textContent = "last 1.8 s";
    elements.mismatchTitle.textContent = presentation.title;
    elements.mismatchDetail.textContent = presentation.explanation;
    elements.mismatchTile.textContent = supplementalText || "";
    elements.mismatchResume.hidden = true;
    elements.mismatchPanel.hidden = false;
  }

  function setSystemStatus(text, online) {
    elements.systemStatus.lastChild.textContent = ` ${text}`;
    elements.systemStatus.classList.toggle("online", Boolean(online));
  }

  function recordingSelection() {
    const profile = runtime.recordingSessions?.find(item => item.id === runtime.recordingSessionId);
    if (!profile) return {profile, valid: false, total: 0};
    if (!profile?.custom_counts) return {profile, valid: true,
      total: profile?.trial_count ?? runtime.scenarios.filter(scenario => !scenario.preview_only).length};
    const values = [elements.recordingNonpeCount.value, elements.recordingPeCount.value];
    const counts = {nonPE: Number(values[0]), pe_each: Number(values[1])};
    const total = counts.nonPE + 2 * counts.pe_each;
    const valid = values.every(value => /^\d+$/.test(value))
      && Object.values(counts).every(value => Number.isSafeInteger(value) && value >= 0)
      && Number.isSafeInteger(total) && total > 0;
    return {profile, counts, valid, total: valid ? total : 0};
  }

  function syncControls() {
    if (["play", "presentation"].includes(runtime.experimentMode) && playing.active) { playing.syncControls(); return; }
    const paused = runtime.running && runtime.paused;
    const recording = runtime.experimentMode === "recording";
    const sessionActive = runtime.librarySession && Boolean(runtime.sessionId);
    const busy = runtime.running || runtime.arming || sessionActive;
    elements.start.disabled = runtime.running || runtime.arming || !runtime.selectedScenario
      || runtime.stopPending || (recording && (!sessionActive || !runtime.hintConfirmed));
    elements.start.hidden = recording;
    elements.startRecording.hidden = !recording || sessionActive;
    const selection = recordingSelection();
    const recordingCount = selection.total;
    elements.recordingCounts.hidden = !recording || !selection.profile?.custom_counts;
    elements.recordingNonpeCount.disabled = busy;
    elements.recordingPeCount.disabled = busy;
    elements.recordingCountError.hidden = !recording || !selection.profile?.custom_counts || selection.valid;
    elements.startRecording.disabled = busy || !recordingCount || !selection.valid
      || selection.profile?.available === false;
    const current = recording ? runtime.trialNumber || 0 : runtime.selectedScenario ? 1 : 0;
    const total = recording ? runtime.trialCount || recordingCount : runtime.selectedScenario ? 1 : 0;
    elements.sessionProgress.textContent = `${current}/${total}`;
    elements.reset.textContent = sessionActive ? "End session" : "Reset";
    const needsHint = sessionActive && !runtime.running && !runtime.stopPending
      && ["HINT", "READY"].includes(runtime.trialPhase);
    elements.hintControl.classList.toggle("hint-required", needsHint);
    elements.briefing.setAttribute("role", needsHint ? "region" : "tooltip");
    elements.confirmHint.hidden = !needsHint;
    elements.confirmHint.disabled = runtime.arming;
    elements.confirmHint.textContent = runtime.hintConfirmed && !runtime.running
      ? "Try starting trial again" : "I’ve read the Briefing";
    elements.reset.disabled = runtime.arming;
    elements.layout.disabled = busy;
    elements.category.disabled = busy;
    elements.instructionsEnabled.disabled = busy;
    elements.ratingsEnabled.disabled = busy;
    window.ParticipantGuide?.sync({
      recording,
      instructionsEnabled: sessionActive ? runtime.instructionsEnabled : elements.instructionsEnabled.checked,
      ratingsEnabled: sessionActive ? runtime.ratingsEnabled : elements.ratingsEnabled.checked,
      unavailable: runtime.running || runtime.arming || runtime.stopPending,
      endUnavailable: runtime.arming,
      response: sessionActive && runtime.trialPhase === "RESPONSE",
    });
    elements.scenario.disabled = busy;
    elements.speed.disabled = busy;
    elements.recordingSpeed.disabled = busy;
    elements.recordingSpeed.value = elements.speed.value;
    elements.classFilter.disabled = busy;
    elements.experimentMode.disabled = busy;
    elements.participantId.disabled = busy;
    elements.decoderSelect.disabled = busy;
    elements.eegTopConnect.disabled = busy || runtime.eegConnecting;
    elements.eegConnect.disabled = busy || runtime.eegConnecting;
    elements.eegStreamSelect.disabled = busy || runtime.eegConnecting;
    elements.pause.disabled = true;
    elements.resume.disabled = true;
    elements.controlState.textContent = runtime.autoEegPause
      ? "EEG reconnecting"
      : runtime.running ? "Running" : sessionActive ? "Recording EEG" : "Ready";
    const status = elements.controlState.parentElement;
    status.classList.toggle("is-running", runtime.running && !paused);
    status.classList.toggle("is-paused", paused);
  }

  async function api(path, options) {
    if (window.StaticReplay) return window.StaticReplay.api(path, options);
    const response = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || `${response.status} ${response.statusText}`);
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  function initializeGame() {
    if (!window.Overcooked) {
      throw new Error("Overcooked runtime did not load");
    }
    if (runtime.game) runtime.game.close();
    runtime.heatmapTiles = new Map();
    runtime.mismatchMarker = null;
    elements.container.innerHTML = "";
    runtime.layoutName = runtime.selectedScenario?.layout_name || elements.layout.value;
    if (runtime.layoutName === "all") runtime.layoutName = "compact_demo";
    runtime.scenarioName = "proactive_relay";
    const layout = runtime.playback?.layout_grid
      ? {grid: runtime.playback.layout_grid} : (LAYOUTS[runtime.layoutName] || LAYOUTS.compact_demo);
    const columns = layout.grid[0].length;
    const rows = layout.grid.length;
    sizeGameWindow();
    runtime.tileSize = Math.min(104, Math.floor(704 / columns), Math.floor(500 / rows));
    const Game = window.Overcooked.OvercookedGame.OvercookedGame;
    runtime.game = new Game({
      start_grid: layout.grid,
      container_id: "overcooked",
      tileSize: runtime.tileSize,
      gameWidth: runtime.tileSize * columns,
      gameHeight: runtime.tileSize * rows,
      ANIMATION_DURATION: runtime.playback?.animation_ms || 375,
      ...KitchenStyle.options(),
      COOK_TIME: 2,
      explosion_time: Number.MAX_SAFE_INTEGER,
      DELIVERY_REWARD: 20,
    });
    KitchenStyle.attach(runtime.game, {tileSize: runtime.tileSize});
    KitchenMotion.attach(runtime.game, {tileSize: runtime.tileSize, actionMs: runtime.playback?.step_ms});
    runtime.state = runtime.game.mdp.get_start_state(
      runtime.scenarioName === "split_work" ? ["onion", "onion"] : ["onion"]
    );
    if (runtime.selectedScenario?.initial_state) {
      const OvercookedState = window.Overcooked.OvercookedMDP.OvercookedState;
      const initialState = JSON.parse(JSON.stringify(runtime.selectedScenario.initial_state));
      runtime.state = OvercookedState.from_object(initialState);
    }
    // Seed the renderer BEFORE Phaser creates its scene. Its first draw must
    // already be the stored starting state, including objects and orientation.
    runtime.game.state = runtime.state;
    renderOrders(runtime.state);
    runtime.game.init();
    runtime.game.drawScore(0);
    scheduleRecordingEegAlignment();
  }

  function activeScene() {
    if (!runtime.game || !runtime.game.game || !runtime.game.game.scene) return null;
    const scene = runtime.game.game.scene.getScene("PlayGame");
    return scene && scene.sys && scene.sys.isActive() ? scene : null;
  }

  function ensureHeatmapTiles(valueMap) {
    const scene = activeScene();
    if (!scene) return false;
    const visible = valueMapVisible();
    valueMap.forEach((tile) => {
      const key = tile.x + "," + tile.y;
      if (runtime.heatmapTiles.has(key)) return;
      const size = runtime.tileSize;
      const rectangle = scene.add
        .rectangle(tile.x * size, tile.y * size, size, size, 0x604d68, 0.55)
        .setOrigin(0)
        .setDepth(0.5)
        .setVisible(visible);
      const label = scene.add
        .text(tile.x * size + 6, tile.y * size + 6, "", {
          font: "bold " + Math.max(11, Math.round(size * 0.15)) + "px Arial",
          fill: "#ffffff",
          stroke: "#071018",
          strokeThickness: 3,
        })
        .setDepth(0.7)
        .setVisible(visible);
      runtime.heatmapTiles.set(key, { rectangle, label });
    });
    return true;
  }

  function valueMapVisible() {
    return runtime.experimentMode !== "recording" && runtime.valueMapVisible;
  }

  function syncValueMapVisibility() {
    const visible = valueMapVisible();
    runtime.heatmapTiles.forEach(({ rectangle, label }) => {
      rectangle.setVisible(visible);
      label.setVisible(visible);
    });
    elements.valueMapToggle.setAttribute("aria-pressed", String(visible));
    elements.valueMapToggle.textContent = "Value map: " + (visible ? "On" : "Off");
    elements.heatLegend.classList.toggle("is-hidden", !visible);
    elements.heatLegend.setAttribute("aria-hidden", String(!visible));
  }

  function toggleValueMap() {
    if (runtime.experimentMode === "recording") return;
    runtime.valueMapVisible = !runtime.valueMapVisible;
    syncValueMapVisibility();
  }

  function heatColor(normalized) {
    const low = [96, 77, 104];
    const middle = [191, 101, 103];
    const high = [255, 242, 167];
    const from = normalized < 0.5 ? low : middle;
    const to = normalized < 0.5 ? middle : high;
    const ratio = normalized < 0.5 ? normalized * 2 : (normalized - 0.5) * 2;
    const channel = (index) => Math.round(from[index] + (to[index] - from[index]) * ratio);
    return (channel(0) << 16) | (channel(1) << 8) | channel(2);
  }

  function updateHeatmap(valueMap) {
    if (!Array.isArray(valueMap)) return;
    if (!ensureHeatmapTiles(valueMap)) {
      window.setTimeout(() => updateHeatmap(valueMap), 40);
      return;
    }
    valueMap.forEach((tile) => {
      const display = runtime.heatmapTiles.get(`${tile.x},${tile.y}`);
      if (!display) return;
      const normalized = Math.max(0, Math.min(1, Number(tile.normalized) || 0));
      display.rectangle.setFillStyle(heatColor(normalized), 0.46 + (1 - normalized) * 0.2);
      const isInteraction = Boolean(tile.is_interaction_target);
      const isNavigation = Boolean(tile.is_navigation_target);
      display.rectangle.setStrokeStyle(
        isInteraction ? 5 : (isNavigation ? 3 : 1),
        isInteraction ? 0xfff4b1 : (isNavigation ? 0xf4d49b : 0x8b6b6b),
        isInteraction || isNavigation ? 1 : 0.45
      );
      display.label.setText("");
    });
  }

  function resetReadout() {
    runtime.tick = 0;
    runtime.score = 0;
    runtime.revisions = 0;
    runtime.pausedForMismatch = false;
    runtime.pausedMismatchId = null;
    runtime.pendingAck = null;
    runtime.mismatchCount = 0;
    if (runtime.mismatchMarker) runtime.mismatchMarker.destroy();
    runtime.mismatchMarker = null;
    elements.mismatchPanel.hidden = true;
    elements.mismatchResume.hidden = false;
    elements.revisions.textContent = "0";
    elements.decoderIntent.textContent = runtime.selectedScenario?.title || "Choose an example";
    elements.decoderConfidence.textContent = "Scenario-driven, no EEG confidence";
    elements.decoderAction.textContent = "Waiting to start";
  }

  function pauseForMismatch(mismatch) {
    runtime.paused = true;
    runtime.pausedForMismatch = true;
    runtime.pausedMismatchId = mismatch.id;
    runtime.mismatchCount += 1;
    window.clearTimeout(runtime.timer);
    elements.mismatchType.textContent = mismatch.type;
    elements.mismatchCount.textContent = `Scenario ${runtime.mismatchCount}`;
    elements.mismatchTitle.textContent = mismatch.title;
    elements.mismatchDetail.textContent = mismatch.detail;
    elements.mismatchTile.textContent = Array.isArray(mismatch.tile)
      ? `Relevant kitchen tile: (${mismatch.tile.join(", ")})` : "";
    elements.mismatchPanel.hidden = false;
    elements.mismatchResume.hidden = false;
    const scene = activeScene();
    if (scene && Array.isArray(mismatch.tile)) {
      if (runtime.mismatchMarker) runtime.mismatchMarker.destroy();
      runtime.mismatchMarker = scene.add.rectangle(
        mismatch.tile[0] * runtime.tileSize,
        mismatch.tile[1] * runtime.tileSize,
        runtime.tileSize, runtime.tileSize, 0xffbd65, 0.08
      ).setOrigin(0).setDepth(3).setStrokeStyle(5, 0xffbd65, 1);
    }
    elements.decoderIntent.textContent = mismatch.title;
    elements.decoderAction.textContent = "Waiting for acknowledgment";
    syncControls();
    setSystemStatus("Mismatch paused — press Enter", true);
  }

  function resumeMismatch() {
    if (!runtime.running || !runtime.pausedForMismatch) return;
    runtime.pendingAck = runtime.pausedMismatchId;
    runtime.pausedMismatchId = null;
    runtime.pausedForMismatch = false;
    runtime.paused = false;
    if (runtime.mismatchMarker) runtime.mismatchMarker.destroy();
    runtime.mismatchMarker = null;
    elements.mismatchPanel.hidden = true;
    syncControls();
    setSystemStatus("Q-map running", true);
    scheduleNextTick();
  }

  function setTrialPhase(phase) {
    runtime.trialPhase = phase;
    elements.trialPhase.textContent = phase === "HINT" ? "BRIEFING" : phase.replaceAll("_", " ");
  }

  function resetDecoderUI() {
    runtime.decoderResultHandled = false;
    runtime.probabilityHistory = [];
    runtime.eventWindowResults.clear();
    elements.decodedClass.textContent = "Awaiting trial";
    elements.decodedClass.classList.remove(...RESULT_THEME_CLASSES);
    elements.rpeValue.textContent = "—";
    elements.speValue.textContent = "—";
    elements.decoderConfidence.textContent = "No usable estimates yet";
    elements.undecidedPanel.hidden = true;
    drawProbabilityChart();
    setTrialPhase("LEAD_IN");
  }

  function updateSignalQuality(status) {
    const eq = status.signal_quality?.eeg_quality || {};
    const cq = status.signal_quality?.contact_quality || {};
    const chip = elements.eegQuality.closest(".status-chip");
    const connected = status.mode === "live" && status.status === "connected";
    const hasScore = (reading) => connected && reading.status === "live"
      && typeof reading.overall === "number" && Number.isFinite(reading.overall)
      && reading.overall >= 0 && reading.overall <= 100;
    const liveEq = hasScore(eq);
    const liveCq = hasScore(cq);
    let label = "EQ unavailable";
    let detail = "Enable EEG Quality in EmotivPRO’s LSL Outlet for this headset.";
    if (status.mode === "mock" || status.mode === "replay") {
      label = "Simulated EEG";
      detail = "Simulated signal · no headset quality reading";
    } else if (!connected) {
      detail = "Connect the headset to read its EEG quality.";
    } else if (liveEq) {
      label = `EQ ${Math.round(eq.overall)}%`;
      detail = "EEG quality · Emotiv EPOC X";
      if (eq.sample_rate_quality === -1) detail += " · EEG packet loss";
    } else if (eq.status === "stale") {
      label = "EQ stale";
      detail = "Quality updates stopped · check the EmotivPRO EEG Quality outlet.";
    } else if (eq.status === "waiting") {
      label = "EQ waiting";
      detail = "Waiting for the headset’s EEG Quality reading…";
    } else if (eq.status === "ambiguous") {
      detail = "Multiple EEG Quality outlets for this headset · keep one enabled.";
    } else if (eq.status === "error") {
      detail = "No valid EEG Quality reading · check the EmotivPRO outlet.";
    }
    if (liveCq) detail += ` · Contact quality ${Math.round(cq.overall)}%`;
    elements.eegQuality.textContent = label;
    elements.eegQualityDetail.textContent = detail;
    const sensorDetails = (reading, name) => hasScore(reading)
      ? `${name}: ${Object.entries(reading.channels || {}).map(([channel, score]) => `${channel} ${score}/4`).join(", ")}`
      : "";
    const tooltip = [detail, sensorDetails(eq, "EEG quality"), sensorDetails(cq, "Contact quality")]
      .filter(Boolean).join("\n");
    elements.eegQuality.title = tooltip;
    elements.eegQualityDetail.title = tooltip;
    // Green is reserved for the vendor's full score; intermediate scores stay
    // amber without inventing a clinical or decoder acceptance threshold.
    chip?.classList.toggle("is-working", liveEq && eq.overall === 100 && eq.sample_rate_quality !== -1);
    chip?.classList.toggle("is-warning", liveEq && eq.overall > 0 && eq.overall < 100 && eq.sample_rate_quality !== -1);
    chip?.classList.toggle("is-alert", (liveEq && (eq.overall === 0 || eq.sample_rate_quality === -1))
      || (connected && ["stale", "error", "ambiguous"].includes(eq.status)));
  }

  function renderEegSources() {
    // Native menus must keep their option nodes and selection while open.
    if (document.activeElement === elements.eegStreamSelect) return;
    const streams = [...runtime.eegAvailableStreams].sort((a, b) =>
      `${a.name}|${a.source_id}`.localeCompare(`${b.name}|${b.source_id}`));
    const choices = [
      {value: "", label: "Live EEG · auto-discover"},
      ...streams.map((stream) => ({
        value: stream.source_id || stream.name,
        label: `${stream.name} · ${stream.sample_rate || "?"} Hz · ${stream.channel_count || "?"} ch`,
      })),
      {value: MOCK_EEG_SOURCE, label: "Mock EEG · no hardware"},
    ];
    const desired = runtime.eegSourceChoice || "";
    if (desired && !choices.some((choice) => choice.value === desired)) {
      choices.splice(1, 0, {value: desired, label: `${desired} · unavailable`});
    }
    const key = JSON.stringify(choices);
    if (key !== runtime.eegSourceOptionsKey) {
      const options = choices.map((choice) => {
        const option = document.createElement("option");
        option.value = choice.value;
        option.textContent = choice.label;
        return option;
      });
      elements.eegStreamSelect.replaceChildren(...options);
      runtime.eegSourceOptionsKey = key;
    }
    if (elements.eegStreamSelect.value !== desired) elements.eegStreamSelect.value = desired;
  }

  async function scanEegSources() {
    if (window.StaticReplay) return;
    window.clearTimeout(runtime.eegScanTimer);
    if (runtime.experimentMode === "play" && playing.keyboardSelected) return;
    if (runtime.eegScanning || ["preview", "editor"].includes(runtime.experimentMode)) return;
    runtime.eegScanning = true;
    try {
      if (!runtime.running && !runtime.arming && !runtime.librarySession && !runtime.eegConnecting) {
        const result = await api("/api/eeg/streams");
        runtime.eegAvailableStreams = result.streams || [];
        renderEegSources();
      }
    } catch (_error) {
      // A failed inventory refresh must not change or disconnect the source.
    } finally {
      runtime.eegScanning = false;
      if (runtime.experimentMode !== "preview") {
        runtime.eegScanTimer = window.setTimeout(scanEegSources, 5000);
      }
    }
  }

  function updateEegStatus(status) {
    if (!status) return;
    const previousSource = runtime.eegStatus?.source_id;
    const previousMode = runtime.eegStatus?.mode;
    runtime.eegStatus = status;
    if (["play", "presentation"].includes(runtime.experimentMode) && playing.active) {
      runtime.eegAvailableStreams = status.available_streams || [];
      renderEegSources();
      playing.status(status);
      return;
    }
    runtime.eegAvailableStreams = status.available_streams || [];
    const connectionGood = ["live", "mock"].includes(status.mode) && status.status === "connected";
    if (runtime.eegSourceChoice === null || (connectionGood && !runtime.eegConnecting)) {
      runtime.eegSourceChoice = status.mode === "mock" ? MOCK_EEG_SOURCE
        : status.mode === "live" ? status.source_id || "" : "";
    }
    if (connectionGood) {
      window.clearTimeout(runtime.eegReconnectTimer);
      runtime.eegReconnectTimer = null;
    }
    if (previousMode !== status.mode || previousSource !== status.source_id) {
      runtime.signalHistory = Array.from({ length: 6 }, () => []);
    }
    elements.eegConnection.textContent = status.status || "unknown";
    elements.eegDecoderStatus.textContent = status.decoder || "waiting";
    elements.eegSampleRate.textContent = status.sample_rate ? `${status.sample_rate} Hz` : "—";
    elements.eegBuffer.textContent = `${Number(status.buffer_seconds || 0).toFixed(1)} s buffered`;
    updateSignalQuality(status);
    const connectionChip = elements.eegConnection.closest(".status-chip");
    connectionChip?.classList.toggle("is-working", connectionGood);
    connectionChip?.classList.toggle("is-alert", !connectionGood);
    elements.eegStreamLabel.textContent = status.stream_name || "Emotiv LSL";
    elements.eegBadge.textContent = String(status.status || "offline").toUpperCase();

    renderEegSources();
    elements.eegStreamSelect.disabled = runtime.running || runtime.arming || runtime.librarySession || runtime.eegConnecting;
    elements.eegStreamSelect.closest("label")?.classList.toggle(
      "is-alert", status.status !== "connected"
    );
    elements.eegTopConnect.textContent = runtime.eegConnecting ? "Connecting…" : status.status === "connected"
      ? "Reconnect EEG" : "Connect EEG";
  }

  function median(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function drawSignal(payload) {
    if (["play", "presentation"].includes(runtime.experimentMode)) return;
    const samples = Array.isArray(payload?.samples)
      ? payload.samples
      : Array.isArray(payload?.values) ? [payload.values] : [];
    if (!elements.eegWaveform || !samples.length) return;
    const timestamps = Array.isArray(payload.timestamps)
      ? payload.timestamps
      : [Number(payload.timestamp) || performance.now() / 1000];
    if (Array.isArray(payload.channels) && payload.channels.length) {
      runtime.signalChannels = payload.channels.slice(0, 6);
    }
    let newestTimestamp = 0;
    samples.forEach((sample, sampleIndex) => {
      const timestamp = Number(timestamps[sampleIndex] ?? timestamps.at(-1))
        || performance.now() / 1000;
      newestTimestamp = Math.max(newestTimestamp, timestamp);
      sample.slice(0, 6).forEach((value, channelIndex) => {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) return;
        runtime.signalHistory[channelIndex].push({
          timestamp, value: numericValue,
        });
      });
    });
    if (!newestTimestamp) return;
    runtime.signalHistory.forEach((history) => {
      while (history.length && history[0].timestamp < newestTimestamp - 1.8) {
        history.shift();
      }
    });
    if (elements.rawEegPanel.hidden) return;

    const canvas = elements.eegWaveform;
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return;
    // Match the expanded panel and Focus scaling without stretching the trace.
    const ratio = canvas.getBoundingClientRect().width / width * (window.devicePixelRatio || 1);
    const pixelWidth = Math.max(1, Math.round(width * ratio));
    const pixelHeight = Math.max(1, Math.round(height * ratio));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const left = 36, right = 10, top = 20, bottom = 22;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    ctx.clearRect(0, 0, width, height);
    const chartStyle = getComputedStyle(canvas);
    ctx.font = "11px system-ui";
    ctx.fillStyle = chartStyle.color;
    ctx.textAlign = "center";
    [0, .6, 1.2, 1.8].forEach((second) => {
      const x = left + second / 1.8 * plotWidth;
      ctx.strokeStyle = chartStyle.borderTopColor;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, height - bottom); ctx.stroke();
      const label = second === 1.8 ? "0s" : `-${(1.8 - second).toFixed(1)}s`;
      ctx.textAlign = second === 1.8 ? "right" : "center";
      ctx.fillText(label, x, height - 6);
    });

    // EPOC X raw electrodes include a ~4,000 µV DC offset. Subtract each
    // channel's rolling median for display only; recording and decoding retain
    // the original samples. One shared robust scale preserves relative amplitude.
    const baselines = runtime.signalHistory.map((history) =>
      median(history.map((sample) => sample.value)));
    const absoluteCentered = [];
    runtime.signalHistory.forEach((history, channelIndex) => {
      history.forEach((sample) =>
        absoluteCentered.push(Math.abs(sample.value - baselines[channelIndex])));
    });
    absoluteCentered.sort((leftValue, rightValue) => leftValue - rightValue);
    const robustIndex = Math.max(0, Math.floor((absoluteCentered.length - 1) * .95));
    const robustAmplitude = absoluteCentered[robustIndex] || 0;
    const microvoltScale = Math.max(25, Math.min(250, Math.ceil(robustAmplitude / 25) * 25 || 25));

    runtime.signalHistory.forEach((history, channel) => {
      const lane = plotHeight / 6;
      const mid = top + lane * (channel + .5);
      ctx.fillStyle = chartStyle.color;
      ctx.textAlign = "left";
      ctx.fillText(runtime.signalChannels[channel] || `Ch${channel + 1}`, 5, mid + 3);
      ctx.strokeStyle = chartStyle.borderTopColor;
      ctx.beginPath(); ctx.moveTo(left, mid); ctx.lineTo(width - right, mid); ctx.stroke();
      ctx.strokeStyle = chartStyle.color;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      history.forEach((sample, index) => {
        const elapsed = Math.max(0, Math.min(1.8, sample.timestamp - (newestTimestamp - 1.8)));
        const x = left + elapsed / 1.8 * plotWidth;
        const centered = sample.value - baselines[channel];
        const normalized = Math.max(-1, Math.min(1, centered / microvoltScale));
        const y = mid - normalized * lane * .4;
        if (!index) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
    ctx.fillStyle = chartStyle.color;
    ctx.textAlign = "right";
    ctx.fillText(`DC-centered · ±${microvoltScale} µV · ${samples.length} new samples`, width - right, 10);
  }

  function drawProbabilityChart() {
    const canvas = elements.probabilityChart;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width, height = canvas.height;
    const left = 31, right = 9, top = 9, bottom = 23;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    ctx.clearRect(0, 0, width, height);
    const chartStyle = getComputedStyle(canvas);
    ctx.font = "9px system-ui";
    ctx.fillStyle = chartStyle.color;
    ctx.textAlign = "right";
    [0, .5, 1].forEach((probability) => {
      const y = top + (1 - probability) * plotHeight;
      ctx.strokeStyle = chartStyle.borderTopColor;
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(width - right, y); ctx.stroke();
      ctx.fillText(`${Math.round(probability * 100)}`, left - 5, y + 3);
    });
    ctx.textAlign = "center";
    [0, .6, 1.2, 1.8].forEach((second) => {
      const x = left + second / 1.8 * plotWidth;
      const label = second === 1.8 ? "0s" : `-${(1.8 - second).toFixed(1)}s`;
      ctx.fillText(label, x, height - 6);
    });
    const samples = runtime.probabilityHistory;
    const newestTimestamp = samples.length
      ? samples[samples.length - 1].timestamp
      : performance.now() / 1000;
    const windowStart = newestTimestamp - 1.8;
    const plot = (key, color) => {
      if (!samples.length) return;
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2;
      ctx.beginPath();
      samples.forEach((sample, index) => {
        const elapsed = Math.max(0, Math.min(1.8, sample.timestamp - windowStart));
        const x = left + elapsed / 1.8 * plotWidth;
        const y = top + (1 - sample[key]) * plotHeight;
        if (!index) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      samples.forEach((sample) => {
        const elapsed = Math.max(0, Math.min(1.8, sample.timestamp - windowStart));
        const x = left + elapsed / 1.8 * plotWidth;
        const y = top + (1 - sample[key]) * plotHeight;
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      });
    };
    plot("rpe", "#4f83cc");
    plot("spe", "#d783a6");
  }

  function renderProbabilityTrace(payload) {
    if (["play", "presentation"].includes(runtime.experimentMode)) return;
    if (payload.session_id !== runtime.sessionId) return;
    const timestamp = Number(payload.timestamp) || performance.now() / 1000;
    const identity = `rolling:${payload.sequence ?? timestamp}`;
    runtime.probabilityHistory = runtime.probabilityHistory.filter(
      (sample) => sample.identity !== identity
    );
    if (payload.valid) {
      runtime.probabilityHistory.push({
        identity,
        timestamp,
        rpe: Number(payload.rpe_probability) || 0,
        spe: Number(payload.spe_probability) || 0,
      });
      runtime.probabilityHistory.sort((a, b) => a.timestamp - b.timestamp);
      const newest = runtime.probabilityHistory[runtime.probabilityHistory.length - 1].timestamp;
      runtime.probabilityHistory = runtime.probabilityHistory.filter(
        (sample) => sample.timestamp >= newest - 1.8
      );
      const current = runtime.probabilityHistory[runtime.probabilityHistory.length - 1];
      if (!runtime.decoderResultHandled) {
        elements.rpeValue.textContent = `${Math.round(current.rpe * 100)}%`;
        elements.speValue.textContent = `${Math.round(current.spe * 100)}%`;
      }
    }
    const validEventCount = [...runtime.eventWindowResults.values()].filter(
      (item) => item.valid
    ).length;
    if (!runtime.decoderResultHandled) {
      elements.decoderConfidence.textContent = runtime.probabilityHistory.length
        ? runtime.trialPhase === "EEG_DECODING"
          ? `${validEventCount}/5 event windows · rolling plot remains live`
          : "Rolling inference · latest 1.8 s"
        : "Waiting for a usable EEG window";
    }
    drawProbabilityChart();
  }

  function renderEventWindow(payload) {
    if (payload.session_id !== runtime.sessionId) return;
    const identity = `${payload.job_id || "event"}:${payload.index}`;
    runtime.eventWindowResults.set(identity, payload);
    const validCount = [...runtime.eventWindowResults.values()].filter(
      (item) => item.valid
    ).length;
    if (!runtime.decoderResultHandled) {
      elements.decoderConfidence.textContent = `${validCount}/5 event windows · rolling plot remains live`;
    }
  }

  function renderDecoderResult(result) {
    if (!result || runtime.decoderResultHandled) return;
    runtime.decoderResultHandled = true;
    const decoded = result.decoded_class;
    elements.decodedClass.textContent = decoded;
    showDecodedResult(decoded, `${result.valid_window_count || 0} usable EEG estimates`);
    const rpe = result.mean_rpe_probability;
    const spe = result.mean_spe_probability;
    elements.rpeValue.textContent = rpe == null ? "—" : `${Math.round(rpe * 100)}%`;
    elements.speValue.textContent = spe == null ? "—" : `${Math.round(spe * 100)}%`;
    elements.decoderIntent.textContent = decoded;
    elements.decoderConfidence.textContent = `${result.valid_window_count || 0} usable estimates · final mean`;
    if (decoded === "UNDECIDED") {
      setTrialPhase("UNDECIDED");
      elements.undecidedPanel.hidden = false;
      elements.undecidedReason.textContent = result.reason || "Not enough valid EEG windows.";
      return;
    }
    setTrialPhase("RESULT");
    window.setTimeout(() => applyRepair("apply"), 1500);
  }

  function openEventStream() {
    if (window.StaticReplay) return;
    if (runtime.eventSource) runtime.eventSource.close();
    runtime.eventSource = new EventSource("/api/eeg/events");
    runtime.eventSource.addEventListener("eeg_status", (event) => updateEegStatus(JSON.parse(event.data)));
    runtime.eventSource.addEventListener("eeg_signal", (event) => drawSignal(JSON.parse(event.data)));
    runtime.eventSource.addEventListener("decoder_trace", (event) => renderProbabilityTrace(JSON.parse(event.data)));
    runtime.eventSource.addEventListener("decoder_window", (event) => renderEventWindow(JSON.parse(event.data)));
    runtime.eventSource.addEventListener("decoder_result", (event) => {
      const payload = JSON.parse(event.data);
      if (payload.session_id === runtime.sessionId) pollTrial(true);
    });
  }

  async function pollTrial(force) {
    if (!runtime.sessionId || (!force && runtime.trialPhase !== "EEG_DECODING")) return;
    try {
      const status = await api(`/api/session/${runtime.sessionId}/trial`);
      if (status.decoder?.window_results) status.decoder.window_results.forEach((windowResult) =>
        renderEventWindow({ session_id: runtime.sessionId, job_id: status.decoder.job_id, ...windowResult }));
      if (status.trial_phase === "RESULT" || status.trial_phase === "UNDECIDED") renderDecoderResult(status.decoder);
    } catch (error) {
      console.warn("Trial status unavailable", error);
    }
  }

  async function presentCriticalEvent(eventPayload) {
    runtime.paused = true;
    runtime.running = true;
    window.clearTimeout(runtime.timer);
    setTrialPhase("CRITICAL_EVENT");
    setResultTheme(elements.mismatchPanel, null);
    elements.mismatchType.textContent = "EEG event";
    elements.mismatchCount.textContent = "Critical moment";
    elements.mismatchTitle.textContent = eventPayload.title;
    elements.mismatchDetail.textContent = eventPayload.detail;
    elements.mismatchTile.textContent = Array.isArray(eventPayload.tile) ? `Relevant kitchen tile: (${eventPayload.tile.join(", ")})` : "";
    elements.mismatchPanel.hidden = false;
    elements.mismatchResume.hidden = true;
    elements.decoderAction.textContent = "Collecting EEG windows";
    runtime.eventWindowResults.clear();
    syncControls();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    try {
      await api(`/api/session/${runtime.sessionId}/event-presented`, {
        method: "POST", body: JSON.stringify({ client_time_ms: performance.now() }),
      });
      setTrialPhase("EEG_DECODING");
      window.clearInterval(runtime.trialPoll);
      runtime.trialPoll = window.setInterval(() => pollTrial(false), 120);
    } catch (error) {
      setSystemStatus(`EEG marker error: ${error.message}`, false);
    }
  }

  async function applyRepair(operation, manualClass) {
    if (!runtime.sessionId) return;
    window.clearInterval(runtime.trialPoll);
    setTrialPhase("AI_REPAIR");
    try {
      const repair = await api(`/api/session/${runtime.sessionId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ operation, decoded_class: manualClass, state: runtime.state }),
      });
      if (repair.trial_phase === "CRITICAL_EVENT" && repair.retry) {
        runtime.decoderResultHandled = false;
        resetDecoderUI();
        elements.mismatchPanel.hidden = false;
        await presentCriticalEvent(runtime.selectedScenario.critical_event);
        return;
      }
      updateHeatmap(repair.value_map);
      const Action = window.Overcooked.OvercookedMDP.Action;
      const transition = runtime.game.mdp.get_transition_states_and_probs({
        state: runtime.state,
        joint_action: [Action.INDEX_TO_ACTION[4], Action.INDEX_TO_ACTION[repair.final_ai_action]],
      });
      runtime.state = transition[0][0];
      runtime.game.motion.drawState(runtime.state, {actions: ['STAY', repair.final_ai_action_name]});
      elements.decoderAction.textContent = `${repair.repair_phase.replaceAll("_", " ")} · ${repair.final_ai_action_name}`;
      if (repair.eeg_revision) runtime.revisions += 1;
      elements.revisions.textContent = String(runtime.revisions);
      elements.undecidedPanel.hidden = true;
      setTrialPhase("COMPLETE");
      showDecodedResult(
        repair.decoded_class,
        `${repair.arbitration_reason}${repair.operator_override ? " · Operator override recorded" : " · EEG vote applied automatically"}`,
      );
      runtime.running = false; runtime.paused = false;
      syncControls();
      setSystemStatus("Trial complete", true);
      await stopActiveSession("trial_complete");
    } catch (error) {
      setSystemStatus(`Repair error: ${error.message}`, false);
    }
  }

  function renderOrders(state) {
    const orders = state?.order_list;
    elements.orderList.textContent = !Array.isArray(orders) ? "Any soup"
      : orders.length ? orders.slice(0, 3).map(name => name.charAt(0).toUpperCase() + name.slice(1)).join(" → ")
      : "Orders complete";
  }

  function selectScenario(id) {
    const example = (usingLiveTrialLibrary() ? categoryScenarios() : runtime.scenarios)
      .find((scenario) => scenario.id === id);
    if (!example || runtime.running || runtime.arming || runtime.librarySession) return;
    if (example.preview_only && !["preview", "editor"].includes(runtime.experimentMode) && !usingLiveTrialLibrary()) return;
    const speed = runtime.playbackSpeeds[Number(elements.speed.value)];
    const selected = example.speed_variants.find(variant => variant.step_ms === speed.step_ms);
    runtime.selectedScenario = selected;
    runtime.selectedScenarioId = selected.id;
    runtime.playback = selected;
    runtime.trajectoryLength = selected.trajectory_length;
    elements.exampleClass.textContent = selected.expected_class;
    elements.exampleTiming.textContent = `2 s fixation · ${selected.duration_ms / 1000} s scene · event at ${selected.event_time_ms / 1000} s`;
    elements.exampleRepair.textContent = selected.repair_detail;
    elements.exampleEvidence.textContent = selected.design_review?.evidence || "";
    elements.exampleEvidence.hidden = !selected.design_review?.evidence;
    elements.speedValue.textContent = `${speed.label} · both chefs`;
    elements.speed.setAttribute("aria-valuetext", `${speed.label}, both chefs, ${selected.step_ms} milliseconds per step`);
    elements.speedTiming.textContent = `${(selected.duration_ms / 1000).toFixed(1)} s scene · ${(selected.event_time_ms / 1000).toFixed(2)} s context · 2 s fixation${selected.correction_tick == null ? "" : ` · correction +${selected.correction_delay_ms / 1000} s`}`;
    if (runtime.experimentMode === "recording") {
      elements.speedTiming.textContent = `2 s fixation per trial · scripted correction +${(1500 + 3 * selected.step_ms) / 1000} s`;
    }
    elements.scenario.value = usesTrialFiles() ? selected.trial_alias : selected.id;
    if (!["play", "presentation"].includes(runtime.experimentMode)) {
      elements.playbackStatus.textContent = "Ready · play this example";
      elements.sessionLabel.textContent = "No active session";
      setSystemStatus("Ready · play the selected example", true);
      elements.briefingTitle.textContent = selected.title;
      elements.briefingExpectation.textContent = selected.human_expectation;
    }
    // Recorded playback mounts its frozen occurrence, and the editor owns its
    // preview. Keep Playing's last frozen kitchen/Briefing until the next
    // occurrence is ready instead of briefly laying out catalogue content.
    if (runtime.catalogueReady && !["editor", "play", "presentation"].includes(runtime.experimentMode)) initializeGame();
    if (!["play", "presentation"].includes(runtime.experimentMode)) {
      resetReadout();
      resetDecoderUI();
    }
    syncControls();
  }

  function usesTrialFiles() {
    if (usingLiveTrialLibrary()) return true;
    const entries = categoryScenarios();
    return entries.length > 0 && entries.every(entry => entry.trial_alias);
  }

  function selectTrialAlias(alias, preferredVersion) {
    const versions = categoryScenarios().filter(entry => entry.trial_alias === alias);
    if (!versions.length) return;
    elements.classFilter.replaceChildren(...versions.map(entry => new Option(entry.trial_version, entry.trial_version)));
    const selected = versions.find(entry => entry.trial_version === preferredVersion) || versions.find(entry => entry.trial_version === "nonPE") || versions[0];
    elements.classFilter.value = selected.trial_version;
    elements.layout.replaceChildren(new Option(selected.layout_label || LAYOUTS[selected.layout_name]?.label || selected.layout_name, selected.layout_name));
    elements.layout.value = selected.layout_name;
    selectScenario(selected.id);
  }

  function renderScenarioOptions() {
    if (usesTrialFiles()) {
      const designs = [...new Map(categoryScenarios().map(entry => [entry.trial_alias, entry])).values()]
        .sort((a, b) => a.trial_title.localeCompare(b.trial_title, undefined, { numeric: true }));
      elements.scenario.replaceChildren(...designs.map(entry => new Option(entry.trial_title, entry.trial_alias)));
      elements.exampleSelectLabel.textContent = `Trial (${designs.length})`;
      if (!designs.length) {
        elements.scenario.replaceChildren(new Option("No double-checked trials", ""));
        elements.classFilter.replaceChildren();
        elements.layout.replaceChildren();
        runtime.selectedScenario = null;
        runtime.selectedScenarioId = null;
        elements.briefingExpectation.textContent = "Save Playback and Subtasks checks in Trial Editor to make a trial version available here.";
        syncControls();
        return;
      }
      const previous = categoryScenarios().find(entry => entry.id === runtime.selectedScenarioId);
      selectTrialAlias(previous?.trial_alias || designs[0].trial_alias, previous?.trial_version);
      return;
    }
    const layoutFilter = elements.layout.value;
    const classFilter = elements.classFilter.value;
    const matches = categoryScenarios().filter((scenario) =>
      (layoutFilter === "all" || scenario.layout_name === layoutFilter) &&
      scenario.expected_class === classFilter);
    elements.scenario.innerHTML = "";
    elements.exampleSelectLabel.textContent = `Example (${matches.length})`;
    matches.forEach((scenario, index) => {
      const option = document.createElement("option");
      option.value = scenario.id;
      option.textContent = `${index + 1}. ${scenario.title}`;
      elements.scenario.append(option);
    });
    if (!matches.length) {
      runtime.selectedScenario = null;
      runtime.selectedScenarioId = null;
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No matching collaboration events";
      option.disabled = true;
      elements.scenario.append(option);
      elements.briefingTitle.textContent = "No matching event";
      elements.briefingExpectation.textContent = "Choose a condition and an available kitchen layout.";
      syncControls();
      return;
    }
    const selected = matches.find((scenario) => scenario.id === runtime.selectedScenarioId) || matches[0];
    selectScenario(selected.id);
  }

  function selectCondition() {
    if (runtime.running || runtime.arming) return;
    if (usesTrialFiles()) {
      const entry = categoryScenarios().find(item => item.trial_alias === elements.scenario.value && item.trial_version === elements.classFilter.value);
      if (entry) selectScenario(entry.id);
      else renderScenarioOptions();
      return;
    }
    const availableLayouts = new Set(categoryScenarios()
      .filter(scenario => scenario.expected_class === elements.classFilter.value)
      .map(scenario => scenario.layout_name));
    elements.layout.replaceChildren(new Option("All layouts", "all"));
    runtime.layouts.filter(layout => availableLayouts.has(layout.name)).forEach(layout => {
      elements.layout.append(new Option(layout.label, layout.name));
    });
    // A previous condition's optional layout filter must not hide its examples.
    elements.layout.value = "all";
    renderScenarioOptions();
  }

  function usingLiveTrialLibrary() {
    return runtime.experimentMode === "play" && !playing.recorded && !playing.keyboardSelected;
  }

  function categoryScenarios() {
    if (usingLiveTrialLibrary()) return playing.liveTrials || [];
    const categoryId = ["preview", "editor"].includes(runtime.experimentMode) ? runtime.categoryId : "recording_library";
    return runtime.scenarios.filter(scenario =>
      (scenario.category_id || "recording_library") === categoryId &&
      (!scenario.preview_only || ["preview", "editor"].includes(runtime.experimentMode)));
  }

  function selectCategory(preferredClass) {
    if (runtime.running || runtime.arming || runtime.librarySession) return;
    runtime.categoryId = ["preview", "editor"].includes(runtime.experimentMode) ? elements.category.value : "recording_library";
    elements.category.value = runtime.categoryId;
    const fileMode = usesTrialFiles();
    const classLabel = document.getElementById("condition-select-label");
    if (classLabel) classLabel.textContent = fileMode ? "Version" : "Condition";
    elements.scenario.setAttribute?.("aria-label", fileMode ? "Trial" : "Example");
    // Keep keyboard order aligned with the visible Trial → Version selection.
    const classField = elements.classFilter.closest?.("label");
    const trialField = elements.scenario.closest?.("label");
    if (classField && trialField) {
      classField.parentNode.insertBefore(fileMode ? trialField : classField, fileMode ? classField : trialField);
    }
    if (fileMode) { renderScenarioOptions(); return; }
    const available = new Set(categoryScenarios().map(scenario => scenario.expected_class));
    const category = runtime.categories.find(item => item.id === runtime.categoryId);
    elements.classFilter.replaceChildren(...runtime.classes.filter(label => available.has(label))
      .map(label => new Option(label, label)));
    elements.classFilter.value = available.has(preferredClass) ? preferredClass : category.default_class;
    selectCondition();
  }

  async function loadScenarios() {
    const catalogue = await api("/api/scenarios");
    runtime.scenarios = [...catalogue.trials, ...(catalogue.preview_trials || [])];
    runtime.categories = catalogue.categories || [{id: "recording_library", label: "Current trial library", default_class: "nonPE"}];
    runtime.classes = catalogue.classes;
    runtime.layouts = catalogue.layouts;
    runtime.playbackSpeeds = catalogue.playback_speeds;
    runtime.recordingSessions = catalogue.recording_sessions || [];
    const customProfile = runtime.recordingSessions.find(profile => profile.id === runtime.recordingSessionId && profile.custom_counts);
    if (customProfile) {
      elements.recordingNonpeCount.value = String(customProfile.condition_counts.nonPE);
      elements.recordingPeCount.value = String(customProfile.condition_counts.SPE);
    }
    elements.speed.max = String(runtime.playbackSpeeds.length - 1);
    elements.speed.value = String(runtime.playbackSpeeds.findIndex(speed => speed.step_ms === 500));
    elements.recordingSpeed.replaceChildren(...runtime.playbackSpeeds.map((speed, index) => new Option(speed.label, String(index))));
    elements.recordingSpeed.value = elements.speed.value;
    catalogue.layouts.forEach(layout => {
      LAYOUTS[layout.name] = layout;
    });
    elements.category.replaceChildren(...runtime.categories.map(category => new Option(category.label, category.id)));
    // Resolve a direct preview link before creating Phaser. Creating a default
    // scene and immediately replacing it can destroy a renderer during boot.
    const params = new URLSearchParams(window.location.search);
    const requestedId = params.get("scenario");
    const requested = runtime.scenarios.find(scenario => (scenario.id === requestedId ||
      (scenario.trial_alias === params.get("trial") && scenario.trial_version === (params.get("version") || "nonPE")))
      && (!scenario.preview_only || ["preview", "editor"].includes(runtime.experimentMode)));
    runtime.selectedScenarioId = requested?.id || catalogue.trials[0]?.id;
    elements.category.value = requested?.category_id || "recording_library";
    selectCategory(requested?.expected_class);
  }

  async function loadDecoders() {
    const catalogue = await api("/api/decoders");
    runtime.decoders = catalogue.decoders || [];
    elements.decoderSelect.innerHTML = "";
    runtime.decoders.forEach((decoder) => {
      const option = document.createElement("option");
      option.value = decoder.id;
      option.textContent = `${decoder.display_name || decoder.id} · ${decoder.version} · ${decoder.model?.architecture || "decoder"} · ${decoder.channels?.length || 0} ch @ ${decoder.sample_rate} Hz · ${decoder.ready ? "ready" : decoder.readiness_reason}`;
      option.disabled = !decoder.ready;
      elements.decoderSelect.append(option);
    });
    if (!runtime.decoders.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No trained decoder registered";
      elements.decoderSelect.append(option);
    }
  }

  function syncRawEegVisibility() {
    const isRecording = runtime.experimentMode === "recording";
    const isPlaying = runtime.experimentMode === "play" && !playing.keyboardSelected;
    const isPresentation = runtime.experimentMode === "presentation";
    const canToggle = isRecording || isPlaying;
    const rawVisible = isRecording ? runtime.rawEegVisible : runtime.playingRawEegVisible;
    const isVisible = isPresentation || (canToggle && rawVisible);
    elements.rawEegControls.hidden = !canToggle;
    elements.rawEegPanel.hidden = !isVisible;
    elements.decoderPanel.hidden = !(isPresentation || (isPlaying && runtime.playingProbabilityVisible));
    elements.probabilityToggle.hidden = !isPlaying;
    elements.rawEegToggle.setAttribute("aria-pressed", String(rawVisible));
    elements.rawEegToggle.textContent = `Raw EEG: ${rawVisible ? "On" : "Off"}`;
    elements.probabilityToggle.setAttribute("aria-pressed", String(runtime.playingProbabilityVisible));
    elements.probabilityToggle.textContent = `Probability: ${runtime.playingProbabilityVisible ? "On" : "Off"}`;
    if (isPlaying) {
      const count = Number(runtime.playingRawEegVisible) + Number(runtime.playingProbabilityVisible);
      document.body.dataset.playingPanels = String(count);
      document.body.style.setProperty("--playing-panel-count", Math.max(1, count));
    } else {
      delete document.body.dataset.playingPanels;
      document.body.style.removeProperty("--playing-panel-count");
    }
    scheduleRecordingEegAlignment();
  }

  function sizeGameWindow() {
    if (runtime.experimentMode === "editor") {
      runtime.displayScale = 1;
      document.body.style.setProperty("--display-scale", 1);
      return;
    }
    const layout = runtime.playback?.layout_grid
      ? {grid: runtime.playback.layout_grid} : (LAYOUTS[runtime.layoutName] || LAYOUTS.compact_demo);
    const board = KitchenStyle.dimensions(layout.grid);
    const aspect = board.width / board.height;
    const border = parseFloat(getComputedStyle(elements.container).borderTopWidth) * 2;
    // Focus view keeps the monitor composition. The normal research page uses
    // unscaled typography and fits only the kitchen to its available column.
    const focused = focusModeActive();
    const referenceHeight = runtime.experimentMode === 'presentation'
      ? (focused ? 980 : 1100) : DISPLAY_REFERENCE.height;
    runtime.displayScale = focused ? Math.min(window.innerHeight / referenceHeight,
      window.innerWidth / DISPLAY_REFERENCE.width) : 1;
    const columnWidth = focused ? 800 : elements.stage.querySelector('.stage-center').clientWidth;
    const height = !focused || ["play", "presentation"].includes(runtime.experimentMode)
      ? Math.min(DISPLAY_REFERENCE.gameHeight, (columnWidth - border) / aspect + border)
      : DISPLAY_REFERENCE.gameHeight;
    const width = (height - border) * aspect + border;
    document.body.style.setProperty("--display-scale", runtime.displayScale);
    document.body.style.setProperty("--display-width", `${DISPLAY_REFERENCE.width}px`);
    document.body.style.setProperty("--display-viewport-height", `${window.innerHeight / runtime.displayScale}px`);
    document.body.style.setProperty("--scaled-display-width", `${DISPLAY_REFERENCE.width * runtime.displayScale}px`);
    document.body.style.setProperty("--game-window-height", `${height}px`);
    document.body.style.setProperty("--game-window-width", `${width}px`);
    syncDisplayHeight();
    scheduleRecordingEegAlignment();
  }

  function syncDisplayHeight() {
    if (runtime.experimentMode === "editor") return;
    // Reserve the actual space above the kitchen without moving its center.
    document.body.style.setProperty("--game-heading-height", `${elements.gameHeading.offsetHeight}px`);
    if (["play", "presentation"].includes(runtime.experimentMode) && !focusModeActive()) {
      const header = document.querySelector(".hybrid-header");
      const headerHeight = header.getBoundingClientRect().bottom - elements.displaySurface.getBoundingClientRect().top;
      document.body.style.setProperty("--playing-header-height", `${headerHeight}px`);
    }
    document.body.style.setProperty("--scaled-display-height",
      `${elements.displaySurface.offsetHeight * runtime.displayScale}px`);
  }

  function focusModeActive() {
    return document.body.classList.contains("is-focus-mode");
  }

  function syncFocusModeUI() {
    const active = focusModeActive();
    playing.syncSetup();
    elements.focusModeToggle.setAttribute("aria-pressed", String(active));
    elements.focusModeToggle.setAttribute("aria-label", active ? "Exit focus mode" : "Enter focus mode");
    elements.focusModeToggle.title = active ? "Restore page header" : "Focus on workspace";
    elements.focusModeToggle.querySelector("span").textContent = active ? "Exit focus mode" : "Focus mode";
    sizeGameWindow();
    if (active) window.scrollTo(0, 0);
    document.dispatchEvent(new Event("focusmodechange"));
  }

  function toggleFocusMode() {
    document.body.classList.toggle("is-focus-mode");
    syncFocusModeUI();
  }

  function alignRecordingEegToGame() {
    const sidebar = document.querySelector(".eeg-sidebar");
    const stage = document.querySelector(".stage");
    if (!sidebar || !stage || runtime.experimentMode !== "recording") {
      sidebar?.style.removeProperty("--recording-eeg-top");
      return;
    }
    const stageRect = stage.getBoundingClientRect();
    const gameRect = elements.container.getBoundingClientRect();
    const sidebarRect = sidebar.getBoundingClientRect();
    const rawPanelRect = elements.rawEegPanel.getBoundingClientRect();
    if (!gameRect.height || !rawPanelRect.height) return;
    const panelOffsetWithinSidebar = rawPanelRect.top - sidebarRect.top;
    const targetTop = gameRect.top - stageRect.top
      + (gameRect.height - rawPanelRect.height) / 2
      - panelOffsetWithinSidebar;
    // Bounding rectangles are screen pixels; the sidebar's margin uses reference pixels.
    sidebar.style.setProperty("--recording-eeg-top", `${targetTop / runtime.displayScale}px`);
  }

  function scheduleRecordingEegAlignment() {
    window.requestAnimationFrame(() => window.requestAnimationFrame(alignRecordingEegToGame));
  }

  function toggleRawEegPanel() {
    if (runtime.experimentMode === "play" && !playing.keyboardSelected) {
      runtime.playingRawEegVisible = !runtime.playingRawEegVisible;
    } else if (runtime.experimentMode === "recording") {
      runtime.rawEegVisible = !runtime.rawEegVisible;
    } else return;
    syncRawEegVisibility();
    sizeGameWindow();
    playing.scheduleDraw();
  }

  function toggleProbabilityPanel() {
    if (runtime.experimentMode !== "play" || playing.keyboardSelected) return;
    runtime.playingProbabilityVisible = !runtime.playingProbabilityVisible;
    syncRawEegVisibility();
    sizeGameWindow();
    playing.scheduleDraw();
  }

  function syncModeUI({ editorReady = true } = {}) {
    runtime.experimentMode = elements.experimentMode.value;
    document.body.dataset.experimentMode = runtime.experimentMode;
    playing.syncSetup();
    const isPlay = ["play", "presentation"].includes(runtime.experimentMode);
    const isEditor = runtime.experimentMode === "editor";
    const isPreview = runtime.experimentMode === "preview" || isEditor;
    const editor = document.getElementById("trial-editor");
    if (editor) editor.hidden = !isEditor;
    elements.category.closest("label").hidden = !isPreview || isEditor;
    if (isPreview) window.clearTimeout(runtime.eegReconnectTimer);
    elements.participantId.closest("label").hidden = isPreview;
    elements.recordingSpeed.closest("label").hidden = runtime.experimentMode !== "recording" && !usingLiveTrialLibrary();
    elements.eegStreamSelect.closest("label").hidden = isPreview;
    elements.eegTopConnect.hidden = isPreview;
    elements.exampleReviewControl.hidden = !isPreview || isEditor;
    for (const field of [elements.classFilter, elements.scenario, elements.layout]) {
      field.closest("label").hidden = runtime.experimentMode === "recording" || isEditor;
    }
    if (runtime.experimentMode === "recording" && !runtime.sessionId) {
      runtime.trialNumber = 0;
      runtime.trialCount = recordingSelection().total;
      elements.playbackStatus.textContent = "Start a session to load the first trial";
    }
    elements.decoderField.hidden = !isPlay;
    elements.decoderPanel.hidden = !isPlay;
    elements.decoderConfidence.textContent = isPlay
      ? "Waiting for a valid rolling decoder window"
      : "Pure recording · labels are currently nullable";
    syncRawEegVisibility();
    syncValueMapVisibility();
    sizeGameWindow();
    if (focusModeActive()) window.scrollTo(0, 0);
    syncControls();
    if (isEditor && editorReady && !runtime.editorOpen) {
      runtime.editorOpen = true;
      window.dispatchEvent(new CustomEvent("trial-editor-open", {
        detail: { alias: runtime.selectedScenario?.trial_alias, version: runtime.selectedScenario?.trial_version },
      }));
    }
    if (runtime.editorOpen && !isEditor) {
      runtime.editorOpen = false;
      window.dispatchEvent(new CustomEvent("trial-editor-close"));
    }
    if (isPlay && playing.active) playing.visibility();
  }

  function updateRecordingCounts() {
    if (runtime.sessionId || runtime.arming || runtime.running) return;
    runtime.trialNumber = 0;
    runtime.trialCount = recordingSelection().total;
    syncControls();
  }

  function scheduleEegReconnect(status) {
    window.clearTimeout(runtime.eegReconnectTimer);
    runtime.eegReconnectTimer = null;
    if (["play", "presentation"].includes(runtime.experimentMode) && (playing.recorded || playing.keyboardSelected)) return;
    if (["preview", "editor"].includes(runtime.experimentMode) || (["live", "mock"].includes(status?.mode) && status?.status === "connected")) return;
    runtime.eegReconnectTimer = window.setTimeout(() => connectEeg(false), 3000);
  }

  function selectEegSource() {
    runtime.eegSourceChoice = elements.eegStreamSelect.value;
    return connectEeg(true, true);
  }

  async function connectEeg(force = false, useSelectedSource = true) {
    if (playing.keyboardSelected && runtime.experimentMode === "play") return runtime.eegStatus;
    if (runtime.eegConnecting) return runtime.eegStatus;
    window.clearTimeout(runtime.eegReconnectTimer);
    runtime.eegReconnectTimer = null;
    const sourceId = useSelectedSource
      ? (runtime.eegSourceChoice ?? elements.eegStreamSelect.value) || undefined : undefined;
    const mode = sourceId === MOCK_EEG_SOURCE ? "mock" : "live";
    runtime.eegConnecting = true;
    runtime.eegSourceChoice = sourceId || "";
    elements.eegStreamSelect.disabled = true;
    elements.eegConnect.disabled = true;
    elements.eegTopConnect.disabled = true;
    elements.eegTopConnect.textContent = "Connecting…";
    try {
      const status = await api("/api/eeg/connect", {
        method: "POST",
        body: JSON.stringify({
          mode, source_id: mode === "live" ? sourceId : undefined, force: Boolean(force),
        }),
      });
      if (status.status === "connected") {
        runtime.eegSourceChoice = status.mode === "mock" ? MOCK_EEG_SOURCE
          : status.source_id || status.stream_name || sourceId || "";
      }
      updateEegStatus(status);
      scheduleEegReconnect(status);
      setSystemStatus(
        status.buffer_ready ? `EEG ready · ${status.stream_name}` : `EEG buffering · ${status.stream_name}`,
        true,
      );
      return status;
    } catch (error) {
      const status = error.payload || await api("/api/eeg/status");
      updateEegStatus(status);
      scheduleEegReconnect(status);
      setSystemStatus(`EEG: ${status.last_error || error.message}`, false);
      return status;
    } finally {
      runtime.eegConnecting = false;
      elements.eegStreamSelect.disabled = runtime.running || runtime.arming || runtime.librarySession;
      elements.eegConnect.disabled = runtime.running || runtime.arming || runtime.librarySession;
      elements.eegTopConnect.disabled = runtime.running || runtime.arming || runtime.librarySession;
      elements.eegTopConnect.textContent = runtime.eegStatus?.status === "connected"
        ? "Reconnect EEG" : "Connect EEG";
      renderEegSources();
    }
  }

  function scheduleNextTick() {
    window.clearTimeout(runtime.timer);
    if (!runtime.running || runtime.paused) return;
    const due = runtime.clock.dueAt(runtime.tick);
    runtime.timer = window.setTimeout(runTick, Math.max(0, Math.ceil(due - performance.now())));
  }

  function hidePreScenarioFixation() {
    elements.preScenarioOverlay.hidden = true;
  }

  function startPreScenarioFixation() {
    window.clearTimeout(runtime.timer);
    elements.preScenarioOverlay.hidden = false;
    setTrialPhase("FIXATION");
    elements.playbackStatus.textContent = "Fixation · 2 s";
    setSystemStatus("Fixation · example begins in 2 seconds", true);
    runtime.timer = window.setTimeout(() => {
      if (!runtime.running) return;
      hidePreScenarioFixation();
      setTrialPhase("RUNNING");
      setSystemStatus("Example running · one critical event", true);
      runtime.clock.start(performance.now());
      scheduleNextTick();
    }, PRE_SCENARIO_FIXATION_MS);
  }

  async function runTick() {
    if (!runtime.running || runtime.paused || runtime.requestInFlight) return;
    // A browser timer can wake early; never shorten the context or repair delay.
    if (performance.now() < runtime.clock.dueAt(runtime.tick)) {
      scheduleNextTick();
      return;
    }
    runtime.requestInFlight = true;
    const requestSession = runtime.sessionId;
    const requestTick = runtime.tick;
    try {
      const [humanName, aiName] = runtime.playback.trajectory[requestTick];
      const Action = window.Overcooked.OvercookedMDP.Action;
      const names = ["NORTH", "SOUTH", "EAST", "WEST", "STAY", "INTERACT"];
      const before = runtime.state;
      const transition = runtime.game.mdp.get_transition_states_and_probs({
        state: before,
        joint_action: [humanName, aiName].map(name => Action.INDEX_TO_ACTION[names.indexOf(name)]),
      });
      // Render on the local monotonic clock, before network I/O. The stored
      // actions are authoritative; a decoder never chooses this correction.
      const presentedAt = performance.now();
      runtime.clock.present(requestTick, presentedAt);
      const isEvent = requestTick === runtime.playback.event_tick;
      const isCorrection = requestTick === runtime.playback.correction_tick;
      const elapsed = presentedAt - runtime.clock.startedAt;
      if (isCorrection) runtime.correctionDelayMs = presentedAt - runtime.clock.eventPresentedAt;
      runtime.state = transition[0][0];
      runtime.score += transition[1];
      renderOrders(runtime.state);
      runtime.tick += 1;
      runtime.game.motion.drawState(runtime.state, {
        actions: [humanName, aiName], nextActions: runtime.playback.trajectory[runtime.tick]
      });
      runtime.game.drawScore(runtime.score);
      elements.playbackStatus.textContent = isCorrection
        ? `Scripted correction · +${runtime.playback.correction_delay_ms / 1000} s`
        : isEvent ? `Critical event · ${runtime.playback.expected_class}`
        : requestTick < runtime.playback.event_tick ? "Context"
        : runtime.playback.correction_tick != null && requestTick > runtime.playback.correction_tick
          ? "Corrected behavior" : "Observe the action";
      if (runtime.librarySession) elements.playbackStatus.textContent = "Watch the collaboration";
      const payload = await api("/api/tick", {
        method: "POST",
        body: JSON.stringify({
          session_id: requestSession, tick_id: requestTick, state: before,
          trial_id: runtime.trialId,
          client_time_ms: presentedAt, presentation_time_ms: presentedAt,
          presentation_elapsed_ms: elapsed, client_timed_playback: true,
          event_to_correction_ms: isCorrection ? runtime.correctionDelayMs : undefined,
        }),
      });
      if (requestSession !== runtime.sessionId || requestTick + 1 !== runtime.tick) return;
      if (payload.paused_for_eeg) throw new Error(runtime.librarySession
        ? "EEG interrupted · session ended early; reconnect before starting a new session"
        : "EEG interrupted · replay this short trial when ready");
      if (payload.human_action_name !== humanName || payload.final_ai_action_name !== aiName) {
        throw new Error("Stored playback disagreed with server actions");
      }
      updateHeatmap(payload.value_map);
      elements.decoderAction.textContent = aiName;
      if (payload.scripted_correction) runtime.revisions += 1;
      elements.revisions.textContent = String(runtime.revisions);
      if (["play", "presentation"].includes(runtime.experimentMode) && payload.adaptation_signal) {
        const signal = payload.adaptation_signal;
        elements.rpeValue.textContent = signal.ema_rpe_probability == null ? "—" : `${Math.round(signal.ema_rpe_probability * 100)}%`;
        elements.speValue.textContent = signal.ema_spe_probability == null ? "—" : `${Math.round(signal.ema_spe_probability * 100)}%`;
        elements.decodedClass.textContent = signal.decoded_class || "UNDECIDED";
        elements.decoderConfidence.textContent = "Decoder observed only · correction is scripted";
      }
      if (payload.done) {
        runtime.timer = window.setTimeout(finishDemo, Math.max(0, runtime.clock.dueAt(runtime.trajectoryLength) - performance.now()));
        return;
      }
    } catch (error) {
      if (requestSession !== runtime.sessionId) return;
      runtime.running = false;
      runtime.paused = false;
      elements.playbackStatus.textContent = error.message;
      setSystemStatus(`Error: ${error.message}`, false);
      elements.start.textContent = "Play";
      await stopActiveSession("playback_error").catch(() => {});
      syncControls();
      return;
    } finally {
      runtime.requestInFlight = false;
    }
    scheduleNextTick();
  }

  function loadRecordingTrial(session) {
    runtime.instructionsEnabled = Boolean(session.instructions_enabled);
    runtime.ratingsEnabled = Boolean(session.ratings_enabled);
    runtime.trialsWatched = session.trials_completed || 0;
    runtime.responsesSubmitted = session.responses_submitted || 0;
    runtime.trialId = session.trial_id;
    runtime.trialNumber = session.trial_number;
    runtime.trialCount = session.trial_count;
    runtime.hintConfirmed = session.hint_confirmed;
    runtime.selectedScenario = session.playback;
    runtime.selectedScenarioId = session.scenario_id;
    runtime.playback = session.playback;
    runtime.trajectoryLength = session.trajectory_length;
    runtime.trialMode = true;
    runtime.correctionDelayMs = null;
    runtime.clock = new window.TrialClock(session.playback.step_ms, session.playback.event_tick);
    elements.briefingTitle.textContent = `Trial ${runtime.trialNumber} · Briefing`;
    elements.briefingExpectation.textContent = session.playback.human_expectation;
    initializeGame();
    resetReadout();
    resetDecoderUI();
    setTrialPhase("HINT");
    elements.sessionLabel.textContent = `Session ${runtime.runId.slice(0, 8)} · ${session.participant_id} · Trial ${runtime.trialNumber} of ${runtime.trialCount}`;
    elements.playbackStatus.textContent = "Confirm the Briefing to start this trial";
    setSystemStatus("EEG recording · read the next Briefing", true);
  }

  async function startRecordingSession() {
    if (runtime.arming || runtime.sessionId || runtime.experimentMode !== "recording") return;
    const selection = recordingSelection();
    if (!selection.valid) {
      setSystemStatus("Enter valid trial counts before starting", false);
      return;
    }
    const participantId = elements.participantId.value.trim();
    if (!participantId) {
      setSystemStatus("Participant ID is required", false);
      elements.participantId.focus();
      return;
    }
    runtime.arming = true;
    syncControls();
    try {
      elements.playbackStatus.textContent = "Preparing recording trials…";
      const armed = await api("/api/session", {
        method: "POST",
        body: JSON.stringify({
          experiment_mode: "recording", recording_scope: "library", participant_id: participantId,
          recording_session_id: runtime.recordingSessionId,
          ...(selection.profile?.custom_counts ? {recording_counts: selection.counts} : {}),
          instructions_enabled: Boolean(elements.instructionsEnabled.checked),
          ratings_enabled: Boolean(elements.ratingsEnabled.checked),
          step_ms: runtime.playbackSpeeds[Number(elements.speed.value)].step_ms,
        }),
      });
      runtime.sessionId = armed.session_id;
      runtime.runId = armed.run_id;
      runtime.librarySession = true;
      const session = await api(`/api/session/${runtime.sessionId}/start`, { method: "POST", body: "{}" });
      loadRecordingTrial(session);
    } catch (error) {
      if (runtime.sessionId) await stopActiveSession("start_failed").catch(() => {});
      if (runtime.stopPending) return;
      elements.playbackStatus.textContent = error.message;
      setSystemStatus(`Could not start recording: ${error.message}`, false);
    } finally {
      runtime.arming = false;
      syncControls();
    }
    if (runtime.librarySession && runtime.trialPhase === "HINT" && runtime.instructionsEnabled && !runtime.stopPending) {
      window.ParticipantGuide?.open();
    }
  }

  async function confirmRecordingHint() {
    if (["play", "presentation"].includes(runtime.experimentMode)) return playing.confirm();
    if (!runtime.librarySession || runtime.arming || runtime.running || runtime.stopPending) return;
    runtime.arming = true;
    syncControls();
    try {
      if (!runtime.hintConfirmed) {
        const session = await api(`/api/session/${runtime.sessionId}/hint-confirmed`, {
          method: "POST", body: JSON.stringify({ trial_id: runtime.trialId }),
        });
        runtime.hintConfirmed = session.hint_confirmed;
      }
      setTrialPhase("READY");
      await api(`/api/session/${runtime.sessionId}/trial-start`, {
        method: "POST", body: JSON.stringify({ trial_id: runtime.trialId }),
      });
      runtime.running = true;
      runtime.paused = false;
      runtime.autoEegPause = false;
      startPreScenarioFixation();
    } catch (error) {
      elements.playbackStatus.textContent = `Could not start trial: ${error.message}`;
      setSystemStatus(`Could not start trial: ${error.message}`, false);
    } finally {
      runtime.arming = false;
      syncControls();
    }
  }

  async function startDemo() {
    if (["play", "presentation"].includes(runtime.experimentMode)) return playing.confirm();
    if (runtime.running || runtime.arming || !runtime.selectedScenario) return;
    if (["recording", "editor"].includes(runtime.experimentMode)) return;
    const participantId = elements.participantId.value.trim();
    if (elements.experimentMode.value !== "preview" && !participantId) {
      setSystemStatus("Participant ID is required", false);
      elements.participantId.focus();
      return;
    }
    if (elements.experimentMode.value === "play" && !elements.decoderSelect.value) {
      setSystemStatus("Register and select a trained decoder first", false);
      return;
    }
    runtime.arming = true;
    syncControls();
    setSystemStatus("Preparing example", false);
    try {
      const armed = await api("/api/session", {
        method: "POST",
        body: JSON.stringify({
          experiment_mode: elements.experimentMode.value,
          participant_id: participantId,
          scenario_id: runtime.selectedScenarioId,
          alias: runtime.selectedScenario.trial_alias || undefined,
          version: runtime.selectedScenario.trial_version || undefined,
          trial_structure: "single",
          step_ms: runtime.selectedScenario.step_ms,
          layout_name: runtime.selectedScenario?.layout_name,
          scenario_name: "proactive_relay",
          decoder_id: elements.experimentMode.value === "play"
            ? elements.decoderSelect.value : undefined,
        }),
      });
      runtime.sessionId = armed.session_id;
      runtime.runId = armed.run_id;
      runtime.experimentMode = armed.experiment_mode;
      runtime.trajectoryLength = armed.trajectory_length;
      runtime.playback = armed.playback;
      runtime.clock = new window.TrialClock(armed.playback.step_ms, armed.playback.event_tick);
      runtime.correctionDelayMs = null;
      runtime.scenarioName = armed.scenario_name;
      runtime.trialMode = true;
      initializeGame();
      resetReadout();
      resetDecoderUI();
      syncModeUI();
      const session = await api(`/api/session/${runtime.sessionId}/start`, {
        method: "POST", body: "{}",
      });
      runtime.trialPhase = session.trial_phase || "RUNNING";
      runtime.running = true;
      runtime.arming = false;
      runtime.paused = false;
      runtime.autoEegPause = false;
      elements.start.textContent = "Play";
      syncControls();
      elements.sessionLabel.textContent = `Example ${runtime.runId.slice(0, 8)} · ${runtime.experimentMode === "preview" ? "Preview · no EEG recording" : participantId + " · " + runtime.experimentMode} · ${runtime.selectedScenario?.title || runtime.scenarioName}`;
      startPreScenarioFixation();
    } catch (error) {
      runtime.running = false;
      runtime.paused = false;
      runtime.arming = false;
      if (runtime.sessionId) await stopActiveSession("start_failed").catch(() => {});
      syncControls();
      if (runtime.stopPending) return;
      elements.layout.disabled = false;
      elements.scenario.disabled = false;
      setSystemStatus(`Error: ${error.message}`, false);
    }
  }

  function pauseDemo() {
    if (!runtime.running || runtime.paused) return;
    runtime.paused = true;
    runtime.game?.motion.finish();
    window.clearTimeout(runtime.timer);
    syncControls();
    setSystemStatus("Demo paused", true);
  }

  function resumeDemo() {
    if (!runtime.running || !runtime.paused) return;
    if (["CRITICAL_EVENT", "EEG_DECODING", "RESULT", "AI_REPAIR"].includes(runtime.trialPhase)) return;
    if (runtime.pausedForMismatch) {
      resumeMismatch();
      return;
    }
    runtime.paused = false;
    syncControls();
    setSystemStatus("Q-map running", true);
    scheduleNextTick();
  }

  async function stopActiveSession(reason) {
    if (!runtime.sessionId) return;
    const id = runtime.sessionId;
    runtime.sessionId = null;
    try {
      await api(`/api/session/${id}/stop`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      if (runtime.librarySession) {
        elements.playbackStatus.textContent = `Session ended early · ${runtime.trialsWatched} of ${runtime.trialCount} trials watched${runtime.ratingsEnabled ? ` · ${runtime.responsesSubmitted} responses saved` : ""}`;
      }
      runtime.librarySession = false;
      runtime.hintConfirmed = false;
      runtime.trialId = null;
      runtime.stopPending = false;
    } catch (error) {
      runtime.sessionId = id;
      runtime.stopPending = true;
      elements.playbackStatus.textContent = "Stop not confirmed · try End session again";
      setSystemStatus("Could not end recording · check the server and retry End session", false);
      console.warn("Could not stop session", error);
      throw error;
    }
  }

  async function resetDemo() {
    if (["play", "presentation"].includes(runtime.experimentMode)) return playing.reset();
    if (runtime.arming) return;
    elements.playbackStatus.textContent = "Ready · play this example";
    runtime.arming = true;
    runtime.running = false;
    runtime.paused = false;
    syncControls();
    window.clearTimeout(runtime.timer);
    hidePreScenarioFixation();
    window.clearInterval(runtime.trialPoll);
    try {
      await stopActiveSession("reset");
    } catch (error) {
      runtime.arming = false;
      syncControls();
      setSystemStatus("Could not end recording · try End session again", false);
      return;
    }
    initializeGame();
    resetReadout();
    resetDecoderUI();
    elements.start.textContent = "Play";
    runtime.arming = false;
    runtime.trialNumber = 0;
    syncControls();
    elements.layout.disabled = false;
    elements.scenario.disabled = runtime.running;
    elements.sessionLabel.textContent = "No active session";
    setSystemStatus("Ready", true);
    if (runtime.experimentMode === "recording") {
      elements.playbackStatus.textContent = "Start a new session for a new randomized order";
    }
  }

  async function finishDemo() {
    if (!runtime.running) return;
    runtime.game?.motion.finish();
    const id = runtime.sessionId;
    window.clearTimeout(runtime.timer);
    hidePreScenarioFixation();
    runtime.running = false;
    runtime.arming = true;
    syncControls();
    try {
      const completed = await api(`/api/session/${id}/complete`, {
        method: "POST", body: JSON.stringify({ trial_id: runtime.trialId }),
      });
      if (runtime.sessionId !== id) return;
      runtime.trialsWatched = completed.trials_completed ?? runtime.trialNumber;
      if (runtime.librarySession && completed.trial_phase === "RESPONSE") {
        setTrialPhase("RESPONSE");
        window.ParticipantGuide.showResponse(completed);
        elements.playbackStatus.textContent = "Rate this scene to continue · EEG recording continues";
        setSystemStatus("EEG recording · your rating", true);
        return;
      }
      if (runtime.librarySession && completed.lifecycle_state === "RUNNING") {
        loadRecordingTrial(completed);
        return;
      }
      const wasLibrary = runtime.librarySession;
      runtime.sessionId = null;
      runtime.librarySession = false;
      runtime.hintConfirmed = false;
      runtime.running = false;
      runtime.paused = false;
      setTrialPhase("COMPLETE");
      elements.start.textContent = "Play";
      elements.playbackStatus.textContent = runtime.correctionDelayMs == null
        ? "Complete · aligned behavior, no correction"
        : `Complete · scripted correction at +${(runtime.correctionDelayMs / 1000).toFixed(2)} s`;
      setSystemStatus("Example complete · replay or choose another", true);
      if (wasLibrary) {
        elements.playbackStatus.textContent = "Session complete · recording saved";
        setSystemStatus("Recording session complete", true);
      }
      syncControls();
    } catch (error) {
      await stopActiveSession("completion_failed").catch(() => {});
      if (!runtime.stopPending) elements.playbackStatus.textContent = `Could not finalize: ${error.message}`;
    } finally {
      runtime.arming = false;
      syncControls();
    }
  }

  async function submitTrialResponse(answer) {
    if (!runtime.librarySession || runtime.trialPhase !== "RESPONSE" || runtime.arming || runtime.stopPending) return;
    const id = runtime.sessionId;
    runtime.arming = true;
    syncControls();
    try {
      const saved = await api(`/api/session/${id}/response`, {
        method: "POST", body: JSON.stringify(answer),
      });
      if (runtime.sessionId !== id) return;
      runtime.responsesSubmitted = saved.responses_submitted;
      if (saved.lifecycle_state === "RUNNING") {
        loadRecordingTrial(saved);
      } else {
        runtime.sessionId = null;
        runtime.librarySession = false;
        runtime.hintConfirmed = false;
        setTrialPhase("COMPLETE");
        elements.playbackStatus.textContent = "Session complete · recording and responses saved";
        setSystemStatus("Recording session complete", true);
      }
    } finally {
      // A failed request leaves the response phase and form intact for retry.
      runtime.arming = false;
      syncControls();
      if (runtime.librarySession && runtime.trialPhase === "HINT") elements.confirmHint.focus();
    }
  }

  async function changeWorkspaceMode() {
    const generation = runtime.modeGeneration = (runtime.modeGeneration || 0) + 1;
    const loading = window.DemoLoading;
    const ticket = loading?.current();
    const cancelled = () => generation !== runtime.modeGeneration || (loading && !loading.isCurrent(ticket));
    // Invalidate an older activation immediately. Serialize teardown only;
    // a slow catalogue from the previous mode must not block the next one.
    if (playing.active) ++playing.generation;
    runtime.modeTransition = (runtime.modeTransition || Promise.resolve()).catch(() => {}).then(async () => {
      if (cancelled()) return;
      if (playing.active) await playing.deactivate();
      if (!cancelled()) syncModeUI({editorReady: Boolean(runtime.catalogueReady)});
    });
    try {
      await runtime.modeTransition;
      if (cancelled()) return;
      if (!runtime.catalogueReady) {
        if (runtime.startupError) throw runtime.startupError;
        return;
      }
      if (["play", "presentation"].includes(runtime.experimentMode)) {
        await playing.activate();
        if (playing.state === "UNAVAILABLE") throw new Error(elements.playbackStatus.textContent);
      } else if (runtime.experimentMode === "editor") {
        if (loading && !window.TrialEditorReady) throw new Error('Trial Editor could not start. Reload the page and try again.');
        await window.TrialEditorReady;
      } else {
        selectCategory(elements.classFilter.value);
        if (loading) await loading.waitForRenderer([runtime.game], cancelled);
        scanEegSources();
        if (!["live", "mock"].includes(runtime.eegStatus?.mode) || runtime.eegStatus?.status !== "connected")
          connectEeg(false).catch(error => setSystemStatus(error.message, false));
      }
      if (!cancelled()) await loading?.finish(ticket);
    } catch (error) {
      if (!cancelled()) {
        setSystemStatus(`Error: ${error.message}`, false);
        loading?.fail(ticket, error);
      }
    }
  }

  async function boot() {
    const params = new URLSearchParams(window.location.search);
    const requestedMode = window.DemoLoading?.current().mode || (window.StaticReplay
      ? (params.get("mode") === "presentation" ? "presentation" : "play")
      : params.get("mode"));
    if ([...elements.experimentMode.options].some(option => option.value === requestedMode))
      elements.experimentMode.value = requestedMode;
    if (!window.StaticReplay && requestedMode === "play" && params.get("session") === "keyboard")
      document.getElementById("playing-session-type").value = "keyboard";
    // Show the destination even while the API is loading or unavailable. Open
    // the editor controller only after its scripts and the catalogue are ready.
    syncModeUI({ editorReady: false });
    window.ParticipantGuide.init(submitTrialResponse, async () => {
      await resetDemo();
      if (runtime.sessionId) throw new Error("Could not end the session. Try End session again.");
    });
    elements.instructionsEnabled.addEventListener("change", syncControls);
    elements.ratingsEnabled.addEventListener("change", syncControls);
    syncControls();
    elements.start.addEventListener("click", startDemo);
    elements.startRecording.addEventListener("click", startRecordingSession);
    elements.recordingNonpeCount.addEventListener("input", updateRecordingCounts);
    elements.recordingPeCount.addEventListener("input", updateRecordingCounts);
    elements.confirmHint.addEventListener("click", confirmRecordingHint);
    const changeSelection = change => ["play", "presentation"].includes(runtime.experimentMode)
      ? playing.changeLive(change) : change();
    const changeSpeed = () => changeSelection(() => selectScenario(runtime.selectedScenarioId));
    elements.speed.addEventListener("input", changeSpeed);
    elements.recordingSpeed.addEventListener("change", () => {
      if ((runtime.experimentMode !== "recording" && !usingLiveTrialLibrary()) || elements.speed.disabled) return;
      elements.speed.value = elements.recordingSpeed.value;
      changeSpeed();
    });
    elements.reset.addEventListener("click", resetDemo);
    elements.valueMapToggle.addEventListener("click", toggleValueMap);
    elements.rawEegToggle.addEventListener("click", toggleRawEegPanel);
    elements.probabilityToggle.addEventListener("click", toggleProbabilityPanel);
    elements.focusModeToggle.addEventListener("click", toggleFocusMode);
    document.addEventListener("fullscreenchange", sizeGameWindow);
    document.addEventListener("webkitfullscreenchange", sizeGameWindow);
    syncFocusModeUI();
    elements.eegConnect.addEventListener("click", () => connectEeg(true, true));
    elements.eegTopConnect.addEventListener("click", () => connectEeg(true, true));
    elements.eegStreamSelect.addEventListener("change", selectEegSource);
    elements.eegStreamSelect.addEventListener("focus", scanEegSources);
    elements.eegStreamSelect.addEventListener("blur", renderEegSources);
    elements.retryEvent.addEventListener("click", () => applyRepair("retry"));
    document.querySelectorAll("[data-manual]").forEach((button) =>
      button.addEventListener("click", () => applyRepair("manual", button.dataset.manual)));
    elements.layout.addEventListener("change", () => changeSelection(renderScenarioOptions));
    elements.category.addEventListener("change", () => selectCategory());
    elements.classFilter.addEventListener("change", () => changeSelection(selectCondition));
    elements.scenario.addEventListener("change", () => changeSelection(() => usesTrialFiles()
      ? selectTrialAlias(elements.scenario.value, elements.classFilter.value) : selectScenario(elements.scenario.value)));
    elements.experimentMode.addEventListener("change", changeWorkspaceMode);
    if (window.DemoLoading) window.DemoLoading.retry = () => {
      if (!runtime.catalogueReady) { window.location.reload(); return; }
      window.DemoLoading.begin(elements.experimentMode.value);
      // A failed initial editor load can be opened again without losing drafts.
      if (runtime.experimentMode === "editor") runtime.editorOpen = false;
      changeWorkspaceMode();
    };
    window.addEventListener("trial-library-reloaded", async event => {
      try {
        await loadScenarios();
        const selected = runtime.scenarios.find(s => s.trial_alias === event.detail.alias && s.trial_version === event.detail.version);
        if (selected) {
          elements.category.value = selected.category_id;
          runtime.selectedScenarioId = selected.id;
          selectCategory(selected.expected_class);
        }
        setSystemStatus("Saved trial library loaded for new sessions", true);
      } catch (error) { setSystemStatus(`Reload failed: ${error.message}`, false); }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && playing.active && playing.busy) { playing.reset(); return; }
      if (document.hidden && runtime.running) {
        resetDemo();
        elements.playbackStatus.textContent = "Interrupted · keep this tab visible, then replay";
      }
    });
    window.addEventListener("pagehide", () => {
      if (window.StaticReplay) return;
      if (runtime.sessionId) navigator.sendBeacon(`/api/session/${runtime.sessionId}/stop`,
        new Blob([JSON.stringify({ reason: "page_closed" })], { type: "application/json" }));
    });
    window.addEventListener("resize", sizeGameWindow);
    const displayObserver = new ResizeObserver(syncDisplayHeight);
    displayObserver.observe(elements.displaySurface);
    displayObserver.observe(elements.gameHeading);
    displayObserver.observe(elements.stage);
    window.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && runtime.pausedForMismatch && !runtime.trialMode) {
        event.preventDefault(); resumeMismatch();
      }
    });
    openEventStream();
    try {
      const health = await api("/api/health");
      updateEegStatus(health.eeg);
      const eegStatus = health.eeg;
      await Promise.all([loadScenarios(), loadDecoders()]);
      runtime.catalogueReady = true;
      scanEegSources();
      resetDecoderUI();
      syncValueMapVisibility();
      setSystemStatus(
        ["preview", "editor"].includes(runtime.experimentMode) ? "Ready · choose an example, no EEG needed"
          : eegStatus.status === "connected"
          ? `Ready · ${eegStatus.stream_name}`
          : `Ready · ${eegStatus.last_error || "select live or Mock EEG"}`,
        ["preview", "editor"].includes(runtime.experimentMode) || eegStatus.status === "connected",
      );
      await changeWorkspaceMode();
    } catch (error) {
      setSystemStatus(`Error: ${error.message}`, false);
      elements.start.disabled = true;
      runtime.startupError = error;
      window.DemoLoading?.fail(window.DemoLoading.current(), error);
    }
  }

  const playing = new window.PlayingSessions({
    api, status: setSystemStatus, eegStatus: () => runtime.eegStatus,
    floorIndicators: (marks = []) => {
      const scene = runtime.game?.game?.scene?.getScene('PlayGame');
      if (!scene?.add) return;
      const graphics = scene.presentationFloor ||= scene.add.graphics().setDepth(.05);
      graphics.clear(); scene.presentationFloorIndicators = marks;
      // Floor tiles are depth 0; chefs, loose items and cabinet rows cover
      // these marks naturally, using the kitchen's existing ground order.
      for (const mark of marks) for (const [width, color] of [[6, 0xffffff], [2.5, parseInt(mark.color.slice(1), 16)]]) {
        graphics.lineStyle(width, color, 1); graphics.fillStyle(color, 1);
        for (const points of mark.segments) {
          graphics.beginPath();
          points.forEach(([x, y], i) => graphics[i ? 'lineTo' : 'moveTo'](x * runtime.tileSize, y * runtime.tileSize));
          graphics.strokePath();
          for (const [x, y] of points) graphics.fillCircle(x * runtime.tileSize, y * runtime.tileSize, width / 2);
        }
      }
    },
    syncPanels: syncRawEegVisibility,
    selectLive: () => selectCategory(elements.classFilter.value),
    liveSelection: () => ({scenario_id: runtime.selectedScenarioId,
      step_ms: runtime.playbackSpeeds[Number(elements.speed.value)].step_ms}),
    release: () => {
      runtime.sessionId = null; runtime.running = false; runtime.arming = false;
      runtime.librarySession = false; runtime.requestInFlight = false;
      window.clearTimeout(runtime.timer); window.clearTimeout(runtime.eegReconnectTimer);
    },
    ready: async cancelled => {
      const game = runtime.game, deadline = performance.now() + 15000;
      while (!cancelled()) {
        if (game.game?.scene?.getScene('PlayGame')?.sprites?.chefs?.[0]) return;
        if (performance.now() > deadline) throw new Error('Game renderer did not become ready. Reload and retry.');
        await new Promise(resolve => setTimeout(resolve, 30));
      }
    },
    mount: session => {
      runtime.sessionId = session.session_id;
      runtime.selectedScenario = runtime.playback = {...session.playback,
        animation_ms: (session.playback.animation_ms || 375) / (session.playback_rate || 1)};
      runtime.selectedScenarioId = session.playback.id;
      runtime.tick = 0; runtime.score = 0;
      elements.briefingTitle.textContent = "Briefing";
      elements.briefingExpectation.textContent = session.playback.human_expectation;
      elements.sessionLabel.textContent = `${session.participant_id} · ${session.playing_session_type === "pre_recorded" ? "Pre-recorded session" : "Real-time session"}`;
      elements.mismatchPanel.hidden = true;
      elements.undecidedPanel.hidden = true;
      initializeGame();
      return {at: 0, tick: 0, score: 0, state: JSON.parse(JSON.stringify(runtime.state)), before: null, actions: null};
    },
    action: (row, clocked) => {
      if (!clocked && row.index !== runtime.tick) return;
      // Recorded actions carry authoritative pre-action state and their own
      // index. Rendering/seeking must never silently discard a scheduled move.
      if (clocked && !row.before) throw new Error('Recorded action is missing its frozen state');
      const {Action, OvercookedState} = window.Overcooked.OvercookedMDP;
      if (row.before) runtime.state = OvercookedState.from_object(JSON.parse(JSON.stringify(row.before)));
      const before = JSON.parse(JSON.stringify(runtime.state));
      const names = ["NORTH", "SOUTH", "EAST", "WEST", "STAY", "INTERACT"];
      const transition = runtime.game.mdp.get_transition_states_and_probs({state: runtime.state,
        joint_action: row.actions.map(name => Action.INDEX_TO_ACTION[names.indexOf(name)])});
      runtime.state = transition[0][0]; runtime.score += transition[1]; runtime.tick = row.index + 1;
      if (!clocked) runtime.game.motion.drawState(runtime.state, {
        actions: row.actions, nextActions: runtime.playback.trajectory[row.index + 1]
      });
      const motion = row.actions.map((action, player) => {
        let distance = 0;
        for (let i = row.index - 1; i >= 0 && runtime.playback.trajectory[i]?.[player]
          && runtime.playback.trajectory[i][player] !== 'STAY'; i--) distance++;
        const next = runtime.playback.trajectory[row.index + 1]?.[player];
        return {distance, wasMoving: distance > 0, continues: next !== undefined && next !== 'STAY'};
      });
      renderOrders(runtime.state);
      return {at: row.at, tick: runtime.tick, score: runtime.score,
        state: JSON.parse(JSON.stringify(runtime.state)), before, actions: [...row.actions], motion};
    },
    showHistory: (snapshot, time, animationMs, restore) => {
      const {OvercookedState} = window.Overcooked.OvercookedMDP;
      if (restore) {
        runtime.state = OvercookedState.from_object(JSON.parse(JSON.stringify(snapshot.state)));
        runtime.tick = snapshot.tick; runtime.score = snapshot.score;
      }
      // The same eased movement and gait follow the recorded source time.
      // Fractional positions belong only to the display copy, never the MDP.
      const progress = Math.max(0, Math.min(1, (time - snapshot.at) * 1000 / animationMs));
      const gaitProgress = Math.max(0, Math.min(1, (time - snapshot.at) * 1000 / runtime.playback.step_ms));
      runtime.game.motion.drawAt(OvercookedState.from_object(JSON.parse(JSON.stringify(snapshot.state))), {
        before: snapshot.before, actions: snapshot.actions, progress, gaitProgress, motion: snapshot.motion
      });
      renderOrders(OvercookedState.from_object(JSON.parse(JSON.stringify(snapshot.state))));
    },
  });
  boot();
})();
