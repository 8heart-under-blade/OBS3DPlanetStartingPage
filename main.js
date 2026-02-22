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
      radius: 3.5,
      cycleSeconds: 56,
      minActiveRegions: 2,
      maxActiveRegions: 22,
      startLatitude: 36,
      endLatitude: 7,
      latitudeSpread: 9,
      baseRegionSize: 0.21
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

  var ambientLight = new THREE.AmbientLight(0x647b9e, 0.22);
  scene.add(ambientLight);

  var sunLight = new THREE.PointLight(0xffd6a5, 7.9, 0, 1.1);
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

  var sunActivity = null;
  var sunActivityEnabled = false;
  var sunSurfaceNormal = new THREE.Vector3(0, 0, 1);
  var sunSurfaceDirection = new THREE.Vector3();
  var sunToCameraDirection = new THREE.Vector3();
  try {
    sunActivity = createSunActivityRegions(48);
    if (sunActivity && sunActivity.group) {
      sun.add(sunActivity.group);
      sunActivityEnabled = true;
    }
  } catch (error) {
    sunActivityEnabled = false;
    console.warn("Sun activity disabled:", error);
  }

  var PLANETS = [
    {
      name: "Mercury",
      color: 0xa9a7a1,
      radius: 0.36,
      spin: 0.012,
      wellMass: 1.7,
      elements: { N0: 48.3313, Nd: 3.24587e-5, i0: 7.0047, id: 5.0e-8, w0: 29.1241, wd: 1.01444e-5, a0: 0.387098, ad: 0, e0: 0.205635, ed: 5.59e-10, M0: 168.6562, Md: 4.0923344368 }
    },
    {
      name: "Venus",
      color: 0xe1c48d,
      radius: 0.56,
      spin: 0.006,
      wellMass: 2.6,
      elements: { N0: 76.6799, Nd: 2.4659e-5, i0: 3.3946, id: 2.75e-8, w0: 54.8910, wd: 1.38374e-5, a0: 0.72333, ad: 0, e0: 0.006773, ed: -1.302e-9, M0: 48.0052, Md: 1.6021302244 }
    },
    {
      name: "Earth",
      color: 0x4d6fb3,
      radius: 0.62,
      spin: 0.044,
      wellMass: 3.2,
      elements: { N0: 0, Nd: 0, i0: 0, id: 0, w0: 282.9404, wd: 4.70935e-5, a0: 1.0, ad: 0, e0: 0.016709, ed: -1.151e-9, M0: 356.0470, Md: 0.9856002585 }
    },
    {
      name: "Mars",
      color: 0xb95c43,
      radius: 0.48,
      spin: 0.043,
      wellMass: 2.2,
      elements: { N0: 49.5574, Nd: 2.11081e-5, i0: 1.8497, id: -1.78e-8, w0: 286.5016, wd: 2.92961e-5, a0: 1.523688, ad: 0, e0: 0.093405, ed: 2.516e-9, M0: 18.6021, Md: 0.5240207766 }
    },
    {
      name: "Jupiter",
      color: 0xc6a47a,
      radius: 1.6,
      spin: 0.091,
      wellMass: 8.8,
      elements: { N0: 100.4542, Nd: 2.76854e-5, i0: 1.3030, id: -1.557e-7, w0: 273.8777, wd: 1.64505e-5, a0: 5.20256, ad: 0, e0: 0.048498, ed: 4.469e-9, M0: 19.8950, Md: 0.0830853001 }
    },
    {
      name: "Saturn",
      color: 0xd9c898,
      radius: 1.36,
      spin: 0.078,
      wellMass: 7.2,
      ring: { inner: 1.7, outer: 2.8, color: 0xcdbb8d, tilt: 74 },
      elements: { N0: 113.6634, Nd: 2.3898e-5, i0: 2.4886, id: -1.081e-7, w0: 339.3939, wd: 2.97661e-5, a0: 9.55475, ad: 0, e0: 0.055546, ed: -9.499e-9, M0: 316.9670, Md: 0.0334442282 }
    },
    {
      name: "Uranus",
      color: 0x84c7d9,
      radius: 1.02,
      spin: 0.061,
      wellMass: 4.8,
      ring: { inner: 1.45, outer: 1.85, color: 0xa4e6ef, tilt: 98 },
      elements: { N0: 74.0005, Nd: 1.3978e-5, i0: 0.7733, id: 1.9e-8, w0: 96.6612, wd: 3.0565e-5, a0: 19.18171, ad: -1.55e-8, e0: 0.047318, ed: 7.45e-9, M0: 142.5905, Md: 0.011725806 }
    },
    {
      name: "Neptune",
      color: 0x3f68c2,
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
    var cyclePhase = (elapsed / CONFIG.sun.cycleSeconds) % 1;
    var solarActivity = Math.pow(Math.sin(cyclePhase * Math.PI), 1.25);
    var glowPulse = 1 + Math.sin(elapsed * (1.2 + solarActivity * 0.7)) * (0.028 + solarActivity * 0.04);
    sunGlow.scale.set(glowPulse, glowPulse, glowPulse);
    sunGlow.material.opacity = 0.19 + solarActivity * 0.17;
    sunLight.intensity = 7.55 + solarActivity * 1.2 + Math.sin(elapsed * 1.45) * (0.1 + solarActivity * 0.22);
    if (sunActivityEnabled) {
      try {
        updateSunActivityRegions(elapsed, delta, cyclePhase, solarActivity);
      } catch (error) {
        sunActivityEnabled = false;
        if (sunActivity && sunActivity.group) {
          sun.remove(sunActivity.group);
        }
        console.warn("Sun activity update disabled:", error);
      }
    }

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

  function createSunActivityRegions(totalCount) {
    var group = new THREE.Group();
    var regions = [];
    var regionGeometry = new THREE.CircleGeometry(1, 28);

    for (var i = 0; i < totalCount; i += 1) {
      var anchor = new THREE.Object3D();
      anchor.visible = false;
      group.add(anchor);

      var penumbra = new THREE.Mesh(
        regionGeometry,
        new THREE.MeshBasicMaterial({
          color: 0x5e3a20,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0,
          depthWrite: false
        })
      );
      anchor.add(penumbra);

      var umbra = new THREE.Mesh(
        regionGeometry,
        new THREE.MeshBasicMaterial({
          color: 0x1a0e08,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0,
          depthWrite: false
        })
      );
      anchor.add(umbra);

      var facula = new THREE.Mesh(
        regionGeometry,
        new THREE.MeshBasicMaterial({
          color: 0xffbe73,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      anchor.add(facula);

      regions.push({
        anchor: anchor,
        penumbra: penumbra,
        umbra: umbra,
        facula: facula,
        hemisphere: i % 2 === 0 ? 1 : -1,
        longitude: Math.random() * TWO_PI,
        longitudeDrift: 0.08 + Math.random() * 0.36,
        activation: Math.random(),
        latitudeJitter: Math.random() * 2 - 1,
        phase: Math.random() * TWO_PI,
        pulseSpeed: 0.7 + Math.random() * 1.6,
        baseSize: CONFIG.sun.baseRegionSize * (0.72 + Math.random() * 1.24),
        strength: 0
      });
    }

    return {
      group: group,
      regions: regions
    };
  }

  function updateSunActivityRegions(elapsed, delta, cyclePhase, activity) {
    var regions = sunActivity.regions;
    var minCount = Math.min(CONFIG.sun.minActiveRegions, regions.length);
    var maxCount = Math.min(CONFIG.sun.maxActiveRegions, regions.length);
    var threshold = lerp(minCount / regions.length, maxCount / regions.length, activity);
    var centerLatitude = lerp(CONFIG.sun.startLatitude, CONFIG.sun.endLatitude, cyclePhase);
    var spreadLatitude = CONFIG.sun.latitudeSpread * (0.65 + activity * 0.85);
    var surfaceDistance = CONFIG.sun.radius * 1.0017;
    var riseBlend = 1 - Math.exp(-delta * 1.35);
    var decayBlend = 1 - Math.exp(-delta * 0.72);

    sunToCameraDirection.copy(camera.position).normalize();

    for (var i = 0; i < regions.length; i += 1) {
      var region = regions[i];
      var active = smoothRange(region.activation - 0.08, region.activation + 0.08, threshold);
      var pulse = 0.82 + 0.18 * Math.sin(elapsed * region.pulseSpeed + region.phase);

      var latitude = toRadians((centerLatitude + region.latitudeJitter * spreadLatitude) * region.hemisphere);
      var longitude = region.longitude + cyclePhase * TWO_PI * region.longitudeDrift;
      var cosLatitude = Math.cos(latitude);

      sunSurfaceDirection.set(
        cosLatitude * Math.cos(longitude),
        Math.sin(latitude),
        cosLatitude * Math.sin(longitude)
      ).normalize();

      var viewDot = sunSurfaceDirection.dot(sunToCameraDirection);
      var frontness = smoothRange(-0.03, 0.2, viewDot);
      var targetStrength = active * frontness;
      var blend = targetStrength > region.strength ? riseBlend : decayBlend;
      region.strength += (targetStrength - region.strength) * blend;
      var intensity = region.strength * pulse;

      if (intensity < 0.003) {
        region.anchor.visible = false;
        continue;
      }

      region.anchor.visible = true;
      region.anchor.position.copy(sunSurfaceDirection).multiplyScalar(surfaceDistance);
      region.anchor.quaternion.setFromUnitVectors(sunSurfaceNormal, sunSurfaceDirection);

      var sizePulse = 1 + Math.sin(elapsed * (region.pulseSpeed + 1.1) + region.phase * 0.63) * 0.06;
      var spotScale = region.baseSize * sizePulse * (0.94 + intensity * 0.32);
      var limbBoost = 0.55 + (1 - viewDot) * 0.95;

      region.penumbra.scale.setScalar(spotScale);
      region.umbra.scale.setScalar(spotScale * 0.56);
      region.facula.scale.setScalar(spotScale * (1.85 + activity * 0.7));

      region.penumbra.material.opacity = intensity * (0.34 + (1 - activity) * 0.26);
      region.umbra.material.opacity = intensity * (0.58 + (1 - activity) * 0.2);
      region.facula.material.opacity = intensity * (0.08 + activity * 0.28) * limbBoost;
      region.facula.material.color.setHSL(0.09 + activity * 0.02, 0.9, 0.5 + intensity * 0.08);
    }
  }

  function createPlanet(definition, dayValue) {
    var maps = createPlanetMaps(definition);
    var geometry = new THREE.SphereGeometry(definition.radius, 34, 28);
    var material = createPlanetMaterial(definition, maps);
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
        new THREE.MeshBasicMaterial({
          color: definition.ring.color,
          transparent: true,
          opacity: 0.56,
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

  function createPlanetMaterial(definition, maps) {
    var isGiant = definition.radius > 1;
    var ambient = isGiant ? 0.42 : 0.36;
    var rimStrength = isGiant ? 0.18 : 0.14;

    return new THREE.ShaderMaterial({
      uniforms: {
        uBaseColor: { value: new THREE.Color(definition.color) },
        uSunPos: { value: new THREE.Vector3(0, 0, 0) },
        uAlbedo: { value: maps.albedo || null },
        uUseAlbedo: { value: maps.albedo ? 1.0 : 0.0 },
        uAmbient: { value: ambient },
        uRimStrength: { value: rimStrength }
      },
      vertexShader:
        "varying vec3 vWorldPos;\n" +
        "varying vec3 vWorldNormal;\n" +
        "varying vec2 vUv;\n" +
        "void main() {\n" +
        "  vUv = uv;\n" +
        "  vec4 worldPos = modelMatrix * vec4(position, 1.0);\n" +
        "  vWorldPos = worldPos.xyz;\n" +
        "  vWorldNormal = normalize(mat3(modelMatrix) * normal);\n" +
        "  gl_Position = projectionMatrix * viewMatrix * worldPos;\n" +
        "}",
      fragmentShader:
        "uniform vec3 uBaseColor;\n" +
        "uniform vec3 uSunPos;\n" +
        "uniform sampler2D uAlbedo;\n" +
        "uniform float uUseAlbedo;\n" +
        "uniform float uAmbient;\n" +
        "uniform float uRimStrength;\n" +
        "varying vec3 vWorldPos;\n" +
        "varying vec3 vWorldNormal;\n" +
        "varying vec2 vUv;\n" +
        "void main() {\n" +
        "  vec3 N = normalize(vWorldNormal);\n" +
        "  vec3 L = normalize(uSunPos - vWorldPos);\n" +
        "  vec3 V = normalize(cameraPosition - vWorldPos);\n" +
        "  float ndotl = max(dot(N, L), 0.0);\n" +
        "  float diffuse = smoothstep(-0.05, 0.95, ndotl);\n" +
        "  float nightFactor = smoothstep(-0.45, 0.55, dot(N, L));\n" +
        "  vec3 texColor = mix(vec3(1.0), texture2D(uAlbedo, vUv).rgb, uUseAlbedo);\n" +
        "  vec3 base = uBaseColor * texColor;\n" +
        "  vec3 warmTint = vec3(1.05, 1.01, 0.98);\n" +
        "  vec3 coolTint = vec3(0.89, 0.93, 1.0);\n" +
        "  vec3 litTint = mix(coolTint, warmTint, diffuse);\n" +
        "  vec3 H = normalize(L + V);\n" +
        "  float spec = pow(max(dot(N, H), 0.0), 20.0) * 0.16;\n" +
        "  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.2) * uRimStrength;\n" +
        "  float lighting = uAmbient + (1.0 - uAmbient) * pow(diffuse, 0.85);\n" +
        "  vec3 color = base * litTint * lighting;\n" +
        "  color += base * 0.16 * (1.0 - nightFactor);\n" +
        "  color += vec3(spec * 0.5);\n" +
        "  color += base * rim * 0.22;\n" +
        "  gl_FragColor = vec4(color, 1.0);\n" +
        "  #include <tonemapping_fragment>\n" +
        "  #include <colorspace_fragment>\n" +
        "}",
      dithering: true
    });
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

    var profile = getPlanetProfile(definition.name);
    var colorA = hexToRgb(profile.colorA);
    var colorB = hexToRgb(profile.colorB);
    var colorC = profile.colorC ? hexToRgb(profile.colorC) : null;
    var seed = hashString(definition.name);
    var seedPhase = (seed % 7200) / 7200;

    for (var y = 0; y < size; y += 1) {
      var v = y / (size - 1);
      var latitude = v * 2 - 1;
      var polarDark = -Math.pow(Math.abs(latitude), profile.polePower) * profile.poleDark;
      var band = Math.sin((v + seedPhase) * Math.PI * profile.bandFreq) * profile.bandAmp;

      for (var x = 0; x < size; x += 1) {
        var u = x / (size - 1);
        var noise = valueNoise2D(u * profile.noiseScale, v * profile.noiseScale, seed);
        var micro = valueNoise2D(u * profile.detailScale + 7.3, v * profile.detailScale + 3.8, seed + 19);
        var blend = 0.5 + band + (noise - 0.5) * profile.noiseAmp + (micro - 0.5) * profile.microAmp;

        if (profile.style === "earth") {
          blend = smoothRange(profile.continentStart, profile.continentEnd, noise + (micro - 0.5) * 0.25);
        }

        blend = clamp01(blend);

        var index = (y * size + x) * 4;

        var r = lerp(colorA.r, colorB.r, blend);
        var g = lerp(colorA.g, colorB.g, blend);
        var b = lerp(colorA.b, colorB.b, blend);

        if (colorC) {
          var accentWave = smoothRange(0.62, 0.9, Math.sin((v + seedPhase * 0.65) * Math.PI * profile.accentFreq) * 0.5 + 0.5);
          var accent = accentWave * profile.accentAmp;
          r = lerp(r, colorC.r, accent);
          g = lerp(g, colorC.g, accent);
          b = lerp(b, colorC.b, accent);
        }

        if (profile.style === "earth") {
          var cloud = smoothRange(0.67, 0.9, micro + Math.abs(latitude) * 0.06) * 0.32;
          r = lerp(r, 242, cloud);
          g = lerp(g, 246, cloud);
          b = lerp(b, 250, cloud);
        }

        var brightness = 1 + polarDark + (micro - 0.5) * profile.contrast;
        albedoPixels[index] = clampByte(Math.max(profile.minFloor, Math.round(r * brightness)));
        albedoPixels[index + 1] = clampByte(Math.max(profile.minFloor, Math.round(g * brightness)));
        albedoPixels[index + 2] = clampByte(Math.max(profile.minFloor, Math.round(b * brightness)));
        albedoPixels[index + 3] = 255;

        var bumpTone = 0.5 + band * profile.bumpBand + (noise - 0.5) * profile.bumpNoise + (micro - 0.5) * profile.bumpMicro;
        if (profile.style === "earth") {
          bumpTone += (blend - 0.5) * 0.18;
        }
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

  function getPlanetProfile(name) {
    switch (name) {
      case "Mercury":
        return {
          style: "rocky",
          colorA: 0x8e8a84,
          colorB: 0xb3aea5,
          colorC: null,
          noiseScale: 30,
          detailScale: 90,
          noiseAmp: 0.82,
          microAmp: 0.34,
          contrast: 0.16,
          minFloor: 54,
          polePower: 1.2,
          poleDark: 0.08,
          bandFreq: 6,
          bandAmp: 0.04,
          accentFreq: 0,
          accentAmp: 0,
          bumpBand: 0.08,
          bumpNoise: 0.9,
          bumpMicro: 0.34,
          continentStart: 0,
          continentEnd: 1
        };
      case "Venus":
        return {
          style: "cloud",
          colorA: 0xd7bf93,
          colorB: 0xc8a778,
          colorC: 0xead8b5,
          noiseScale: 18,
          detailScale: 76,
          noiseAmp: 0.44,
          microAmp: 0.22,
          contrast: 0.1,
          minFloor: 62,
          polePower: 1.3,
          poleDark: 0.04,
          bandFreq: 9,
          bandAmp: 0.13,
          accentFreq: 4,
          accentAmp: 0.18,
          bumpBand: 0.04,
          bumpNoise: 0.22,
          bumpMicro: 0.12,
          continentStart: 0,
          continentEnd: 1
        };
      case "Earth":
        return {
          style: "earth",
          colorA: 0x29589e,
          colorB: 0x6f9b59,
          colorC: 0xe6edf5,
          noiseScale: 16,
          detailScale: 88,
          noiseAmp: 0.38,
          microAmp: 0.18,
          contrast: 0.12,
          minFloor: 50,
          polePower: 1.45,
          poleDark: 0.06,
          bandFreq: 6,
          bandAmp: 0.05,
          accentFreq: 0,
          accentAmp: 0,
          bumpBand: 0.05,
          bumpNoise: 0.36,
          bumpMicro: 0.2,
          continentStart: 0.5,
          continentEnd: 0.66
        };
      case "Mars":
        return {
          style: "rocky",
          colorA: 0x8e4738,
          colorB: 0xc36f4f,
          colorC: null,
          noiseScale: 24,
          detailScale: 92,
          noiseAmp: 0.72,
          microAmp: 0.3,
          contrast: 0.14,
          minFloor: 52,
          polePower: 1.35,
          poleDark: 0.08,
          bandFreq: 7,
          bandAmp: 0.06,
          accentFreq: 0,
          accentAmp: 0,
          bumpBand: 0.12,
          bumpNoise: 0.78,
          bumpMicro: 0.3,
          continentStart: 0,
          continentEnd: 1
        };
      case "Jupiter":
        return {
          style: "banded",
          colorA: 0xb88f67,
          colorB: 0xd0b087,
          colorC: 0xe2cfaf,
          noiseScale: 14,
          detailScale: 64,
          noiseAmp: 0.34,
          microAmp: 0.16,
          contrast: 0.08,
          minFloor: 60,
          polePower: 1.55,
          poleDark: 0.04,
          bandFreq: 14,
          bandAmp: 0.23,
          accentFreq: 9,
          accentAmp: 0.22,
          bumpBand: 0.14,
          bumpNoise: 0.24,
          bumpMicro: 0.1,
          continentStart: 0,
          continentEnd: 1
        };
      case "Saturn":
        return {
          style: "banded",
          colorA: 0xbda47a,
          colorB: 0xd9ca9f,
          colorC: 0xeadbb8,
          noiseScale: 12,
          detailScale: 56,
          noiseAmp: 0.28,
          microAmp: 0.14,
          contrast: 0.08,
          minFloor: 62,
          polePower: 1.6,
          poleDark: 0.04,
          bandFreq: 16,
          bandAmp: 0.17,
          accentFreq: 9,
          accentAmp: 0.16,
          bumpBand: 0.1,
          bumpNoise: 0.18,
          bumpMicro: 0.1,
          continentStart: 0,
          continentEnd: 1
        };
      case "Uranus":
        return {
          style: "banded",
          colorA: 0x72bccd,
          colorB: 0x9ad8e0,
          colorC: 0xbdeaf0,
          noiseScale: 10,
          detailScale: 48,
          noiseAmp: 0.16,
          microAmp: 0.1,
          contrast: 0.06,
          minFloor: 56,
          polePower: 1.6,
          poleDark: 0.03,
          bandFreq: 6,
          bandAmp: 0.08,
          accentFreq: 4,
          accentAmp: 0.08,
          bumpBand: 0.05,
          bumpNoise: 0.12,
          bumpMicro: 0.07,
          continentStart: 0,
          continentEnd: 1
        };
      case "Neptune":
        return {
          style: "banded",
          colorA: 0x3059a9,
          colorB: 0x5784d7,
          colorC: 0x7ea7ea,
          noiseScale: 12,
          detailScale: 52,
          noiseAmp: 0.2,
          microAmp: 0.12,
          contrast: 0.07,
          minFloor: 48,
          polePower: 1.55,
          poleDark: 0.04,
          bandFreq: 7,
          bandAmp: 0.12,
          accentFreq: 4,
          accentAmp: 0.1,
          bumpBand: 0.08,
          bumpNoise: 0.15,
          bumpMicro: 0.08,
          continentStart: 0,
          continentEnd: 1
        };
      default:
        return {
          style: "rocky",
          colorA: 0x7387a6,
          colorB: 0x9ab0ce,
          colorC: null,
          noiseScale: 20,
          detailScale: 72,
          noiseAmp: 0.35,
          microAmp: 0.18,
          contrast: 0.1,
          minFloor: 48,
          polePower: 1.4,
          poleDark: 0.05,
          bandFreq: 7,
          bandAmp: 0.1,
          accentFreq: 0,
          accentAmp: 0,
          bumpBand: 0.1,
          bumpNoise: 0.32,
          bumpMicro: 0.18,
          continentStart: 0,
          continentEnd: 1
        };
    }
  }

  function hexToRgb(hex) {
    return {
      r: (hex >> 16) & 255,
      g: (hex >> 8) & 255,
      b: hex & 255
    };
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
