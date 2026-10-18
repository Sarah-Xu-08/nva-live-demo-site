# Shared Demo artwork: approved Option 1

All four Demo modes use this asset directory following the user's final
October 18 approval: Trial Editor (including comparison), Recording, Playing
(including Keyboard only) and Presentation. Its historical directory name is
retained to keep the approved asset URLs stable. The previous `warm/` atlases
remain available for legacy fixtures and reproducibility.

The user approved the soft outlined kitchen on October 18: rounded graphite
contours, pale smooth counters, shallow gray cabinet fronts, a gray human chef
and a sage AI robot. The cream arrow serving device retains its raised metal
lip. Its directional frames share an upright cabinet base.

`kitchen-style.js` draws a connected worktop behind the transparent
station props. Adjacent counters share a single outer contour and fine warm-gray
tile seams; cabinet fronts appear only on exposed southern edges.
All worktops have the same full-tile footprint. Cabinet depth projects below
that footprint, with extra canvas space below the last row, so corners and
terminal tiles keep the same surface size as tiles in vertical runs.
Source trays, serving devices, pots and loose items are centered on the visible worktop,
including counters in vertical runs.
Loose objects on the floor retain their tile-center placement. These atlases
require the shared countertop hook and are not standalone full-tile counters.
Participant instructions use the same geometry and prop anchors through its
canvas drawing helper. Legends and Presentation actor indicators use gray for
the human and sage green for AI; EEG class colors are unchanged.

`chefs` includes all 48 direction/item poses plus transparent legacy body
frames. Both characters have a 168 px body height and the same boot anchor,
regardless of the carried item. Loose food, plates and every pot state share
the simpler illustrated style. The editor's approved Option 2 walking cycle,
blocked attempts and STAY behavior are unchanged.

The approved preview, generated source sheets and exact prompts are in
`design/overcooked-visual-options-20261018/option-1-minimal-editor/`.
Artwork was created with the built-in image generator. The atlas packer only
crops, scales and assembles it, separating station props from their former
individual cabinet backgrounds:

```sh
node live_demo/scripts/build_editor_assets.cjs --soft-outline
```

Run with `sharp` available. The default command without `--soft-outline`
still rebuilds the previous illustrated assets in their separate directory.
