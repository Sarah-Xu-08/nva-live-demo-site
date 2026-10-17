/* Remember the last workspace mode without starting any demo controllers. */
(() => {
  'use strict';
  const key = 'anything-wrong-demo-mode';
  const modes = new Set(['editor', 'recording', 'play', 'presentation']);
  const resumeLinks = [...document.querySelectorAll('[data-open-workspace]')];

  function refreshResumeLinks() {
    let saved;
    try { saved = localStorage.getItem(key); } catch { /* Use the link's default mode. */ }
    for (const link of resumeLinks) {
      const allowed = (link.dataset.workspaceModes || [...modes].join(' ')).split(' ');
      const fallback = link.dataset.defaultMode || 'editor';
      const selected = modes.has(saved) && allowed.includes(saved) ? saved : fallback;
      const url = new URL(link.getAttribute('href'), document.baseURI);
      url.searchParams.set('mode', selected);
      link.href = url.href;
    }
  }

  // Observe the applied mode, not the temporary default while the workspace
  // loads or a mode switch is waiting for its existing controller to finish.
  if (document.getElementById('experiment-mode')) {
    new MutationObserver(() => {
      const selected = document.body.dataset.experimentMode;
      if (!modes.has(selected)) return;
      try { localStorage.setItem(key, selected); } catch { /* Navigation still works without storage. */ }
    }).observe(document.body, {attributes: true, attributeFilter: ['data-experiment-mode']});
  }

  refreshResumeLinks();
  window.addEventListener('pageshow', refreshResumeLinks);
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) refreshResumeLinks();
  });
})();
