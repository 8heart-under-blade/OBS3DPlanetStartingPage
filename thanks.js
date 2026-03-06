(function () {
  "use strict";

  if (!window.THREE) {
    var missing = document.getElementById("bootError");
    if (missing) {
      missing.textContent = "Three.js was not loaded. Use ?assets=auto, ?assets=offline, or ?assets=cdn.";
      missing.hidden = false;
    }
    return;
  }

  var THREE = window.THREE;
  var TWO_PI = Math.PI * 2;
  var streamConfig = window.STREAM_CONFIG && typeof window.STREAM_CONFIG === "object" ? window.STREAM_CONFIG : {};
  var baseOverlay = streamConfig.overlay && typeof streamConfig.overlay === "object" ? streamConfig.overlay : {};
  var thanksOverlay = streamConfig.overlayThanks && typeof streamConfig.overlayThanks === "object" ? streamConfig.overlayThanks : {};
  var thanksSceneOverrides = streamConfig.thanksScene && typeof streamConfig.thanksScene === "object" ? streamConfig.thanksScene : {};
  var audioOverrides = streamConfig.audioReactive && typeof streamConfig.audioReactive === "object" ? streamConfig.audioReactive : {};

  var overlayStylesheets = mergeUniqueStrings(
    ensureArray(baseOverlay.externalFontStylesheets),
    ensureArray(thanksOverlay.externalFontStylesheets)
  );
  var overlayFontFaces = mergeFontFaceDefinitions(
    ensureArray(baseOverlay.customFontFaces),
    ensureArray(thanksOverlay.customFontFaces)
  );
  if (overlayFontFaces.length === 0) {
    overlayFontFaces.push({
      family: "Twigs",
      src: "@twigs.woff",
      weight: "400",
      style: "normal",
      display: "swap"
    });
  }

  var CONFIG = {
    overlay: {
      title: pickDefined(thanksOverlay.title, "THANK YOU FOR WATCHING"),
      subtitle: pickDefined(thanksOverlay.subtitle, "See You Next Time"),
      titleFontFamily: pickDefined(thanksOverlay.titleFontFamily, pickDefined(baseOverlay.titleFontFamily, '"Trebuchet MS", "Gill Sans", "Segoe UI", sans-serif')),
      subtitleFontFamily: pickDefined(thanksOverlay.subtitleFontFamily, "'Twigs', serif"),
      titleFontWeight: pickDefined(thanksOverlay.titleFontWeight, pickDefined(baseOverlay.titleFontWeight, 700)),
      subtitleFontWeight: pickDefined(thanksOverlay.subtitleFontWeight, 400),
      titleTextTransform: pickDefined(thanksOverlay.titleTextTransform, pickDefined(baseOverlay.titleTextTransform, "uppercase")),
      subtitleTextTransform: pickDefined(thanksOverlay.subtitleTextTransform, pickDefined(baseOverlay.subtitleTextTransform, "none")),
      externalFontStylesheets: overlayStylesheets,
      customFontFaces: overlayFontFaces,
      overlayTop: pickDefined(thanksOverlay.overlayTop, "min(5vh, 46px)"),
      overlayTopMobile: pickDefined(thanksOverlay.overlayTopMobile, 20),
      titleOffsetX: pickDefined(thanksOverlay.titleOffsetX, 0),
      titleOffsetY: pickDefined(thanksOverlay.titleOffsetY, 0),
      subtitleOffsetX: pickDefined(thanksOverlay.subtitleOffsetX, 0),
      subtitleOffsetY: pickDefined(thanksOverlay.subtitleOffsetY, 0),
      titleKerning: pickDefined(thanksOverlay.titleKerning, 0.12),
      subtitleKerning: pickDefined(thanksOverlay.subtitleKerning, 0.02)
    },
    renderer: {
      maxPixelRatio: clampRange(Number(pickDefined(thanksSceneOverrides.maxPixelRatio, 1.8)), 1, 2.5, 1.8),
      exposure: clampRange(Number(pickDefined(thanksSceneOverrides.exposure, 1.02)), 0.4, 2.5, 1.02)
    },
    camera: {
      fov: clampRange(Number(pickDefined(thanksSceneOverrides.cameraFov, 42)), 28, 72, 42),
      radius: clampRange(Number(pickDefined(thanksSceneOverrides.cameraRadius, 74)), 24, 180, 74),
      orbitSpeed: clampRange(Number(pickDefined(thanksSceneOverrides.cameraOrbitSpeed, 0.036)), 0.004, 0.2, 0.036),
      height: clampRange(Number(pickDefined(thanksSceneOverrides.cameraHeight, 23)), 4, 100, 23),
      bobAmount: clampRange(Number(pickDefined(thanksSceneOverrides.cameraBobAmount, 0.56)), 0, 6, 0.56),
      lookHeight: clampRange(Number(pickDefined(thanksSceneOverrides.cameraLookHeight, 2.6)), -8, 30, 2.6)
    },
    stars: {
      count: clampRange(Math.round(Number(pickDefined(thanksSceneOverrides.starCount, 4800))), 1200, 10000, 4800),
      mobileCount: clampRange(Math.round(Number(pickDefined(thanksSceneOverrides.mobileStarCount, 3200))), 900, 8000, 3200),
      minRadius: clampRange(Number(pickDefined(thanksSceneOverrides.starMinRadius, 210)), 80, 1000, 210),
      maxRadius: clampRange(Number(pickDefined(thanksSceneOverrides.starMaxRadius, 940)), 200, 3000, 940)
    },
    earth: {
      positionY: clampRange(Number(pickDefined(thanksSceneOverrides.earthPositionY, 4.2)), -10, 40, 4.2),
      radius: clampRange(Number(pickDefined(thanksSceneOverrides.earthRadius, 8.8)), 1.2, 24, 8.8),
      tiltDeg: clampRange(Number(pickDefined(thanksSceneOverrides.earthTiltDeg, 23.4)), -89, 89, 23.4),
      rotationSpeed: clampRange(Number(pickDefined(thanksSceneOverrides.earthRotationSpeed, 0.038)), 0, 0.4, 0.038),
      cloudLayerScale: clampRange(Number(pickDefined(thanksSceneOverrides.cloudLayerScale, 1.016)), 1.002, 1.15, 1.016),
      cloudSpeed: clampRange(Number(pickDefined(thanksSceneOverrides.cloudSpeed, 0.049)), 0, 0.5, 0.049),
      cloudOpacity: clampRange(Number(pickDefined(thanksSceneOverrides.cloudOpacity, 0.6)), 0.05, 1, 0.6),
      atmosphereScale: clampRange(Number(pickDefined(thanksSceneOverrides.atmosphereScale, 1.11)), 1.004, 1.25, 1.11),
      atmosphereIntensity: clampRange(Number(pickDefined(thanksSceneOverrides.atmosphereIntensity, 0.86)), 0.05, 2, 0.86),
      auroraScale: clampRange(Number(pickDefined(thanksSceneOverrides.auroraScale, 1.046)), 1.01, 1.3, 1.046),
      auroraIntensity: clampRange(Number(pickDefined(thanksSceneOverrides.auroraIntensity, 0.78)), 0.05, 2, 0.78),
      auroraAudioInfluence: clampRange(Number(pickDefined(thanksSceneOverrides.auroraAudioInfluence, 1.35)), 0, 6, 1.35),
      auroraTransientInfluence: clampRange(Number(pickDefined(thanksSceneOverrides.auroraTransientInfluence, 1.8)), 0, 6, 1.8),
      auroraBeatResponse: clampRange(Number(pickDefined(thanksSceneOverrides.auroraBeatResponse, 1.05)), 0, 6, 1.05),
      floatAmplitude: clampRange(Number(pickDefined(thanksSceneOverrides.earthFloatAmplitude, 0.25)), 0, 3, 0.25),
      floatSpeed: clampRange(Number(pickDefined(thanksSceneOverrides.earthFloatSpeed, 0.62)), 0, 4, 0.62),
      textureSize: clampRange(Math.round(Number(pickDefined(thanksSceneOverrides.earthTextureSize, 512))), 128, 1024, 512)
    },
    moon: {
      radius: clampRange(Number(pickDefined(thanksSceneOverrides.moonRadius, 2.4)), 0.3, 10, 2.4),
      orbitRadius: clampRange(Number(pickDefined(thanksSceneOverrides.moonOrbitRadius, 19.3)), 3, 70, 19.3),
      orbitSpeed: clampRange(Number(pickDefined(thanksSceneOverrides.moonOrbitSpeed, 0.108)), 0, 1, 0.108),
      inclinationDeg: clampRange(Number(pickDefined(thanksSceneOverrides.moonInclinationDeg, 10.4)), -80, 80, 10.4),
      spinSpeed: clampRange(Number(pickDefined(thanksSceneOverrides.moonSpinSpeed, 0.008)), 0, 0.2, 0.008),
      mass: clampRange(Number(pickDefined(thanksSceneOverrides.moonMass, 58)), 0, 500, 58),
      softness: clampRange(Number(pickDefined(thanksSceneOverrides.moonSoftness, 6.8)), 0.5, 40, 6.8),
      textureSize: clampRange(Math.round(Number(pickDefined(thanksSceneOverrides.moonTextureSize, 320))), 96, 1024, 320),
      orbitAudioInfluence: clampRange(Number(pickDefined(thanksSceneOverrides.moonOrbitAudioInfluence, 0.65)), 0, 4, 0.65)
    },
    fabric: {
      size: clampRange(Number(pickDefined(thanksSceneOverrides.fabricSize, 260)), 80, 500, 260),
      segments: clampRange(Math.round(Number(pickDefined(thanksSceneOverrides.fabricSegments, 176))), 40, 300, 176),
      baseY: clampRange(Number(pickDefined(thanksSceneOverrides.fabricBaseY, -14.6)), -80, 20, -14.6),
      earthMass: clampRange(Number(pickDefined(thanksSceneOverrides.earthMass, 242)), 10, 1200, 242),
      earthSoftness: clampRange(Number(pickDefined(thanksSceneOverrides.earthSoftness, 18)), 1, 120, 18),
      moonMass: clampRange(Number(pickDefined(thanksSceneOverrides.moonMassForFabric, 58)), 0, 800, 58),
      moonSoftness: clampRange(Number(pickDefined(thanksSceneOverrides.moonSoftnessForFabric, 6.8)), 0.5, 60, 6.8),
      wellDepth: clampRange(Number(pickDefined(thanksSceneOverrides.fabricWellDepth, 0.58)), 0.05, 6, 0.58),
      waveAmp: clampRange(Number(pickDefined(thanksSceneOverrides.fabricWaveAmplitude, 0.45)), 0, 3, 0.45)
    },
    lights: {
      keyIntensity: clampRange(Number(pickDefined(thanksSceneOverrides.keyLightIntensity, 2.3)), 0, 10, 2.3),
      fillIntensity: clampRange(Number(pickDefined(thanksSceneOverrides.fillLightIntensity, 1.05)), 0, 10, 1.05),
      rimIntensity: clampRange(Number(pickDefined(thanksSceneOverrides.rimLightIntensity, 0.95)), 0, 10, 0.95),
      keyAudioInfluence: clampRange(Number(pickDefined(thanksSceneOverrides.keyLightAudioInfluence, 0.9)), 0, 6, 0.9),
      rimAudioInfluence: clampRange(Number(pickDefined(thanksSceneOverrides.rimLightAudioInfluence, 0.8)), 0, 6, 0.8)
    },
    maps: {
      useRealWorldMaps: pickDefined(thanksSceneOverrides.useRealWorldMaps, true) !== false,
      earthDayMapUrl: normalizeOptionalUrl(pickDefined(thanksSceneOverrides.earthDayMapUrl, "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg")),
      earthNightMapUrl: normalizeOptionalUrl(pickDefined(thanksSceneOverrides.earthNightMapUrl, "https://threejs.org/examples/textures/planets/earth_lights_2048.png")),
      earthCloudMapUrl: normalizeOptionalUrl(pickDefined(thanksSceneOverrides.earthCloudMapUrl, "https://threejs.org/examples/textures/planets/earth_clouds_1024.png")),
      earthWaterMaskUrl: normalizeOptionalUrl(pickDefined(thanksSceneOverrides.earthWaterMaskUrl, "https://threejs.org/examples/textures/planets/earth_specular_2048.jpg")),
      moonMapUrl: normalizeOptionalUrl(pickDefined(thanksSceneOverrides.moonMapUrl, "https://threejs.org/examples/textures/planets/moon_1024.jpg")),
      moonBumpMapUrl: normalizeOptionalUrl(pickDefined(thanksSceneOverrides.moonBumpMapUrl, "")),
      moonRoughnessMapUrl: normalizeOptionalUrl(pickDefined(thanksSceneOverrides.moonRoughnessMapUrl, ""))
    },
    audioReactive: {
      enabled: pickDefined(audioOverrides.enabled, true),
      provider: pickDefined(audioOverrides.provider, "obsWebSocket"),
      mode: normalizeAudioReactiveMode(pickDefined(audioOverrides.mode, "gravityWarp")),
      url: pickDefined(audioOverrides.url, "ws://127.0.0.1:4455"),
      password: pickDefined(audioOverrides.password, ""),
      targetInputs: ensureArray(pickDefined(audioOverrides.targetInputs, ["Desktop Audio", "Desktop Audio 2"])),
      noiseFloorDb: pickDefined(audioOverrides.noiseFloorDb, -58),
      gain: pickDefined(audioOverrides.gain, 1.2),
      attack: pickDefined(audioOverrides.attack, 0.5),
      release: pickDefined(audioOverrides.release, 0.08),
      maxBoost: pickDefined(audioOverrides.maxBoost, 0.9),
      waveInfluence: pickDefined(audioOverrides.waveInfluence, 0.6),
      speedInfluence: pickDefined(audioOverrides.speedInfluence, 1.2),
      glowInfluence: pickDefined(audioOverrides.glowInfluence, 0.3),
      waterfallFlowSpeed: pickDefined(audioOverrides.waterfallFlowSpeed, 0.65),
      waterfallRowsPerSecond: pickDefined(audioOverrides.waterfallRowsPerSecond, 46),
      waterfallHeight: pickDefined(audioOverrides.waterfallHeight, 2.2),
      waterfallTrailDecay: pickDefined(audioOverrides.waterfallTrailDecay, 0.86),
      waterfallBanding: pickDefined(audioOverrides.waterfallBanding, 1.0),
      reconnectBaseMs: pickDefined(audioOverrides.reconnectBaseMs, 900),
      reconnectMaxMs: pickDefined(audioOverrides.reconnectMaxMs, 9000)
    }
  };

  applyOverlayTypography(CONFIG.overlay);

  var titleEl = document.getElementById("title");
  var subtitleEl = document.getElementById("subtitle");
  var dateTimeEl = document.getElementById("datetime");
  var stopDateTimeTicker = startDateTimeTicker(dateTimeEl);
  if (titleEl) {
    titleEl.textContent = CONFIG.overlay.title;
  }
  if (subtitleEl) {
    subtitleEl.textContent = CONFIG.overlay.subtitle;
  }

  var container = document.getElementById("scene");
  if (!container) {
    return;
  }

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
  } catch (error) {
    var errorEl = document.getElementById("bootError");
    if (errorEl) {
      errorEl.textContent = "WebGL could not be initialized in this browser source.";
      errorEl.hidden = false;
    }
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.renderer.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = CONFIG.renderer.exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = false;
  container.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x040913, 0.0038);

  var camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, window.innerWidth / window.innerHeight, 0.1, 1800);
  camera.position.set(0, CONFIG.camera.height, CONFIG.camera.radius);

  var ambientLight = new THREE.AmbientLight(0x6f8fae, 0.36);
  scene.add(ambientLight);

  var keyLight = new THREE.DirectionalLight(0xc1e6ff, CONFIG.lights.keyIntensity);
  keyLight.position.set(34, 24, 28);
  scene.add(keyLight);

  var fillLight = new THREE.DirectionalLight(0x66bdd1, CONFIG.lights.fillIntensity);
  fillLight.position.set(-28, 9, -19);
  scene.add(fillLight);

  var rimLight = new THREE.PointLight(0x8af1d2, CONFIG.lights.rimIntensity, 240, 1.7);
  rimLight.position.set(0, 18, -36);
  scene.add(rimLight);

  var stars = createStars(
    window.innerWidth < 900 ? CONFIG.stars.mobileCount : CONFIG.stars.count,
    CONFIG.stars.minRadius,
    CONFIG.stars.maxRadius
  );
  scene.add(stars);

  var earthRoot = new THREE.Group();
  earthRoot.position.set(0, CONFIG.earth.positionY, 0);
  scene.add(earthRoot);

  var earthTilt = new THREE.Group();
  earthTilt.rotation.z = toRadians(CONFIG.earth.tiltDeg);
  earthRoot.add(earthTilt);

  var earthTextures = createEarthTextures(renderer, CONFIG.earth.textureSize);
  var earthMaterial = createEarthMaterial(earthTextures);
  var earth = new THREE.Mesh(
    new THREE.SphereGeometry(CONFIG.earth.radius, 92, 68),
    earthMaterial
  );
  earthTilt.add(earth);

  var cloudMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    alphaMap: earthTextures.cloudAlpha,
    transparent: true,
    opacity: CONFIG.earth.cloudOpacity,
    roughness: 0.95,
    metalness: 0,
    depthWrite: false
  });
  var cloudLayer = new THREE.Mesh(
    new THREE.SphereGeometry(CONFIG.earth.radius * CONFIG.earth.cloudLayerScale, 84, 56),
    cloudMaterial
  );
  earthTilt.add(cloudLayer);

  var atmosphereMaterial = createAtmosphereMaterial();
  var atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(CONFIG.earth.radius * CONFIG.earth.atmosphereScale, 86, 58),
    atmosphereMaterial
  );
  atmosphere.renderOrder = 2;
  earthTilt.add(atmosphere);

  var auroraMaterial = createAuroraMaterial();
  var aurora = new THREE.Mesh(
    new THREE.SphereGeometry(CONFIG.earth.radius * CONFIG.earth.auroraScale, 84, 56),
    auroraMaterial
  );
  aurora.renderOrder = 3;
  earthTilt.add(aurora);

  var moonPivot = new THREE.Group();
  moonPivot.rotation.z = toRadians(CONFIG.moon.inclinationDeg);
  earthRoot.add(moonPivot);

  var moonTextures = createMoonTextures(renderer, CONFIG.moon.textureSize);
  var moonMaterial = new THREE.MeshStandardMaterial({
    map: moonTextures.albedo,
    bumpMap: moonTextures.bump,
    bumpScale: 0.22,
    roughnessMap: moonTextures.roughness,
    roughness: 0.95,
    metalness: 0.02
  });
  var moon = new THREE.Mesh(
    new THREE.SphereGeometry(CONFIG.moon.radius, 58, 42),
    moonMaterial
  );
  moon.position.set(CONFIG.moon.orbitRadius, 0, 0);
  moonPivot.add(moon);

  var moonHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createHaloTexture([136, 167, 214], [69, 93, 133]),
      color: 0x9bbfe0,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  moonHalo.scale.set(CONFIG.moon.radius * 5.8, CONFIG.moon.radius * 5.8, 1);
  moon.add(moonHalo);

  applyRealWorldTexturesIfEnabled();

  var warpField = createTimeFabricMesh();
  var warpWaterfall = createWarpWaterfallState(warpField);
  var gravityBodies = [];
  var audioReactive = createAudioReactiveController(CONFIG.audioReactive);
  var clock = new THREE.Clock();
  var earthWorldPosition = new THREE.Vector3();
  var moonWorldPosition = new THREE.Vector3();

  audioReactive.start();
  animate();

  window.addEventListener("resize", onResize);
  window.addEventListener("beforeunload", function () {
    audioReactive.stop();
    stopDateTimeTicker();
  });

  function animate() {
    requestAnimationFrame(animate);

    var delta = Math.min(clock.getDelta(), 0.05);
    var elapsed = clock.getElapsedTime();
    var audioBoost = audioReactive.update(delta);
    var audioFeatures = audioReactive.getFeatures();

    updateCamera(elapsed);
    updateEarthSystem(elapsed, delta, audioBoost, audioFeatures);
    rebuildGravityBodies();
    updateWarpField(elapsed, delta, audioBoost, audioFeatures);
    updateLights(elapsed, audioBoost, audioFeatures);

    stars.rotation.y += delta * 0.0026;
    stars.rotation.x = Math.sin(elapsed * 0.06) * 0.035;

    renderer.render(scene, camera);
  }

  function updateEarthSystem(elapsed, delta, audioBoost, audioFeatures) {
    var level = audioFeatures && isFinite(audioFeatures.level) ? clamp01(audioFeatures.level) : audioBoost;
    var rms = audioFeatures && isFinite(audioFeatures.rms) ? clamp01(audioFeatures.rms) : audioBoost;
    var peak = audioFeatures && isFinite(audioFeatures.peak) ? clamp01(audioFeatures.peak) : rms;
    var transient = audioFeatures && isFinite(audioFeatures.transient) ? clamp01(audioFeatures.transient) : 0;
    var glowBoost = CONFIG.audioReactive.glowInfluence * audioBoost;
    var auroraDrive = clamp01(
      (level * 0.52 + rms * 0.44 + peak * 0.5) * CONFIG.earth.auroraAudioInfluence +
      transient * CONFIG.earth.auroraTransientInfluence
    );
    var auroraBeat = 1 + transient * CONFIG.earth.auroraBeatResponse;

    earthRoot.position.y =
      CONFIG.earth.positionY +
      Math.sin(elapsed * CONFIG.earth.floatSpeed) * CONFIG.earth.floatAmplitude +
      (rms - 0.35) * 0.22;

    earth.rotation.y += delta * (CONFIG.earth.rotationSpeed + rms * 0.024);
    earth.rotation.x = Math.sin(elapsed * 0.09) * 0.015;

    cloudLayer.rotation.y += delta * (CONFIG.earth.cloudSpeed + rms * 0.052 + transient * 0.085);
    cloudLayer.material.opacity = clampRange(CONFIG.earth.cloudOpacity + rms * 0.08, 0.12, 0.96, CONFIG.earth.cloudOpacity);

    moonPivot.rotation.y += delta * CONFIG.moon.orbitSpeed * (1 + rms * CONFIG.moon.orbitAudioInfluence + transient * 0.42);
    moon.rotation.y += delta * (CONFIG.moon.spinSpeed + rms * 0.015);
    moonHalo.material.opacity = 0.16 + rms * 0.09 + glowBoost * 0.18;

    earth.getWorldPosition(earthWorldPosition);

    earthMaterial.uniforms.uTime.value = elapsed;
    earthMaterial.uniforms.uSunPos.value.copy(keyLight.position);

    atmosphereMaterial.uniforms.uTime.value = elapsed;
    atmosphereMaterial.uniforms.uAudio.value = clamp01(rms + glowBoost * 0.35);
    atmosphereMaterial.uniforms.uIntensity.value = CONFIG.earth.atmosphereIntensity * (1 + glowBoost * 0.18);
    atmosphereMaterial.uniforms.uSunPos.value.copy(keyLight.position);

    auroraMaterial.uniforms.uTime.value = elapsed;
    auroraMaterial.uniforms.uAudio.value = auroraDrive;
    auroraMaterial.uniforms.uTransient.value = transient;
    auroraMaterial.uniforms.uBeat.value = auroraBeat;
    auroraMaterial.uniforms.uIntensity.value = CONFIG.earth.auroraIntensity * (1 + glowBoost * 0.22);
    auroraMaterial.uniforms.uSunPos.value.copy(keyLight.position);
  }

  function rebuildGravityBodies() {
    gravityBodies.length = 0;

    earth.getWorldPosition(earthWorldPosition);
    moon.getWorldPosition(moonWorldPosition);

    gravityBodies.push({
      x: earthWorldPosition.x,
      z: earthWorldPosition.z,
      mass: CONFIG.fabric.earthMass,
      softness: CONFIG.fabric.earthSoftness
    });

    gravityBodies.push({
      x: moonWorldPosition.x,
      z: moonWorldPosition.z,
      mass: CONFIG.fabric.moonMass,
      softness: CONFIG.fabric.moonSoftness
    });
  }

  function updateWarpField(elapsed, delta, audioBoost, audioFeatures) {
    if (CONFIG.audioReactive.mode === "waterfallGraph") {
      updateWarpFieldWaterfall(elapsed, delta, audioBoost, audioFeatures);
      return;
    }

    updateWarpFieldGravityWarp(elapsed, audioBoost, audioFeatures);
  }

  function updateWarpFieldGravityWarp(elapsed, audioBoost, audioFeatures) {
    var positions = warpField.geometry.attributes.position.array;
    var base = warpField.base;
    var rms = audioFeatures && isFinite(audioFeatures.rms) ? clamp01(audioFeatures.rms) : audioBoost;
    var waveBoost = CONFIG.audioReactive.waveInfluence * audioBoost;
    var speedBoost = 1 + CONFIG.audioReactive.speedInfluence * audioBoost;
    var wellDepth = CONFIG.fabric.wellDepth * (1 + audioBoost * 0.2);

    warpField.fill.material.opacity = 0.34 + audioBoost * 0.12;
    warpField.wire.material.opacity = 0.26 + audioBoost * 0.2;

    var earthBody = gravityBodies[0] || { x: 0, z: 0 };
    var moonBody = gravityBodies[1] || { x: 0, z: 0 };

    for (var i = 0; i < positions.length; i += 3) {
      var x = base[i];
      var z = base[i + 2];
      var well = 0;

      for (var b = 0; b < gravityBodies.length; b += 1) {
        var body = gravityBodies[b];
        var dx = x - body.x;
        var dz = z - body.z;
        var dist2 = dx * dx + dz * dz + body.softness;
        well += body.mass / dist2;
      }

      var earthDx = x - earthBody.x;
      var earthDz = z - earthBody.z;
      var moonDx = x - moonBody.x;
      var moonDz = z - moonBody.z;
      var earthRadius = Math.sqrt(earthDx * earthDx + earthDz * earthDz);
      var moonRadius = Math.sqrt(moonDx * moonDx + moonDz * moonDz);

      var bodyWave = Math.sin(earthRadius * 0.23 - elapsed * (1.6 + speedBoost * 0.8)) * (0.16 + waveBoost * 0.32);
      var moonWave = Math.sin(moonRadius * 0.38 - elapsed * (2.05 + speedBoost * 1.4)) * (0.06 + waveBoost * 0.16);
      var crossWave = Math.sin(x * 0.1 + elapsed * 0.62 * speedBoost) * Math.cos(z * 0.11 - elapsed * 0.5 * speedBoost);
      var radial = Math.sqrt(x * x + z * z);
      var audioWave = Math.sin(radial * 0.13 - elapsed * (1.45 + rms * 2.2)) * waveBoost * 0.8;

      positions[i + 1] =
        base[i + 1] -
        well * wellDepth +
        crossWave * (CONFIG.fabric.waveAmp + waveBoost * 0.42) +
        bodyWave +
        moonWave +
        audioWave;
    }

    warpField.geometry.attributes.position.needsUpdate = true;
  }

  function updateWarpFieldWaterfall(elapsed, delta, audioBoost, audioFeatures) {
    var positions = warpField.geometry.attributes.position.array;
    var base = warpField.base;
    var xCount = warpField.xCount;
    var zCount = warpField.zCount;
    var history = warpWaterfall.history;
    var rowBuffer = warpWaterfall.rowBuffer;

    var flowSpeed = Math.max(0.15, Number(CONFIG.audioReactive.waterfallFlowSpeed) || 0.15);
    var rowsPerSecond = Math.max(2, (Number(CONFIG.audioReactive.waterfallRowsPerSecond) || 0) * flowSpeed);
    var trailDecayPerSecond = clamp01(Number(CONFIG.audioReactive.waterfallTrailDecay));
    if (trailDecayPerSecond <= 0) {
      trailDecayPerSecond = 0.86;
    }
    var stepDecay = Math.pow(trailDecayPerSecond, 1 / rowsPerSecond);
    var passiveDecay = Math.pow(trailDecayPerSecond, Math.max(0.002, delta) * 0.11);
    var heightScale = Math.max(0.1, Number(CONFIG.audioReactive.waterfallHeight) || 0.1);
    var banding = Math.max(0.2, Number(CONFIG.audioReactive.waterfallBanding) || 0.2);
    var frameDelta = isFinite(delta) && delta > 0 ? delta : 0.016;

    warpWaterfall.accumulator += frameDelta * rowsPerSecond;
    var shiftCount = Math.floor(warpWaterfall.accumulator);
    if (shiftCount > 0) {
      warpWaterfall.accumulator -= shiftCount;

      for (var step = 0; step < shiftCount; step += 1) {
        buildWarpWaterfallInputProfile(rowBuffer, xCount, elapsed + step / rowsPerSecond, audioBoost, audioFeatures, banding, flowSpeed, warpWaterfall);
        shiftWaterfallHistoryRows(history, rowBuffer, xCount, zCount, stepDecay);
      }
    }

    for (var idx = 0; idx < history.length; idx += 1) {
      history[idx] *= passiveDecay;
    }

    var diffusionBlend = 1 - Math.exp(-frameDelta * 5.8);
    if (diffusionBlend > 0.001) {
      diffuseWaterfallHistory(history, warpWaterfall.scratch, xCount, zCount, diffusionBlend);
    }

    warpField.wire.material.opacity = 0.22 + audioBoost * 0.3;
    warpField.fill.material.opacity = 0.3 + audioBoost * 0.2;

    var earthBody = gravityBodies[0] || { x: 0, z: 0 };

    for (var z = 0; z < zCount; z += 1) {
      var zNorm = z / Math.max(1, zCount - 1);
      var distanceFade = 0.88 + 0.12 * (1 - smoothRange(0.93, 1, zNorm));

      for (var x = 0; x < xCount; x += 1) {
        var index = (z * xCount + x) * 3;
        var historyIndex = z * xCount + x;
        var xNorm = x / Math.max(1, xCount - 1);
        var centeredX = xNorm * 2 - 1;
        var xPos = base[index];
        var zPos = base[index + 2];

        var well = 0;
        for (var b = 0; b < gravityBodies.length; b += 1) {
          var body = gravityBodies[b];
          var dx = xPos - body.x;
          var dz = zPos - body.z;
          var dist2 = dx * dx + dz * dz + body.softness;
          well += body.mass / dist2;
        }

        var rowEnergy = Math.pow(clamp01(history[historyIndex]), 0.76) * distanceFade;
        var ridge = rowEnergy * heightScale;
        var centerDx = xPos - earthBody.x;
        var centerDz = zPos - earthBody.z;
        var centerRadius = Math.sqrt(centerDx * centerDx + centerDz * centerDz);
        var centerRipple = Math.sin(centerRadius * 0.24 - elapsed * (1.0 + flowSpeed * 0.85)) * 0.08;
        var underWave = Math.sin(centeredX * 4.7 - elapsed * 0.85 * (0.4 + flowSpeed * 0.6) + zNorm * 6.1) * 0.06;
        var gravityShape = -well * CONFIG.fabric.wellDepth * 0.9;

        positions[index + 1] = base[index + 1] + gravityShape + underWave + centerRipple + ridge;
      }
    }

    warpField.geometry.attributes.position.needsUpdate = true;
  }

  function buildWarpWaterfallInputProfile(outputRow, xCount, elapsed, audioBoost, audioFeatures, banding, flowSpeed, waterfallState) {
    var features = audioFeatures || null;
    var rms = features && isFinite(features.rms) ? clamp01(features.rms) : clamp01(audioBoost);
    var peak = features && isFinite(features.peak) ? clamp01(features.peak) : rms;
    var transient = features && isFinite(features.transient) ? clamp01(features.transient) : clamp01(peak - rms);
    var balance = features && isFinite(features.balance) ? clampSigned(features.balance) : 0;

    var energy = clamp01(rms * 0.75 + peak * 0.45);
    var transientLift = clamp01(transient * 1.8);
    var centerTarget = balance * 0.4;
    waterfallState.focus += (centerTarget - waterfallState.focus) * 0.28;

    var time = elapsed * flowSpeed;
    var slowDrift = Math.sin(time * 0.58 + waterfallState.phaseA) * 0.22;
    var pulse = 0.35 + energy * 0.95;
    var motionA = time * (1.5 + pulse * 2.4 + transientLift * 2.1) + waterfallState.phaseB;
    var motionB = time * (3.8 + transientLift * 6.2) + waterfallState.phaseC;

    for (var x = 0; x < xCount; x += 1) {
      var xNorm = x / Math.max(1, xCount - 1);
      var centeredX = xNorm * 2 - 1;

      var focus = waterfallState.focus + slowDrift;
      var lowBody = Math.exp(-Math.pow((centeredX - focus) / 0.55, 2));
      var midBand = 0.5 + 0.5 * Math.sin(centeredX * (7.2 * banding) + motionA);
      var highBand = Math.pow(0.5 + 0.5 * Math.sin(centeredX * (22 * banding) - motionB), 2.2);
      var sideRidge = Math.exp(-Math.pow((Math.abs(centeredX) - 0.62) / 0.2, 2));
      var grain = 0.5 + 0.5 * Math.sin(centeredX * 41 + motionB * 0.71 + waterfallState.phaseA * 0.43);

      var value = 0;
      value += lowBody * (0.12 + energy * 0.82);
      value += midBand * (0.08 + energy * 0.52);
      value += highBand * (0.04 + transientLift * 0.68);
      value += sideRidge * (0.03 + energy * 0.12);
      value += grain * transientLift * 0.18;

      outputRow[x] = clamp01(value);
    }
  }

  function shiftWaterfallHistoryRows(history, rowBuffer, xCount, zCount, stepDecay) {
    for (var row = zCount - 1; row > 0; row -= 1) {
      var dstOffset = row * xCount;
      var srcOffset = (row - 1) * xCount;

      for (var col = 0; col < xCount; col += 1) {
        history[dstOffset + col] = history[srcOffset + col] * stepDecay;
      }
    }

    for (var x = 0; x < xCount; x += 1) {
      history[x] = rowBuffer[x];
    }
  }

  function diffuseWaterfallHistory(history, scratch, xCount, zCount, blend) {
    var inverseBlend = 1 - blend;

    for (var row = 0; row < zCount; row += 1) {
      for (var col = 0; col < xCount; col += 1) {
        var index = row * xCount + col;
        var center = history[index];

        var left = col > 0 ? history[index - 1] : center;
        var right = col < xCount - 1 ? history[index + 1] : center;
        var back = row > 0 ? history[index - xCount] : center;
        var front = row < zCount - 1 ? history[index + xCount] : center;

        var neighborhood = (center * 2 + left + right + back + front) / 6;
        scratch[index] = center * inverseBlend + neighborhood * blend;
      }
    }

    for (var i = 0; i < history.length; i += 1) {
      history[i] = scratch[i];
    }
  }

  function updateLights(elapsed, audioBoost, audioFeatures) {
    var rms = audioFeatures && isFinite(audioFeatures.rms) ? clamp01(audioFeatures.rms) : audioBoost;
    var transient = audioFeatures && isFinite(audioFeatures.transient) ? clamp01(audioFeatures.transient) : 0;
    var glowBoost = CONFIG.audioReactive.glowInfluence * audioBoost;

    keyLight.position.x = 34 + Math.sin(elapsed * 0.11) * 3.2;
    keyLight.position.y = 24 + Math.sin(elapsed * 0.13) * 1.8;
    keyLight.position.z = 28 + Math.cos(elapsed * 0.1) * 2.8;
    keyLight.intensity = CONFIG.lights.keyIntensity + rms * CONFIG.lights.keyAudioInfluence + glowBoost * 0.28;

    fillLight.intensity = CONFIG.lights.fillIntensity + rms * 0.28 + glowBoost * 0.16;
    rimLight.intensity = CONFIG.lights.rimIntensity + rms * CONFIG.lights.rimAudioInfluence + transient * 0.35 + glowBoost * 0.72;
    rimLight.position.x = Math.sin(elapsed * 0.35) * 6;
  }

  function updateCamera(elapsed) {
    var driftRadius = CONFIG.camera.radius + Math.sin(elapsed * 0.13) * 1.9;
    var yaw = elapsed * CONFIG.camera.orbitSpeed;
    camera.position.x = Math.cos(yaw) * driftRadius;
    camera.position.z = Math.sin(yaw) * driftRadius;
    camera.position.y = CONFIG.camera.height + Math.sin(elapsed * 0.18) * CONFIG.camera.bobAmount;
    camera.lookAt(0, CONFIG.camera.lookHeight + Math.sin(elapsed * 0.07) * 0.13, 0);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.renderer.maxPixelRatio));
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function createEarthMaterial(textures) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSunPos: { value: new THREE.Vector3(34, 24, 28) },
        uAlbedo: { value: textures.albedo || null },
        uNight: { value: textures.night || null },
        uWaterMask: { value: textures.waterMask || null }
      },
      vertexShader:
        "varying vec2 vUv;\n" +
        "varying vec3 vWorldPos;\n" +
        "varying vec3 vWorldNormal;\n" +
        "void main() {\n" +
        "  vUv = uv;\n" +
        "  vec4 worldPos = modelMatrix * vec4(position, 1.0);\n" +
        "  vWorldPos = worldPos.xyz;\n" +
        "  vWorldNormal = normalize(mat3(modelMatrix) * normal);\n" +
        "  gl_Position = projectionMatrix * viewMatrix * worldPos;\n" +
        "}",
      fragmentShader:
        "uniform float uTime;\n" +
        "uniform vec3 uSunPos;\n" +
        "uniform sampler2D uAlbedo;\n" +
        "uniform sampler2D uNight;\n" +
        "uniform sampler2D uWaterMask;\n" +
        "varying vec2 vUv;\n" +
        "varying vec3 vWorldPos;\n" +
        "varying vec3 vWorldNormal;\n" +
        "void main() {\n" +
        "  vec3 N = normalize(vWorldNormal);\n" +
        "  vec3 L = normalize(uSunPos - vWorldPos);\n" +
        "  vec3 V = normalize(cameraPosition - vWorldPos);\n" +
        "  float ndotl = dot(N, L);\n" +
        "  float day = smoothstep(-0.08, 0.25, ndotl);\n" +
        "  float diffuse = max(ndotl, 0.0);\n" +
        "  vec3 albedo = texture2D(uAlbedo, vUv).rgb;\n" +
        "  vec3 nightMap = texture2D(uNight, vUv).rgb;\n" +
        "  float water = texture2D(uWaterMask, vUv).r;\n" +
        "  vec3 H = normalize(L + V);\n" +
        "  float spec = pow(max(dot(N, H), 0.0), 68.0) * water * day;\n" +
        "  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 4.0);\n" +
        "  vec3 atmosphereTint = vec3(0.08, 0.19, 0.34) * fresnel * (0.5 + day * 0.5);\n" +
        "  vec3 litColor = albedo * (0.17 + 0.83 * pow(diffuse, 0.82));\n" +
        "  vec3 city = nightMap * (1.0 - day) * 1.4;\n" +
        "  vec3 specColor = vec3(0.4, 0.58, 0.82) * spec;\n" +
        "  vec3 color = litColor + city + specColor + atmosphereTint;\n" +
        "  gl_FragColor = vec4(color, 1.0);\n" +
        "  #include <tonemapping_fragment>\n" +
        "  #include <colorspace_fragment>\n" +
        "}",
      dithering: true
    });
  }

  function createAtmosphereMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSunPos: { value: new THREE.Vector3(34, 24, 28) },
        uIntensity: { value: CONFIG.earth.atmosphereIntensity },
        uAudio: { value: 0 }
      },
      vertexShader:
        "varying vec3 vWorldPos;\n" +
        "varying vec3 vWorldNormal;\n" +
        "void main() {\n" +
        "  vec4 worldPos = modelMatrix * vec4(position, 1.0);\n" +
        "  vWorldPos = worldPos.xyz;\n" +
        "  vWorldNormal = normalize(mat3(modelMatrix) * normal);\n" +
        "  gl_Position = projectionMatrix * viewMatrix * worldPos;\n" +
        "}",
      fragmentShader:
        "uniform float uTime;\n" +
        "uniform vec3 uSunPos;\n" +
        "uniform float uIntensity;\n" +
        "uniform float uAudio;\n" +
        "varying vec3 vWorldPos;\n" +
        "varying vec3 vWorldNormal;\n" +
        "void main() {\n" +
        "  vec3 N = normalize(vWorldNormal);\n" +
        "  vec3 L = normalize(uSunPos - vWorldPos);\n" +
        "  vec3 V = normalize(cameraPosition - vWorldPos);\n" +
        "  float ndotl = dot(N, L);\n" +
        "  float day = smoothstep(-0.1, 0.58, ndotl);\n" +
        "  float twilight = 1.0 - abs(ndotl);\n" +
        "  twilight = smoothstep(0.0, 1.0, twilight);\n" +
        "  float night = smoothstep(0.52, -0.48, ndotl);\n" +
        "  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.35);\n" +
        "  float horizon = smoothstep(0.0, 1.0, fresnel);\n" +
        "  float pulse = 0.97 + sin(uTime * 0.21) * 0.03;\n" +
        "  vec3 dayColor = vec3(0.22, 0.61, 1.0);\n" +
        "  vec3 twilightColor = vec3(0.13, 0.37, 0.7);\n" +
        "  vec3 nightColor = vec3(0.03, 0.16, 0.34);\n" +
        "  vec3 color = mix(nightColor, twilightColor, twilight);\n" +
        "  color = mix(color, dayColor, day);\n" +
        "  float alpha = horizon * (0.08 + day * 0.42 + twilight * 0.22 + night * 0.16) * (uIntensity + uAudio * 0.32) * pulse;\n" +
        "  alpha = clamp(alpha, 0.0, 0.72);\n" +
        "  gl_FragColor = vec4(color * (0.45 + alpha * 1.2), alpha);\n" +
        "  #include <tonemapping_fragment>\n" +
        "  #include <colorspace_fragment>\n" +
        "}",
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      dithering: true
    });
  }

  function createAuroraMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uAudio: { value: 0 },
        uTransient: { value: 0 },
        uBeat: { value: 1 },
        uIntensity: { value: CONFIG.earth.auroraIntensity },
        uSunPos: { value: new THREE.Vector3(34, 24, 28) }
      },
      vertexShader:
        "varying vec3 vWorldPos;\n" +
        "varying vec3 vWorldNormal;\n" +
        "void main() {\n" +
        "  vec4 worldPos = modelMatrix * vec4(position, 1.0);\n" +
        "  vWorldPos = worldPos.xyz;\n" +
        "  vWorldNormal = normalize(mat3(modelMatrix) * normal);\n" +
        "  gl_Position = projectionMatrix * viewMatrix * worldPos;\n" +
        "}",
      fragmentShader:
        "uniform float uTime;\n" +
        "uniform float uAudio;\n" +
        "uniform float uTransient;\n" +
        "uniform float uBeat;\n" +
        "uniform float uIntensity;\n" +
        "uniform vec3 uSunPos;\n" +
        "varying vec3 vWorldPos;\n" +
        "varying vec3 vWorldNormal;\n" +
        "float hash12(vec2 p) {\n" +
        "  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.11369, 0.13787));\n" +
        "  p3 += dot(p3, p3.yzx + 19.19);\n" +
        "  return fract((p3.x + p3.y) * p3.z);\n" +
        "}\n" +
        "float noise2(vec2 p) {\n" +
        "  vec2 i = floor(p);\n" +
        "  vec2 f = fract(p);\n" +
        "  float a = hash12(i);\n" +
        "  float b = hash12(i + vec2(1.0, 0.0));\n" +
        "  float c = hash12(i + vec2(0.0, 1.0));\n" +
        "  float d = hash12(i + vec2(1.0, 1.0));\n" +
        "  vec2 u = f * f * (3.0 - 2.0 * f);\n" +
        "  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;\n" +
        "}\n" +
        "float fbm(vec2 p) {\n" +
        "  float value = 0.0;\n" +
        "  float amp = 0.55;\n" +
        "  for (int i = 0; i < 4; i++) {\n" +
        "    value += amp * noise2(p);\n" +
        "    p *= 2.03;\n" +
        "    amp *= 0.5;\n" +
        "  }\n" +
        "  return value;\n" +
        "}\n" +
        "void main() {\n" +
        "  vec3 N = normalize(vWorldNormal);\n" +
        "  float absLat = abs(N.y);\n" +
        "  float poleCap = smoothstep(0.62, 0.99, absLat);\n" +
        "  float northBand = exp(-pow((N.y - 0.78) / 0.12, 2.0));\n" +
        "  float southBand = exp(-pow((N.y + 0.78) / 0.12, 2.0));\n" +
        "  float polarMask = clamp((northBand + southBand) * poleCap, 0.0, 1.0);\n" +
        "  float theta = atan(N.z, N.x);\n" +
        "  vec2 uv = vec2(theta * 0.72 + uTime * 0.1, N.y * 3.8 - uTime * 0.06);\n" +
        "  float flow = fbm(uv * 2.6);\n" +
        "  float latFlow = fbm(vec2(theta * 0.95 + uTime * 0.12, absLat * 8.0 - uTime * 0.09));\n" +
        "  float band = sin(theta * 8.4 + uTime * 1.28 + flow * 5.0 + latFlow * 1.2);\n" +
        "  float curtain = smoothstep(0.38, 0.96, band * 0.5 + 0.5) * smoothstep(0.36, 1.0, latFlow);\n" +
        "  float nightSide = smoothstep(-0.2, 0.4, -dot(N, normalize(uSunPos - vWorldPos)));\n" +
        "  float pulse = (0.58 + 0.42 * sin(theta * 3.7 - uTime * (2.05 + uAudio * 2.2) + flow * 2.5)) * uBeat;\n" +
        "  float intensity = polarMask * curtain * nightSide * pulse;\n" +
        "  intensity *= (uIntensity + uAudio * 0.95 + uTransient * 0.6);\n" +
        "  intensity = clamp(intensity, 0.0, 1.3);\n" +
        "  vec3 emerald = vec3(0.06, 0.86, 0.45);\n" +
        "  vec3 cyan = vec3(0.23, 0.95, 0.95);\n" +
        "  vec3 violet = vec3(0.41, 0.41, 0.94);\n" +
        "  vec3 color = mix(emerald, cyan, clamp(flow * 1.18, 0.0, 1.0));\n" +
        "  color = mix(color, violet, smoothstep(0.8, 1.1, flow + uTransient * 0.25) * 0.24);\n" +
        "  float alpha = clamp(intensity * 0.62, 0.0, 1.0);\n" +
        "  if (alpha < 0.01) {\n" +
        "    discard;\n" +
        "  }\n" +
        "  gl_FragColor = vec4(color * (0.4 + intensity * 0.8), alpha);\n" +
        "  #include <tonemapping_fragment>\n" +
        "  #include <colorspace_fragment>\n" +
        "}",
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      dithering: true
    });
  }

  function createEarthTextures(rendererRef, size) {
    var textureSize = Math.max(128, Math.floor(size || 512));
    var albedoCanvas = document.createElement("canvas");
    var nightCanvas = document.createElement("canvas");
    var cloudAlphaCanvas = document.createElement("canvas");
    var waterMaskCanvas = document.createElement("canvas");

    albedoCanvas.width = textureSize;
    albedoCanvas.height = textureSize;
    nightCanvas.width = textureSize;
    nightCanvas.height = textureSize;
    cloudAlphaCanvas.width = textureSize;
    cloudAlphaCanvas.height = textureSize;
    waterMaskCanvas.width = textureSize;
    waterMaskCanvas.height = textureSize;

    var albedoCtx = albedoCanvas.getContext("2d");
    var nightCtx = nightCanvas.getContext("2d");
    var cloudCtx = cloudAlphaCanvas.getContext("2d");
    var waterCtx = waterMaskCanvas.getContext("2d");
    if (!albedoCtx || !nightCtx || !cloudCtx || !waterCtx) {
      return {
        albedo: null,
        night: null,
        cloudAlpha: null,
        waterMask: null
      };
    }

    var albedoData = albedoCtx.createImageData(textureSize, textureSize);
    var nightData = nightCtx.createImageData(textureSize, textureSize);
    var cloudData = cloudCtx.createImageData(textureSize, textureSize);
    var waterData = waterCtx.createImageData(textureSize, textureSize);
    var albedoPixels = albedoData.data;
    var nightPixels = nightData.data;
    var cloudPixels = cloudData.data;
    var waterPixels = waterData.data;
    var seed = 9127;

    for (var y = 0; y < textureSize; y += 1) {
      var v = y / (textureSize - 1);
      var latitude = v * 2 - 1;
      var absLatitude = Math.abs(latitude);

      for (var x = 0; x < textureSize; x += 1) {
        var u = x / (textureSize - 1);
        var nA = fbm2D(u * 5.2, v * 3.7, seed);
        var nB = fbm2D(u * 14 + 15.7, v * 9.8 + 3.4, seed + 17);
        var nC = fbm2D(u * 33 + 8.1, v * 29 + 5.2, seed + 39);

        var continentShape = nA * 0.72 + nB * 0.28 - absLatitude * 0.09 + (nC - 0.5) * 0.08;
        var land = smoothRange(0.53, 0.67, continentShape);
        var coast = clamp01(smoothRange(0.49, 0.6, continentShape) - land + 0.06);

        var oceanDepth = smoothRange(0.1, 0.96, nB + (1 - land) * 0.28);
        var oceanR = lerp(8, 34, oceanDepth);
        var oceanG = lerp(36, 101, oceanDepth);
        var oceanB = lerp(72, 152, oceanDepth);

        var landHeight = smoothRange(0.28, 0.9, nB + (nC - 0.5) * 0.4);
        var tropical = 1 - smoothRange(0.2, 0.78, absLatitude);
        var landR = lerp(55, 132, landHeight) + tropical * 12;
        var landG = lerp(84, 150, landHeight) + tropical * 20;
        var landB = lerp(46, 108, landHeight) + tropical * 6;

        var r = lerp(oceanR, landR, land);
        var g = lerp(oceanG, landG, land);
        var b = lerp(oceanB, landB, land);

        var ice = smoothRange(0.72, 0.99, absLatitude + (nA - 0.5) * 0.16);
        r = lerp(r, 235, ice * 0.9);
        g = lerp(g, 243, ice * 0.9);
        b = lerp(b, 250, ice * 0.9);

        var cityNoise = fbm2D(u * 57 + 6.4, v * 57 + 11.2, seed + 81);
        var urbanCore = smoothRange(0.74, 0.94, cityNoise) * land * (1 - ice);
        var coastalGlow = coast * land * (1 - ice) * 0.85;
        var city = clamp01(urbanCore * 0.86 + coastalGlow * 0.64);
        var cityLatFade = 1 - smoothRange(0.68, 0.98, absLatitude);
        city *= cityLatFade;

        var cloudNoiseA = fbm2D(u * 18.3 + 3.2, v * 16.4 + 5.7, seed + 101);
        var cloudNoiseB = fbm2D(u * 46.4 + 17.2, v * 40.1 + 9.7, seed + 151);
        var cloudBands = 0.5 + 0.5 * Math.sin((u + v * 0.22) * TWO_PI * 8.1 + nA * 5.2);
        var cloudDensity = smoothRange(0.56, 0.88, cloudNoiseA * 0.78 + cloudNoiseB * 0.16 + cloudBands * 0.14 + absLatitude * 0.09);
        var cloudAlpha = clamp01(cloudDensity * (0.35 + (1 - land * 0.3) * 0.55));

        var water = clamp01(1 - land + coast * 0.45);

        var index = (y * textureSize + x) * 4;
        albedoPixels[index] = clampByte(Math.round(r));
        albedoPixels[index + 1] = clampByte(Math.round(g));
        albedoPixels[index + 2] = clampByte(Math.round(b));
        albedoPixels[index + 3] = 255;

        nightPixels[index] = clampByte(Math.round(245 * city));
        nightPixels[index + 1] = clampByte(Math.round(186 * city));
        nightPixels[index + 2] = clampByte(Math.round(114 * city));
        nightPixels[index + 3] = 255;

        cloudPixels[index] = 255;
        cloudPixels[index + 1] = 255;
        cloudPixels[index + 2] = 255;
        cloudPixels[index + 3] = clampByte(Math.round(cloudAlpha * 255));

        var waterByte = clampByte(Math.round(water * 255));
        waterPixels[index] = waterByte;
        waterPixels[index + 1] = waterByte;
        waterPixels[index + 2] = waterByte;
        waterPixels[index + 3] = 255;
      }
    }

    albedoCtx.putImageData(albedoData, 0, 0);
    nightCtx.putImageData(nightData, 0, 0);
    cloudCtx.putImageData(cloudData, 0, 0);
    waterCtx.putImageData(waterData, 0, 0);

    var anisotropy = rendererRef && rendererRef.capabilities
      ? Math.min(rendererRef.capabilities.getMaxAnisotropy(), 4)
      : 1;

    var albedoTexture = new THREE.CanvasTexture(albedoCanvas);
    albedoTexture.colorSpace = THREE.SRGBColorSpace;
    albedoTexture.anisotropy = anisotropy;

    var nightTexture = new THREE.CanvasTexture(nightCanvas);
    nightTexture.colorSpace = THREE.SRGBColorSpace;
    nightTexture.anisotropy = anisotropy;

    var cloudAlphaTexture = new THREE.CanvasTexture(cloudAlphaCanvas);
    cloudAlphaTexture.anisotropy = anisotropy;

    var waterMaskTexture = new THREE.CanvasTexture(waterMaskCanvas);
    waterMaskTexture.anisotropy = anisotropy;

    return {
      albedo: albedoTexture,
      night: nightTexture,
      cloudAlpha: cloudAlphaTexture,
      waterMask: waterMaskTexture
    };
  }

  function createMoonTextures(rendererRef, size) {
    var textureSize = Math.max(96, Math.floor(size || 320));
    var albedoCanvas = document.createElement("canvas");
    var bumpCanvas = document.createElement("canvas");
    var roughCanvas = document.createElement("canvas");

    albedoCanvas.width = textureSize;
    albedoCanvas.height = textureSize;
    bumpCanvas.width = textureSize;
    bumpCanvas.height = textureSize;
    roughCanvas.width = textureSize;
    roughCanvas.height = textureSize;

    var albedoCtx = albedoCanvas.getContext("2d");
    var bumpCtx = bumpCanvas.getContext("2d");
    var roughCtx = roughCanvas.getContext("2d");
    if (!albedoCtx || !bumpCtx || !roughCtx) {
      return {
        albedo: null,
        bump: null,
        roughness: null
      };
    }

    var albedoData = albedoCtx.createImageData(textureSize, textureSize);
    var bumpData = bumpCtx.createImageData(textureSize, textureSize);
    var roughData = roughCtx.createImageData(textureSize, textureSize);
    var albedoPixels = albedoData.data;
    var bumpPixels = bumpData.data;
    var roughPixels = roughData.data;
    var seed = 1451;
    var craterCount = 52;
    var craters = [];

    for (var c = 0; c < craterCount; c += 1) {
      craters.push({
        u: Math.random(),
        v: Math.random(),
        r: 0.012 + Math.random() * 0.055,
        depth: 0.2 + Math.random() * 0.9
      });
    }

    for (var y = 0; y < textureSize; y += 1) {
      var v = y / (textureSize - 1);
      var latitude = v * 2 - 1;

      for (var x = 0; x < textureSize; x += 1) {
        var u = x / (textureSize - 1);
        var nA = fbm2D(u * 12.8, v * 12.8, seed);
        var nB = fbm2D(u * 32.4 + 8.7, v * 29.1 + 4.3, seed + 13);
        var nC = fbm2D(u * 61.2 + 2.8, v * 58.3 + 7.1, seed + 61);

        var height = 0.5 + (nA - 0.5) * 0.34 + (nB - 0.5) * 0.22 + (nC - 0.5) * 0.1;

        for (var i = 0; i < craters.length; i += 1) {
          var crater = craters[i];
          var du = wrappedDistance(u, crater.u);
          var dv = Math.abs(v - crater.v);
          var distance = Math.sqrt(du * du + dv * dv);
          if (distance > crater.r) {
            continue;
          }

          var t = distance / crater.r;
          var bowl = (1 - t * t) * crater.depth;
          var rim = smoothRange(0.78, 1, 1 - t) * crater.depth * 0.42;
          height -= bowl * 0.32;
          height += rim;
        }

        var polarTint = smoothRange(0.72, 0.98, Math.abs(latitude));
        var brightness = clamp01(0.36 + height * 0.72 + polarTint * 0.08);

        var albedoR = clampByte(Math.round(104 + brightness * 74));
        var albedoG = clampByte(Math.round(107 + brightness * 71));
        var albedoB = clampByte(Math.round(112 + brightness * 68));

        var bumpTone = clampByte(Math.round(clamp01(height) * 255));
        var roughTone = clampByte(Math.round(clamp01(0.62 + (1 - height) * 0.34 + nC * 0.12) * 255));

        var index = (y * textureSize + x) * 4;
        albedoPixels[index] = albedoR;
        albedoPixels[index + 1] = albedoG;
        albedoPixels[index + 2] = albedoB;
        albedoPixels[index + 3] = 255;

        bumpPixels[index] = bumpTone;
        bumpPixels[index + 1] = bumpTone;
        bumpPixels[index + 2] = bumpTone;
        bumpPixels[index + 3] = 255;

        roughPixels[index] = roughTone;
        roughPixels[index + 1] = roughTone;
        roughPixels[index + 2] = roughTone;
        roughPixels[index + 3] = 255;
      }
    }

    albedoCtx.putImageData(albedoData, 0, 0);
    bumpCtx.putImageData(bumpData, 0, 0);
    roughCtx.putImageData(roughData, 0, 0);

    var anisotropy = rendererRef && rendererRef.capabilities
      ? Math.min(rendererRef.capabilities.getMaxAnisotropy(), 4)
      : 1;

    var albedoTexture = new THREE.CanvasTexture(albedoCanvas);
    albedoTexture.colorSpace = THREE.SRGBColorSpace;
    albedoTexture.anisotropy = anisotropy;

    var bumpTexture = new THREE.CanvasTexture(bumpCanvas);
    bumpTexture.anisotropy = anisotropy;

    var roughTexture = new THREE.CanvasTexture(roughCanvas);
    roughTexture.anisotropy = anisotropy;

    return {
      albedo: albedoTexture,
      bump: bumpTexture,
      roughness: roughTexture
    };
  }

  function applyRealWorldTexturesIfEnabled() {
    if (!CONFIG.maps.useRealWorldMaps) {
      return;
    }

    var maps = CONFIG.maps;
    var loader = new THREE.TextureLoader();
    if (typeof loader.setCrossOrigin === "function") {
      loader.setCrossOrigin("anonymous");
    }

    var anisotropy = renderer && renderer.capabilities
      ? Math.min(renderer.capabilities.getMaxAnisotropy(), 8)
      : 1;

    loadConfiguredTexture(loader, maps.earthDayMapUrl, THREE.SRGBColorSpace, anisotropy)
      .then(function (texture) {
        earthMaterial.uniforms.uAlbedo.value = texture;
      })
      .catch(function (error) {
        console.warn("TY4W earth day map fallback to procedural:", error);
      });

    loadConfiguredTexture(loader, maps.earthNightMapUrl, THREE.SRGBColorSpace, anisotropy)
      .then(function (texture) {
        earthMaterial.uniforms.uNight.value = texture;
      })
      .catch(function (error) {
        console.warn("TY4W earth night map fallback to procedural:", error);
      });

    loadConfiguredTexture(loader, maps.earthWaterMaskUrl, null, anisotropy)
      .then(function (texture) {
        earthMaterial.uniforms.uWaterMask.value = texture;
      })
      .catch(function (error) {
        console.warn("TY4W earth water mask fallback to procedural:", error);
      });

    loadConfiguredTexture(loader, maps.earthCloudMapUrl, null, anisotropy)
      .then(function (texture) {
        cloudMaterial.alphaMap = texture;
        cloudMaterial.needsUpdate = true;
      })
      .catch(function (error) {
        console.warn("TY4W cloud map fallback to procedural:", error);
      });

    loadConfiguredTexture(loader, maps.moonMapUrl, THREE.SRGBColorSpace, anisotropy)
      .then(function (texture) {
        moonMaterial.map = texture;
        moonMaterial.needsUpdate = true;
      })
      .catch(function (error) {
        console.warn("TY4W moon map fallback to procedural:", error);
      });

    loadConfiguredTexture(loader, maps.moonBumpMapUrl, null, anisotropy)
      .then(function (texture) {
        moonMaterial.bumpMap = texture;
        moonMaterial.bumpScale = 0.18;
        moonMaterial.needsUpdate = true;
      })
      .catch(function () {});

    loadConfiguredTexture(loader, maps.moonRoughnessMapUrl, null, anisotropy)
      .then(function (texture) {
        moonMaterial.roughnessMap = texture;
        moonMaterial.needsUpdate = true;
      })
      .catch(function () {});
  }

  function loadConfiguredTexture(loader, rawUrl, colorSpace, anisotropy) {
    var resolvedUrl = normalizeOptionalUrl(rawUrl);
    return new Promise(function (resolve, reject) {
      if (!resolvedUrl) {
        reject(new Error("Texture URL is not set."));
        return;
      }

      loader.load(
        resolvedUrl,
        function (texture) {
          if (colorSpace) {
            texture.colorSpace = colorSpace;
          }
          texture.anisotropy = anisotropy || 1;
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.needsUpdate = true;
          resolve(texture);
        },
        undefined,
        function (error) {
          reject(error || new Error("Failed loading texture: " + resolvedUrl));
        }
      );
    });
  }

  function createHaloTexture(innerColor, outerColor) {
    var size = 256;
    var canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    var context = canvas.getContext("2d");
    if (!context) {
      return null;
    }

    var centerX = size * 0.5;
    var centerY = size * 0.5;
    var gradient = context.createRadialGradient(centerX, centerY, size * 0.04, centerX, centerY, size * 0.5);
    var inner = innerColor || [255, 180, 110];
    var outer = outerColor || [98, 122, 194];

    gradient.addColorStop(0, "rgba(" + inner[0] + ", " + inner[1] + ", " + inner[2] + ", 0.78)");
    gradient.addColorStop(0.2, "rgba(" + inner[0] + ", " + inner[1] + ", " + inner[2] + ", 0.36)");
    gradient.addColorStop(0.55, "rgba(" + outer[0] + ", " + outer[1] + ", " + outer[2] + ", 0.16)");
    gradient.addColorStop(1, "rgba(" + outer[0] + ", " + outer[1] + ", " + outer[2] + ", 0)");

    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    var texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  }

  function createTimeFabricMesh() {
    var segmentCount = CONFIG.fabric.segments;
    var vertexCountPerAxis = segmentCount + 1;
    var geometry = new THREE.PlaneGeometry(
      CONFIG.fabric.size,
      CONFIG.fabric.size,
      segmentCount,
      segmentCount
    );
    geometry.rotateX(-Math.PI / 2);

    var fill = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: 0x10243d,
        transparent: true,
        opacity: 0.34,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    fill.position.y = CONFIG.fabric.baseY;
    scene.add(fill);

    var wire = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: 0x5b96cc,
        wireframe: true,
        transparent: true,
        opacity: 0.26,
        depthWrite: false
      })
    );
    wire.position.y = CONFIG.fabric.baseY + 0.025;
    scene.add(wire);

    return {
      geometry: geometry,
      base: Float32Array.from(geometry.attributes.position.array),
      fill: fill,
      wire: wire,
      xCount: vertexCountPerAxis,
      zCount: vertexCountPerAxis
    };
  }

  function createWarpWaterfallState(field) {
    var xCount = field && field.xCount ? field.xCount : CONFIG.fabric.segments + 1;
    var zCount = field && field.zCount ? field.zCount : CONFIG.fabric.segments + 1;
    var historyLength = xCount * zCount;

    return {
      history: new Float32Array(historyLength),
      rowBuffer: new Float32Array(xCount),
      scratch: new Float32Array(historyLength),
      accumulator: 0,
      focus: 0,
      phaseA: Math.random() * TWO_PI,
      phaseB: Math.random() * TWO_PI,
      phaseC: Math.random() * TWO_PI
    };
  }

  function createStars(count, minRadius, maxRadius) {
    var positions = new Float32Array(count * 3);

    for (var i = 0; i < count; i += 1) {
      var radius = minRadius + Math.random() * (maxRadius - minRadius);
      var theta = Math.random() * TWO_PI;
      var phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi);
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

    var material = new THREE.PointsMaterial({
      color: 0xcde3ff,
      size: 1.08,
      transparent: true,
      opacity: 0.74,
      sizeAttenuation: true,
      depthWrite: false
    });

    return new THREE.Points(geometry, material);
  }

  function createAudioReactiveController(config) {
    var settings = config || {};
    var enabled = settings.enabled !== false && settings.provider === "obsWebSocket";
    var supportsWebSocket = typeof window.WebSocket === "function";
    var targetInputs = normalizeInputFilters(settings.targetInputs);

    var state = {
      ws: null,
      rawLevel: 0,
      rawRms: 0,
      rawPeak: 0,
      rawTransient: 0,
      rawBalance: 0,
      smoothedLevel: 0,
      smoothedRms: 0,
      smoothedPeak: 0,
      smoothedTransient: 0,
      smoothedBalance: 0,
      reconnectHandle: 0,
      reconnectAttempt: 0,
      warnedNoTargetMatch: false,
      stopping: false,
      status: "idle",
      featureSnapshot: {
        level: 0,
        rms: 0,
        peak: 0,
        transient: 0,
        balance: 0
      }
    };

    if (!enabled || !supportsWebSocket) {
      if (enabled && !supportsWebSocket) {
        console.warn("Audio reactive mode disabled: WebSocket not supported in this browser source.");
      }
      return {
        start: function () {},
        stop: function () {},
        update: function () { return 0; },
        getFeatures: function () {
          return {
            level: 0,
            rms: 0,
            peak: 0,
            transient: 0,
            balance: 0
          };
        }
      };
    }

    var wsUrl = typeof settings.url === "string" ? settings.url.trim() : "";
    if (!wsUrl) {
      wsUrl = "ws://127.0.0.1:4455";
    }

    var wsPassword = typeof settings.password === "string" ? settings.password : "";
    var gain = Math.max(0, Number(settings.gain) || 0);
    var attack = Math.max(0.01, Number(settings.attack) || 0.01);
    var release = Math.max(0.01, Number(settings.release) || 0.01);
    var maxBoost = Math.max(0, Number(settings.maxBoost) || 0);
    var reconnectBaseMs = Math.max(250, Number(settings.reconnectBaseMs) || 900);
    var reconnectMaxMs = Math.max(reconnectBaseMs, Number(settings.reconnectMaxMs) || 9000);
    var noiseFloorDb = Number(settings.noiseFloorDb);
    if (!isFinite(noiseFloorDb)) {
      noiseFloorDb = -58;
    }
    var noiseFloorLinear = dbToLinear(noiseFloorDb);
    var dynamicRange = Math.max(0.0001, 1 - noiseFloorLinear);

    function start() {
      state.stopping = false;
      connect();
    }

    function stop() {
      state.stopping = true;
      if (state.reconnectHandle) {
        clearTimeout(state.reconnectHandle);
        state.reconnectHandle = 0;
      }
      if (state.ws) {
        try {
          state.ws.close();
        } catch (error) {
          console.warn("Audio websocket close warning:", error);
        }
        state.ws = null;
      }
      state.status = "stopped";
    }

    function update(delta) {
      var frameDelta = isFinite(delta) && delta > 0 ? delta : 0.016;
      state.rawLevel *= Math.exp(-frameDelta * 7.8);
      state.rawRms *= Math.exp(-frameDelta * 6.4);
      state.rawPeak *= Math.exp(-frameDelta * 9.6);
      state.rawTransient *= Math.exp(-frameDelta * 11.2);
      state.rawBalance *= Math.exp(-frameDelta * 2.7);

      var targetLevel = clamp01((Math.max(state.rawLevel, state.rawPeak) - noiseFloorLinear) / dynamicRange);
      targetLevel = clamp01(targetLevel * gain);

      var targetRms = clamp01((state.rawRms - noiseFloorLinear) / dynamicRange);
      targetRms = clamp01(targetRms * gain * 0.95);

      var targetPeak = clamp01((state.rawPeak - noiseFloorLinear) / dynamicRange);
      targetPeak = clamp01(targetPeak * gain * 1.05);

      var targetTransient = clamp01(targetPeak - targetRms * 0.85 + state.rawTransient * 0.35);
      var targetBalance = clampSigned(state.rawBalance);

      var levelRate = targetLevel > state.smoothedLevel ? attack : release;
      var levelBlend = 1 - Math.exp(-frameDelta * levelRate * 12);
      state.smoothedLevel += (targetLevel - state.smoothedLevel) * levelBlend;

      var rmsRate = targetRms > state.smoothedRms ? attack * 0.85 : release * 0.9;
      var rmsBlend = 1 - Math.exp(-frameDelta * rmsRate * 10);
      state.smoothedRms += (targetRms - state.smoothedRms) * rmsBlend;

      var peakRate = targetPeak > state.smoothedPeak ? attack * 1.15 : release * 0.75;
      var peakBlend = 1 - Math.exp(-frameDelta * peakRate * 13.5);
      state.smoothedPeak += (targetPeak - state.smoothedPeak) * peakBlend;

      var transientRate = targetTransient > state.smoothedTransient ? attack * 1.75 : release * 0.7;
      var transientBlend = 1 - Math.exp(-frameDelta * transientRate * 16);
      state.smoothedTransient += (targetTransient - state.smoothedTransient) * transientBlend;

      var balanceBlend = 1 - Math.exp(-frameDelta * 6.5);
      state.smoothedBalance += (targetBalance - state.smoothedBalance) * balanceBlend;

      state.featureSnapshot.level = clamp01(state.smoothedLevel);
      state.featureSnapshot.rms = clamp01(state.smoothedRms);
      state.featureSnapshot.peak = clamp01(state.smoothedPeak);
      state.featureSnapshot.transient = clamp01(state.smoothedTransient);
      state.featureSnapshot.balance = clampSigned(state.smoothedBalance);

      return clamp01(state.featureSnapshot.level * maxBoost);
    }

    function connect() {
      if (state.stopping || state.ws) {
        return;
      }

      var ws;
      try {
        ws = new window.WebSocket(wsUrl, "obswebsocket.json");
      } catch (error) {
        console.warn("Audio websocket open failed:", error);
        scheduleReconnect();
        return;
      }

      state.ws = ws;
      state.status = "connecting";

      ws.onopen = function () {
        state.status = "socket-open";
      };

      ws.onmessage = function (event) {
        handleSocketMessage(event.data);
      };

      ws.onerror = function () {
        state.status = "error";
      };

      ws.onclose = function () {
        if (state.ws === ws) {
          state.ws = null;
        }
        if (!state.stopping) {
          state.status = "closed";
          scheduleReconnect();
        }
      };
    }

    function scheduleReconnect() {
      if (state.reconnectHandle || state.stopping) {
        return;
      }

      var delay = Math.min(reconnectMaxMs, reconnectBaseMs * Math.pow(1.55, state.reconnectAttempt));
      state.reconnectAttempt += 1;
      state.reconnectHandle = setTimeout(function () {
        state.reconnectHandle = 0;
        connect();
      }, delay);
    }

    function handleSocketMessage(rawData) {
      var message;
      try {
        message = JSON.parse(rawData);
      } catch (error) {
        return;
      }

      if (!message || typeof message.op !== "number") {
        return;
      }

      var data = message.d || {};

      if (message.op === 0) {
        handleHello(data);
        return;
      }

      if (message.op === 2) {
        state.status = "identified";
        state.reconnectAttempt = 0;
        return;
      }

      if (message.op === 5 && data.eventType === "InputVolumeMeters") {
        ingestVolumeEvent(data.eventData);
      }
    }

    function handleHello(helloData) {
      if (!helloData || typeof helloData !== "object") {
        return;
      }

      var rpcVersion = typeof helloData.rpcVersion === "number" && isFinite(helloData.rpcVersion)
        ? Math.max(1, Math.floor(helloData.rpcVersion))
        : 1;

      var identify = {
        rpcVersion: rpcVersion,
        eventSubscriptions: 2047 | (1 << 16)
      };

      var authData = helloData.authentication;
      if (!authData || typeof authData !== "object") {
        sendSocketMessage({ op: 1, d: identify });
        return;
      }

      createObsWebSocketAuth(wsPassword, authData.salt, authData.challenge)
        .then(function (authString) {
          identify.authentication = authString;
          sendSocketMessage({ op: 1, d: identify });
        })
        .catch(function (error) {
          console.warn("Audio websocket authentication failed:", error);
          if (state.ws) {
            try {
              state.ws.close();
            } catch (closeError) {
              console.warn("Audio websocket close warning:", closeError);
            }
          }
        });
    }

    function sendSocketMessage(payload) {
      if (!state.ws || state.ws.readyState !== 1) {
        return;
      }
      state.ws.send(JSON.stringify(payload));
    }

    function ingestVolumeEvent(eventData) {
      if (!eventData || !Array.isArray(eventData.inputs)) {
        return;
      }

      var inputs = eventData.inputs;
      var aggregate = {
        level: 0,
        rms: 0,
        peak: 0,
        transient: 0,
        balanceWeighted: 0,
        balanceWeight: 0
      };
      var foundTarget = targetInputs.length === 0;

      for (var i = 0; i < inputs.length; i += 1) {
        var input = inputs[i];
        if (!input || typeof input !== "object") {
          continue;
        }

        var inputName = normalizeInputName(input.inputName);
        if (targetInputs.length > 0 && targetInputs.indexOf(inputName) === -1) {
          continue;
        }

        foundTarget = true;
        mergeMeterFeatures(aggregate, extractInputMeterFeatures(input));
      }

      if (!foundTarget) {
        if (!state.warnedNoTargetMatch) {
          state.warnedNoTargetMatch = true;
          console.warn("Audio reactive: target input not found in InputVolumeMeters events. Falling back to all active inputs.");
        }
        for (var j = 0; j < inputs.length; j += 1) {
          mergeMeterFeatures(aggregate, extractInputMeterFeatures(inputs[j]));
        }
      }

      var resolvedBalance = aggregate.balanceWeight > 0
        ? aggregate.balanceWeighted / aggregate.balanceWeight
        : 0;

      state.rawLevel = Math.max(aggregate.level, state.rawLevel * 0.72);
      state.rawRms = Math.max(aggregate.rms, state.rawRms * 0.75);
      state.rawPeak = Math.max(aggregate.peak, state.rawPeak * 0.7);
      state.rawTransient = Math.max(aggregate.transient, state.rawTransient * 0.65);
      state.rawBalance += (clampSigned(resolvedBalance) - state.rawBalance) * 0.58;
    }

    return {
      start: start,
      stop: stop,
      update: update,
      getFeatures: function () {
        return state.featureSnapshot;
      }
    };
  }

  function normalizeInputFilters(inputList) {
    var source = ensureArray(inputList);
    var output = [];

    for (var i = 0; i < source.length; i += 1) {
      var normalized = normalizeInputName(source[i]);
      if (!normalized || output.indexOf(normalized) >= 0) {
        continue;
      }
      output.push(normalized);
    }

    return output;
  }

  function normalizeInputName(name) {
    if (typeof name !== "string") {
      return "";
    }
    return name.trim().toLowerCase();
  }

  function normalizeAudioReactiveMode(modeValue) {
    if (typeof modeValue !== "string") {
      return "gravityWarp";
    }

    var normalized = modeValue.trim().toLowerCase();
    if (!normalized) {
      return "gravityWarp";
    }

    if (normalized === "waterfallgraph" || normalized === "waterfall" || normalized === "wf") {
      return "waterfallGraph";
    }

    return "gravityWarp";
  }

  function mergeMeterFeatures(target, features) {
    if (!target || !features) {
      return;
    }

    target.level = Math.max(target.level, clamp01(features.level));
    target.rms = Math.max(target.rms, clamp01(features.rms));
    target.peak = Math.max(target.peak, clamp01(features.peak));
    target.transient = Math.max(target.transient, clamp01(features.transient));

    if (features.hasBalance) {
      var weight = Math.max(0.08, clamp01(features.level));
      target.balanceWeighted += clampSigned(features.balance) * weight;
      target.balanceWeight += weight;
    }
  }

  function extractInputMeterFeatures(input) {
    var fallbackLevel = extractInputMeterLevel(input);
    var fallback = {
      level: fallbackLevel,
      rms: fallbackLevel,
      peak: fallbackLevel,
      transient: 0,
      balance: 0,
      hasBalance: false
    };

    if (!input || typeof input !== "object" || !Array.isArray(input.inputLevelsMul)) {
      return fallback;
    }

    var channels = input.inputLevelsMul;
    var sumMagnitude = 0;
    var maxPeak = 0;
    var channelCount = 0;
    var leftMagnitude = null;
    var rightMagnitude = null;

    for (var c = 0; c < channels.length; c += 1) {
      var channelData = channels[c];
      if (!Array.isArray(channelData) || channelData.length === 0) {
        continue;
      }

      var magnitude = Number(channelData[0]);
      var peak = channelData.length > 1 ? Number(channelData[1]) : magnitude;

      if (!isFinite(magnitude) || magnitude < 0) {
        magnitude = 0;
      }
      if (!isFinite(peak) || peak < 0) {
        peak = magnitude;
      }

      magnitude = clamp01(magnitude);
      peak = clamp01(peak);

      sumMagnitude += magnitude;
      maxPeak = Math.max(maxPeak, peak);

      if (channelCount === 0) {
        leftMagnitude = magnitude;
      } else if (channelCount === 1) {
        rightMagnitude = magnitude;
      }
      channelCount += 1;
    }

    if (channelCount <= 0) {
      return fallback;
    }

    var rms = clamp01(sumMagnitude / channelCount);
    var level = Math.max(rms, maxPeak);
    var transient = clamp01(maxPeak - rms);
    var balance = 0;
    var hasBalance = leftMagnitude !== null && rightMagnitude !== null;

    if (hasBalance) {
      balance = (rightMagnitude - leftMagnitude) / Math.max(0.001, rightMagnitude + leftMagnitude);
    }

    return {
      level: level,
      rms: rms,
      peak: maxPeak,
      transient: transient,
      balance: balance,
      hasBalance: hasBalance
    };
  }

  function extractInputMeterLevel(input) {
    if (!input || typeof input !== "object") {
      return 0;
    }

    var levelMul = Math.max(
      extractLinearMeterPeak(input.inputLevelsMul),
      extractLinearMeterPeak(input.inputLevelMul),
      extractLinearMeterPeak(input.inputPeakMul)
    );

    var levelDb = Math.max(
      extractDbMeterPeak(input.inputLevelsDb),
      extractDbMeterPeak(input.inputLevelDb),
      extractDbMeterPeak(input.inputPeakDb)
    );

    return clamp01(Math.max(levelMul, levelDb));
  }

  function extractLinearMeterPeak(value) {
    var samples = [];
    collectNumericSamples(value, samples, 0);
    if (samples.length === 0) {
      return 0;
    }

    var peak = 0;
    for (var i = 0; i < samples.length; i += 1) {
      peak = Math.max(peak, samples[i]);
    }
    return clamp01(peak);
  }

  function extractDbMeterPeak(value) {
    var samples = [];
    collectNumericSamples(value, samples, 0);
    if (samples.length === 0) {
      return 0;
    }

    var peak = 0;
    for (var i = 0; i < samples.length; i += 1) {
      peak = Math.max(peak, dbToLinear(samples[i]));
    }
    return clamp01(peak);
  }

  function collectNumericSamples(value, output, depth) {
    if (depth > 6 || output.length > 48 || value === null || value === undefined) {
      return;
    }

    if (typeof value === "number") {
      if (isFinite(value)) {
        output.push(value);
      }
      return;
    }

    if (Array.isArray(value)) {
      for (var i = 0; i < value.length; i += 1) {
        collectNumericSamples(value[i], output, depth + 1);
      }
      return;
    }

    if (typeof value === "object") {
      var keys = Object.keys(value);
      for (var k = 0; k < keys.length; k += 1) {
        collectNumericSamples(value[keys[k]], output, depth + 1);
      }
    }
  }

  function dbToLinear(dbValue) {
    if (!isFinite(dbValue)) {
      return 0;
    }
    if (dbValue <= -120) {
      return 0;
    }
    return Math.pow(10, dbValue / 20);
  }

  function createObsWebSocketAuth(password, salt, challenge) {
    if (!window.crypto || !window.crypto.subtle || typeof window.TextEncoder !== "function") {
      return Promise.reject(new Error("Web Crypto API not available for OBS websocket authentication."));
    }

    var safePassword = typeof password === "string" ? password : "";
    return sha256Base64(safePassword + String(salt || ""))
      .then(function (secret) {
        return sha256Base64(secret + String(challenge || ""));
      });
  }

  function sha256Base64(text) {
    var encoder = new window.TextEncoder();
    var bytes = encoder.encode(String(text));
    return window.crypto.subtle.digest("SHA-256", bytes).then(arrayBufferToBase64);
  }

  function arrayBufferToBase64(buffer) {
    var bytes = new Uint8Array(buffer);
    var binary = "";
    for (var i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  function startDateTimeTicker(element) {
    if (!element) {
      return function () {};
    }

    var formatDateTime = createDateTimeFormatter();

    function updateDateTime() {
      element.textContent = formatDateTime(new Date());
    }

    updateDateTime();
    var timer = setInterval(updateDateTime, 1000);

    return function stopTicker() {
      if (!timer) {
        return;
      }
      clearInterval(timer);
      timer = 0;
    };
  }

  function createDateTimeFormatter() {
    var dateTimeFormatter = null;
    var timeZoneFormatter = null;

    if (window.Intl && typeof window.Intl.DateTimeFormat === "function") {
      try {
        dateTimeFormatter = new window.Intl.DateTimeFormat(undefined, {
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "2-digit",
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit"
        });
      } catch (error) {
        dateTimeFormatter = null;
      }

      try {
        timeZoneFormatter = new window.Intl.DateTimeFormat(undefined, {
          timeZoneName: "short"
        });
      } catch (error) {
        timeZoneFormatter = null;
      }
    }

    return function formatDateTime(dateValue) {
      var date = dateValue instanceof Date ? dateValue : new Date(dateValue);
      var dateText = dateTimeFormatter ? dateTimeFormatter.format(date) : date.toLocaleString();
      var timeZoneText = extractTimeZoneLabel(timeZoneFormatter, date) || fallbackTimeZoneLabel(date);
      return dateText + " " + timeZoneText;
    };
  }

  function extractTimeZoneLabel(formatter, date) {
    if (!formatter || typeof formatter.formatToParts !== "function") {
      return "";
    }

    try {
      var parts = formatter.formatToParts(date);
      for (var i = 0; i < parts.length; i += 1) {
        if (parts[i] && parts[i].type === "timeZoneName" && parts[i].value) {
          return parts[i].value;
        }
      }
    } catch (error) {
      return "";
    }

    return "";
  }

  function fallbackTimeZoneLabel(date) {
    var offsetMinutes = -date.getTimezoneOffset();
    var sign = offsetMinutes >= 0 ? "+" : "-";
    var absMinutes = Math.abs(offsetMinutes);
    var hours = Math.floor(absMinutes / 60);
    var minutes = absMinutes % 60;
    return "UTC" + sign + pad2(hours) + ":" + pad2(minutes);
  }

  function pad2(value) {
    return value < 10 ? "0" + value : String(value);
  }

  function applyOverlayTypography(overlayConfig) {
    if (!overlayConfig) {
      return;
    }

    var root = document.documentElement;
    if (root) {
      setRootCssVariable(root, "--font-title", overlayConfig.titleFontFamily);
      setRootCssVariable(root, "--font-subtitle", overlayConfig.subtitleFontFamily);
      setRootCssVariable(root, "--title-weight", overlayConfig.titleFontWeight);
      setRootCssVariable(root, "--subtitle-weight", overlayConfig.subtitleFontWeight);
      setRootCssVariable(root, "--title-transform", overlayConfig.titleTextTransform);
      setRootCssVariable(root, "--subtitle-transform", overlayConfig.subtitleTextTransform);
      setRootCssVariable(root, "--overlay-top", overlayConfig.overlayTop, "px");
      setRootCssVariable(root, "--overlay-top-mobile", overlayConfig.overlayTopMobile, "px");
      setRootCssVariable(root, "--title-offset-x", overlayConfig.titleOffsetX, "px");
      setRootCssVariable(root, "--title-offset-y", overlayConfig.titleOffsetY, "px");
      setRootCssVariable(root, "--subtitle-offset-x", overlayConfig.subtitleOffsetX, "px");
      setRootCssVariable(root, "--subtitle-offset-y", overlayConfig.subtitleOffsetY, "px");
      setRootCssVariable(root, "--title-kerning", overlayConfig.titleKerning, "em");
      setRootCssVariable(root, "--subtitle-kerning", overlayConfig.subtitleKerning, "em");
    }

    var head = document.head;
    if (!head) {
      return;
    }

    var stylesheetUrls = ensureArray(overlayConfig.externalFontStylesheets);
    for (var i = 0; i < stylesheetUrls.length; i += 1) {
      var href = stylesheetUrls[i];
      if (typeof href !== "string") {
        continue;
      }

      var trimmedHref = href.trim();
      if (!trimmedHref) {
        continue;
      }

      var stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = trimmedHref;
      head.appendChild(stylesheet);
    }

    var customFaces = ensureArray(overlayConfig.customFontFaces);
    var faceRules = [];
    for (var f = 0; f < customFaces.length; f += 1) {
      var face = customFaces[f];
      if (!face || typeof face !== "object") {
        continue;
      }

      var family = typeof face.family === "string" ? face.family.trim() : "";
      var src = normalizeFontSource(face.src);
      if (!family || !src) {
        continue;
      }

      var style = pickDefined(face.style, "normal");
      var weight = pickDefined(face.weight, "400");
      var display = pickDefined(face.display, "swap");

      faceRules.push(
        "@font-face{" +
          "font-family:'" + escapeCssText(family) + "';" +
          "src:" + src + ";" +
          "font-style:" + style + ";" +
          "font-weight:" + weight + ";" +
          "font-display:" + display + ";" +
        "}"
      );
    }

    if (faceRules.length > 0) {
      var faceStyleTag = document.createElement("style");
      faceStyleTag.type = "text/css";
      faceStyleTag.textContent = faceRules.join("\n");
      head.appendChild(faceStyleTag);
    }
  }

  function setRootCssVariable(root, variableName, rawValue, defaultUnit) {
    if (!root || !variableName) {
      return;
    }

    var cssValue = normalizeCssValue(rawValue, defaultUnit);
    if (!cssValue) {
      return;
    }

    root.style.setProperty(variableName, cssValue);
  }

  function normalizeCssValue(value, defaultUnit) {
    if (value === undefined || value === null) {
      return "";
    }

    if (typeof value === "number") {
      if (!isFinite(value)) {
        return "";
      }
      return String(value) + (defaultUnit || "");
    }

    if (typeof value === "string") {
      var trimmedValue = value.trim();
      return trimmedValue || "";
    }

    return "";
  }

  function normalizeFontSource(srcValue) {
    if (typeof srcValue !== "string") {
      return "";
    }

    var trimmed = srcValue.trim();
    if (!trimmed) {
      return "";
    }

    if (/^url\(/i.test(trimmed)) {
      return trimmed;
    }

    if (trimmed.charAt(0) === "@") {
      trimmed = trimmed.slice(1).trim();
    }

    if (!trimmed) {
      return "";
    }

    var format = guessFontFormat(trimmed);
    var src = "url('" + escapeCssText(trimmed.replace(/\\/g, "/")) + "')";
    if (format) {
      src += " format('" + format + "')";
    }
    return src;
  }

  function normalizeOptionalUrl(value) {
    if (typeof value !== "string") {
      return "";
    }

    var trimmed = value.trim();
    if (!trimmed) {
      return "";
    }

    if (trimmed.charAt(0) === "@") {
      return trimmed.slice(1).trim();
    }

    return trimmed;
  }

  function guessFontFormat(path) {
    if (typeof path !== "string") {
      return "";
    }

    var plainPath = path.split("?")[0].split("#")[0].toLowerCase();
    var extensionIndex = plainPath.lastIndexOf(".");
    if (extensionIndex < 0) {
      return "";
    }

    var extension = plainPath.slice(extensionIndex + 1);
    if (extension === "woff2") {
      return "woff2";
    }
    if (extension === "woff") {
      return "woff";
    }
    if (extension === "ttf") {
      return "truetype";
    }
    if (extension === "otf") {
      return "opentype";
    }
    return "";
  }

  function mergeUniqueStrings(baseList, overrideList) {
    var out = [];
    var i;

    for (i = 0; i < baseList.length; i += 1) {
      pushUniqueString(out, baseList[i]);
    }
    for (i = 0; i < overrideList.length; i += 1) {
      pushUniqueString(out, overrideList[i]);
    }

    return out;
  }

  function pushUniqueString(target, value) {
    if (typeof value !== "string") {
      return;
    }
    var trimmed = value.trim();
    if (!trimmed || target.indexOf(trimmed) >= 0) {
      return;
    }
    target.push(trimmed);
  }

  function mergeFontFaceDefinitions(baseFaces, overrideFaces) {
    var out = [];
    var keys = [];
    var i;

    for (i = 0; i < baseFaces.length; i += 1) {
      pushUniqueFontFace(out, keys, baseFaces[i]);
    }
    for (i = 0; i < overrideFaces.length; i += 1) {
      pushUniqueFontFace(out, keys, overrideFaces[i]);
    }

    return out;
  }

  function pushUniqueFontFace(target, keys, value) {
    if (!value || typeof value !== "object") {
      return;
    }

    var family = typeof value.family === "string" ? value.family.trim().toLowerCase() : "";
    var src = typeof value.src === "string" ? value.src.trim().toLowerCase() : "";
    var key = family + "::" + src;
    if (!family || !src || keys.indexOf(key) >= 0) {
      return;
    }

    keys.push(key);
    target.push(value);
  }

  function wrappedDistance(a, b) {
    var delta = Math.abs(a - b);
    return Math.min(delta, 1 - delta);
  }

  function fbm2D(x, y, seed) {
    var total = 0;
    var amplitude = 0.5;
    var frequency = 1;

    for (var i = 0; i < 4; i += 1) {
      total += amplitude * valueNoise2D(x * frequency, y * frequency, seed + i * 1297);
      frequency *= 2.03;
      amplitude *= 0.5;
    }

    return total;
  }

  function valueNoise2D(x, y, seed) {
    var x0 = Math.floor(x);
    var y0 = Math.floor(y);
    var xf = x - x0;
    var yf = y - y0;

    var n00 = hash2(x0, y0, seed);
    var n10 = hash2(x0 + 1, y0, seed);
    var n01 = hash2(x0, y0 + 1, seed);
    var n11 = hash2(x0 + 1, y0 + 1, seed);

    var u = smoothStep(xf);
    var v = smoothStep(yf);
    var nx0 = lerp(n00, n10, u);
    var nx1 = lerp(n01, n11, u);
    return lerp(nx0, nx1, v);
  }

  function hash2(x, y, seed) {
    var n = (x * 374761393 + y * 668265263 + seed * 1446641) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    n = n ^ (n >>> 16);
    return (n >>> 0) / 4294967295;
  }

  function smoothStep(t) {
    return t * t * (3 - 2 * t);
  }

  function smoothRange(edge0, edge1, value) {
    var t = clamp01((value - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
  }

  function clamp01(value) {
    if (value < 0) {
      return 0;
    }
    if (value > 1) {
      return 1;
    }
    return value;
  }

  function clampSigned(value) {
    if (value < -1) {
      return -1;
    }
    if (value > 1) {
      return 1;
    }
    return value;
  }

  function clampRange(value, min, max, fallback) {
    if (!isFinite(value)) {
      return fallback;
    }
    if (value < min) {
      return min;
    }
    if (value > max) {
      return max;
    }
    return value;
  }

  function clampByte(value) {
    if (value < 0) {
      return 0;
    }
    if (value > 255) {
      return 255;
    }
    return value;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function pickDefined(value, fallback) {
    return value === undefined || value === null ? fallback : value;
  }

  function ensureArray(value) {
    if (Array.isArray(value)) {
      return value.slice();
    }
    if (value === undefined || value === null || value === "") {
      return [];
    }
    return [value];
  }

  function toRadians(value) {
    return value * Math.PI / 180;
  }

  function escapeCssText(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }
})();
