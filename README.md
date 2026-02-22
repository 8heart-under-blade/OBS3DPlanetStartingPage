# Stream Starting Soon - Planetary Display

This page renders a looping 3D solar-system style animation for a "starting soon" scene.

It includes:
- Animated planets and orbital paths
- Dynamic sun glow and solar-cycle sunspot activity
- A top text overlay (title + subtitle)
- Automatic asset loading (local file first, then CDN fallback)

## Files

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

Use the `assets` query parameter to control where Three.js loads from:

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

Edit `main.js`:

- Overlay text: `CONFIG.overlay.title`, `CONFIG.overlay.subtitle`
- Simulation speed: `CONFIG.simulation.daysPerSecond`
- Sun cycle behavior: `CONFIG.sun.cycleSeconds`, `minActiveRegions`, `maxActiveRegions`, `startLatitude`, `endLatitude`

## Troubleshooting

- If you see a boot error about assets, verify `vendor/three.min.js` exists or switch to `?assets=cdn`.
- If the page looks stale after changes, hard refresh with `Ctrl+F5`.
- If using offline mode, keep `index.html`, `main.js`, `styles.css`, and `vendor/` together.
