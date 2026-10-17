/* A Gaussian’s covariance determines both its contours and marginal distributions. */
(() => {
  'use strict';
  const root = document.getElementById('nv-value-landscapes');
  if (!root) return;
  const stage = root.querySelector('[data-value-stage]');
  const svg = root.querySelector('[data-value-svg]');
  const names = { human: 'Human', ai: 'AI' };
  const centers = Object.fromEntries(['human', 'ai'].map(name => [name, stage.querySelector('button[data-value-drag="' + name + '"]')]));
  const controls = Object.fromEntries([...stage.querySelectorAll('[data-value-shape]')].map(el => [el.dataset.valueShape, el]));
  const shapeDefaults = { sigmaGoal: .14, sigmaAction: .14, rho: .35 };
  const resetValues = {
    human: { goal: .40, action: .68, ...shapeDefaults },
    ai: { goal: .62, action: .38, ...shapeDefaults }
  };
  const values = { human: { ...resetValues.human }, ai: { ...resetValues.ai } };
  const low = -.60, span = 2.20, minSigma = .055, maxSigma = .24;
  const clamp = (n, min = 0, max = 1) => Math.max(min, Math.min(max, n));
  const format = n => n.toFixed(2);
  let selected = null, geometry = null, drag = null;
  const gaps = () => ({ rpe: Math.abs(values.human.goal - values.ai.goal), spe: Math.abs(values.human.action - values.ai.action) });
  function eigen(v) {
    const xx = v.sigmaGoal ** 2, yy = v.sigmaAction ** 2;
    const xy = v.rho * v.sigmaGoal * v.sigmaAction;
    const discriminant = Math.hypot(xx - yy, 2 * xy);
    return { major: Math.sqrt(Math.max(0, (xx + yy + discriminant) / 2)), minor: Math.sqrt(Math.max(0, (xx + yy - discriminant) / 2)), angle: .5 * Math.atan2(2 * xy, xx - yy) };
  }
  function fromEigen(v, major, minor, angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const xx = major * major * c * c + minor * minor * s * s;
    const yy = major * major * s * s + minor * minor * c * c;
    const xy = (major * major - minor * minor) * c * s;
    v.sigmaGoal = Math.sqrt(xx);
    v.sigmaAction = Math.sqrt(yy);
    v.rho = clamp(xy / (v.sigmaGoal * v.sigmaAction), -.999, .999);
  }
  function normalize(v) {
    v.sigmaGoal = clamp(v.sigmaGoal, minSigma, maxSigma);
    v.sigmaAction = clamp(v.sigmaAction, minSigma, maxSigma);
    v.rho = clamp(v.rho, -.9, .9);
    const e = eigen(v);
    fromEigen(v, clamp(e.major, minSigma, maxSigma), clamp(e.minor, minSigma, maxSigma), e.angle);
  }
  function announce() {
    const g = gaps();
    root.querySelector('[data-value-status]').textContent = (selected ? names[selected] + ' value selected. Goal spread ' + format(values[selected].sigmaGoal) + ', action spread ' + format(values[selected].sigmaAction) + '. ' : '') + 'Goal center gap ' + format(g.rpe) + '. Action center gap ' + format(g.spe) + '.';
  }
  function line(x1, y1, x2, y2, color = 'var(--nv-line)', dashed = false) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + color + '" stroke-width="1"' + (dashed ? ' stroke-dasharray="3 4"' : '') + '/>';
  }
  function text(x, y, label, css = '', anchor = 'start') {
    return '<text x="' + x + '" y="' + y + '" class="' + css + '" text-anchor="' + anchor + '">' + label + '</text>';
  }
  function curve(points, close = false) {
    return points.map(([x,y], i) => (i ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2)).join(' ') + (close ? ' Z' : '');
  }
  function bracket(x1, y1, x2, y2, color) {
    return line(x1,y1,x2,y2,color) + (x1 === x2
      ? line(x1-4,y1,x1+4,y1,color) + line(x2-4,y2,x2+4,y2,color)
      : line(x1,y1-4,x1,y1+4,color) + line(x2,y2-4,x2,y2+4,color));
  }
  function controlPoints(v) {
    const e = eigen(v);
    const end = { goal: v.goal + 2 * e.major * Math.cos(e.angle), action: v.action + 2 * e.major * Math.sin(e.angle) };
    const rotate = { goal: v.goal + (2 * e.major + .10) * Math.cos(e.angle), action: v.action + (2 * e.major + .10) * Math.sin(e.angle) };
    return {
      'goal-positive': { goal: v.goal + 2 * v.sigmaGoal, action: v.action + 2 * v.rho * v.sigmaAction },
      'goal-negative': { goal: v.goal - 2 * v.sigmaGoal, action: v.action - 2 * v.rho * v.sigmaAction },
      'action-positive': { goal: v.goal + 2 * v.rho * v.sigmaGoal, action: v.action + 2 * v.sigmaAction },
      'action-negative': { goal: v.goal - 2 * v.rho * v.sigmaGoal, action: v.action - 2 * v.sigmaAction },
      rotate, end
    };
  }
  function render() {
    const width = stage.clientWidth, height = stage.clientHeight;
    if (!width || !height) return;
    const compact = width < 450;
    const left = compact ? 82 : 100, right = width - 14, top = 42, bottom = height - 108;
    const plotWidth = right - left, plotHeight = bottom - top;
    const x = goal => left + (goal - low) / span * plotWidth;
    const y = action => bottom - (action - low) / span * plotHeight;
    const base = bottom + 55, sideBase = left - 16, amplitude = compact ? 20 : 28;
    geometry = { left, bottom, plotWidth, plotHeight };
    const editable = !!selected && !compact;
    root.dataset.compact = String(compact);
    root.dataset.selected = selected || '';
    const g = gaps();
    let markup = '<title>Editable human and AI value distributions</title><desc>Select a landscape, then move its center, resize its spread, or rotate it. The marginal curves are derived from the same Gaussian covariance as the ellipse.</desc>';
    markup += text(0,17,'Action','nv-values-axis') + text(60,17,compact ? 'How to act' : 'How to act · preferred transition','nv-values-muted');
    markup += line(left,top,left,bottom) + line(left,bottom,right,bottom);
    for (const v of Object.values(values)) {
      markup += line(x(v.goal),y(v.action),x(v.goal),base+12,'var(--nv-line)',true);
      markup += line(43,y(v.action),x(v.goal),y(v.action),'var(--nv-line)',true);
    }
    const minGoal = Math.min(values.human.sigmaGoal, values.ai.sigmaGoal);
    const minAction = Math.min(values.human.sigmaAction, values.ai.sigmaAction);
    const order = selected === 'human' ? ['ai','human'] : ['human','ai'];
    for (const name of order) {
      const v = values[name], color = 'var(--nv-value-' + name + ')', dash = name === 'ai' ? ' stroke-dasharray="5 4"' : '';
      markup += '<g data-value-drag="' + name + '" data-sigma-goal="' + v.sigmaGoal + '" data-sigma-action="' + v.sigmaAction + '" data-rho="' + v.rho + '" aria-hidden="true">';
      [2,1.34,.68].forEach((radius,i) => {
        const points = Array.from({length:81}, (_,step) => {
          const angle = step / 80 * 2 * Math.PI;
          return [x(v.goal + radius * v.sigmaGoal * Math.cos(angle)), y(v.action + radius * v.sigmaAction * (v.rho * Math.cos(angle) + Math.sqrt(1-v.rho*v.rho) * Math.sin(angle)))];
        });
        markup += '<path d="' + curve(points,true) + '" fill="' + color + '" fill-opacity="' + (i ? '.025' : '.045') + '" stroke="' + color + '" stroke-opacity="' + (i ? '.42' : '.95') + '" stroke-width="' + (i ? '1.3' : selected === name ? '2.6' : '2.2') + '"' + dash + '/>';
      });
      markup += '</g>';
      const goalPoints=[], actionPoints=[];
      for (let i=0;i<=180;i++) {
        const t=low+span*i/180;
        // Shared vertical scale within each marginal preserves relative Gaussian density.
        goalPoints.push([x(t),base-42*minGoal/v.sigmaGoal*Math.exp(-.5*((t-v.goal)/v.sigmaGoal)**2)]);
        actionPoints.push([sideBase-amplitude*minAction/v.sigmaAction*Math.exp(-.5*((t-v.action)/v.sigmaAction)**2),y(t)]);
      }
      markup += '<path data-value-marginal="' + name + '-goal" d="' + curve(goalPoints) + '" fill="none" stroke="' + color + '"' + dash + '/>';
      markup += '<path data-value-marginal="' + name + '-action" d="' + curve(actionPoints) + '" fill="none" stroke="' + color + '"' + dash + '/>';
    }
    markup += bracket(x(values.human.goal),base+12,x(values.ai.goal),base+12,'var(--nv-blue)');
    markup += text((x(values.human.goal)+x(values.ai.goal))/2,base+31,'RPE '+format(g.rpe),'nv-values-rpe','middle');
    markup += bracket(39,y(values.human.action),39,y(values.ai.action),'var(--nv-pink)');
    const middle=(y(values.human.action)+y(values.ai.action))/2;
    markup += text(0,middle-3,'SPE','nv-values-spe')+text(0,middle+14,format(g.spe),'nv-values-spe');
    markup += text(right,height-8,compact ? 'Goal · What to achieve' : 'Goal · What to achieve · desired outcome','nv-values-muted','end');
    if (editable) {
      const points=controlPoints(values[selected]);
      markup += line(x(points.end.goal),y(points.end.action),x(points.rotate.goal),y(points.rotate.action),'var(--nv-value-'+selected+')');
    }
    svg.setAttribute('viewBox','0 0 '+width+' '+height);
    svg.innerHTML=markup;
    for (const name of ['human','ai']) {
      const el=centers[name],v=values[name];
      el.style.left=x(v.goal)+'px'; el.style.top=y(v.action)+'px';
      el.style.zIndex=name===selected ? '3' : '2';
      el.dataset.goal=String(v.goal);el.dataset.action=String(v.action);
      el.setAttribute('aria-label','Move '+names[name].toLowerCase()+' value. Goal '+format(v.goal)+', action '+format(v.action));
    }
    for (const [mode,el] of Object.entries(controls)) {
      el.hidden=!editable;
      if (!editable) continue;
      const v=values[selected],p=controlPoints(v)[mode];
      el.style.left=x(p.goal)+'px'; el.style.top=y(p.action)+'px';
      el.style.setProperty('--nv-shape-ink','var(--nv-value-'+selected+')');
      const label=mode==='rotate' ? 'Rotate '+names[selected].toLowerCase()+' ellipse' : 'Adjust '+names[selected].toLowerCase()+' '+(mode.startsWith('goal')?'goal':'action')+' spread';
      el.setAttribute('aria-label',label);
      el.title=label+'. Arrow keys also adjust.';
    }
    const help=root.querySelector('[data-edit-help]');
    help.textContent=selected ? compact ? names[selected]+' selected. Drag its center; adjust its shape below.' : names[selected]+' selected. Center: move · Square handles: spread · Round handle: rotate.' : 'Select a landscape to reshape it. Drag its center to move it.';
    root.querySelector('[data-mobile-shape]').hidden=!selected;
    if (selected) {
      const v=values[selected];
      root.querySelector('[data-mobile-shape-title]').textContent='Adjust '+names[selected].toLowerCase()+' value';
      for (const input of root.querySelectorAll('[data-shape-slider]')) {
        input.value=input.dataset.shapeSlider==='angle' ? Math.round(eigen(v).angle*180/Math.PI) : v[input.dataset.shapeSlider];
      }
    }
    root.querySelector('[data-value-rpe]').textContent=format(g.rpe);
    root.querySelector('[data-value-spe]').textContent=format(g.spe);
    root.querySelectorAll('[data-value-select]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.valueSelect===selected)));
  }
  function toValue(event) {
    const r=stage.getBoundingClientRect();
    return {goal:low+(event.clientX-r.left-geometry.left)/geometry.plotWidth*span,action:low+(geometry.bottom-event.clientY+r.top)/geometry.plotHeight*span};
  }
  function setAngle(v,angle) { const e=eigen(v);fromEigen(v,e.major,e.minor,angle); }
  stage.addEventListener('pointerdown',event=>{
    if (!geometry || !event.isPrimary || event.button!==0 || drag) return;
    const target=event.target.closest('[data-value-shape], [data-value-drag]');
    if (!target) {selected=null;render();announce();return;}
    event.preventDefault();
    const mode=target.dataset.valueShape || 'move';
    if (mode==='move') selected=target.dataset.valueDrag;
    if (!selected) return;
    const point=toValue(event),v=values[selected];
    drag={pointerId:event.pointerId,name:selected,mode,goalOffset:point.goal-v.goal,actionOffset:point.action-v.action,start:{...v},startPointerAngle:Math.atan2(point.action-v.action,point.goal-v.goal)};
    stage.setPointerCapture(event.pointerId);
    stage.dataset.dragging=selected;
    (mode==='move'?centers[selected]:controls[mode]).focus({preventScroll:true});
    render();
  });
  stage.addEventListener('pointermove',event=>{
    if (!drag || event.pointerId!==drag.pointerId) return;
    const point=toValue(event),v=values[drag.name];
    if (drag.mode==='move') {
      v.goal=clamp(point.goal-drag.goalOffset);v.action=clamp(point.action-drag.actionOffset);
    } else if (drag.mode==='rotate') {
      const start=eigen(drag.start);
      const delta=Math.atan2(point.action-v.action,point.goal-v.goal)-drag.startPointerAngle;
      fromEigen(v,start.major,start.minor,start.angle+delta);
    } else {
      const axis=drag.mode.startsWith('goal')?'goal':'action';
      const sign=drag.mode.endsWith('positive')?1:-1;
      v[axis==='goal'?'sigmaGoal':'sigmaAction']=clamp(sign*(point[axis]-v[axis])/2,minSigma,maxSigma);
      normalize(v);
    }
    render();
  });
  function finish(event) {
    if (!drag || drag.pointerId!==event.pointerId) return;
    const id=drag.pointerId;drag=null;delete stage.dataset.dragging;
    if (stage.hasPointerCapture(id)) stage.releasePointerCapture(id);
    announce();
  }
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>stage.addEventListener(type,finish));
  for (const [name,el] of Object.entries(centers)) {
    el.addEventListener('focus',()=>{selected=name;render();});
    el.addEventListener('keydown',event=>{
      const spec={ArrowLeft:['goal',-1],ArrowRight:['goal',1],ArrowUp:['action',1],ArrowDown:['action',-1]}[event.key];
      if (!spec) return;
      event.preventDefault();selected=name;
      const [axis,sign]=spec;
      values[name][axis]=clamp(Math.round((values[name][axis]+sign*(event.shiftKey ? .05 : .01))*10000)/10000);
      render();announce();
    });
  }
  for (const [mode,el] of Object.entries(controls)) {
    el.addEventListener('keydown',event=>{
      if (!selected || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const sign=['ArrowRight','ArrowUp'].includes(event.key)?1:-1;
      const v=values[selected];
      if (mode==='rotate') setAngle(v,eigen(v).angle+sign*(event.shiftKey?15:5)*Math.PI/180);
      else {
        const axis=mode.startsWith('goal')?'sigmaGoal':'sigmaAction';
        v[axis]=clamp(v[axis]+sign*(event.shiftKey ? .02 : .005),minSigma,maxSigma);normalize(v);
      }
      render();announce();
    });
  }
  for (const input of root.querySelectorAll('[data-shape-slider]')) {
    input.addEventListener('input',()=>{
      if (!selected) return;
      const v=values[selected],key=input.dataset.shapeSlider;
      if (key==='angle') setAngle(v,Number(input.value)*Math.PI/180);
      else {v[key]=Number(input.value);normalize(v);}
      render();
    });
    input.addEventListener('change',announce);
  }
  root.querySelectorAll('[data-value-select]').forEach(el=>el.addEventListener('click',()=>{
    selected=el.dataset.valueSelect;render();centers[selected].focus({preventScroll:true});announce();
  }));
  root.querySelector('[data-value-reset]').addEventListener('click',()=>{
    for (const name of ['human','ai']) Object.assign(values[name],resetValues[name]);
    selected=null;render();announce();
  });
  root.addEventListener('keydown',event=>{
    if (event.key==='Escape' && !drag) { selected=null;stage.querySelector(':focus')?.blur();render();announce(); }
  });
  new ResizeObserver(render).observe(stage);
  render();
})();
