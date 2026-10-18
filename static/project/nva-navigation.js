import { NavigationExample, COLUMNS, ROWS, DIRECTIONS, sameCell } from './nva-navigation-model.mjs?v=2';

const root = document.getElementById('nv-navigation');
if (root) {
  const model = new NavigationExample();
  const board = root.querySelector('[data-nav-board]');
  const cells = root.querySelector('[data-nav-cells]');
  const svg = root.querySelector('[data-nav-svg]');
  let drag = null;
  let selectedEndpoint = null;
  const format = n => n.toFixed(2);
  const buttons = [];
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLUMNS; col++) {
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.navCell = `${col},${row}`;
    cells.appendChild(button); buttons.push(button);
  }

  function draw() {
    const width = board.clientWidth, height = board.clientHeight;
    if (!width || !height) return;
    const size = width / COLUMNS;
    const point = cell => [(cell[0] + .5) * size, (cell[1] + .5) * size];
    const path = points => points.map((cell, index) => `${index ? 'L' : 'M'}${point(cell).join(' ')}`).join(' ');
    const radius = Math.min(13, size * .29);
    let markup = '';
    for (let col = 0; col <= COLUMNS; col++) markup += `<path d="M${col * size} 0 V${ROWS * size}" stroke="var(--nv-line)" fill="none"/>`;
    for (let row = 0; row <= ROWS; row++) markup += `<path d="M0 ${row * size} H${width}" stroke="var(--nv-line)" fill="none"/>`;
    function arrow(from, to, color) {
      const a = point(from), b = point(to), dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
      const ux = dx / length, uy = dy / length, tip = [a[0] + dx * .64, a[1] + dy * .64], r = Math.min(4, size * .09);
      return `<path d="M${tip.join(' ')} L${tip[0] - ux * r * 1.5 - uy * r} ${tip[1] - uy * r * 1.5 + ux * r} L${tip[0] - ux * r * 1.5 + uy * r} ${tip[1] - uy * r * 1.5 - ux * r} Z" fill="${color}"/>`;
    }
    if (model.route.length > 1) {
      markup += `<path data-nav-route-path d="${path(model.route)}" fill="none" stroke="var(--nav-expected)" stroke-width="2.2" stroke-linejoin="round"/>`;
      model.route.slice(1).forEach((cell, index) => { markup += arrow(model.route[index], cell, 'var(--nav-expected)'); });
      model.route.forEach(cell => { const [x, y] = point(cell); markup += `<circle cx="${x}" cy="${y}" r="2.3" fill="var(--nav-expected)"/>`; });
    }
    if (model.history.length) {
      const trail = [model.start, ...model.history.map(step => step.to)];
      markup += `<path data-nav-observed-path d="${path(trail)}" fill="none" stroke="var(--nav-observed)" stroke-width="2" stroke-linejoin="round" opacity=".65"/>`;
      const last = model.lastStep;
      markup += `<path data-nav-last-path d="${path([last.from, last.to])}" fill="none" stroke="var(--nav-observed)" stroke-width="2.8"/>`;
      markup += arrow(last.from, last.to, 'var(--nav-observed)');
    }
    function marker(cell, label, kind) {
      const [x, y] = point(cell), current = kind === 'current' || (kind === 'goal' && model.complete);
      const fill = current ? 'var(--nv-ink)' : kind === 'goal' ? 'var(--nv-soft)' : 'var(--nv-bg)';
      const stroke = kind === 'expected' ? 'var(--nav-expected)' : model.complete ? 'var(--nav-observed)' : 'var(--nv-ink)';
      const shape = kind === 'goal'
        ? `<rect x="${x - radius}" y="${y - radius}" width="${radius * 2}" height="${radius * 2}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="1.7"/>`
        : `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="1.7"/>`;
      return `<g data-nav-marker="${kind}" data-center-x="${x}" data-center-y="${y}" data-cell="${cell}">${shape}<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" class="nv-navigation-${current ? 'current' : kind}-letter">${label}</text></g>`;
    }
    const expected = model.expectedNext;
    const preview = drag?.kind === 'placement' && drag.cell &&
      !sameCell(drag.cell, drag.endpoint === 'start' ? model.goal : model.start) ? drag : null;
    const state = preview?.endpoint === 'start' ? preview.cell : model.position;
    const goal = preview?.endpoint === 'goal' ? preview.cell : model.goal;
    if (expected && !sameCell(expected, model.goal)) markup += marker(expected, 'E', 'expected');
    if (!model.complete) markup += marker(state, 'S', 'current');
    markup += marker(goal, 'G', 'goal');
    svg.setAttribute('viewBox', `0 0 ${width} ${ROWS * size}`);
    svg.innerHTML = markup;
  }

  function render() {
    const setup = model.mode === 'setup', drawing = model.mode === 'drawing', last = model.lastStep;
    root.dataset.phase = model.complete ? 'complete' : model.mode;
    root.dataset.position = model.position.join(',');
    root.dataset.start = model.start.join(','); root.dataset.goal = model.goal.join(',');
    root.dataset.route = JSON.stringify(model.route);
    root.dataset.steps = model.history.length;
    board.dataset.interactive = String(!model.complete);
    board.dataset.placing = String(setup);
    cells.setAttribute('aria-label', setup ? 'Place the start and goal' : drawing ? 'Draw your expected trajectory' : 'Move the AI through neighboring grid cells');
    buttons.forEach(button => {
      const cell = button.dataset.navCell.split(',').map(Number);
      const pointIndex = model.route.findIndex(point => sameCell(point, cell));
      const parts = [`Column ${cell[0] + 1}, row ${cell[1] + 1}`];
      if (sameCell(cell, model.position)) parts.push('current AI state');
      if (sameCell(cell, model.start)) parts.push('start');
      if (sameCell(cell, model.goal)) parts.push('goal');
      if (pointIndex >= 0) parts.push(`route point ${pointIndex + 1}`);
      button.setAttribute('aria-label', parts.join(', '));
      const endpoint = sameCell(cell, model.start) ? 'start' : sameCell(cell, model.goal) ? 'goal' : '';
      button.dataset.endpoint = setup ? endpoint : '';
      button.dataset.selected = String(setup && !!endpoint && endpoint === selectedEndpoint);
      button.disabled = model.complete;
    });
    root.querySelector('[data-nav-positions]').textContent = setup ? 'Draw trajectory' : 'Edit positions';
    root.querySelector('[data-nav-position-help]').textContent = setup ? 'Drag S and G to different cells. You can also select a marker, then select its new cell.' : 'Positions are set. Editing them clears the route and AI movement.';
    root.querySelector('[data-nav-state-label]').textContent = model.mode === 'moving' ? 'Current state' : 'Starting state';
    root.querySelector('[data-nav-use]').disabled = !model.canUseRoute;
    root.querySelector('[data-nav-undo]').disabled = !drawing || model.route.length < 2;
    root.querySelector('[data-nav-reset-ai]').disabled = model.mode !== 'moving';
    root.querySelector('[data-nav-reset-expectation]').disabled = setup;
    root.querySelector('[data-nav-movement-help]').textContent = model.mode !== 'moving' ? 'Confirm your trajectory to enable movement.' : model.complete ? 'Goal reached. Reset AI to try again.' : 'Click neighboring cells or drag from S. Each crossed cell executes one step.';
    root.querySelector('[data-nav-rpe]').textContent = last ? last.rpe : '—';
    root.querySelector('[data-nav-spe]').textContent = last ? last.spe : '—';
    root.querySelector('[data-nav-distance]').textContent = last ? `Distance to goal: ${format(last.before)} → ${format(last.after)}. ${last.rpe ? 'No decrease.' : 'Closer.'}` : 'No executed step yet.';
    root.querySelector('[data-nav-agreement]').textContent = last ? last.spe ? 'This directed step is absent from your route.' : 'This directed step is in your route.' : 'No executed step yet.';
    draw();
  }

  function addPoint(cell) {
    const result = model.addPoint(cell);
    if (result === 'added' || result === 'trimmed') render();
  }
  function moveTo(cell) {
    const result = model.moveTo(cell);
    if (!result) return;
    render();
  }
  function followCell(cell) {
    if (model.mode === 'drawing') addPoint(cell);
    else if (model.mode === 'moving') moveTo(cell);
  }
  function endpointAt(cell) {
    return sameCell(cell, model.start) ? 'start' : sameCell(cell, model.goal) ? 'goal' : null;
  }
  function placeEndpoint(kind, cell) {
    if (!cell || !model.setEndpoint(kind, cell)) return false;
    selectedEndpoint = null;
    render();
    return true;
  }
  function selectSetupCell(cell) {
    if (selectedEndpoint) { placeEndpoint(selectedEndpoint, cell); return; }
    selectedEndpoint = endpointAt(cell);
    render();
  }
  function cellAt(x, y) {
    const rect = board.getBoundingClientRect();
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) return null;
    return [Math.floor((x - rect.left) / rect.width * COLUMNS), Math.floor((y - rect.top) / rect.height * ROWS)];
  }
  board.addEventListener('pointerdown', event => {
    if (model.complete || !event.isPrimary || event.button !== 0 || drag) return;
    const cell = cellAt(event.clientX, event.clientY);
    if (!cell) return;
    event.preventDefault();
    if (model.mode === 'setup') {
      if (selectedEndpoint && !sameCell(cell, model[selectedEndpoint])) { placeEndpoint(selectedEndpoint, cell); return; }
      const endpoint = endpointAt(cell);
      if (!endpoint) return;
      selectedEndpoint = endpoint;
      drag = { kind: 'placement', endpoint, origin: cell, pointerId: event.pointerId, cell };
      render();
    } else {
      drag = { kind: 'path', pointerId: event.pointerId, x: event.clientX, y: event.clientY, cell };
      followCell(cell);
    }
    board.setPointerCapture(event.pointerId);
    board.dataset.dragging = 'true';
  });
  board.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (drag.kind === 'placement') { drag.cell = cellAt(event.clientX, event.clientY); draw(); return; }
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    // Sample the actual pointer segment so fast straight strokes retain each
    // crossed cell; never invent a diagonal or a shortest path to a clicked cell.
    const samples = Math.min(500, Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / (board.clientWidth / COLUMNS / 3))));
    for (let i = 1; i <= samples; i++) {
      const cell = cellAt(drag.x + dx * i / samples, drag.y + dy * i / samples);
      if (cell && (!drag.cell || !sameCell(cell, drag.cell))) { followCell(cell); drag.cell = cell; }
    }
    drag.x = event.clientX; drag.y = event.clientY;
  });
  function finishDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const finished = drag, id = drag.pointerId; drag = null;
    board.dataset.dragging = 'false';
    if (finished.kind === 'placement') {
      if (event.type === 'pointerup') {
        const target = cellAt(event.clientX, event.clientY);
        if (!target || !sameCell(target, finished.origin)) placeEndpoint(finished.endpoint, target);
      } else selectedEndpoint = null;
      render();
    }
    if (board.hasPointerCapture(id)) board.releasePointerCapture(id);
  }
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => board.addEventListener(type, finishDrag));
  cells.addEventListener('click', event => {
    // Pointer input was already handled on pointerdown. Enter/Space activation
    // produces detail=0 and remains available to keyboard and assistive input.
    const button = event.target.closest('[data-nav-cell]');
    if (button && event.detail === 0) {
      const cell = button.dataset.navCell.split(',').map(Number);
      if (model.mode === 'setup') selectSetupCell(cell); else followCell(cell);
    }
  });
  cells.addEventListener('keydown', event => {
    const directions = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    const direction = directions[event.key], button = event.target.closest('[data-nav-cell]');
    if (event.key === 'Escape' && selectedEndpoint) { selectedEndpoint = null; render(); }
    if (!direction || !button || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const cell = button.dataset.navCell.split(',').map(Number), delta = DIRECTIONS[direction];
    const next = cells.querySelector(`[data-nav-cell="${cell[0] + delta[0]},${cell[1] + delta[1]}"]`);
    next?.focus({ preventScroll: true });
  });
  root.querySelector('[data-nav-positions]').addEventListener('click', () => {
    selectedEndpoint = null;
    if (model.mode === 'setup') {
      model.beginDrawing();
    } else {
      model.editPositions();
    }
    render();
  });
  root.querySelector('[data-nav-use]').addEventListener('click', () => {
    if (!model.useRoute()) return;
    render();
  });
  root.querySelector('[data-nav-undo]').addEventListener('click', () => {
    if (model.undoPoint()) render();
  });
  root.querySelector('[data-nav-reset-ai]').addEventListener('click', () => {
    model.resetAI(); render();
  });
  root.querySelector('[data-nav-reset-expectation]').addEventListener('click', () => {
    model.resetExpectation(); render();
  });
  new ResizeObserver(draw).observe(board);
  render();
}
