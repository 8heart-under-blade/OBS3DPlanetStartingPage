const LOCAL_THREE_ROOT = new URL("../vendor/three-0.181.0/", import.meta.url);
const LOCAL_RUNTIME_URLS = {
  three: new URL("build/three.module.js", LOCAL_THREE_ROOT).href,
  orbitControls: new URL("examples/jsm/controls/OrbitControls.js", LOCAL_THREE_ROOT).href,
  effectComposer: new URL("examples/jsm/postprocessing/EffectComposer.js", LOCAL_THREE_ROOT).href,
  renderPass: new URL("examples/jsm/postprocessing/RenderPass.js", LOCAL_THREE_ROOT).href,
  unrealBloomPass: new URL("examples/jsm/postprocessing/UnrealBloomPass.js", LOCAL_THREE_ROOT).href
};
const CDN_RUNTIME_URLS = {
  three: "https://unpkg.com/three@0.181.0/build/three.module.js?module",
  orbitControls: "https://unpkg.com/three@0.181.0/examples/jsm/controls/OrbitControls.js?module",
  effectComposer: "https://unpkg.com/three@0.181.0/examples/jsm/postprocessing/EffectComposer.js?module",
  renderPass: "https://unpkg.com/three@0.181.0/examples/jsm/postprocessing/RenderPass.js?module",
  unrealBloomPass: "https://unpkg.com/three@0.181.0/examples/jsm/postprocessing/UnrealBloomPass.js?module"
};
let overlayRuntimePromise = null;

const vertexShader = `varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const fragmentShader = `precision highp float;

uniform float uTime;

uniform vec3 uCameraPos;
uniform vec3 uCamForward;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform float uAspect;
uniform float uFov;

uniform float uShadowRadius;
uniform float uDiskInnerRadius;
uniform float uDiskOuterRadius;
uniform float uDiskThickness;
uniform float uDiskIntensity;
uniform float uLensingStrength;
uniform float uRingIntensity;
uniform float uRingRadius;
uniform float uRingWidth;
uniform float uStepScale;

varying vec2 vUv;

// Tuned knobs for quick visual matching without rewiring uniforms.
// Before: broad neon ribbons. After: thinner filaments and tighter critical rim.
const float STREAK_SHARPNESS = 10.5;
const float THETA_BLUR_SPREAD = 0.0075;
const float UPPER_ARC_BOOST = 1.32;
const float LOWER_IMAGE_COMPACTNESS = 1.12;
const float DISK_WIDTH_SCALE = 1.5;
const float SIDE_VIEW_BOOST = 0.42;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);

  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));

  vec2 u = f * f * (3.0 - 2.0 * f);

  return mix(a, b, u.x) +
    (c - a) * u.y * (1.0 - u.x) +
    (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;

  for (int i = 0; i < 4; i++) {
    value += amplitude * noise2(p);
    p *= 2.02;
    amplitude *= 0.5;
  }

  return value;
}

// Before: aggressive white-hot ramp clipped large portions of the disk.
// After: deeper red/orange ramp with small yellow highlights only in hot spots.
vec3 blackbodyRamp(float t) {
  vec3 deepRed = vec3(0.03, 0.004, 0.0008);
  vec3 red = vec3(0.34, 0.055, 0.010);
  vec3 orange = vec3(0.95, 0.24, 0.028);
  vec3 amber = vec3(1.70, 0.62, 0.065);
  vec3 hotYellow = vec3(2.05, 0.95, 0.11);

  t = clamp(t, 0.0, 1.25);

  vec3 base = mix(deepRed, red, smoothstep(0.0, 0.24, t));
  vec3 warm = mix(red, orange, smoothstep(0.18, 0.62, t));
  vec3 hot = mix(orange, amber, smoothstep(0.55, 1.0, t));
  vec3 spark = mix(amber, hotYellow, smoothstep(0.95, 1.25, t));

  return base * 0.35 + warm * 0.75 + hot * 0.9 + spark * 0.18;
}

float filamentField(float radial, float angle) {
  float shearAngle = angle + radial * 6.4 - uTime * 0.22;

  float coarse = fbm(vec2(shearAngle * 6.1, radial * 28.0));
  float fine = noise2(vec2(shearAngle * 18.0 + coarse * 3.0, radial * 67.0));

  float ridgeA = pow(max(0.0, 1.0 - abs(coarse * 2.0 - 1.0)), STREAK_SHARPNESS);
  float ridgeB = pow(max(0.0, 1.0 - abs(fine * 2.0 - 1.0)), STREAK_SHARPNESS + 2.0);

  return ridgeA * 0.66 + ridgeB * 0.34;
}

// Before: repeated sin stripes looked grid-like.
// After: layered ridge noise + theta taps gives thin striated flow lines.
float diskFlow(float radius, float angle) {
  float radial = (radius - uDiskInnerRadius) / (uDiskOuterRadius - uDiskInnerRadius);

  float blur = THETA_BLUR_SPREAD * (1.0 + radial * 0.8);
  float tap0 = filamentField(radial, angle);
  float tap1 = filamentField(radial, angle + blur);
  float tap2 = filamentField(radial, angle - blur);
  float tap3 = filamentField(radial, angle + 2.0 * blur);
  float tap4 = filamentField(radial, angle - 2.0 * blur);

  float streaks = tap0 * 0.34 + (tap1 + tap2) * 0.24 + (tap3 + tap4) * 0.09;

  float bandNoise = fbm(vec2(radial * 13.0, angle * 2.4 - uTime * 0.07));
  float ringA = 0.5 + 0.5 * sin(radial * 63.0 + bandNoise * 5.5 - uTime * 0.11);
  float ringB = 0.5 + 0.5 * sin(radial * 98.0 - angle * 3.1 + uTime * 0.08);
  float radialBands = smoothstep(0.2, 0.95, ringA * 0.62 + ringB * 0.38);

  float drift = fbm(vec2(angle * 4.7 - uTime * 0.17, radial * 10.2 + uTime * 0.06));

  return clamp(streaks * (0.7 + 0.52 * radialBands) * (0.88 + 0.2 * drift), 0.0, 1.8);
}

vec4 traceBlackHole(vec3 ro, vec3 rd) {
  vec3 color = vec3(0.0);
  vec3 pos = ro;
  vec3 dir = rd;
  vec3 prevPos = pos;

  float minR = 1e8;
  float throughput = 1.0;
  float diskAlpha = 0.0;
  float diskCoverage = 0.0;
  int hitCount = 0;
  bool wasInsideSlab = false;

  const int STEPS = 232;

  for (int i = 0; i < STEPS; i++) {
    float r = length(pos);
    minR = min(minR, r);

    if (r < uShadowRadius) {
      throughput = 0.0;
      break;
    }

    float gravity = uLensingStrength / (r * r + 0.08);
    dir = normalize(dir - normalize(pos) * gravity * uStepScale);

    float stepLen = uStepScale * (0.68 + 0.11 * r);
    prevPos = pos;
    pos += dir * stepLen;

    float y0 = prevPos.y;
    float y1 = pos.y;

    bool crossesMidplane = (y0 > 0.0 && y1 <= 0.0) || (y0 < 0.0 && y1 >= 0.0);
    bool insideSlab = abs(0.5 * (y0 + y1)) <= uDiskThickness;
    bool slabEntry = insideSlab && !wasInsideSlab;
    bool crossingEvent = crossesMidplane || slabEntry;

    if (crossingEvent || insideSlab) {
      float t = crossesMidplane ? clamp(y0 / (y0 - y1 + 1e-5), 0.0, 1.0) : 0.5;
      vec3 hit = mix(prevPos, pos, t);
      float yDist = abs(hit.y);
      float radius = length(hit.xz);

      if (radius > uDiskInnerRadius && radius < uDiskOuterRadius) {
        float radial = (radius - uDiskInnerRadius) / (uDiskOuterRadius - uDiskInnerRadius);
        float imageIndex = float(hitCount);

        float primaryW = 1.0 - smoothstep(0.5, 1.1, imageIndex);
        float secondaryW = smoothstep(0.0, 1.0, imageIndex) * (1.0 - smoothstep(1.5, 2.3, imageIndex));
        float higherW = smoothstep(1.4, 2.2, imageIndex);

        float innerGap = smoothstep(0.08, 0.2, radial);
        float outerFade = 1.0 - smoothstep(0.93, 1.0, radial);

        float primaryBand = exp(-pow((radial - 0.43) / (0.31 * DISK_WIDTH_SCALE), 2.0));
        float upperBandA = exp(-pow((radial - 0.23) / (0.16 * DISK_WIDTH_SCALE), 2.0));
        float upperBandB = exp(-pow((radial - 0.54) / (0.22 * DISK_WIDTH_SCALE), 2.0));
        float upperLayered = upperBandA + upperBandB * 0.72;
        float lowerCompact = exp(-pow((radial - 0.2) * LOWER_IMAGE_COMPACTNESS / (0.16 * DISK_WIDTH_SCALE), 2.0));

        float radialShape = primaryW * primaryBand + secondaryW * upperLayered + higherW * lowerCompact;
        radialShape *= innerGap * outerFade;

        float thicknessWeight = exp(-yDist / max(0.0001, uDiskThickness * 0.42));

        float angle = atan(hit.z, hit.x);
        float flow = diskFlow(radius, angle);

        vec3 velocity = normalize(vec3(-hit.z, 0.0, hit.x));
        vec3 toCam = normalize(ro - hit);
        float doppler = pow(clamp(1.0 + 0.56 * dot(velocity, toCam), 0.45, 1.55), 1.45);

        float sideView = 1.0 + SIDE_VIEW_BOOST * (1.0 - smoothstep(0.12, 0.78, abs(toCam.y)));
        float grazing = 0.7 + 0.7 * pow(clamp(1.0 - abs(dir.y), 0.0, 1.0), 0.55);
        float multiImageBoost = primaryW * 1.0 + secondaryW * UPPER_ARC_BOOST + higherW * 0.62;
        float sampleBlend = crossingEvent ? 1.0 : 0.2;

        float coverage = radialShape * thicknessWeight;
        coverage *= (primaryW * 1.0 + secondaryW * 0.95 + higherW * 0.74);
        coverage *= mix(0.62, 1.0, sampleBlend);
        coverage *= (0.78 + 0.32 * sideView);
        diskCoverage = max(diskCoverage, throughput * coverage);

        float emissive = (0.14 + flow * 1.04) * radialShape * grazing * thicknessWeight * sideView * sampleBlend;
        emissive *= doppler * uDiskIntensity * multiImageBoost;

        float hotSpots = pow(clamp(flow - 0.62, 0.0, 1.0), 3.4);
        vec3 diskColor = blackbodyRamp(0.16 + flow * 0.88 + hotSpots * 0.24);
        color += throughput * diskColor * emissive;
        diskAlpha = max(diskAlpha, throughput * emissive);

        if (crossingEvent) {
          throughput *= 0.69;
          hitCount += 1;

          if (hitCount >= 4 || throughput < 0.03) {
            break;
          }
        }
      }
    }

    wasInsideSlab = insideSlab;

    if (r > 42.0 && i > 24) {
      break;
    }
  }

  float shadowMask = smoothstep(uShadowRadius * 0.995, uShadowRadius * 1.015, minR);
  if (diskAlpha < 1e-4) {
    color *= shadowMask;
  }

  float ring = exp(-pow((minR - uRingRadius) / max(0.0008, uRingWidth), 2.0));
  color += vec3(1.28, 0.46, 0.09) * ring * uRingIntensity;

  float halo = exp(-2.2 * max(0.0, minR - uShadowRadius));
  float haloMask = smoothstep(uShadowRadius + 0.04, uShadowRadius + 0.16, minR);
  color += vec3(0.004, 0.0012, 0.0003) * halo * haloMask;

  float shadowAlpha = 1.0 - shadowMask;
  float diskPresence = max(diskAlpha * 0.85, diskCoverage);
  float diskMask = clamp(pow(max(diskPresence, 0.0), 0.46) * 1.08, 0.0, 1.0);
  float ringMask = clamp(ring * uRingIntensity * 1.4, 0.0, 1.0);
  float haloAlpha = clamp(halo * haloMask * 0.45, 0.0, 1.0);
  float colorLuma = max(max(color.r, color.g), color.b);
  float colorMask = smoothstep(0.045, 0.16, colorLuma);
  float alpha = max(shadowAlpha, max(diskMask, max(ringMask, max(haloAlpha, colorMask))));
  alpha = clamp(alpha, 0.0, 1.0);

  if (alpha < 0.002) {
    discard;
  }

  return vec4(max(color, vec3(0.0)), alpha);
}

void main() {
  vec2 screen = vUv * 2.0 - 1.0;
  screen.x *= uAspect;

  float tanHalfFov = tan(radians(uFov) * 0.5);
  vec3 rd = normalize(
    uCamForward +
    screen.x * tanHalfFov * uCamRight +
    screen.y * tanHalfFov * uCamUp
  );

  vec4 traced = traceBlackHole(uCameraPos, rd);
  vec3 color = traced.rgb;

  float vignette = 1.0 - smoothstep(0.55, 1.5, length(screen));
  color *= mix(0.96, 1.0, vignette);

gl_FragColor = vec4(color, traced.a);
}
`;

function getOverlayAssetPreference() {
  const requestedMode = typeof window.STREAM_ASSET_MODE === "string" ? window.STREAM_ASSET_MODE.toLowerCase() : "auto";
  const resolvedMode = typeof window.STREAM_ASSET_RESOLVED_MODE === "string" ? window.STREAM_ASSET_RESOLVED_MODE.toLowerCase() : "";

  if (requestedMode === "offline" || requestedMode === "cdn") {
    return {
      requestedMode: requestedMode,
      preferredMode: requestedMode
    };
  }

  return {
    requestedMode: "auto",
    preferredMode: resolvedMode === "cdn" ? "cdn" : "offline"
  };
}

async function importOverlayRuntime(urls) {
  const modules = await Promise.all([
    import(urls.three),
    import(urls.orbitControls),
    import(urls.effectComposer),
    import(urls.renderPass),
    import(urls.unrealBloomPass)
  ]);

  return {
    THREE: modules[0],
    OrbitControls: modules[1].OrbitControls,
    EffectComposer: modules[2].EffectComposer,
    RenderPass: modules[3].RenderPass,
    UnrealBloomPass: modules[4].UnrealBloomPass
  };
}

async function loadOverlayRuntime() {
  if (overlayRuntimePromise) {
    return overlayRuntimePromise;
  }

  overlayRuntimePromise = (async function () {
    var preference = getOverlayAssetPreference();
    var requestedMode = preference.requestedMode;
    var preferredMode = preference.preferredMode;

    if (requestedMode === "cdn") {
      return importOverlayRuntime(CDN_RUNTIME_URLS);
    }
    if (requestedMode === "offline") {
      return importOverlayRuntime(LOCAL_RUNTIME_URLS);
    }

    try {
      return await importOverlayRuntime(preferredMode === "cdn" ? CDN_RUNTIME_URLS : LOCAL_RUNTIME_URLS);
    } catch (localError) {
      console.warn("BRB overlay preferred module load failed, falling back to the alternate source.", localError);
      return importOverlayRuntime(preferredMode === "cdn" ? LOCAL_RUNTIME_URLS : CDN_RUNTIME_URLS);
    }
  })();

  return overlayRuntimePromise;
}

export async function mountBlackholeOverlay() {
  const runtime = await loadOverlayRuntime();
  const THREE = runtime.THREE;
  const OrbitControls = runtime.OrbitControls;
  const EffectComposer = runtime.EffectComposer;
  const RenderPass = runtime.RenderPass;
  const UnrealBloomPass = runtime.UnrealBloomPass;
  const streamConfig = window.STREAM_CONFIG && typeof window.STREAM_CONFIG === "object" ? window.STREAM_CONFIG : {};
  const replacementConfig = streamConfig.brbBlackholeReplacement && typeof streamConfig.brbBlackholeReplacement === "object"
    ? streamConfig.brbBlackholeReplacement
    : {};
  const enabled = replacementConfig.enabled !== false;

  if (!enabled) {
    return null;
  }

  const layer = document.getElementById("blackholeLayer");
  if (!layer) {
    return null;
  }

  const pointerEvents = typeof replacementConfig.pointerEvents === "string"
    ? replacementConfig.pointerEvents.toLowerCase()
    : "auto";
  const rawSizeScale = Number(replacementConfig.sizeScale);
  const sizeScale = Number.isFinite(rawSizeScale)
    ? Math.min(Math.max(rawSizeScale, 0.2), 2)
    : 1;
  const useBloom = replacementConfig.useBloom === true;
  const mouseControlEnabled = replacementConfig.mouseControlEnabled !== false;
  const cameraPosition = readVector3Config(replacementConfig.cameraPosition, 0, 5.2, 22);
  const cameraTarget = readVector3Config(replacementConfig.cameraTarget, 0, 0, 0);
  const resolvedPointerEvents = pointerEvents === "none" || !mouseControlEnabled ? "none" : "auto";
  layer.style.pointerEvents = resolvedPointerEvents;

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setClearAlpha(0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.94;
  renderer.domElement.style.transformOrigin = "50% 50%";
  renderer.domElement.style.transform = sizeScale === 1 ? "none" : "scale(" + String(sizeScale) + ")";
  layer.appendChild(renderer.domElement);

  const raytraceScene = new THREE.Scene();
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const viewCamera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
  viewCamera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
  viewCamera.lookAt(cameraTarget.x, cameraTarget.y, cameraTarget.z);

  const controls = mouseControlEnabled ? createOrbitControls(THREE, OrbitControls, viewCamera, renderer.domElement, cameraTarget) : null;

  const params = {
    shadowRadius: 0.62,
    diskInnerRadius: 3.45,
    diskOuterRadius: 13.35,
    diskThickness: 0.11,
    diskIntensity: 1.06,
    lensingStrength: 2.75,
    ringIntensity: 0.68,
    ringRadius: 0.76,
    ringWidth: 0.032,
    stepScale: 0.094
  };

  const uniforms = {
    uTime: { value: 0 },
    uCameraPos: { value: viewCamera.position.clone() },
    uCamForward: { value: new THREE.Vector3(0, 0, -1) },
    uCamRight: { value: new THREE.Vector3(1, 0, 0) },
    uCamUp: { value: new THREE.Vector3(0, 1, 0) },
    uAspect: { value: viewCamera.aspect },
    uFov: { value: viewCamera.fov },
    uShadowRadius: { value: params.shadowRadius },
    uDiskInnerRadius: { value: params.diskInnerRadius },
    uDiskOuterRadius: { value: params.diskOuterRadius },
    uDiskThickness: { value: params.diskThickness },
    uDiskIntensity: { value: params.diskIntensity },
    uLensingStrength: { value: params.lensingStrength },
    uRingIntensity: { value: params.ringIntensity },
    uRingRadius: { value: params.ringRadius },
    uRingWidth: { value: params.ringWidth },
    uStepScale: { value: params.stepScale }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    depthWrite: false,
    depthTest: false,
    transparent: true
  });

  const quadGeometry = new THREE.PlaneGeometry(2, 2);
  const quad = new THREE.Mesh(quadGeometry, material);
  raytraceScene.add(quad);

  let composer = null;
  let bloomPass = null;
  if (useBloom) {
    composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(raytraceScene, quadCamera);
    renderPass.clear = true;
    renderPass.clearColor = new THREE.Color(0x000000);
    renderPass.clearAlpha = 0;
    composer.addPass(renderPass);

    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(1, 1),
      0.11,
      0.28,
      1.1
    );
    bloomPass.blendMaterial.blendSrcAlpha = THREE.ZeroFactor;
    bloomPass.blendMaterial.blendDstAlpha = THREE.OneFactor;
    composer.addPass(bloomPass);
  }

  const camRight = new THREE.Vector3();
  const camUp = new THREE.Vector3();
  const camForward = new THREE.Vector3();
  const clock = new THREE.Clock();
  let rafId = 0;
  let resizeObserver = null;

  function updateCameraUniforms() {
    viewCamera.updateMatrixWorld();
    const e = viewCamera.matrixWorld.elements;

    camRight.set(e[0], e[1], e[2]).normalize();
    camUp.set(e[4], e[5], e[6]).normalize();
    camForward.set(-e[8], -e[9], -e[10]).normalize();

    uniforms.uCameraPos.value.copy(viewCamera.position);
    uniforms.uCamRight.value.copy(camRight);
    uniforms.uCamUp.value.copy(camUp);
    uniforms.uCamForward.value.copy(camForward);
  }

  function onResize() {
    const bounds = layer.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    if (composer) {
      composer.setSize(width, height);
    }
    if (bloomPass) {
      bloomPass.setSize(width, height);
    }

    viewCamera.aspect = width / height;
    viewCamera.updateProjectionMatrix();

    uniforms.uAspect.value = viewCamera.aspect;
    uniforms.uFov.value = viewCamera.fov;
  }

  function tick() {
    renderer.setClearColor(0x000000, 0);
    if (controls) {
      controls.update();
    }
    uniforms.uTime.value = clock.getElapsedTime();
    updateCameraUniforms();

    if (composer) {
      composer.render();
    } else {
      renderer.render(raytraceScene, quadCamera);
    }
    rafId = window.requestAnimationFrame(tick);
  }

  function dispose() {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }

    window.removeEventListener("resize", onResize);
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }

    if (controls) {
      controls.dispose();
    }
    if (composer) {
      composer.dispose();
    }
    quadGeometry.dispose();
    material.dispose();
    renderer.dispose();

    if (renderer.domElement.parentElement === layer) {
      layer.removeChild(renderer.domElement);
    }
  }

  window.addEventListener("resize", onResize);
  if (typeof window.ResizeObserver === "function") {
    resizeObserver = new window.ResizeObserver(onResize);
    resizeObserver.observe(layer);
  }
  window.addEventListener("beforeunload", dispose, { once: true });

  onResize();
  tick();

  return {
    dispose
  };
}

function createOrbitControls(THREE, OrbitControls, camera, domElement, target) {
  const controls = new OrbitControls(camera, domElement);

  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.rotateSpeed = 0.5;
  controls.zoomSpeed = 0.9;

  controls.enablePan = false;
  controls.minDistance = 5.8;
  controls.maxDistance = 32.0;
  controls.target.set(target.x, target.y, target.z);

  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: null
  };

  return controls;
}

function readVector3Config(value, fallbackX, fallbackY, fallbackZ) {
  const source = value && typeof value === "object" ? value : {};

  return {
    x: readNumber(source.x, fallbackX),
    y: readNumber(source.y, fallbackY),
    z: readNumber(source.z, fallbackZ)
  };
}

function readNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
