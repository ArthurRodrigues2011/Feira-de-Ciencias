(function (global) {
  "use strict";

  const PL = global.PhysicsLab = global.PhysicsLab || {};

  const MaterialType = Object.freeze({
    EMPTY: 0,
    WATER: 1,
    FIRE: 2,
    EARTH: 3,
    PLANT: 4,
    VAPOR: 5,
    LAVA: 6,
    STONE: 7,
    SAND: 8,
    OIL: 9,
    ICE: 10,
    ASH: 11,
    SCRAP: 12,
    MICROBOT: 13
  });

  function rgb(hex) {
    const clean = hex.replace("#", "");
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16)
    ];
  }

  function material(id, key, name, color, mass, density, state, behavior, options) {
    const data = options || {};
    return {
      id,
      key,
      name,
      color,
      rgb: rgb(color),
      mass,
      density,
      state,
      behavior,
      solid: state === "solid",
      liquid: state === "liquid",
      gas: state === "gas",
      powder: state === "powder",
      combustible: !!data.combustible,
      hot: !!data.hot,
      cold: !!data.cold,
      defaultAux: data.defaultAux || 0,
      mobility: data.mobility || 1,
      spread: data.spread || 1
    };
  }

  const Materials = [];
  Materials[MaterialType.EMPTY] = material(0, "empty", "Vazio", "#f7f9fc", 0, 0, "empty", "empty");
  Materials[MaterialType.WATER] = material(1, "water", "Agua", "#4a9ed8", 1, 1.0, "liquid", "water", { spread: 5 });
  Materials[MaterialType.FIRE] = material(2, "fire", "Fogo", "#e86924", 0.12, 0.08, "energy", "fire", { hot: true, defaultAux: 180 });
  Materials[MaterialType.EARTH] = material(3, "earth", "Terra", "#7a6048", 1.7, 1.55, "powder", "earth", { spread: 1, mobility: 0.58 });
  Materials[MaterialType.PLANT] = material(4, "plant", "Planta", "#3d9952", 0.6, 0.7, "solid", "plant", { combustible: true, defaultAux: 80 });
  Materials[MaterialType.VAPOR] = material(5, "vapor", "Vapor", "#cfd8dc", 0.05, 0.03, "gas", "vapor", { defaultAux: 150 });
  Materials[MaterialType.LAVA] = material(6, "lava", "Lava", "#d94a2b", 2.7, 2.65, "liquid", "lava", { hot: true, defaultAux: 230, spread: 2, mobility: 0.38 });
  Materials[MaterialType.STONE] = material(7, "stone", "Pedra", "#777e84", 2.8, 2.8, "solid", "stone");
  Materials[MaterialType.SAND] = material(8, "sand", "Areia", "#d6b36e", 1.55, 1.45, "powder", "sand", { spread: 1, mobility: 0.92 });
  Materials[MaterialType.OIL] = material(9, "oil", "Oleo", "#3b3931", 0.82, 0.78, "liquid", "oil", { combustible: true, spread: 7, mobility: 0.86 });
  Materials[MaterialType.ICE] = material(10, "ice", "Gelo", "#a9daf0", 0.92, 0.91, "solid", "ice", { cold: true, defaultAux: 30 });
  Materials[MaterialType.ASH] = material(11, "ash", "Cinzas", "#6c7073", 0.55, 0.45, "powder", "ash", { spread: 2, mobility: 0.72 });
  Materials[MaterialType.SCRAP] = material(12, "scrap", "Sucata", "#8b7f68", 2.1, 2.0, "powder", "scrap", { spread: 1, mobility: 0.46 });
  Materials[MaterialType.MICROBOT] = material(13, "microbot", "Microbot", "#2db7a3", 0.4, 0.55, "solid", "microbot", { defaultAux: 86 });

  class SpatialHashGrid {
    constructor(chunkSize) {
      this.chunkSize = chunkSize;
    }

    key(cx, cy) {
      return `${cx},${cy}`;
    }

    unpack(key) {
      const comma = key.indexOf(",");
      return [Number(key.slice(0, comma)), Number(key.slice(comma + 1))];
    }
  }

  class PhysicsWorld {
    constructor(canvas, effects) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d", { alpha: false });
      this.effects = effects;
      this.chunkSize = 16;
      this.spatial = new SpatialHashGrid(this.chunkSize);
      this.cols = 0;
      this.rows = 0;
      this.cellSize = 4;
      this.grid = new Uint8Array(0);
      this.aux = new Uint8Array(0);
      this.moved = new Uint16Array(0);
      this.changeMarks = new Uint16Array(0);
      this.changeId = 1;
      this.tickId = 1;
      this.recording = false;
      this.changes = [];
      this.activeChunks = new Set();
      this.nextChunks = new Set();
      this.updating = false;
      this.particleCount = 0;
      this.particleLimit = 32000;
      this.gravity = 1;
      this.ambientTemperature = 64;
      this.wind = 0;
      this.turbulence = 0;
      this.performanceScale = 1;
      this.frameParity = 0;
      this.buffer = document.createElement("canvas");
      this.bufferCtx = this.buffer.getContext("2d", { alpha: false });
      this.imageData = null;
      this.resize();
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const parent = this.canvas.parentElement;
      const width = Math.max(320, Math.floor(rect.width || (parent && parent.clientWidth) || global.innerWidth || 900));
      const height = Math.max(240, Math.floor(rect.height || (parent && parent.clientHeight) || 560));
      const dpr = Math.min(global.devicePixelRatio || 1, 2);
      this.canvas.width = Math.max(1, Math.floor(width * dpr));
      this.canvas.height = Math.max(1, Math.floor(height * dpr));

      const deviceMemory = navigator.deviceMemory || 4;
      const cores = navigator.hardwareConcurrency || 4;
      const targetCells = deviceMemory <= 2 || cores <= 4 ? 36000 : 62000;
      let size = width < 640 ? 5 : 4;
      while (Math.floor(width / size) * Math.floor(height / size) > targetCells) {
        size += 1;
      }

      const newCols = Math.max(48, Math.floor(width / size));
      const newRows = Math.max(40, Math.floor(height / size));
      if (newCols === this.cols && newRows === this.rows && size === this.cellSize) {
        return;
      }

      const oldCols = this.cols;
      const oldRows = this.rows;
      const oldGrid = this.grid;
      const oldAux = this.aux;
      this.cellSize = size;
      this.cols = newCols;
      this.rows = newRows;
      const total = newCols * newRows;
      this.grid = new Uint8Array(total);
      this.aux = new Uint8Array(total);
      this.moved = new Uint16Array(total);
      this.changeMarks = new Uint16Array(total);
      this.particleCount = 0;

      if (oldCols && oldRows && oldGrid.length) {
        for (let y = 0; y < newRows; y += 1) {
          const oldY = Math.min(oldRows - 1, Math.floor(y * oldRows / newRows));
          for (let x = 0; x < newCols; x += 1) {
            const oldX = Math.min(oldCols - 1, Math.floor(x * oldCols / newCols));
            const oldIndex = oldY * oldCols + oldX;
            const nextIndex = y * newCols + x;
            const type = oldGrid[oldIndex];
            this.grid[nextIndex] = type;
            this.aux[nextIndex] = oldAux[oldIndex];
            if (type !== MaterialType.EMPTY) {
              this.particleCount += 1;
            }
          }
        }
      }

      this.buffer.width = newCols;
      this.buffer.height = newRows;
      this.imageData = this.bufferCtx.createImageData(newCols, newRows);
      this.markAllActive();
    }

    markAllActive() {
      this.activeChunks.clear();
      const maxCx = Math.ceil(this.cols / this.chunkSize);
      const maxCy = Math.ceil(this.rows / this.chunkSize);
      for (let cy = 0; cy < maxCy; cy += 1) {
        for (let cx = 0; cx < maxCx; cx += 1) {
          this.activeChunks.add(this.spatial.key(cx, cy));
        }
      }
    }

    index(x, y) {
      return y * this.cols + x;
    }

    inBounds(x, y) {
      return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
    }

    getCell(x, y) {
      if (!this.inBounds(x, y)) {
        return MaterialType.STONE;
      }
      return this.grid[this.index(x, y)];
    }

    getAux(x, y) {
      if (!this.inBounds(x, y)) {
        return 0;
      }
      return this.aux[this.index(x, y)];
    }

    recordIndex(index) {
      if (!this.recording || this.changeMarks[index] === this.changeId) {
        return;
      }
      this.changeMarks[index] = this.changeId;
      this.changes.push(index, this.grid[index], this.aux[index]);
    }

    beginChangeSet() {
      this.recording = true;
      this.changes.length = 0;
      this.changeId += 1;
      if (this.changeId > 65000) {
        this.changeId = 1;
        this.changeMarks.fill(0);
      }
    }

    endChangeSet() {
      this.recording = false;
      return this.changes.length ? Int32Array.from(this.changes) : null;
    }

    restoreChangeSet(frame) {
      for (let i = 0; i < frame.length; i += 3) {
        const index = frame[i];
        const oldType = frame[i + 1];
        const oldAux = frame[i + 2];
        const currentType = this.grid[index];
        if (currentType === MaterialType.EMPTY && oldType !== MaterialType.EMPTY) {
          this.particleCount += 1;
        } else if (currentType !== MaterialType.EMPTY && oldType === MaterialType.EMPTY) {
          this.particleCount -= 1;
        }
        this.grid[index] = oldType;
        this.aux[index] = oldAux;
        this.activateIndex(index, 2);
      }
    }

    activateIndex(index, radius) {
      const x = index % this.cols;
      const y = Math.floor(index / this.cols);
      this.activateCell(x, y, radius || 1);
    }

    activateCell(x, y, radius) {
      const r = radius || 1;
      const minCx = Math.max(0, Math.floor((x - r) / this.chunkSize));
      const maxCx = Math.min(Math.ceil(this.cols / this.chunkSize) - 1, Math.floor((x + r) / this.chunkSize));
      const minCy = Math.max(0, Math.floor((y - r) / this.chunkSize));
      const maxCy = Math.min(Math.ceil(this.rows / this.chunkSize) - 1, Math.floor((y + r) / this.chunkSize));
      for (let cy = minCy; cy <= maxCy; cy += 1) {
        for (let cx = minCx; cx <= maxCx; cx += 1) {
          const key = this.spatial.key(cx, cy);
          if (this.updating) {
            this.nextChunks.add(key);
          } else {
            this.activeChunks.add(key);
          }
        }
      }
    }

    keepActive(x, y, radius) {
      this.activateCell(x, y, radius || 1);
    }

    setCell(x, y, type, auxValue) {
      if (!this.inBounds(x, y)) {
        return false;
      }
      const index = this.index(x, y);
      if (type !== MaterialType.EMPTY && this.grid[index] === MaterialType.EMPTY && this.particleCount >= this.particleLimit) {
        return false;
      }
      this.setIndex(index, type, auxValue);
      return true;
    }

    setIndex(index, type, auxValue) {
      const oldType = this.grid[index];
      const oldAux = this.aux[index];
      const nextAux = auxValue === undefined ? Materials[type].defaultAux : auxValue;
      if (oldType === type && oldAux === nextAux) {
        this.activateIndex(index, 1);
        return;
      }
      this.recordIndex(index);
      if (oldType === MaterialType.EMPTY && type !== MaterialType.EMPTY) {
        this.particleCount += 1;
      } else if (oldType !== MaterialType.EMPTY && type === MaterialType.EMPTY) {
        this.particleCount -= 1;
      }
      this.grid[index] = type;
      this.aux[index] = nextAux;
      this.activateIndex(index, 2);
    }

    setAuxIndex(index, value) {
      const clamped = value < 0 ? 0 : value > 255 ? 255 : value | 0;
      if (this.aux[index] === clamped) {
        return;
      }
      this.recordIndex(index);
      this.aux[index] = clamped;
      this.activateIndex(index, 1);
    }

    clear() {
      this.beginChangeSet();
      for (let i = 0; i < this.grid.length; i += 1) {
        if (this.grid[i] !== MaterialType.EMPTY) {
          this.setIndex(i, MaterialType.EMPTY, 0);
        }
      }
      this.endChangeSet();
      this.particleCount = 0;
      this.markAllActive();
    }

    swapIndexes(a, b) {
      if (a === b) {
        return;
      }
      this.recordIndex(a);
      this.recordIndex(b);
      const typeA = this.grid[a];
      const auxA = this.aux[a];
      this.grid[a] = this.grid[b];
      this.aux[a] = this.aux[b];
      this.grid[b] = typeA;
      this.aux[b] = auxA;
      this.moved[b] = this.tickId;
      this.activateIndex(a, 2);
      this.activateIndex(b, 2);
    }

    canDisplace(type, target) {
      if (target === MaterialType.EMPTY) {
        return true;
      }
      const a = Materials[type];
      const b = Materials[target];
      if (!b || b.solid || target === MaterialType.FIRE) {
        return false;
      }
      if (a.gas) {
        return b.gas && a.density < b.density;
      }
      if (a.liquid || a.powder) {
        return (b.liquid || b.gas || target === MaterialType.VAPOR) && a.density > b.density + 0.04;
      }
      return false;
    }

    tryMove(x, y, nx, ny, type) {
      if (!this.inBounds(nx, ny)) {
        return false;
      }
      const from = this.index(x, y);
      const to = this.index(nx, ny);
      if (this.moved[to] === this.tickId) {
        return false;
      }
      const target = this.grid[to];
      if (!this.canDisplace(type, target)) {
        return false;
      }
      this.swapIndexes(from, to);
      return true;
    }

    hasNeighbor(x, y, types, radius) {
      const r = radius || 1;
      for (let yy = y - r; yy <= y + r; yy += 1) {
        for (let xx = x - r; xx <= x + r; xx += 1) {
          if (xx === x && yy === y) {
            continue;
          }
          if (!this.inBounds(xx, yy)) {
            continue;
          }
          const found = this.grid[this.index(xx, yy)];
          for (let i = 0; i < types.length; i += 1) {
            if (found === types[i]) {
              return true;
            }
          }
        }
      }
      return false;
    }

    randomNeighborOf(x, y, type) {
      const start = (this.tickId + x + y) & 7;
      for (let n = 0; n < 8; n += 1) {
        const k = (start + n) & 7;
        const dx = k === 0 || k === 3 || k === 5 ? -1 : k === 2 || k === 4 || k === 7 ? 1 : 0;
        const dy = k < 3 ? -1 : k > 4 ? 1 : 0;
        const nx = x + dx;
        const ny = y + dy;
        if (this.inBounds(nx, ny) && this.grid[this.index(nx, ny)] === type) {
          return this.index(nx, ny);
        }
      }
      return -1;
    }

    update(reactions) {
      if (this.tickId > 65000) {
        this.tickId = 1;
        this.moved.fill(0);
      }
      this.tickId += 1;
      this.frameParity ^= 1;
      const chunks = Array.from(this.activeChunks);
      if (chunks.length === 0) {
        return;
      }
      chunks.sort((a, b) => {
        const ay = Number(a.slice(a.indexOf(",") + 1));
        const by = Number(b.slice(b.indexOf(",") + 1));
        return by - ay;
      });
      this.activeChunks.clear();
      this.nextChunks.clear();
      this.updating = true;

      for (let c = 0; c < chunks.length; c += 1) {
        const coords = this.spatial.unpack(chunks[c]);
        this.updateChunk(coords[0], coords[1], reactions);
      }

      this.updating = false;
      const carry = this.activeChunks;
      this.activeChunks = this.nextChunks;
      this.nextChunks = carry;
      this.nextChunks.clear();
    }

    updateChunk(cx, cy, reactions) {
      const x0 = cx * this.chunkSize;
      const y0 = cy * this.chunkSize;
      const x1 = Math.min(this.cols, x0 + this.chunkSize);
      const y1 = Math.min(this.rows, y0 + this.chunkSize);
      const leftToRight = ((cx + cy + this.frameParity) & 1) === 0;

      for (let y = y1 - 1; y >= y0; y -= 1) {
        if (leftToRight) {
          for (let x = x0; x < x1; x += 1) {
            this.updateCell(x, y, reactions);
          }
        } else {
          for (let x = x1 - 1; x >= x0; x -= 1) {
            this.updateCell(x, y, reactions);
          }
        }
      }
    }

    updateCell(x, y, reactions) {
      const index = this.index(x, y);
      if (this.moved[index] === this.tickId) {
        return;
      }
      let type = this.grid[index];
      if (type === MaterialType.EMPTY) {
        return;
      }
      this.moved[index] = this.tickId;
      if (reactions && reactions.applyAt(this, x, y, type)) {
        type = this.grid[index];
        if (type === MaterialType.EMPTY || this.moved[index] !== this.tickId) {
          return;
        }
      }

      switch (type) {
        case MaterialType.WATER:
          this.updateWater(x, y);
          break;
        case MaterialType.FIRE:
          this.updateFire(x, y);
          break;
        case MaterialType.EARTH:
          this.updatePowder(x, y, type, 0.55);
          break;
        case MaterialType.PLANT:
          this.updatePlant(x, y);
          break;
        case MaterialType.VAPOR:
          this.updateVapor(x, y);
          break;
        case MaterialType.LAVA:
          this.updateLava(x, y);
          break;
        case MaterialType.SAND:
          this.updatePowder(x, y, type, 0.94);
          break;
        case MaterialType.OIL:
          this.updateOil(x, y);
          break;
        case MaterialType.ICE:
          this.updateIce(x, y);
          break;
        case MaterialType.ASH:
          this.updatePowder(x, y, type, 0.68);
          break;
        case MaterialType.SCRAP:
          this.updatePowder(x, y, type, 0.46);
          break;
        case MaterialType.MICROBOT:
          this.updateMicrobot(x, y);
          break;
        default:
          break;
      }
    }

    updateWater(x, y) {
      this.keepActive(x, y, 2);
      if (this.ambientTemperature < 20 && Math.random() < 0.002) {
        this.setCell(x, y, MaterialType.ICE);
        return;
      }
      this.moveLiquid(x, y, MaterialType.WATER, 5, 1);
    }

    updateOil(x, y) {
      this.keepActive(x, y, 2);
      if (this.hasNeighbor(x, y, [MaterialType.FIRE, MaterialType.LAVA], 1)) {
        if (Math.random() < 0.22) {
          this.setCell(x, y, MaterialType.FIRE, 220);
          this.effects.emit("spark", x + 0.5, y + 0.5, 3);
          return;
        }
      }
      const above = this.inBounds(x, y - 1) ? this.grid[this.index(x, y - 1)] : MaterialType.STONE;
      if (above === MaterialType.WATER && Math.random() < 0.7) {
        this.tryMove(x, y, x, y - 1, MaterialType.OIL);
        return;
      }
      this.moveLiquid(x, y, MaterialType.OIL, 7, 0.86);
    }

    updateLava(x, y) {
      this.keepActive(x, y, 3);
      const index = this.index(x, y);
      let heat = this.aux[index] || 220;
      if (this.hasNeighbor(x, y, [MaterialType.WATER, MaterialType.ICE], 1)) {
        heat -= 14;
      } else {
        heat -= this.ambientTemperature < 55 ? 2 : 1;
      }
      if (heat < 35) {
        this.setCell(x, y, MaterialType.STONE);
        this.effects.emit("smoke", x + 0.5, y + 0.4, 2);
        return;
      }
      this.setAuxIndex(index, heat);
      if (Math.random() < 0.08 * this.performanceScale) {
        this.effects.emit("spark", x + 0.5, y + 0.2, 1);
      }
      this.scorchNeighbors(x, y, 0.24);
      this.moveLiquid(x, y, MaterialType.LAVA, 2, 0.36);
    }

    updateFire(x, y) {
      this.keepActive(x, y, 3);
      const index = this.index(x, y);
      let life = this.aux[index] || 120;
      const hasFuel = this.hasNeighbor(x, y, [MaterialType.PLANT, MaterialType.OIL], 1);
      const damp = this.hasNeighbor(x, y, [MaterialType.WATER, MaterialType.ICE], 1);
      life += hasFuel ? 5 : -4;
      life += this.ambientTemperature > 90 ? 2 : 0;
      life -= this.ambientTemperature < 40 ? 3 : 0;
      life -= damp ? 24 : 0;

      if (life <= 0 || Math.random() < 0.002) {
        this.setCell(x, y, hasFuel && Math.random() < 0.35 ? MaterialType.ASH : MaterialType.EMPTY);
        this.effects.emit("smoke", x + 0.5, y + 0.5, 1);
        return;
      }

      this.setAuxIndex(index, life);
      this.scorchNeighbors(x, y, 0.18);
      if (Math.random() < 0.16 * this.performanceScale) {
        this.effects.emit("spark", x + 0.5, y + 0.5, 1);
      }
      if (Math.random() < 0.13 * this.performanceScale) {
        this.effects.emit("smoke", x + 0.5, y + 0.3, 1);
      }
      const dir = ((this.tickId + x) & 1) ? -1 : 1;
      if (this.tryMove(x, y, x, y - 1, MaterialType.FIRE)) {
        return;
      }
      if (this.tryMove(x, y, x + dir, y - 1, MaterialType.FIRE)) {
        return;
      }
      this.tryMove(x, y, x - dir, y - 1, MaterialType.FIRE);
    }

    updateVapor(x, y) {
      this.keepActive(x, y, 3);
      const index = this.index(x, y);
      let life = this.aux[index] || 120;
      life -= this.ambientTemperature < 45 ? 4 : 1;
      if (y <= 1 || life <= 0 || (this.ambientTemperature < 35 && Math.random() < 0.035)) {
        this.setCell(x, y, MaterialType.WATER);
        this.effects.emit("ripple", x + 0.5, y + 0.5, 1);
        return;
      }
      this.setAuxIndex(index, life);
      const windStep = this.wind > 0.2 ? 1 : this.wind < -0.2 ? -1 : 0;
      const dir = ((this.tickId + y) & 1) ? -1 : 1;
      if (windStep && this.tryMove(x, y, x + windStep, y - 1, MaterialType.VAPOR)) {
        return;
      }
      if (this.tryMove(x, y, x, y - 1, MaterialType.VAPOR)) {
        return;
      }
      if (this.tryMove(x, y, x + dir, y - 1, MaterialType.VAPOR)) {
        return;
      }
      this.tryMove(x, y, x - dir, y, MaterialType.VAPOR);
    }

    updateIce(x, y) {
      const hot = this.hasNeighbor(x, y, [MaterialType.FIRE, MaterialType.LAVA], 2) || this.ambientTemperature > 88;
      if (hot && Math.random() < 0.08) {
        this.setCell(x, y, MaterialType.WATER);
        this.effects.emit("melt", x + 0.5, y + 0.5, 1);
      } else if (this.ambientTemperature < 25 && Math.random() < 0.006) {
        this.keepActive(x, y, 1);
      }
    }

    updatePlant(x, y) {
      const wet = this.hasNeighbor(x, y, [MaterialType.WATER], 1);
      const soil = this.hasNeighbor(x, y, [MaterialType.EARTH, MaterialType.SAND], 1);
      const hot = this.hasNeighbor(x, y, [MaterialType.FIRE, MaterialType.LAVA], 1);
      if (hot) {
        this.setCell(x, y, MaterialType.ASH);
        this.effects.emit("smoke", x + 0.5, y + 0.5, 2);
        return;
      }
      if ((wet || soil) && Math.random() < (wet ? 0.012 : 0.004)) {
        const options = [[x, y - 1], [x - 1, y], [x + 1, y], [x - 1, y - 1], [x + 1, y - 1]];
        const pick = options[(this.tickId + x + y) % options.length];
        if (this.inBounds(pick[0], pick[1]) && this.getCell(pick[0], pick[1]) === MaterialType.EMPTY) {
          this.setCell(pick[0], pick[1], MaterialType.PLANT, 70);
        }
      }
      if (wet || soil) {
        this.keepActive(x, y, 2);
      }
    }

    updatePowder(x, y, type, mobility) {
      this.keepActive(x, y, 2);
      if (Math.random() > mobility * Math.max(0.2, this.gravity)) {
        return;
      }
      const dir = ((this.tickId + x + y) & 1) ? -1 : 1;
      if (this.tryMove(x, y, x, y + 1, type)) {
        return;
      }
      if (this.tryMove(x, y, x + dir, y + 1, type)) {
        return;
      }
      this.tryMove(x, y, x - dir, y + 1, type);
    }

    updateMicrobot(x, y) {
      this.keepActive(x, y, 4);
      const index = this.index(x, y);
      let energy = this.aux[index] || Materials[MaterialType.MICROBOT].defaultAux;
      const hot = this.hasNeighbor(x, y, [MaterialType.FIRE, MaterialType.LAVA], 1);
      const cold = this.ambientTemperature < 24 || this.hasNeighbor(x, y, [MaterialType.ICE], 1);
      if (hot) {
        energy -= 18;
      } else if (cold && ((this.tickId + x + y) & 1) === 0) {
        energy -= 1;
      } else if (((this.tickId + x * 3 + y * 5) & 7) === 0) {
        energy -= 1;
      }

      if (hot && Math.random() < 0.18) {
        this.setIndex(index, MaterialType.ASH);
        this.effects.emit("smoke", x + 0.5, y + 0.5, 2);
        return;
      }

      const target = this.findMicrobotResource(x, y, energy > 92 ? 4 : 3);
      if (target >= 0) {
        const resourceType = this.grid[target];
        const value = this.microbotResourceValue(resourceType);
        energy = Math.min(210, energy + value);
        const pressure = this.particleCount / Math.max(1, this.particleLimit);
        const maturity = Math.max(0, energy - 72) / 138;
        const growthChance = Math.min(0.12, (0.02 + maturity * 0.08) * (1 - pressure) * this.performanceScale);
        const growthTick = ((this.tickId + x * 7 + y * 13) & 15) === 0;

        if (energy > 80 && growthTick && Math.random() < growthChance) {
          const childEnergy = Math.max(26, Math.floor(energy * (0.33 + Math.random() * 0.12)));
          energy = Math.max(24, energy - childEnergy - 10);
          this.setIndex(target, MaterialType.MICROBOT, childEnergy);
          this.moved[target] = this.tickId;
          if (Math.random() < 0.45 * this.performanceScale) {
            const tx = target % this.cols;
            const ty = Math.floor(target / this.cols);
            this.effects.emit("nano", tx + 0.5, ty + 0.5, 2);
          }
        } else if (Math.random() < 0.18) {
          this.setIndex(target, resourceType === MaterialType.STONE || resourceType === MaterialType.SCRAP ? MaterialType.ASH : MaterialType.EMPTY);
          energy = Math.max(18, energy - 10);
        }
      }

      if (energy <= 3 || Math.random() < 0.0002) {
        this.setIndex(index, Math.random() < 0.55 ? MaterialType.EMPTY : MaterialType.ASH);
        return;
      }

      this.setAuxIndex(index, energy);
      const resourceStep = target >= 0 ? this.stepTowardIndex(x, y, target) : null;
      if (resourceStep && this.tryMoveMicrobot(x, y, x + resourceStep.dx, y + resourceStep.dy)) {
        return;
      }
      const dir = ((this.tickId + x * 5 + y * 3) & 7);
      const dx = dir === 0 || dir === 3 || dir === 5 ? -1 : dir === 2 || dir === 4 || dir === 7 ? 1 : 0;
      const dy = dir < 3 ? -1 : dir > 4 ? 1 : 0;
      if (this.tryMoveMicrobot(x, y, x + dx, y + dy)) {
        return;
      }
      if ((this.tickId + x + y) % 3 === 0) {
        this.tryMoveMicrobot(x, y, x + (Math.random() < 0.5 ? -1 : 1), y);
      }
    }

    isMicrobotResource(type) {
      return type === MaterialType.PLANT ||
        type === MaterialType.EARTH ||
        type === MaterialType.SAND ||
        type === MaterialType.OIL ||
        type === MaterialType.ASH ||
        type === MaterialType.SCRAP ||
        type === MaterialType.STONE;
    }

    microbotResourceValue(type) {
      if (type === MaterialType.SCRAP) return 52;
      if (type === MaterialType.OIL) return 36;
      if (type === MaterialType.PLANT) return 30;
      if (type === MaterialType.EARTH) return 22;
      if (type === MaterialType.SAND) return 18;
      if (type === MaterialType.STONE) return 14;
      if (type === MaterialType.ASH) return 10;
      return 6;
    }

    findMicrobotResource(x, y, radius) {
      const r = radius || 2;
      const start = (this.tickId + x * 11 + y * 7) % 16;
      let best = -1;
      let bestScore = -1;
      for (let yy = y - r; yy <= y + r; yy += 1) {
        for (let xx = x - r; xx <= x + r; xx += 1) {
          if ((xx === x && yy === y) || !this.inBounds(xx, yy)) {
            continue;
          }
          const dx = xx - x;
          const dy = yy - y;
          const dist = Math.abs(dx) + Math.abs(dy);
          if (dist > r + 1) {
            continue;
          }
          const index = this.index(xx, yy);
          const type = this.grid[index];
          if (!this.isMicrobotResource(type)) {
            continue;
          }
          const score = this.microbotResourceValue(type) * 8 - dist * 9 + ((index + start) & 15);
          if (score > bestScore) {
            bestScore = score;
            best = index;
          }
        }
      }
      return best;
    }

    stepTowardIndex(x, y, index) {
      const tx = index % this.cols;
      const ty = Math.floor(index / this.cols);
      return {
        dx: tx === x ? 0 : tx > x ? 1 : -1,
        dy: ty === y ? 0 : ty > y ? 1 : -1
      };
    }

    tryMoveMicrobot(x, y, nx, ny) {
      if (!this.inBounds(nx, ny)) {
        return false;
      }
      const from = this.index(x, y);
      const to = this.index(nx, ny);
      if (this.moved[to] === this.tickId) {
        return false;
      }
      const target = this.grid[to];
      if (target === MaterialType.EMPTY ||
          target === MaterialType.WATER ||
          target === MaterialType.VAPOR ||
          target === MaterialType.OIL) {
        this.swapIndexes(from, to);
        return true;
      }
      return false;
    }

    moveLiquid(x, y, type, spread, mobility) {
      if (Math.random() > mobility) {
        return;
      }
      const gravityChance = Math.min(1, 0.18 + this.gravity * 0.58);
      const dir = ((this.tickId + x * 3 + y) & 1) ? -1 : 1;
      if (Math.random() < gravityChance && this.tryMove(x, y, x, y + 1, type)) {
        return;
      }
      if (Math.random() < gravityChance && this.tryMove(x, y, x + dir, y + 1, type)) {
        return;
      }
      if (Math.random() < gravityChance && this.tryMove(x, y, x - dir, y + 1, type)) {
        return;
      }
      const windBias = this.wind > 0.35 ? 1 : this.wind < -0.35 ? -1 : 0;
      for (let step = 1; step <= spread; step += 1) {
        const side = windBias || dir;
        if (this.tryMove(x, y, x + side * step, y, type)) {
          return;
        }
        if (this.tryMove(x, y, x - side * step, y, type)) {
          return;
        }
      }
    }

    scorchNeighbors(x, y, chance) {
      for (let yy = y - 1; yy <= y + 1; yy += 1) {
        for (let xx = x - 1; xx <= x + 1; xx += 1) {
          if (!this.inBounds(xx, yy) || (xx === x && yy === y)) {
            continue;
          }
          const index = this.index(xx, yy);
          const type = this.grid[index];
          if (type === MaterialType.PLANT && Math.random() < chance) {
            this.setIndex(index, MaterialType.FIRE, 180);
          } else if (type === MaterialType.OIL && Math.random() < chance * 1.6) {
            this.setIndex(index, MaterialType.FIRE, 220);
          } else if (type === MaterialType.ICE && Math.random() < chance * 0.8) {
            this.setIndex(index, MaterialType.WATER);
          } else if (type === MaterialType.WATER && Math.random() < chance * 0.08) {
            this.setIndex(index, MaterialType.VAPOR, 150);
          }
        }
      }
    }

    paintCircle(cx, cy, radius, type) {
      const r = Math.max(1, radius | 0);
      const rr = r * r;
      for (let y = cy - r; y <= cy + r; y += 1) {
        for (let x = cx - r; x <= cx + r; x += 1) {
          const dx = x - cx;
          const dy = y - cy;
          if (dx * dx + dy * dy <= rr) {
            if (type === MaterialType.EMPTY || this.getCell(x, y) === MaterialType.EMPTY || Materials[type].gas || type === MaterialType.FIRE) {
              this.setCell(x, y, type);
            }
          }
        }
      }
    }

    sprayMaterial(cx, cy, radius, type) {
      const r = Math.max(1, radius | 0);
      const amount = Math.max(8, r * r * 2);
      for (let i = 0; i < amount; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.sqrt(Math.random()) * r * 1.35;
        const x = Math.round(cx + Math.cos(angle) * dist);
        const y = Math.round(cy + Math.sin(angle) * dist);
        if (type === MaterialType.EMPTY || this.getCell(x, y) === MaterialType.EMPTY || Materials[type].gas || type === MaterialType.FIRE) {
          this.setCell(x, y, type);
        }
      }
    }

    showerMaterial(cx, cy, radius, type) {
      const r = Math.max(1, radius | 0);
      const amount = Math.max(5, r * 3);
      for (let i = 0; i < amount; i += 1) {
        const x = Math.max(0, Math.min(this.cols - 1, cx + ((Math.random() * r * 2) | 0) - r));
        const y = Math.max(0, Math.min(this.rows - 1, cy - r * 3 - ((Math.random() * r * 3) | 0)));
        this.setCell(x, y, type);
      }
    }

    spawnMicrobots(cx, cy, radius) {
      const r = Math.max(1, radius | 0);
      const amount = Math.max(4, Math.floor(r * r * 0.8));
      for (let i = 0; i < amount; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.sqrt(Math.random()) * r;
        const x = Math.round(cx + Math.cos(angle) * dist);
        const y = Math.round(cy + Math.sin(angle) * dist);
        if (!this.inBounds(x, y)) {
          continue;
        }
        const index = this.index(x, y);
        const type = this.grid[index];
        if (type === MaterialType.EMPTY || this.isMicrobotResource(type) || type === MaterialType.WATER || type === MaterialType.OIL) {
          this.setIndex(index, MaterialType.MICROBOT, 72 + ((Math.random() * 44) | 0));
        }
      }
      this.effects.emit("nano", cx + 0.5, cy + 0.5, Math.max(2, Math.floor(r / 2)));
    }

    spawnResourcePatch(cx, cy, radius) {
      const r = Math.max(1, radius | 0);
      const rr = r * r;
      const options = [MaterialType.SCRAP, MaterialType.EARTH, MaterialType.SAND, MaterialType.PLANT, MaterialType.OIL];
      for (let y = cy - r; y <= cy + r; y += 1) {
        for (let x = cx - r; x <= cx + r; x += 1) {
          const dx = x - cx;
          const dy = y - cy;
          if (dx * dx + dy * dy > rr || Math.random() < 0.22) {
            continue;
          }
          const type = options[(Math.random() * options.length) | 0];
          if (this.getCell(x, y) === MaterialType.EMPTY || type === MaterialType.OIL) {
            this.setCell(x, y, type);
          }
        }
      }
    }

    heatArea(cx, cy, radius, strength) {
      this.transformArea(cx, cy, radius, (index, type) => {
        if (type === MaterialType.ICE) {
          this.setIndex(index, MaterialType.WATER);
        } else if (type === MaterialType.WATER && Math.random() < 0.22 * strength) {
          this.setIndex(index, MaterialType.VAPOR, 130);
        } else if ((type === MaterialType.PLANT || type === MaterialType.OIL) && Math.random() < 0.18 * strength) {
          this.setIndex(index, MaterialType.FIRE, 180);
        } else if (type === MaterialType.LAVA) {
          this.setAuxIndex(index, Math.min(255, this.aux[index] + 18));
        }
      });
      this.effects.emit("spark", cx + 0.5, cy + 0.5, Math.max(1, Math.floor(radius * strength)));
    }

    coolArea(cx, cy, radius, strength) {
      this.transformArea(cx, cy, radius, (index, type) => {
        if (type === MaterialType.WATER && Math.random() < 0.26 * strength) {
          this.setIndex(index, MaterialType.ICE, 30);
        } else if (type === MaterialType.FIRE) {
          this.setIndex(index, MaterialType.VAPOR, 80);
        } else if (type === MaterialType.LAVA && Math.random() < 0.24 * strength) {
          this.setIndex(index, MaterialType.STONE);
        } else if (type === MaterialType.MICROBOT) {
          this.setAuxIndex(index, Math.max(2, this.aux[index] - 24));
        }
      });
      this.effects.emit("melt", cx + 0.5, cy + 0.5, Math.max(1, Math.floor(radius * 0.6)));
    }

    drainArea(cx, cy, radius) {
      this.transformArea(cx, cy, radius, (index, type) => {
        const mat = Materials[type];
        if (mat && (mat.liquid || mat.gas || type === MaterialType.FIRE)) {
          this.setIndex(index, MaterialType.EMPTY);
        }
      });
    }

    stirArea(cx, cy, radius, strength) {
      const r = Math.max(1, radius | 0);
      const attempts = Math.max(8, Math.floor(r * r * strength));
      for (let i = 0; i < attempts; i += 1) {
        const x = Math.max(0, Math.min(this.cols - 1, cx + ((Math.random() * r * 2) | 0) - r));
        const y = Math.max(0, Math.min(this.rows - 1, cy + ((Math.random() * r * 2) | 0) - r));
        const nx = Math.max(0, Math.min(this.cols - 1, x + ((Math.random() * 5) | 0) - 2));
        const ny = Math.max(0, Math.min(this.rows - 1, y + ((Math.random() * 5) | 0) - 2));
        const type = this.getCell(x, y);
        if (type !== MaterialType.EMPTY && type !== MaterialType.STONE) {
          this.nudgeCell(x, y, nx, ny);
        }
      }
    }

    forceArea(cx, cy, radius, dx, dy, strength) {
      const r = Math.max(1, radius | 0);
      const attempts = Math.max(8, Math.floor(r * r * strength));
      const sx = dx === 0 ? 0 : dx > 0 ? 1 : -1;
      const sy = dy === 0 ? 0 : dy > 0 ? 1 : -1;
      for (let i = 0; i < attempts; i += 1) {
        const x = Math.max(0, Math.min(this.cols - 1, cx + ((Math.random() * r * 2) | 0) - r));
        const y = Math.max(0, Math.min(this.rows - 1, cy + ((Math.random() * r * 2) | 0) - r));
        const step = 1 + ((Math.random() * 3) | 0);
        this.nudgeCell(x, y, x + sx * step, y + sy * step);
      }
    }

    radialForceArea(cx, cy, radius, outward, strength) {
      const r = Math.max(1, radius | 0);
      const attempts = Math.max(10, Math.floor(r * r * strength));
      for (let i = 0; i < attempts; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 1 + Math.random() * r;
        const x = Math.round(cx + Math.cos(angle) * dist);
        const y = Math.round(cy + Math.sin(angle) * dist);
        const dx = x === cx ? 0 : x > cx ? 1 : -1;
        const dy = y === cy ? 0 : y > cy ? 1 : -1;
        this.nudgeCell(x, y, x + (outward ? dx : -dx), y + (outward ? dy : -dy));
      }
    }

    nudgeCell(x, y, nx, ny) {
      if (!this.inBounds(x, y) || !this.inBounds(nx, ny)) {
        return false;
      }
      const from = this.index(x, y);
      const to = this.index(nx, ny);
      const type = this.grid[from];
      const target = this.grid[to];
      if (type === MaterialType.EMPTY || type === MaterialType.STONE) {
        return false;
      }
      if (target === MaterialType.EMPTY || this.canDisplace(type, target) || (type === MaterialType.MICROBOT && target !== MaterialType.STONE)) {
        this.swapIndexes(from, to);
        return true;
      }
      return false;
    }

    transformArea(cx, cy, radius, callback) {
      const r = Math.max(1, radius | 0);
      const rr = r * r;
      for (let y = cy - r; y <= cy + r; y += 1) {
        for (let x = cx - r; x <= cx + r; x += 1) {
          const dx = x - cx;
          const dy = y - cy;
          if (dx * dx + dy * dy > rr || !this.inBounds(x, y)) {
            continue;
          }
          const index = this.index(x, y);
          const type = this.grid[index];
          if (type !== MaterialType.EMPTY) {
            callback(index, type, x, y);
          }
        }
      }
    }

    dropMeteor(cx, cy, radius) {
      const r = Math.max(3, radius | 0);
      const rr = r * r;
      for (let y = cy - r; y <= cy + r; y += 1) {
        for (let x = cx - r; x <= cx + r; x += 1) {
          const dx = x - cx;
          const dy = y - cy;
          const d2 = dx * dx + dy * dy;
          if (!this.inBounds(x, y) || d2 > rr) {
            continue;
          }
          if (d2 < rr * 0.34) {
            if (Math.random() < 0.38) {
              this.setCell(x, y, MaterialType.LAVA, 210);
            } else {
              this.setCell(x, y, MaterialType.EMPTY);
            }
          } else if (d2 > rr * 0.72) {
            this.setCell(x, y, Math.random() < 0.62 ? MaterialType.STONE : MaterialType.ASH);
          } else if (Math.random() < 0.36) {
            this.setCell(x, y, MaterialType.FIRE, 180);
          }
        }
      }
      this.effects.emit("spark", cx + 0.5, cy + 0.5, Math.max(5, r));
      this.activateCell(cx, cy, r + 2);
    }

    drawLine(x0, y0, x1, y1, radius, type) {
      const dx = Math.abs(x1 - x0);
      const dy = Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx - dy;
      let x = x0;
      let y = y0;
      for (let guard = 0; guard < this.cols + this.rows + 512; guard += 1) {
        this.paintCircle(x, y, radius, type);
        if (x === x1 && y === y1) {
          break;
        }
        const e2 = 2 * err;
        if (e2 > -dy) {
          err -= dy;
          x += sx;
        }
        if (e2 < dx) {
          err += dx;
          y += sy;
        }
      }
    }

    drawRect(x0, y0, x1, y1, radius, type) {
      const minX = Math.min(x0, x1);
      const maxX = Math.max(x0, x1);
      const minY = Math.min(y0, y1);
      const maxY = Math.max(y0, y1);
      for (let y = minY; y <= maxY; y += Math.max(1, radius)) {
        for (let x = minX; x <= maxX; x += Math.max(1, radius)) {
          this.paintCircle(x, y, radius, type);
        }
      }
    }

    fillBucket(cx, cy, type) {
      if (!this.inBounds(cx, cy)) {
        return 0;
      }
      const target = this.getCell(cx, cy);
      if (target === type) {
        return 0;
      }
      const maxFill = Math.min(12000, Math.floor(this.grid.length * 0.32));
      const stack = [this.index(cx, cy)];
      const seen = new Uint8Array(this.grid.length);
      let filled = 0;
      while (stack.length && filled < maxFill) {
        const index = stack.pop();
        if (seen[index] || this.grid[index] !== target) {
          continue;
        }
        seen[index] = 1;
        this.setIndex(index, type);
        filled += 1;
        const x = index % this.cols;
        const y = Math.floor(index / this.cols);
        if (x > 0) stack.push(index - 1);
        if (x < this.cols - 1) stack.push(index + 1);
        if (y > 0) stack.push(index - this.cols);
        if (y < this.rows - 1) stack.push(index + this.cols);
      }
      return filled;
    }

    applyTornado(centerX, centerY, radius, strength) {
      const attempts = Math.floor(radius * strength * 14);
      for (let i = 0; i < attempts; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * radius;
        const x = Math.floor(centerX + Math.cos(angle) * dist);
        const y = Math.floor(centerY + Math.sin(angle) * dist);
        if (!this.inBounds(x, y)) {
          continue;
        }
        const index = this.index(x, y);
        const type = this.grid[index];
        if (type === MaterialType.EMPTY || type === MaterialType.STONE || type === MaterialType.ICE) {
          continue;
        }
        const tangent = angle + Math.PI / 2;
        const nx = Math.round(x + Math.cos(tangent) * 2);
        const ny = Math.round(y + Math.sin(tangent) * 2 - strength * 2);
        this.tryMove(x, y, nx, ny, type);
      }
    }

    warmRandomCells(amount) {
      for (let i = 0; i < amount; i += 1) {
        const index = (Math.random() * this.grid.length) | 0;
        const type = this.grid[index];
        if (type === MaterialType.ICE) {
          this.setIndex(index, MaterialType.WATER);
        } else if (type === MaterialType.PLANT && Math.random() < 0.018) {
          this.setIndex(index, MaterialType.FIRE, 170);
        } else if (type === MaterialType.OIL && Math.random() < 0.012) {
          this.setIndex(index, MaterialType.FIRE, 210);
        }
      }
    }

    coolRandomCells(amount) {
      for (let i = 0; i < amount; i += 1) {
        const index = (Math.random() * this.grid.length) | 0;
        const type = this.grid[index];
        if (type === MaterialType.WATER && Math.random() < 0.045) {
          this.setIndex(index, MaterialType.ICE);
        } else if (type === MaterialType.FIRE && Math.random() < 0.12) {
          this.setIndex(index, MaterialType.VAPOR, 90);
        } else if (type === MaterialType.LAVA && Math.random() < 0.025) {
          this.setIndex(index, MaterialType.STONE);
        }
      }
    }

    countMaterial(type) {
      let count = 0;
      for (let i = 0; i < this.grid.length; i += 1) {
        if (this.grid[i] === type) {
          count += 1;
        }
      }
      return count;
    }

    seedMixture() {
      const baseY = Math.floor(this.rows * 0.72);
      const width = Math.floor(this.cols * 0.55);
      const startX = Math.floor((this.cols - width) / 2);
      this.beginChangeSet();
      for (let i = 0; i < width; i += 1) {
        const x = startX + i;
        this.setCell(x, baseY, MaterialType.STONE);
        if (i % 2 === 0) this.setCell(x, baseY - 1, MaterialType.SAND);
        if (i % 5 === 0) this.setCell(x, baseY - 4, MaterialType.WATER);
        if (i % 11 === 0) this.setCell(x, baseY - 8, MaterialType.OIL);
        if (i % 17 === 0) this.setCell(x, baseY - 12, MaterialType.PLANT);
      }
      this.endChangeSet();
      this.markAllActive();
    }

    setPerformanceHint(fps) {
      if (fps < 28) {
        this.performanceScale = 0.35;
      } else if (fps < 45) {
        this.performanceScale = 0.65;
      } else {
        this.performanceScale = 1;
      }
      if (this.effects) {
        this.effects.setQuality(this.performanceScale);
      }
    }

    setParticleLimit(value) {
      this.particleLimit = Math.max(1000, value | 0);
      if (this.particleCount > this.particleLimit) {
        this.trimParticles();
      }
    }

    trimParticles() {
      let excess = this.particleCount - this.particleLimit;
      const removable = [MaterialType.VAPOR, MaterialType.FIRE, MaterialType.ASH, MaterialType.OIL, MaterialType.WATER, MaterialType.MICROBOT];
      for (let r = 0; r < removable.length && excess > 0; r += 1) {
        const type = removable[r];
        for (let i = 0; i < this.grid.length && excess > 0; i += 2) {
          if (this.grid[i] === type) {
            this.setIndex(i, MaterialType.EMPTY);
            excess -= 1;
          }
        }
      }
    }

    render() {
      const data = this.imageData.data;
      const tick = this.tickId;
      for (let i = 0, p = 0; i < this.grid.length; i += 1, p += 4) {
        const type = this.grid[i];
        const mat = Materials[type];
        let r = mat.rgb[0];
        let g = mat.rgb[1];
        let b = mat.rgb[2];
        const noise = ((i * 17 + tick * 3) & 15) - 7;
        if (type === MaterialType.FIRE) {
          const heat = this.aux[i] || 120;
          r = Math.min(255, r + heat * 0.22);
          g = Math.max(60, g + noise * 2);
          b = Math.max(18, b - heat * 0.08);
        } else if (type === MaterialType.LAVA) {
          r = Math.min(255, r + (this.aux[i] || 160) * 0.1);
          g = Math.max(45, g + noise);
        } else if (type === MaterialType.WATER) {
          b = Math.min(255, b + noise);
          g = Math.min(255, g + noise * 0.5);
        } else if (type === MaterialType.MICROBOT) {
          const charge = this.aux[i] || 48;
          const pulse = ((tick + i * 5) & 31) - 15;
          r = Math.max(0, Math.min(255, r + charge * 0.12 + pulse));
          g = Math.max(0, Math.min(255, g + charge * 0.18));
          b = Math.max(0, Math.min(255, b + 28 + pulse * 0.5));
        } else if (type === MaterialType.SAND || type === MaterialType.EARTH || type === MaterialType.ASH || type === MaterialType.STONE || type === MaterialType.SCRAP) {
          r = Math.max(0, Math.min(255, r + noise));
          g = Math.max(0, Math.min(255, g + noise));
          b = Math.max(0, Math.min(255, b + noise));
        }
        data[p] = r;
        data[p + 1] = g;
        data[p + 2] = b;
        data[p + 3] = 255;
      }
      this.bufferCtx.putImageData(this.imageData, 0, 0);
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.drawImage(this.buffer, 0, 0, this.canvas.width, this.canvas.height);
      if (this.effects) {
        this.effects.render(this.ctx, this.canvas.width, this.canvas.height, this.cols, this.rows);
      }
    }

    serialize() {
      const runs = [];
      let lastType = this.grid[0] || 0;
      let lastAux = this.aux[0] || 0;
      let count = 0;
      for (let i = 0; i < this.grid.length; i += 1) {
        const type = this.grid[i];
        const aux = this.aux[i];
        if (type === lastType && aux === lastAux && count < 65535) {
          count += 1;
        } else {
          runs.push(lastType, lastAux, count);
          lastType = type;
          lastAux = aux;
          count = 1;
        }
      }
      runs.push(lastType, lastAux, count);
      return {
        version: 1,
        cols: this.cols,
        rows: this.rows,
        cellSize: this.cellSize,
        gravity: this.gravity,
        particleLimit: this.particleLimit,
        runs
      };
    }

    deserialize(data) {
      if (!data || !Array.isArray(data.runs)) {
        return false;
      }
      const decodedGrid = new Uint8Array(data.cols * data.rows);
      const decodedAux = new Uint8Array(data.cols * data.rows);
      let write = 0;
      for (let i = 0; i < data.runs.length; i += 3) {
        const type = data.runs[i];
        const aux = data.runs[i + 1];
        const count = data.runs[i + 2];
        for (let j = 0; j < count && write < decodedGrid.length; j += 1) {
          decodedGrid[write] = type;
          decodedAux[write] = aux;
          write += 1;
        }
      }
      this.beginChangeSet();
      this.grid.fill(0);
      this.aux.fill(0);
      this.particleCount = 0;
      const copyCols = Math.min(this.cols, data.cols);
      const copyRows = Math.min(this.rows, data.rows);
      for (let y = 0; y < copyRows; y += 1) {
        for (let x = 0; x < copyCols; x += 1) {
          const source = y * data.cols + x;
          const target = this.index(x, y);
          const type = decodedGrid[source];
          this.grid[target] = type;
          this.aux[target] = decodedAux[source];
          if (type !== MaterialType.EMPTY) {
            this.particleCount += 1;
          }
        }
      }
      this.gravity = Number(data.gravity) || this.gravity;
      this.setParticleLimit(Number(data.particleLimit) || this.particleLimit);
      this.endChangeSet();
      this.markAllActive();
      return true;
    }
  }

  PL.MaterialType = MaterialType;
  PL.Materials = Materials;
  PL.PhysicsWorld = PhysicsWorld;
  PL.SpatialHashGrid = SpatialHashGrid;
}(window));
