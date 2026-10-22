/* Published-site visit statistics; no tracking in local research installations. */
(() => {
  'use strict';
  if (window.location.hostname !== 'sarah-xu-08.github.io' ||
      !window.location.pathname.startsWith('/nva-live-demo-site/')) return;

  // Count pages, not query parameters, trial identities or button interactions.
  // GoatCounter's standard browser exclusion (#toggle-goatcounter) is retained.
  window.goatcounter = {
    path: window.location.pathname.replace(/\.page\.html$/, '.html'),
    no_events: true,
    allow_frame: true,
    no_onload: true,
  };
  let counted = false;
  function countVisiblePage() {
    if (counted || document.visibilityState === 'hidden' || !window.goatcounter.count) return;
    try {
      // Navigation prepares a second iframe offscreen. Count after it becomes
      // the displayed page; cancelled preparations are not visits.
      if (window.parent !== window && window.parent.SiteShell && window.frameElement?.id !== 'site-page') return;
    } catch { /* A public page can also be visited in an external embed. */ }
    counted = true;
    window.goatcounter.count();
  }
  window.addEventListener('sitefullscreenchange', countVisiblePage);
  document.addEventListener('visibilitychange', countVisiblePage);
  const script = document.createElement('script');
  script.dataset.goatcounter = 'https://nva-live-demo.goatcounter.com/count';
  script.async = true;
  script.src = 'https://gc.zgo.at/count.js';
  script.addEventListener('load', countVisiblePage);
  document.head.appendChild(script);
})();
