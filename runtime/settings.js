// Validation for trusted JavaScript config and opt-in rendering quality caps.
// Not a sandbox or a schema for untrusted preset/URL imports; secrets stay local.
(function (createSettings) {
  "use strict";
  if (typeof module === "object" && module.exports) { module.exports = createSettings; return; }
  window.StreamSettings = createSettings();
})(function createSettings() {
  "use strict";
  var own = function (object, key) { return Object.prototype.hasOwnProperty.call(object, key); };
  var sections = ["assets", "audioReactive", "overlay", "overlayBRB", "overlayThanks", "thanksScene", "brbBlackholeReplacement"];
  var profiles = {
    tuned: null,
    low: {pixelRatio: 1, fabricSegments: 80, stars: 0.5},
    medium: {pixelRatio: 1.3, fabricSegments: 120, stars: 0.75},
    high: {pixelRatio: 2, fabricSegments: 176, stars: 1}
  };
  var numericAudio = {
    gain: [0, 20], attack: [0, 20], release: [0, 20], maxBoost: [0, 10], noiseFloorDb: [-120, 0],
    waveInfluence: [0, 20], speedInfluence: [0, 20], glowInfluence: [0, 20],
    waterfallFlowSpeed: [0, 10], waterfallRowsPerSecond: [0, 240], waterfallHeight: [0, 50],
    waterfallTrailDecay: [0, 1], waterfallBanding: [0, 10], reconnectBaseMs: [0, 60000], reconnectMaxMs: [0, 300000]
  };
  var thanksNumbers = ("cameraFov cameraRadius cameraOrbitSpeed cameraHeight cameraLookHeight cameraBobAmount " +
    "earthRadius earthPositionY earthTiltDeg earthRotationSpeed earthFloatAmplitude earthFloatSpeed earthTextureSize " +
    "cloudLayerScale cloudSpeed cloudOpacity atmosphereScale atmosphereIntensity auroraScale auroraIntensity " +
    "auroraAudioInfluence auroraTransientInfluence auroraBeatResponse moonRadius moonOrbitRadius moonOrbitSpeed " +
    "moonInclinationDeg moonSpinSpeed moonOrbitAudioInfluence moonMass moonSoftness moonTextureSize fabricSize " +
    "fabricSegments fabricBaseY earthMass earthSoftness moonMassForFabric moonSoftnessForFabric fabricWellDepth " +
    "fabricWaveAmplitude starCount mobileStarCount starMinRadius starMaxRadius maxPixelRatio exposure " +
    "keyLightIntensity fillLightIntensity rimLightIntensity keyLightAudioInfluence rimAudioInfluence").split(" ");

  function record(value) {
    return !!value && Object.prototype.toString.call(value) === "[object Object]";
  }
  function copy(value) {
    var result = {};
    Object.keys(value).forEach(function (key) {
      if (key !== "__proto__" && key !== "constructor" && key !== "prototype") result[key] = value[key];
    });
    return result;
  }
  function validUrl(value, protocols, relative) {
    if (typeof value !== "string" || !value.trim() || value.length > 4096) return false;
    var text = value.trim();
    if (/^[a-z][a-z0-9+.-]*:/i.test(text)) {
      try {
        var url = new URL(text);
        return protocols.indexOf(url.protocol) >= 0 && !url.username && !url.password;
      } catch (error) { return false; }
    }
    return relative && !/^[\\/]/.test(text) && text.indexOf("\0") < 0;
  }
  function resolve(source, search) {
    var warnings = [];
    function warn(code) { if (warnings.indexOf(code) < 0) warnings.push(code); }
    var config = record(source) ? copy(source) : {};
    if (!record(source)) warn("invalid-config");
    sections.forEach(function (section) {
      if (!own(config, section)) return;
      if (!record(config[section])) { delete config[section]; warn("invalid-section:" + section); }
      else config[section] = copy(config[section]);
    });
    function check(object, key, valid, code) {
      if (object && own(object, key) && !valid(object[key])) { delete object[key]; warn(code); }
    }
    var assets = config.assets;
    check(assets, "mode", function (v) { return typeof v === "string" && ["auto", "offline", "cdn"].indexOf(v.toLowerCase()) >= 0; }, "invalid-asset-mode");
    ["localThree", "cdnThree"].forEach(function (key) {
      check(assets, key, function (v) { return validUrl(v, ["http:", "https:"], true); }, "invalid-script-source");
    });
    var audio = config.audioReactive;
    check(audio, "enabled", function (v) { return typeof v === "boolean"; }, "invalid-audio-enabled");
    check(audio, "provider", function (v) { return typeof v === "string" && v.length <= 128; }, "invalid-audio-provider");
    // Unknown string providers remain unsupported/no-op rather than enabling OBS implicitly.
    check(audio, "url", function (v) { return validUrl(v, ["ws:", "wss:"], false); }, "invalid-audio-url");
    check(audio, "password", function (v) { return typeof v === "string"; }, "invalid-audio-password");
    check(audio, "targetInputs", function (v) {
      if (typeof v === "string") return v.length <= 512;
      return Array.isArray(v) && v.length <= 64 && v.every(function (name) { return typeof name === "string" && name.length <= 512; });
    }, "invalid-audio-inputs");
    if (audio && Array.isArray(audio.targetInputs)) audio.targetInputs = audio.targetInputs.slice();
    Object.keys(numericAudio).forEach(function (key) {
      var bounds = numericAudio[key];
      check(audio, key, function (v) { return typeof v === "number" && isFinite(v) && v >= bounds[0] && v <= bounds[1]; }, "invalid-audio-number");
    });
    var thanks = config.thanksScene;
    thanksNumbers.forEach(function (key) {
      check(thanks, key, function (v) { return typeof v === "number" && isFinite(v) && Math.abs(v) <= 1000000; }, "invalid-thanks-number");
    });
    check(thanks, "useRealWorldMaps", function (v) { return typeof v === "boolean"; }, "invalid-texture-toggle");
    ["earthDayMapUrl", "earthNightMapUrl", "earthCloudMapUrl", "earthWaterMaskUrl", "moonMapUrl", "moonBumpMapUrl", "moonRoughnessMapUrl"].forEach(function (key) {
      check(thanks, key, function (v) { return v === "" || validUrl(v, ["http:", "https:"], true); }, "invalid-texture-source");
    });
    var requested = new URLSearchParams(typeof search === "string" ? search : "").get("quality");
    var candidate = requested || (typeof config.quality === "string" ? config.quality : "tuned");
    var quality = candidate.trim().toLowerCase();
    if (!own(profiles, quality)) { quality = "tuned"; warn("invalid-quality"); }
    return {config: config, quality: quality, warnings: warnings};
  }

  function limit(kind, original, quality) {
    if (!own(profiles, quality) || !profiles[quality] || typeof original !== "number" || !isFinite(original) || original < 0) return original;
    var profile = profiles[quality];
    if (kind === "pixelRatio") return Math.min(original, profile.pixelRatio);
    if (kind === "fabricSegments") return Math.min(original, Math.max(1, Math.floor(profile.fabricSegments)));
    if (kind === "stars") return Math.min(original, Math.max(0, Math.floor(original * profile.stars)));
    return original;
  }
  function applyQuality(scene, quality) {
    if (!record(scene) || quality === "tuned" || !own(profiles, quality)) return scene;
    if (record(scene.renderer) && own(scene.renderer, "maxPixelRatio")) scene.renderer.maxPixelRatio = limit("pixelRatio", scene.renderer.maxPixelRatio, quality);
    if (record(scene.fabric) && own(scene.fabric, "segments")) scene.fabric.segments = limit("fabricSegments", scene.fabric.segments, quality);
    if (record(scene.blackHole) && own(scene.blackHole, "warpSegments")) scene.blackHole.warpSegments = limit("fabricSegments", scene.blackHole.warpSegments, quality);
    if (record(scene.stars)) {
      ["count", "mobileCount"].forEach(function (key) { if (own(scene.stars, key)) scene.stars[key] = limit("stars", scene.stars[key], quality); });
    }
    return scene;
  }
  return {resolve: resolve, applyQuality: applyQuality, limit: limit};
});
