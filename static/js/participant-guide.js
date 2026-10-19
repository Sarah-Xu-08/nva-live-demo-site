/* Optional participant-facing help and responses; playback stays in q-demo.js. */
(function () {
  "use strict";
  const get = id => document.getElementById(id);
  const dialog = get("participant-instructions");
  const trigger = get("instructions-button");
  const form = get("trial-response-form");
  const reason = get("response-reason");
  const panel = get("trial-response-panel");
  const error = get("response-error");
  let submitResponse;
  let responseTrialId = null;
  let artworkPromise;

  function close() {
    if (dialog.open) dialog.close();
  }

  function open() {
    if (trigger.hidden || trigger.disabled || dialog.open) return;
    dialog.showModal();
    dialog.scrollTop = 0;
    get("instructions-heading").focus({preventScroll: true});
    drawGuide().catch(() => {
      get("guide-art-status").hidden = false;
      get("guide-art-status").textContent = "The illustrations could not load. Close and reopen Instructions to retry.";
      artworkPromise = null;
    });
  }

  function sync(config) {
    get("participant-options").hidden = !config.recording;
    trigger.hidden = !config.recording || !config.instructionsEnabled;
    trigger.disabled = Boolean(config.unavailable);
    document.querySelectorAll("[data-guide-with-ratings]").forEach(node => {
      node.hidden = !config.ratingsEnabled;
    });
    if (trigger.hidden || trigger.disabled) close();
    if (!config.response) {
      if (panel.open) panel.close();
      responseTrialId = null;
    }
    form.querySelectorAll("input, textarea, button").forEach(node => {
      node.disabled = Boolean(node.id === "response-end-session" ? config.endUnavailable : config.unavailable);
    });
    if (panel.open && !panel.contains(document.activeElement)) {
      get("response-heading").focus({preventScroll: true});
    }
  }

  function showResponse(session) {
    if (responseTrialId !== session.trial_id) {
      form.reset();
      reason.required = false;
      error.hidden = true;
      responseTrialId = session.trial_id;
    }
    get("response-heading").textContent = `Your rating · Trial ${session.trial_number} of ${session.trial_count}`;
    get("response-hint").textContent = `Briefing: ${session.playback.human_expectation}`;
    get("response-submit").textContent = session.trial_number === session.trial_count
      ? "Submit and finish" : "Submit and continue";
    close();
    if (!panel.open) panel.showModal();
    panel.scrollTop = 0;
    get("response-heading").focus({preventScroll: true});
  }

  function init(onSubmit, onEndSession) {
    submitResponse = onSubmit;
    trigger.addEventListener("click", open);
    get("instructions-acknowledge").addEventListener("click", close);
    dialog.addEventListener("close", () => {
      if (!trigger.hidden && !trigger.disabled) trigger.focus({preventScroll: true});
    });
    // Let the native dialog handle Escape and focus containment; avoid also
    // triggering the page's fullscreen keyboard shortcut.
    dialog.addEventListener("keydown", event => {
      if (event.key === "Escape") event.stopPropagation();
    });
    // A response is required before continuing. Escape/backdrop must not hide
    // the form; End session still allows the participant to stop early.
    panel.addEventListener("cancel", event => event.preventDefault());
    panel.addEventListener("keydown", event => {
      if (event.key === "Escape") event.stopPropagation();
    });
    get("response-end-session").addEventListener("click", async () => {
      error.hidden = true;
      try {
        await onEndSession();
      } catch (failure) {
        error.textContent = `${failure.message} Your answer is still here.`;
        error.hidden = false;
        get("response-end-session").focus({preventScroll: true});
      }
    });
    form.addEventListener("change", () => {
      const selected = form.querySelector('input[name="rating"]:checked');
      reason.required = Boolean(selected && Number(selected.value) > 0);
      reason.setCustomValidity("");
    });
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const selected = form.querySelector('input[name="rating"]:checked');
      if (!selected) return form.reportValidity();
      if (Number(selected.value) > 0 && !reason.value.trim()) {
        reason.setCustomValidity("Briefly explain the error you noticed.");
      }
      if (!form.reportValidity()) return;
      error.hidden = true;
      try {
        await submitResponse({trial_id: responseTrialId, rating: Number(selected.value), reason: reason.value});
      } catch (failure) {
        error.textContent = `${failure.message} Your answer is still here. Try submitting again.`;
        error.hidden = false;
        get("response-submit").focus({preventScroll: true});
      }
    });
    reason.addEventListener("input", () => reason.setCustomValidity(""));
  }

  async function loadArtwork() {
    const entries = await Promise.all(["terrain", "objects", "chefs", "serving-station"].map(async name => {
      const base = `${KitchenStyle.options().assets_loc}${name}`;
      const response = await fetch(`${base}.json`);
      if (!response.ok) throw new Error("Artwork unavailable");
      const atlas = await response.json();
      const img = new Image();
      img.src = `${base}.png`;
      await img.decode();
      return [name === "serving-station" ? "serving" : name, {atlas, img}];
    }));
    return Object.fromEntries(entries);
  }

  async function drawGuide() {
    artworkPromise ||= loadArtwork();
    const assets = await artworkPromise;
    const resolution = Math.min(window.devicePixelRatio || 1, 2);
    document.querySelectorAll('.instructions-content canvas').forEach(canvas => {
      const width = Number(canvas.dataset.guideWidth ||= canvas.width);
      const height = Number(canvas.dataset.guideHeight ||= canvas.height);
      canvas.width = Math.round(width * resolution); canvas.height = Math.round(height * resolution);
      canvas.getContext('2d').setTransform(resolution, 0, 0, resolution, 0, 0);
    });
    const sprite = (ctx, atlas, name, x, y, size = 96) => KitchenStyle.sprite(ctx, assets, atlas, name, x, y, size);
    document.querySelectorAll("[data-guide-art]").forEach(canvas => {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const [atlas, name] = canvas.dataset.guideArt.split(":");
      const counter = atlas === "pot" || atlas === "serving" || (atlas === "terrain" && name !== "floor.png");
      if (counter)
        KitchenStyle.drawBoard(ctx, ["X"], assets);
      sprite(ctx, atlas === "pot" ? "objects" : atlas, name, 0, counter ? KitchenStyle.gridOffset(96) + KitchenStyle.fixtureOffset() : 0);
    });
    const kitchen = get("guide-kitchen"), ctx = kitchen.getContext("2d");
    ctx.clearRect(0, 0, kitchen.width, kitchen.height);
    const grid = ["XXOXTXX", "X  X  X", "X  X  X", "X  D  X", "XXPXPSX"];
    KitchenStyle.drawBoard(ctx, grid, assets, {tileSize: 64, actors: [
      {position: [2, 1], frame: "EAST-grayhat.png"}, {position: [4, 1], frame: "WEST-sagehat.png"}
    ]});
    const markCounter = (x, y, label, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = 4;
      ctx.strokeRect(x + 3, y + 3, 58, 58);
      ctx.fillStyle = color;
      ctx.fillRect(x + 4, y + 4, 23, 24);
      ctx.fillStyle = "#fff"; ctx.font = "bold 17px system-ui"; ctx.textAlign = "center";
      ctx.fillText(label, x + 15, y + 23);
    };
    markCounter(192, 64, "A", "#237455");
    markCounter(192, 128, "B", "#237455");
    markCounter(0, 192, "C", "#626a73");
    const exchange = (c, step, y) => {
      const grid = [" X "];
      KitchenStyle.drawBoard(c, grid, assets, {y, actors: [
        {position: [0, 0], frame: step === "take" ? "EAST-grayhat-onion.png" : "EAST-grayhat.png"},
        {position: [2, 0], frame: step === "place" ? "WEST-sagehat-onion.png" : "WEST-sagehat.png"}
      ], objects: step === "rest" ? [{position: [1, 0], frame: "onion.png"}] : []});
      c.strokeStyle = "#237455"; c.lineWidth = 4;
      c.strokeRect(99, y + 3, 90, 90);
    };
    document.querySelectorAll("[data-guide-exchange]").forEach(canvas => {
      const c = canvas.getContext("2d");
      c.clearRect(0, 0, canvas.width, canvas.height);
      exchange(c, canvas.dataset.guideExchange, 12);
    });
    const opposite = get("guide-opposite").getContext("2d");
    opposite.clearRect(0, 0, 288, 192);
    exchange(opposite, "rest", 48);
    const corner = get("guide-corner").getContext("2d");
    corner.clearRect(0, 0, 288, 232);
    const cornerGrid = [" X", "  "];
    KitchenStyle.drawBoard(corner, cornerGrid, assets, {actors: [
      {position: [0, 0], frame: "EAST-grayhat.png"}, {position: [1, 1], frame: "NORTH-sagehat.png"}
    ], objects: [{position: [1, 0], frame: "tomato.png"}]});
    corner.strokeStyle = "#237455"; corner.lineWidth = 4; corner.strokeRect(99, 3, 90, 90);
    get("guide-art-status").hidden = true;
  }

  window.ParticipantGuide = {init, sync, showResponse, open, close};
})();
