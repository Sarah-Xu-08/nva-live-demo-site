# Anything Wrong? project pages

Open `http://127.0.0.1:65008/static/project/index.html` with the existing demo
server running. These buildless pages use Flask's existing static-file route;
no server restart, frontend build, or new dependency is needed.

The header's **Light** switch selects white (on) or dark (off) appearance on all
four project pages. `theme.js` applies the saved browser preference before paint
and shares it across pages/tabs. Before a manual choice, appearance follows the
system setting. Blocked browser storage does not prevent toggling the current page.

- `index.html`: Overview with interactive goal/action value landscapes.
- `theory.html`: General framework, NVA paper, and Overcooked extension. The
  sections also support `#general`, `#nva`, and `#overcooked` deep links.
- `rpe-spe-methods.tex`: Self-contained, Overleaf-ready Methods document with
  the general formulation, Overcooked operationalization, an illustrative LLM
  application, a notation table and a worked accepted-state-set example. Upload
  this one file to Overleaf and compile with pdfLaTeX; no external bibliography
  or image files are needed.
- `experiment.html`: Source provenance, controlled comparisons, EEG protocol.
- `decoder.html`: Current Playing feature pipeline, calibration, model averaging,
  and decision margin.

All Live demo links point to `/?mode=play`. The live workspace shares this visual
style through its separate `research-ui.css` and `research-ui.js` files. Its
existing controllers still handle playback, recording, editing, and inference.
The project pages' `site.js` contains only explanatory interactions and
illustrative plots; it makes no API requests and cannot start sessions.

## Math typography

All equations and inline mathematical notation use locally bundled **Latin
Modern Math** through `/static/css/math.css`. Native MathML provides paired
subscripts/superscripts, product limits and stacked fractions; the surrounding
interface retains its original fonts, colors and layout. Long expressions wrap
only at explicit mathematical boundaries. No external renderer or CDN is needed.

Keep new notation in `<math class="nv-math">` with the MathML namespace. Use
`msubsup` for a shared subscript/superscript base and `mfrac` for fractions, rather
than adjacent HTML `sub`/`sup` or slash text. Decoder example updates target the
numerator and denominator nodes so slider changes preserve the typesetting.
Font provenance and licensing are in `../fonts/latin-modern-math/`.

The October 16 formulation uses `T` for the transition model and specifies
accepted actions directly, without a policy-probability support rule. It
distinguishes the scalar task-alignment reward from the next-state features
used for SPE. Keep these explanations consistent between the General framework,
Our extension, and the downloadable LaTeX. This conceptual summary does not
change the classifier, trial JSON, review checks, or computed step labels.

## Content sources

- Xu et al., *Neural Value Alignment: Human–AI Collaboration Under Goal-Action
  Ambiguity*, IEEE Transactions on Cybernetics, 2026, Sections III and IV-B.
  <https://doi.org/10.1109/TCYB.2026.3722605>
- The latest general framework and Overcooked formulation in the chat
  “Plan paper-based RPE and SPE checks,” October 16, 2026. This remains a working
  generalization, rather than a claim to reproduce every implemented audit rule.
- `live_demo/TRIAL_DESIGN.md` and `live_demo/TRIAL_LIBRARY.md` for stimulus
  provenance, review, timing and recording profiles.
- `live_demo/analysis/paper_audit/reviewed_core.py` and its README for current
  behavioral annotation scope and exceptions.
- `live_demo/analysis/xx_record_causal.py`, `live_demo/playing.py`, and
  `live_demo/README.md` for the causal voltage pipeline and current Playing mode.

No experimental performance estimates are presented. Example probabilities,
waveforms, navigation and handoff diagrams are explanatory schematics.

## Interactive value landscapes

Overview contains an adaptation of NVA Fig. 2(a). `value-landscapes.css` and
`value-landscapes.js` are loaded only on Overview and do not affect the other
pages or live demo.

Both human and AI contours can be dragged with a pointer or touch. Their center
buttons also accept arrow keys (0.01 steps; Shift for 0.05). Selecting a legend
entry brings that landscape forward, including when both centers overlap. Reset
restores the illustration. Coordinates stay in [0, 1] across viewport changes.

Contours and axis projections come from the same bivariate Gaussian, with fixed
standard deviations 0.14 and correlation 0.35. Dragging changes its mean. The
displayed **RPE/SPE proxies** are absolute goal/action center differences in
normalized units, not temporal-difference errors, behavioral labels, or neural
estimates. The Theory page retains the actual formulations. The illustration
makes no requests and cannot change any experiment state.

## Interactive NVA navigation

The NVA tab of Theory uses a 7×5 shared grid with three stages:

1. Drag S and G to distinct cells, then choose **Draw trajectory**. Alternatively,
   select a marker and then its new cell (including keyboard Enter/Space).
2. Click or drag an orthogonal, non-repeating route from S to G and choose
   **Use trajectory**. Revisiting an earlier cell trims the draft; **Undo point**
   removes its last cell. Positions and the confirmed route stay fixed during
   execution.
3. Click neighboring cells or drag from the current S to move the AI. A drag
   executes each crossed orthogonal cell as a separate transition, including
   reverse steps. Distant/diagonal clicks never teleport or invent a path.
   Keyboard users focus neighboring cells with arrows and activate with
   Enter/Space, the same way as drawing their expectation.

Every executed transition is recorded in the optional
step history and scored using the binary indicators in NVA §IV-B:

- RPE is 1 when Euclidean distance between the state and the participant-placed goal cell centers
  does not decrease. Comparisons use unrounded squared distances.
- SPE is 1 when the directed pair of consecutive states is absent from the
  drawn route. Reversing an expected edge is a mismatch; rejoining and following
  an expected edge is accepted regardless of the AI's elapsed step count.

Invalid or out-of-bounds moves create no transition or score.
Goal arrival ends movement while preserving its last scores. **Reset AI** returns
to the chosen start and clears movement/results while retaining the route and goal. **Reset
expectation** clears the route and movement while keeping both chosen positions.
**Edit positions** clears the comparison and re-enables placement. Cancelled or
invalid placement leaves the existing endpoints unchanged.

The expectation uses the paper's solid gray (#808080); AI observation uses
dashed tan (#B68F6A). Blue and pink identify RPE and SPE only. Cells are square
and state/goal markers and route turns share cell centers. Dedicated
`nva-navigation.css`, `nva-navigation.js`, and `nva-navigation-model.mjs` contain
the example; no experiment session, classifier or EEG data is used.

Validate the model with `node --test live_demo/tests/test_nva_navigation.mjs`.
Browser interaction checks are in `live_demo/tests/check_nva_navigation.cjs`.
