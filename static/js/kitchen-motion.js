/* Approved Option 2 motion shared by all Demo modes and source-clock replay. */
(() => {
  "use strict";
  const SIZE = 196;
  const HEIGHT = 208; // Space below the neutral boots for a forward footstep.
  const CLEAN_POSES = "editor-chef-poses";
  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
  function fraction(progress, wasMoving = false, continues = false) {
    const p = clamp(progress);
    if (!wasMoving && !continues) return p * p * (3 - 2 * p);
    if (!wasMoving) return p * p * (2 - p);
    if (!continues) return p + p * p - p * p * p;
    return p;
  }

  function cleanPose(art) {
    const ctx = art.getContext("2d"), pixels = ctx.getImageData(0, 0, SIZE, SIZE);
    const seen = new Uint8Array(SIZE * SIZE), queue = new Uint32Array(seen.length);
    let largest = [], components = 0;
    for (let start = 0; start < seen.length; start++) {
      if (seen[start] || pixels.data[start * 4 + 3] < 24) continue;
      queue[0] = start; seen[start] = 1;
      let count = 1;
      for (let i = 0; i < count; i++) {
        const pixel = queue[i], x = pixel % SIZE, y = Math.floor(pixel / SIZE);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (x + dx < 0 || x + dx >= SIZE || y + dy < 0 || y + dy >= SIZE) continue;
          const neighbor = pixel + dy * SIZE + dx;
          if (!seen[neighbor] && pixels.data[neighbor * 4 + 3] >= 24) {
            seen[neighbor] = 1; queue[count++] = neighbor;
          }
        }
      }
      if (count > largest.length) largest = queue.slice(0, count);
      components++;
    }
    if (components < 2) return art;
    const keep = new Uint8Array(seen.length);
    let left = SIZE, top = SIZE, right = 0, bottom = 0;
    for (const pixel of largest) {
      const x = pixel % SIZE, y = Math.floor(pixel / SIZE);
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
      // Retain the soft alpha edge around the connected character silhouette.
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (x + dx >= 0 && x + dx < SIZE && y + dy >= 0 && y + dy < SIZE) keep[pixel + dy * SIZE + dx] = 1;
      }
    }
    for (let i = 0; i < keep.length; i++) if (!keep[i]) pixels.data[i * 4 + 3] = 0;
    ctx.putImageData(pixels, 0, 0);
    let footLeft = SIZE, footRight = 0;
    for (const pixel of largest) if (Math.floor(pixel / SIZE) >= bottom - (bottom - top) * .14) {
      footLeft = Math.min(footLeft, pixel % SIZE); footRight = Math.max(footRight, pixel % SIZE);
    }
    // The stray next-row fragments also affected a few human poses' fitted
    // bounds. Fit the connected body to the same height and boot anchor.
    const fitted = document.createElement("canvas"); fitted.width = fitted.height = SIZE;
    const scale = 168 / (bottom - top + 1), footCenter = (footLeft + footRight + 1) / 2;
    const x = Math.max(0, left - 2), y = Math.max(0, top - 2);
    const width = Math.min(SIZE, right + 3) - x, height = Math.min(SIZE, bottom + 3) - y;
    fitted.getContext("2d").drawImage(art, x, y, width, height,
      SIZE / 2 + (x - footCenter) * scale, 25 + (y - top) * scale, width * scale, height * scale);
    return fitted;
  }

  function paint(ctx, pose, orientation, distance, strength) {
    ctx.clearRect(0, 0, SIZE, HEIGHT);
    const phase = distance * 2 * Math.PI * 1.55;
    const stride = Math.sin(phase), swing = Math.cos(phase), sideView = Boolean(orientation[0]);
    const bounce = -stride * stride * (sideView ? 1.6 : 1.2) * strength;
    ctx.drawImage(pose.art, 0, bounce);
    const pixels = pose.patch.data, source = pose.pixels, startY = pose.hip - 4;
    const liftLeft = Math.max(0, swing) ** 2 * 3.2;
    const liftRight = Math.max(0, -swing) ** 2 * 3.2;
    for (let x = 0; x < SIZE; x++) {
      const leftWeight = 1 - smooth((x - 88) / 20);
      const mask = smooth((x - pose.left) / 8) * smooth((pose.right - x) / 8);
      pose.shiftX[x] = sideView ? (2 * leftWeight - 1) * stride * 4.5 * strength * mask : 0;
      pose.shiftY[x] = (-(liftLeft * leftWeight + liftRight * (1 - leftWeight)) +
        (sideView ? 0 : orientation[1] * stride * (2 * leftWeight - 1) * 4.2)) * strength * mask;
    }
    for (let y = startY; y < HEIGHT; y++) for (let x = 0; x < SIZE; x++) {
      let sx = x, sy = y - bounce;
      // Invert one continuous deformation. The hips and outer hands have zero
      // displacement; there are no separately clipped or overlapping leg layers.
      for (let i = 0; i < 4; i++) {
        const ix = Math.max(0, Math.min(SIZE - 2, Math.floor(sx))), t = clamp(sx - ix);
        const bend = smooth((sy - pose.hip) / (193 - pose.hip));
        sx = x - (pose.shiftX[ix] * (1 - t) + pose.shiftX[ix + 1] * t) * bend;
        sy = y - bounce - (pose.shiftY[ix] * (1 - t) + pose.shiftY[ix + 1] * t) * bend;
      }
      const out = ((y - startY) * SIZE + x) * 4;
      const ix = Math.floor(sx), iy = Math.floor(sy), fx = sx - ix, fy = sy - iy;
      let alpha = 0, red = 0, green = 0, blue = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        if (ix + dx < 0 || ix + dx >= SIZE || iy + dy < 0 || iy + dy >= SIZE) continue;
        const at = ((iy + dy) * SIZE + ix + dx) * 4;
        const weight = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * source[at + 3];
        alpha += weight; red += source[at] * weight; green += source[at + 1] * weight; blue += source[at + 2] * weight;
      }
      // Interpolate premultiplied alpha so soft edges don't acquire dark halos.
      pixels[out] = alpha ? red / alpha : 0; pixels[out + 1] = alpha ? green / alpha : 0;
      pixels[out + 2] = alpha ? blue / alpha : 0; pixels[out + 3] = alpha;
    }
    ctx.putImageData(pose.patch, 0, startY);
  }

  function attach(game, { tileSize, actionMs = 0 }) {
    if (game.motion) return game.motion;
    const prototype = game.scene.prototype;
    const originalDraw = prototype._drawState;
    const originalUpdate = prototype.update;
    const originalSnapshot = game.drawSnapshot.bind(game);
    const originalClose = game.close.bind(game);
    const poses = new Map();
    let scene = null, pending = null, sourceFrame = null;

    function prepareAtlas() {
      if (scene.textures.exists(CLEAN_POSES)) return;
      const original = scene.textures.get("chefs"), source = original.getSourceImage();
      const texture = scene.textures.createCanvas(CLEAN_POSES, source.width, source.height);
      const ctx = texture.getContext(); ctx.drawImage(source, 0, 0);
      for (const name of original.getFrameNames().filter(name => name.includes("hat"))) {
        const frame = original.get(name), art = document.createElement("canvas"); art.width = art.height = SIZE;
        art.getContext("2d").drawImage(source, frame.cutX, frame.cutY, SIZE, SIZE, 0, 0, SIZE, SIZE);
        ctx.clearRect(frame.cutX, frame.cutY, SIZE, SIZE); ctx.drawImage(cleanPose(art), frame.cutX, frame.cutY);
        texture.add(name, 0, frame.cutX, frame.cutY, SIZE, SIZE);
      }
      texture.refresh();
    }

    function poseFor(frameName, player) {
      if (poses.has(frameName)) return poses.get(frameName);
      const frame = scene.textures.getFrame(CLEAN_POSES, frameName);
      const art = document.createElement("canvas"); art.width = art.height = SIZE;
      art.getContext("2d").drawImage(frame.source.image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, SIZE, SIZE);
      const hip = player === 0 ? 166 : 171, left = player === 0 ? 60 : 73, right = player === 0 ? 137 : 126;
      const pose = { art, hip, left, right, pixels: art.getContext("2d").getImageData(0, 0, SIZE, SIZE).data,
        patch: new ImageData(SIZE, HEIGHT - hip + 4), shiftX: new Float32Array(SIZE), shiftY: new Float32Array(SIZE) };
      poses.set(frameName, pose); return pose;
    }

    function restore(rendered) {
      if (!rendered?.editorWalk) return;
      const hat = rendered.hatsprite;
      if (hat.texture.key !== CLEAN_POSES) {
        hat.setTexture(CLEAN_POSES, rendered.editorWalk.frame);
        hat.setDisplaySize(tileSize, tileSize);
      }
      KitchenStyle.anchorActor(hat, tileSize);
    }

    function renderPose(rendered, player, phase) {
      const progress = clamp(phase.progress);
      const strength = Math.min(phase.wasMoving ? 1 : clamp(progress * 6), phase.continues ? 1 : clamp((1 - progress) * 6));
      if (!strength) { restore(rendered); return false; }
      const walk = rendered.editorWalk;
      const position = fraction(progress, phase.wasMoving, phase.continues);
      paint(walk.texture.getContext(), poseFor(walk.frame, Number(player)), walk.orientation, phase.distance + position, strength);
      walk.texture.refresh();
      if (rendered.hatsprite.texture !== walk.texture) {
        rendered.hatsprite.setTexture(walk.texture.key);
        rendered.hatsprite.setDisplaySize(tileSize, tileSize * HEIGHT / SIZE);
      }
      KitchenStyle.anchorActor(rendered.hatsprite, tileSize);
      return true;
    }

    function settle() {
      if (!scene?.sprites?.chefs) return;
      Object.values(scene.sprites.chefs).forEach(rendered => {
        if (rendered.movement) rendered.movement.stop();
        rendered.movement = null;
        rendered.chefsprite.setPosition(rendered.tileX, rendered.tileY);
        rendered.hatsprite.setPosition(rendered.tileX, rendered.tileY);
        restore(rendered);
        if (rendered.editorWalk) rendered.editorWalk.motion = rendered.editorWalk.clock = null;
      });
    }

    const controller = {
      drawState(state, { actions, nextState, nextActions } = {}) {
        sourceFrame = null;
        pending = { state, actions, nextState, nextActions };
        game.drawState(state);
      },
      drawAt(state, {before, actions, progress = 1, gaitProgress = progress, motion = []} = {}) {
        // A saved/source-clock view is a display copy. Its gait and easing are
        // deterministic at the selected source time, including paused seeks;
        // no wall-clock tween may advance it independently of the EEG.
        const display = JSON.parse(JSON.stringify(state)), phases = [];
        display.players.forEach((player, index) => {
          const from = before?.players[index]?.position, to = player.position;
          const distance = from ? Math.abs(to[0] - from[0]) + Math.abs(to[1] - from[1]) : 0;
          const cardinal = from && (from[0] === to[0] || from[1] === to[1]) && distance <= 1;
          const phase = {...motion[index], progress: gaitProgress, distance: motion[index]?.distance || 0};
          const active = actions?.[index] !== undefined && actions[index] !== 'STAY';
          phases[index] = cardinal && active ? phase : null;
          if (cardinal) {
            const amount = fraction(progress, phase.wasMoving, phase.continues);
            player.position = to.map((value, axis) => from[axis] + (value - from[axis]) * amount);
            if (player.held_object) player.held_object.position = [...player.position];
          }
        });
        const value = window.Overcooked.OvercookedMDP.OvercookedState.from_object(display);
        game.drawSnapshot(value, phases);
      },
      finish() {
        // Pause can arrive before Phaser consumes a queued state. Show that
        // action's exact selected state instead of starting a new tween later.
        if (game.state_to_draw) {
          originalSnapshot(game.state_to_draw);
          delete game.state_to_draw;
        }
        pending = sourceFrame = null; settle();
      }
    };

    prototype._drawState = function (state, sprites, instant = false) {
      scene = this;
      prepareAtlas();
      const existing = sprites?.chefs || {};
      const previous = Object.fromEntries(Object.entries(existing).map(([index, rendered]) => {
        // The shared renderer selects its own named frame before this motion
        // wrapper switches back to the cleaned pose or the walking surface.
        rendered.hatsprite.setTexture("chefs", rendered.editorWalk.frame);
        rendered.hatsprite.setDisplaySize(tileSize, tileSize);
        return [index, { x: rendered.tileX, y: rendered.tileY, motion: rendered.editorWalk?.motion }];
      }));
      const queued = pending?.state === state ? pending : null;
      const clocked = sourceFrame?.state === state ? sourceFrame : null;
      pending = sourceFrame = null;
      originalDraw.call(this, state, sprites, instant);
      state.players.forEach((player, index) => {
        const rendered = this.sprites.chefs[index];
        if (!rendered.editorWalk) {
          rendered.editorWalk = { texture: this.textures.createCanvas(`editor-walking-${index}`, SIZE, HEIGHT), motion: null };
        }
        const walk = rendered.editorWalk;
        walk.frame = rendered.hatsprite.frame.name;
        walk.orientation = player.orientation;
        walk.clock = clocked?.phases[index] || null;
        if (clocked) { walk.motion = null; restore(rendered); return; }
        const from = previous[index];
        const dx = from ? rendered.tileX - from.x : 0, dy = from ? rendered.tileY - from.y : 0;
        const isStep = from && Math.abs(dx) + Math.abs(dy) === tileSize && (dx === 0 || dy === 0);
        const action = queued?.actions?.[index];
        const active = action === undefined ? isStep : action !== "STAY";
        const stationary = from && dx === 0 && dy === 0;
        // The normal gait shows an attempted action even when its destination
        // is blocked. Its tile position still comes only from the actual state.
        if (instant || !active || !(isStep || stationary)) { walk.motion = null; restore(rendered); return; }
        const next = queued?.nextState?.players[index];
        const nextDx = next ? next.position[0] - player.position[0] : 0;
        const nextDy = next ? next.position[1] - player.position[1] : 0;
        const nextAction = queued?.nextActions?.[index];
        const continues = nextAction === undefined ? Math.abs(nextDx) + Math.abs(nextDy) === 1 : nextAction !== "STAY";
        const wasMoving = Boolean(from.motion?.continues);
        walk.motion = { x: from.x, y: from.y, dx, dy, wasMoving, continues, started: this.time.now,
          distance: wasMoving ? from.motion.distance + 1 : 0 };
      });
    };

    prototype.update = function (...args) {
      originalUpdate.apply(this, args);
      for (const [index, rendered] of Object.entries(this.sprites.chefs || {})) {
        const walk = rendered.editorWalk, motion = walk?.motion;
        if (walk?.clock) { renderPose(rendered, index, walk.clock); continue; }
        if (!motion) continue;
        const progress = rendered.movement ? clamp(rendered.movement.progress) : 1;
        // Ease only when a route starts or ends. Every cardinal tile finishes
        // on the original action boundary before the next direction begins.
        const amount = fraction(progress, motion.wasMoving, motion.continues);
        rendered.chefsprite.setPosition(motion.x + motion.dx * amount, motion.y + motion.dy * amount);
        rendered.hatsprite.setPosition(motion.x + motion.dx * amount, motion.y + motion.dy * amount);
        const gaitProgress = actionMs ? clamp((this.time.now - motion.started) / actionMs) : progress;
        if (!renderPose(rendered, index, {...motion, progress: gaitProgress}) && gaitProgress === 1) walk.motion = null;
      }
    };

    game.drawSnapshot = (state, phases = null) => {
      pending = null;
      // Clocked snapshots are consumed atomically by the next Phaser update.
      // Keep the current pose until then, rather than flashing idle artwork
      // between two published source frames or repeated history selections.
      if (!phases) settle();
      sourceFrame = phases ? {state, phases} : null;
      originalSnapshot(state);
    };
    game.close = (...args) => {
      controller.finish(); poses.clear(); scene = null; originalClose(...args);
    };
    game.motion = controller;
    return controller;
  }

  window.KitchenMotion = {attach, fraction};
  window.TrialEditorWalking = window.KitchenMotion;
})();
