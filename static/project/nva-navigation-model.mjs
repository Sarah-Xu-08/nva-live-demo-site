/* NVA §IV-B navigation example: pure state and stepwise behavioral labels. */
export const COLUMNS = 7;
export const ROWS = 5;
export const START = Object.freeze([2, 3]);
export const GOAL = Object.freeze([5, 1]);
export const DIRECTIONS = Object.freeze({ up: [0, -1], left: [-1, 0], down: [0, 1], right: [1, 0] });
export const sameCell = (a, b) => a[0] === b[0] && a[1] === b[1];
export const inBounds = cell => cell.length === 2 && cell.every(Number.isInteger) && cell[0] >= 0 && cell[0] < COLUMNS && cell[1] >= 0 && cell[1] < ROWS;
const squaredDistance = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

export function scoreTransition(from, to, route, goal = GOAL) {
  const beforeSquared = squaredDistance(from, goal);
  const afterSquared = squaredDistance(to, goal);
  // Compare unrounded squared norms, which preserve the Euclidean ordering.
  // SPE tests a directed consecutive pair, not membership of just the next cell
  // and not equality with a route index determined by the AI's step count.
  const expected = route.slice(1).some((cell, index) => sameCell(route[index], from) && sameCell(cell, to));
  return Object.freeze({
    from: Object.freeze([...from]), to: Object.freeze([...to]),
    before: Math.sqrt(beforeSquared), after: Math.sqrt(afterSquared),
    rpe: Number(afterSquared >= beforeSquared), spe: Number(!expected)
  });
}

export class NavigationExample {
  constructor() {
    this.start = Object.freeze([...START]); this.goal = Object.freeze([...GOAL]);
    this.editPositions();
  }
  get complete() { return this.mode === 'moving' && sameCell(this.position, this.goal); }
  get canUseRoute() { return this.mode === 'drawing' && this.route.length > 1 && sameCell(this.route.at(-1), this.goal); }
  get lastStep() { return this.history.at(-1) || null; }
  get expectedNext() {
    const index = this.route.findIndex(cell => sameCell(cell, this.position));
    return index < 0 ? null : this.route[index + 1] || null;
  }
  setEndpoint(kind, cell) {
    if (this.mode !== 'setup' || !['start', 'goal'].includes(kind) || !inBounds(cell)) return false;
    if (sameCell(cell, kind === 'start' ? this.goal : this.start)) return false;
    this[kind] = Object.freeze([...cell]);
    this.route = [[...this.start]]; this.resetAI();
    return true;
  }
  beginDrawing() {
    if (this.mode !== 'setup') return false;
    this.resetExpectation(); return true;
  }
  editPositions() {
    this.resetExpectation(); this.mode = 'setup';
  }
  addPoint(cell) {
    if (this.mode !== 'drawing') return 'locked';
    if (!inBounds(cell)) return 'outside';
    const existing = this.route.findIndex(point => sameCell(point, cell));
    if (existing === this.route.length - 1) return 'same';
    if (existing >= 0) { this.route = this.route.slice(0, existing + 1); return 'trimmed'; }
    if (sameCell(this.route.at(-1), this.goal)) return 'at-goal';
    const previous = this.route.at(-1);
    if (Math.abs(previous[0] - cell[0]) + Math.abs(previous[1] - cell[1]) !== 1) return 'not-adjacent';
    this.route.push([...cell]);
    return 'added';
  }
  undoPoint() {
    if (this.mode !== 'drawing' || this.route.length < 2) return false;
    this.route.pop(); return true;
  }
  useRoute() {
    if (!this.canUseRoute) return false;
    this.route = Object.freeze(this.route.map(cell => Object.freeze([...cell])));
    this.mode = 'moving';
    this.resetAI();
    return true;
  }
  canMove(direction) {
    const delta = DIRECTIONS[direction];
    return !!delta && this.mode === 'moving' && !this.complete && inBounds([this.position[0] + delta[0], this.position[1] + delta[1]]);
  }
  move(direction) {
    if (!this.canMove(direction)) return null;
    const delta = DIRECTIONS[direction], next = [this.position[0] + delta[0], this.position[1] + delta[1]];
    const result = Object.freeze({ ...scoreTransition(this.position, next, this.route, this.goal), direction, number: this.history.length + 1 });
    this.position = next; this.history.push(result);
    return result;
  }
  moveTo(cell) {
    if (!inBounds(cell)) return null;
    const direction = Object.keys(DIRECTIONS).find(key => {
      const delta = DIRECTIONS[key];
      return this.position[0] + delta[0] === cell[0] && this.position[1] + delta[1] === cell[1];
    });
    return direction ? this.move(direction) : null;
  }
  resetAI() {
    this.position = [...this.start]; this.history = [];
  }
  resetExpectation() {
    this.mode = 'drawing'; this.route = [[...this.start]];
    this.resetAI();
  }
}
