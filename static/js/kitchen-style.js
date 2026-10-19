/* Approved soft outlined kitchen artwork and worktops for all Demo modes. */
(() => {
  'use strict';
  const SIZE = 196, DEPTH = 80, TOP = SIZE, FRONT = TOP + 10, BASE = TOP + DEPTH;
  // Raise every full-size worktop above its fixed grid tile. The exposed
  // cabinet ends at that tile's southern edge; reserve overhang above the grid.
  // Match the shallower rise to a foot contact about two-thirds down the tile:
  // the next worktop begins at y=116 and covers the lower legs at y=130.
  // Existing fixture cutouts are packed at y=70; loose objects at y=98.
  const FIXTURE_CENTER = 70, FLOOR_CENTER = SIZE / 2, FOOT_ANCHOR = 193, GROUND_CONTACT = 130;
  const COUNTERS = new Set(['X', 'O', 'T', 'D', 'P', 'S']);

  function options() {
    return {
      assets_loc: (window.StaticReplay ? 'static/' : 'static/') + 'assets/warm/editor-soft-outline/',
      chef_atlas: 'chefs', player_colors: {0: 'gray', 1: 'sage'},
      pixel_art: false, render_resolution: Math.min(window.devicePixelRatio || 1, 2),
      serving_frames: {0: 'serve-north.png', 90: 'serve-east.png', 180: 'serve-south.png', '-90': 'serve-west.png'}
    };
  }

  function dimensions(grid, tileSize = 1) {
    return {width: grid[0].length * tileSize, height: (grid.length + DEPTH / SIZE) * tileSize};
  }

  function gridOffset(tileSize = 1) {
    return DEPTH * tileSize / SIZE;
  }

  function actorOffset(tileSize = 1) {
    return (GROUND_CONTACT - FOOT_ANCHOR) * tileSize / SIZE;
  }

  function actorGround(tileSize = 1) {
    return GROUND_CONTACT * tileSize / SIZE;
  }

  function anchorActor(actor, tileSize, layer = .3) {
    // Use source pixels, rather than a fractional origin: walking frames are
    // taller than idle frames, but keep the same feet and body scale.
    actor.setDisplayOrigin(0, FOOT_ANCHOR - GROUND_CONTACT);
    actor.setDepth(actor.y + actorGround(tileSize) + layer);
  }

  function surfaceCenter() {
    return TOP / 2 - DEPTH;
  }

  function fixtureOffset(tileSize = 96) {
    return (surfaceCenter() - FIXTURE_CENTER) * tileSize / SIZE;
  }

  function sprite(ctx, assets, atlas, name, x, y, tileSize = 96) {
    const {img, atlas: metadata} = assets[atlas], frame = metadata.frames[name].frame;
    ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, x, y, tileSize, tileSize);
  }

  function servingFrame(grid, x, y) {
    const approaches = [[0, 1, 0, y === 0], [-1, 0, 90, x === grid[0].length - 1],
      [0, -1, 180, y === grid.length - 1], [1, 0, -90, x === 0]]
      .filter(([dx, dy]) => grid[y + dy]?.[x + dx] === ' ');
    const inward = approaches.find(side => side[3]);
    const side = inward || (approaches.length === 1 || x === 0 || y === 0 || x === grid[0].length - 1 || y === grid.length - 1 ? approaches[0] : null);
    return options().serving_frames[side?.[2] || 0];
  }

  // Participant instructions use the same surface geometry and prop anchors
  // as Phaser, including source trays and loose items on handoff counters.
  function drawBoard(ctx, grid, assets, {x = 0, y = 0, tileSize = 96, actors = [], objects = []} = {}) {
    for (let row = 0; row < grid.length; row++) for (let col = 0; col < grid[row].length; col++) {
      if (grid[row][col] === ' ') sprite(ctx, assets, 'terrain', 'floor.png', x + col * tileSize, y + gridOffset(tileSize) + row * tileSize, tileSize);
    }
    const frames = {O: 'onions.png', T: 'tomatoes.png', D: 'dishes.png', P: 'pot.png'};
    for (let row = 0; row < grid.length; row++) {
      const board = document.createElement('canvas');
      board.width = grid[0].length * SIZE; board.height = SIZE + DEPTH;
      const layer = board.getContext('2d'); layer.translate(0, -row * SIZE);
      paintCountertops(layer, grid, tileSize, row);
      ctx.drawImage(board, x, y + row * tileSize, grid[0].length * tileSize, (1 + DEPTH / SIZE) * tileSize);
      for (let col = 0; col < grid[row].length; col++) {
        const type = grid[row][col];
        if (type === 'X' || type === ' ') continue;
        const offset = gridOffset(tileSize) + fixtureOffset(tileSize);
        sprite(ctx, assets, type === 'S' ? 'serving' : 'terrain', type === 'S' ? servingFrame(grid, col, row) : frames[type],
          x + col * tileSize, y + row * tileSize + offset, tileSize);
      }
      for (const object of objects.filter(item => item.position[1] === row)) {
        const [col] = object.position;
        sprite(ctx, assets, 'objects', object.frame, x + col * tileSize,
          y + row * tileSize + (COUNTERS.has(grid[row][col]) ? 0 : gridOffset(tileSize)), tileSize);
      }
      for (const actor of actors.filter(item => item.position[1] === row)) {
        sprite(ctx, assets, 'chefs', actor.frame, x + actor.position[0] * tileSize,
          y + gridOffset(tileSize) + row * tileSize + actorOffset(tileSize), tileSize);
      }
    }
  }

  function paintCountertops(ctx, grid, tileSize, onlyRow = null) {
    const width = grid[0].length, height = grid.length;
    const counterAt = (x, y) => COUNTERS.has(grid[y]?.[x]);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const line = (ctx, x1, y1, x2, y2, color = '#646264', width = 2.5) => {
      ctx.strokeStyle = color; ctx.lineWidth = width;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    };
    const cells = [];
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (!counterAt(x, y) || (onlyRow !== null && y !== onlyRow)) continue;
      cells.push({x, y, top: TOP, center: surfaceCenter(),
        north: counterAt(x, y - 1), east: counterAt(x + 1, y),
        south: counterAt(x, y + 1), west: counterAt(x - 1, y)});
    }
    // A cabinet front exists only along an exposed southern edge. In a
    // vertical run, the worktop continues into the next counter cell.
    for (const cell of cells) {
      if (cell.south) continue;
      const x = cell.x * SIZE, y = cell.y * SIZE;
      ctx.fillStyle = '#c4c1bf'; ctx.fillRect(x, y + FRONT, SIZE, BASE - FRONT);
      ctx.fillStyle = '#b2afad'; ctx.fillRect(x, y + BASE - 6, SIZE, 6);
      line(ctx, x, y + BASE - 1.5, x + SIZE, y + BASE - 1.5);
      const leftFront = cell.west && !counterAt(cell.x - 1, cell.y + 1);
      if (leftFront || !cell.west) line(ctx, x + 1.25, y + FRONT, x + 1.25, y + BASE - 1.5,
        leftFront ? '#a5a19e' : '#646264', leftFront ? 1 : 2.5);
      if (!cell.east) line(ctx, x + SIZE - 1.25, y + FRONT, x + SIZE - 1.25, y + BASE - 1.5);
      line(ctx, x + 72, y + FRONT + 18, x + 124, y + FRONT + 18, '#858282', 6);
    }
    for (const cell of cells) {
      const x = cell.x * SIZE, y = cell.y * SIZE;
      const leftRadius = !cell.north && !cell.west ? 7 : 0;
      const rightRadius = !cell.north && !cell.east ? 7 : 0;
      ctx.fillStyle = '#f3efeb'; ctx.beginPath();
      ctx.moveTo(x + leftRadius, y); ctx.lineTo(x + SIZE - rightRadius, y);
      ctx.quadraticCurveTo(x + SIZE, y, x + SIZE, y + rightRadius);
      ctx.lineTo(x + SIZE, y + cell.top); ctx.lineTo(x, y + cell.top);
      ctx.lineTo(x, y + leftRadius); ctx.quadraticCurveTo(x, y, x + leftRadius, y); ctx.fill();
      // A soft inset bevel restores the approved pattern on every tile,
      // while the shared surface underneath keeps adjacent counters joined.
      const inset = 3, radius = 9, left = x + inset, right = x + SIZE - inset;
      const upper = y + inset, lower = y + TOP - inset;
      const bevel = ctx.createLinearGradient(left, upper, right, lower);
      bevel.addColorStop(0, '#fffdf8'); bevel.addColorStop(.48, '#f4f0eb'); bevel.addColorStop(1, '#e2ddd6');
      ctx.fillStyle = bevel; ctx.beginPath();
      ctx.moveTo(left + radius, upper); ctx.lineTo(right - radius, upper);
      ctx.quadraticCurveTo(right, upper, right, upper + radius);
      ctx.lineTo(right, lower - radius); ctx.quadraticCurveTo(right, lower, right - radius, lower);
      ctx.lineTo(left + radius, lower); ctx.quadraticCurveTo(left, lower, left, lower - radius);
      ctx.lineTo(left, upper + radius); ctx.quadraticCurveTo(left, upper, left + radius, upper); ctx.fill();
      ctx.fillStyle = '#f3efeb'; ctx.beginPath();
      ctx.moveTo(left + radius + 2, upper + 5); ctx.lineTo(right - radius - 2, upper + 5);
      ctx.quadraticCurveTo(right - 5, upper + 5, right - 5, upper + radius + 2);
      ctx.lineTo(right - 5, lower - radius - 2); ctx.quadraticCurveTo(right - 5, lower - 5, right - radius - 2, lower - 5);
      ctx.lineTo(left + radius + 2, lower - 5); ctx.quadraticCurveTo(left + 5, lower - 5, left + 5, lower - radius - 2);
      ctx.lineTo(left + 5, upper + radius + 2); ctx.quadraticCurveTo(left + 5, upper + 5, left + radius + 2, upper + 5); ctx.fill();
      if (!cell.south) {
        ctx.fillStyle = '#d2ceca'; ctx.fillRect(x, y + TOP, SIZE, FRONT - TOP);
        line(ctx, x, y + TOP + .75, x + SIZE, y + TOP + .75, '#ffffff', 1.5);
        line(ctx, x, y + FRONT, x + SIZE, y + FRONT);
      }
    }
    // One fine seam per shared edge keeps individual counter tiles readable
    // without separating the worktop or adding another cabinet front.
    // Keep one display pixel of pale seam on smaller comparison boards too.
    const seamWidth = SIZE / tileSize;
    for (const cell of cells) {
      const x = cell.x * SIZE, y = cell.y * SIZE;
      if (cell.east) line(ctx, x + SIZE, y, x + SIZE, y + TOP, '#cbc6c1', seamWidth);
      if (cell.south) line(ctx, x, y + SIZE, x + SIZE, y + SIZE, '#cbc6c1', seamWidth);
    }
    // Stroke the exposed contour of the joined surface, never doubled edges
    // or the cabinet from a neighboring station's former full-tile image.
    for (const cell of cells) {
      const x = cell.x * SIZE, y = cell.y * SIZE;
      const leftRadius = !cell.north && !cell.west ? 7 : 0;
      const rightRadius = !cell.north && !cell.east ? 7 : 0;
      if (!cell.north) line(ctx, x + leftRadius, y + 1.25, x + SIZE - rightRadius, y + 1.25);
      for (const [dx, exists] of [[-1, cell.west], [1, cell.east]]) {
        const neighborHeight = exists ? (counterAt(cell.x + dx, cell.y + 1) ? SIZE : FRONT) : 0;
        const end = cell.south ? SIZE : FRONT;
        if (neighborHeight >= end) continue;
        const sideX = x + (dx < 0 ? 1.25 : SIZE - 1.25);
        const radius = dx < 0 ? leftRadius : rightRadius;
        line(ctx, sideX, y + Math.max(neighborHeight, radius), sideX, y + end);
        if (radius) {
          ctx.beginPath(); ctx.moveTo(sideX, y + radius);
          ctx.quadraticCurveTo(sideX, y + 1.25, x + (dx < 0 ? radius : SIZE - radius), y + 1.25); ctx.stroke();
        }
      }
    }
    return cells;
  }

  function attach(game, {tileSize}) {
    game.kitchenStyle = true;
    const prototype = game.scene.prototype;
    const originalDraw = prototype._drawState;
    const grid = game.mdp.terrain_mtx;
    game.gameHeight = dimensions(grid, tileSize).height;
    const counterAt = (x, y) => COUNTERS.has(grid[y]?.[x]);
    const alignActors = scene => {
      for (const chef of Object.values(scene.sprites?.chefs || {})) {
        anchorActor(chef.hatsprite, tileSize);
        anchorActor(chef.chefsprite, tileSize, .4);
      }
    };

    prototype.preload = function () {
      // Version the changed placement atlases without changing other renderers'
      // asset cache or touching the existing character poses.
      for (const [key, file] of Object.entries({tiles: 'terrain', serving: 'serving-station', objects: 'objects', chefs: game.chef_atlas})) {
        const suffix = key === 'chefs' ? '?v=plated-tomato-v1' : '?v=joined-worktops-v1';
        this.load.atlas(key, game.assets_loc + file + '.png' + suffix, game.assets_loc + file + '.json' + suffix);
      }
    };

    prototype.drawLevel = function () {
      const width = grid[0].length, height = grid.length;
      const raisedBy = gridOffset(tileSize);
      // Camera padding preserves physical player/floor coordinates, including
      // their existing movement tweens, and leaves room for the raised top row.
      this.cameras.main.setScroll(0, -raisedBy);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        if (grid[y][x] === ' ') this.add.sprite(x * tileSize, y * tileSize, 'tiles', 'floor.png').setOrigin(0).setDisplaySize(tileSize, tileSize);
      }
      const texture = this.textures.createCanvas('editor-countertops', width * SIZE, height * SIZE + DEPTH);
      const ctx = texture.getContext();
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      const cells = paintCountertops(ctx, grid, tileSize);
      texture.refresh();
      this.editorCountertops = {cells, props: new Map(), rows: []};
      // Split the existing geometry into transparent row layers. Sorting by
      // ground position lets a southern counter naturally cover the lower
      // legs of a chef behind it, while a northern counter stays behind them.
      for (let row = 0; row < height; row++) {
        const layer = this.textures.createCanvas(`kitchen-counter-row-${row}`, width * SIZE, SIZE + DEPTH);
        const context = layer.getContext(); context.translate(0, -row * SIZE);
        paintCountertops(context, grid, tileSize, row); layer.refresh();
        const image = this.add.image(0, row * tileSize - raisedBy, layer.key).setOrigin(0)
          .setDisplaySize(width * tileSize, tileSize + raisedBy).setDepth((row + .5) * tileSize);
        this.editorCountertops.rows.push(image);
      }
      const align = () => alignActors(this);
      this.events.on('postupdate', align);
      this.events.once('shutdown', () => this.events.off('postupdate', align));
      const frames = {O: 'onions.png', T: 'tomatoes.png', D: 'dishes.png', P: 'pot.png'};
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const type = grid[y][x];
        if (type === 'X' || type === ' ') continue;
        const serving = type === 'S';
        const frame = serving ? game.serving_frames?.[this.servingAngle(x, y)] || 'serve.png' : frames[type];
        const offset = fixtureOffset(tileSize);
        const sprite = this.add.sprite(x * tileSize, y * tileSize + offset, serving ? 'serving' : 'tiles', frame);
        sprite.setOrigin(0).setDisplaySize(tileSize, tileSize).setDepth((y + .5) * tileSize + .1);
        this.editorCountertops.props.set(`${x},${y}`, sprite);
      }
    };

    prototype._drawState = function (state, sprites, instant = false) {
      originalDraw.call(this, state, sprites, instant);
      alignActors(this);
      for (const [position, prop] of this.editorCountertops.props) {
        const [x, y] = position.split(',').map(Number);
        if (grid[y][x] === 'P') prop.setVisible(state.objects[position]?.name !== 'soup');
      }
      for (const [position, rendered] of Object.entries(sprites.objects)) {
        const [x, y] = position.split(',').map(Number);
        rendered.objsprite.setDepth((y + .5) * tileSize + .2);
        if (!counterAt(x, y)) continue;
        const packedCenter = grid[y][x] === 'P' ? FIXTURE_CENTER : FLOOR_CENTER;
        rendered.objsprite.setY(y * tileSize + (surfaceCenter() - packedCenter) * tileSize / SIZE);
      }
    };
  }

  window.KitchenStyle = {options, attach, dimensions, gridOffset, actorOffset, actorGround, anchorActor, drawBoard, sprite, fixtureOffset};
  // Historical artwork/animation checks also use this narrow attachment name.
  window.TrialEditorCountertops = {attach};
})();
