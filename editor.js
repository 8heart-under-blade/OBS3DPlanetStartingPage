// P2 editor controller. State is always the nonsecret snapshot schema, never config.js.
(function (createEditor) {
  "use strict";
  if (typeof module === "object" && module.exports) { module.exports = createEditor; return; }
  try {
    window.StreamEditor = createEditor(window, document, window.StreamSnapshots, window.StreamDrafts);
    window.StreamEditor.start();
  } catch (error) {
    var notice = document.getElementById("editor-error");
    if (notice) { notice.textContent = "The editor could not start. Check the editor and runtime files, then refresh."; notice.hidden = false; }
  }
})(function createEditor(win, doc, snapshots, drafts) {
  "use strict";
  if (!snapshots || !drafts) throw new Error("Editor helpers are unavailable.");
  var sceneNames = ["starting", "brb", "thanks"];
  var controls = {};
  var ids = ["editor-form", "scene-select", "title-input", "subtitle-input", "title-font", "subtitle-font", "top-input", "title-spacing", "subtitle-spacing", "quality-select", "reduced-motion", "audio-mode", "preset-select", "preset-apply", "reset-button", "export-button", "import-input", "clear-draft-button", "editor-status", "editor-error", "preview-stage", "scene-preview", "preview-open", "warning-list"];
  ids.concat(sceneNames.flatMap(function (scene) { return ["link-" + scene, "copy-" + scene]; })).forEach(function (id) {
    controls[id] = doc.getElementById(id);
    if (!controls[id]) throw new Error("Editor controls are incomplete.");
  });
  var snapshot = null, currentScene = "starting", timer = null, started = false, stopped = false;
  var formValid = true, linksValid = false, revision = 0, importSerial = 0, previewSerial = 0;
  var storageWarning = "", observer = null, previewUrl = "";
  var localAudioAvailable = snapshots.supportsLocalAudio(win.location.href);
  var listeners = [], objectUrls = new Set(), revokeTimers = new Set();

  function listen(target, type, callback) {
    target.addEventListener(type, callback);
    listeners.push(function () { target.removeEventListener(type, callback); });
  }
  function status(message) { controls["editor-status"].textContent = message; }
  function error(message) { controls["editor-error"].textContent = message; controls["editor-error"].hidden = false; }
  function clearError() { controls["editor-error"].hidden = true; controls["editor-error"].textContent = ""; }
  function warnings() {
    var list = controls["warning-list"];
    list.textContent = "";
    if (!localAudioAvailable) {
      var localNote = doc.createElement("li");
      localNote.textContent = "Session audio setup is available only from a trusted localhost/loopback copy. It is disabled on this site.";
      list.appendChild(localNote);
    }
    if (storageWarning) {
      var messages = {
        "storage-unavailable": "Draft storage is unavailable. Copy your links or export a preset backup.",
        "storage-quota-exceeded": "Draft storage is full or blocked. Export a preset backup.",
        "draft-invalid": "The saved draft was invalid. Defaults were loaded; import a valid preset or reset it."
      };
      var item = doc.createElement("li");
      item.textContent = Object.prototype.hasOwnProperty.call(messages, storageWarning) ? messages[storageWarning] : "Draft storage needs attention. Export a preset backup.";
      list.appendChild(item);
    }
  }
  function disableLinks() {
    linksValid = false;
    sceneNames.forEach(function (scene) { controls["link-" + scene].value = ""; controls["copy-" + scene].disabled = true; });
    controls["preview-open"].removeAttribute("href");
    controls["preview-open"].setAttribute("aria-disabled", "true");
  }
  function invalidForm(message) {
    formValid = false; previewSerial++; disableLinks(); controls["export-button"].disabled = true; error(message);
    status("Preview shows the last valid settings. Correct the settings to regenerate links.");
  }
  function prefersReducedMotion() {
    try { return !!win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches; }
    catch (error) { return false; }
  }
  function fresh() { var value = snapshots.defaults(); value.reducedMotion = prefersReducedMotion(); value.audioMode = "auto"; return value; }
  function number(id) {
    var value = controls[id].value;
    if (typeof value !== "string" || !value.trim()) throw new Error("Enter numbers for position and spacing.");
    return Number(value);
  }
  function collect() {
    var candidate = snapshots.validate(snapshot);
    candidate.quality = controls["quality-select"].value;
    candidate.reducedMotion = controls["reduced-motion"].checked;
    candidate.audioMode = controls["audio-mode"].value;
    candidate.scenes[currentScene] = {
      title: controls["title-input"].value, subtitle: controls["subtitle-input"].value,
      titleFont: controls["title-font"].value, subtitleFont: controls["subtitle-font"].value,
      topVh: number("top-input"), titleSpacing: number("title-spacing"), subtitleSpacing: number("subtitle-spacing")
    };
    return snapshots.validate(candidate);
  }
  function sync() {
    var scene = snapshot.scenes[currentScene];
    controls["scene-select"].value = currentScene;
    controls["title-input"].value = scene.title; controls["subtitle-input"].value = scene.subtitle;
    controls["title-font"].value = scene.titleFont; controls["subtitle-font"].value = scene.subtitleFont;
    controls["top-input"].value = String(scene.topVh);
    controls["title-spacing"].value = String(scene.titleSpacing);
    controls["subtitle-spacing"].value = String(scene.subtitleSpacing);
    controls["quality-select"].value = snapshot.quality;
    controls["reduced-motion"].checked = snapshot.reducedMotion;
    controls["audio-mode"].value = snapshot.audioMode;
    formValid = true; controls["export-button"].disabled = false;
  }
  function save() {
    var result = drafts.save(snapshot);
    storageWarning = result.warning || "";
    warnings();
  }
  function scalePreview() {
    if (stopped) return;
    var stage = controls["preview-stage"], width = stage.clientWidth;
    if (!width && stage.getBoundingClientRect) width = stage.getBoundingClientRect().width;
    if (width > 0) controls["scene-preview"].style.transform = "scale(" + (width / 1920) + ")";
  }
  function render() {
    var urls = {};
    try { sceneNames.forEach(function (scene) { urls[scene] = snapshots.toUrl(snapshot, scene, win.location.href); }); }
    catch (failure) {
      disableLinks(); error("Links could not be created here. Use an HTTP/HTTPS site with a shorter URL, or export the preset and re-import it there.");
      controls["export-button"].disabled = false;
      return;
    }
    sceneNames.forEach(function (scene) { controls["link-" + scene].value = urls[scene]; controls["copy-" + scene].disabled = false; });
    controls["preview-open"].href = urls[currentScene];
    controls["preview-open"].removeAttribute("aria-disabled");
    controls["scene-preview"].title = "Live " + currentScene + " scene preview";
    previewSerial++;
    previewUrl = urls[currentScene];
    controls["scene-preview"].src = previewUrl;
    linksValid = true; controls["export-button"].disabled = false;
    status(storageWarning ? "Links are ready. Draft storage needs attention; you can export a backup." : "Links are ready. Preview updating; copied OBS links remain independent snapshots.");
    scalePreview();
  }
  function cancelPending() { if (timer !== null) { win.clearTimeout(timer); timer = null; } }
  function commit() {
    cancelPending();
    if (stopped) return false;
    var candidate;
    try { candidate = collect(); }
    catch (failure) { invalidForm(failure.message); return false; }
    var changed = snapshots.stringify(candidate) !== snapshots.stringify(snapshot);
    snapshot = candidate; formValid = true; clearError(); controls["export-button"].disabled = false;
    if (changed) { revision++; save(); }
    if (changed || !linksValid) render();
    return true;
  }
  function update() {
    revision++; // Cancel an in-flight import as soon as a user starts editing.
    cancelPending();
    timer = win.setTimeout(function () { timer = null; commit(); }, 350);
  }
  function replace(value) {
    cancelPending(); snapshot = snapshots.validate(value);
    revision++; formValid = true;
    clearError(); sync(); save(); render();
  }
  function copy(scene) {
    if (!commit() || !linksValid) return;
    var field = controls["link-" + scene], value = field.value;
    function fallback() { if (stopped) return; field.focus(); field.select(); status("Link selected. Use your browser's Copy command to copy it manually."); }
    try {
      if (!win.navigator || !win.navigator.clipboard || typeof win.navigator.clipboard.writeText !== "function") { fallback(); return; }
      Promise.resolve(win.navigator.clipboard.writeText(value)).then(function () {
        if (!stopped) status("Copied the " + scene + " snapshot link. Paste it into its OBS Browser Source.");
      }).catch(fallback);
    } catch (failure) { fallback(); }
  }
  function exportPreset() {
    if (!commit() || !formValid) return;
    try {
      var blob = new win.Blob([snapshots.stringify(snapshot)], {type: "application/json"});
      var url = win.URL.createObjectURL(blob), anchor = doc.createElement("a");
      objectUrls.add(url); anchor.href = url; anchor.download = "obs3dplanet-preset-v1.json";
      doc.body.appendChild(anchor); anchor.click(); doc.body.removeChild(anchor);
      var revoke = win.setTimeout(function () { revokeTimers.delete(revoke); objectUrls.delete(url); win.URL.revokeObjectURL(url); }, 1000);
      revokeTimers.add(revoke); status("Preset exported. Keep the JSON file as a nonsecret backup.");
    } catch (failure) {
      if (anchor && anchor.parentNode) anchor.parentNode.removeChild(anchor);
      if (url) { objectUrls.delete(url); try { win.URL.revokeObjectURL(url); } catch (ignored) {} }
      error("Preset export is unavailable in this browser. You can still copy the OBS links.");
    }
  }
  async function importPreset() {
    var file = controls["import-input"].files && controls["import-input"].files[0];
    if (!file) return;
    var serial = ++importSerial, originalRevision = revision;
    try {
      if (file.size > snapshots.MAX_BYTES) throw new Error("Oversize preset.");
      var value = snapshots.parse(await file.text());
      if (stopped || serial !== importSerial) return;
      if (revision !== originalRevision) { status("Import cancelled because settings changed. Choose the file again to replace them."); return; }
      replace(value); status("Preset imported and links updated. Copy new links to update OBS.");
    } catch (failure) {
      if (!stopped && serial === importSerial) error("Import rejected. Use a supported preset JSON file under 8 KiB; current settings were not changed.");
    } finally { if (serial === importSerial) controls["import-input"].value = ""; }
  }
  function applyPreset() {
    var kind = controls["preset-select"].value;
    if (["original", "minimal", "quiet"].indexOf(kind) < 0) return;
    if (win.confirm && !win.confirm("Replace settings for all three scenes with this preset?")) return;
    var value = fresh();
    if (kind === "minimal") sceneNames.forEach(function (scene) { value.scenes[scene].subtitle = ""; value.scenes[scene].titleFont = "system"; value.scenes[scene].titleSpacing = 0.04; });
    if (kind === "quiet") { value.reducedMotion = true; value.quality = "low"; }
    replace(value);
  }
  function onBeforeUnload() {
    if (timer !== null) {
      cancelPending();
      try { snapshot = collect(); drafts.save(snapshot); } catch (failure) {}
    }
    dispose();
  }
  function start() {
    if (started || stopped) return;
    started = true;
    var loaded = drafts.load();
    try { snapshot = loaded.snapshot ? snapshots.validate(loaded.snapshot) : fresh(); }
    catch (failure) { snapshot = fresh(); }
    storageWarning = loaded.warning || "";
    sync(); warnings();
    listen(controls["editor-form"], "submit", function (event) { event.preventDefault(); commit(); });
    listen(controls["editor-form"], "input", function (event) { if (event.target !== controls["scene-select"] && event.target !== controls["import-input"]) update(); });
    listen(controls["editor-form"], "change", function (event) {
      if (event.target !== controls["scene-select"] && event.target !== controls["import-input"] && event.target !== controls["preset-select"]) commit();
    });
    listen(controls["scene-select"], "change", function () {
      var next = controls["scene-select"].value;
      if (sceneNames.indexOf(next) < 0 || !commit()) { controls["scene-select"].value = currentScene; return; }
      currentScene = next; sync(); clearError(); render();
    });
    listen(controls["preset-apply"], "click", applyPreset);
    listen(controls["reset-button"], "click", function () { var value = snapshots.validate(snapshot); value.scenes[currentScene] = snapshots.defaults().scenes[currentScene]; replace(value); });
    listen(controls["clear-draft-button"], "click", function () {
      cancelPending();
      try {
        var candidate = collect(), changed = snapshots.stringify(candidate) !== snapshots.stringify(snapshot);
        snapshot = candidate; revision++; formValid = true; clearError();
        if (changed || !linksValid) render();
      } catch (failure) { invalidForm(failure.message); }
      var result = drafts.clear();
      storageWarning = result.warning || ""; warnings();
      status(result.ok ? "Saved draft cleared. Current settings remain; editing will save again." : "Saved draft could not be cleared in this browser.");
    });
    listen(controls["export-button"], "click", exportPreset);
    listen(controls["import-input"], "change", importPreset);
    sceneNames.forEach(function (scene) { listen(controls["copy-" + scene], "click", function () { copy(scene); }); });
    listen(controls["scene-preview"], "load", function () {
      if (stopped || !formValid || !linksValid) return;
      var serial = previewSerial, expectedUrl = previewUrl, expectedScene = currentScene;
      var expectedPreset = snapshots.stringify(snapshot);
      try {
        var child = controls["scene-preview"].contentWindow;
        if (child && child.location && child.location.href !== expectedUrl) return;
        if (child && child.STREAM_SNAPSHOT && snapshots.stringify(child.STREAM_SNAPSHOT) !== expectedPreset) return;
        var api = child && child.StreamBoot;
        if (!api || !api.ready) { status("Preview document loaded. Check its appearance before using the OBS links."); return; }
        Promise.resolve(api.ready).then(function (result) {
          if (stopped || !formValid || !linksValid || serial !== previewSerial || previewUrl !== expectedUrl) return;
          if (result.scene && result.scene !== expectedScene) return;
          if (child.location && child.location.href !== expectedUrl) return;
          if (child.STREAM_SNAPSHOT && snapshots.stringify(child.STREAM_SNAPSHOT) !== expectedPreset) return;
          status(result.status === "ready" ? "Preview started. Check visuals, then copy the three snapshot links." : "Preview reported a problem. Check the message inside the scene.");
        }).catch(function () { if (!stopped && serial === previewSerial) status("Preview could not start. Check its scene message."); });
      } catch (failure) { status("Preview status is unavailable. Open the preview link to inspect the scene."); }
    });
    listen(win, "resize", scalePreview); listen(win, "beforeunload", onBeforeUnload);
    if (typeof win.ResizeObserver === "function") { observer = new win.ResizeObserver(scalePreview); observer.observe(controls["preview-stage"]); }
    render();
  }
  function dispose() {
    if (stopped) return;
    stopped = true; importSerial++; previewSerial++; cancelPending();
    listeners.forEach(function (remove) { remove(); }); listeners.length = 0;
    if (observer) observer.disconnect();
    revokeTimers.forEach(function (id) { win.clearTimeout(id); }); revokeTimers.clear();
    objectUrls.forEach(function (url) { win.URL.revokeObjectURL(url); }); objectUrls.clear();
    controls["scene-preview"].src = "about:blank";
  }
  return {start: start, dispose: dispose, getSnapshot: function () { return snapshots.validate(snapshot); }};
});
