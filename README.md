# Stream Starting Soon - Planetary Display

This page renders a looping 3D solar-system style animation for a "starting soon" scene.

> **Production work in progress:** a local no-code editor MVP is available at
> [editor.html](editor.html), alongside contributor checks and preview packaging.
> Browser/OBS usability qualification, public deployment and a qualified installer remain pending. Scene tuning is preserved; openly licensed fonts/textures replace
> the original restricted assets. Typography and Earth/Moon appearance intentionally differ.
> See [the production roadmap](docs/PRODUCTION_ROADMAP.md),
> [baseline qualification record](docs/BASELINE.md), and [asset attribution audit](ATTRIBUTIONS.md).
> The current asset inventory has no unresolved rights; browser/OBS qualification remains pending.
> Keep the texture credit, license link and conversion notice with public streams/videos.
>
> **Credential safety:** never publish an OBS password in `config.js`. The committed value is
> blank; preview builds must reject a nonblank value. A separate credential/setup path is planned.

It also includes:
- a dedicated "Be Right Back" black-hole scene with an event horizon
- a dedicated "Thank You For Watching" Earth + Moon ending scene

Project creation note: this project was created in OpenCode 1.2.10 (CLI) via Vibe Coding using GPT-5.3 Codex (high/xhigh).

Live demonstration channel: `https://www.twitch.tv/decipher1429`

Additional video demo: `https://www.twitch.tv/videos/2711092069`

It includes:
- Animated planets and orbital paths
- Dynamic sun glow and solar-cycle sunspot activity
- Dedicated BRB black-hole scene with event horizon and accretion disk
- BRB BlackHole replacement overlay (transparent canvas) with optional fixed camera
- Dedicated "Thank You For Watching" (TY4W) Earth scene with dynamic atmosphere, moving clouds, Northern Lights, and an orbiting moon
- Live OBS scene demonstrations on Twitch: `https://www.twitch.tv/decipher1429`
- Additional recorded project demo on Twitch: `https://www.twitch.tv/videos/2711092069`
- A top text overlay (title + subtitle)
- Live local date/time with timezone in all scenes
- Automatic asset loading (local file first, then CDN fallback)

## Contributor checks and preview packaging

Node.js 22+ is required **only for contributor tooling**, not hosted scene playback.
There are no runtime npm dependencies. Browser regression uses pinned
contributor-only Playwright/image-comparison devDependencies.

```bash
npm ci
npm run check
npm run baseline:verify
npm run assets:check
npm test
npm run build
```

`npm run package` creates a reproducible **local preview** archive using GNU tar (Linux/CI).
It is not an installer. `npm run release:check` verifies static redistribution eligibility
and currently passes for the replacement asset set. CI uploads previews only when that gate
passes; there is no production deployment or browser/OBS certification.
See [CONTRIBUTING.md](CONTRIBUTING.md) for commands, safeguards, and limitations.

## P3 candidate release layout (in progress)

P2 is saved locally as `1d28784` after user-reported editor/OBS acceptance.
`npm run build:site` creates a content-addressed candidate under `site/releases/`;
`npm run site:verify` checks every retained namespace and current compatibility
alias. The versioned editor generates pinned scene links. Earlier namespaces are
not overwritten by later builds, and `site:select` can change the current candidate.

This does **not** publish or qualify a release. A clean CI artifact has no previous
deployment history: retain/restore old namespaces before a real deployment.
`npm run clean` deliberately keeps `site/`. See [P3_RELEASE.md](docs/P3_RELEASE.md)
for commands, retention/rollback limitations and remaining P3 gates. P4 remains the
supported local/offline launcher phase.

`npm run test:browser` now exercises the editor and compares scene frames with
accepted P2 in a real browser. Browser install, evidence and scope limits are in
[P3_BROWSER.md](docs/P3_BROWSER.md). These are not OBS/GPU soak results.

Cloudflare Pages is the selected hosting target. `npm run build:cloudflare` prepares
`cf-dist/` with retained release namespaces, cache rules and a non-SPA 404 page;
`npm run cloudflare:verify` checks it. No upload/account access is performed.
See [P3_CLOUDFLARE.md](docs/P3_CLOUDFLARE.md) before any deployment—fresh CI artifacts
must not overwrite deployed history.

## No-code editor (P2 candidate)

Open [editor.html](editor.html) on the same static server, for example
`http://127.0.0.1:8080/editor.html`. Edit all three scenes, preview, then copy the
three personalized URLs into OBS at 1920×1080. Drafts autosave locally; copied URLs
are independent snapshots and must be copied again after edits.

Bundled fonts only. JSON import/export and reduced motion are supported.
**New drafts default to Auto — local only:** local HTTP(S) copies connect to OBS
on port 4455 without a password when authentication is off. If authentication is
on, enter the password separately using **OBS → Browser Source → Interact**.
Hosted copies and the embedded preview stay silent. Choose **Off** or **Manual
local setup** for a custom port/input names. Credentials are session-only, never
saved in links/presets; refresh clears them. Older drafts/links remain Off until
you select Auto and copy fresh links. Configure before going live; use
**Ctrl+Alt+A** (Command+Option+A on macOS) inside Interact to reopen setup.
Legacy scene URLs keep their existing local audio behavior.
Never put passwords or private information in overlay text.
See [P2 format, limits and qualification status](docs/P2_EDITOR.md).

## P1 quality and recovery

Existing URLs use **tuned** quality by default, preserving the current settings.
Optionally append `&quality=low`, `&quality=medium` or `&quality=high` to a scene
URL (use `?` instead of `&` if it has no query yet):

```text
http://127.0.0.1:8080/?assets=offline&quality=low
http://127.0.0.1:8080/brb.html?assets=offline&quality=medium
http://127.0.0.1:8080/thanks.html?assets=offline&quality=tuned
```

Profiles cap pixel ratio, fabric segments and star density; they do not guarantee
a particular FPS. An optional `quality` string in config.js supplies the default;
the URL overrides it. Malformed known settings fall back to scene defaults, with
fixed warning codes available in `window.STREAM_CONFIG_WARNINGS`. Config remains
trusted JavaScript, not a safe untrusted-preset import format.

Context loss pauses rendering; restoration reloads the same URL to rebuild.
Failed textures retain procedural fallbacks and show a diagnostic. A script load
taking longer than 15 seconds requires refresh rather than unsafe competing loads.
See [P1 implementation and qualification status](docs/P1_RUNTIME.md).
The user accepted all six P1 slices after an OBS visual/audio recheck; full
production qualification and the deferred soak/transition checks remain outstanding.

## Files

- `config.js` - runtime settings (assets, overlay text, custom fonts; never publish credentials)
- `docs/source-baseline.json` - current source-byte hashes; historical P0 and pre-P1 hashes in `docs/source-baseline-p0.json` and `docs/source-baseline-assets.json`
- `docs/asset-inventory.json` - third-party asset hashes, rights evidence, and release blockers
- `ATTRIBUTIONS.md`, `credits.html`, `docs/licenses/` - third-party credits and bundled license terms
- `cinzel-decorative.ttf`, `macondo.ttf` - local OFL fonts (no external font service required)
- `index.html`, `brb.html`, `thanks.html` - scene shells with fixed bootstrap scene identifiers
- `runtime/boot.js` - shared scene routing and asset bootstrap ([P1 slice details](docs/P1_RUNTIME.md))
- `runtime/overlay.js` - shared typography and local date/time ticker
- `runtime/audio.js` - shared OBS WebSocket audio controller and meter processing
- `runtime/audio-session.js` - local-only, memory-only OBS Interact setup for new links
- `runtime/settings.js` - trusted-JS config checks and opt-in quality profiles
- `runtime/recovery.js` - lifecycle scopes, graphics/asset recovery and safe diagnostics
- `styles.css` - visual styling and overlay layout
- `brb.css` - BRB visual styling and overlay layout
- `thanks.css` - "Thank You For Watching" visual styling and overlay layout
- `main.js` - 3D scene logic and animation
- `brb.js` - BRB black-hole scene logic and animation
- `thanks.js` - "Thank You For Watching" Earth + Moon scene logic and animation
- `brb-blackhole/blackholeOverlay.module.js` - BlackHole demo overlay renderer for BRB scene
- `TY4Watching.md` - TY4W implementation plan
- `textures/planets/` - local Earth/Moon texture assets used by TY4W
- `vendor/three.min.js` - local classic Three.js dependency for starting/TY4W offline mode
- `vendor/three-0.181.0/` - local ESM Three.js modules used by the BRB overlay in offline/auto mode

## How to use

### Option 1: Open directly

Open `index.html` in a browser.

### Option 2 (recommended): Run a local web server

From the project folder, start a static server:

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080/
```

For BRB directly:

```text
http://localhost:8080/brb.html
```

For TY4W directly:

```text
http://localhost:8080/thanks.html
```

Use scene switching with one URL pattern:

```text
http://localhost:8080/?scene=starting
http://localhost:8080/?scene=brb
http://localhost:8080/?scene=thanks
```

## Asset modes

Asset mode can be set in `config.js` (`STREAM_CONFIG.assets.mode`) or by URL query.

- `config.js` default mode is used first
- `?assets=...` in the URL overrides `config.js`

Available modes:

- `?assets=auto` (default) - try local `vendor/three.min.js`, fallback to CDN
- `?assets=offline` - local only (BRB also requires `vendor/three-0.181.0/` for the overlay)
- `?assets=cdn` - CDN only

Notes:

- Treat `config.js` as the live tuned preset for this project.
- The README examples show supported settings and representative values; your local `config.js` can intentionally differ.

Examples:

```text
http://localhost:8080/?assets=auto
http://localhost:8080/?assets=offline
http://localhost:8080/?assets=cdn
```

## Using in OBS (Browser Source)

1. Start a local server (recommended) and copy the URL.
2. In OBS, add a **Browser Source**.
3. Set URL to your page (for example `http://localhost:8080/?assets=offline`).
4. Set width/height to your stream resolution (for example `1920x1080`).
5. If needed, use **Refresh browser when scene becomes active**.

Examples for scene switching in OBS:

```text
http://localhost:8080/?scene=starting&assets=offline
http://localhost:8080/?scene=brb&assets=offline
http://localhost:8080/?scene=thanks&assets=offline
```

## Basic customization

Edit `config.js`:

- Asset behavior: `STREAM_CONFIG.assets.mode`
- Audio reactivity: `STREAM_CONFIG.audioReactive.*`
- Overlay text: `STREAM_CONFIG.overlay.title`, `STREAM_CONFIG.overlay.subtitle`
- BRB overlay text (optional): `STREAM_CONFIG.overlayBRB.title`, `STREAM_CONFIG.overlayBRB.subtitle`
- TY4W overlay text (optional): `STREAM_CONFIG.overlayThanks.title`, `STREAM_CONFIG.overlayThanks.subtitle`
- BRB overlay position: `STREAM_CONFIG.overlayBRB.overlayTop`, `STREAM_CONFIG.overlayBRB.overlayTopMobile`
- TY4W overlay position: `STREAM_CONFIG.overlayThanks.overlayTop`, `STREAM_CONFIG.overlayThanks.overlayTopMobile`
- Overlay fonts: `STREAM_CONFIG.overlay.titleFontFamily`, `STREAM_CONFIG.overlay.subtitleFontFamily`
- TY4W fonts: `STREAM_CONFIG.overlayThanks.titleFontFamily`, `STREAM_CONFIG.overlayThanks.subtitleFontFamily`
- Overlay font style: `titleFontWeight`, `subtitleFontWeight`, `titleTextTransform`, `subtitleTextTransform`
- Overlay position: `overlayTop`, `overlayTopMobile`, `titleOffsetX`, `titleOffsetY`, `subtitleOffsetX`, `subtitleOffsetY`
- Overlay kerning: `titleKerning`, `subtitleKerning`
- TY4W scene tuning: `STREAM_CONFIG.thanksScene.*`
- BRB BlackHole replacement: `STREAM_CONFIG.brbBlackholeReplacement.*`

## BRB BlackHole replacement (overlay mode)

The BRB scene keeps the original time-fabric/audio-reactive mesh in `brb.js`, while the black hole itself is rendered by `brb-blackhole/blackholeOverlay.module.js` on a transparent overlay canvas.

Default config in `config.js`:

```js
window.STREAM_CONFIG = {
  brbBlackholeReplacement: {
    enabled: true,
    pointerEvents: "auto",
    mouseControlEnabled: false,
    cameraPosition: { x: 0, y: 1.5, z: 22 },
    cameraTarget: { x: 0, y: 0, z: 0 },
    sizeScale: 0.5,
    useBloom: false,
    fabricWellScale: 0.5,
    fabricWellDepthScale: 1
  }
};
```

Notes:
- Set `mouseControlEnabled: false` to lock the black-hole shot (recommended for OBS).
- Set `mouseControlEnabled: true` to re-enable OrbitControls (mouse rotate/zoom).
- `cameraPosition` and `cameraTarget` control the fixed framing.
- `sizeScale` scales the overlay canvas visual size.
- `fabricWellScale` and `fabricWellDepthScale` tune how the audio-reactive fabric well matches the replacement black hole.

Edit `main.js` only for simulation/visual behavior:

- Simulation speed: `CONFIG.simulation.daysPerSecond`
- Sun cycle behavior: `CONFIG.sun.cycleSeconds`, `minActiveRegions`, `maxActiveRegions`, `startLatitude`, `endLatitude`

## BRB physics model notes

The BRB black-hole scene in `brb.js` is tuned to NASA GSFC visualization behavior (Jeremy Schnittman):

- Nearly edge-on accretion disk view
- Bright/dim asymmetry from relativistic Doppler beaming
- Photon ring + shadow relationship for a non-rotating (Schwarzschild) black hole

The shader uses physically inspired terms:

```text
beta = sqrt(Rs / (2r))
gamma = 1 / sqrt(1 - beta^2)
Doppler factor D = 1 / (gamma * (1 - beta * cos(theta)))
Gravitational shift g_gr = sqrt(1 - Rs / r)
Observed intensity ~ (g_gr * D)^3
```

Reference documentation:
- NASA SVS black hole accretion disk visualization: `https://svs.gsfc.nasa.gov/13326`
- NASA Black Hole Visualization (2024): `https://svs.gsfc.nasa.gov/14576/`

## Custom title/subtitle fonts

Configure fonts in `config.js` under `STREAM_CONFIG.overlay`:

```js
window.STREAM_CONFIG = {
  assets: {
    mode: "auto"
  },
  overlay: {
    title: "MY CUSTOM TITLE",
    subtitle: "Subtitle with custom typography",
    titleFontFamily: "'Cinzel Decorative', serif",
    subtitleFontFamily: "'Orbitron', sans-serif",
    titleFontWeight: 400,
    subtitleFontWeight: 400,
    titleTextTransform: "uppercase",
    subtitleTextTransform: "none",
    externalFontStylesheets: [
      "https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&display=swap"
    ],
    customFontFaces: [
      {
        family: "Cinzel Decorative",
        src: "@cinzel-decorative.ttf",
        weight: "400",
        style: "normal",
        display: "swap"
      }
    ]
  }
};
```

## Title/subtitle position and kerning

You can move the title/subtitle and adjust letter spacing directly in `config.js`:

```js
window.STREAM_CONFIG = {
  overlay: {
    overlayTop: "48px",
    overlayTopMobile: 22,
    titleOffsetX: 0,
    titleOffsetY: 6,
    subtitleOffsetX: 0,
    subtitleOffsetY: 10,
    titleKerning: 0.14,
    subtitleKerning: "0.05em"
  }
};
```

Value rules:
- For `overlayTop`, offsets, and kerning, you can use CSS strings (`"12px"`, `"1.2em"`, `"6vh"`) or numbers.
- Number offsets/top values are treated as `px`.
- Number kerning values are treated as `em`.
- Font weight accepts number or string (`400`, `700`, `"bold"`).
- Text transform accepts CSS values (`"uppercase"`, `"none"`, `"lowercase"`).

## Audio reactive fabric (OBS desktop audio)

The fabric can react to your currently playing PC audio through OBS WebSocket volume meters.

### 1) Enable OBS WebSocket

In OBS:
- Open **Tools -> WebSocket Server Settings**
- Enable server
- Note the server port (default `4455`)
- Set a password (optional, but recommended)

### 2) Configure `config.js`

The example below is illustrative. Your current `config.js` may use different tuned values.

```js
window.STREAM_CONFIG = {
  audioReactive: {
    enabled: true,
    provider: "obsWebSocket",
    mode: "gravityWarp",
    url: "ws://127.0.0.1:4455",
    password: "",
    targetInputs: ["Desktop Audio", "Desktop Audio 2"],
    noiseFloorDb: -58,
    gain: 1.2,
    attack: 0.5,
    release: 0.08,
    maxBoost: 0.9,
    waveInfluence: 0.6,
    speedInfluence: 1.2,
    glowInfluence: 0.3,
    waterfallFlowSpeed: 0.65,
    waterfallRowsPerSecond: 46,
    waterfallHeight: 2.2,
    waterfallTrailDecay: 0.86,
    waterfallBanding: 1.0
  }
};
```

Tuning tips:
- Use `mode: "gravityWarp"` for the fabric gravity-warp presentation.
- Set `mode: "waterfallGraph"` to switch to waterfall graph on the fabric.
- Waterfall mode now keeps the gravity wells and layers waterfall ridges on top.
- Mode matching is case-insensitive (`"waterfallGraph"`, `"waterfallgraph"`, `"waterfall"`).
- Increase `gain` for stronger response.
- Lower `noiseFloorDb` (for example `-64`) to ignore quiet noise.
- Raise `attack` for quicker peaks, lower `release` for longer decay.
- Raise `maxBoost`/`waveInfluence` if you want more dramatic fabric motion.
- Raise `speedInfluence` to make gravity-warp motion travel faster on supported scenes.
- Raise `glowInfluence` to push emissive response such as sun glow, BRB halo/light energy, and TY4W atmosphere/aurora lighting.
- `waterfallFlowSpeed` is the main speed knob (lower = slower flow).
- For waterfall mode, adjust `waterfallHeight`, `waterfallRowsPerSecond`, and `waterfallTrailDecay`.
- `waterfallTrailDecay` must be in `0..1` (higher = longer travel across the full fabric).
- Waterfall shaping is driven by OBS meter features (RMS, peak, transient, stereo balance) and propagated over time.

Notes:
- `customFontFaces[].src` accepts `@cinzel-decorative.ttf`, direct paths/URLs (`fonts/my-font.woff2`), or full CSS `url(...)` syntax. Bundle only fonts with documented embedding/redistribution rights.
- TY4W subtitle defaults to `See You Next Time` with `@macondo.ttf` (`overlayThanks.subtitleFontFamily = "'Macondo', serif"`).
- TY4W aurora is constrained to north/south polar regions and is strongest on the night side.
- TY4W supports real-world texture maps via `STREAM_CONFIG.thanksScene.useRealWorldMaps` and map URLs (`earthDayMapUrl`, `earthNightMapUrl`, `earthCloudMapUrl`, `earthWaterMaskUrl`, `moonMapUrl`).
- For faster startup, keep TY4W maps local (for example `textures/planets/*.jpg|png`) instead of remote URLs.
- Current TY4W defaults already use local texture files in `textures/planets/`.
- TY4W aurora audio response can be tuned with `thanksScene.auroraAudioInfluence`, `thanksScene.auroraTransientInfluence`, and `thanksScene.auroraBeatResponse`.
- `externalFontStylesheets` is for web-hosted font CSS (for example Google Fonts).
- Keep local font files next to `index.html` (or use relative paths).

## Troubleshooting

- If you see a boot error about assets, verify `vendor/three.min.js` exists or switch to `?assets=cdn`.
- If the page looks stale after changes, hard refresh with `Ctrl+F5`.
- If local fonts do not apply, serve over `http://localhost` instead of opening with `file://`, then refresh cache in OBS/browser.
- If audio reactivity does not respond, verify `targetInputs` names match your OBS mixer input names; if none match, the scenes log a warning and fall back to all active inputs.
- For editor links with OBS authentication enabled, enter the password in that
  source using Interact; do not put it in shared config, links or presets.
  Legacy local configurations still use their existing config.js path. Never
  commit/share real credentials. Authentication is recommended but optional.
- If using offline mode, keep the scene HTML/JS/CSS files, `brb-blackhole/`, `vendor/`, and `vendor/three-0.181.0/` together.
