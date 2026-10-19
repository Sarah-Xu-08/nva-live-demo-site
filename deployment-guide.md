# GitHub Pages and the local research application

The public site replays frozen game actions, recorded EEG and existing saved
prediction traces. It performs **no inference, recording or shared editing**.
The public Live demo offers Introduction and Presentation only. Presentation uses
the same renderer and source timelines as the local application. Its prediction highlights refer to saved analysis,
not predictions recomputed in the visitor's browser. The local Python app keeps
its existing causal inference and research workflows.

## Required redeployment constraints

Read and follow this section before building, publishing, or redeploying the
public website, as required by the root `AGENTS.md`. These are the user's agreed
publication rules; later explicit user instructions take precedence. The trial
count below describes the current selection, not a permanently fixed limit.

1. **Deploy only when the user asks.** Do not add automatic folder syncing,
   file watchers, scheduled publication, or automatic publication from research
   source changes. Use the current local `live_demo` as the source of requested
   updates. For a specific fix, publish only that fix and its necessary assets;
   do not include unrelated local work. Building or editing documentation alone
   does not authorize publication. GitHub Pages may build the publishing branch
   after an explicitly requested push.

2. **Keep the public deployment on GitHub Pages.** Publish only the generated
   static website to `Sarah-Xu-08/nva-live-demo-site`, branch
   `codex/github-pages`, at `https://sarah-xu-08.github.io/nva-live-demo-site/`.
   Keep the project pages available. The original research repository remains
   private; do not publish its full source, runtime-data folders, model weights,
   or raw recording files as part of a website deployment.

3. **Only Introduction and Presentation are available inside public Live Demo.**
   Keep all four mode cards and their appearance in Introduction. Presentation
   opens online replay; Trial Editor, Recording, and Playing link to Run Locally.
   Historical editor/recording/Playing URL parameters fall back to Presentation.
   Keyboard only, the lab GPU/server AI connection, and their assets remain
   outside the public deployment for now.

4. **Keep Run Locally out of every shared top menu.** The top menu contains
   Overview, Theory, Experiment, Decoding, and Demo. Keep the Run Locally guide
   accessible within Demo content through the three local-mode cards and the
   Presentation description link.

5. **Publish only recordings saved in Presentation.** The current selection is
   16 recordings in "Selected presentation trials". Derive the selection from
   the saved Presentation sets, not a hard-coded count, suggested set, or full
   catalogue. Preserve their saved game actions, original signal values and
   timestamps, and saved prediction results. Include no unrelated recordings or
   editor trial library. Stop if the saved selection is empty or unavailable;
   do not silently substitute other trials. A rebuild must remove data for
   recordings no longer selected.

6. **The online experience is read-only prerecorded replay.** Clearly label it
   as recorded/saved data. Do not enable EEG recording, real-time decoding,
   model inference, trial editing, or other live-session/backend requests.
   Visitors must not modify the published trial library. Personal trial creation
   is deferred. Live research capabilities belong to the locally run application
   described by Run Locally; preserve those local capabilities.

7. **Preserve the public Presentation panel customizations.** Hide Participant
   and load the saved selection automatically. Presentation replaces the set
   dropdown with **PE trial type**, offering SPE and RPE (the saved RPE+SPE
   condition), in both local and published replay. Filter Picked recording and
   Previous/Next within that saved selection; retain all entries in the editor.
   Use the latest local custom recording names from
   `static/data/recording-names.json` for Picked Recording, preserving their
   recording associations instead of reverting to old catalogue/default names.
   Keep the selector wide enough to show the full current trial names, with a
   responsive full-width layout on narrow screens. Maintain these changes in
   the export source as well as the published output so later builds retain them.

8. **Keep visitor statistics private.** Use the existing GoatCounter site,
   `https://nva-live-demo.goatcounter.com/`, with its dashboard restricted to
   authorized users. Do not add a public visitor map, counter, statistics
   endpoint, or API token to the website. Keep analytics off local previews.
   Exclude automated browser verification from counts by blocking analytics
   requests. The owner's exclusion is per browser/profile/device via
   GoatCounter's `skipgc` preference; do not claim universal owner exclusion or
   exclude a shared lab IP. See the instructions below.

9. **Verify before reporting a successful redeployment.** Before publishing,
   inspect the changed files and exported trial selection for unintended content.
   Run relevant existing checks, including public-export tests when changing
   export/data behavior, and inspect affected UI and links in the browser.
   Check the public mode restrictions, Run Locally routing, hidden selectors,
   recording names and widths, and replay behavior as applicable. Preserve
   asset versioning so updated scripts, styles, and names are not masked by old
   cached assets. After publishing, wait for a successful GitHub Pages deployment
   and verify the actual live pages with fresh URLs and analytics blocked.
   Report completion only after these checks; disclose any remaining limitation.

## Build and inspect the public site

Use the existing `nva-live` environment, with the local recordings and reviewed
analysis archives available at their catalogue-pinned paths:

```sh
conda activate nva-live
python -m live_demo.export_public
python -m http.server 65028 --bind 127.0.0.1 --directory build
```

Open `http://127.0.0.1:65028/github-pages/`. Testing under this subpath verifies
the relative links needed by a GitHub project site. The exporter fails if saved
recordings, models used for provenance validation, prediction archives or saved
presentation identities are missing/incompatible. It never trains or decodes.
Only recordings referenced by saved Presentation sets are included (currently
16 trials in “Selected presentation trials”). Presentation uses this selection.
Other recordings' signals, predictions and catalogue entries,
and the local editor's trial library, are omitted. If multiple sets are saved,
their combined selection is exported once per recording. A missing or empty set
stops the export; it never falls back to suggested trials or the full catalogue.
Save changes in the local Presentation editor and rebuild to update the public
selection. Rebuilding replaces the generated directory, removing old trial data.
Original trials and inputs are not modified. Generated output is ignored by Git.

The standalone `build/github-pages/` directory contains only HTML/CSS/JavaScript,
assets and per-trial JSON. Signals preserve original values and source times;
missing samples and invalid predictions remain missing. Exported data is public
to anyone who can visit the site. Source hashes identify the frozen recordings,
annotations, models and reviewed archives. The full runtime-data directory,
model weights and raw recording files are not copied.

For publication, publish the **contents** of that generated directory to the
separate public `Sarah-Xu-08/nva-live-demo-site` repository, on its
`codex/github-pages` branch, and select that branch's root in GitHub repository
Settings → Pages → Deploy from a branch. The publishing branch should contain
only the generated site. The expected project address is
`https://sarah-xu-08.github.io/nva-live-demo-site/`. Building locally does not publish
anything or change repository settings. When the user requests publication of
changed frozen demo data or website content, rebuild and republish within that
scope; a source-only GitHub build lacks the ignored data.
GitHub Pages supports public repositories on GitHub Free; verify the repository's
visibility and plan before enabling it. See the [Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

The original `Sarah-Xu-08/nva-live-demo` research repository stays private. Its
current plan does not support Pages from that private repository, so only the
generated website is published separately. Source ZIP and native-installation
links require access to the research repository; the public website does not
grant that access.

## Private visitor statistics

The public export includes GoatCounter page-visit analytics for
`https://nva-live-demo.goatcounter.com/`. Keep that dashboard restricted to
logged-in users and leave public visitor counters disabled. There is no public
map, counter, API token or statistics endpoint in this website.

`public/private-analytics.js` loads GoatCounter only on
`sarah-xu-08.github.io/nva-live-demo-site/`. Local research pages are not modified,
and local export previews do not load the analytics service. Each content page
is counted; the root redirect is skipped to avoid counting the same arrival
twice. Page query strings and trial interactions are not collected as page
identities or custom events. Country estimates use GoatCounter's normal visitor
analytics. Collection starts only after this export is published.

To exclude your browser, open the published Overview with
`#toggle-goatcounter` appended and check that the popup says tracking is disabled.
Do this once per browser/profile/device; opening the toggle again re-enables
tracking. Clearing site storage removes the exclusion. This uses GoatCounter's
`skipgc` local-storage preference; avoid excluding a shared lab IP, which would
also remove other visitors using that IP. See the
[official exclusion instructions](https://www.goatcounter.com/help/skip-dev).

Statistics update within GoatCounter without rebuilding this website. Deployment
remains manual; analytics does not synchronize the local folder or publish edits.

## Build and run Docker locally

Install Docker, then from the repository root:

```sh
docker build -t nva-live-demo .
docker run --rm -p 127.0.0.1:65008:65008 \
  -v nva-recordings:/app/live_demo/runtime_data \
  -v nva-trials:/app/live_demo/trials \
  -v nva-trial-history:/app/live_demo/trial_history \
  nva-live-demo
```

Visit `http://127.0.0.1:65008`. Named volumes preserve recordings, presentation
sets, trial edits and revision backups. A newly created trial volume is seeded
from the image. Existing volumes retain their older trials after an image
upgrade; back up and migrate them explicitly. The image includes Python,
Node.js for trial validation, Gunicorn and liblsl v1.17.7 built for the image's
architecture. It uses one threaded worker because sessions are process-local.

The container's default app is the full local research application, with editing
and acquisition enabled and no public access-control layer. The localhost port
binding above keeps that workflow local. Research recordings and trained models
are excluded from the image. To use your existing data, replace the runtime
named-volume mount with a bind mount, for example:

```sh
docker run --rm -p 127.0.0.1:65008:65008 \
  --mount type=bind,source="$PWD/live_demo/runtime_data",target=/app/live_demo/runtime_data \
  -v nva-trials:/app/live_demo/trials \
  -v nva-trial-history:/app/live_demo/trial_history \
  nva-live-demo
```

The catalogue pins exact recording/model identities. A source-only download will
report prerecorded Playing unavailable until compatible data is supplied. Trial
Editor and mock recording do not require those participant recordings.

## EEG hardware and custom models

Native Python installation on the acquisition computer remains supported; see
the root README. Start the EEG device's LSL outlet, then select it in the app.
Validate channel labels, sample rate, marker delivery and timing before research
use. Current Playing expects its documented 14 channels at 128 Hz.

Docker's default bridge does not automatically expose the host's LSL discovery.
On Linux, `--network host` can share the acquisition network; omit `-p` and bind
Gunicorn to `127.0.0.1:65008` in the command override when only local browser
access is needed. Docker Desktop host networking is optional and has platform
limitations; it is not a promise of LSL multicast/device compatibility. Prefer
native installation on macOS/Windows until the device's network path is tested.
See [Docker host networking](https://docs.docker.com/engine/network/drivers/host/)
and [LSL networking](https://labstreaminglayer.readthedocs.io/info/network-connectivity.html).

Custom decoder manifests can be mounted in a directory selected with
`LIVE_DEMO_DECODER_DIR`. Match the adapter's channels, preprocessing, sampling
rate, tensor shapes and output labels. The current Playing pipeline separately
uses the catalogue's causal model bundles; changing its architecture requires a
compatible adapter. Arbitrary weights cannot simply be uploaded to the public
site or assumed to work with either interface. Refer to the decoder setup in
`README.md`, `eeg/registry.py` and `analysis/xx_record_causal.py`.
