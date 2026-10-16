(function () {
  "use strict";

  const START_GRID = ["XXPXX", "O  2O", "T1  T", "XDPSX"];
  const elements = {
    systemStatus: document.getElementById("system-status"),
    start: document.getElementById("start-button"),
    pause: document.getElementById("pause-button"),
    reset: document.getElementById("reset-button"),
    speed: document.getElementById("speed"),
    speedValue: document.getElementById("speed-value"),
    score: document.getElementById("score"),
    step: document.getElementById("step-count"),
    humanAction: document.getElementById("human-action"),
    aiAction: document.getElementById("ai-action"),
    arbitration: document.getElementById("arbitration"),
    eegConnection: document.getElementById("eeg-connection"),
    revisions: document.getElementById("revision-count"),
    eventLog: document.getElementById("event-log"),
    sessionLabel: document.getElementById("session-label"),
    container: document.getElementById("overcooked"),
  };

  const runtime = {
    game: null,
    state: null,
    sessionId: null,
    trajectoryLength: 0,
    tick: 0,
    score: 0,
    revisions: 0,
    running: false,
    paused: false,
    timer: null,
    requestInFlight: false,
  };

  function setSystemStatus(text, online) {
    elements.systemStatus.lastChild.textContent = ` ${text}`;
    elements.systemStatus.classList.toggle("online", Boolean(online));
  }

  async function api(path, options) {
    const response = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `${response.status} ${response.statusText}`);
    }
    return payload;
  }

  function initializeGame() {
    if (!window.Overcooked) {
      throw new Error("Overcooked runtime did not load");
    }
    if (runtime.game) {
      runtime.game.close();
    }
    elements.container.innerHTML = "";
    const Game = window.Overcooked.OvercookedGame.OvercookedGame;
    runtime.game = new Game({
      start_grid: START_GRID,
      container_id: "overcooked",
      tileSize: 104,
      gameWidth: 520,
      gameHeight: 416,
      ANIMATION_DURATION: 120,
      assets_loc: "static/assets/",
      COOK_TIME: 2,
      explosion_time: Number.MAX_SAFE_INTEGER,
      DELIVERY_REWARD: 20,
      player_colors: { 0: "green", 1: "blue" },
    });
    runtime.game.init();
    runtime.state = runtime.game.mdp.get_start_state(["onion"]);
    runtime.game.drawState(runtime.state);
    runtime.game.drawScore(0);
  }

  function resetReadout() {
    runtime.tick = 0;
    runtime.score = 0;
    runtime.revisions = 0;
    elements.score.textContent = "0";
    elements.step.textContent = `0 / ${runtime.trajectoryLength || 0}`;
    elements.humanAction.textContent = "STAY";
    elements.aiAction.textContent = "STAY";
    elements.arbitration.textContent = "Baseline scripted trajectory";
    elements.revisions.textContent = "0";
    elements.eventLog.innerHTML = '<li class="empty">Start the demo to see the joint trajectory.</li>';
  }

  function addEvent(payload, reward) {
    const empty = elements.eventLog.querySelector(".empty");
    if (empty) empty.remove();
    const item = document.createElement("li");
    const step = document.createElement("span");
    const description = document.createElement("div");
    step.textContent = String(payload.tick_id + 1).padStart(2, "0");
    description.textContent = `Human ${payload.human_action_name} · AI ${payload.final_ai_action_name}${reward ? ` · reward +${reward}` : ""}`;
    item.append(step, description);
    elements.eventLog.prepend(item);
    while (elements.eventLog.children.length > 10) {
      elements.eventLog.lastElementChild.remove();
    }
  }

  function scheduleNextTick() {
    window.clearTimeout(runtime.timer);
    if (!runtime.running || runtime.paused) return;
    runtime.timer = window.setTimeout(runTick, Number(elements.speed.value));
  }

  async function runTick() {
    if (!runtime.running || runtime.paused || runtime.requestInFlight) return;
    runtime.requestInFlight = true;
    try {
      const payload = await api("/api/tick", {
        method: "POST",
        body: JSON.stringify({
          session_id: runtime.sessionId,
          tick_id: runtime.tick,
          client_time_ms: performance.now(),
          state: runtime.state,
        }),
      });

      if (payload.done && payload.human_action === undefined) {
        finishDemo();
        return;
      }

      const Action = window.Overcooked.OvercookedMDP.Action;
      const jointAction = [
        Action.INDEX_TO_ACTION[payload.human_action],
        Action.INDEX_TO_ACTION[payload.final_ai_action],
      ];
      const transition = runtime.game.mdp.get_transition_states_and_probs({
        state: runtime.state,
        joint_action: jointAction,
      });
      const nextState = transition[0][0];
      const reward = transition[1];

      runtime.state = nextState;
      runtime.score += reward;
      runtime.tick += 1;
      if (payload.eeg_revision) runtime.revisions += 1;

      runtime.game.drawState(nextState);
      runtime.game.drawScore(runtime.score);
      elements.score.textContent = String(runtime.score);
      elements.step.textContent = `${runtime.tick} / ${runtime.trajectoryLength}`;
      elements.humanAction.textContent = payload.human_action_name;
      elements.aiAction.textContent = payload.final_ai_action_name;
      elements.arbitration.textContent = payload.arbitration_reason;
      elements.revisions.textContent = String(runtime.revisions);
      addEvent(payload, reward);

      if (payload.done) {
        finishDemo();
        return;
      }
    } catch (error) {
      runtime.running = false;
      setSystemStatus(`Error: ${error.message}`, false);
      elements.start.textContent = "Restart demo";
      elements.start.disabled = false;
      elements.pause.disabled = true;
      return;
    } finally {
      runtime.requestInFlight = false;
    }
    scheduleNextTick();
  }

  async function startDemo() {
    if (runtime.running && runtime.paused) {
      runtime.paused = false;
      elements.start.disabled = true;
      elements.pause.disabled = false;
      elements.pause.textContent = "Pause";
      setSystemStatus("Demo running", true);
      scheduleNextTick();
      return;
    }

    elements.start.disabled = true;
    setSystemStatus("Creating session", false);
    try {
      const session = await api("/api/session", { method: "POST", body: "{}" });
      runtime.sessionId = session.session_id;
      runtime.trajectoryLength = session.trajectory_length;
      runtime.running = true;
      runtime.paused = false;
      initializeGame();
      resetReadout();
      elements.step.textContent = `0 / ${runtime.trajectoryLength}`;
      elements.start.textContent = "Resume";
      elements.pause.disabled = false;
      elements.sessionLabel.textContent = `Session ${runtime.sessionId.slice(0, 8)}`;
      setSystemStatus("Demo running", true);
      scheduleNextTick();
    } catch (error) {
      elements.start.disabled = false;
      setSystemStatus(`Error: ${error.message}`, false);
    }
  }

  function pauseDemo() {
    if (!runtime.running) return;
    runtime.paused = !runtime.paused;
    window.clearTimeout(runtime.timer);
    elements.pause.textContent = runtime.paused ? "Continue" : "Pause";
    elements.start.disabled = !runtime.paused;
    setSystemStatus(runtime.paused ? "Demo paused" : "Demo running", true);
    if (!runtime.paused) scheduleNextTick();
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
    } catch (error) {
      console.warn("Could not stop session", error);
    }
  }

  async function resetDemo() {
    runtime.running = false;
    runtime.paused = false;
    window.clearTimeout(runtime.timer);
    await stopActiveSession("reset");
    initializeGame();
    resetReadout();
    elements.start.textContent = "Start demo";
    elements.start.disabled = false;
    elements.pause.textContent = "Pause";
    elements.pause.disabled = true;
    elements.sessionLabel.textContent = "No active session";
    setSystemStatus("Ready", true);
  }

  function finishDemo() {
    runtime.running = false;
    runtime.paused = false;
    window.clearTimeout(runtime.timer);
    elements.start.textContent = "Run again";
    elements.start.disabled = false;
    elements.pause.disabled = true;
    setSystemStatus("Trajectory complete", true);
    stopActiveSession("trajectory_complete");
  }

  async function boot() {
    elements.start.addEventListener("click", startDemo);
    elements.pause.addEventListener("click", pauseDemo);
    elements.reset.addEventListener("click", resetDemo);
    elements.speed.addEventListener("input", () => {
      elements.speedValue.textContent = `${elements.speed.value} ms`;
    });
    try {
      const health = await api("/api/health");
      elements.eegConnection.textContent = health.eeg.status === "reserved" ? "Not configured" : health.eeg.status;
      initializeGame();
      resetReadout();
      setSystemStatus("Ready", true);
    } catch (error) {
      setSystemStatus(`Error: ${error.message}`, false);
      elements.start.disabled = true;
    }
  }

  boot();
})();
