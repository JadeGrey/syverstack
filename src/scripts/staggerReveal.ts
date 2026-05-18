/**
 * staggerReveal.ts — NightCity Bloom Staggered Reveal
 *
 * Uses .stagger-grid as container and .stagger-item as children.
 * Each item is indexed 0..N with 60ms transition delay.
 * Uses IntersectionObserver with 0.15 threshold.
 * Supports Astro view transitions via window.__staggerReveal.refresh().
 */

(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.stagger-item').forEach(el => el.classList.add('revealed'));
    return;
  }

  const THRESHOLD = 0.15;
  const REVEAL_CLASS = 'revealed';
  const GRID_SELECTOR = '.stagger-grid';
  const ITEM_SELECTOR = '.stagger-item';

  let observer: IntersectionObserver | null = null;

  function getObserver() {
    if (!observer) {
      observer = new IntersectionObserver(onIntersect, { threshold: THRESHOLD });
    }
    return observer;
  }

  function onIntersect(entries: IntersectionObserverEntry[], obs: IntersectionObserver) {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        (entry.target as HTMLElement).classList.add(REVEAL_CLASS);
        obs.unobserve(entry.target);
      }
    }
  }

  function indexItems(container: Element | null) {
    const items = container
      ? container.querySelectorAll<HTMLElement>(ITEM_SELECTOR)
      : document.querySelectorAll<HTMLElement>(ITEM_SELECTOR);
    items.forEach((item, i) => {
      item.style.setProperty('--stagger-index', String(i));
    });
    return items;
  }

  function init() {
    // 1. Index items inside every .stagger-grid
    const grids = document.querySelectorAll(GRID_SELECTOR);
    const indexedSet = new Set<HTMLElement>();
    for (const grid of grids) {
      const items = indexItems(grid);
      items.forEach(item => indexedSet.add(item));
    }

    // 2. Standalone items (not inside any grid) get index 0 → immediate reveal
    document.querySelectorAll<HTMLElement>(ITEM_SELECTOR).forEach(el => {
      if (!indexedSet.has(el)) {
        el.style.setProperty('--stagger-index', '0');
      }
    });

    // 3. Observe all items
    const obs = getObserver();
    document.querySelectorAll<HTMLElement>(ITEM_SELECTOR).forEach(item => obs.observe(item));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  // Expose refresh for Astro navigation
  (window as any).__staggerReveal = {
    refresh() {
      if (observer) { observer.disconnect(); observer = null; }
      init();
    },
  };

  document.addEventListener('astro:page-load', () => {
    (window as any).__staggerReveal?.refresh();
  });
})();
