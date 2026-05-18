/* ── Continuous scroll-linked stagger reveal ──
 *
 * Two modes:
 * 1. One-shot reveal (IntersectionObserver, triggered once per item group)
 * 2. Continuous scroll-linked progress (opacity/transform tied to scroll)
 *
 * Falls back to one-shot if prefers-reduced-motion.
 */

function isReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ── One-shot stagger reveal (existing behavior, enhanced) ── */
function initOneShotReveal(): void {
  const items = document.querySelectorAll<HTMLElement>('.stagger-item');
  if (!items.length) {
    // If no stagger items yet (dynamic content), retry
    setTimeout(initOneShotReveal, 200);
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const item = entry.target as HTMLElement;
          const group = item.closest('[data-stagger-group]');
          const siblings = group
            ? group.querySelectorAll<HTMLElement>('.stagger-item')
            : [item];

          siblings.forEach((sibling, idx) => {
            sibling.style.setProperty('--stagger-index', String(idx));
            sibling.classList.add('revealed');
          });

          observer.unobserve(item);
        }
      });
    },
    { threshold: 0.05, rootMargin: '0px 0px -40px 0px' }
  );

  items.forEach((item) => observer.observe(item));
}

/* ── Continuous scroll-linked reveal ──
 *
 * Elements with data-scroll-progress get their opacity/transform
 * mapped continuously to their position in the viewport.
 */
function initScrollLinked(): void {
  if (isReducedMotion()) return;

  const elements = document.querySelectorAll<HTMLElement>('[data-scroll-progress]');
  if (!elements.length) return;

  function update() {
    const viewportHeight = window.innerHeight;
    elements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const elCenter = rect.top + rect.height / 2;

      // Normalized position: 0 = just entering viewport, 1 = fully revealed
      const enterPoint = viewportHeight * 0.7;
      const exitPoint = viewportHeight * 0.2;
      let progress = 0;

      if (elCenter < enterPoint) {
        progress = elCenter > exitPoint
          ? 1 - ((enterPoint - elCenter) / (enterPoint - exitPoint))
          : 1;
      }

      progress = Math.max(0, Math.min(1, progress));

      const mode = el.dataset.scrollProgress || 'fade';
      switch (mode) {
        case 'fade':
          el.style.opacity = String(progress);
          break;
        case 'slide':
          el.style.opacity = String(progress);
          el.style.transform = `translateY(${(1 - progress) * 30}px)`;
          break;
        case 'scale':
          el.style.opacity = String(progress);
          el.style.transform = `scale(${0.8 + progress * 0.2})`;
          break;
        case 'parallax':
          const speed = parseFloat(el.dataset.scrollSpeed || '0.3');
          const offset = (1 - progress) * viewportHeight * speed * 0.15;
          el.style.transform = `translateY(${offset}px)`;
          break;
      }
    });
  }

  // Throttled scroll listener
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        update();
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });

  // Initial run
  update();
}

/* ── Parallel follow: elements that follow scroll with delay ── */
function initParallaxElements(): void {
  if (isReducedMotion()) return;

  const elements = document.querySelectorAll<HTMLElement>('[data-parallax]');
  if (!elements.length) return;

  let scrollY = window.scrollY;

  window.addEventListener('scroll', () => {
    scrollY = window.scrollY;
  }, { passive: true });

  function update() {
    elements.forEach((el) => {
      const speed = parseFloat(el.dataset.parallax || '0.2');
      const rect = el.getBoundingClientRect();
      // Only apply parallax when element is near viewport
      if (rect.top < window.innerHeight + 200 && rect.bottom > -200) {
        const offset = scrollY * speed;
        el.style.transform = `translateY(${offset % 200}px)`;
      }
    });
    requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

/* ── Init ── */
export function initStaggerReveal(): void {
  if (isReducedMotion()) {
    document.querySelectorAll('.stagger-item').forEach(el => el.classList.add('revealed'));
    return;
  }

  initOneShotReveal();
  initScrollLinked();
  initParallaxElements();
}

// Auto-init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStaggerReveal);
} else {
  initStaggerReveal();
}

// Re-init on Astro navigation
document.addEventListener('astro:page-load', initStaggerReveal);
