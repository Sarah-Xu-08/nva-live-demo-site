/* Continuous RL teaching model for Overview, separate from trial classifiers. */
export const CURRENT_STATE = Object.freeze({x: .15, y: .4});
export const DISCOUNT = .9;
export const CONTRACTION = .65;
const COST = .1;

export function rotate(point, degrees) {
  const angle = degrees * Math.PI / 180;
  const c = Math.cos(angle), s = Math.sin(angle);
  return {x: c * point.x - s * point.y, y: s * point.x + c * point.y};
}

export const wrapAngle = angle => ((angle + 180) % 360 + 360) % 360 - 180;

export function extent(rx, ry, degrees) {
  const angle = degrees * Math.PI / 180;
  return {
    rx: Math.hypot(rx * Math.cos(angle), ry * Math.sin(angle)),
    ry: Math.hypot(rx * Math.sin(angle), ry * Math.cos(angle)),
  };
}

function localGoal(model, point) {
  return rotate({x: point.x - model.gx, y: point.y - model.gy}, -model.goalAngle);
}

function normalizedOffset(offset, radius) {
  if (radius > 0) return offset / radius;
  // A collapsed axis permits only an exact match (up to rotation roundoff).
  return Math.abs(offset) <= 1e-10 ? 0 : Math.sign(offset) * Infinity;
}

export function continuationValue(model, point) {
  const local = localGoal(model, point);
  return -COST * (normalizedOffset(local.x, model.wx) ** 2 + normalizedOffset(local.y, model.wy) ** 2);
}

export function reward(model, point) {
  return (1 - DISCOUNT * CONTRACTION ** 2) * continuationValue(model, point);
}

export function nextState(model, point) {
  if (model.wx === 0 || model.wy === 0) {
    // Keep the continuation centered on the goal when its tolerance collapses.
    // With no bend, every point stays on the direct next-state-to-goal line.
    const delta = rotate({x: point.x - model.gx, y: point.y - model.gy}, model.bend);
    return {x: model.gx + CONTRACTION * delta.x, y: model.gy + CONTRACTION * delta.y};
  }
  const local = localGoal(model, point);
  const normalized = rotate({x: local.x / model.wx, y: local.y / model.wy}, model.bend);
  const delta = rotate({
    x: model.wx * CONTRACTION * normalized.x,
    y: model.wy * CONTRACTION * normalized.y,
  }, model.goalAngle);
  return {x: model.gx + delta.x, y: model.gy + delta.y};
}

export function trajectory(model, current = CURRENT_STATE) {
  const points = [{...current}, {...model.step}];
  for (let i = 0; i < 10; i++) points.push(nextState(model, points.at(-1)));
  points.push({x: model.gx, y: model.gy});
  return points;
}

export function trajectoryReturn(agent, human, current = CURRENT_STATE) {
  // Score both agents with the human reward function, including the free step.
  let total = reward(human, current), discount = DISCOUNT, point = {...agent.step};
  // Contraction makes the remaining position error negligible after 80 steps.
  for (let step = 0; step < 80; step++) {
    total += discount * reward(human, point);
    point = nextState(agent, point);
    discount *= DISCOUNT;
  }
  // Include the continuing reward at the destination rather than truncating it.
  return total + discount * reward(human, {x: agent.gx, y: agent.gy}) / (1 - DISCOUNT);
}

export function predictionErrors(human, ai, current = CURRENT_STATE) {
  const expected = {...human.step}, observed = {...ai.step};
  const expectedReturn = trajectoryReturn(human, human, current);
  const aiReturn = trajectoryReturn(ai, human, current);
  const rpe = aiReturn - expectedReturn;
  const dx = observed.x - expected.x, dy = observed.y - expected.y;
  const local = rotate({x: dx, y: dy}, -human.toleranceAngle);
  // Distance in human-tolerance units: the rotated ellipse boundary is 1.
  const toleranceDistance = Math.hypot(normalizedOffset(local.x, human.tx), normalizedOffset(local.y, human.ty));
  return {
    expected, observed, expectedReturn, aiReturn, dx, dy,
    rpe: Number.isNaN(rpe) ? null : Math.abs(rpe) < 1e-12 ? 0 : rpe,
    spe: toleranceDistance,
    toleranceDistance,
    withinHumanTolerance: toleranceDistance <= 1 + 1e-9,
  };
}

export function createExamples() {
  // A wider start-to-goal span fills the compact plot without stretching its axes.
  const base = {gx: 2.2, gy: .68, wx: .3, wy: .22, bend: 0, goalAngle: 0};
  const withStep = model => ({...model, step: nextState(model, CURRENT_STATE)});
  const human = model => ({...withStep(model), tx: .10, ty: .075, toleranceAngle: 0});
  const examples = {
    aligned: {human: human(base), ai: withStep(base)},
    paths: {human: human({...base, bend: -18}), ai: withStep({...base, bend: 18})},
    goals: {human: human(base), ai: withStep({...base, gy: .22})},
  };
  examples.goals.ai.step = {...examples.goals.human.step};
  return examples;
}
