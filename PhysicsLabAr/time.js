(function (global) {
  "use strict";

  const PL = global.PhysicsLab = global.PhysicsLab || {};

  class TimeController {
    constructor() {
      this.paused = false;
      this.rewinding = false;
      this.speed = 1;
      this.accumulator = 0;
      this.fixedStep = 1 / 60;
      this.history = [];
      this.historyChanges = 0;
      this.maxHistoryChanges = 380000;
    }

    setSpeed(value) {
      this.speed = value;
      this.rewinding = false;
    }

    togglePause() {
      this.paused = !this.paused;
      if (this.paused) {
        this.rewinding = false;
      }
      return this.paused;
    }

    setRewinding(active) {
      this.rewinding = active;
      if (active) {
        this.paused = false;
      }
    }

    consume(dt, maxSteps) {
      if (this.paused) {
        return 0;
      }
      const cap = Math.min(0.1, dt);
      this.accumulator += cap * this.speed;
      const limit = maxSteps || 6;
      let steps = 0;
      while (this.accumulator >= this.fixedStep && steps < limit) {
        this.accumulator -= this.fixedStep;
        steps += 1;
      }
      if (steps === limit) {
        this.accumulator = 0;
      }
      return steps;
    }

    rewind(world, frames) {
      const count = Math.max(1, frames | 0);
      let applied = 0;
      for (let i = 0; i < count && this.history.length; i += 1) {
        const frame = this.history.pop();
        this.historyChanges -= frame.length / 3;
        world.restoreChangeSet(frame);
        applied += 1;
      }
      return applied;
    }

    push(frame) {
      if (!frame || !frame.length) {
        return;
      }
      this.history.push(frame);
      this.historyChanges += frame.length / 3;
      while (this.historyChanges > this.maxHistoryChanges && this.history.length > 1) {
        const dropped = this.history.shift();
        this.historyChanges -= dropped.length / 3;
      }
    }

    clearHistory() {
      this.history.length = 0;
      this.historyChanges = 0;
    }
  }

  PL.TimeController = TimeController;
}(window));
