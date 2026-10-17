# GitHub Pages and the local research application

The public site replays frozen game actions, recorded EEG and existing saved
prediction traces. It performs **no inference, recording or shared editing**.
The public Live demo offers Introduction and Presentation only. Presentation uses
the same renderer and source timelines as the local application. Its prediction highlights refer to saved analysis,
not predictions recomputed in the visitor's browser. The local Python app keeps
its existing causal inference and research workflows.

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
10 trials in “Selected presentation trials”). Presentation uses this selection.
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
anything or change repository settings. Rebuild and republish when the frozen
demo data or website changes; a source-only GitHub build lacks the ignored data.
GitHub Pages supports public repositories on GitHub Free; verify the repository's
visibility and plan before enabling it. See the [Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

The original `Sarah-Xu-08/nva-live-demo` research repository stays private. Its
current plan does not support Pages from that private repository, so only the
generated website is published separately. Source ZIP and native-installation
links require access to the research repository; the public website does not
grant that access.

The public UI offers Introduction and Presentation, with a Run locally link.
Historical Playing/editor/recording URL parameters fall back to Presentation.
Keyboard-only assets and connections are not included. The replay transport
rejects all edits and live-session requests. Personal trial creation in the
browser is deferred; it must never overwrite the published library.

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
