/* =========================================================
   JUPITER ASTRO — GLOBAL TEXT SIZE
   Adjusts typography only; does not zoom or resize layout.
   ========================================================= */
(function () {
  'use strict';

  const STORAGE_KEY = 'ja-global-font-scale-v1';
  const DIRECTION_KEY = 'ja-global-font-scale-direction-v1';
  const MIN = 0.85;
  const MAX = 1.25;
  const STEP = 0.05;
  const DEFAULT = 1;

  const decrease = document.getElementById('fontSizeDecrease');
  const increase = document.getElementById('fontSizeIncrease');
  if (!decrease || !increase) return;

  let scale = DEFAULT;
  let lastDirection = '';

  try {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    if (Number.isFinite(saved) && saved >= MIN && saved <= MAX) scale = saved;
    lastDirection = localStorage.getItem(DIRECTION_KEY) || '';
  } catch (_) {}

  function isScalableElement(element) {
    if (!(element instanceof Element)) return false;
    const tag = element.tagName;
    return !/^(SCRIPT|STYLE|LINK|META|NOSCRIPT|SVG|PATH|DEFS|CLIPPATH|SYMBOL|USE)$/i.test(tag)
      && !element.closest('svg');
  }

  function captureElement(element, isNew) {
    if (!isScalableElement(element) || element.hasAttribute('data-ja-font-scale-target')) return;

    let size = parseFloat(getComputedStyle(element).fontSize);
    if (!Number.isFinite(size) || size <= 0) return;

    // Newly inserted inherited text already sees the scaled parent. Undo that
    // inherited multiplier before storing its original size.
    if (isNew && scale !== 1 && element.parentElement) {
      const ownInlineSize = element.style && element.style.fontSize;
      const computedParent = parseFloat(getComputedStyle(element.parentElement).fontSize);
      if (!ownInlineSize && Math.abs(size - computedParent) < 0.15) size /= scale;
    }

    element.style.setProperty('--ja-font-base-size', size + 'px');
    element.setAttribute('data-ja-font-scale-target', '');
  }

  function captureTree(root, isNew) {
    if (root instanceof Element) captureElement(root, isNew);
    if (root && root.querySelectorAll) {
      root.querySelectorAll('*').forEach(function (element) {
        captureElement(element, isNew);
      });
    }
  }

  // Capture original computed sizes before enabling the scale.
  captureTree(document.documentElement, false);
  document.documentElement.style.setProperty('--ja-font-scale', String(scale));
  document.body.classList.add('ja-font-scale-enabled');

  function render() {
    document.documentElement.style.setProperty('--ja-font-scale', String(scale));
    decrease.classList.toggle('is-active', lastDirection === 'decrease');
    increase.classList.toggle('is-active', lastDirection === 'increase');
    decrease.setAttribute('aria-pressed', String(lastDirection === 'decrease'));
    increase.setAttribute('aria-pressed', String(lastDirection === 'increase'));
    decrease.disabled = scale <= MIN + 0.001;
    increase.disabled = scale >= MAX - 0.001;
    decrease.title = 'Decrease text size (' + Math.round(scale * 100) + '%)';
    increase.title = 'Increase text size (' + Math.round(scale * 100) + '%)';
  }

  function change(direction) {
    const next = Math.max(MIN, Math.min(MAX, Math.round((scale + direction * STEP) * 100) / 100));
    if (next === scale) return;
    scale = next;
    lastDirection = direction > 0 ? 'increase' : 'decrease';
    try {
      localStorage.setItem(STORAGE_KEY, String(scale));
      localStorage.setItem(DIRECTION_KEY, lastDirection);
    } catch (_) {}
    render();
  }

  decrease.addEventListener('click', function () { change(-1); });
  increase.addEventListener('click', function () { change(1); });

  // Keep text added later by charts, tables, dialogs and other modules in sync.
  const observer = new MutationObserver(function (records) {
    records.forEach(function (record) {
      record.addedNodes.forEach(function (node) {
        if (node.nodeType === Node.ELEMENT_NODE) captureTree(node, true);
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  render();
})();
