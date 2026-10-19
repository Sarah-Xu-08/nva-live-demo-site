/* Navigation never changes fullscreen. Focus entry may explicitly request it. */
(() => {
  'use strict';
  const script = document.currentScript;
  let host;
  try { host = window.parent !== window && window.parent.SiteShell; } catch { /* Embedded elsewhere. */ }
  const siteRoot = new URL('../../', script.src);
  function canonical(url) {
    const result = new URL(url);
    result.pathname = result.pathname === `${siteRoot.pathname}workspace.page.html`
      ? siteRoot.pathname : result.pathname.replace(/\.page\.html$/, '.html');
    return result;
  }
  if (host) {
    const updatePage = (push = false) => host.updatePage(canonical(location.href), document.title, window, push);
    const replaceState = history.replaceState.bind(history);
    for (const name of ['pushState', 'replaceState']) {
      history[name] = (...args) => {
        if (name === 'pushState') host.saveScroll?.(window);
        replaceState(...args);
        updatePage(name === 'pushState');
      };
    }
    for (const name of ['hashchange', 'popstate', 'pageshow']) window.addEventListener(name, () => updatePage());
    window.addEventListener('scroll', () => host.scheduleScroll?.(window), {passive: true});
    document.addEventListener('click', event => {
      const link = event.target.closest?.('a[href]');
      if (event.defaultPrevented || !link || event.button !== 0 || event.metaKey || event.ctrlKey
          || event.shiftKey || event.altKey || link.hasAttribute('download')
          || (link.target && link.target !== '_self')) return;
      const url = new URL(link.href);
      const current = canonical(location.href);
      if (url.origin === current.origin && canonical(url).pathname === current.pathname && url.search === location.search) {
        event.preventDefault();
        if (url.hash !== current.hash) {
          const oldURL = location.href;
          history.pushState(null, '', url.hash || location.pathname + location.search);
          window.dispatchEvent(new HashChangeEvent('hashchange', {oldURL, newURL: location.href}));
        } else host.navigate?.(current.href);
        if (url.hash) {
          try { document.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView(); } catch { /* Invalid fragment. */ }
        } else window.scrollTo(0, 0);
        return;
      }
      const relative = url.pathname.slice(siteRoot.pathname.length);
      const internal = url.origin === siteRoot.origin && url.pathname.startsWith(siteRoot.pathname)
        && (relative === '' || ['demo.html', 'run-locally.html'].includes(relative)
          || /^static\/project\/[\w-]+\.html$/.test(relative));
      if (internal) {
        event.preventDefault();
        url.pathname = relative === '' ? `${siteRoot.pathname}workspace.page.html`
          : url.pathname.replace(/(?:\.page)?\.html$/, '.page.html');
        if (host.navigate) host.navigate(url.href);
        else location.assign(url.href);
      } else if (url.protocol === 'http:' || url.protocol === 'https:') {
        link.target = '_top';
      }
    });
    updatePage();
  }
  function initialize() {
    const [button, ...duplicates] = document.querySelectorAll('[data-site-fullscreen]');
    if (!button) return;
    duplicates.forEach(duplicate => duplicate.remove());
    // Mount outside the scaled workspace and scrolling page header so this
    // control stays anchored to the viewport in every mode.
    const controls = document.querySelector('.focus-mode-tools') || document.createElement('div');
    controls.classList.add('site-display-tools');
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', 'Display controls');
    controls.append(button);
    document.body.append(controls);
    const status = document.createElement('p');
    status.id = 'site-fullscreen-status';
    status.setAttribute('role', 'status');
    status.hidden = true;
    document.body.append(status);
    let pending = false;
    const fullscreen = () => host ? host.active() : document.fullscreenElement || document.webkitFullscreenElement;
    function sync() {
      const active = Boolean(fullscreen());
      button.disabled = pending || Boolean(host?.pending);
      button.setAttribute('aria-pressed', String(active));
      button.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
      button.title = active ? 'Exit fullscreen (Esc)' : 'Enter fullscreen';
      button.querySelector('[data-site-fullscreen-label]').textContent = active ? 'Exit fullscreen' : 'Fullscreen';
    }
    async function change(active) {
      if (pending) return;
      pending = true; status.hidden = true; sync();
      try {
        if (host) {
          await host.setFullscreen(active);
        } else if (!active && fullscreen()) {
          const exit = document.exitFullscreen || document.webkitExitFullscreen;
          if (!exit) throw new Error('Fullscreen exit is unavailable.');
          await exit.call(document);
        } else if (active && !fullscreen()) {
          const root = document.documentElement;
          const enter = root.requestFullscreen || root.webkitRequestFullscreen;
          if (!enter) throw new Error('Fullscreen is unavailable.');
          await enter.call(root);
        }
      } catch {
        status.textContent = 'This browser could not change fullscreen. Try its fullscreen command or open the page in another browser.';
        status.hidden = false;
      } finally {
        pending = false; sync();
      }
    }
    button.addEventListener('click', () => change(!fullscreen()));
    // Only the transition into Focus requests fullscreen. Exiting Focus and
    // changing modes leave the browser's display state alone.
    let focused = document.body.classList.contains('is-focus-mode');
    document.addEventListener('focusmodechange', () => {
      const active = document.body.classList.contains('is-focus-mode');
      if (active && !focused && !fullscreen()) change(true);
      focused = active;
    });
    window.addEventListener('sitefullscreenchange', () => {
      status.hidden = true; sync();
    });
    ['fullscreenchange', 'webkitfullscreenchange'].forEach(name => document.addEventListener(name, () => {
      status.hidden = true; sync();
    }));
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
