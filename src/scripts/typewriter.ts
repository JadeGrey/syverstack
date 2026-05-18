/**
 * typewriter.ts — Hero name typewriter effect
 * Types "Sami Syvrso" (typo) → backspaces → types "Sami Syverson"
 */

(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const TARGET = '.hero-name';
  const TYPE_DELAY = 80;
  const BACKSPACE_DELAY = 50;
  const PAUSE_MISTAKE = 400;
  const PAUSE_DONE = 600;

  const TYPO_TEXT = 'Sami Syvrso';
  const BACKSPACE_COUNT = 4;
  const REMAINING = 'verson';
  const AFTER_BACKSPACE = TYPO_TEXT.slice(0, TYPO_TEXT.length - BACKSPACE_COUNT);

  function sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms));
  }

  async function run(el: HTMLElement) {
    // Clear hero-name and set up textNode + cursor span
    el.textContent = '';
    const textNode = document.createTextNode('');
    const cursor = document.createElement('span');
    cursor.className = 'typewriter-cursor';
    el.appendChild(textNode);
    el.appendChild(cursor);

    // Phase 1: Type typo
    for (let i = 0; i < TYPO_TEXT.length; i++) {
      textNode.textContent = TYPO_TEXT.slice(0, i + 1);
      await sleep(TYPE_DELAY);
    }
    await sleep(PAUSE_MISTAKE);

    // Phase 2: Backspace
    for (let i = 0; i < BACKSPACE_COUNT; i++) {
      textNode.textContent = TYPO_TEXT.slice(0, TYPO_TEXT.length - i - 1);
      await sleep(BACKSPACE_DELAY);
    }
    await sleep(PAUSE_DONE);

    // Phase 3: Type correction
    for (let i = 0; i < REMAINING.length; i++) {
      textNode.textContent = AFTER_BACKSPACE + REMAINING.slice(0, i + 1);
      await sleep(TYPE_DELAY);
    }
    // Cursor stays blinking via CSS
  }

  function init() {
    const el = document.querySelector<HTMLElement>(TARGET);
    if (el) run(el);
  }

  let hasRun = false;

  function safeInit() {
    if (hasRun) return;
    hasRun = true;
    init();
  }

  // Expose refresh for Astro view transitions (resets so it can re-run)
  (window as any).__typewriter = {
    refresh() {
      hasRun = false;
      init();
    }
  };

  document.addEventListener('astro:page-load', () => {
    (window as any).__typewriter?.refresh();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safeInit, { once: true });
  } else {
    safeInit();
  }
})();
