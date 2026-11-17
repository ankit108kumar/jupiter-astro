/* Jupiter Astrology — on-demand Quill font loader
 * The optional editor font catalogue is not requested during initial page load.
 * Its CSS is persisted in localStorage after the first successful fetch.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'ja_quill_font_css_v1';
  var FONT_CSS_URL = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@600&family=Comfortaa:wght@500&family=Cormorant+Garamond:ital,wght@0,600;0,700;1,400;1,700&family=Dancing+Script:wght@600&family=Great+Vibes&family=Inconsolata:wght@500&family=Inter:wght@400;500&family=Lora:ital,wght@0,500;1,400&family=Merriweather:wght@400;700&family=Montserrat:wght@400;600&family=Nunito:wght@400;600&family=Outfit:wght@400;600&family=Pacifico&family=Playfair+Display:ital,wght@0,600;1,400&family=Poppins:wght@400;600&family=Quicksand:wght@500&family=Roboto+Mono:wght@400;500&family=Roboto:wght@400;500&family=Sacramento&family=Source+Code+Pro:wght@400;500&display=swap';
  var loadingPromise = null;
  var applied = false;

  function applyCss(cssText) {
    if (applied || !cssText) return;
    var style = document.createElement('style');
    style.id = 'ja-quill-fonts-lazy-style';
    style.textContent = cssText;
    document.head.appendChild(style);
    applied = true;
  }

  function loadQuillFonts() {
    if (applied) return Promise.resolve(true);
    if (loadingPromise) return loadingPromise;

    // A previously fetched stylesheet is reused locally on every later visit.
    try {
      var cachedCss = localStorage.getItem(STORAGE_KEY);
      if (cachedCss) {
        applyCss(cachedCss);
        return Promise.resolve(true);
      }
    } catch (error) {
      // Storage may be unavailable; continue with a normal network request.
    }

    loadingPromise = fetch(FONT_CSS_URL, { mode: 'cors', cache: 'force-cache' })
      .then(function (response) {
        if (!response.ok) throw new Error('Quill font stylesheet request failed: ' + response.status);
        return response.text();
      })
      .then(function (cssText) {
        applyCss(cssText);
        try {
          // Keep the stylesheet locally until the user clears site data.
          localStorage.setItem(STORAGE_KEY, cssText);
        } catch (error) {
          // Browser storage may be full or disabled; the in-memory style still works.
        }
        return true;
      })
      .catch(function (error) {
        console.warn('[JupiterAstro] Could not load optional Quill fonts:', error);
        return false;
      })
      .then(function (success) {
        loadingPromise = null;
        return success;
      });

    return loadingPromise;
  }

  // Expose a small API for editor initialization and toolbar controls.
  window.ensureQuillFontsLoaded = loadQuillFonts;

  // First editor focus, toolbar interaction, or font-picker interaction triggers loading.
  document.addEventListener('focusin', function (event) {
    if (event.target.closest && event.target.closest('.desc-editor, .desc-toolbar, .ql-toolbar, .desc-format-toggle')) {
      loadQuillFonts();
    }
  }, true);

  document.addEventListener('pointerdown', function (event) {
    if (event.target.closest && event.target.closest('.desc-editor, .desc-toolbar, .ql-toolbar, .desc-format-toggle')) {
      loadQuillFonts();
    }
  }, true);
})();
