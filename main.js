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

  var CONFIG = {
    overlay: {
      title: "STREAM STARTING SOON",
      subtitle: "Calibrating spacetime and aligning planetary ephemerides..."
    },
    renderer: {
      maxPixelRatio: 1.6,
      exposure: 1.08
    },
    simulation: {
      daysPerSecond: 3.6
    },
    compression: {
      minAU: 0.35,
      maxAU: 30.5,
      minDistance: 8,
      maxDistance: 78,
      curve: 0.92,
      verticalBoost: 3.2
    },
    camera: {
      radius: 106,
      orbitSpeed: 0.045,
      height: 37,
      bobAmount: 4.2,
      lookHeight: 3.8
    },
    fabric: {
      size: 240,
      segments: 172,
      baseY: -10,
      sunMass: 205,
      planetMassScale: 9.4,
      wellDepth: 0.46,
      waveAmp: 0.48
    },
    sun: {
      radius: 3.5
    }
  };

  var titleEl = document.getElementById("title");
  var subtitleEl = document.getElementById("subtitle");
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
  scene.fog = new THREE.FogExp2(0x050b18, 0.0045);

  var camera = new THREE.PerspectiveCamera(43, window.innerWidth / window.innerHeight, 0.1, 1600);
  camera.position.set(0, CONFIG.camera.height, CONFIG.camera.radius);

  var ambientLight = new THREE.AmbientLight(0x61789a, 0.24);
  scene.add(ambientLight);

  var sunLight = new THREE.PointLight(0xffd6a5, 8.6, 0, 1.1);
  sunLight.position.set(0, 0, 0);
  sunLight.castShadow = false;
  scene.add(sunLight);

  var stars = createStars(window.innerWidth < 1000 ? 2500 : 3800, 220, 720);
  scene.add(stars);

  var solarSystem = new THREE.Group();
  scene.add(solarSystem);

  var sun = new THREE.Mesh(
    new THREE.SphereGeometry(CONFIG.sun.radius, 52, 52),
    new THREE.MeshStandardMaterial({
      color: 0xffc56c,
      emissive: 0xffa133,
      emissiveIntensity: 1.5,
      roughness: 0.62,
      metalness: 0.0
    })
  );
  sun.castShadow = false;
  sun.receiveShadow = false;
  solarSystem.add(sun);

  var sunGlow = new THREE.Mesh(
    new THREE.SphereGeometry(CONFIG.sun.radius * 1.75, 34, 34),
    new THREE.MeshBasicMaterial({
      color: 0xffb760,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  solarSystem.add(sunGlow);

  var PLANETS = [
    {
      name: "Mercury",
      color: 0xb8a38f,
      radius: 0.36,
      spin: 0.012,
      wellMass: 1.7,
      elements: { N0: 48.3313, Nd: 3.24587e-5, i0: 7.0047, id: 5.0e-8, w0: 29.1241, wd: 1.01444e-5, a0: 0.387098, ad: 0, e0: 0.205635, ed: 5.59e-10, M0: 168.6562, Md: 4.0923344368 }
    },
    {
      name: "Venus",
      color: 0xd9b38a,
      radius: 0.56,
      spin: 0.006,
      wellMass: 2.6,
      elements: { N0: 76.6799, Nd: 2.4659e-5, i0: 3.3946, id: 2.75e-8, w0: 54.8910, wd: 1.38374e-5, a0: 0.72333, ad: 0, e0: 0.006773, ed: -1.302e-9, M0: 48.0052, Md: 1.6021302244 }
    },
    {
      name: "Earth",
      color: 0x5da3ff,
      radius: 0.62,
      spin: 0.044,
      wellMass: 3.2,
      elements: { N0: 0, Nd: 0, i0: 0, id: 0, w0: 282.9404, wd: 4.70935e-5, a0: 1.0, ad: 0, e0: 0.016709, ed: -1.151e-9, M0: 356.0470, Md: 0.9856002585 }
    },
    {
      name: "Mars",
      color: 0xd07d61,
      radius: 0.48,
      spin: 0.043,
      wellMass: 2.2,
      elements: { N0: 49.5574, Nd: 2.11081e-5, i0: 1.8497, id: -1.78e-8, w0: 286.5016, wd: 2.92961e-5, a0: 1.523688, ad: 0, e0: 0.093405, ed: 2.516e-9, M0: 18.6021, Md: 0.5240207766 }
    },
    {
      name: "Jupiter",
      color: 0xcba56a,
      radius: 1.6,
      spin: 0.091,
      wellMass: 8.8,
      elements: { N0: 100.4542, Nd: 2.76854e-5, i0: 1.3030, id: -1.557e-7, w0: 273.8777, wd: 1.64505e-5, a0: 5.20256, ad: 0, e0: 0.048498, ed: 4.469e-9, M0: 19.8950, Md: 0.0830853001 }
    },
    {
      name: "Saturn",
      color: 0xd0c08a,
      radius: 1.36,
      spin: 0.078,
      wellMass: 7.2,
      ring: { inner: 1.7, outer: 2.8, color: 0xd4be8f, tilt: 74 },
      elements: { N0: 113.6634, Nd: 2.3898e-5, i0: 2.4886, id: -1.081e-7, w0: 339.3939, wd: 2.97661e-5, a0: 9.55475, ad: 0, e0: 0.055546, ed: -9.499e-9, M0: 316.9670, Md: 0.0334442282 }
    },
    {
      name: "Uranus",
      color: 0x8bd1db,
      radius: 1.02,
      spin: 0.061,
      wellMass: 4.8,
      ring: { inner: 1.45, outer: 1.85, color: 0xb2f2f8, tilt: 98 },
      elements: { N0: 74.0005, Nd: 1.3978e-5, i0: 0.7733, id: 1.9e-8, w0: 96.6612, wd: 3.0565e-5, a0: 19.18171, ad: -1.55e-8, e0: 0.047318, ed: 7.45e-9, M0: 142.5905, Md: 0.011725806 }
    },
    {
      name: "Neptune",
      color: 0x5b90e8,
      radius: 0.97,
      spin: 0.062,
      wellMass: 4.4,
      elements: { N0: 131.7806, Nd: 3.0173e-5, i0: 1.77, id: -2.55e-7, w0: 272.8461, wd: -6.027e-6, a0: 30.05826, ad: 3.313e-8, e0: 0.008606, ed: 2.15e-9, M0: 260.2471, Md: 0.005995147 }
    }
  ];

  var initialDays = daysSinceJ2000(new Date());
  var planetObjects = [];

  for (var p = 0; p < PLANETS.length; p += 1) {
    planetObjects.push(createPlanet(PLANETS[p], initialDays));
  }

  var fabric = createFabric();
  var gravityBodies = [];
  var clock = new THREE.Clock();
  var simDays = 0;

  animate();

  window.addEventListener("resize", onResize);

  function animate() {
    requestAnimationFrame(animate);

    var delta = Math.min(clock.getDelta(), 0.05);
    var elapsed = clock.getElapsedTime();

    simDays += delta * CONFIG.simulation.daysPerSecond;
    var currentDays = initialDays + simDays;

    updatePlanets(currentDays, delta);
    updateFabric(elapsed);
    updateCamera(elapsed);

    stars.rotation.y += delta * 0.0032;
    stars.rotation.x = Math.sin(elapsed * 0.05) * 0.05;

    sun.rotation.y += delta * 0.045;
    var glowPulse = 1 + Math.sin(elapsed * 1.45) * 0.04;
    sunGlow.scale.set(glowPulse, glowPulse, glowPulse);
    sunLight.intensity = 8.6 + Math.sin(elapsed * 1.45) * 0.24;

    renderer.render(scene, camera);
  }

  function updatePlanets(dayValue, delta) {
    gravityBodies.length = 0;
    gravityBodies.push({ x: 0, z: 0, mass: CONFIG.fabric.sunMass, softness: 14.0 });

    for (var i = 0; i < planetObjects.length; i += 1) {
      var planet = planetObjects[i];
      var elements = getOrbitalElements(planet.data, dayValue);
      var auPosition = heliocentricFromElements(elements, null);
      var scenePosition = auToScene(auPosition);

      planet.mesh.position.copy(scenePosition);
      planet.position.copy(scenePosition);
      planet.mesh.rotation.y += delta * planet.data.spin;

      if (planet.ring) {
        planet.ring.rotation.z += delta * 0.02;
      }

      gravityBodies.push({
        x: scenePosition.x,
        z: scenePosition.z,
        mass: planet.data.wellMass * CONFIG.fabric.planetMassScale,
        softness: 3.3 + planet.data.radius * 2.4
      });
    }
  }

  function updateFabric(elapsed) {
    var positions = fabric.geometry.attributes.position.array;
    var base = fabric.base;

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

      var waveA = Math.sin(x * 0.11 + elapsed * 0.62) * Math.cos(z * 0.11 - elapsed * 0.46);
      var radial = Math.sqrt(x * x + z * z);
      var waveB = Math.sin(radial * 0.22 - elapsed * 1.24);

      positions[i + 1] = base[i + 1] - well * CONFIG.fabric.wellDepth + waveA * CONFIG.fabric.waveAmp + waveB * 0.16;
    }

    fabric.geometry.attributes.position.needsUpdate = true;
  }

  function updateCamera(elapsed) {
    var driftRadius = CONFIG.camera.radius + Math.sin(elapsed * 0.28) * 3;
    var yaw = elapsed * CONFIG.camera.orbitSpeed;
    camera.position.x = Math.cos(yaw) * driftRadius;
    camera.position.z = Math.sin(yaw) * driftRadius;
    camera.position.y = CONFIG.camera.height + Math.sin(elapsed * 0.18) * CONFIG.camera.bobAmount;
    camera.lookAt(0, CONFIG.camera.lookHeight, 0);
  }

  function createPlanet(definition, dayValue) {
    var maps = createPlanetMaps(definition);
    var geometry = new THREE.SphereGeometry(definition.radius, 34, 28);
    var material = new THREE.MeshStandardMaterial({
      color: definition.color,
      map: maps.albedo,
      bumpMap: maps.bump,
      bumpScale: definition.radius > 1 ? 0.12 : 0.18,
      emissive: definition.color,
      emissiveIntensity: 0.11,
      roughness: definition.radius > 1 ? 0.44 : 0.3,
      metalness: 0.02
    });
    var mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    solarSystem.add(mesh);

    var atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(definition.radius * 1.08, 30, 24),
      new THREE.MeshBasicMaterial({
        color: definition.color,
        transparent: true,
        opacity: definition.radius > 1 ? 0.08 : 0.06,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false
      })
    );
    mesh.add(atmosphere);

    var ring = null;
    if (definition.ring) {
      ring = new THREE.Mesh(
        new THREE.RingGeometry(definition.ring.inner, definition.ring.outer, 96),
        new THREE.MeshStandardMaterial({
          color: definition.ring.color,
          transparent: true,
          opacity: 0.56,
          roughness: 0.85,
          metalness: 0.02,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      );
      ring.rotation.x = toRadians(definition.ring.tilt);
      ring.castShadow = false;
      ring.receiveShadow = false;
      mesh.add(ring);
    }

    var orbit = createOrbitLine(definition, dayValue);
    solarSystem.add(orbit);

    return {
      data: definition,
      mesh: mesh,
      atmosphere: atmosphere,
      ring: ring,
      orbit: orbit,
      position: new THREE.Vector3()
    };
  }

  function createOrbitLine(definition, dayValue) {
    var sampleCount = 220;
    var points = [];
    var elements = getOrbitalElements(definition, dayValue);

    for (var i = 0; i < sampleCount; i += 1) {
      var anomaly = (i / sampleCount) * TWO_PI;
      var sample = heliocentricFromElements(elements, anomaly);
      points.push(auToScene(sample));
    }

    var geometry = new THREE.BufferGeometry().setFromPoints(points);
    var material = new THREE.LineBasicMaterial({
      color: 0x4f6f93,
      transparent: true,
      opacity: 0.34
    });

    return new THREE.LineLoop(geometry, material);
  }

  function createFabric() {
    var geometry = new THREE.PlaneGeometry(
      CONFIG.fabric.size,
      CONFIG.fabric.size,
      CONFIG.fabric.segments,
      CONFIG.fabric.segments
    );
    geometry.rotateX(-Math.PI / 2);

    var fill = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: 0x102843,
        transparent: true,
        opacity: 0.43,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    fill.position.y = CONFIG.fabric.baseY;
    scene.add(fill);

    var wire = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: 0x5f8dc2,
        wireframe: true,
        transparent: true,
        opacity: 0.3,
        depthWrite: false
      })
    );
    wire.position.y = CONFIG.fabric.baseY + 0.025;
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
      color: 0xbfd5ff,
      size: 1.18,
      transparent: true,
      opacity: 0.84,
      sizeAttenuation: true,
      depthWrite: false
    });

    return new THREE.Points(geometry, material);
  }

  function createPlanetMaps(definition) {
    var size = definition.radius > 1 ? 384 : 256;
    var albedoCanvas = document.createElement("canvas");
    var bumpCanvas = document.createElement("canvas");
    albedoCanvas.width = size;
    albedoCanvas.height = size;
    bumpCanvas.width = size;
    bumpCanvas.height = size;

    var albedoCtx = albedoCanvas.getContext("2d");
    var bumpCtx = bumpCanvas.getContext("2d");
    if (!albedoCtx || !bumpCtx) {
      return { albedo: null, bump: null };
    }

    var albedoData = albedoCtx.createImageData(size, size);
    var bumpData = bumpCtx.createImageData(size, size);
    var albedoPixels = albedoData.data;
    var bumpPixels = bumpData.data;

    var base = new THREE.Color(definition.color);
    var baseR = Math.round(base.r * 255);
    var baseG = Math.round(base.g * 255);
    var baseB = Math.round(base.b * 255);
    var seed = hashString(definition.name);
    var seedPhase = (seed % 7200) / 7200;
    var isRocky = definition.radius < 0.9;
    var bandFreq = isRocky ? 8 : 18;
    var bandAmp = isRocky ? 0.12 : 0.2;
    var minFloor = isRocky ? 52 : 58;

    for (var y = 0; y < size; y += 1) {
      var v = y / (size - 1);
      var latitude = v * 2 - 1;
      var polarDark = -Math.pow(Math.abs(latitude), isRocky ? 1.2 : 1.55) * 0.05;

      for (var x = 0; x < size; x += 1) {
        var u = x / (size - 1);
        var noise = valueNoise2D(u * (isRocky ? 30 : 18), v * (isRocky ? 30 : 24), seed);
        var micro = valueNoise2D(u * 92 + 7.3, v * 92 + 3.8, seed + 19);
        var bands = Math.sin((v + seedPhase) * Math.PI * bandFreq) * bandAmp;
        var tone = bands + (noise - 0.5) * (isRocky ? 0.18 : 0.11) + polarDark + 0.08;

        var index = (y * size + x) * 4;
        var shift = Math.round(tone * 72);
        albedoPixels[index] = clampByte(Math.max(minFloor, baseR + shift + Math.round((micro - 0.5) * 16)));
        albedoPixels[index + 1] = clampByte(Math.max(minFloor, baseG + shift));
        albedoPixels[index + 2] = clampByte(Math.max(minFloor, baseB + shift - Math.round((micro - 0.5) * 12)));
        albedoPixels[index + 3] = 255;

        var bumpTone = 0.48 + bands * 0.55 + (noise - 0.5) * (isRocky ? 0.95 : 0.45) + (micro - 0.5) * 0.24;
        var bumpValue = clampByte(Math.round(bumpTone * 255));
        bumpPixels[index] = bumpValue;
        bumpPixels[index + 1] = bumpValue;
        bumpPixels[index + 2] = bumpValue;
        bumpPixels[index + 3] = 255;
      }
    }

    albedoCtx.putImageData(albedoData, 0, 0);
    bumpCtx.putImageData(bumpData, 0, 0);

    var anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
    var albedoTexture = new THREE.CanvasTexture(albedoCanvas);
    albedoTexture.colorSpace = THREE.SRGBColorSpace;
    albedoTexture.anisotropy = anisotropy;

    var bumpTexture = new THREE.CanvasTexture(bumpCanvas);
    bumpTexture.anisotropy = anisotropy;

    return {
      albedo: albedoTexture,
      bump: bumpTexture
    };
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

  function hashString(text) {
    var hash = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function smoothStep(t) {
    return t * t * (3 - 2 * t);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
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

  function getOrbitalElements(definition, dayValue) {
    var e = definition.elements;
    return {
      N: toRadians(e.N0 + e.Nd * dayValue),
      i: toRadians(e.i0 + e.id * dayValue),
      w: toRadians(e.w0 + e.wd * dayValue),
      a: e.a0 + e.ad * dayValue,
      e: e.e0 + e.ed * dayValue,
      M: normalizeRadians(toRadians(e.M0 + e.Md * dayValue))
    };
  }

  function heliocentricFromElements(elements, anomalyOverride) {
    var meanAnomaly = anomalyOverride === null || anomalyOverride === undefined ? elements.M : anomalyOverride;
    var eccentricAnomaly = solveKepler(meanAnomaly, elements.e);

    var xv = elements.a * (Math.cos(eccentricAnomaly) - elements.e);
    var yv = elements.a * Math.sqrt(1 - elements.e * elements.e) * Math.sin(eccentricAnomaly);

    var trueAnomaly = Math.atan2(yv, xv);
    var radius = Math.sqrt(xv * xv + yv * yv);
    var longitude = trueAnomaly + elements.w;

    var cosN = Math.cos(elements.N);
    var sinN = Math.sin(elements.N);
    var cosI = Math.cos(elements.i);
    var sinI = Math.sin(elements.i);
    var cosL = Math.cos(longitude);
    var sinL = Math.sin(longitude);

    return {
      x: radius * (cosN * cosL - sinN * sinL * cosI),
      y: radius * (sinN * cosL + cosN * sinL * cosI),
      z: radius * (sinL * sinI),
      r: radius
    };
  }

  function solveKepler(meanAnomaly, eccentricity) {
    var E = meanAnomaly + eccentricity * Math.sin(meanAnomaly) * (1 + eccentricity * Math.cos(meanAnomaly));

    for (var i = 0; i < 8; i += 1) {
      var numerator = E - eccentricity * Math.sin(E) - meanAnomaly;
      var denominator = 1 - eccentricity * Math.cos(E);
      var correction = numerator / denominator;
      E -= correction;
      if (Math.abs(correction) < 1e-6) {
        break;
      }
    }

    return E;
  }

  function auToScene(positionAU) {
    var radiusAU = Math.sqrt(positionAU.x * positionAU.x + positionAU.y * positionAU.y + positionAU.z * positionAU.z);
    var targetDistance = compressDistance(radiusAU);

    var sceneDirection = new THREE.Vector3(
      positionAU.x,
      positionAU.z * CONFIG.compression.verticalBoost,
      positionAU.y
    );
    var currentLength = sceneDirection.length() || 1;
    sceneDirection.multiplyScalar(targetDistance / currentLength);

    return sceneDirection;
  }

  function compressDistance(au) {
    var c = CONFIG.compression;
    var clamped = Math.min(c.maxAU, Math.max(c.minAU, au));
    var normalized = (Math.log1p(clamped) - Math.log1p(c.minAU)) / (Math.log1p(c.maxAU) - Math.log1p(c.minAU));
    var curved = Math.pow(normalized, c.curve);
    return c.minDistance + (c.maxDistance - c.minDistance) * curved;
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.renderer.maxPixelRatio));
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function toRadians(value) {
    return value * Math.PI / 180;
  }

  function normalizeRadians(value) {
    var wrapped = value % TWO_PI;
    return wrapped < 0 ? wrapped + TWO_PI : wrapped;
  }

  function daysSinceJ2000(date) {
    var msPerDay = 86400000;
    var julianDate = date.getTime() / msPerDay + 2440587.5;
    return julianDate - 2451543.5;
  }
})();
