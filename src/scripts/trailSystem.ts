interface TrailPoint {
  x: number;
  y: number;
  opacity: number;
  size: number;
}

interface HeatPoint {
  x: number;
  y: number;
  heat: number;
  opacity: number;
  age: number;
  maxAge: number;
}

class TrailSystem {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private trailPoints: TrailPoint[] = [];
  private heatPoints: HeatPoint[] = [];
  private heatValue = 0;
  private heatTimer: ReturnType<typeof setInterval> | null = null;
  private isTouching = false;
  private running = false;
  private rafId = 0;
  private isMobile = false;

  private readonly MAX_TRAIL = 40;
  private readonly TRAIL_SPACING = 6;
  private lastTrailX = 0;
  private lastTrailY = 0;
  private trailAccum = 0;

  init(): void {
    if (this.running) return;
    this.isMobile = 'ontouchstart' in window;

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'trail-canvas';
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      z-index: 9998; pointer-events: none; display: block;
    `;
    document.body.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());

    if (this.isMobile) {
      this.initMobile();
    } else {
      this.initDesktop();
    }

    this.running = true;
    this.loop();
  }

  private resize(): void {
    if (!this.canvas || !this.ctx) return;
    const dpr = Math.min(window.devicePixelRatio, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.scale(dpr, dpr);
  }

  /* ── Desktop: cursor trail ── */

  private initDesktop(): void {
    window.addEventListener('mousemove', (e: MouseEvent) => {
      this.addTrailPoint(e.clientX, e.clientY);
    });
  }

  private addTrailPoint(x: number, y: number): void {
    const dx = x - this.lastTrailX;
    const dy = y - this.lastTrailY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    this.trailAccum += dist;

    if (this.trailAccum < this.TRAIL_SPACING) return;
    this.trailAccum = 0;

    this.trailPoints.push({
      x, y,
      opacity: 0.6,
      size: 3 + Math.random() * 2,
    });

    if (this.trailPoints.length > this.MAX_TRAIL) {
      this.trailPoints.shift();
    }

    this.lastTrailX = x;
    this.lastTrailY = y;
  }

  /* ── Mobile: heat signature ── */

  private initMobile(): void {
    window.addEventListener('touchstart', (e: TouchEvent) => {
      this.isTouching = true;
      this.heatValue = 0;
      const t = e.touches[0];
      this.addHeatPoint(t.clientX, t.clientY, 0);

      this.heatTimer = setInterval(() => {
        this.heatValue = Math.min(1, this.heatValue + 0.04);
      }, 50);
    }, { passive: true });

    window.addEventListener('touchmove', (e: TouchEvent) => {
      if (!this.isTouching) return;
      const t = e.touches[0];
      this.addHeatPoint(t.clientX, t.clientY, this.heatValue);
    }, { passive: true });

    window.addEventListener('touchend', () => {
      this.isTouching = false;
      this.heatValue = 0;
      if (this.heatTimer) {
        clearInterval(this.heatTimer);
        this.heatTimer = null;
      }
    }, { passive: true });

    window.addEventListener('touchcancel', () => {
      this.isTouching = false;
      this.heatValue = 0;
      if (this.heatTimer) {
        clearInterval(this.heatTimer);
        this.heatTimer = null;
      }
    }, { passive: true });
  }

  private addHeatPoint(x: number, y: number, heat: number): void {
    this.heatPoints.push({
      x, y, heat,
      opacity: 0.5 + heat * 0.5,
      age: 0,
      maxAge: 40 + Math.round(heat * 60),
    });
  }

  /* ── Render loop ── */

  private loop(): void {
    if (!this.running) return;
    this.draw();
    this.rafId = requestAnimationFrame(() => this.loop());
  }

  private draw(): void {
    const ctx = this.ctx!;
    const w = window.innerWidth;
    const h = window.innerHeight;

    ctx.clearRect(0, 0, w, h);

    if (this.isMobile) {
      this.drawHeatSignature(ctx);
    } else {
      this.drawTrail(ctx);
    }
  }

  /* ── Desktop trail render ── */

  private drawTrail(ctx: CanvasRenderingContext2D): void {
    if (this.trailPoints.length < 2) return;

    // Age points
    for (let i = this.trailPoints.length - 1; i >= 0; i--) {
      const p = this.trailPoints[i];
      p.opacity -= 0.025;
      p.size *= 0.97;
      if (p.opacity <= 0) {
        this.trailPoints.splice(i, 1);
      }
    }

    // Draw trail as connected glow segments
    for (let i = 1; i < this.trailPoints.length; i++) {
      const prev = this.trailPoints[i - 1];
      const curr = this.trailPoints[i];
      const alpha = curr.opacity;

      // Glow layer
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(curr.x, curr.y);
      ctx.strokeStyle = `rgba(255, 59, 140, ${alpha * 0.3})`;
      ctx.lineWidth = curr.size * 4;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Core layer
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(curr.x, curr.y);
      const coreAlpha = Math.min(alpha * 1.5, 0.8);
      const ratio = i / this.trailPoints.length;
      const color = ratio > 0.5
        ? `rgba(0, 245, 255, ${coreAlpha})`
        : `rgba(255, 59, 140, ${coreAlpha})`;
      ctx.strokeStyle = color;
      ctx.lineWidth = curr.size;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  /* ── Mobile heat signature render ── */

  private drawHeatSignature(ctx: CanvasRenderingContext2D): void {
    // Age and remove old points
    for (let i = this.heatPoints.length - 1; i >= 0; i--) {
      const p = this.heatPoints[i];
      p.age++;
      p.opacity *= 0.97;
      if (p.age > p.maxAge || p.opacity < 0.01) {
        this.heatPoints.splice(i, 1);
      }
    }

    if (this.heatPoints.length === 0) return;

    // Draw each heat point with radial gradient
    for (const p of this.heatPoints) {
      const radius = 20 + p.heat * 50;
      const alpha = p.opacity * (0.3 + p.heat * 0.5);

      // Heat color gradient: cool cyan → warm magenta → white hot
      let color: string;
      if (p.heat < 0.3) {
        // Cool: cyan range
        const t = p.heat / 0.3;
        color = `rgba(${Math.round(t * 100)}, ${Math.round(245 - t * 100)}, 255, ${alpha})`;
      } else if (p.heat < 0.6) {
        // Warm: magenta range
        const t = (p.heat - 0.3) / 0.3;
        color = `rgba(255, ${Math.round(245 - t * 150)}, ${Math.round(255 - t * 200)}, ${alpha})`;
      } else {
        // Hot: white-hot
        const t = (p.heat - 0.6) / 0.4;
        const r = 255;
        const g = Math.round(95 + t * 160);
        const b = Math.round(55 + t * 200);
        color = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }

      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      gradient.addColorStop(0, color);
      gradient.addColorStop(0.3, color.replace(/[\d.]+\)$/, `${alpha * 0.6})`));
      gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);

      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Inner glow for hot points
      if (p.heat > 0.4) {
        const innerGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 0.3);
        const innerOpacity = p.opacity * (p.heat - 0.4) * 2;
        innerGrad.addColorStop(0, `rgba(255, 255, 255, ${innerOpacity * 0.8})`);
        innerGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = innerGrad;
        ctx.fill();
      }
    }

    // Also add glowing sweep for current touch
    if (this.isTouching && this.heatPoints.length > 0) {
      const latest = this.heatPoints[this.heatPoints.length - 1];
      if (latest.heat > 0.3) {
        // Sweep glow around current touch
        const sweepRadius = 40 + latest.heat * 80;
        const sweep = ctx.createRadialGradient(
          latest.x, latest.y, 0,
          latest.x, latest.y, sweepRadius
        );
        const sweepAlpha = latest.opacity * 0.15 * latest.heat;
        sweep.addColorStop(0, `rgba(255, 150, 50, ${sweepAlpha})`);
        sweep.addColorStop(0.5, `rgba(255, 59, 140, ${sweepAlpha * 0.5})`);
        sweep.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.beginPath();
        ctx.arc(latest.x, latest.y, sweepRadius, 0, Math.PI * 2);
        ctx.fillStyle = sweep;
        ctx.fill();
      }
    }
  }

  destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    if (this.heatTimer) clearInterval(this.heatTimer);
    this.canvas?.remove();
    this.ctx = null;
    this.canvas = null;
  }
}

export const trailSystem = new TrailSystem();

// Auto-init
if (document.readyState === 'complete') {
  trailSystem.init();
} else {
  window.addEventListener('load', () => trailSystem.init(), { once: true });
}

document.addEventListener('astro:before-swap', () => {
  trailSystem.destroy();
});
