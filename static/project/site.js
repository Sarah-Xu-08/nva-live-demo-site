/* Presentation interactions only. This file never opens a demo session or reads EEG. */
(() => {
  'use strict';
  const root = document.getElementById('nva-project');
  if (!root) return;
  const examples = {
    aligned: { p: [76, 16, 8], text: 'Expected task. Acceptable outcome.' },
    spe: { p: [14, 72, 14], text: 'Correct task. Unexpected execution.' },
    combined: { p: [8, 20, 72], text: 'Task and action expectations violated.' }
  };
  function chooseCondition(key) {
    const example = examples[key];
    if (!example) return;
    root.querySelectorAll('[data-condition]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.condition === key)));
    root.querySelectorAll('[data-cell]').forEach(el => el.classList.toggle('nv-selected', el.dataset.cell === key));
    root.querySelector('[data-example-line]').textContent = example.text;
    ['nonpe', 'spe', 'combined'].forEach((name, i) => {
      root.querySelector(`[data-probbar="${name}"]`).style.width = `${example.p[i]}%`;
      root.querySelector(`[data-probvalue="${name}"]`).textContent = `${example.p[i]}%`;
    });
  }
  function chooseEstimate(key) {
    const probabilities = { clear: [12, 24, 64], uncertain: [32, 35, 33] };
    if (!(key in probabilities)) return;
    const p = probabilities[key], chart = root.querySelector('.nv-stacked-prob');
    root.querySelectorAll('[data-estimate]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.estimate === key)));
    for (let i = 0; i < 3; i++) {
      root.querySelector(`[data-segment="${i}"]`).style.width = `${p[i]}%`;
      root.querySelector(`[data-p="${i}"]`).textContent = `${p[i]}%`;
    }
    chart.setAttribute('aria-label', `Illustrative class probabilities: nonPE ${p[0]} percent, SPE ${p[1]} percent, RPE ${p[2]} percent`);
    const sorted = [...p].sort((a, b) => b - a);
    const margin = sorted[0] - sorted[1];
    root.querySelector('[data-verdict]').textContent = margin >= 10 ? ['nonPE', 'SPE', 'RPE'][p.indexOf(sorted[0])] : 'Uncertain';
    root.querySelector('[data-margin]').textContent = `${margin} pp lead · ${margin >= 10 ? '≥10 pp required' : 'below 10 pp'}`;
  }
  const handoffs = {
    accepted: { rpe: 0, spe: 0, outcome: 'Accepted counter', recipient: 'Human receives', text: 'The expected subtask and its execution are both satisfied.' },
    blocked: { rpe: 0, spe: 1, outcome: 'Handoff route blocked', recipient: 'Human obstructed', text: 'The AI pursues the expected handoff but unnecessarily blocks an established passage despite an acceptable alternative.' },
    wrong: { rpe: 1, spe: 1, outcome: 'Onion added to pot', recipient: 'Handoff omitted', text: 'Adding the onion to a pot contradicts the expected handoff and produces an outcome outside the accepted set.' },
    yield: { rpe: 0, spe: 0, outcome: 'Accepted yield', recipient: 'Handoff resumes', text: 'Necessary coordination supports the expected task. Waiting or moving away is not automatically an error.' }
  };
  function chooseHandoff(key) {
    const item = handoffs[key];
    if (!item) return;
    root.querySelectorAll('[data-handoff]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.handoff === key)));
    for (const name of ['rpe', 'spe', 'outcome', 'recipient']) root.querySelector(`[data-handoff-${name}]`).textContent = item[name];
    root.querySelector('[data-handoff-explanation]').textContent = item.text;
  }
  root.querySelectorAll('.nv-theory-tabs, .nv-experiment-tabs').forEach(tabs => {
    const links = [...tabs.querySelectorAll('a[href^="#"]')];
    const sections = links.map(link => document.getElementById(link.hash.slice(1)));
    function sectionFor(hash) {
      let id;
      try { id = decodeURIComponent(hash.slice(1)); } catch { return null; }
      const target = document.getElementById(id);
      return sections.find(section => section === target || section.contains(target));
    }
    function chooseSection() {
      const selected = sectionFor(location.hash) || sections[0];
      sections.forEach(section => { section.hidden = section !== selected; });
      links.forEach(link => {
        if (link.hash === `#${selected.id}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }
    chooseSection();
    tabs.closest('.nv-page').addEventListener('click', event => {
      const link = event.target.closest('a[href^="#"]');
      if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const selected = sectionFor(link.hash);
      if (!selected) return;
      event.preventDefault();
      if (location.hash !== link.hash) history.pushState(null, '', link.hash);
      chooseSection();
      if (!tabs.contains(link)) {
        // A link at the end of a stage returns readers to the tab bar.
        links.find(item => item.hash === `#${selected.id}`).focus({ preventScroll: true });
        tabs.scrollIntoView({ block: 'start' });
      }
    });
    window.addEventListener('hashchange', chooseSection);
    window.addEventListener('popstate', chooseSection);
  });
  const framework = root.querySelector('[data-framework-diagram]');
  if (framework) {
    const wires = framework.querySelector('.nv-framework-wires');
    function drawFramework() {
      const bounds = framework.getBoundingClientRect();
      if (!bounds.width) return;
      wires.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
      const rect = selector => {
        const box = framework.querySelector(selector).getBoundingClientRect();
        return {left: box.left - bounds.left, right: box.right - bounds.left, top: box.top - bounds.top, bottom: box.bottom - bounds.top, x: box.left - bounds.left + box.width / 2, y: box.top - bounds.top + box.height / 2};
      };
      const context = rect('.nv-framework-context'), observed = rect('.nv-framework-observed');
      const rpe = rect('.nv-framework-rpe'), spe = rect('.nv-framework-spe');
      const path = (edge, d) => framework.querySelector(`[data-framework-edge="${edge}"]`).setAttribute('d', d);
      if (matchMedia('(max-width:680px)').matches) {
        const joinX = bounds.width / 2, joinY = Math.max(context.bottom, observed.bottom) + 20, busX = 5;
        path('context-bus', `M ${context.x} ${context.bottom} V ${joinY} H ${joinX}`);
        path('observed-bus', `M ${observed.x} ${observed.bottom} V ${joinY} H ${joinX}`);
        path('bus', `M ${joinX} ${joinY} H ${busX} V ${spe.y}`);
        path('bus-rpe', `M ${busX} ${rpe.y} H ${rpe.left - 2}`);
        path('bus-spe', `M ${busX} ${spe.y} H ${spe.left - 2}`);
      } else {
        for (const [target, name] of [[rpe, 'rpe'], [spe, 'spe']]) {
          for (const [source, side] of [[context, 'context'], [observed, 'observed']]) {
            const x1 = side === 'context' ? source.right : source.left;
            const x2 = side === 'context' ? target.left - 2 : target.right + 2;
            const mid = (x1 + x2) / 2;
            // Keep a diagonal approach so the automatic arrowhead follows the curve into the check.
            const approachY = target.y + (source.y - target.y) * .35;
            path(`${side}-${name}`, `M ${x1} ${source.y} C ${mid} ${source.y}, ${mid} ${approachY}, ${x2} ${target.y}`);
          }
        }
      }
    }
    if ('ResizeObserver' in window) new ResizeObserver(drawFramework).observe(framework);
    else window.addEventListener('resize', drawFramework);
    requestAnimationFrame(drawFramework);
  }
  const notationDialog = root.querySelector('#nv-notation-dialog');
  const notationReference = root.querySelector('#nv-shared-notation-reference');
  if (notationDialog && notationReference && typeof notationDialog.showModal === 'function') {
    const referenceCopy = notationReference.cloneNode(true);
    referenceCopy.removeAttribute('id');
    notationDialog.querySelector('[data-shared-notation-body]').appendChild(referenceCopy);
    let notationTrigger;
    root.querySelectorAll('[data-shared-notation]').forEach(button => {
      button.hidden = false;
      button.addEventListener('click', () => {
        notationTrigger = button;
        notationDialog.showModal();
        notationDialog.scrollTop = 0;
        document.documentElement.classList.add('nv-notation-open');
      });
    });
    notationDialog.querySelector('[data-close-shared-notation]').addEventListener('click', () => notationDialog.close());
    notationDialog.addEventListener('click', event => {
      if (event.target !== notationDialog) return;
      const bounds = notationDialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) notationDialog.close();
    });
    notationDialog.addEventListener('close', () => {
      document.documentElement.classList.remove('nv-notation-open');
      notationTrigger?.focus({preventScroll: true});
    });
  }
  const epochExample = root.querySelector('[data-epoch-explainer]');
  if (epochExample) {
    const svg = epochExample.querySelector('.nv-epoch-timeline');
    const drag = epochExample.querySelector('[data-epoch-drag]');
    const x = seconds => 160 + (seconds + 4) * 120;
    const time = seconds => `${seconds < 0 ? '−' : '+'}${Math.abs(seconds).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`;
    let end = 0.75, critical = 'pe', gesture = null;
    function updateEpochExample() {
      // Mirrors interval_labels for the illustrated trial: play=-2, critical=0,
      // end=2.5, with no additional PE/unknown actions. No saved model is read.
      const leadIn = end >= -1.75 && end < -0.125;
      const response = end >= 0.5 && end < (critical === 'pe' ? 1 : 2.5);
      const eligible = leadIn || response;
      const assigned = !eligible ? '—' : leadIn || critical === 'nonpe' ? 'nonPE' : 'PE';
      drag.setAttribute('transform', `translate(${x(end - 2)} 280)`);
      drag.setAttribute('aria-valuenow', String(end));
      drag.setAttribute('aria-valuetext', `End ${time(end)} seconds; training ${eligible ? 'eligible' : 'excluded'}; label ${eligible ? assigned : 'none'}`);
      const dot = epochExample.querySelector('[data-epoch-dot]');
      dot.setAttribute('cx', x(end)); dot.setAttribute('cy', critical === 'pe' ? 101 : 186);
      const endLabel = epochExample.querySelector('[data-epoch-end-label]');
      endLabel.setAttribute('x', x(end)); endLabel.textContent = `Ends at C ${time(end)} s`;
      epochExample.querySelector('[data-epoch-eligibility]').textContent = eligible ? 'Eligible' : 'Excluded';
      epochExample.querySelector('[data-epoch-assigned-label]').textContent = assigned;
      epochExample.querySelectorAll('[data-epoch-critical]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.epochCritical === critical)));
      epochExample.querySelectorAll('[data-epoch-track]').forEach(track => track.classList.toggle('nv-epoch-track-inactive', track.dataset.epochTrack !== critical));
    }
    function moveEpoch(value) {
      end = Math.max(-2, Math.min(2.5, Math.round(value * 16) / 16));
      updateEpochExample();
    }
    function pointerX(event) {
      const point = svg.createSVGPoint();
      point.x = event.clientX; point.y = event.clientY;
      return point.matrixTransform(svg.getScreenCTM().inverse()).x;
    }
    drag.addEventListener('pointerdown', event => {
      if (event.button !== 0 || gesture) return;
      event.preventDefault(); drag.focus({ preventScroll: true });
      gesture = { id: event.pointerId, x: pointerX(event), end };
      drag.setPointerCapture(event.pointerId); drag.classList.add('nv-dragging');
    });
    drag.addEventListener('pointermove', event => {
      if (gesture && gesture.id === event.pointerId) moveEpoch(gesture.end + (pointerX(event) - gesture.x) / 120);
    });
    function stopDrag(event) {
      if (!gesture || gesture.id !== event.pointerId) return;
      if (event.type === 'pointerup') moveEpoch(gesture.end + (pointerX(event) - gesture.x) / 120);
      gesture = null; drag.classList.remove('nv-dragging');
      if (drag.hasPointerCapture(event.pointerId)) drag.releasePointerCapture(event.pointerId);
    }
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(name => drag.addEventListener(name, stopDrag));
    drag.addEventListener('keydown', event => {
      const changes = { ArrowLeft: -0.0625, ArrowDown: -0.0625, ArrowRight: 0.0625, ArrowUp: 0.0625 };
      if (event.key in changes) { event.preventDefault(); moveEpoch(end + changes[event.key]); }
      else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); moveEpoch(event.key === 'Home' ? -2 : 2.5); }
    });
    epochExample.querySelectorAll('[data-epoch-critical]').forEach(button => button.addEventListener('click', () => {
      critical = button.dataset.epochCritical; updateEpochExample();
    }));
    updateEpochExample();
  }
  const probabilityExample = root.querySelector('[data-probability-explainer]');
  if (probabilityExample) {
    const slider = probabilityExample.querySelector('#calibration-score');
    const sigmoid = score => 1 / (1 + Math.exp(-score));
    const point = score => [40 + (score + 4) / 8 * 242, 158 - sigmoid(score) * 130];
    // This toy curve has unit slope and zero offset; it never reads a saved model.
    const curve = Array.from({ length: 161 }, (_, i) => {
      const [x, y] = point(-4 + i / 20);
      return `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(' ');
    probabilityExample.querySelector('[data-sigmoid-curve]').setAttribute('d', curve);
    function updateCalibrationExample() {
      const score = Number(slider.value), q = sigmoid(score);
      // The displayed fixed scores are rounded logits of exactly 0.10 and 0.20.
      const estimates = [0.10, 0.20, q], total = estimates.reduce((a, b) => a + b, 0);
      const [x, y] = point(score);
      probabilityExample.querySelectorAll('[data-demo-score]').forEach(el => { el.textContent = score.toFixed(2); });
      probabilityExample.querySelectorAll('[data-demo-estimate]').forEach(el => { el.textContent = q.toFixed(3); });
      probabilityExample.querySelector('[data-demo-total]').textContent = total.toFixed(3);
      probabilityExample.querySelector('[data-sigmoid-guide]').setAttribute('d', `M40 ${y}H${x}V158`);
      const dot = probabilityExample.querySelector('[data-sigmoid-point]');
      dot.setAttribute('cx', x); dot.setAttribute('cy', y);
      probabilityExample.querySelector('[data-sigmoid-chart]').setAttribute('aria-label', `Illustrative sigmoid: RPE score ${score.toFixed(2)} maps to an estimate of ${q.toFixed(3)}`);
      estimates.forEach((estimate, i) => {
        const percent = estimate / total * 100;
        probabilityExample.querySelector(`[data-normalized-value="${i}"]`).textContent = `${percent.toFixed(1)}%`;
        probabilityExample.querySelector(`[data-normalized-bar="${i}"]`).style.width = `${percent}%`;
      });
    }
    slider.addEventListener('input', updateCalibrationExample);
    probabilityExample.querySelector('[data-reset-calibration]').addEventListener('click', () => {
      slider.value = '0'; updateCalibrationExample();
    });
    updateCalibrationExample();
  }
  root.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.condition) chooseCondition(button.dataset.condition);
    if (button.dataset.estimate) chooseEstimate(button.dataset.estimate);
    if (button.dataset.handoff) chooseHandoff(button.dataset.handoff);
  });
  const grid = root.querySelector('.nv-feature-grid');
  if (grid) for (let i = 0; i < 140; i++) {
    const cell = document.createElement('span');
    cell.style.opacity = String(.14 + ((i * 7) % 13) / 18);
    grid.appendChild(cell);
  }
  function drawWave(svg) {
    const { width, height } = svg.getBoundingClientRect();
    if (!width || !height) return;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const count = svg.dataset.wave === 'mini' ? 1 : 3;
    let markup = '';
    for (let c = 0; c < count; c++) {
      const center = (c + .5) * height / count, amplitude = Math.min(13, height / count * .24);
      let path = '';
      for (let x = 2; x <= width - 2; x += 2) {
        const t = x / width, envelope = .3 + .7 * Math.exp(-Math.pow((t - .57) * 5, 2));
        const y = center + amplitude * envelope * (Math.sin(t * 55 + c * 1.3) + .4 * Math.sin(t * 111 + c * .7));
        path += `${x === 2 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)} `;
      }
      markup += `<path d="M2 ${center} H${width - 2}" fill="none" stroke="var(--nv-line)" stroke-width="1"/><path d="${path}" fill="none" stroke="var(--nv-support)" stroke-width="1.5" opacity="${1 - c * .18}"/>`;
    }
    svg.innerHTML = markup;
  }
  const waves = root.querySelectorAll('svg[data-wave]');
  const observer = new ResizeObserver(entries => entries.forEach(entry => drawWave(entry.target)));
  waves.forEach(svg => { drawWave(svg); observer.observe(svg); });
})();
