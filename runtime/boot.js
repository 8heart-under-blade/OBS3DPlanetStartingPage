// Shared classic-script bootstrap. Keep renderers and their tuned config isolated.
// CommonJS exports the factory for dependency-free tests; browsers auto-start via
// data-scene after config.js. The injected importer is an internal test seam.
(function (createBoot) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = createBoot;
    return;
  }

  var script = document.currentScript;
  window.StreamBoot = createBoot(window, document, function () {
    // Dynamic imports resolve relative to THIS file, not the HTML document.
    return import("../brb-blackhole/blackholeOverlay.module.js");
  });
  window.StreamBoot.ready = window.StreamBoot.start(script && script.getAttribute("data-scene"));
})(function createBoot(win, doc, importOverlay) {
  "use strict";

  var scenes = {
    starting: { page: "index.html", script: "main.js" },
    brb: { page: "brb.html", script: "brb.js" },
    thanks: { page: "thanks.html", script: "thanks.js" }
  };
  var pendingBoot = null;

  function knownScene(scene) {
    return Object.prototype.hasOwnProperty.call(scenes, scene);
  }

  function normalizeScene(value) {
    if (typeof value !== "string") return "";
    var scene = value.trim().toLowerCase();
    if (scene === "start" || scene === "soon") return "starting";
    if (scene === "be-right-back" || scene === "berightback") return "brb";
    if (["thankyou", "thank-you", "thanks-for-watching", "ty4w", "ending", "end"].indexOf(scene) >= 0) return "thanks";
    return scene;
  }

  function configObject(value) {
    return value && typeof value === "object" ? value : {};
  }

  function assetSettings(config, params) {
    var assets = configObject(config.assets);
    var requested = (params.get("assets") || "").toLowerCase();
    var configured = typeof assets.mode === "string" ? assets.mode.toLowerCase() : "";
    var candidate = requested || configured;
    return {
      mode: ["auto", "offline", "cdn"].indexOf(candidate) >= 0 ? candidate : "auto",
      localThree: typeof assets.localThree === "string" && assets.localThree ? assets.localThree : "vendor/three.min.js",
      cdnThree: typeof assets.cdnThree === "string" && assets.cdnThree ? assets.cdnThree : "https://unpkg.com/three@0.160.1/build/three.min.js"
    };
  }

  function redirect(scene, params) {
    var page = scenes[scene].page;
    var parts = (win.location.pathname || "").split("/");
    var current = (parts[parts.length - 1] || "index.html").toLowerCase();
    if (current === page) return;
    var next = new URLSearchParams(params.toString());
    next.set("scene", scene);
    win.location.replace(page + "?" + next.toString() + (win.location.hash || ""));
  }

  function loadScript(source) {
    return new Promise(function (resolve, reject) {
      var script = doc.createElement("script");
      var settled = false;
      var timer = null;
      function finish(error) {
        if (settled) return;
        settled = true;
        if (timer !== null && typeof win.clearTimeout === "function") win.clearTimeout(timer);
        script.onload = script.onerror = null;
        if (error) reject(error); else resolve();
      }
      script.src = source;
      script.async = true;
      script.onload = function () { finish(); };
      script.onerror = function () { finish(new Error("Rendering script could not load.")); };
      if (typeof win.setTimeout === "function") {
        timer = win.setTimeout(function () {
          var error = new Error("Rendering script load timed out.");
          error.code = "ASSET_TIMEOUT";
          if (script.parentNode) script.parentNode.removeChild(script);
          finish(error);
        }, 15000);
      }
      doc.head.appendChild(script);
    });
  }

  function showError(scene, mode, error) {
    var element = doc.getElementById("bootError");
    if (!element) return;
    if (error && error.code === "OVERLAY_RUNTIME_MISSING") {
      element.textContent = "Shared overlay helpers could not load. Keep runtime/overlay.js next to this page.";
    } else if (error && error.code === "AUDIO_RUNTIME_MISSING") {
      element.textContent = "Shared audio helpers could not load. Keep runtime/audio.js next to this page.";
    } else if (error && error.code === "RECOVERY_RUNTIME_MISSING") {
      element.textContent = "Recovery helpers could not load. Keep runtime/recovery.js next to this page.";
    } else if (error && error.code === "SETTINGS_RUNTIME_MISSING") {
      element.textContent = "Settings helpers could not load. Keep runtime/settings.js next to this page.";
    } else if (error && error.code === "ASSET_TIMEOUT") {
      element.textContent = "An asset took too long to load. Check the local files or network, then refresh this source.";
    } else if (mode !== "offline") {
      element.textContent = "Could not load rendering assets. Check network access or local vendor files.";
    } else if (scene === "brb") {
      element.textContent = "Offline mode selected, but local BRB assets could not be loaded. Keep the vendor folder and BRB overlay modules next to brb.html, or switch to ?assets=auto.";
    } else {
      var page = knownScene(scene) ? scenes[scene].page : "the scene page";
      element.textContent = "Offline mode selected, but local assets could not be loaded. Keep the vendor folder next to " + page + ", or switch to ?assets=auto.";
    }
    element.hidden = false;
  }

  async function boot(pageScene) {
    var mode = "auto";
    try {
      if (!knownScene(pageScene)) throw new Error("Unknown scene bootstrap");
      var config = configObject(win.STREAM_CONFIG);
      // Preserve the original Starting-page compatibility alias only.
      if (pageScene === "starting" && !win.STREAM_OVERLAY && config.overlay && typeof config.overlay === "object") {
        win.STREAM_OVERLAY = config.overlay;
      }

      var params = new URLSearchParams(win.location.search);
      var requestedScene = normalizeScene(params.get("scene"));
      if (knownScene(requestedScene) && requestedScene !== pageScene) {
        redirect(requestedScene, params);
        return { status: "redirected", scene: requestedScene };
      }

      if (!win.StreamSettings || typeof win.StreamSettings.resolve !== "function" || typeof win.StreamSettings.applyQuality !== "function" || typeof win.StreamSettings.limit !== "function") {
        var missingSettings = new Error("Settings helpers did not load");
        missingSettings.code = "SETTINGS_RUNTIME_MISSING";
        throw missingSettings;
      }
      var runtimeSettings = win.StreamSettings.resolve(config, win.location.search);
      config = runtimeSettings.config;
      win.STREAM_RUNTIME_CONFIG = config;
      win.STREAM_QUALITY = runtimeSettings.quality;
      win.STREAM_CONFIG_WARNINGS = runtimeSettings.warnings.slice();
      var settings = assetSettings(config, params);
      mode = settings.mode;
      if (!win.StreamOverlay || typeof win.StreamOverlay.applyTypography !== "function" || typeof win.StreamOverlay.startClock !== "function") {
        var missingOverlay = new Error("Shared overlay helpers did not load");
        missingOverlay.code = "OVERLAY_RUNTIME_MISSING";
        throw missingOverlay;
      }
      if (!win.StreamAudio || typeof win.StreamAudio.createController !== "function") {
        var missingAudio = new Error("Shared audio helpers did not load");
        missingAudio.code = "AUDIO_RUNTIME_MISSING";
        throw missingAudio;
      }
      if (!win.StreamRecovery || typeof win.StreamRecovery.createScope !== "function" || typeof win.StreamRecovery.observeRenderer !== "function" || typeof win.StreamRecovery.disposeScene !== "function" || typeof win.StreamRecovery.report !== "function" || typeof win.StreamRecovery.createLoadingManager !== "function") {
        var missingRecovery = new Error("Recovery helpers did not load");
        missingRecovery.code = "RECOVERY_RUNTIME_MISSING";
        throw missingRecovery;
      }
      win.STREAM_ASSET_MODE = mode;
      win.STREAM_ASSET_SOURCES = { localThree: settings.localThree, cdnThree: settings.cdnThree };
      var resolvedMode;
      if (mode === "cdn") {
        await loadScript(settings.cdnThree);
        resolvedMode = "cdn";
      } else if (mode === "offline") {
        await loadScript(settings.localThree);
        resolvedMode = "offline";
      } else {
        try {
          await loadScript(settings.localThree);
          resolvedMode = "offline";
        } catch (error) {
          // Do not start a competing runtime after a timed-out script: a late
          // response could still execute. Require a refresh instead.
          if (error && error.code === "ASSET_TIMEOUT") throw error;
          await loadScript(settings.cdnThree);
          resolvedMode = "cdn";
        }
      }

      win.STREAM_ASSET_RESOLVED_MODE = resolvedMode;
      await loadScript(scenes[pageScene].script);
      if (win.StreamRuntime && typeof win.StreamRuntime.isDisposed === "function" && win.StreamRuntime.isDisposed()) {
        return { status: "failed", scene: pageScene };
      }
      // Do not fetch the optional module or its ESM dependencies when disabled.
      // Keep explicit-false semantics consistent with mountBlackholeOverlay.
      var replacement = configObject(config.brbBlackholeReplacement);
      if (pageScene === "brb" && replacement.enabled !== false && doc.getElementById("blackholeLayer")) {
        var overlay = await importOverlay();
        if (overlay && typeof overlay.mountBlackholeOverlay === "function") {
          await overlay.mountBlackholeOverlay();
        }
      }
      return { status: "ready", scene: pageScene, mode: resolvedMode };
    } catch (error) {
      if (win.console && typeof win.console.error === "function") win.console.error(error);
      showError(pageScene, mode, error);
      return { status: "failed", scene: pageScene };
    }
  }

  function start(pageScene) {
    // A duplicate call must not create another renderer or audio connection.
    if (!pendingBoot) pendingBoot = boot(pageScene);
    return pendingBoot;
  }

  return { start: start };
});
