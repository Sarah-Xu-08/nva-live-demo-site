# Trial Editor illustrated preview

This previous artwork is retained for reproducibility. The later October 18
Option 1 approval moves Trial Editor to `../editor-soft-outline/`. Recording,
Playing and Presentation continue to use the parent `warm/` assets. The notes
below describe the earlier illustrated adaptation.

The art follows the approved Option 3 kitchen preview: pale stone counters,
wood cabinet fronts, a gray human chef and sage AI robot. The serving device
retains its cream arrow panel and raised metal lip. Its four directional frames
keep the cabinet front and light direction consistent instead of rotating the
whole cabinet. The approved west-facing serving tile is used unchanged.

Character poses cover four directions and every carried item. Pot states show
one/two raw ingredients, three simmering ingredients, and cooked soup without
decorative faces or dots on the onions. Trial positions, timing and actions are
not part of this visual adaptation.

`chefs-ai-size-v2` fixes AI scale changes between empty and carrying poses. The
packer separates complete robot sprites before cropping instead of using the
approximate sheet cells. Every AI pose has a 168 px body height and its feet
anchored at the same tile position; carried items do not alter its scale or
horizontal anchor. Human poses and the original source artwork are unchanged.

Generated art, the approved source preview and prompt records are in
`design/overcooked-visual-options-20261018/`. Run
`node live_demo/scripts/build_editor_assets.cjs` with `sharp` available to
rebuild the atlases. The packer crops, scales and assembles those sources; it
does not regenerate artwork or overwrite the original warm assets.
