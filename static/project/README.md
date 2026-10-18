# Anything Wrong? project pages

Open `http://127.0.0.1:65008/static/project/index.html` with the existing demo
server running. These buildless pages use Flask's existing static-file route;
no server restart, frontend build, or new dependency is needed.

The header’s circular appearance button shows a **sun in light mode** and a
**moon in dark mode**, on both the project pages and the live workspace. It is
36 px across (44 px for touch input), with an accessible Light mode switch
label and a tooltip naming the next mode. `theme.js` applies the saved browser
preference before paint and shares it across pages/tabs. Before a manual choice,
appearance follows the system setting. Blocked browser storage does not prevent
toggling the current page.

- `index.html`: Overview with interactive goals, trajectories, and continuous prediction errors.
- `theory.html`: General Framework, Single-Agent Setting, and Collaborative Environments. The
  sections also support `#general`, `#nva`, and `#overcooked` deep links.
- `rpe-spe-methods.tex`: Self-contained, Overleaf-ready Methods document with
  the general formulation, Overcooked operationalization, an illustrative LLM
  application, a notation table and a worked accepted-state-set example. Upload
  this one file to Overleaf and compile with pdfLaTeX; no external bibliography
  or image files are needed.
- `experiment.html`: Two stages, using the Theory tab style: **Stage 1 · Trial
  design** (`#trial-design`) covers provenance, controlled comparisons, behavioral
  labels and review; **Stage 2 · Human experiment** (`#human-experiment`) covers
  the participant session, continuous neural signal recording and optional ratings.
  The shared introduction stays visible. Trial Editor and Recording links open
  their local modes; the public exporter routes them to Run locally guidance.
- `decoder.html`: Current Playing feature pipeline, calibration, model averaging,
  and decision margin.
- `demo.html`: The Demo Introduction, with the four approved abstract symbols
  in a two-by-two grid (one column on mobile) and direct mode entry links.
  Editor 2 uses a curved path of shapes; compact Size B centers each figure in
  a shared 230 × 130 px frame. The transparent PNGs live in
  `../assets/modes/symbols-v2/*-transparent-v1.png`; the original opaque PNGs and
  previous `*-gray-a-v1.png` set remain available for restoration. The shared
  `mode-art.js` SVG filters adjust neutral ink for light/dark backgrounds while
  preserving blue/pink signal pixels. Figure containers have no white backing.

Reserve blue for RPE and pink for SPE. Supporting graphics, including Decoding's
raw signals, filter, feature matrix, model icon and causal feature window, use
subdued warm gray through `--nv-support` and `--nv-support-soft` in both themes.
Brand accents and keyboard focus indicators are neutral so the prediction-error
colors remain the visual emphasis.

The upper **Demo** link uses the same style as the other navigation items and
opens `demo.html`, including when returning from a workspace mode. The cards
open `/?mode=editor`, `/?mode=recording`, `/?mode=play`, or `/?mode=presentation`.
**Open workspace** resumes the last applied mode stored by `demo-navigation.js`,
defaulting to Trial Editor when no valid preference is available. No workspace
controllers load on the Introduction page. The live workspace shares this visual
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
MathML number nodes so slider changes preserve the typesetting.
Font provenance and licensing are in `../fonts/latin-modern-math/`.

The shared formulation uses `g_t^(AI|H)` for the human-expected AI goal,
`R^H` for the human reward function evaluating AI goal compatibility, and
`r_(t+1)^AI` for the observed reward the AI achieved in the team.
`r_(t+1)^(AI|H)` denotes the reward expected by the human, computed using `R^H`
on the transition and human-expected goal. All three Theory tabs
use the achieved-reward symbol for their observed reward outputs,
along with `T`, the accepted-action set, accepted next-state representations,
and the feature mapping `φ`. The single-agent case uses an absent human action
and a fixed prescribed trajectory; its distance and directed-edge criteria are
unchanged. Collaboration can admit multiple accepted actions and subsequent
human preference revisions, evaluated against expectations held before each action.

General Framework uses continuous errors: `RPE_t = r_(t+1)^AI - r_(t+1)^(AI|H)`,
and SPE is the minimum execution distance to an accepted next-state
representation. The RPE card puts this equation first, then explains both
reward symbols inline, then gives the expected-reward computation
`r_(t+1)^(AI|H) = R^H(s_t, a_t^H, a_t^AI, s_(t+1); g_t^(AI|H))`.
The human reward function uses `R^H` throughout all three tabs and the shared
reference. The SPE card likewise places its error equation first, then explains
the observed features and accepted set, followed by the accepted-set definition.
Both supporting definitions use the explanatory text's muted grey. The binary
legend is omitted from both cards. The two example
tabs retain their existing binary behavioral annotations and interactive scoring.
Single-Agent Setting uses the same card layout: the main error formula follows
the heading, with explanations and inline definitions underneath in muted grey.

General Framework's opening diagram preserves the context, observed contribution,
and two check descriptions in a parallel layout. Both inputs feed both checks
through native SVG connectors with filled arrowheads that rotate with each curve's
final direction. The connectors follow card positions on resize and when the
tab is revealed; narrow screens stack the checks.
This diagram does not change the equations or computed labels.

Collaborative Environments opens with the approved teamwork timeline in
`collaborative-diagram.css` and `collaborative-diagram.js`. Human plans retain
the Goal/Action split; the smaller AI view uses simple plan labels. Both agents'
actions feed one shared state along a straight centerline. Native MathML labels
show the initial and observed states, actions, human-expected AI goal and accepted
AI action set, plus the transition model. Components without an agreed symbol
remain text labels; no additional goal or team-expectation symbols are introduced.
RPE and SPE remain on the human side, linked to the expected AI plan and observed
shared state. These diagram cards show their names and task/action labels only;
their computation equations appear exclusively in the formula cards below.
Connectors redraw when the tab appears or the container resizes, and the figure
reflows vertically on narrow screens while retaining its aligned action arrows.
The horizontal timeline is labeled “Time” and sits below the diagram and above
the legend at every screen size.
Below it, a short caption introduces the shared transition, followed by concise
RPE and SPE cards with the error equation first and the supporting definition
underneath. They use the same signed reward difference and continuous execution
distance as General Framework. Overcooked context and the interactive handoff
example come last; only that example uses binary mismatch flags in this tab.

General Framework includes an open **Shared notation** table with Symbol and
Meaning columns. The other two tabs have a **Shared notation** button opening
one native modal dialog with an identical copy of that reference. Close, Escape,
and backdrop click dismiss
the dialog and return focus to its triggering button. The dialog retains the
current tab and interactive example state. Equations use native MathML with
paired scripts, spoken equation labels, and explicit wrap boundaries.

Accepted actions are specified directly, without a policy-probability support
rule. Scalar goal reward and execution-relevant state features have separate
roles. Keep these explanations consistent across the Theory tabs and the
downloadable LaTeX. This conceptual summary does not change the classifier,
trial JSON, review checks, or computed step labels.

## Content sources

- Xu, X., and Lee, S. W., *Decoding Human Prediction Errors for Human-Robot
  Value Alignment*, 2024 12th International Winter Conference on Brain-Computer
  Interface (BCI), pp. 1–5. Cited in the Decoding page's Reference section.
  <https://doi.org/10.1109/BCI60775.2024.10480520>
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

The title, brain-reading subtitle, and TL;DR introduce internal mismatches that
can be difficult to express in words or infer from behavior. The approved,
gender-neutral human/robot illustration uses the same gray line-art style as
the four Demo mode images. Its tangled speech bubble conveys difficulty putting
a feeling into words. Blue and pink responses inside the brain feed one black
signal stream, which the decoder separates into the two mismatch estimates.
Only “Goal mismatch” and “Action mismatch” appear as text in the artwork.
`overview.css` crops outer whitespace on desktop and stacks the scene and
decoding route on mobile to keep the labels readable. The diagram and
interactive panel are 800 px wide at most; the TL;DR is 730 px wide at most.
The existing light/dark switch also styles the illustration.

The **Find the mismatch** panel combines each agent’s goal-defined rewards and
trajectory states into its value function. `value-landscapes.css`,
`value-landscapes.js`, and `value-landscapes-model.mjs` load only on Overview.
AI trajectories are black and human trajectories light grey; dark mode adjusts
their contrast. Human goal/state centers are circles; AI centers are squares.
Both agents use a solid current-to-next transition and a dashed
possible continuation. Agent selection remains available when points overlap.

- Drag a goal or next-state point freely in two dimensions. Both use the full
  visible plot range with the same marker-sized edge margin; goals are not
  restricted to the central unit square. A next state snaps
  to the other agent’s next state when close; Shift disables snapping.
- Click either goal or the human next-state point, or select its tolerance tab,
  to edit width, height, and rotation. Goal tolerance is blue (RPE); human
  next-step tolerance is pink (SPE). Both use a single gradient from center to
  edge. The AI-observed next state is a single draggable square with no
  distribution or tolerance controls.
- Outlines and shape handles appear only during editing. Moving a point,
  Escape, or clicking the empty plot hides them. The gradients stay visible.
- Both plot axes use the same pixels per state unit. Shape controls specify
  ellipse radii on those axes, so equal width/height values form a circle and
  the same radius has the same size for goal and state tolerance. Values use
  three decimal places and a 0.005 adjustment step; either radius can reach 0.
  A collapsed axis represents exact tolerance and can be expanded again with
  its handles, keyboard, or slider. One zero radius is shown as a line; two
  zero radii leave the center point. A collapsed goal keeps its continuation
  directed toward the goal center, with no projection onto the remaining
  tolerance axis. With zero later curve it is a straight center-to-center path;
  a nonzero curve rotates the displacement about the goal center as it shrinks.
  Off-axis zero-tolerance deviations have infinite
  normalized error; SPE shows ∞. When both quadratic returns diverge, RPE
  shows — with an undefined-comparison explanation. Expanding the goal
  radii restores a finite comparison.
- Arrow keys move points by 0.01 (Shift: 0.05), resize by 0.005 (Shift: 0.02), or
  rotate by 1° (Shift: 10°). Touch users get the same labeled shape sliders.
- The later-curve control bends the possible continuation without constraining
  the freely placed next state. Each continuation converges to its own goal.
- **Aligned**, **Goal differs**, and **Action differs** sit below the plot as
  separate buttons and restore example configurations. Each initial trajectory
  spans at least 40% of the interactive panel's width, with equal axis scales.
  Goal differs keeps the expected and observed next states aligned.
  Snapping those points together does not add a footer caption or change the
  panel height, so dragging at the bottom of the page keeps the plot steady.

The browser-local illustration uses a rotated quadratic continuation value U,
a discount of 0.9, and a continuation contraction of 0.65 in goal-normalized
coordinates. The first transition is free. RPE compares the AI trajectory's
discounted return with the human-expected trajectory's discounted return:
AI return minus expected return, both scored with the human reward function.
This is a trajectory-return prediction error, including the future continuation,
rather than a one-step TD error. A negative value means a lower return than
expected; a positive value means a higher return. Each return includes the
current-state reward and 80 reward samples beginning at the free next state;
the remaining discounted tail uses the reward at that agent's destination.
Thus settling at an AI goal that the human values poorly continues to carry
that human reward. The plotted path shows the early continuation and its goal.
SPE is the distance from
the human-expected state to the AI-observed state, normalized by the human
next-step tolerance. Rotate that displacement into the human ellipse's axes,
divide by the corresponding tolerance radii, and take the Euclidean norm.
The Theory General Framework also permits continuous errors; its GridWorld and
Overcooked examples retain binary behavioral labels. The Overview illustration
uses a trajectory-return comparison, while the General Framework equation
shows a reward comparison for one observed transition.

The rotated human next-step ellipse is an acceptance region, not a probability
distribution. SPE is 0 at its center, 1 on its boundary, below 1 inside, and
above 1 outside. Resizing or rotating it changes SPE and the within/outside
status without changing RPE. AI has no next-step tolerance. Human goal shape
changes valuation; AI goal and shape affect RPE through the AI continuation,
not through AI rewards. Different future goals can produce nonzero RPE while
identical next states keep SPE at zero. The panel keeps live values and short interpretations without displaying
formulas or worked calculations. It makes no API requests and cannot change
experiment state or estimate neural activity.

Validate the numerical model with `node --test live_demo/tests/test_value_landscapes.mjs`.
Browser checks are in `live_demo/tests/check_value_landscapes.cjs`.

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

Each executed transition updates the RPE and SPE readouts beneath the grid
using the binary indicators in NVA §IV-B:

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

Both trajectories are solid: human expectation is light grey (#AFB4BC), and
AI observation is black (#111111), matching Overview with adjusted contrast
in dark mode. Blue and pink identify RPE and SPE only. Cells are square
and state/goal markers and route turns share cell centers. Dedicated
`nva-navigation.css`, `nva-navigation.js`, and `nva-navigation-model.mjs` contain
the example; no experiment session, classifier or EEG data is used.

Validate the model with `node --test live_demo/tests/test_nva_navigation.mjs`.
Browser interaction checks are in `live_demo/tests/check_nva_navigation.cjs`.
