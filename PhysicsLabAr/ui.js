(function (global) {
  "use strict";

  const PL = global.PhysicsLab = global.PhysicsLab || {};
  const T = PL.MaterialType;
  const Materials = PL.Materials;

  const tools = [
    { id: "brush", label: "Pincel", icon: "BR" },
    { id: "erase", label: "Borracha", icon: "ER" },
    { id: "bucket", label: "Balde", icon: "BK" },
    { id: "line", label: "Linha", icon: "LN" },
    { id: "rect", label: "Retangulo", icon: "RT" },
    { id: "spray", label: "Spray", icon: "SP" },
    { id: "shower", label: "Chuva local", icon: "CH" },
    { id: "swarm", label: "Enxame", icon: "MR" },
    { id: "resources", label: "Recursos", icon: "RC" },
    { id: "heat", label: "Aquecer", icon: "AQ" },
    { id: "cool", label: "Resfriar", icon: "RF" },
    { id: "spark", label: "Faisca", icon: "FX" },
    { id: "drain", label: "Dreno", icon: "DR" },
    { id: "stir", label: "Misturar", icon: "MS" },
    { id: "fan", label: "Vento", icon: "VT" },
    { id: "attract", label: "Atrair", icon: "AT" },
    { id: "repel", label: "Repelir", icon: "RP" },
    { id: "picker", label: "Conta-gotas", icon: "CG" },
    { id: "wall", label: "Barreira", icon: "BA" },
    { id: "meteor", label: "Meteoro", icon: "MT" }
  ];

  const continuousTools = ["brush", "erase", "spray", "shower", "swarm", "resources", "heat", "cool", "spark", "drain", "stir", "fan", "attract", "repel", "wall"];
  const finalTools = ["line", "rect"];
  const initialOnlyTools = ["bucket", "picker", "meteor"];

  class UIController {
    constructor(world, time, weather, save) {
      this.world = world;
      this.time = time;
      this.weather = weather;
      this.save = save;
      this.overlay = document.getElementById("overlayCanvas");
      this.overlayCtx = this.overlay.getContext("2d");
      this.selectedMaterial = T.WATER;
      this.selectedTool = "brush";
      this.brushSize = 5;
      this.dragging = false;
      this.startCell = null;
      this.lastCell = null;
      this.previewCell = null;
      this.toastTimer = 0;
      this.chaos = false;
      this.fpsNode = document.getElementById("fpsValue");
      this.particleNode = document.getElementById("particleValue");
      this.swarmNode = document.getElementById("swarmValue");
      this.cellNode = document.getElementById("cellValue");
      this.materialLabel = document.getElementById("selectedMaterialLabel");
      this.timeState = document.getElementById("timeState");
      this.importInput = document.getElementById("importInput");
      this.statusToast = document.getElementById("statusToast");
      this.buildMaterials();
      this.buildTools();
      this.buildSpeeds();
      this.bindControls();
      this.resizeOverlay();
      this.setActiveButtons();
    }

    buildMaterials() {
      const palette = document.getElementById("materialPalette");
      palette.innerHTML = "";
      for (let i = 1; i < Materials.length; i += 1) {
        const mat = Materials[i];
        const button = document.createElement("button");
        button.type = "button";
        button.className = "material-button";
        button.dataset.material = String(i);
        button.title = mat.name;
        button.innerHTML = `<span class="swatch" style="background:${mat.color}"></span><span>${mat.name}</span>`;
        button.addEventListener("click", () => {
          this.setSelectedMaterial(i);
        });
        palette.appendChild(button);
      }
    }

    setSelectedMaterial(type) {
      if (!Materials[type] || type === T.EMPTY) {
        return;
      }
      this.selectedMaterial = type;
      this.materialLabel.textContent = Materials[type].name;
      this.setActiveButtons();
    }

    buildTools() {
      const host = document.getElementById("toolButtons");
      host.innerHTML = "";
      tools.forEach((tool) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "tool-button";
        button.dataset.tool = tool.id;
        button.title = tool.label;
        button.innerHTML = `<span class="tool-icon">${tool.icon}</span><span>${tool.label}</span>`;
        button.addEventListener("click", () => {
          this.selectedTool = tool.id;
          this.setActiveButtons();
        });
        host.appendChild(button);
      });
    }

    buildSpeeds() {
      const host = document.getElementById("speedButtons");
      host.innerHTML = "";
      [0.5, 1, 2, 4].forEach((speed) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.speed = String(speed);
        button.textContent = `${speed}x`;
        button.addEventListener("click", () => {
          this.time.setSpeed(speed);
          this.setActiveButtons();
        });
        host.appendChild(button);
      });
    }

    bindControls() {
      const frame = this.world.canvas.parentElement;
      frame.addEventListener("pointerdown", (event) => this.onPointerDown(event));
      frame.addEventListener("pointermove", (event) => this.onPointerMove(event));
      global.addEventListener("pointerup", (event) => this.onPointerUp(event));
      global.addEventListener("resize", () => {
        this.world.resize();
        this.resizeOverlay();
      });

      document.querySelectorAll("[data-action]").forEach((button) => {
        button.addEventListener("click", () => this.runAction(button.dataset.action));
      });

      const gravity = document.getElementById("gravityRange");
      const brush = document.getElementById("brushRange");
      const weather = document.getElementById("weatherRange");
      const limit = document.getElementById("limitRange");
      const weatherSelect = document.getElementById("weatherSelect");

      gravity.addEventListener("input", () => {
        this.world.gravity = Number(gravity.value) / 100;
        document.getElementById("gravityValue").textContent = this.world.gravity.toFixed(2);
      });
      brush.addEventListener("input", () => {
        this.brushSize = Number(brush.value);
        document.getElementById("brushValue").textContent = String(this.brushSize);
      });
      weather.addEventListener("input", () => {
        this.weather.setIntensity(Number(weather.value) / 100);
        document.getElementById("weatherValue").textContent = `${weather.value}%`;
      });
      limit.addEventListener("input", () => {
        const value = Number(limit.value);
        this.world.setParticleLimit(value);
        document.getElementById("limitValue").textContent = String(value);
      });
      weatherSelect.addEventListener("change", () => {
        this.weather.setType(weatherSelect.value);
      });

      this.importInput.addEventListener("change", () => this.importFromFile());
    }

    runAction(action) {
      if (action === "pause") {
        this.time.togglePause();
        this.toast(this.time.paused ? "Pausado" : "Rodando");
      } else if (action === "rewind") {
        this.time.setRewinding(!this.time.rewinding);
        this.toast(this.time.rewinding ? "Retrocedendo" : "Retrocesso parado");
      } else if (action === "save") {
        this.save.saveLocal();
        this.toast("Salvo no navegador");
      } else if (action === "load") {
        this.toast(this.save.loadLocal() ? "Carregado" : "Nenhum save local");
        this.syncControlsFromState();
      } else if (action === "export") {
        this.save.downloadJSON();
        this.toast("JSON exportado");
      } else if (action === "import") {
        this.importInput.click();
      } else if (action === "fullscreen") {
        this.toggleFullscreen();
      } else if (action === "clear") {
        this.world.clear();
        this.time.clearHistory();
        this.toast("Mundo limpo");
      } else if (action === "seed") {
        this.world.seedMixture();
        this.toast("Mistura criada");
      } else if (action === "chaos") {
        this.chaos = !this.chaos;
        this.toast(this.chaos ? "Modo caos ativo" : "Modo caos desligado");
      }
      this.setActiveButtons();
    }

    syncControlsFromState() {
      document.getElementById("weatherSelect").value = this.weather.type;
      document.getElementById("weatherRange").value = String(Math.round(this.weather.intensity * 100));
      document.getElementById("weatherValue").textContent = `${Math.round(this.weather.intensity * 100)}%`;
      document.getElementById("gravityRange").value = String(Math.round(this.world.gravity * 100));
      document.getElementById("gravityValue").textContent = this.world.gravity.toFixed(2);
      document.getElementById("limitRange").value = String(this.world.particleLimit);
      document.getElementById("limitValue").textContent = String(this.world.particleLimit);
    }

    toggleFullscreen() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => this.toast("Tela cheia indisponivel"));
      } else {
        document.exitFullscreen();
      }
    }

    importFromFile() {
      const file = this.importInput.files && this.importInput.files[0];
      if (!file) {
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const ok = this.save.importJSON(String(reader.result || ""));
        this.toast(ok ? "JSON importado" : "JSON invalido");
        this.syncControlsFromState();
      };
      reader.readAsText(file);
      this.importInput.value = "";
    }

    onPointerDown(event) {
      event.preventDefault();
      this.dragging = true;
      const cell = this.eventToCell(event);
      this.startCell = cell;
      this.lastCell = cell;
      this.previewCell = cell;
      this.applyTool(cell, cell, true);
    }

    onPointerMove(event) {
      if (!this.dragging) {
        return;
      }
      event.preventDefault();
      const cell = this.eventToCell(event);
      this.previewCell = cell;
      if (this.isContinuousTool(this.selectedTool)) {
        this.applyTool(this.lastCell, cell, false);
      }
      this.lastCell = cell;
    }

    onPointerUp(event) {
      if (!this.dragging) {
        return;
      }
      event.preventDefault();
      const cell = this.eventToCell(event);
      this.previewCell = cell;
      if (this.isFinalTool(this.selectedTool)) {
        this.applyTool(this.startCell, cell, false, true);
      } else if (!this.isInitialOnlyTool(this.selectedTool) && !this.isContinuousTool(this.selectedTool)) {
        this.applyTool(this.startCell, cell, false, true);
      }
      this.dragging = false;
      this.startCell = null;
      this.lastCell = null;
      this.previewCell = null;
      this.clearOverlay();
    }

    applyTool(from, to, initial, final) {
      const type = this.selectedTool === "erase" ? T.EMPTY : this.selectedMaterial;
      if (this.selectedTool === "brush" || this.selectedTool === "erase") {
        this.world.drawLine(from.x, from.y, to.x, to.y, this.brushSize, type);
      } else if (this.selectedTool === "bucket" && initial) {
        const filled = this.world.fillBucket(to.x, to.y, type);
        this.toast(`${filled} celulas preenchidas`);
      } else if (this.selectedTool === "line" && final) {
        this.world.drawLine(from.x, from.y, to.x, to.y, this.brushSize, type);
      } else if (this.selectedTool === "rect" && final) {
        this.world.drawRect(from.x, from.y, to.x, to.y, this.brushSize, type);
      } else if (this.selectedTool === "spray") {
        this.world.sprayMaterial(to.x, to.y, this.brushSize, type);
      } else if (this.selectedTool === "shower") {
        this.world.showerMaterial(to.x, to.y, this.brushSize, type);
      } else if (this.selectedTool === "swarm") {
        this.world.spawnMicrobots(to.x, to.y, Math.max(2, this.brushSize));
      } else if (this.selectedTool === "resources") {
        this.world.spawnResourcePatch(to.x, to.y, Math.max(2, this.brushSize));
      } else if (this.selectedTool === "heat") {
        this.world.heatArea(to.x, to.y, Math.max(2, this.brushSize * 2), 1);
      } else if (this.selectedTool === "cool") {
        this.world.coolArea(to.x, to.y, Math.max(2, this.brushSize * 2), 1);
      } else if (this.selectedTool === "spark") {
        this.world.paintCircle(to.x, to.y, Math.max(1, Math.floor(this.brushSize * 0.55)), T.FIRE);
        this.world.heatArea(to.x, to.y, Math.max(2, this.brushSize), 0.75);
      } else if (this.selectedTool === "drain") {
        this.world.drainArea(to.x, to.y, Math.max(2, this.brushSize * 2));
      } else if (this.selectedTool === "stir") {
        this.world.stirArea(to.x, to.y, Math.max(2, this.brushSize * 2), 2.2);
      } else if (this.selectedTool === "fan") {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const fallback = ((this.world.tickId + to.y) & 1) ? 1 : -1;
        this.world.forceArea(to.x, to.y, Math.max(2, this.brushSize * 3), dx || fallback, dy * 0.35, 1.9);
      } else if (this.selectedTool === "attract") {
        this.world.radialForceArea(to.x, to.y, Math.max(3, this.brushSize * 3), false, 1.7);
      } else if (this.selectedTool === "repel") {
        this.world.radialForceArea(to.x, to.y, Math.max(3, this.brushSize * 3), true, 1.9);
      } else if (this.selectedTool === "picker" && initial) {
        const picked = this.world.getCell(to.x, to.y);
        if (picked !== T.EMPTY) {
          this.setSelectedMaterial(picked);
          this.toast(`${Materials[picked].name} selecionado`);
        }
      } else if (this.selectedTool === "wall") {
        this.world.drawLine(from.x, from.y, to.x, to.y, Math.max(1, this.brushSize), T.STONE);
      } else if (this.selectedTool === "meteor" && initial) {
        this.world.dropMeteor(to.x, to.y, Math.max(4, this.brushSize * 2));
      }
    }

    isContinuousTool(tool) {
      return continuousTools.indexOf(tool) !== -1;
    }

    isFinalTool(tool) {
      return finalTools.indexOf(tool) !== -1;
    }

    isInitialOnlyTool(tool) {
      return initialOnlyTools.indexOf(tool) !== -1;
    }

    eventToCell(event) {
      const rect = this.world.canvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(this.world.cols - 1, Math.floor((event.clientX - rect.left) / rect.width * this.world.cols)));
      const y = Math.max(0, Math.min(this.world.rows - 1, Math.floor((event.clientY - rect.top) / rect.height * this.world.rows)));
      return { x, y };
    }

    resizeOverlay() {
      const rect = this.overlay.getBoundingClientRect();
      const dpr = Math.min(global.devicePixelRatio || 1, 2);
      this.overlay.width = Math.max(1, Math.floor(rect.width * dpr));
      this.overlay.height = Math.max(1, Math.floor(rect.height * dpr));
      this.clearOverlay();
    }

    clearOverlay() {
      this.overlayCtx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    }

    renderOverlay() {
      this.clearOverlay();
      if (!this.dragging || !this.startCell || !this.previewCell || (this.selectedTool !== "line" && this.selectedTool !== "rect")) {
        return;
      }
      const ctx = this.overlayCtx;
      const sx = this.overlay.width / this.world.cols;
      const sy = this.overlay.height / this.world.rows;
      ctx.save();
      ctx.strokeStyle = "rgba(34, 102, 168, 0.9)";
      ctx.fillStyle = "rgba(34, 102, 168, 0.12)";
      ctx.lineWidth = Math.max(2, this.brushSize * Math.min(sx, sy));
      ctx.lineCap = "round";
      const x0 = (this.startCell.x + 0.5) * sx;
      const y0 = (this.startCell.y + 0.5) * sy;
      const x1 = (this.previewCell.x + 0.5) * sx;
      const y1 = (this.previewCell.y + 0.5) * sy;
      if (this.selectedTool === "line") {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      } else {
        const left = Math.min(x0, x1);
        const top = Math.min(y0, y1);
        const width = Math.abs(x1 - x0);
        const height = Math.abs(y1 - y0);
        ctx.fillRect(left, top, width, height);
        ctx.strokeRect(left, top, width, height);
      }
      ctx.restore();
    }

    setActiveButtons() {
      document.querySelectorAll("[data-material]").forEach((button) => {
        button.classList.toggle("is-active", Number(button.dataset.material) === this.selectedMaterial);
      });
      document.querySelectorAll("[data-tool]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.tool === this.selectedTool);
      });
      document.querySelectorAll("[data-speed]").forEach((button) => {
        button.classList.toggle("is-active", Number(button.dataset.speed) === this.time.speed && !this.time.rewinding);
      });
      document.querySelectorAll("[data-action='pause']").forEach((button) => {
        button.classList.toggle("is-active", this.time.paused);
      });
      document.querySelectorAll("[data-action='rewind']").forEach((button) => {
        button.classList.toggle("is-active", this.time.rewinding);
      });
      document.querySelectorAll("[data-action='chaos']").forEach((button) => {
        button.classList.toggle("is-active", this.chaos);
      });
      this.timeState.textContent = this.time.rewinding ? "RW" : this.time.paused ? "Pausado" : `${this.time.speed}x`;
    }

    updateStats(fps) {
      this.fpsNode.textContent = String(Math.round(fps));
      this.particleNode.textContent = String(this.world.particleCount);
      if (this.swarmNode) {
        this.swarmNode.textContent = String(this.world.countMaterial(T.MICROBOT));
      }
      this.cellNode.textContent = String(this.world.cellSize);
      this.setActiveButtons();
    }

    chaosStep() {
      if (!this.chaos) {
        return;
      }
      const types = [T.WATER, T.FIRE, T.EARTH, T.PLANT, T.VAPOR, T.LAVA, T.SAND, T.OIL, T.ICE, T.ASH, T.SCRAP];
      const amount = this.world.performanceScale < 0.5 ? 2 : 5;
      for (let i = 0; i < amount; i += 1) {
        const type = types[(Math.random() * types.length) | 0];
        const x = (Math.random() * this.world.cols) | 0;
        const y = (Math.random() * Math.max(4, this.world.rows * 0.45)) | 0;
        this.world.paintCircle(x, y, 1 + ((Math.random() * this.brushSize) | 0), type);
      }
      if (Math.random() < 0.004 * this.world.performanceScale) {
        this.world.spawnMicrobots((Math.random() * this.world.cols) | 0, (Math.random() * this.world.rows) | 0, 2);
      }
      if (Math.random() < 0.012) {
        const climates = ["rain", "storm", "snow", "tornado", "heat"];
        this.weather.setType(climates[(Math.random() * climates.length) | 0]);
        document.getElementById("weatherSelect").value = this.weather.type;
      }
    }

    toast(message) {
      clearTimeout(this.toastTimer);
      this.statusToast.textContent = message;
      this.statusToast.classList.add("is-visible");
      this.toastTimer = setTimeout(() => {
        this.statusToast.classList.remove("is-visible");
      }, 1600);
    }
  }

  PL.UIController = UIController;
}(window));
