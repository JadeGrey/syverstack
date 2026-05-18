export function initGlowCursor(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if ('ontouchstart' in window) return;

  const cursor = document.createElement('div');
  cursor.className = 'glow-cursor';
  document.body.appendChild(cursor);

  let x = 0, y = 0;
  let tx = 0, ty = 0;

  function onMove(e: MouseEvent) {
    tx = e.clientX;
    ty = e.clientY;
  }

  function onHover(el: HTMLElement) {
    el.addEventListener('mouseenter', () => cursor.classList.add('glow-cursor--active'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('glow-cursor--active'));
  }

  document.querySelectorAll('a, button, .btn, .project-card, .skill-category, .contact-card').forEach(onHover);

  function animate() {
    x += (tx - x) * 0.15;
    y += (ty - y) * 0.15;
    cursor.style.transform = `translate(${x - 6}px, ${y - 6}px)`;
    requestAnimationFrame(animate);
  }

  window.addEventListener('mousemove', onMove, { passive: true });
  animate();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGlowCursor);
} else {
  initGlowCursor();
}
