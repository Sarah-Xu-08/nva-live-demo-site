/* The persistent outer document owns fullscreen, navigation and page history. */
(() => {
  'use strict';
  const script = document.currentScript;
  const siteRoot = new URL('../../', script.src);
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = new URL('../css/site-shell.css?v=1', script.src).href;
  document.head.append(style);
  // Mirrored URLs can change directories, including on static-host subpaths.
  const base = document.createElement('base');
  base.href = location.href;
  document.head.prepend(base);
  let frame = document.getElementById('site-page');
  const content = new URL(frame.dataset.content, location.href);
  content.search = location.search;
  content.hash = location.hash;
  let parentShell;
  try { parentShell = window.parent !== window && window.parent.SiteShell; } catch { /* External embed. */ }
  if (parentShell) { location.replace(content.href); return; }

  function canonical(value) {
    const url = new URL(value, location.href);
    url.pathname = url.pathname === `${siteRoot.pathname}workspace.page.html`
      ? siteRoot.pathname : url.pathname.replace(/\.page\.html$/, '.html');
    return url;
  }
  function contentURL(value) {
    const url = canonical(value);
    url.pathname = url.pathname === siteRoot.pathname ? `${siteRoot.pathname}workspace.page.html`
      : url.pathname.replace(/\.html$/, '.page.html');
    return url;
  }
  const samePage = (a, b) => a.pathname === b.pathname && a.search === b.search;
  const active = () => Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  let pending = false, navigation = null, transition = null, restoring = false, scrollSaveTimer = null;
  const status = document.createElement('p');
  status.id = 'site-navigation-status';
  status.setAttribute('role', 'status');
  status.hidden = true;
  document.body.append(status);

  function sync() { frame.contentWindow?.dispatchEvent(new Event('sitefullscreenchange')); }
  async function setFullscreen(value) {
    if (pending || active() === value) return;
    pending = true;
    sync();
    try {
      const target = value ? document.documentElement : document;
      const change = value ? target.requestFullscreen || target.webkitRequestFullscreen
        : target.exitFullscreen || target.webkitExitFullscreen;
      if (!change) throw new Error('Fullscreen is unavailable.');
      await change.call(target);
    } finally { pending = false; sync(); }
  }
  function saveScroll(source = frame.contentWindow) {
    if (source !== frame.contentWindow || canonical(source.location.href).href !== location.href) return;
    clearTimeout(scrollSaveTimer);
    scrollSaveTimer = null;
    const scroll = [source.scrollX, source.scrollY];
    if (history.state?.siteScroll?.every((value, index) => value === scroll[index])) return;
    history.replaceState({...history.state, siteScroll: scroll}, '', location.href);
  }
  function scheduleScroll(source) {
    if (source !== frame.contentWindow || scrollSaveTimer !== null) return;
    // Scroll events arrive every frame. Persist at most four times a second so
    // reading a page cannot exhaust Chrome's history/navigation rate limit.
    scrollSaveTimer = setTimeout(() => {
      scrollSaveTimer = null;
      saveScroll(source);
    }, 250);
  }
  function updatePage(value, title, source, push = false) {
    // A page preparing offscreen must not change the URL/title of the visible one.
    if (source !== frame.contentWindow || restoring) return;
    const url = canonical(value);
    if (url.origin !== location.origin) return;
    const state = {siteScroll: [source.scrollX, source.scrollY], pageState: source.history.state};
    if (push) {
      navigation?.cancel();
      history.pushState(state, '', url.href);
    } else history.replaceState({...history.state, ...state}, '', url.href);
    document.title = title;
    frame.title = title;
    document.documentElement.style.colorScheme = source.document.documentElement.style.colorScheme;
  }
  function restorePosition(source, scroll) {
    if (scroll) source.scrollTo(...scroll);
  }
  function navigate(value, {push = true, scroll = null, state = null} = {}) {
    const url = canonical(value);
    if (url.origin !== location.origin) return;
    if (navigation?.url === url.href) return;
    navigation?.cancel();
    transition?.skipTransition();
    status.hidden = true;
    const current = canonical(frame.contentWindow.location.href);
    if (samePage(url, current)) {
      if (push && url.href === current.href) return;
      if (push) saveScroll();
      restoring = true;
      try {
        frame.contentWindow.history.replaceState(state, '', contentURL(url).href);
        frame.contentWindow.dispatchEvent(new PopStateEvent('popstate', {state}));
        if (current.hash !== url.hash) {
          frame.contentWindow.dispatchEvent(new HashChangeEvent('hashchange', {oldURL: current.href, newURL: url.href}));
        }
      } finally { restoring = false; }
      if (push) history.pushState({siteScroll: scroll || [0, 0], pageState: state}, '', url.href);
      updatePage(url, frame.contentDocument.title, frame.contentWindow);
      restorePosition(frame.contentWindow, scroll);
      return;
    }
    if (push) saveScroll();
    const next = document.createElement('iframe');
    next.className = 'site-page-preparing';
    next.title = 'Loading page';
    next.allow = 'fullscreen';
    next.setAttribute('allowfullscreen', '');
    next.setAttribute('aria-hidden', 'true');
    next.inert = true;
    // The new document has its real viewport for layout, but is not exposed to
    // the user until its styles, scripts, images and fonts have finished loading.
    Object.assign(next.style, {position: 'absolute', inset: '0', width: '100%', height: '100%',
      border: '0', opacity: '0', pointerEvents: 'none'});
    const request = {url: url.href};
    navigation = request;
    const timeout = setTimeout(() => fail(), 20000);
    request.cancel = () => {
      clearTimeout(timeout);
      next.remove();
      if (navigation === request) navigation = null;
    };
    function fail() {
      if (navigation !== request) return;
      request.cancel();
      // A failed history traversal should still leave the visible page's URL truthful.
      if (!push) updatePage(current, frame.contentDocument.title, frame.contentWindow);
      status.textContent = 'Could not load that page. Please try the menu again.';
      status.hidden = false;
    }
    next.addEventListener('error', fail, {once: true});
    next.addEventListener('load', async () => {
      if (navigation !== request) return;
      try {
        if (next.contentWindow.location.href === 'about:blank') return;
        const doc = next.contentDocument;
        if (!doc?.getElementById('site-fullscreen-status')) { fail(); return; }
        await doc.fonts.ready;
        await new Promise(resolve => next.contentWindow.requestAnimationFrame(() =>
          next.contentWindow.requestAnimationFrame(resolve)));
        if (navigation !== request) return;
        next.contentWindow.history.replaceState(state, '', next.contentWindow.location.href);
        restorePosition(next.contentWindow, scroll);
        const swap = () => {
          if (navigation !== request) return;
          clearTimeout(timeout);
          const previous = frame;
          previous.removeAttribute('id');
          next.id = 'site-page';
          next.className = '';
          next.removeAttribute('style');
          next.removeAttribute('aria-hidden');
          next.inert = false;
          frame = next;
          navigation = null;
          if (push) history.pushState({siteScroll: scroll || [0, 0], pageState: state}, '', url.href);
          updatePage(url, doc.title, next.contentWindow);
          previous.remove();
          next.contentWindow.focus();
          sync();
        };
        // Only the ready-to-ready swap is animated. Network loading never runs
        // inside a view transition, whose rendering hold has a browser timeout.
        if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
          transition = document.startViewTransition(swap);
          transition.ready.catch(() => {});
          transition.finished.catch(() => {});
        } else swap();
      } catch { fail(); }
    });
    document.body.append(next);
    // Replace about:blank so preparing a page creates no phantom history entry.
    next.contentWindow.location.replace(contentURL(url).href);
  }
  window.SiteShell = {active, setFullscreen, updatePage, saveScroll, scheduleScroll, navigate, get pending() { return pending; }};
  history.scrollRestoration = 'manual';
  window.addEventListener('popstate', event => navigate(location.href,
    {push: false, scroll: event.state?.siteScroll || [0, 0], state: event.state?.pageState || null}));
  ['fullscreenchange', 'webkitfullscreenchange'].forEach(name => document.addEventListener(name, sync));
  frame.src = content.href;
})();
