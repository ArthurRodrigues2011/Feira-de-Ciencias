(function (global) {
  "use strict";

  const PL = global.PhysicsLab = global.PhysicsLab || {};
  const T = PL.MaterialType;

  class WeatherController {
    constructor(world, effects) {
      this.world = world;
      this.effects = effects;
      this.type = "clear";
      this.intensity = 0.35;
      this.tick = 0;
      this.tornadoX = 0.5;
      this.tornadoDir = 1;
    }

    setType(type) {
      this.type = type || "clear";
    }

    setIntensity(value) {
      this.intensity = Math.max(0, Math.min(1, value));
    }

    update() {
      this.tick += 1;
      const world = this.world;
      const amount = this.intensity * world.performanceScale;
      world.wind = 0;
      world.turbulence = 0;
      world.ambientTemperature = 64;

      if (this.type === "rain") {
        world.ambientTemperature = 50;
        this.spawnRain(amount, false);
      } else if (this.type === "storm") {
        world.ambientTemperature = 46;
        world.wind = Math.sin(this.tick * 0.04) * 0.9;
        world.turbulence = amount;
        this.spawnRain(amount * 1.8, true);
        if (Math.random() < 0.0025 * amount) {
          this.lightning();
        }
      } else if (this.type === "snow") {
        world.ambientTemperature = 18;
        this.spawnSnow(amount);
        world.coolRandomCells(Math.floor(4 + amount * 24));
      } else if (this.type === "tornado") {
        world.ambientTemperature = 58;
        world.wind = Math.sin(this.tick * 0.08) * 1.2;
        world.turbulence = amount * 2;
        this.runTornado(amount);
      } else if (this.type === "heat") {
        world.ambientTemperature = 106;
        world.warmRandomCells(Math.floor(3 + amount * 26));
        if (Math.random() < 0.01 * amount) {
          this.spawnHeatSpark();
        }
      }
    }

    spawnRain(amount, storm) {
      const drops = Math.floor(1 + amount * (storm ? 20 : 10));
      for (let i = 0; i < drops; i += 1) {
        if (Math.random() > 0.55 + amount * 0.35) {
          continue;
        }
        const x = (Math.random() * this.world.cols) | 0;
        const y = Math.random() < 0.85 ? 0 : (Math.random() * Math.max(2, this.world.rows * 0.12)) | 0;
        this.world.setCell(x, y, T.WATER);
        if (storm && Math.random() < 0.08) {
          this.world.setCell(Math.max(0, Math.min(this.world.cols - 1, x + (Math.random() < 0.5 ? -1 : 1))), y, T.WATER);
        }
      }
    }

    spawnSnow(amount) {
      const flakes = Math.floor(1 + amount * 8);
      for (let i = 0; i < flakes; i += 1) {
        if (Math.random() > 0.5 + amount * 0.34) {
          continue;
        }
        const x = (Math.random() * this.world.cols) | 0;
        this.world.setCell(x, 0, T.ICE);
      }
    }

    runTornado(amount) {
      this.tornadoX += this.tornadoDir * (0.002 + amount * 0.006);
      if (this.tornadoX > 0.88 || this.tornadoX < 0.12) {
        this.tornadoDir *= -1;
      }
      const cx = Math.floor(this.world.cols * this.tornadoX);
      const cy = Math.floor(this.world.rows * 0.55);
      const radius = Math.max(8, Math.floor(this.world.rows * (0.12 + amount * 0.08)));
      this.world.applyTornado(cx, cy, radius, 0.8 + amount * 1.4);
      if (Math.random() < amount * 0.12) {
        this.effects.emit("smoke", cx, cy - radius * 0.2, 2);
      }
    }

    lightning() {
      const x = (Math.random() * this.world.cols) | 0;
      for (let y = 0; y < this.world.rows; y += 1) {
        if (Math.random() < 0.08) {
          this.world.setCell(Math.max(0, Math.min(this.world.cols - 1, x + ((Math.random() * 5) | 0) - 2)), y, T.FIRE, 190);
        }
      }
    }

    spawnHeatSpark() {
      const x = (Math.random() * this.world.cols) | 0;
      const y = (Math.random() * this.world.rows) | 0;
      if (this.world.getCell(x, y) === T.EMPTY) {
        this.world.setCell(x, y, T.FIRE, 130);
      }
    }
  }

  PL.WeatherController = WeatherController;
}(window));
