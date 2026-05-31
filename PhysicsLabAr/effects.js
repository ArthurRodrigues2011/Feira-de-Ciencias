(function (global) {
  "use strict";

  const PL = global.PhysicsLab = global.PhysicsLab || {};

  class Effects {
    constructor() {
      this.active = [];
      this.pool = [];
      this.maxParticles = 420;
      this.quality = 1;
      this.colors = {
        vapor: "rgba(210, 220, 226, 0.62)",
        smoke: "rgba(86, 92, 96, 0.42)",
        spark: "rgba(246, 142, 48, 0.82)",
        ripple: "rgba(74, 158, 216, 0.34)",
        melt: "rgba(130, 205, 232, 0.45)"
      };
    }

    setQuality(value) {
      this.quality = Math.max(0.25, Math.min(1, value));
      this.maxParticles = Math.floor(180 + 260 * this.quality);
      while (this.active.length > this.maxParticles) {
        this.recycle(this.active.pop());
      }
    }

    obtain() {
      return this.pool.pop() || { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, size: 1, kind: "smoke" };
    }

    recycle(particle) {
      if (this.pool.length < 512) {
        this.pool.push(particle);
      }
    }

    emit(kind, x, y, amount) {
      const scaled = Math.max(1, Math.floor(amount * this.quality));
      for (let i = 0; i < scaled; i += 1) {
        if (this.active.length >= this.maxParticles) {
          this.recycle(this.active.shift());
        }
        const p = this.obtain();
        p.kind = kind;
        p.x = x + (Math.random() - 0.5) * 0.7;
        p.y = y + (Math.random() - 0.5) * 0.7;
        p.life = 0;
        p.maxLife = kind === "ripple" ? 0.55 : kind === "spark" ? 0.42 : 1.05;
        p.size = kind === "spark" ? 0.7 + Math.random() * 0.8 : kind === "ripple" ? 1.4 : 1 + Math.random() * 1.8;
        p.vx = (Math.random() - 0.5) * (kind === "spark" ? 1.8 : 0.34);
        p.vy = kind === "spark" ? -0.8 - Math.random() * 0.6 : kind === "ripple" ? 0 : -0.18 - Math.random() * 0.4;
        this.active.push(p);
      }
    }

    update(dt) {
      const step = Math.min(0.05, dt);
      for (let i = this.active.length - 1; i >= 0; i -= 1) {
        const p = this.active[i];
        p.life += step;
        if (p.life >= p.maxLife || p.x < -8 || p.y < -8 || p.x > 10000 || p.y > 10000) {
          this.active.splice(i, 1);
          this.recycle(p);
          continue;
        }
        p.x += p.vx * step * 18;
        p.y += p.vy * step * 18;
        if (p.kind === "spark") {
          p.vy += 0.8 * step;
        } else if (p.kind !== "ripple") {
          p.vx *= 0.985;
          p.vy *= 0.992;
        }
      }
    }

    render(ctx, width, height, cols, rows) {
      if (!this.active.length) {
        return;
      }
      const sx = width / cols;
      const sy = height / rows;
      ctx.save();
      for (let i = 0; i < this.active.length; i += 1) {
        const p = this.active[i];
        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.colors[p.kind] || this.colors.smoke;
        ctx.strokeStyle = this.colors[p.kind] || this.colors.smoke;
        const px = p.x * sx;
        const py = p.y * sy;
        const size = Math.max(1, p.size * Math.min(sx, sy));
        if (p.kind === "ripple") {
          ctx.lineWidth = Math.max(1, size * 0.28);
          ctx.beginPath();
          ctx.arc(px, py, size * (1 + p.life * 2.8), 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(px, py, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  PL.Effects = Effects;
}(window));
