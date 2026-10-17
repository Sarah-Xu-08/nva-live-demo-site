/* Workspace chrome delegates all actions to the existing demo controls. */
(() => {
  const mode = document.getElementById('experiment-mode');
  const group = document.querySelector('.workspace-modes');
  const buttons = [...group.querySelectorAll('[data-workspace-mode]')];
  const focus = document.getElementById('workspace-focus');
  if (window.DemoLoading) mode.value = window.DemoLoading.current().mode;
  // This runs immediately after the header, before the renderer bundle. A
  // mode chosen during startup becomes the destination when boot completes.
  mode.addEventListener('change', () => window.DemoLoading?.begin(mode.value));
  const artworkImage = document.getElementById('workspace-mode-image');
  const artworkTitle = document.getElementById('workspace-mode-art-title');
  // Keep one 1280 × 650 frame and the shared CSS 65% scale for all illustrations.
  // These offsets align each visible right edge with the frame and each bottom
  // with the mode panel without independently enlarging the chefs.
  const illustrations = {
    recording: {
      file: 'recording-gray-a-transparent-v1.png', x: -217, y: -94,
      description: "Recording: a separate observer watches the human and AI chefs on a screen while their brain signal appears in a recording trace.",
    },
    play: {
      file: 'playing-gray-a-transparent-v1.png', x: -220, y: -111,
      description: "Playing concept: the human chef's brain signal passes through a network decoder, with blue and pink decoded signals pointing to the chip inside the smiling AI chef's head.",
    },
    editor: {
      file: 'trial-editor-gray-a-transparent-v1.png', x: -106, y: -124,
      description: 'Trial Editor: a human chef uses a pencil to design an onion-to-pot-to-plate action sequence beside the smiling AI chef.',
    },
    presentation: {
      file: 'presentation-gray-a-transparent-v1.png', x: -231, y: -96,
      description: 'Presentation: a paused human–AI cooking replay above one gray EEG signal entering a network decoder, with blue and pink output streams.',
    },
  };
  let illustratedMode;
  const sync = () => {
    if (illustratedMode !== mode.value) {
      const illustration = illustrations[mode.value] || illustrations.editor;
      const figure = artworkImage.closest('figure');
      figure.dataset.loading = 'true';
      artworkImage.onload = () => { delete figure.dataset.loading; };
      artworkImage.onerror = () => { delete figure.dataset.loading; };
      artworkImage.setAttribute('x', illustration.x);
      artworkImage.setAttribute('y', illustration.y);
      artworkImage.setAttribute('href', `static/assets/modes/${illustration.file}`);
      artworkTitle.textContent = illustration.description;
      illustratedMode = mode.value;
    }
    for (const button of buttons) {
      const option = [...mode.options].find(item => item.value === button.dataset.workspaceMode);
      button.disabled = mode.disabled || !option || option.disabled;
      button.setAttribute('aria-pressed', String(button.dataset.workspaceMode === mode.value));
    }
    focus.hidden = false;
    const focused = document.body.classList.contains('is-focus-mode');
    focus.querySelector('span').textContent = focused ? 'Exit focus mode' : 'Focus mode';
    focus.setAttribute('aria-pressed', String(focused));
    focus.setAttribute('aria-label', focused ? 'Exit focus mode' : 'Enter focus mode');
    focus.title = focused ? 'Restore page header' : 'Focus on workspace';
  };
  for (const button of buttons) button.addEventListener('click', () => {
    if (mode.disabled || button.disabled || mode.value === button.dataset.workspaceMode) return;
    mode.value = button.dataset.workspaceMode;
    mode.dispatchEvent(new Event('change', {bubbles: true}));
    sync();
  });
  focus.addEventListener('click', () => document.getElementById('focus-mode-toggle')?.click());
  mode.addEventListener('change', sync);
  document.addEventListener('focusmodechange', sync);
  new MutationObserver(sync).observe(mode, {attributes: true, attributeFilter: ['disabled'], childList: true});
  new MutationObserver(sync).observe(document.body, {attributes: true, attributeFilter: ['data-experiment-mode']});
  group.hidden = false;
  document.body.classList.add('research-ui-ready');
  // Theme changes repaint charts through their existing resize path; no
  // session selection, acquisition or playback action is dispatched.
  new MutationObserver(() => window.dispatchEvent(new Event('resize')))
    .observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
  sync();
})();
