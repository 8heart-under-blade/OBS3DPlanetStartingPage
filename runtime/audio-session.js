// Local-only, memory-only OBS audio setup. Never reads/writes storage or transfers credentials.
(function (createAudioSession) {
  "use strict";
  if (typeof module === "object" && module.exports) { module.exports = createAudioSession; return; }
  window.StreamAudioSession = createAudioSession(window, document);
})(function createAudioSession(win, doc) {
  "use strict";
  function address(value) {
    if (typeof value !== "string" || value.length > 256) throw new Error("Use a loopback WebSocket address without credentials, query or fragment.");
    var url;
    try { url = new URL(value.trim()); } catch (error) { throw new Error("Use a valid loopback WebSocket address."); }
    if (["ws:", "wss:"].indexOf(url.protocol) < 0 || ["localhost", "127.0.0.1", "[::1]"].indexOf(url.hostname.toLowerCase()) < 0 || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
      throw new Error("Use a loopback WebSocket address without credentials, query or fragment.");
    }
    return url.href;
  }
  function bind(original, base, scope) {
    var snapshot = win.STREAM_SNAPSHOT;
    if (!snapshot || ["auto", "setup"].indexOf(snapshot.audioMode) < 0) return original;
    try {
      if ((win.parent && win.parent !== win) || !win.StreamSnapshots.supportsLocalAudio(win.location.href)) return original;
    } catch (error) { return original; }
    var started = false, disposed = false, awaiting = false, dismissed = false, current = original;
    var timer = null, generation = 0, removers = [];
    var panel = doc.createElement("section");
    panel.className = "obs-audio-session"; panel.hidden = true;
    panel.setAttribute("role", "dialog"); panel.setAttribute("aria-labelledby", "obs-audio-heading");
    function element(tag, text, parent) {
      var node = doc.createElement(tag);
      if (text) node.textContent = text;
      (parent || panel).appendChild(node);
      return node;
    }
    function listen(target, type, callback) {
      target.addEventListener(type, callback);
      removers.push(function () { target.removeEventListener(type, callback); });
    }
    var heading = element("h2", "Local OBS audio setup"); heading.id = "obs-audio-heading";
    var note = element("p", "Configure before going live. These details stay only in this page session, not links or presets. Repeat in each OBS source; refreshing clears the password. Ctrl+Alt+A (Command+Option+A on macOS) reopens setup.");
    note.id = "obs-audio-note"; panel.setAttribute("aria-describedby", note.id);
    var form = element("form"); form.noValidate = true; form.autocomplete = "off";
    function field(id, label, type, value, maximum) {
      var labelEl = element("label", label, form); labelEl.htmlFor = id;
      var input = element("input", "", form); input.id = id; input.type = type;
      input.value = value; input.maxLength = maximum; input.autocomplete = "off";
      return input;
    }
    var endpoint = field("obs-audio-address", "OBS WebSocket address (loopback only)", "text", "ws://127.0.0.1:4455", 256);
    var password = field("obs-audio-password", "Password — leave blank if OBS authentication is disabled", "password", "", 512);
    var names = field("obs-audio-inputs", "OBS input names (comma-separated)", "text", "Desktop Audio, Desktop Audio 2", 2048);
    var message = element("p", "Audio has not connected. Authentication is optional; a password is needed only if OBS enables it.", form);
    message.setAttribute("role", "status"); message.setAttribute("aria-live", "polite");
    var actions = element("div", "", form); actions.className = "obs-audio-actions";
    var connect = element("button", "Connect", actions); connect.type = "submit";
    var disable = element("button", "Disable audio", actions); disable.type = "button";
    var close = element("button", "Close setup", actions); close.type = "button";
    function clearTimer() { if (timer !== null) { win.clearTimeout(timer); timer = null; } }
    function reset() {
      generation++; clearTimer(); awaiting = false; connect.disabled = false;
      password.value = "";
      current.stop();
      current = win.StreamAudio.createController(Object.assign({}, base, {enabled: false, password: ""}));
    }
    function open() {
      if (disposed) return;
      dismissed = false; panel.hidden = false; password.focus();
    }
    function hide() { dismissed = true; panel.hidden = true; password.value = ""; }
    function fail(text, prompt) {
      reset(); message.textContent = text;
      if (prompt && !dismissed) open();
    }
    function monitor() {
      if (!awaiting || disposed) return;
      var status = current.getStatus();
      if (status === "identified") {
        awaiting = false; connect.disabled = false; clearTimer(); hide();
        message.textContent = "Audio connected. Re-enter details to replace the connection, or disable audio.";
      } else if (status === "auth-required") {
        fail("OBS requires authentication. Enter its WebSocket password, then Connect. It will stay only in this page session.", true);
      } else if (["error", "closed", "stopped", "disabled"].indexOf(status) >= 0) {
        fail("Audio could not connect. Check the OBS WebSocket server, port and password, then try again.", false);
      }
    }
    function begin(url, secret, inputs) {
      reset(); dismissed = false; awaiting = true; connect.disabled = true;
      current = win.StreamAudio.createController(Object.assign({}, base, {
        enabled: true, provider: "obsWebSocket", url: url, password: secret, targetInputs: inputs,
        meterOnly: true, requireSessionAuth: true
      }));
      message.textContent = "Connecting to local OBS…";
      var serial = generation;
      if (started) current.start();
      timer = win.setTimeout(function () {
        if (disposed || serial !== generation) return;
        timer = null;
        monitor();
        if (awaiting) fail("Audio connection timed out. Check the OBS WebSocket server and port, then try again.", false);
      }, 10000);
    }
    listen(form, "submit", function (event) {
      event.preventDefault();
      var secret = password.value; password.value = "";
      if (disposed || !started) return;
      try {
        var url = address(endpoint.value);
        if (typeof secret !== "string" || secret.length > 512) throw new Error("The password is too long.");
        if (typeof names.value !== "string" || names.value.length > 2048) throw new Error("Use up to 64 input names, at most 128 characters each.");
        var inputs = names.value.split(",").map(function (name) { return name.trim(); }).filter(Boolean);
        if (inputs.length > 64 || inputs.some(function (name) { return name.length > 128; })) throw new Error("Use up to 64 input names, at most 128 characters each.");
        begin(url, secret, inputs);
      } catch (error) {
        // Do not render exception messages or any raw connection details.
        message.textContent = "Check the loopback address (no URL credentials/query/fragment), password length and input names.";
      }
    });
    listen(disable, "click", function () { reset(); message.textContent = "Audio disabled. Session credentials cleared."; });
    listen(close, "click", hide);
    listen(win, "keydown", function (event) {
      if ((event.ctrlKey || event.metaKey) && event.altKey && String(event.key).toLowerCase() === "a" && !event.repeat) {
        event.preventDefault(); open();
      } else if (event.key === "Escape" && !panel.hidden) { event.preventDefault(); hide(); }
    });
    doc.body.appendChild(panel);
    if (snapshot.audioMode === "setup") open();
    var firstStart = true;
    var proxy = {
      start: function () {
        if (disposed || started) return;
        started = true;
        if (firstStart && snapshot.audioMode === "auto") {
          firstStart = false;
          begin("ws://127.0.0.1:4455", "", ["Desktop Audio", "Desktop Audio 2"]);
        } else { firstStart = false; current.start(); }
      },
      stop: function () { if (disposed) return; started = false; reset(); },
      update: function (delta) { monitor(); return current.update(delta); },
      getFeatures: function () { return current.getFeatures(); },
      getStatus: function () { return current.getStatus(); }
    };
    scope.add(function () {
      if (disposed) return;
      started = false; reset(); disposed = true;
      removers.forEach(function (remove) { remove(); }); removers.length = 0;
      if (panel.parentNode) panel.parentNode.removeChild(panel);
    });
    return proxy;
  }
  return {bind: bind};
});
