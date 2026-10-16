/* Workspace chrome delegates all actions to the existing demo controls. */
(() => {
  const mode = document.getElementById('experiment-mode');
  const group = document.querySelector('.workspace-modes');
  const buttons = [...group.querySelectorAll('[data-workspace-mode]')];
  const focus = document.getElementById('workspace-focus');
  const focusToggle = document.getElementById('focus-mode-toggle');
  const artwork = document.getElementById('workspace-mode-art');
  const artworkImage = document.getElementById('workspace-mode-image');
  const artworkTitle = document.getElementById('workspace-mode-art-title');
  const artworkCrop = document.getElementById('workspace-mode-crop-bounds');
  // Each mode has standalone artwork; viewports remove its outer white margin.
  const illustrations = {
    recording: {
      file: 'recording.png', width: 1774, height: 887, viewBox: '80 90 1600 730',
      description: "Recording: an observer's brain signal is recorded while watching the human and AI chefs collaborate.",
    },
    play: {
      file: 'playing-v2.png', width: 1774, height: 887, viewBox: '90 130 1640 700',
      description: "Playing concept: the human chef's brain signal passes through a centered decoder, with blue RPE and pink SPE signals pointing to the network inside the AI chef's head.",
    },
    editor: {
      file: 'trial-editor-v2.png', width: 1774, height: 887, viewBox: '220 40 1300 800',
      description: 'Trial Editor: a human chef authors a kitchen route and an onion-to-pot-to-serving action sequence with the AI chef.',
    },
    presentation: {
      file: 'presentation-v2.png', width: 1774, height: 887, viewBox: '195 50 1385 790',
      description: 'Presentation: a paused human–AI cooking replay above a black EEG signal entering a decoder, with blue RPE and pink SPE output streams.',
    },
  };
  let illustratedMode;
  const sync = () => {
    if (illustratedMode !== mode.value) {
      const illustration = illustrations[mode.value] || illustrations.editor;
      artwork.setAttribute('viewBox', illustration.viewBox);
      illustration.viewBox.split(' ').forEach((value, index) => {
        artworkCrop.setAttribute(['x', 'y', 'width', 'height'][index], value);
      });
      artworkImage.setAttribute('width', illustration.width);
      artworkImage.setAttribute('height', illustration.height);
      artworkImage.setAttribute('href', `static/assets/modes/${illustration.file}`);
      artworkTitle.textContent = illustration.description;
      illustratedMode = mode.value;
    }
    for (const button of buttons) {
      const option = [...mode.options].find(item => item.value === button.dataset.workspaceMode);
      button.disabled = mode.disabled || !option || option.disabled;
      button.setAttribute('aria-pressed', String(button.dataset.workspaceMode === mode.value));
    }
    focus.hidden = mode.value === 'editor';
    const focused = document.body.classList.contains('is-focus-mode');
    focus.querySelector('span').textContent = focused ? 'Exit focus mode' : 'Focus mode';
    focus.setAttribute('aria-pressed', String(focused));
  };
  for (const button of buttons) button.addEventListener('click', () => {
    if (mode.disabled || button.disabled || mode.value === button.dataset.workspaceMode) return;
    mode.value = button.dataset.workspaceMode;
    mode.dispatchEvent(new Event('change', {bubbles: true}));
    sync();
  });
  focus.addEventListener('click', () => focusToggle.click());
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
