// Autosaved editor draft wrapper. Storage is untrusted; snapshots validates.
(function (createDrafts) {
  "use strict";
  if (typeof module === "object" && module.exports) { module.exports = createDrafts; return; }
  var storage = null;
  try {
    if (typeof window !== "undefined") storage = window.localStorage;
  } catch (error) {
    storage = null;
  }
  if (typeof window !== "undefined") {
    window.StreamDrafts = createDrafts(storage, window.StreamSnapshots);
  }
})(function createDrafts(storage, snapshots) {
  "use strict";

  var KEY = "obs3dplanet.editor.draft.v1";
  var STORAGE_UNAVAILABLE = "storage-unavailable";
  var DRAFT_INVALID = "draft-invalid";
  var STORAGE_QUOTA = "storage-quota-exceeded";

  function hasMethod(object, name) {
    try {
      return !!object && typeof object[name] === "function";
    } catch (error) {
      return false;
    }
  }

  function unavailable() {
    return { snapshot: null, warning: STORAGE_UNAVAILABLE };
  }

  function invalid() {
    return { snapshot: null, warning: DRAFT_INVALID };
  }

  function getItem() {
    if (!hasMethod(storage, "getItem")) return { ok: false, blocked: true };
    try {
      return { ok: true, value: storage.getItem(KEY) };
    } catch (error) {
      return { ok: false, blocked: true };
    }
  }

  function setItem(value) {
    if (!hasMethod(storage, "setItem")) return { ok: false, blocked: true, quota: false };
    try {
      storage.setItem(KEY, value);
      return { ok: true };
    } catch (error) {
      return { ok: false, blocked: false, quota: true };
    }
  }

  function removeItem() {
    if (!hasMethod(storage, "removeItem")) return { ok: false, blocked: true };
    try {
      storage.removeItem(KEY);
      return { ok: true };
    } catch (error) {
      return { ok: false, blocked: true };
    }
  }

  function parseDraft(raw) {
    if (typeof snapshots !== "object" || snapshots === null || typeof snapshots.parse !== "function") {
      throw new Error("snapshots unavailable");
    }
    return snapshots.parse(raw);
  }

  function stringifyDraft(value) {
    if (typeof snapshots !== "object" || snapshots === null || typeof snapshots.stringify !== "function") {
      throw new Error("snapshots unavailable");
    }
    return snapshots.stringify(value);
  }

  function load() {
    var read = getItem();
    if (!read.ok) return unavailable();
    if (read.value === null || read.value === undefined) {
      return { snapshot: null, warning: "" };
    }
    var raw = read.value;
    if (typeof raw !== "string") {
      try { raw = String(raw); } catch (error) { return invalid(); }
    }
    try {
      var snapshot = parseDraft(raw);
      return { snapshot: snapshot, warning: "" };
    } catch (error) {
      return invalid();
    }
  }

  function save(value) {
    var canonical;
    try {
      canonical = stringifyDraft(value);
    } catch (error) {
      return { ok: false, warning: DRAFT_INVALID };
    }
    var written = setItem(canonical);
    if (!written.ok) {
      if (written.blocked) return { ok: false, warning: STORAGE_UNAVAILABLE };
      return { ok: false, warning: STORAGE_QUOTA };
    }
    return { ok: true, warning: "" };
  }

  function clear() {
    var removed = removeItem();
    if (!removed.ok) return { ok: false, warning: STORAGE_UNAVAILABLE };
    return { ok: true, warning: "" };
  }

  return { load: load, save: save, clear: clear };
});