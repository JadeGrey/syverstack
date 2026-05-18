/**
 * glowCursor.ts — Cursor glow trail + mobile heat signature
 *
 * Desktop: canvas-based magenta glow trail behind the default cursor
 * Mobile: heat signature trail via canvas overlay
 */

interface TrailPoint {
  x: number; y: number; opacity: number; size: number;
}

interface HeatPoint {
  x: number; y: number; heat: number;
  opacity: number; age: number; maxAge: number;
}

(function () {
  'use strict';

  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ── Mobile heat signature ── */
  if (isTouchDevice || prefersReducedMotion.matches) {
    if (prefersReducedMotion.matches) return;

    const canvas = document.createElement('canvas');
    canvas.id = 'touch-heat-canvas';
    Object.assign(canvas.style, {
      position: 'fixed', top: '0', left: '0',
      width: '100vw', height: '100vh',
      zIndex: '99998', pointerEvents: 'none', display: 'block',
    });
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d')!;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
    }
    window.addEventListener('resize', resize);
    resize();

    const heatPoints: HeatPoint[] = [];
    let heatValue = 0;
    let heatTimer: ReturnType<typeof setInterval> | null = null;
    let isTouching = false;

    window.addEventListener('touchstart', (e: TouchEvent) => {
      isTouching = true;
      heatValue = 0;
      const t = e.touches[0];
      heatPoints.push({ x: t.clientX, y: t.clientY, heat: 0, opacity: 0.5, age: 0, maxAge: 40 });
      heatTimer = setInterval(() => {
        heatValue = Math.min(1, heatValue + 0.04);
      }, 50);
    }, { passive: true });

    window.addEventListener('touchmove', (e: TouchEvent) => {
      if (!isTouching) return;
      const t = e.touches[0];
      heatPoints.push({
        x: t.clientX, y: t.clientY, heat: heatValue,
        opacity: 0.5 + heatValue * 0.5, age: 0,
        maxAge: 40 + Math.round(heatValue * 60),
      });
    }, { passive: true });

    window.addEventListener('touchend', () => {
      isTouching = false;
      heatValue = 0;
      if (heatTimer) { clearInterval(heatTimer); heatTimer = null; }
    }, { passive: true });

    window.addEventListener('touchcancel', () => {
      isTouching = false;
      heatValue = 0;
      if (heatTimer) { clearInterval(heatTimer); heatTimer = null; }
    }, { passive: true });

    function drawHeat() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = heatPoints.length - 1; i >= 0; i--) {
        const p = heatPoints[i];
        p.age++;
        p.opacity *= 0.97;
        if (p.age > p.maxAge || p.opacity < 0.01) { heatPoints.splice(i, 1); continue; }

        const radius = 20 + p.heat * 50;
        const alpha = p.opacity * (0.3 + p.heat * 0.5);

        let r = 0, g = 0, b = 0;
        if (p.heat < 0.3) {
          const t = p.heat / 0.3;
          r = Math.round(t * 100);
          g = Math.round(245 - t * 100);
          b = 255;
        } else if (p.heat < 0.6) {
          const t = (p.heat - 0.3) / 0.3;
          r = 255;
          g = Math.round(245 - t * 150);
          b = Math.round(255 - t * 200);
        } else {
          const t = (p.heat - 0.6) / 0.4;
          r = 255;
          g = Math.round(95 + t * 160);
          b = Math.round(55 + t * 200);
        }

        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
        grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
        grad.addColorStop(1, `rgba(255,255,255,0)`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }
      requestAnimationFrame(drawHeat);
    }
    drawHeat();
    return;
  }

  /* ── Desktop: magenta glow trail only (no cursor replacement) ── */

  const trailCanvas = document.createElement('canvas');
  Object.assign(trailCanvas.style, {
    position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
    zIndex: '99998', pointerEvents: 'none', display: 'block',
  });
  document.body.appendChild(trailCanvas);
  const tctx = trailCanvas.getContext('2d')!;

  let tw = 0, th = 0;
  function resizeTrail() {
    const dpr = Math.min(window.devicePixelRatio, 2);
    tw = window.innerWidth; th = window.innerHeight;
    trailCanvas.width = tw * dpr;
    trailCanvas.height = th * dpr;
    tctx.scale(dpr, dpr);
  }
  resizeTrail();
  window.addEventListener('resize', resizeTrail);

  const trailPoints: TrailPoint[] = [];
  const MAX_TRAIL = 30;
  const TRAIL_SPACING = 8;
  let lastTX = 0, lastTY = 0, trailAccum = 0;

  document.addEventListener('mousemove', (e: MouseEvent) => {
    const dx = e.clientX - lastTX;
    const dy = e.clientY - lastTY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    trailAccum += dist;
    if (trailAccum >= TRAIL_SPACING) {
      trailAccum = 0;
      trailPoints.push({ x: e.clientX, y: e.clientY, opacity: 0.5, size: 3 + Math.random() * 2 });
      if (trailPoints.length > MAX_TRAIL) trailPoints.shift();
    }
    lastTX = e.clientX;
    lastTY = e.clientY;
  }, { passive: true });

  function drawTrail() {
    tctx.clearRect(0, 0, tw, th);
    for (let i = trailPoints.length - 1; i >= 0; i--) {
      const p = trailPoints[i];
      p.opacity -= 0.03;
      p.size *= 0.97;
      if (p.opacity <= 0) { trailPoints.splice(i, 1); continue; }

      if (i > 0) {
        const prev = trailPoints[i - 1];

        // Outer glow — wider, fainter magenta
        tctx.beginPath();
        tctx.moveTo(prev.x, prev.y);
        tctx.lineTo(p.x, p.y);
        tctx.strokeStyle = `rgba(255, 59, 140, ${p.opacity * 0.12})`;
        tctx.lineWidth = p.size * 8;
        tctx.lineCap = 'round';
        tctx.stroke();

        // Core trail — solid magenta line
        tctx.beginPath();
        tctx.moveTo(prev.x, prev.y);
        tctx.lineTo(p.x, p.y);
        tctx.strokeStyle = `rgba(255, 59, 140, ${p.opacity * 0.7})`;
        tctx.lineWidth = p.size;
        tctx.lineCap = 'round';
        tctx.stroke();
      }
    }

    requestAnimationFrame(drawTrail);
  }

  drawTrail();
})();
