/* Explanatory teamwork diagram only; no experiment or backend requests. */
(() => {
  'use strict';
  const diagram = document.querySelector('#nva-project [data-collaborative-diagram]');
  if (!diagram) return;
  const svg = diagram.querySelector('.nv-collab-wires');
  const colors = {ink: '--nv-ink', muted: '--nv-muted', human: '--nv-collab-human', goal: '--nv-blue', action: '--nv-pink'};
  function make(tag, attributes) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    return element;
  }
  function draw() {
    const bounds = diagram.getBoundingClientRect();
    if (!bounds.width) return;
    const width = bounds.width;
    const narrow = getComputedStyle(diagram).getPropertyValue('--nv-collab-narrow').trim() === '1';
    function rect(selector) {
      const box = diagram.querySelector(selector).getBoundingClientRect();
      return {l: box.left - bounds.left, r: box.right - bounds.left, t: box.top - bounds.top, b: box.bottom - bounds.top, x: box.left - bounds.left + box.width / 2, y: box.top - bounds.top + box.height / 2};
    }
    const node = id => rect(`[data-collab-node="${id}"]`);
    const world = node('world');
    svg.setAttribute('viewBox', `0 0 ${width} ${bounds.height}`);
    svg.replaceChildren();
    const defs = make('defs', {});
    for (const [color, variable] of Object.entries(colors)) {
      const marker = make('marker', {id: `nv-collab-arrow-${color}`, viewBox: '0 0 12 12', refX: 11, refY: 6, markerWidth: 10, markerHeight: 10, markerUnits: 'userSpaceOnUse', orient: 'auto'});
      marker.append(make('path', {d: 'M1 1 11 6 1 11Z', fill: `var(${variable})`}));
      defs.append(marker);
    }
    svg.append(defs);
    function path(d, color, edge, dashed = false, halo = false) {
      if (halo) svg.append(make('path', {d, fill: 'none', stroke: 'var(--nv-bg)', 'stroke-width': 4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round'}));
      svg.append(make('path', {d, class: 'nv-collab-wire', stroke: `var(${colors[color]})`, 'data-collab-edge': edge, ...(dashed ? {'stroke-dasharray': '4 4'} : {}), 'marker-end': `url(#nv-collab-arrow-${color})`}));
    }
    function across(x1, y1, x2, y2, edge, color = 'muted', dashed = false, halo = false) {
      const x = (x1 + x2) / 2;
      path(`M${x1} ${y1} C${x} ${y1},${x} ${y2},${x2} ${y2}`, color, edge, dashed, halo);
    }
    function around(sx, sy, rail, tx, ty, color, edge) {
      const middle = (sy + ty) / 2, handle = Math.abs(ty - sy) * .18;
      path(`M${sx} ${sy} C${rail} ${sy},${rail} ${middle - handle},${rail} ${middle} C${rail} ${middle + handle},${rail} ${ty},${tx} ${ty}`, color, edge, true, true);
    }
    function sideToTop(sx, sy, rail, tx, ty, edge) {
      const bend = ty - 7, middle = (rail + tx) / 2, midY = (sy + bend) / 2;
      path(`M${sx} ${sy} C${rail} ${sy},${rail} ${midY - 8},${rail} ${midY} C${rail} ${bend},${rail} ${bend},${middle} ${bend} C${tx} ${bend},${tx} ${bend},${tx} ${ty}`, 'muted', edge);
    }
    const agents = ['h', 'ai'].map(id => ({id, team: node(`${id}-team`), own: node(`${id}-own`), expected: node(`${id}-expect`), action: node(`${id}-action`), color: id === 'h' ? 'human' : 'ink'}));
    for (const agent of agents) {
      const [upper, lower] = [
        {rect: agent.own, edge: `${agent.id}-team-own`},
        {rect: agent.expected, edge: `${agent.id}-team-other`}
      ].sort((a, b) => a.rect.y - b.rect.y);
      if (narrow) {
        sideToTop(agent.team.r + 2, agent.team.y - 14, width * .545, upper.rect.x, upper.rect.t - 3, upper.edge);
        sideToTop(agent.team.l - 2, agent.team.y + 14, width * .02, lower.rect.x, lower.rect.t - 3, lower.edge);
      } else {
        across(agent.team.r + 2, agent.team.y - 16, upper.rect.l - 3, upper.rect.y, upper.edge);
        across(agent.team.r + 2, agent.team.y + 16, lower.rect.l - 3, lower.rect.y, lower.edge);
      }
      path(`M${agent.own.r + 2} ${agent.own.y} L${agent.action.l - 3} ${agent.action.y}`, agent.color, `${agent.id}-own-action`);
    }
    path(`M${agents[0].action.x} ${agents[0].action.b + 2} L${world.x} ${world.t - 3}`, 'human', 'h-joint-action');
    path(`M${agents[1].action.x} ${agents[1].action.t - 2} L${world.x} ${world.b + 3}`, 'ink', 'ai-joint-action');
    const human = agents[0], checks = node('h-checks');
    for (const part of ['goal', 'action']) {
      const source = rect(`[data-collab-node="h-expect"] [data-collab-slot="${part}"]`);
      const target = rect(`[data-collab-error="${part}"]`);
      if (narrow) {
        around(human.expected.r + 2, source.y, width * (part === 'goal' ? .535 : .555), checks.r + 3, target.y - 9, part, `h-expected-${part}`);
        across(world.l - 2, world.y + (part === 'goal' ? -18 : 18), checks.r + 3, target.y + 9, `shared-result-${part}`, part, false, true);
      } else {
        const bend = checks.l - width * .035;
        path(`M${human.expected.r + 2} ${source.y} C${bend} ${source.y},${bend} ${target.y - 9},${checks.l - 3} ${target.y - 9}`, part, `h-expected-${part}`, true, true);
        across(world.r + 2, world.y + (part === 'goal' ? -18 : 18), checks.l - 3, target.y + 9, `shared-result-${part}`, part, false, true);
      }
    }
  }
  if ('ResizeObserver' in window) new ResizeObserver(draw).observe(diagram);
  else window.addEventListener('resize', draw);
  requestAnimationFrame(draw);
})();
