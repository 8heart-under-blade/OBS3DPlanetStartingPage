# Stream Starting Soon - Planetary Display

This page renders a looping 3D solar-system style animation for a "starting soon" scene.

Project creation note: this project was created in OpenCode 1.2.10 (CLI) via Vibe Coding using GPT-5.3 Codex (high/xhigh).

It includes:
- Animated planets and orbital paths
- Dynamic sun glow and solar-cycle sunspot activity
- A top text overlay (title + subtitle)
- Automatic asset loading (local file first, then CDN fallback)

## Files

- `config.js` - runtime settings (assets, overlay text, custom fonts)
- `index.html` - page shell + asset boot loader
- `styles.css` - visual styling and overlay layout
- `main.js` - 3D scene logic and animation
- `vendor/three.min.js` - local Three.js dependency for offline mode

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

## Asset modes

Asset mode can be set in `config.js` (`STREAM_CONFIG.assets.mode`) or by URL query.

- `config.js` default mode is used first
- `?assets=...` in the URL overrides `config.js`

Available modes:

- `?assets=auto` (default) - try local `vendor/three.min.js`, fallback to CDN
- `?assets=offline` - local only (requires `vendor/three.min.js`)
- `?assets=cdn` - CDN only

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

## Basic customization

Edit `config.js`:

- Asset behavior: `STREAM_CONFIG.assets.mode`
- Audio reactivity: `STREAM_CONFIG.audioReactive.*`
- Overlay text: `STREAM_CONFIG.overlay.title`, `STREAM_CONFIG.overlay.subtitle`
- Overlay fonts: `STREAM_CONFIG.overlay.titleFontFamily`, `STREAM_CONFIG.overlay.subtitleFontFamily`
- Overlay font style: `titleFontWeight`, `subtitleFontWeight`, `titleTextTransform`, `subtitleTextTransform`
- Overlay position: `overlayTop`, `overlayTopMobile`, `titleOffsetX`, `titleOffsetY`, `subtitleOffsetX`, `subtitleOffsetY`
- Overlay kerning: `titleKerning`, `subtitleKerning`

Edit `main.js` only for simulation/visual behavior:

- Simulation speed: `CONFIG.simulation.daysPerSecond`
- Sun cycle behavior: `CONFIG.sun.cycleSeconds`, `minActiveRegions`, `maxActiveRegions`, `startLatitude`, `endLatitude`

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
    titleFontFamily: "'Oracles', serif",
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
        family: "Oracles",
        src: "@oracles.woff",
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
- `mode: "gravityWarp"` keeps the current implementation as the default effect.
- Set `mode: "waterfallGraph"` to switch to waterfall graph on the fabric.
- Waterfall mode now keeps the gravity wells and layers waterfall ridges on top.
- Mode matching is case-insensitive (`"waterfallGraph"`, `"waterfallgraph"`, `"waterfall"`).
- Increase `gain` for stronger response.
- Lower `noiseFloorDb` (for example `-64`) to ignore quiet noise.
- Raise `attack` for quicker peaks, lower `release` for longer decay.
- Raise `maxBoost`/`waveInfluence` if you want more dramatic movement.
- `waterfallFlowSpeed` is the main speed knob (lower = slower flow).
- For waterfall mode, adjust `waterfallHeight`, `waterfallRowsPerSecond`, and `waterfallTrailDecay`.
- `waterfallTrailDecay` must be in `0..1` (higher = longer travel across the full fabric).
- Waterfall shaping is driven by OBS meter features (RMS, peak, transient, stereo balance) and propagated over time.

Notes:
- `customFontFaces[].src` accepts `@oracles.woff`, direct paths/URLs (`fonts/oracles.woff2`), or full CSS `url(...)` syntax.
- `externalFontStylesheets` is for web-hosted font CSS (for example Google Fonts).
- Keep local font files next to `index.html` (or use relative paths).

## Troubleshooting

- If you see a boot error about assets, verify `vendor/three.min.js` exists or switch to `?assets=cdn`.
- If the page looks stale after changes, hard refresh with `Ctrl+F5`.
- If local fonts do not apply, serve over `http://localhost` instead of opening with `file://`, then refresh cache in OBS/browser.
- If audio reactivity does not respond, verify `targetInputs` names exactly match your OBS mixer input names.
- If OBS requires auth, set the same password in `STREAM_CONFIG.audioReactive.password`.
- If using offline mode, keep `index.html`, `main.js`, `styles.css`, and `vendor/` together.
