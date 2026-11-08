// Recovery helpers for OBS browser sources. Scope tracks frames and listeners
// without altering visuals; renderer observer reports fixed diagnostics.
(function (createRecovery) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = createRecovery;
    return;
  }
  window.StreamRecovery = createRecovery(window, document);
})(function createRecovery(window, document) {
  "use strict";

  var win = window || {};
  var doc = document || {};

  var SAFE_MESSAGES = {
    "webgl-unavailable": "WebGL could not be initialized in this browser source. Enable hardware acceleration or try a different browser source.",
    "context-lost": "The 3D graphics context was lost and the scene has paused. Reload the page to rebuild the 3D view.",
    "asset-failed": "Some scene assets could not be loaded. Check network access or local vendor files and reload the page.",
    "boot-failed": "The scene could not start. Reload the page to try again."
  };

  function report(code) {
    var fallback = SAFE_MESSAGES["boot-failed"];
    var message = fallback;
    try {
      if (typeof code === "string" && Object.prototype.hasOwnProperty.call(SAFE_MESSAGES, code)) {
        message = SAFE_MESSAGES[code];
      }
    } catch (error) {
      message = fallback;
    }
    try {
      if (!doc || typeof doc.getElementById !== "function") {
        return;
      }
      var element = doc.getElementById("bootError");
      if (!element) {
        return;
      }
      element.textContent = message;
      element.hidden = false;
    } catch (error) {
      // Ignore diagnostic failures so reporting never breaks playback.
    }
  }

  function createScope() {
    var disposed = false;
    var cleanups = [];
    var listeners = [];
    var pendingFrames = new Set();

    function isDisposed() {
      return disposed;
    }

    function add(cleanup) {
      if (typeof cleanup !== "function") {
        return;
      }
      if (disposed) {
        try {
          cleanup();
        } catch (error) {}
        return;
      }
      cleanups.push(cleanup);
    }

    function listen(target, type, callback, options) {
      function noop() {}
      if (disposed) {
        return noop;
      }
      if (!target || typeof target.addEventListener !== "function") {
        return noop;
      }
      if (typeof type !== "string" || !type) {
        return noop;
      }
      if (typeof callback !== "function") {
        return noop;
      }
      var active = true;
      function guardedListener() {
        if (!disposed && active) {
          try { callback.apply(target, arguments); }
          catch (error) { dispose(); report("boot-failed"); }
        }
      }
      try {
        target.addEventListener(type, guardedListener, options);
      } catch (error) {
        return noop;
      }
      var entry = { target: target, type: type, callback: guardedListener, options: options };
      listeners.push(entry);
      var unsubscribed = false;
      function unsubscribe() {
        if (unsubscribed) {
          return;
        }
        unsubscribed = true;
        active = false;
        try {
          if (entry.target && typeof entry.target.removeEventListener === "function") {
            entry.target.removeEventListener(entry.type, entry.callback, entry.options);
          }
        } catch (error) {}
        var index = listeners.indexOf(entry);
        if (index >= 0) {
          listeners.splice(index, 1);
        }
      }
      return unsubscribe;
    }

    function requestFrame(callback) {
      if (typeof callback !== "function") {
        return null;
      }
      if (disposed) {
        return null;
      }
      if (typeof win.requestAnimationFrame !== "function") {
        return null;
      }
      var id = null;
      var fired = false;
      function wrapper(timestamp) {
        fired = true;
        if (id !== null) {
          pendingFrames.delete(id);
        }
        if (disposed) {
          return;
        }
        try { callback(timestamp); }
        catch (error) { dispose(); report("boot-failed"); }
      }
      try {
        id = win.requestAnimationFrame(wrapper);
      } catch (error) {
        return null;
      }
      if (!fired) {
        pendingFrames.add(id);
      }
      return id;
    }

    function dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      var ids = Array.from(pendingFrames);
      pendingFrames.clear();
      if (typeof win.cancelAnimationFrame === "function") {
        for (var i = 0; i < ids.length; i += 1) {
          try {
            win.cancelAnimationFrame(ids[i]);
          } catch (error) {}
        }
      }
      var currentListeners = listeners.slice();
      listeners.length = 0;
      for (var l = 0; l < currentListeners.length; l += 1) {
        var entry = currentListeners[l];
        try {
          if (entry.target && typeof entry.target.removeEventListener === "function") {
            entry.target.removeEventListener(entry.type, entry.callback, entry.options);
          }
        } catch (error) {}
      }
      var snapshot = cleanups.slice();
      cleanups.length = 0;
      for (var c = snapshot.length - 1; c >= 0; c -= 1) {
        try {
          snapshot[c]();
        } catch (error) {}
      }
    }

    return {
      add: add,
      listen: listen,
      requestFrame: requestFrame,
      isDisposed: isDisposed,
      dispose: dispose
    };
  }

  function observeRenderer(renderer, options) {
    var lost = false;
    var disposed = false;
    var reloaded = false;
    var opts = options && typeof options === "object" ? options : {};
    var onLost = typeof opts.onLost === "function" ? opts.onLost : null;
    var onRestored = typeof opts.onRestored === "function" ? opts.onRestored : null;
    var canvas = null;
    try {
      if (renderer && typeof renderer === "object") {
        canvas = renderer.domElement || renderer.canvas || null;
      }
    } catch (error) {
      canvas = null;
    }

    function handleLost(event) {
      if (disposed) {
        return;
      }
      try {
        if (event && typeof event.preventDefault === "function") {
          event.preventDefault();
        }
      } catch (error) {}
      if (lost) {
        return;
      }
      lost = true;
      report("context-lost");
      if (onLost) {
        try {
          onLost(event);
        } catch (error) {}
      }
    }

    function handleRestored(event) {
      if (disposed) {
        return;
      }
      if (!lost) {
        return;
      }
      lost = false;
      if (onRestored) {
        try {
          onRestored(event);
        } catch (error) {}
      } else if (!reloaded) {
        reloaded = true;
        try {
          if (win.location && typeof win.location.reload === "function") {
            win.location.reload();
          }
        } catch (error) {}
      }
    }

    if (canvas && typeof canvas.addEventListener === "function") {
      try {
        canvas.addEventListener("webglcontextlost", handleLost);
      } catch (error) {}
      try {
        canvas.addEventListener("webglcontextrestored", handleRestored);
      } catch (error) {}
    }

    function dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      if (canvas && typeof canvas.removeEventListener === "function") {
        try {
          canvas.removeEventListener("webglcontextlost", handleLost);
        } catch (error) {}
        try {
          canvas.removeEventListener("webglcontextrestored", handleRestored);
        } catch (error) {}
      }
    }

    return {
      isLost: function () {
        return lost;
      },
      dispose: dispose
    };
  }

  function createLoadingManager(THREE, shouldReport) {
    try {
      if (!THREE || typeof THREE.LoadingManager !== "function") {
        return null;
      }
      var manager = null;
      try {
        manager = new THREE.LoadingManager();
      } catch (error) {
        return null;
      }
      if (!manager || typeof manager !== "object") {
        return null;
      }
      try {
        manager.onError = function () {
          if (typeof shouldReport === "function" && !shouldReport()) return;
          report("asset-failed");
        };
      } catch (error) {}
      return manager;
    } catch (error) {
      return null;
    }
  }

  function disposeScene(scene, renderer, extraResources) {
    var seen = new Set();
    if (Array.isArray(extraResources)) {
      for (var extra = 0; extra < extraResources.length; extra += 1) safeDisposeOnce(extraResources[extra]);
    }

    function safeDisposeOnce(resource) {
      if (!resource || typeof resource !== "object") {
        return;
      }
      if (typeof resource.dispose !== "function") {
        return;
      }
      if (seen.has(resource)) {
        return;
      }
      seen.add(resource);
      try {
        resource.dispose();
      } catch (error) {}
    }

    function isTextureLike(value) {
      return !!value && typeof value === "object" && typeof value.dispose === "function";
    }

    function collectFromUniformContainer(value, depth) {
      if (depth > 2) {
        return;
      }
      if (!value) {
        return;
      }
      if (isTextureLike(value)) {
        safeDisposeOnce(value);
        return;
      }
      if (Array.isArray(value)) {
        for (var i = 0; i < value.length; i += 1) {
          collectFromUniformContainer(value[i], depth + 1);
        }
        return;
      }
      if (typeof value === "object") {
        var proto = null;
        try {
          proto = Object.getPrototypeOf(value);
        } catch (error) {
          proto = null;
        }
        if (proto === Object.prototype || proto === null) {
          var keys = [];
          try {
            keys = Object.keys(value);
          } catch (error) {
            keys = [];
          }
          for (var k = 0; k < keys.length; k += 1) {
            try {
              collectFromUniformContainer(value[keys[k]], depth + 1);
            } catch (error) {}
          }
        }
        // Non-plain objects (vectors, colors, etc.) are ignored.
      }
    }

    function collectMaterialTextures(material) {
      if (!material || typeof material !== "object") {
        return;
      }
      // Direct texture slots: shallow only, no deep arbitrary walk.
      try {
        var keys = Object.keys(material);
        for (var i = 0; i < keys.length; i += 1) {
          var key = keys[i];
          if (key === "uniforms" || key === "dispose" || key === "userData") {
            continue;
          }
          var value = material[key];
          if (value === material) {
            continue;
          }
          if (value && typeof value === "object" && typeof value.dispose === "function") {
            safeDisposeOnce(value);
          } else if (Array.isArray(value)) {
            for (var j = 0; j < value.length; j += 1) {
              var item = value[j];
              if (item && typeof item === "object" && typeof item.dispose === "function") {
                safeDisposeOnce(item);
              }
            }
          }
        }
      } catch (error) {}
      // Shader uniforms: known container with limited depth.
      try {
        var uniforms = material.uniforms;
        if (uniforms && typeof uniforms === "object") {
          var names = Object.keys(uniforms);
          for (var n = 0; n < names.length; n += 1) {
            var entry = uniforms[names[n]];
            if (entry && typeof entry === "object" && "value" in entry) {
              try {
                collectFromUniformContainer(entry.value, 0);
              } catch (error) {}
            }
          }
        }
      } catch (error) {}
    }

    function disposeMaterial(material) {
      if (!material || typeof material !== "object") {
        return;
      }
      try {
        collectMaterialTextures(material);
      } catch (error) {}
      safeDisposeOnce(material);
    }

    function visitNode(node) {
      if (!node || typeof node !== "object") {
        return;
      }
      try {
        if (node.geometry && typeof node.geometry === "object" && typeof node.geometry.dispose === "function") {
          safeDisposeOnce(node.geometry);
        }
      } catch (error) {}
      try {
        if (node.material) {
          if (Array.isArray(node.material)) {
            for (var i = 0; i < node.material.length; i += 1) {
              disposeMaterial(node.material[i]);
            }
          } else {
            disposeMaterial(node.material);
          }
        }
      } catch (error) {}
    }

    function walkChildren(root) {
      var visited = new Set();
      var stack = [root];
      while (stack.length > 0) {
        var current = stack.pop();
        if (!current || typeof current !== "object" || visited.has(current)) {
          continue;
        }
        visited.add(current);
        visitNode(current);
        try {
          var children = current.children;
          if (Array.isArray(children)) {
            for (var i = children.length - 1; i >= 0; i -= 1) {
              stack.push(children[i]);
            }
          }
        } catch (error) {}
      }
    }

    try {
      if (scene && typeof scene === "object") {
        try {
          if (isTextureLike(scene.background)) {
            safeDisposeOnce(scene.background);
          }
        } catch (error) {}
        try {
          if (isTextureLike(scene.environment)) {
            safeDisposeOnce(scene.environment);
          }
        } catch (error) {}
        if (typeof scene.traverse === "function") {
          try {
            scene.traverse(visitNode);
          } catch (error) {
            try {
              walkChildren(scene);
            } catch (walkError) {}
          }
        } else if (Array.isArray(scene.children)) {
          try {
            walkChildren(scene);
          } catch (error) {}
        } else {
          try {
            visitNode(scene);
          } catch (error) {}
        }
      }
    } catch (error) {}

    // Renderer cleanup (never force context loss).
    try {
      if (renderer && typeof renderer === "object") {
        try {
          var lists = renderer.renderLists;
          if (lists && typeof lists === "object" && typeof lists.dispose === "function") {
            try {
              lists.dispose();
            } catch (error) {}
          }
        } catch (error) {}
        try {
          if (typeof renderer.dispose === "function") {
            try {
              renderer.dispose();
            } catch (error) {}
          }
        } catch (error) {}
      }
    } catch (error) {}
  }

  return {
    createScope: createScope,
    observeRenderer: observeRenderer,
    report: report,
    createLoadingManager: createLoadingManager,
    disposeScene: disposeScene
  };
});
