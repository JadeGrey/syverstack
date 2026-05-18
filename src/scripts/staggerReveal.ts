export function initStaggerReveal(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.stagger-item').forEach(el => el.classList.add('revealed'));
    return;
  }

  const items = document.querySelectorAll('.stagger-item');
  if (!items.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const item = entry.target as HTMLElement;
          const siblings = item.closest('[data-stagger-group]')
            ?.querySelectorAll('.stagger-item') ?? [item];

          siblings.forEach((sibling, idx) => {
            (sibling as HTMLElement).style.setProperty('--stagger-index', String(idx));
            (sibling as HTMLElement).classList.add('revealed');
          });

          observer.unobserve(item);
        }
      });
    },
    { threshold: 0.05, rootMargin: '0px 0px -40px 0px' }
  );

  items.forEach((item) => observer.observe(item));
}

// Auto-init on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStaggerReveal);
} else {
  initStaggerReveal();
}
