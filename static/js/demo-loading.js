/* Run before workspace markup: the first paint already belongs to its mode. */
(() => {
  'use strict';
  const root = document.documentElement;
  const names = {editor: 'Trial Editor', recording: 'Recording', play: 'Playing', presentation: 'Presentation'};
  const requested = new URLSearchParams(location.search).get('mode');
  const initial = document.body.dataset.publicReplay ? 'presentation' : (names[requested] ? requested : 'recording');
  let ticket, sequence = 0, timeout;
  const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const current = value => value === ticket;

  function mount() {
    const pending = root.dataset.demoState !== 'ready';
    for (const element of document.querySelectorAll('.demo-content, .scenario-browser')) {
      element.inert = pending;
      element.setAttribute('aria-busy', String(pending));
    }
    const message = document.getElementById('demo-loading-message');
    if (message) message.textContent = `Loading ${names[ticket.mode] || 'workspace'}…`;
    const retry = document.getElementById('demo-loading-retry');
    if (retry) retry.onclick = () => window.DemoLoading.retry();
  }

  function begin(mode) {
    clearTimeout(timeout);
    ticket = {id: ++sequence, mode};
    root.dataset.demoState = 'loading';
    document.body.dataset.experimentMode = mode;
    // Drop the previous mode's measured height; each mode has its own reserve.
    const workspace = document.querySelector('.demo-workspace');
    if (workspace) workspace.style.removeProperty('--demo-content-height');
    mount();
    const active = ticket;
    timeout = setTimeout(() => fail(active, new Error('Loading is taking longer than expected. Try again.')), 45000);
    return ticket;
  }

  function fail(active, error) {
    if (!current(active)) return;
    clearTimeout(timeout);
    root.dataset.demoState = 'error';
    const message = document.getElementById('demo-loading-message');
    if (message) message.textContent = `Could not load ${names[active.mode] || 'workspace'}. ${error.message || error}`;
    for (const element of document.querySelectorAll('.demo-content, .scenario-browser')) element.setAttribute('aria-busy', 'false');
  }

  async function finish(active) {
    if (!current(active)) return;
    // Hidden content still has its real width, so renderer and chart sizing can
    // settle before the single reveal. No fixed sleep or EEG sample is needed.
    window.dispatchEvent(new Event('resize'));
    await frame();
    await frame();
    if (!current(active)) return;
    clearTimeout(timeout);
    const workspace = document.querySelector('.demo-workspace');
    const content = document.querySelector('.demo-content');
    if (workspace && content) workspace.style.setProperty('--demo-content-height', `${content.offsetHeight}px`);
    root.dataset.demoState = 'ready';
    mount();
    window.dispatchEvent(new Event('resize'));
  }

  async function waitForRenderer(games, cancelled = () => false) {
    const deadline = performance.now() + 15000;
    while (!cancelled()) {
      if (games.length && games.every(game => game?.game?.scene?.getScene('PlayGame')?.sprites?.chefs?.[0])) return;
      if (performance.now() > deadline) throw new Error('The kitchen could not finish loading. Try again.');
      await new Promise(resolve => setTimeout(resolve, 30));
    }
  }

  window.DemoLoading = {begin, mount, finish, fail, current: () => ticket, isCurrent: current,
    waitForRenderer, retry: () => location.reload()};
  begin(initial);
})();
