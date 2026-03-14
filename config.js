(function () {
  "use strict";

  window.STREAM_CONFIG = {
    assets: {
      // Query param ?assets=auto|offline|cdn overrides this value.
      mode: "auto",
      localThree: "vendor/three.min.js",
      cdnThree: "https://unpkg.com/three@0.160.1/build/three.min.js"
    },
    audioReactive: {
      enabled: true,

      // Current supported provider.
      provider: "obsWebSocket",

      // Visual mode:
      // - "gravityWarp" (default): current time-fabric ripple effect
      // - "waterfallGraph": scrolling waterfall graph from audio level history
      mode: "waterfallGraph",

      // OBS WebSocket (Tools -> WebSocket Server Settings)
      // Usually ws://127.0.0.1:4455
      url: "ws://127.0.0.1:4455",
      password: "",

      // Input names to listen to (Desktop Audio by default)
      targetInputs: ["Desktop Audio", "Desktop Audio 2"],

      // Signal shaping
      noiseFloorDb: -58,
      gain: 3.5,
      attack: 0.75,
      release: 0.8,

      // Visual response tuning
      maxBoost: 0.9,
      waveInfluence: 0.6,
      speedInfluence: 1.2,
      glowInfluence: 0.3,

      // Waterfall graph tuning (used when mode = "waterfallGraph")
      // Lower flow speed to slow movement.
      waterfallFlowSpeed: 0.55,
      waterfallRowsPerSecond: 30,
      waterfallHeight: 3.5,
      // 0..1 retention per second (higher = longer persistence)
      waterfallTrailDecay: 0.92,
      waterfallBanding: 1.4,

      // Reconnect timing
      reconnectBaseMs: 900,
      reconnectMaxMs: 9000
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
    },
    overlayBRB: {
      title: "BE RIGHT BACK",
      subtitle: "Crossing the event horizon. Return imminent.",
      overlayTop: "4vh",
      overlayTopMobile: "16px"
    },
    overlayThanks: {
      title: "THANK YOU FOR WATCHING",
      subtitle: "See You Next Time",
      titleFontFamily: "'Oracles', serif",
      subtitleFontFamily: "'Twigs', serif",
      titleFontWeight: 400,
      subtitleFontWeight: 400,
      titleTextTransform: "uppercase",
      subtitleTextTransform: "none",
      overlayTop: "6vh",
      overlayTopMobile: "20px",
      titleKerning: 0.08,
      subtitleKerning: 0.01,
      subtitleOffsetY: 2,
      customFontFaces: [
        {
          family: "Twigs",
          src: "@twigs.woff",
          weight: "400",
          style: "normal",
          display: "swap"
        }
      ]
    },
    thanksScene: {
      cameraFov: 42,
      cameraRadius: 74,
      cameraOrbitSpeed: 0.036,
      cameraHeight: 23,
      cameraLookHeight: 2.6,
      earthRadius: 8.8,
      earthTiltDeg: 23.4,
      earthRotationSpeed: 0.038,
      cloudLayerScale: 1.036,
      cloudSpeed: 0.057,
      cloudOpacity: 0.74,
      atmosphereScale: 1.11,
      atmosphereIntensity: 0.86,
      auroraScale: 1.046,
      auroraIntensity: 0.78,
      auroraAudioInfluence: 1.35,
      auroraTransientInfluence: 1.8,
      auroraBeatResponse: 1.05,
      useRealWorldMaps: true,
      earthDayMapUrl: "textures/planets/earth_day_2048.jpg",
      earthNightMapUrl: "textures/planets/earth_night_2048.png",
      earthCloudMapUrl: "textures/planets/earth_clouds_2k_solarsystemscope.jpg",
      earthWaterMaskUrl: "textures/planets/earth_specular_2048.jpg",
      moonMapUrl: "textures/planets/moon_1024.jpg",
      moonBumpMapUrl: "",
      moonRoughnessMapUrl: "",
      moonRadius: 2.4,
      moonOrbitRadius: 19.3,
      moonOrbitSpeed: 0.108,
      moonInclinationDeg: 10.4,
      moonSpinSpeed: 0.008,
      moonOrbitAudioInfluence: 0.65,
      fabricSize: 260,
      fabricSegments: 176,
      fabricBaseY: -14.6,
      earthMass: 242,
      earthSoftness: 18,
      moonMassForFabric: 58,
      moonSoftnessForFabric: 6.8,
      fabricWellDepth: 0.58,
      fabricWaveAmplitude: 0.45,
      starCount: 4800,
      mobileStarCount: 3200,
      maxPixelRatio: 1.8,
      exposure: 1.02
    },
    brbBlackholeReplacement: {
      enabled: true,
      pointerEvents: "auto",
      mouseControlEnabled: false,
      cameraPosition: {
        x: 0,
        y: 1.5,
        z: 22
      },
      cameraTarget: {
        x: 0,
        y: 0,
        z: 0
      },
      sizeScale: 0.5,
      useBloom: false,
      fabricWellScale: 0.8,
      fabricWellDepthScale: 1.25
    }
  };

  // Backward-compatible direct overlay override.
  window.STREAM_OVERLAY = window.STREAM_CONFIG.overlay;
})();
