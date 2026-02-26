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
  var brbOverlay = streamConfig.overlayBRB && typeof streamConfig.overlayBRB === "object" ? streamConfig.overlayBRB : {};
  var audioOverrides = streamConfig.audioReactive && typeof streamConfig.audioReactive === "object" ? streamConfig.audioReactive : {};

  var CONFIG = {
    overlay: {
      title: pickDefined(brbOverlay.title, "BE RIGHT BACK"),
      subtitle: pickDefined(brbOverlay.subtitle, "Crossing the event horizon. Return imminent."),
      titleFontFamily: pickDefined(brbOverlay.titleFontFamily, pickDefined(baseOverlay.titleFontFamily, '"Trebuchet MS", "Gill Sans", "Segoe UI", sans-serif')),
      subtitleFontFamily: pickDefined(brbOverlay.subtitleFontFamily, pickDefined(baseOverlay.subtitleFontFamily, '"Trebuchet MS", "Gill Sans", "Segoe UI", sans-serif')),
      titleFontWeight: pickDefined(brbOverlay.titleFontWeight, pickDefined(baseOverlay.titleFontWeight, 700)),
      subtitleFontWeight: pickDefined(brbOverlay.subtitleFontWeight, pickDefined(baseOverlay.subtitleFontWeight, 400)),
      titleTextTransform: pickDefined(brbOverlay.titleTextTransform, pickDefined(baseOverlay.titleTextTransform, "uppercase")),
      subtitleTextTransform: pickDefined(brbOverlay.subtitleTextTransform, pickDefined(baseOverlay.subtitleTextTransform, "none")),
      externalFontStylesheets: ensureArray(pickDefined(brbOverlay.externalFontStylesheets, baseOverlay.externalFontStylesheets)),
      customFontFaces: ensureArray(pickDefined(brbOverlay.customFontFaces, baseOverlay.customFontFaces)),
      overlayTop: pickDefined(brbOverlay.overlayTop, pickDefined(baseOverlay.overlayTop, "min(6vh, 56px)")),
      overlayTopMobile: pickDefined(brbOverlay.overlayTopMobile, pickDefined(baseOverlay.overlayTopMobile, 24)),
      titleOffsetX: pickDefined(brbOverlay.titleOffsetX, pickDefined(baseOverlay.titleOffsetX, 0)),
      titleOffsetY: pickDefined(brbOverlay.titleOffsetY, pickDefined(baseOverlay.titleOffsetY, 0)),
      subtitleOffsetX: pickDefined(brbOverlay.subtitleOffsetX, pickDefined(baseOverlay.subtitleOffsetX, 0)),
      subtitleOffsetY: pickDefined(brbOverlay.subtitleOffsetY, pickDefined(baseOverlay.subtitleOffsetY, 0)),
      titleKerning: pickDefined(brbOverlay.titleKerning, pickDefined(baseOverlay.titleKerning, 0.14)),
      subtitleKerning: pickDefined(brbOverlay.subtitleKerning, pickDefined(baseOverlay.subtitleKerning, 0.05))
    },
    renderer: {
      maxPixelRatio: 1.6,
      exposure: 1.06
    },
    camera: {
      radius: 80,
      orbitSpeed: 0.006,
      height: 19,
      bobAmount: 0.42,
      lookHeight: -1.9
    },
    blackHole: {
      coreRadius: 6.2,
      eventHorizonRadius: 6.2,
      shadowRadius: 12.4,
      diskInnerRadius: 19.2,
      diskOuterRadius: 58,
      diskTilt: toRadians(84),
      haloScale: 62,
      warpSize: 240,
      warpSegments: 176,
      warpBaseY: -13,
      warpWellDepth: 5.2,
      warpWaveAmp: 0.74
    },
    audioReactive: {
      enabled: pickDefined(audioOverrides.enabled, true),
      provider: pickDefined(audioOverrides.provider, "obsWebSocket"),
      url: pickDefined(audioOverrides.url, "ws://127.0.0.1:4455"),
      password: pickDefined(audioOverrides.password, ""),
      targetInputs: ensureArray(pickDefined(audioOverrides.targetInputs, ["Desktop Audio", "Desktop Audio 2"])),
      noiseFloorDb: pickDefined(audioOverrides.noiseFloorDb, -58),
      gain: pickDefined(audioOverrides.gain, 1.2),
      attack: pickDefined(audioOverrides.attack, 0.5),
      release: pickDefined(audioOverrides.release, 0.08),
      maxBoost: pickDefined(audioOverrides.maxBoost, 0.9),
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
  scene.fog = new THREE.FogExp2(0x05050a, 0.0049);

  var camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.1, 1700);
  camera.position.set(0, CONFIG.camera.height, CONFIG.camera.radius);

  var ambientLight = new THREE.AmbientLight(0x53627e, 0.28);
  scene.add(ambientLight);

  var diskLight = new THREE.PointLight(0xffb56a, 4.4, 0, 1.4);
  diskLight.position.set(0, -1.2, 0);
  scene.add(diskLight);

  var backLight = new THREE.PointLight(0x5f7ecc, 2.7, 0, 1.2);
  backLight.position.set(0, 14, -20);
  scene.add(backLight);

  var stars = createStars(window.innerWidth < 900 ? 3000 : 4600, 180, 900);
  scene.add(stars);

  var blackHoleGroup = new THREE.Group();
  scene.add(blackHoleGroup);

  var core = new THREE.Mesh(
    new THREE.SphereGeometry(CONFIG.blackHole.coreRadius, 62, 62),
    new THREE.MeshPhysicalMaterial({
      color: 0x020203,
      roughness: 0.96,
      metalness: 0.08,
      clearcoat: 0.32,
      clearcoatRoughness: 0.82
    })
  );
  blackHoleGroup.add(core);

  var shadowDisk = new THREE.Mesh(
    new THREE.CircleGeometry(CONFIG.blackHole.shadowRadius, 128),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: false,
      depthWrite: true,
      side: THREE.DoubleSide
    })
  );
  shadowDisk.position.z = 0.05;
  shadowDisk.renderOrder = 5;
  blackHoleGroup.add(shadowDisk);

  var photonRingDiameter = CONFIG.blackHole.shadowRadius * 3.2;
  var photonRingShadowNorm = CONFIG.blackHole.shadowRadius / (photonRingDiameter * 0.5);
  var photonRingMaterial = createPhotonRingMaterial(photonRingShadowNorm);
  var photonRing = new THREE.Mesh(
    new THREE.PlaneGeometry(photonRingDiameter, photonRingDiameter, 1, 1),
    photonRingMaterial
  );
  photonRing.position.z = 0.08;
  photonRing.renderOrder = 4;
  blackHoleGroup.add(photonRing);

  var diskMaterial = createAccretionDiskMaterial(CONFIG.blackHole.diskInnerRadius, CONFIG.blackHole.diskOuterRadius);
  var accretionDisk = new THREE.Mesh(
    new THREE.RingGeometry(CONFIG.blackHole.diskInnerRadius, CONFIG.blackHole.diskOuterRadius, 320, 1),
    diskMaterial
  );
  accretionDisk.rotation.x = CONFIG.blackHole.diskTilt;
  blackHoleGroup.add(accretionDisk);

  var accretionParticles = createAccretionParticles(CONFIG.blackHole.diskInnerRadius + 0.8, CONFIG.blackHole.diskOuterRadius + 2.2, 2200);
  accretionParticles.points.rotation.x = CONFIG.blackHole.diskTilt;
  blackHoleGroup.add(accretionParticles.points);

  var coolHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createHaloTexture([238, 112, 46], [76, 48, 40]),
      color: 0xffa964,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  coolHalo.scale.set(CONFIG.blackHole.haloScale, CONFIG.blackHole.haloScale, 1);
  coolHalo.position.set(0, -0.7, 0);
  blackHoleGroup.add(coolHalo);

  var warmHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createHaloTexture([255, 182, 96], [122, 51, 24]),
      color: 0xffcc94,
      transparent: true,
      opacity: 0.29,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  warmHalo.scale.set(CONFIG.blackHole.haloScale * 0.78, CONFIG.blackHole.haloScale * 0.78, 1);
  warmHalo.position.set(0, -0.5, 0);
  blackHoleGroup.add(warmHalo);

  var warpField = createWarpField();
  var audioReactive = createAudioReactiveController(CONFIG.audioReactive);
  var clock = new THREE.Clock();
  var tempDiskNormal = new THREE.Vector3();
  var tempDirectionToCamera = new THREE.Vector3();

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
    updateBlackHole(elapsed, delta, audioBoost, audioFeatures);
    updateWarpField(elapsed, audioBoost, audioFeatures);

    stars.rotation.y += delta * 0.0028;
    stars.rotation.x = Math.sin(elapsed * 0.06) * 0.04;

    renderer.render(scene, camera);
  }

  function updateBlackHole(elapsed, delta, audioBoost, audioFeatures) {
    var rms = audioFeatures && isFinite(audioFeatures.rms) ? clamp01(audioFeatures.rms) : audioBoost;
    var peak = audioFeatures && isFinite(audioFeatures.peak) ? clamp01(audioFeatures.peak) : audioBoost;
    var transient = audioFeatures && isFinite(audioFeatures.transient) ? clamp01(audioFeatures.transient) : 0;

    shadowDisk.quaternion.copy(camera.quaternion);
    photonRing.quaternion.copy(camera.quaternion);

    var shadowPulse = 1 + Math.sin(elapsed * (1.0 + peak * 1.6)) * (0.004 + audioBoost * 0.012);
    shadowDisk.scale.set(shadowPulse, shadowPulse, 1);

    var ringPulse = 1 + Math.sin(elapsed * (1.6 + rms * 2.1)) * (0.009 + audioBoost * 0.02);
    photonRing.scale.set(ringPulse, ringPulse, 1);
    photonRingMaterial.uniforms.uTime.value = elapsed;
    photonRingMaterial.uniforms.uAudio.value = clamp01(audioBoost * 1.15 + rms * 0.35);
    photonRingMaterial.uniforms.uTransient.value = transient;
    photonRingMaterial.uniforms.uPhase.value = elapsed * (0.44 + audioBoost * 0.3);

    core.rotation.y += delta * (0.08 + audioBoost * 0.35);

    var diskNormal = getDiskNormal(accretionDisk);
    var toCamera = getDirectionToCamera();
    var normalViewDot = clamp01(Math.abs(diskNormal.dot(toCamera)));
    var inclination = Math.acos(normalViewDot);

    diskMaterial.uniforms.uTime.value = elapsed;
    diskMaterial.uniforms.uAudio.value = clamp01(audioBoost * 1.35 + rms * 0.46);
    diskMaterial.uniforms.uTransient.value = transient;
    diskMaterial.uniforms.uInclination.value = inclination;
    diskMaterial.uniforms.uCameraDir.value.copy(toCamera);
    diskMaterial.uniforms.uShadowRadius.value = CONFIG.blackHole.shadowRadius;

    accretionDisk.rotation.z += delta * (0.24 + audioBoost * 0.95 + transient * 0.8);
    accretionDisk.rotation.y = Math.sin(elapsed * 0.09) * (0.012 + transient * 0.01);

    updateAccretionParticles(accretionParticles, elapsed, delta, audioBoost, audioFeatures);

    var haloPulse = 1 + Math.sin(elapsed * (1.1 + audioBoost * 1.8)) * 0.015;
    coolHalo.scale.set(
      CONFIG.blackHole.haloScale * haloPulse * (0.96 + audioBoost * 0.07),
      CONFIG.blackHole.haloScale * haloPulse * (0.96 + audioBoost * 0.07),
      1
    );
    warmHalo.scale.set(
      CONFIG.blackHole.haloScale * 0.78 * haloPulse * (0.98 + audioBoost * 0.16 + transient * 0.1),
      CONFIG.blackHole.haloScale * 0.78 * haloPulse * (0.98 + audioBoost * 0.16 + transient * 0.1),
      1
    );

    coolHalo.material.opacity = 0.06 + audioBoost * 0.13 + rms * 0.06;
    warmHalo.material.opacity = 0.19 + audioBoost * 0.22 + peak * 0.1;

    stars.material.opacity = 0.57 + rms * 0.12 + Math.sin(elapsed * 0.3) * 0.03;
    diskLight.intensity = 4.8 + audioBoost * 2.7 + peak * 1.4;
    backLight.intensity = 1.8 + rms * 0.7;
  }

  function updateWarpField(elapsed, audioBoost, audioFeatures) {
    var positions = warpField.geometry.attributes.position.array;
    var base = warpField.base;
    var rms = audioFeatures && isFinite(audioFeatures.rms) ? clamp01(audioFeatures.rms) : audioBoost;
    var transient = audioFeatures && isFinite(audioFeatures.transient) ? clamp01(audioFeatures.transient) : 0;

    warpField.fill.material.opacity = 0.24 + audioBoost * 0.1;
    warpField.wire.material.opacity = 0.16 + audioBoost * 0.2 + transient * 0.07;

    for (var i = 0; i < positions.length; i += 3) {
      var x = base[i];
      var z = base[i + 2];
      var radius = Math.sqrt(x * x + z * z) + 0.0001;
      var angle = Math.atan2(z, x);

      var radialInfluence = CONFIG.blackHole.warpWellDepth / Math.pow(1 + radius * 0.082, 1.22);
      var centerClamp = 1 - smoothRange(CONFIG.blackHole.eventHorizonRadius * 0.7, CONFIG.blackHole.eventHorizonRadius * 2.2, radius);
      var centerDip = centerClamp * (1.05 + audioBoost * 0.6);

      var ringWave = Math.sin(radius * 0.34 - elapsed * (1.45 + audioBoost * 2.35) + angle * 2.2);
      var waveFalloff = Math.exp(-radius * 0.03);
      var waveHeight = ringWave * CONFIG.blackHole.warpWaveAmp * (0.12 + rms * 0.74 + transient * 0.3) * waveFalloff;

      var swirl = Math.sin(angle * 4.6 + elapsed * (0.9 + transient * 3.2) - radius * 0.12) * 0.09 * waveFalloff;

      positions[i + 1] = base[i + 1] - radialInfluence * (1 + audioBoost * 0.5) - centerDip + waveHeight + swirl;
    }

    warpField.geometry.attributes.position.needsUpdate = true;
  }

  function createAccretionDiskMaterial(innerRadius, outerRadius) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uAudio: { value: 0 },
        uTransient: { value: 0 },
        uInclination: { value: Math.PI * 0.45 },
        uCameraDir: { value: new THREE.Vector3(0, 0, 1) },
        uShadowRadius: { value: CONFIG.blackHole.shadowRadius },
        uInner: { value: innerRadius },
        uOuter: { value: outerRadius }
      },
      vertexShader:
        "varying float vRadius;\n" +
        "varying float vAngle;\n" +
        "varying vec3 vWorldPos;\n" +
        "void main() {\n" +
        "  vec3 transformed = position;\n" +
        "  vRadius = length(transformed.xy);\n" +
        "  vAngle = atan(transformed.y, transformed.x);\n" +
        "  vec4 worldPos = modelMatrix * vec4(transformed, 1.0);\n" +
        "  vWorldPos = worldPos.xyz;\n" +
        "  gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);\n" +
        "}",
      fragmentShader:
        "uniform float uTime;\n" +
        "uniform float uAudio;\n" +
        "uniform float uTransient;\n" +
        "uniform float uInclination;\n" +
        "uniform vec3 uCameraDir;\n" +
        "uniform float uShadowRadius;\n" +
        "uniform float uInner;\n" +
        "uniform float uOuter;\n" +
        "varying float vRadius;\n" +
        "varying float vAngle;\n" +
        "varying vec3 vWorldPos;\n" +
        "float softBand(float edge0, float edge1, float value) {\n" +
        "  float t = clamp((value - edge0) / max(0.0001, edge1 - edge0), 0.0, 1.0);\n" +
        "  return t * t * (3.0 - 2.0 * t);\n" +
        "}\n" +
        "void main() {\n" +
        "  float span = max(0.0001, uOuter - uInner);\n" +
        "  float radiusNorm = clamp((vRadius - uInner) / span, 0.0, 1.0);\n" +
        "  float innerMask = softBand(0.0, 0.05, radiusNorm);\n" +
        "  float outerMask = 1.0 - softBand(0.9, 1.0, radiusNorm);\n" +
        "  float ringMask = innerMask * outerMask;\n" +
        "  float rOverRs = mix(3.05, 12.5, radiusNorm);\n" +
        "  float beta = clamp(sqrt(1.0 / max(2.0 * rOverRs, 0.01)), 0.0, 0.66);\n" +
        "  float gamma = inversesqrt(max(0.01, 1.0 - beta * beta));\n" +
        "  float phi = vAngle - uTime * (1.65 + uAudio * 2.8) * mix(1.7, 0.38, radiusNorm);\n" +
        "  float cosTheta = sin(uInclination) * cos(phi);\n" +
        "  float dopplerFactor = 1.0 / max(0.03, gamma * (1.0 - beta * cosTheta));\n" +
        "  float gravitationalShift = sqrt(max(0.0, 1.0 - 1.0 / rOverRs));\n" +
        "  float gShift = max(0.03, gravitationalShift * dopplerFactor);\n" +
        "  float relativisticBeaming = pow(gShift, 3.0);\n" +
        "  vec3 viewAxis = normalize(uCameraDir);\n" +
        "  float axisDist = length(cross(vWorldPos, viewAxis));\n" +
        "  float sideSign = dot(vWorldPos, viewAxis);\n" +
        "  float shadowMask = softBand(uShadowRadius * 0.82, uShadowRadius * 1.01, axisDist);\n" +
        "  float frontLeak = 0.0;\n" +
        "  shadowMask = clamp(mix(shadowMask, 1.0, frontLeak), 0.0, 1.0);\n" +
        "  float lensEdge = exp(-pow((axisDist - uShadowRadius * 1.04) / max(0.001, uShadowRadius * 0.13), 2.0));\n" +
        "  float lensWeight = sideSign < 0.0 ? 1.0 : 0.58;\n" +
        "  float knotA = sin(phi * 8.0 + rOverRs * 4.4 + uTime * 1.1);\n" +
        "  float knotB = sin(phi * 17.0 - rOverRs * 7.1 + uTime * 3.3);\n" +
        "  float knotC = sin(phi * 33.0 + rOverRs * 9.7 - uTime * 5.1);\n" +
        "  float laneA = pow(0.5 + 0.5 * knotA, 2.0);\n" +
        "  float laneB = pow(0.5 + 0.5 * knotB, 2.4);\n" +
        "  float laneC = pow(0.5 + 0.5 * knotC, 3.0);\n" +
        "  float knots = clamp(laneA * 0.58 + laneB * 0.3 + laneC * 0.24, 0.0, 1.0);\n" +
        "  float radialHeat = pow(1.0 - radiusNorm, 0.63);\n" +
        "  float emissivity = clamp((0.2 + knots * 0.72) * (0.35 + radialHeat * 1.35), 0.0, 2.2);\n" +
        "  float brightArc = pow(max(0.0, cos(phi - 0.24)), 5.0);\n" +
        "  vec3 ember = vec3(0.68, 0.12, 0.02);\n" +
        "  vec3 fire = vec3(0.95, 0.34, 0.09);\n" +
        "  vec3 hot = vec3(1.0, 0.76, 0.33);\n" +
        "  vec3 color = mix(ember, fire, clamp(radialHeat * 0.95 + knots * 0.25, 0.0, 1.0));\n" +
        "  color = mix(color, hot, clamp(relativisticBeaming * 0.42 + brightArc * 0.65, 0.0, 1.0));\n" +
        "  color += hot * lensEdge * lensWeight * (0.15 + relativisticBeaming * 0.42);\n" +
        "  color *= clamp(0.24 + emissivity * 0.8 + relativisticBeaming * 0.95 + uAudio * 0.32, 0.0, 3.4);\n" +
        "  float alpha = ringMask * clamp(0.2 + emissivity * 0.95 + relativisticBeaming * 0.7 + uAudio * 0.24, 0.0, 1.4);\n" +
        "  alpha *= 1.0 - softBand(0.0, 0.14, radiusNorm) * 0.88;\n" +
        "  alpha *= 1.0 - softBand(0.89, 1.0, radiusNorm) * 0.3;\n" +
        "  alpha *= shadowMask;\n" +
        "  alpha += lensEdge * lensWeight * 0.22 * ringMask;\n" +
        "  alpha = clamp(alpha, 0.0, 1.0);\n" +
        "  gl_FragColor = vec4(color, alpha);\n" +
        "  #include <tonemapping_fragment>\n" +
        "  #include <colorspace_fragment>\n" +
        "}",
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      dithering: true
    });
  }

  function createPhotonRingMaterial(shadowNorm) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uAudio: { value: 0 },
        uTransient: { value: 0 },
        uPhase: { value: 0 },
        uShadowNorm: { value: shadowNorm }
      },
      vertexShader:
        "varying vec2 vUv;\n" +
        "void main() {\n" +
        "  vUv = uv;\n" +
        "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n" +
        "}",
      fragmentShader:
        "uniform float uTime;\n" +
        "uniform float uAudio;\n" +
        "uniform float uTransient;\n" +
        "uniform float uPhase;\n" +
        "uniform float uShadowNorm;\n" +
        "varying vec2 vUv;\n" +
        "float gaussianBand(float value, float center, float width) {\n" +
        "  float w = max(0.0001, width);\n" +
        "  float d = (value - center) / w;\n" +
        "  return exp(-d * d);\n" +
        "}\n" +
        "void main() {\n" +
        "  vec2 p = vUv * 2.0 - 1.0;\n" +
        "  float r = length(p);\n" +
        "  float a = atan(p.y, p.x);\n" +
        "  float shadow = uShadowNorm;\n" +
        "  float ringR = shadow * 1.02;\n" +
        "  float ringA = gaussianBand(r, ringR, 0.009 + uTransient * 0.002);\n" +
        "  float ringB = gaussianBand(r, ringR * 1.041, 0.006) * 0.42;\n" +
        "  float ringC = gaussianBand(r, ringR * 1.081, 0.0045) * 0.24;\n" +
        "  float sideBeaming = pow(max(0.0, cos(a - uPhase + 0.24)), 1.8);\n" +
        "  float opposite = pow(max(0.0, cos(a - uPhase + 3.14159265)), 1.3);\n" +
        "  float asymmetry = 0.24 + sideBeaming * 0.94 + opposite * 0.14;\n" +
        "  float humpY = gaussianBand(abs(p.y), shadow * 0.63, 0.036 + uAudio * 0.016);\n" +
        "  float humpR = gaussianBand(r, ringR * 1.01, 0.076);\n" +
        "  float lensHumps = humpY * humpR * (0.34 + sideBeaming * 0.45);\n" +
        "  float ringEnergy = (ringA + ringB + ringC) * asymmetry + lensHumps * 0.52;\n" +
        "  ringEnergy *= 0.56 + uAudio * 0.25 + uTransient * 0.18;\n" +
        "  float centerHole = smoothstep(shadow * 0.94, shadow * 0.99, r);\n" +
        "  float outerFade = 1.0 - smoothstep(shadow * 1.42, shadow * 1.58, r);\n" +
        "  float alpha = clamp(ringEnergy * centerHole * outerFade, 0.0, 1.0);\n" +
        "  if (alpha < 0.003) {\n" +
        "    discard;\n" +
        "  }\n" +
        "  vec3 ember = vec3(0.96, 0.34, 0.08);\n" +
        "  vec3 hot = vec3(1.0, 0.84, 0.42);\n" +
        "  float hotMix = clamp(ringA * 0.72 + sideBeaming * 0.42, 0.0, 1.0);\n" +
        "  vec3 color = mix(ember, hot, hotMix);\n" +
        "  color *= 0.34 + ringEnergy * 0.62;\n" +
        "  gl_FragColor = vec4(color, alpha);\n" +
        "  #include <tonemapping_fragment>\n" +
        "  #include <colorspace_fragment>\n" +
        "}",
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      dithering: true
    });
  }

  function createAccretionParticles(innerRadius, outerRadius, count) {
    var positions = new Float32Array(count * 3);
    var orbitRadius = new Float32Array(count);
    var angle = new Float32Array(count);
    var speed = new Float32Array(count);
    var lift = new Float32Array(count);

    for (var i = 0; i < count; i += 1) {
      var radialPick = Math.pow(Math.random(), 0.6);
      orbitRadius[i] = innerRadius + radialPick * (outerRadius - innerRadius);
      angle[i] = Math.random() * TWO_PI;
      speed[i] = 0.35 + Math.random() * 1.6;
      lift[i] = (Math.random() * 2 - 1) * 0.35;

      positions[i * 3] = Math.cos(angle[i]) * orbitRadius[i];
      positions[i * 3 + 1] = lift[i];
      positions[i * 3 + 2] = Math.sin(angle[i]) * orbitRadius[i];
    }

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

    var material = new THREE.PointsMaterial({
      color: 0xffca8f,
      size: 0.2,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });

    var points = new THREE.Points(geometry, material);

    return {
      points: points,
      geometry: geometry,
      positions: positions,
      orbitRadius: orbitRadius,
      angle: angle,
      speed: speed,
      lift: lift,
      count: count,
      phase: Math.random() * TWO_PI
    };
  }

  function updateAccretionParticles(particleState, elapsed, delta, audioBoost, audioFeatures) {
    var positions = particleState.positions;
    var transient = audioFeatures && isFinite(audioFeatures.transient) ? clamp01(audioFeatures.transient) : 0;
    var peak = audioFeatures && isFinite(audioFeatures.peak) ? clamp01(audioFeatures.peak) : audioBoost;

    for (var i = 0; i < particleState.count; i += 1) {
      particleState.angle[i] += delta * particleState.speed[i] * (1 + audioBoost * 1.45 + transient * 0.95);
      var radialJitter = Math.sin(elapsed * 1.7 + i * 0.31 + particleState.phase) * (0.06 + peak * 0.26);
      var radius = particleState.orbitRadius[i] + radialJitter;

      positions[i * 3] = Math.cos(particleState.angle[i]) * radius;
      positions[i * 3 + 1] = particleState.lift[i] + Math.sin(particleState.angle[i] * 2.4 + elapsed * 1.2) * 0.12;
      positions[i * 3 + 2] = Math.sin(particleState.angle[i]) * radius;
    }

    particleState.geometry.attributes.position.needsUpdate = true;
    particleState.points.material.opacity = 0.16 + audioBoost * 0.18 + peak * 0.1;
    particleState.points.material.size = 0.07 + audioBoost * 0.1;
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

    gradient.addColorStop(0, "rgba(" + inner[0] + ", " + inner[1] + ", " + inner[2] + ", 0.82)");
    gradient.addColorStop(0.22, "rgba(" + inner[0] + ", " + inner[1] + ", " + inner[2] + ", 0.4)");
    gradient.addColorStop(0.58, "rgba(" + outer[0] + ", " + outer[1] + ", " + outer[2] + ", 0.14)");
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

  function createWarpField() {
    var segmentCount = CONFIG.blackHole.warpSegments;
    var geometry = new THREE.PlaneGeometry(
      CONFIG.blackHole.warpSize,
      CONFIG.blackHole.warpSize,
      segmentCount,
      segmentCount
    );
    geometry.rotateX(-Math.PI / 2);

    var fill = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: 0x101929,
        transparent: true,
        opacity: 0.24,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    fill.position.y = CONFIG.blackHole.warpBaseY;
    scene.add(fill);

    var wire = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: 0x5270ad,
        wireframe: true,
        transparent: true,
        opacity: 0.16,
        depthWrite: false
      })
    );
    wire.position.y = CONFIG.blackHole.warpBaseY + 0.022;
    scene.add(wire);

    return {
      geometry: geometry,
      base: Float32Array.from(geometry.attributes.position.array),
      fill: fill,
      wire: wire
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
      color: 0xc9d8ff,
      size: 1.14,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true,
      depthWrite: false
    });

    return new THREE.Points(geometry, material);
  }

  function updateCamera(elapsed) {
    var driftRadius = CONFIG.camera.radius + Math.sin(elapsed * 0.11) * 0.35;
    var yaw = elapsed * CONFIG.camera.orbitSpeed;
    camera.position.x = Math.cos(yaw) * driftRadius;
    camera.position.z = Math.sin(yaw) * driftRadius;
    camera.position.y = CONFIG.camera.height + Math.sin(elapsed * 0.11) * CONFIG.camera.bobAmount;
    camera.lookAt(0, CONFIG.camera.lookHeight, 0);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.renderer.maxPixelRatio));
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function getDiskNormal(diskMesh) {
    tempDiskNormal.set(0, 0, 1);
    if (diskMesh && diskMesh.quaternion) {
      tempDiskNormal.applyQuaternion(diskMesh.quaternion);
    }
    return tempDiskNormal.normalize();
  }

  function getDirectionToCamera() {
    tempDirectionToCamera.copy(camera.position);
    return tempDirectionToCamera.normalize();
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

  function escapeCssText(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
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

  function smoothRange(edge0, edge1, value) {
    var t = clamp01((value - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
  }

  function toRadians(value) {
    return value * Math.PI / 180;
  }
})();
