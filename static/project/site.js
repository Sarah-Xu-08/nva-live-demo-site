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
    const probabilities = { clear: [12, 24, 64], uncertain: [32, 35, 33], missing: null };
    if (!(key in probabilities)) return;
    const p = probabilities[key], chart = root.querySelector('.nv-stacked-prob');
    root.querySelectorAll('[data-estimate]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.estimate === key)));
    for (let i = 0; i < 3; i++) {
      root.querySelector(`[data-segment="${i}"]`).style.width = `${p ? p[i] : 0}%`;
      root.querySelector(`[data-p="${i}"]`).textContent = p ? `${p[i]}%` : '—';
    }
    chart.classList.toggle('nv-missing', !p);
    chart.setAttribute('aria-label', p ? `Illustrative class probabilities: nonPE ${p[0]} percent, SPE-only ${p[1]} percent, RPE plus SPE ${p[2]} percent` : 'Probabilities unavailable: no valid neural signals');
    const sorted = p ? [...p].sort((a, b) => b - a) : null;
    const margin = sorted ? sorted[0] - sorted[1] : null;
    root.querySelector('[data-verdict]').textContent = !p ? 'Unavailable' : margin >= 10 ? ['nonPE', 'SPE-only', 'RPE+SPE'][p.indexOf(sorted[0])] : 'Uncertain';
    root.querySelector('[data-margin]').textContent = !p ? 'Missing data / filter warm-up' : `${margin} pp lead · ${margin >= 10 ? '≥10 pp required' : 'below 10 pp'}`;
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
  const theory = root.querySelector('.nv-theory-tabs');
  function chooseTheory() {
    if (!theory) return;
    const requested = location.hash.slice(1), selected = ['general', 'nva', 'overcooked'].includes(requested) ? requested : 'general';
    root.querySelectorAll('.nv-theory-section').forEach(el => { el.hidden = el.id !== selected; });
    theory.querySelectorAll('a').forEach(el => {
      if (el.hash === `#${selected}`) el.setAttribute('aria-current', 'location');
      else el.removeAttribute('aria-current');
    });
  }
  if (theory) {
    chooseTheory();
    theory.addEventListener('click', event => {
      const link = event.target.closest('a');
      if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      history.pushState(null, '', link.hash);
      chooseTheory();
    });
    window.addEventListener('hashchange', chooseTheory);
    window.addEventListener('popstate', chooseTheory);
  }
  const epochExample = root.querySelector('[data-epoch-explainer]');
  if (epochExample) {
    const svg = epochExample.querySelector('.nv-epoch-timeline');
    const drag = epochExample.querySelector('[data-epoch-drag]');
    const peLabel = epochExample.querySelector('[data-epoch-pe-label]');
    const x = seconds => 160 + (seconds + 4) * 120;
    const time = seconds => `${seconds < 0 ? '−' : '+'}${Math.abs(seconds).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`;
    let end = 0.75, critical = 'pe', gesture = null;
    function updateEpochExample() {
      // Mirrors interval_labels for the illustrated trial: play=-2, critical=0,
      // end=2.5, with no additional PE/unknown actions. No saved model is read.
      const leadIn = end >= -1.75 && end < -0.125;
      const response = end >= 0.5 && end < (critical === 'pe' ? 1 : 2.5);
      const eligible = leadIn || response;
      const assigned = !eligible ? 'None · excluded' : leadIn || critical === 'nonpe' ? 'nonPE' : peLabel.value;
      const reason = leadIn ? 'Ends in the audited nonPE lead-in.'
        : response ? (critical === 'pe' ? 'Ends in the critical-response interval.' : 'Ends in a verified nonPE period.')
        : end < -1.75 ? 'Ends before gameplay +0.25 s.'
        : end < 0.5 ? 'Ends in the excluded interval around the critical action.'
        : end >= 2.5 ? 'The training interval excludes the trial-end boundary.'
        : 'Ends at or after C +1 s, outside PE response training.';
      drag.setAttribute('transform', `translate(${x(end - 2)} 280)`);
      drag.setAttribute('aria-valuenow', String(end));
      drag.setAttribute('aria-valuetext', `End ${time(end)} seconds; training ${eligible ? 'eligible' : 'excluded'}; label ${assigned}`);
      const dot = epochExample.querySelector('[data-epoch-dot]');
      dot.setAttribute('cx', x(end)); dot.setAttribute('cy', critical === 'pe' ? 101 : 186);
      const endLabel = epochExample.querySelector('[data-epoch-end-label]');
      endLabel.setAttribute('x', x(end)); endLabel.textContent = `Ends at C ${time(end)} s`;
      epochExample.querySelector('[data-epoch-readout]').textContent = `${time(end - 1)} to ${time(end)} s`;
      epochExample.querySelector('[data-epoch-baseline-readout]').textContent = `Baseline: ${time(end - 2)} to ${time(end - 1)} s`;
      epochExample.querySelector('[data-epoch-eligibility]').textContent = eligible ? 'Eligible' : 'Excluded';
      epochExample.querySelector('[data-epoch-assigned-label]').textContent = assigned;
      epochExample.querySelector('[data-epoch-reason]').textContent = reason;
      epochExample.querySelectorAll('[data-epoch-critical]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.epochCritical === critical)));
      epochExample.querySelectorAll('[data-epoch-track]').forEach(track => track.classList.toggle('nv-epoch-track-inactive', track.dataset.epochTrack !== critical));
      peLabel.disabled = critical !== 'pe';
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
    peLabel.addEventListener('change', updateEpochExample);
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
      probabilityExample.querySelector('[data-sigmoid-chart]').setAttribute('aria-label', `Illustrative sigmoid: RPE+SPE score ${score.toFixed(2)} maps to an estimate of ${q.toFixed(3)}`);
      estimates.forEach((estimate, i) => {
        const percent = estimate / total * 100;
        probabilityExample.querySelector(`[data-normalized-value="${i}"]`).textContent = `${percent.toFixed(1)}%`;
        probabilityExample.querySelector(`[data-normalized-numerator="${i}"]`).textContent = estimate.toFixed(3);
        probabilityExample.querySelector(`[data-normalized-denominator="${i}"]`).textContent = total.toFixed(3);
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
      markup += `<path d="M2 ${center} H${width - 2}" fill="none" stroke="var(--nv-line)" stroke-width="1"/><path d="${path}" fill="none" stroke="var(--nv-blue)" stroke-width="1.5" opacity="${1 - c * .18}"/>`;
    }
    svg.innerHTML = markup;
  }
  const waves = root.querySelectorAll('svg[data-wave]');
  const observer = new ResizeObserver(entries => entries.forEach(entry => drawWave(entry.target)));
  waves.forEach(svg => { drawWave(svg); observer.observe(svg); });
})();
