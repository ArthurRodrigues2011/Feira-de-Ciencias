(function (global) {
  "use strict";

  const PL = global.PhysicsLab = global.PhysicsLab || {};

  class SaveManager {
    constructor(world, time, weather) {
      this.world = world;
      this.time = time;
      this.weather = weather;
      this.key = "physics-lab-state-v1";
    }

    snapshot() {
      return {
        app: "PhysicsLab",
        savedAt: new Date().toISOString(),
        world: this.world.serialize(),
        time: {
          speed: this.time.speed,
          paused: this.time.paused
        },
        weather: {
          type: this.weather.type,
          intensity: this.weather.intensity
        }
      };
    }

    saveLocal() {
      localStorage.setItem(this.key, JSON.stringify(this.snapshot()));
      return true;
    }

    loadLocal() {
      const raw = localStorage.getItem(this.key);
      if (!raw) {
        return false;
      }
      return this.importJSON(raw);
    }

    exportString() {
      return JSON.stringify(this.snapshot());
    }

    downloadJSON() {
      const blob = new Blob([this.exportString()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "physics-lab-save.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 500);
    }

    importJSON(raw) {
      let data;
      try {
        data = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch (error) {
        return false;
      }
      if (!data || !data.world || !this.world.deserialize(data.world)) {
        return false;
      }
      if (data.time) {
        this.time.setSpeed(Number(data.time.speed) || 1);
        this.time.paused = !!data.time.paused;
      }
      if (data.weather) {
        this.weather.setType(data.weather.type);
        this.weather.setIntensity(Number(data.weather.intensity) || 0);
      }
      this.time.clearHistory();
      return true;
    }
  }

  PL.SaveManager = SaveManager;
}(window));
