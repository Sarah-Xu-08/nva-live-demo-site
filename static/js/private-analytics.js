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
  };
  const script = document.createElement('script');
  script.dataset.goatcounter = 'https://nva-live-demo.goatcounter.com/count';
  script.async = true;
  script.src = 'https://gc.zgo.at/count.js';
  document.head.appendChild(script);
})();
