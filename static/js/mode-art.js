/* Keep transparent artwork's neutral ink legible without recoloring PE signals. */
(() => {
  const svgNS = 'http://www.w3.org/2000/svg';
  const host = document.querySelector('#workspace-mode-art, .demo-mode-figure svg');
  if (!host) return;
  const defs = document.createElementNS(svgNS, 'defs');
  for (const [theme, lift] of [['light', .20], ['dark', .40]]) {
    const filter = document.createElementNS(svgNS, 'filter');
    filter.id = `mode-art-${theme}`;
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    // The blue/pink masks exclude the slightly cool neutral linework. Their
    // original pixels pass through; only neutral ink receives a brightness lift.
    filter.innerHTML = `
      <feColorMatrix in="SourceGraphic" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -5 0 5 0 -.30" result="blue"/>
      <feColorMatrix in="SourceGraphic" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  5 -5 0 0 -.30" result="pink"/>
      <feComposite in="blue" in2="pink" operator="over" result="signals"/>
      <feComponentTransfer in="SourceGraphic" result="ink">
        <feFuncR type="linear" slope="1" intercept="${lift}"/>
        <feFuncG type="linear" slope="1" intercept="${lift}"/>
        <feFuncB type="linear" slope="1" intercept="${lift}"/>
      </feComponentTransfer>
      <feComposite in="SourceGraphic" in2="signals" operator="in" result="color"/>
      <feComposite in="ink" in2="signals" operator="out" result="neutral"/>
      <feComposite in="color" in2="neutral" operator="over"/>`;
    defs.append(filter);
  }
  host.append(defs);
})();
