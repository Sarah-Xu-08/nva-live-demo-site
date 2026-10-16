/* Browser fullscreen is independent of the Live demo's Focus mode. */
(() => {
  'use strict';
  function initialize() {
    const buttons = [...document.querySelectorAll('[data-site-fullscreen]')];
    if (!buttons.length) return;
    const status = document.createElement('p');
    status.id = 'site-fullscreen-status';
    status.setAttribute('role', 'status');
    status.hidden = true;
    document.body.append(status);
    let pending = false;
    const fullscreen = () => document.fullscreenElement || document.webkitFullscreenElement;
    function sync() {
      const active = Boolean(fullscreen());
      buttons.forEach(button => {
        button.disabled = pending;
        button.setAttribute('aria-pressed', String(active));
        button.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
        button.title = active ? 'Exit fullscreen (Esc)' : 'Enter fullscreen';
        button.querySelector('[data-site-fullscreen-label]').textContent = active ? 'Exit fullscreen' : 'Fullscreen';
      });
    }
    async function toggle() {
      if (pending) return;
      pending = true; status.hidden = true; sync();
      try {
        if (fullscreen()) {
          const exit = document.exitFullscreen || document.webkitExitFullscreen;
          if (!exit) throw new Error('Fullscreen exit is unavailable.');
          await exit.call(document);
        } else {
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
    buttons.forEach(button => button.addEventListener('click', toggle));
    ['fullscreenchange', 'webkitfullscreenchange'].forEach(name => document.addEventListener(name, () => {
      status.hidden = true; sync();
    }));
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
