/* A conceptual value-space illustration; no trial, decoder, or EEG inputs. */
(() => {
  'use strict';
  const root = document.getElementById('nv-value-landscapes');
  if (!root) return;
  const stage = root.querySelector('[data-value-stage]');
  const svg = root.querySelector('[data-value-svg]');
  const handles = Object.fromEntries(['human', 'ai'].map(name => [name, stage.querySelector(`button[data-value-drag="${name}"]`)]));
  const initial = { human: { goal: .40, action: .68 }, ai: { goal: .62, action: .38 } };
  const values = { human: { ...initial.human }, ai: { ...initial.ai } };
  const names = { human: 'Human', ai: 'AI' };
  // A single correlated bivariate Gaussian supplies both contours and marginals.
  // Only its mean moves; covariance is fixed. Neither proxy is a TD error.
  const sigma = .14, correlation = .35, low = -.32, span = 1.64;
  let selected = 'human', geometry, drag = null;
  const clamp = n => Math.max(0, Math.min(1, n));
  const format = n => n.toFixed(2);
  const gaps = () => ({ rpe: Math.abs(values.human.goal - values.ai.goal), spe: Math.abs(values.human.action - values.ai.action) });
  const line = (x1, y1, x2, y2, color = 'var(--nv-line)', dashed = false) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1"${dashed ? ' stroke-dasharray="3 4"' : ''}/>`;
  const text = (x, y, label, css = '', anchor = 'start') => `<text x="${x}" y="${y}" class="${css}" text-anchor="${anchor}">${label}</text>`;
  function bracket(x1, y1, x2, y2, color) {
    return line(x1,y1,x2,y2,color) + (x1 === x2
      ? line(x1-4,y1,x1+4,y1,color) + line(x2-4,y2,x2+4,y2,color)
      : line(x1,y1-4,x1,y1+4,color) + line(x2,y2-4,x2,y2+4,color));
  }
  function curvePath(points, close = false) {
    return points.map(([x,y],i) => `${i ? 'L':'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ') + (close ? ' Z' : '');
  }
  function announce() {
    const { rpe, spe } = gaps();
    root.querySelector('[data-value-status]').textContent = `${names[selected]} value: goal ${format(values[selected].goal)}, action ${format(values[selected].action)}. RPE proxy ${format(rpe)}. SPE proxy ${format(spe)}.`;
  }
  function render() {
    const width = stage.clientWidth, height = stage.clientHeight;
    if (!width || !height) return;
    const compact = width < 450;
    const left = compact ? 83 : 118, right = width-12, top = 42, bottom = height-113;
    const plotWidth = right-left, plotHeight = bottom-top;
    const x = goal => left + (goal-low)/span*plotWidth;
    const y = action => bottom - (action-low)/span*plotHeight;
    const base = bottom+56, sideBase = left-16, amplitude = compact ? 19:28;
    geometry = { left, bottom, plotWidth, plotHeight };
    const { rpe, spe } = gaps();
    let markup = '<title>Goal and action dimensions of human and AI value</title><desc>Drag either landscape or focus its center and use arrow keys. The curves are matching marginal distributions; the labeled gaps are illustrative RPE and SPE proxies.</desc>';
    markup += text(0,17,'Action','nv-values-axis') + text(60,17,compact ? 'How to act':'How to act · preferred transition','nv-values-muted');
    markup += line(left,top,left,bottom) + line(left,bottom,right,bottom);
    for (const v of Object.values(values)) {
      markup += line(x(v.goal),y(v.action),x(v.goal),base+12,'var(--nv-line)',true);
      markup += line(45,y(v.action),x(v.goal),y(v.action),'var(--nv-line)',true);
    }
    // Draw the selected landscape last, so either remains reachable at overlap.
    const order = selected === 'human' ? ['ai','human'] : ['human','ai'];
    for (const name of order) {
      const v = values[name], color = `var(--nv-value-${name})`, dash = name === 'ai' ? ' stroke-dasharray="5 4"' : '';
      markup += `<g data-value-drag="${name}" aria-hidden="true">`;
      [2,1.34,.68].forEach((radius, i) => {
        const points = Array.from({ length: 81 }, (_, step) => {
          const angle = step/80*Math.PI*2;
          const goal = v.goal + radius*sigma*Math.cos(angle);
          const action = v.action + radius*sigma*(correlation*Math.cos(angle) + Math.sqrt(1-correlation**2)*Math.sin(angle));
          return [x(goal), y(action)];
        });
        markup += `<path d="${curvePath(points,true)}" fill="${color}" fill-opacity="${i ? '.025':'.045'}" stroke="${color}" stroke-opacity="${i ? '.42':'.95'}" stroke-width="${i ? '1':'1.6'}"${dash}/>`;
      });
      markup += '</g>';
      const goalPoints = [], actionPoints = [];
      for (let i=0;i<=140;i++) {
        const t = low+span*i/140;
        goalPoints.push([x(t),base-34*Math.exp(-.5*((t-v.goal)/sigma)**2)]);
        actionPoints.push([sideBase-amplitude*Math.exp(-.5*((t-v.action)/sigma)**2),y(t)]);
      }
      markup += `<path data-value-marginal="${name}-goal" d="${curvePath(goalPoints)}" fill="none" stroke="${color}" stroke-width="1.7"${dash}/>`;
      markup += `<path data-value-marginal="${name}-action" d="${curvePath(actionPoints)}" fill="none" stroke="${color}" stroke-width="1.7"${dash}/>`;
    }
    markup += bracket(x(values.human.goal),base+12,x(values.ai.goal),base+12,'var(--nv-blue)');
    markup += text((x(values.human.goal)+x(values.ai.goal))/2,base+31,`RPE ${format(rpe)}`,'nv-values-rpe','middle');
    markup += bracket(42,y(values.human.action),42,y(values.ai.action),'var(--nv-pink)');
    const middle = (y(values.human.action)+y(values.ai.action))/2;
    markup += text(0,middle-3,'SPE','nv-values-spe') + text(0,middle+14,format(spe),'nv-values-spe');
    markup += text(right,height-8,compact ? 'Goal · What to achieve':'Goal · What to achieve · desired outcome','nv-values-muted','end');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.innerHTML = markup;
    for (const name of ['human','ai']) {
      const handle = handles[name], v = values[name];
      handle.style.left = `${x(v.goal)}px`;
      handle.style.top = `${y(v.action)}px`;
      handle.style.zIndex = name === selected ? '2':'1';
      handle.setAttribute('aria-label', `Move ${names[name].toLowerCase()} value. Goal ${format(v.goal)}, action ${format(v.action)}`);
      handle.dataset.goal = String(v.goal);
      handle.dataset.action = String(v.action);
    }
    root.querySelector('[data-value-rpe]').textContent = format(rpe);
    root.querySelector('[data-value-spe]').textContent = format(spe);
    root.querySelectorAll('[data-value-select]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.valueSelect === selected)));
  }
  function toValue(event) {
    const rect = stage.getBoundingClientRect();
    return { goal: low+(event.clientX-rect.left-geometry.left)/geometry.plotWidth*span, action: low+(geometry.bottom-event.clientY+rect.top)/geometry.plotHeight*span };
  }
  stage.addEventListener('pointerdown', event => {
    if (!geometry || !event.isPrimary || event.button !== 0 || drag) return;
    const target = event.target.closest('[data-value-drag]');
    if (!target) return;
    event.preventDefault();
    selected = target.dataset.valueDrag;
    const point = toValue(event);
    drag = { pointerId: event.pointerId, name: selected, goalOffset: point.goal-values[selected].goal, actionOffset: point.action-values[selected].action };
    stage.setPointerCapture(event.pointerId);
    stage.dataset.dragging = selected;
    handles[selected].focus({ preventScroll: true });
    render();
  });
  stage.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const point = toValue(event);
    values[drag.name].goal = clamp(point.goal-drag.goalOffset);
    values[drag.name].action = clamp(point.action-drag.actionOffset);
    render();
  });
  function finishDrag(event) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const pointerId = drag.pointerId;
    drag = null;
    delete stage.dataset.dragging;
    if (stage.hasPointerCapture(pointerId)) stage.releasePointerCapture(pointerId);
    announce();
  }
  ['pointerup','pointercancel','lostpointercapture'].forEach(type => stage.addEventListener(type,finishDrag));
  Object.entries(handles).forEach(([name,handle]) => {
    handle.addEventListener('focus', () => { selected=name; render(); });
    handle.addEventListener('keydown', event => {
      const direction = { ArrowLeft: ['goal',-1], ArrowRight: ['goal',1], ArrowUp: ['action',1], ArrowDown: ['action',-1] }[event.key];
      if (!direction) return;
      event.preventDefault();
      selected=name;
      const [axis,sign] = direction;
      values[name][axis] = clamp(Math.round((values[name][axis]+sign*(event.shiftKey ? .05:.01))*10000)/10000);
      render(); announce();
    });
  });
  root.querySelectorAll('[data-value-select]').forEach(button => button.addEventListener('click', () => {
    selected=button.dataset.valueSelect;
    render(); handles[selected].focus({ preventScroll: true }); announce();
  }));
  root.querySelector('[data-value-reset]').addEventListener('click', () => {
    Object.keys(values).forEach(name => Object.assign(values[name],initial[name]));
    selected='human'; render(); announce();
  });
  new ResizeObserver(render).observe(stage);
  render();
})();
