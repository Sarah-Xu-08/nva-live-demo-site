/* Display metadata only: tile values, preferences and review inputs stay untouched. */
(() => {
  "use strict";
  const key = tile => JSON.stringify(tile);
  const neighbors = ([x, y]) => [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
  const location = ([x, y]) => `row ${y + 1}, column ${x + 1}`;
  const text = value => String(value)
    .replace(/\bhint(s?)\b/gi, (_, plural) => `Briefing${plural.toLowerCase()}`)
    .replace(/\bmiddle[- ]counter(s?)\b/gi, (_, plural) => `handoff counter${plural}`)
    .replace(/\(\s*(\d+)\s*,\s*(\d+)\s*\)/g, (_, x, y) => location([Number(x), Number(y)]));
  function fixtures(definition, source) {
    const floors = new Set();
    definition.layout.grid.forEach((row, y) => [...row].forEach((cell, x) => {
      if (" 12".includes(cell)) floors.add(key([x, y]));
    }));
    const reachable = definition.initial_state.players.map(player => {
      const seen = new Set([key(player.position)]), pending = [player.position];
      for (let i = 0; i < pending.length; i++) for (const tile of neighbors(pending[i])) {
        const id = key(tile);
        if (floors.has(id) && !seen.has(id)) { seen.add(id); pending.push(tile); }
      }
      return seen;
    });
    const names = { X: "Counter", O: "Onion dispenser", T: "Tomato dispenser", D: "Plate dispenser", P: "Pot", S: "Serving station" };
    return source.map(fixture => {
      const sides = neighbors(fixture.tile).map(key).filter(id => floors.has(id));
      const shared = fixture.cell === "X" && (fixture.shared || sides.some(human =>
        reachable[0].has(human) && sides.some(ai => ai !== human && reachable[1].has(ai))));
      return { ...fixture, shared, label: `${shared ? "Handoff counter" : names[fixture.cell]} · ${location(fixture.tile)}` };
    });
  }
  globalThis.TrialEditorTiles = { location, text, fixtures };
})();
