(function (root) {
  "use strict";
  class TrialClock {
    constructor(stepMs, eventTick) {
      this.stepMs = stepMs;
      this.eventTick = eventTick;
      this.startedAt = null;
      this.eventPresentedAt = null;
    }
    start(now) { this.startedAt = now; this.eventPresentedAt = null; }
    present(tick, now) { if (tick === this.eventTick) this.eventPresentedAt = now; }
    dueAt(tick) {
      // Anchor the correction to the actual displayed event, not an earlier
      // API response, and never accumulate per-request round-trip delays.
      if (this.eventPresentedAt !== null && tick > this.eventTick) {
        return this.eventPresentedAt + (tick - this.eventTick) * this.stepMs;
      }
      return this.startedAt + tick * this.stepMs;
    }
  }
  if (typeof module !== "undefined" && module.exports) module.exports = TrialClock;
  else root.TrialClock = TrialClock;
})(typeof window !== "undefined" ? window : this);
