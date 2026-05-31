(function (global) {
  "use strict";

  const PL = global.PhysicsLab = global.PhysicsLab || {};
  const T = PL.MaterialType;

  class ReactionEngine {
    constructor() {
      this.rules = [];
      this.registerDefaults();
    }

    add(rule) {
      this.rules.push(rule);
    }

    applyAt(world, x, y, type) {
      let changed = false;
      for (let yy = y - 1; yy <= y + 1; yy += 1) {
        for (let xx = x - 1; xx <= x + 1; xx += 1) {
          if (!world.inBounds(xx, yy) || (xx === x && yy === y)) {
            continue;
          }
          const other = world.getCell(xx, yy);
          for (let i = 0; i < this.rules.length; i += 1) {
            const rule = this.rules[i];
            if (!rule.matches(type, other)) {
              continue;
            }
            const chance = typeof rule.chance === "function" ? rule.chance(world, x, y, xx, yy) : rule.chance;
            if (Math.random() <= chance) {
              rule.react(world, x, y, xx, yy, type, other);
              changed = true;
              if (!world.inBounds(x, y) || world.getCell(x, y) !== type) {
                return true;
              }
            }
          }
        }
      }
      return changed;
    }

    register(a, b, chance, react) {
      this.add({
        a,
        b,
        chance,
        matches(type, other) {
          return (type === a && other === b) || (type === b && other === a);
        },
        react
      });
    }

    registerDefaults() {
      this.register(T.WATER, T.FIRE, 0.55, (world, x, y, nx, ny, type) => {
        if (type === T.FIRE) {
          world.setCell(x, y, T.VAPOR, 120);
          world.setCell(nx, ny, T.EMPTY);
        } else {
          world.setCell(x, y, T.VAPOR, 120);
          world.setCell(nx, ny, T.EMPTY);
        }
        world.effects.emit("vapor", x + 0.5, y + 0.5, 3);
      });

      this.register(T.WATER, T.LAVA, 0.34, (world, x, y, nx, ny, type) => {
        if (type === T.LAVA) {
          world.setCell(x, y, T.STONE);
          world.setCell(nx, ny, T.VAPOR, 160);
        } else {
          world.setCell(x, y, T.VAPOR, 160);
          world.setCell(nx, ny, T.STONE);
        }
        world.effects.emit("smoke", x + 0.5, y + 0.5, 4);
      });

      this.register(T.WATER, T.ICE, (world) => world.ambientTemperature > 55 ? 0.025 : 0.004, (world, x, y, nx, ny, type) => {
        const iceIndex = type === T.ICE ? world.index(x, y) : world.index(nx, ny);
        if (world.ambientTemperature > 50 || world.hasNeighbor(x, y, [T.FIRE, T.LAVA], 2)) {
          world.setIndex(iceIndex, T.WATER);
          world.effects.emit("melt", nx + 0.5, ny + 0.5, 1);
        } else if (world.ambientTemperature < 25) {
          const waterIndex = type === T.WATER ? world.index(x, y) : world.index(nx, ny);
          world.setIndex(waterIndex, T.ICE);
        }
      });

      this.register(T.OIL, T.FIRE, 0.62, (world, x, y, nx, ny) => {
        world.setCell(x, y, T.FIRE, 230);
        world.setCell(nx, ny, T.FIRE, 220);
        world.effects.emit("spark", x + 0.5, y + 0.5, 5);
      });

      this.register(T.OIL, T.LAVA, 0.74, (world, x, y, nx, ny) => {
        world.setCell(x, y, T.FIRE, 240);
        world.setCell(nx, ny, T.LAVA, 210);
        world.effects.emit("spark", x + 0.5, y + 0.5, 6);
      });

      this.register(T.PLANT, T.WATER, 0.018, (world, x, y, nx, ny, type) => {
        const px = type === T.PLANT ? x : nx;
        const py = type === T.PLANT ? y : ny;
        const growY = py - 1;
        if (world.inBounds(px, growY) && world.getCell(px, growY) === T.EMPTY) {
          world.setCell(px, growY, T.PLANT, 80);
        }
      });

      this.register(T.PLANT, T.FIRE, 0.7, (world, x, y, nx, ny, type) => {
        if (type === T.PLANT) {
          world.setCell(x, y, Math.random() < 0.55 ? T.ASH : T.FIRE, 180);
        } else {
          world.setCell(nx, ny, Math.random() < 0.55 ? T.ASH : T.FIRE, 180);
        }
        world.effects.emit("smoke", x + 0.5, y + 0.5, 3);
      });

      this.register(T.LAVA, T.PLANT, 0.82, (world, x, y, nx, ny, type) => {
        const plantIndex = type === T.PLANT ? world.index(x, y) : world.index(nx, ny);
        world.setIndex(plantIndex, T.ASH);
        world.effects.emit("smoke", x + 0.5, y + 0.5, 3);
      });

      this.register(T.VAPOR, T.ICE, 0.28, (world, x, y, nx, ny, type) => {
        const vaporIndex = type === T.VAPOR ? world.index(x, y) : world.index(nx, ny);
        world.setIndex(vaporIndex, T.WATER);
        world.effects.emit("ripple", x + 0.5, y + 0.5, 1);
      });

      this.register(T.VAPOR, T.STONE, (world) => world.ambientTemperature < 38 ? 0.035 : 0.004, (world, x, y, nx, ny, type) => {
        if (type === T.VAPOR) {
          world.setCell(x, y, T.WATER);
        } else {
          world.setCell(nx, ny, T.WATER);
        }
      });

      this.register(T.FIRE, T.ICE, 0.42, (world, x, y, nx, ny, type) => {
        const fireIndex = type === T.FIRE ? world.index(x, y) : world.index(nx, ny);
        const iceIndex = type === T.ICE ? world.index(x, y) : world.index(nx, ny);
        world.setIndex(fireIndex, T.VAPOR, 100);
        world.setIndex(iceIndex, T.WATER);
        world.effects.emit("melt", x + 0.5, y + 0.5, 2);
      });

      this.register(T.LAVA, T.ICE, 0.65, (world, x, y, nx, ny, type) => {
        const lavaIndex = type === T.LAVA ? world.index(x, y) : world.index(nx, ny);
        const iceIndex = type === T.ICE ? world.index(x, y) : world.index(nx, ny);
        world.setIndex(lavaIndex, T.STONE);
        world.setIndex(iceIndex, T.VAPOR, 180);
        world.effects.emit("smoke", x + 0.5, y + 0.5, 4);
      });

      this.register(T.LAVA, T.SAND, 0.12, (world, x, y, nx, ny, type) => {
        const sandIndex = type === T.SAND ? world.index(x, y) : world.index(nx, ny);
        world.setIndex(sandIndex, T.STONE);
      });

      this.register(T.LAVA, T.EARTH, 0.1, (world, x, y, nx, ny, type) => {
        const earthIndex = type === T.EARTH ? world.index(x, y) : world.index(nx, ny);
        world.setIndex(earthIndex, Math.random() < 0.7 ? T.STONE : T.ASH);
      });

      this.register(T.WATER, T.ASH, 0.18, (world, x, y, nx, ny, type) => {
        const ashIndex = type === T.ASH ? world.index(x, y) : world.index(nx, ny);
        world.setIndex(ashIndex, T.EARTH);
      });

      this.register(T.WATER, T.EARTH, 0.006, (world, x, y, nx, ny, type) => {
        const earthIndex = type === T.EARTH ? world.index(x, y) : world.index(nx, ny);
        const ex = earthIndex % world.cols;
        const ey = Math.floor(earthIndex / world.cols);
        if (world.inBounds(ex, ey - 1) && world.getCell(ex, ey - 1) === T.EMPTY) {
          world.setCell(ex, ey - 1, T.PLANT, 65);
        }
      });

      this.register(T.PLANT, T.EARTH, 0.004, (world, x, y, nx, ny, type) => {
        const plantIndex = type === T.PLANT ? world.index(x, y) : world.index(nx, ny);
        const px = plantIndex % world.cols;
        const py = Math.floor(plantIndex / world.cols);
        if (world.inBounds(px, py - 1) && world.getCell(px, py - 1) === T.EMPTY) {
          world.setCell(px, py - 1, T.PLANT, 75);
        }
      });

      this.register(T.FIRE, T.VAPOR, 0.05, (world, x, y, nx, ny, type) => {
        const fireIndex = type === T.FIRE ? world.index(x, y) : world.index(nx, ny);
        world.setIndex(fireIndex, T.EMPTY);
      });

      this.register(T.FIRE, T.SAND, 0.012, (world, x, y, nx, ny, type) => {
        const fireIndex = type === T.FIRE ? world.index(x, y) : world.index(nx, ny);
        if (Math.random() < 0.35) {
          world.setIndex(fireIndex, T.EMPTY);
        }
      });

      this.register(T.OIL, T.WATER, 0.035, (world, x, y, nx, ny, type) => {
        const oilIndex = type === T.OIL ? world.index(x, y) : world.index(nx, ny);
        const waterIndex = type === T.WATER ? world.index(x, y) : world.index(nx, ny);
        if (oilIndex > waterIndex) {
          world.swapIndexes(oilIndex, waterIndex);
        }
      });

      this.register(T.OIL, T.PLANT, 0.016, (world, x, y, nx, ny, type) => {
        const plantIndex = type === T.PLANT ? world.index(x, y) : world.index(nx, ny);
        world.setAuxIndex(plantIndex, Math.min(255, world.aux[plantIndex] + 2));
      });

      this.register(T.ASH, T.PLANT, 0.006, (world, x, y, nx, ny, type) => {
        const ashIndex = type === T.ASH ? world.index(x, y) : world.index(nx, ny);
        if (Math.random() < 0.5) {
          world.setIndex(ashIndex, T.EARTH);
        }
      });

      this.register(T.SAND, T.WATER, 0.006, (world, x, y, nx, ny, type) => {
        const sandIndex = type === T.SAND ? world.index(x, y) : world.index(nx, ny);
        if (Math.random() < 0.2) {
          world.setIndex(sandIndex, T.EARTH);
        }
      });

      this.register(T.STONE, T.LAVA, 0.008, (world, x, y, nx, ny, type) => {
        const stoneIndex = type === T.STONE ? world.index(x, y) : world.index(nx, ny);
        if (Math.random() < 0.18) {
          world.setIndex(stoneIndex, T.LAVA, 180);
        }
      });

      this.register(T.STONE, T.ICE, 0.006, (world, x, y, nx, ny, type) => {
        if (world.ambientTemperature < 25) {
          const stoneIndex = type === T.STONE ? world.index(x, y) : world.index(nx, ny);
          world.setAuxIndex(stoneIndex, 1);
        }
      });

      this.register(T.VAPOR, T.WATER, 0.018, (world, x, y, nx, ny, type) => {
        if (world.ambientTemperature < 42) {
          const vaporIndex = type === T.VAPOR ? world.index(x, y) : world.index(nx, ny);
          world.setIndex(vaporIndex, T.WATER);
        }
      });

      this.register(T.FIRE, T.ASH, 0.012, (world, x, y, nx, ny, type) => {
        const fireIndex = type === T.FIRE ? world.index(x, y) : world.index(nx, ny);
        world.setAuxIndex(fireIndex, Math.max(1, world.aux[fireIndex] - 5));
      });
    }
  }

  PL.ReactionEngine = ReactionEngine;
}(window));
