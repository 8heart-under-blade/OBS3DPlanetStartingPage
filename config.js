(function () {
  "use strict";

  window.STREAM_CONFIG = {
    assets: {
      // Query param ?assets=auto|offline|cdn overrides this value.
      mode: "auto",
      localThree: "vendor/three.min.js",
      cdnThree: "https://unpkg.com/three@0.160.1/build/three.min.js"
    },
    overlay: {
      title: "STREAM STARTING SOON",
      subtitle: "Calibrating spacetime and aligning planetary ephemerides...",
      titleFontFamily: "'Oracles', serif",
      subtitleFontFamily: "'Orbitron', sans-serif",
      titleFontWeight: 400,
      subtitleFontWeight: 400,
      titleTextTransform: "uppercase",
      subtitleTextTransform: "none",

      // Overlay/top placement.
      // Accepts CSS units as string ("40px", "6vh", "min(4vh, 34px)") or number (px).
      // This moves the whole text block (eyebrow + title + subtitle).
      overlayTop: "12vh",
      overlayTopMobile: "10vh",

      // Fine positioning of title/subtitle (X/Y).
      // Accepts CSS unit string or number (px).
      titleOffsetX: 0,
      titleOffsetY: 0,
      subtitleOffsetX: 0,
      subtitleOffsetY: 0,

      // Letter spacing (kerning/tracking).
      // Accepts CSS unit string ("0.12em", "2px") or number (em).
      titleKerning: 0.06,
      subtitleKerning: 0.03,

      // Example web font stylesheet:
      // "https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&display=swap"
      externalFontStylesheets: [],

      // Example local font face:
      // {
      //   family: "Oracles",
      //   src: "@oracles.woff",
      //   weight: "400",
      //   style: "normal",
      //   display: "swap"
      // }
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

  // Backward-compatible direct overlay override.
  window.STREAM_OVERLAY = window.STREAM_CONFIG.overlay;
})();
