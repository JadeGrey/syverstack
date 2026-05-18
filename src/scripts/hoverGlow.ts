export function initHoverGlow(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const cards = document.querySelectorAll<HTMLElement>('.glow-hover');

  cards.forEach((card) => {
    const onMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty(
        '--glow-bg',
        `radial-gradient(400px at ${x}% ${y}%, rgba(255, 59, 140, 0.06), transparent 60%)`
      );
      card.classList.add('is-glow-active');
    };

    const onLeave = () => {
      card.classList.remove('is-glow-active');
    };

    card.addEventListener('mousemove', onMove);
    card.addEventListener('mouseleave', onLeave);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHoverGlow);
} else {
  initHoverGlow();
}
