// Shared OBS WebSocket audio controller. Existing protocol and meter math retained.
// CommonJS exports the environment factory for tests; browsers install StreamAudio.
(function (createAudioRuntime) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = createAudioRuntime;
    return;
  }
  window.StreamAudio = createAudioRuntime(window);
})(function createAudioRuntime(window) {
  "use strict";
  var console = window.console;
  function setTimeout(callback, delay) { return window.setTimeout(callback, delay); }
  function clearTimeout(timer) { window.clearTimeout(timer); }

  function createAudioReactiveController(config) {
    var settings = config || {};
    var enabled = settings.enabled !== false && settings.provider === "obsWebSocket";
    var supportsWebSocket = typeof window.WebSocket === "function";
    var targetInputs = normalizeInputFilters(settings.targetInputs);

    var state = {
      active: false,
      runId: 0,
      socketId: 0,
      currentSocketId: 0,
      currentRunId: 0,
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
        getStatus: function () { return "disabled"; },
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

    function resetMeterState() {
      state.rawLevel = 0;
      state.rawRms = 0;
      state.rawPeak = 0;
      state.rawTransient = 0;
      state.rawBalance = 0;
      state.smoothedLevel = 0;
      state.smoothedRms = 0;
      state.smoothedPeak = 0;
      state.smoothedTransient = 0;
      state.smoothedBalance = 0;
      state.featureSnapshot.level = 0;
      state.featureSnapshot.rms = 0;
      state.featureSnapshot.peak = 0;
      state.featureSnapshot.transient = 0;
      state.featureSnapshot.balance = 0;
    }

    function isCurrentSocket(socket, socketId, runId) {
      return !!state.active && !state.stopping &&
        state.ws === socket &&
        state.currentSocketId === socketId &&
        state.currentRunId === runId;
    }

    function start() {
      if (state.active) {
        return;
      }

      if (state.reconnectHandle) {
        clearTimeout(state.reconnectHandle);
        state.reconnectHandle = 0;
      }

      if (state.ws) {
        var orphan = state.ws;
        state.ws = null;
        state.currentSocketId = 0;
        orphan.onopen = null;
        orphan.onmessage = null;
        orphan.onerror = null;
        orphan.onclose = null;
        try {
          orphan.close();
        } catch (error) {
          console.warn("Audio websocket close warning.");
        }
      }

      state.active = true;
      state.stopping = false;
      state.runId += 1;
      state.currentRunId = state.runId;
      state.currentSocketId = 0;
      state.reconnectAttempt = 0;
      state.warnedNoTargetMatch = false;
      state.status = "idle";
      resetMeterState();
      connect(state.currentRunId);
    }

    function stop() {
      state.active = false;
      state.stopping = true;
      state.currentRunId = 0;

      if (state.reconnectHandle) {
        clearTimeout(state.reconnectHandle);
        state.reconnectHandle = 0;
      }

      var ws = state.ws;
      if (ws) {
        state.ws = null;
        state.currentSocketId = 0;
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        try {
          ws.close();
        } catch (error) {
          console.warn("Audio websocket close warning.");
        }
      }

      state.reconnectAttempt = 0;
      resetMeterState();
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

    function connect(run) {
      if (!state.active || state.stopping) {
        return;
      }
      if (run != null && run !== state.currentRunId) {
        return;
      }
      if (state.ws) {
        return;
      }

      var currentRun = state.currentRunId;
      var ws;
      try {
        ws = new window.WebSocket(wsUrl, "obswebsocket.json");
      } catch (error) {
        console.warn("Audio websocket open failed.");
        scheduleReconnect(currentRun);
        return;
      }

      state.socketId += 1;
      var currentSocketId = state.socketId;
      state.ws = ws;
      state.currentSocketId = currentSocketId;
      state.status = "connecting";

      ws.onopen = function () {
        if (!isCurrentSocket(ws, currentSocketId, currentRun)) {
          return;
        }
        state.status = "socket-open";
      };

      ws.onmessage = function (event) {
        if (!isCurrentSocket(ws, currentSocketId, currentRun)) {
          return;
        }
        handleSocketMessage(event && event.data, ws, currentSocketId, currentRun);
      };

      ws.onerror = function () {
        if (!isCurrentSocket(ws, currentSocketId, currentRun)) {
          return;
        }
        state.status = "error";
      };

      ws.onclose = function () {
        var wasCurrent = isCurrentSocket(ws, currentSocketId, currentRun);
        if (state.ws === ws) {
          state.ws = null;
          state.currentSocketId = 0;
        }
        if (!wasCurrent) {
          return;
        }
        if (!state.stopping && state.active) {
          state.status = "closed";
          scheduleReconnect(currentRun);
        }
      };
    }

    function scheduleReconnect(run) {
      if (!state.active || state.stopping) {
        return;
      }
      if (run != null && run !== state.currentRunId) {
        return;
      }
      if (state.reconnectHandle) {
        return;
      }

      var currentRun = run != null ? run : state.currentRunId;
      var delay = Math.min(reconnectMaxMs, reconnectBaseMs * Math.pow(1.55, state.reconnectAttempt));
      state.reconnectAttempt += 1;
      var handle = setTimeout(function () {
        if (!state.active || state.stopping || currentRun !== state.currentRunId || state.reconnectHandle !== handle) {
          return;
        }
        state.reconnectHandle = 0;
        connect(currentRun);
      }, delay);
      state.reconnectHandle = handle;
    }

    function handleSocketMessage(rawData, socket, socketId, runId) {
      if (!isCurrentSocket(socket, socketId, runId)) {
        return;
      }

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
        handleHello(data, socket, socketId, runId);
        return;
      }

      if (!isCurrentSocket(socket, socketId, runId)) {
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

    function handleHello(helloData, socket, socketId, runId) {
      if (!isCurrentSocket(socket, socketId, runId)) {
        return;
      }
      if (!helloData || typeof helloData !== "object") {
        return;
      }

      var rpcVersion = typeof helloData.rpcVersion === "number" && isFinite(helloData.rpcVersion)
        ? Math.max(1, Math.floor(helloData.rpcVersion))
        : 1;

      var identify = {
        rpcVersion: rpcVersion,
        eventSubscriptions: settings.meterOnly === true ? (1 << 16) : 2047 | (1 << 16)
      };

      var authData = helloData.authentication;
      if (!authData || typeof authData !== "object") {
        sendSocketMessage({ op: 1, d: identify }, socket, socketId, runId);
        return;
      }

      if (settings.requireSessionAuth === true && !wsPassword) {
        state.status = "auth-required";
        return;
      }
      createObsWebSocketAuth(wsPassword, authData.salt, authData.challenge)
        .then(function (authString) {
          if (!isCurrentSocket(socket, socketId, runId)) {
            return;
          }
          identify.authentication = authString;
          sendSocketMessage({ op: 1, d: identify }, socket, socketId, runId);
        })
        .catch(function (error) {
          if (!isCurrentSocket(socket, socketId, runId)) {
            return;
          }
          console.warn("Audio websocket authentication failed.");
          if (state.ws === socket) {
            try {
              socket.close();
            } catch (closeError) {
              console.warn("Audio websocket close warning.");
            }
          }
        });
    }

    function sendSocketMessage(payload, socket, socketId, runId) {
      if (!isCurrentSocket(socket, socketId, runId)) {
        return;
      }
      if (!socket || socket.readyState !== 1) {
        return;
      }
      try {
        socket.send(JSON.stringify(payload));
      } catch (error) {
        console.warn("Audio websocket send failed.");
        if (isCurrentSocket(socket, socketId, runId)) {
          try { socket.close(); } catch (closeError) { console.warn("Audio websocket close warning."); }
        }
      }
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
      getStatus: function () { return state.status; },
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

  function ensureArray(value) {
    if (Array.isArray(value)) {
      return value.slice();
    }
    if (value === undefined || value === null || value === "") {
      return [];
    }
    return [value];
  }

  return { createController: createAudioReactiveController };
});
