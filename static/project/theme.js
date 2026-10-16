/* Apply the saved choice before the page paints; otherwise follow the system. */
(() => {
  'use strict';
  const key = 'anything-wrong-theme';
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const valid = value => value === 'light' || value === 'dark' ? value : null;
  let preference = null;
  try { preference = valid(localStorage.getItem(key)); } catch { /* Storage may be blocked. */ }

  function apply() {
    const theme = preference || (system.matches ? 'dark' : 'light');
    document.documentElement.style.colorScheme = theme;
    document.documentElement.dataset.theme = theme;
    document.querySelectorAll('[data-light-switch]').forEach(button => {
      button.setAttribute('aria-checked', String(theme === 'light'));
      button.title = theme === 'light' ? 'Turn light off · dark background' : 'Turn light on · white background';
      button.hidden = false;
    });
  }
  apply();
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.querySelectorAll('[data-light-switch]').forEach(button => {
      button.addEventListener('click', () => {
        preference = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
        try { localStorage.setItem(key, preference); } catch { /* The switch still works for this page. */ }
        apply();
      });
    });
  });
  system.addEventListener('change', () => { if (!preference) apply(); });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) {
      preference = valid(event.newValue);
      apply();
    }
  });
})();
