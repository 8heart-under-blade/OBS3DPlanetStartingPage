// P2 nonsecret settings protocol. Strict allowlist; never executable config/CSS/URLs.
(function (createSnapshots) {
  "use strict";
  if (typeof module === "object" && module.exports) { module.exports = createSnapshots; return; }
  window.StreamSnapshots = createSnapshots(window);
})(function createSnapshots(environment) {
  "use strict";
  var env = environment || globalThis;
  var MAX_BYTES = 8192;
  var MAX_URL = 12288;
  var SCENES = ["starting", "brb", "thanks"];
  var PAGES = {starting: "index.html", brb: "brb.html", thanks: "thanks.html"};
  var FONTS = {cinzel: "'Cinzel Decorative', serif", macondo: "'Macondo', serif", system: "sans-serif"};
  var FIELDS = ["title", "subtitle", "titleFont", "subtitleFont", "topVh", "titleSpacing", "subtitleSpacing"];
  var own = function (object, key) { return Object.prototype.hasOwnProperty.call(object, key); };
  function fail(message) { throw new Error(message); }
  function record(value) { return !!value && Object.prototype.toString.call(value) === "[object Object]"; }
  function knownKeys(value, allowed) {
    if (!record(value)) fail("Preset contains an invalid object.");
    var keys = Object.keys(value);
    if (keys.length > allowed.length || keys.some(function (key) { return allowed.indexOf(key) < 0; })) fail("Preset contains unknown or unsafe fields.");
  }
  function bytes(text) { return new env.TextEncoder().encode(text); }
  function bounded(text) {
    if (typeof text !== "string" || text.length > MAX_BYTES || bytes(text).length > MAX_BYTES) fail("Preset exceeds the 8 KiB settings limit.");
    return text;
  }
  function defaults() {
    return {schemaVersion: 1, quality: "tuned", reducedMotion: false, audioMode: "off", scenes: {
      starting: {title: "STREAM STARTING SOON", subtitle: "Calibrating spacetime and aligning planetary ephemerides...", titleFont: "cinzel", subtitleFont: "system", topVh: 12, titleSpacing: 0.06, subtitleSpacing: 0.03},
      brb: {title: "BE RIGHT BACK", subtitle: "Crossing the event horizon. Return imminent.", titleFont: "cinzel", subtitleFont: "system", topVh: 4, titleSpacing: 0.06, subtitleSpacing: 0.03},
      thanks: {title: "THANK YOU FOR WATCHING", subtitle: "See You Next Time", titleFont: "cinzel", subtitleFont: "macondo", topVh: 6, titleSpacing: 0.08, subtitleSpacing: 0.01}
    }};
  }
  function text(value, maximum) {
    if (typeof value !== "string" || value.length > maximum * 2 || Array.from(value).length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) fail("Preset text is invalid or too long.");
    return value;
  }
  function number(value, maximum) {
    if (typeof value !== "number" || !isFinite(value) || value < 0 || value > maximum) fail("Preset position or spacing is out of range.");
    return value;
  }
  function validate(input) {
    knownKeys(input, ["schemaVersion", "quality", "reducedMotion", "audioMode", "scenes"]);
    if (!own(input, "schemaVersion") || input.schemaVersion !== 1) fail("Unsupported preset version.");
    var result = defaults();
    if (own(input, "quality")) {
      if (["tuned", "low", "medium", "high"].indexOf(input.quality) < 0) fail("Preset quality is invalid.");
      result.quality = input.quality;
    }
    if (own(input, "reducedMotion")) {
      if (typeof input.reducedMotion !== "boolean") fail("Preset motion setting is invalid.");
      result.reducedMotion = input.reducedMotion;
    }
    if (own(input, "audioMode")) {
      if (["off", "auto", "setup"].indexOf(input.audioMode) < 0) fail("Preset audio mode is invalid.");
      result.audioMode = input.audioMode;
    }
    if (own(input, "scenes")) {
      knownKeys(input.scenes, SCENES);
      SCENES.forEach(function (scene) {
        if (!own(input.scenes, scene)) return;
        var source = input.scenes[scene];
        knownKeys(source, FIELDS);
        FIELDS.forEach(function (field) {
          if (!own(source, field)) return;
          if (field === "title" || field === "subtitle") result.scenes[scene][field] = text(source[field], field === "title" ? 120 : 240);
          else if (field === "titleFont" || field === "subtitleFont") {
            if (typeof source[field] !== "string" || !own(FONTS, source[field])) fail("Preset font is not available.");
            result.scenes[scene][field] = source[field];
          } else result.scenes[scene][field] = number(source[field], field === "topVh" ? 40 : 0.4);
        });
      });
    }
    bounded(JSON.stringify(result));
    return result;
  }
  function parse(source) {
    bounded(source);
    var value;
    try { value = JSON.parse(source); } catch (error) { fail("Preset is not valid JSON."); }
    if (record(value) && value.schemaVersion === 0) {
      // Supported prototype format: one Starting title/subtitle, optional quality.
      knownKeys(value, ["schemaVersion", "title", "subtitle", "quality"]);
      var old = {schemaVersion: 1, scenes: {starting: {}}};
      if (own(value, "title")) old.scenes.starting.title = value.title;
      if (own(value, "subtitle")) old.scenes.starting.subtitle = value.subtitle;
      if (own(value, "quality")) old.quality = value.quality;
      return validate(old);
    }
    return validate(value);
  }
  function stringify(value) { return JSON.stringify(validate(value)); }
  function encodeBytes(data) {
    var binary = "";
    for (var i = 0; i < data.length; i++) binary += String.fromCharCode(data[i]);
    return env.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function encode(value) { return encodeBytes(bytes(stringify(value))); }
  function decode(token) {
    if (typeof token !== "string" || !token || token.length > Math.ceil(MAX_BYTES * 4 / 3) || !/^[A-Za-z0-9_-]+$/.test(token)) fail("Preset link is malformed or too large.");
    var binary;
    try {
      var base = token.replace(/-/g, "+").replace(/_/g, "/");
      binary = env.atob(base + "=".repeat((4 - base.length % 4) % 4));
    } catch (error) { fail("Preset link is malformed."); }
    if (binary.length > MAX_BYTES) fail("Preset exceeds the 8 KiB settings limit.");
    var data = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i);
    if (encodeBytes(data) !== token) fail("Preset link encoding is invalid.");
    var source;
    try { source = new env.TextDecoder("utf-8", {fatal: true}).decode(data); }
    catch (error) { fail("Preset link contains invalid text."); }
    return parse(source);
  }
  function fromHash(hash) {
    if (!hash || hash === "#") return null;
    if (typeof hash !== "string") fail("Preset link is malformed.");
    if (hash.length > MAX_URL) fail("Preset link is too large.");
    var fragment = hash.charAt(0) === "#" ? hash.slice(1) : hash;
    var params = new URLSearchParams(fragment);
    if (!Array.from(params.keys()).some(function (key) { return key.toLowerCase() === "preset"; })) return null;
    if (hash.length > MAX_URL || !/^preset=[A-Za-z0-9_-]+$/.test(fragment)) fail("Preset link is malformed or too large.");
    return decode(fragment.slice(7));
  }
  function supportsLocalAudio(base) {
    try {
      var url = new URL(base);
      return ["http:", "https:"].indexOf(url.protocol) >= 0 && !url.username && !url.password && ["localhost", "127.0.0.1", "[::1]"].indexOf(url.hostname.toLowerCase()) >= 0;
    } catch (error) { return false; }
  }
  function toUrl(value, scene, base) {
    if (!own(PAGES, scene)) fail("Unknown scene.");
    var url;
    try {
      url = new URL(PAGES[scene], base);
      if (["http:", "https:"].indexOf(url.protocol) < 0 || url.username || url.password) fail("Use an HTTP or HTTPS site to create OBS links.");
    } catch (error) { fail("Use an HTTP or HTTPS site to create OBS links."); }
    var snapshot = validate(value);
    url.search = "?assets=offline";
    url.hash = "preset=" + encode(snapshot);
    if (url.href.length > MAX_URL) fail("OBS link is too long. Export the preset and re-import it from a shorter site URL.");
    return url.href;
  }
  function apply(value, base) {
    var snapshot = validate(value);
    var source = record(base) ? base : {};
    var config = Object.assign({}, source);
    var names = {starting: "overlay", brb: "overlayBRB", thanks: "overlayThanks"};
    SCENES.forEach(function (scene) {
      var data = snapshot.scenes[scene];
      config[names[scene]] = Object.assign({}, record(source[names[scene]]) ? source[names[scene]] : {}, {
        title: data.title, subtitle: data.subtitle,
        titleFontFamily: FONTS[data.titleFont], subtitleFontFamily: FONTS[data.subtitleFont],
        overlayTop: data.topVh + "vh", overlayTopMobile: data.topVh + "vh",
        titleKerning: data.titleSpacing, subtitleKerning: data.subtitleSpacing,
        externalFontStylesheets: [], customFontFaces: [
          {family: "Cinzel Decorative", src: "@cinzel-decorative.ttf", weight: "400", style: "normal", display: "swap"},
          {family: "Macondo", src: "@macondo.ttf", weight: "400", style: "normal", display: "swap"}
        ]
      });
    });
    config.audioReactive = Object.assign({}, record(source.audioReactive) ? source.audioReactive : {}, {enabled: false, password: ""});
    config.quality = snapshot.quality;
    return config;
  }
  return {MAX_BYTES: MAX_BYTES, MAX_URL: MAX_URL, defaults: defaults, validate: validate,
    parse: parse, stringify: stringify, encode: encode, decode: decode, fromHash: fromHash, toUrl: toUrl, supportsLocalAudio: supportsLocalAudio, apply: apply};
});
