// Boot routing tests for the runtime/boot.js createBoot factory.
// Dependency-free: node:test + node:assert/strict + node:module only.
// Covers URL compatibility only (HTML is intentionally not exercised here).
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const createBoot = require("../runtime/boot.js");

const SCENE_ORDER = ["starting", "brb", "thanks"];
const SCENE_ALIAS_GROUPS = [
  ["starting", ["start", "soon"]],
  ["brb", ["be-right-back", "berightback"]],
  ["thanks", ["thankyou", "thank-you", "thanks-for-watching", "ty4w", "ending", "end"]],
];
const SCENE_PAGE = { starting: "index.html", brb: "brb.html", thanks: "thanks.html" };
const BOOT_PATHNAME = { starting: "/", brb: "/brb.html", thanks: "/thanks.html" };
const LOCAL_THREE = "vendor/three.min.js";
const CDN_THREE = "https://unpkg.com/three@0.160.1/build/three.min.js";

function makeConfig() {
  return {
    assets: { mode: "auto", localThree: LOCAL_THREE, cdnThree: CDN_THREE },
    overlay: { title: "STREAM STARTING SOON" },
    brbBlackholeReplacement: { enabled: true },
  };
}

function makeLocation({ pathname = "/", search = "", hash = "" } = {}) {
  const location = {
    pathname,
    search,
    hash,
    replaced: null,
    replace(url) { this.replaced = url; },
  };
  return location;
}

function makeDoc({ bootError = null, blackholeLayer = null } = {}) {
  const queue = [];
  const scripts = [];
  const doc = {
    __queue: queue,
    __scripts: scripts,
    head: { appendChild(script) { queue.push(script); return script; } },
    createElement() {
      const script = { src: "", async: true, onload: null, onerror: null };
      scripts.push(script);
      return script;
    },
    getElementById(id) {
      if (id === "bootError") return bootError;
      if (id === "blackholeLayer") return blackholeLayer;
      return null;
    },
  };
  return doc;
}

function makeWin({ location, config, overlay } = {}) {
  const errors = [];
  const win = {
    location,
    STREAM_CONFIG: config,
    StreamOverlay: { applyTypography() {}, startClock() {} },
    StreamAudio: { createController() {} },
    StreamSettings: { resolve: config => ({config, quality: 'tuned', warnings: []}), applyQuality() {}, limit(_kind, value) { return value; } },
    StreamRecovery: { createScope() {}, observeRenderer() {}, disposeScene() {}, report() {}, createLoadingManager() {} },
    STREAM_OVERLAY: overlay,
    console: { error: (...args) => errors.push(args) },
  };
  return { win, errors };
}

async function settle(doc, { fail = false } = {}) {
  while (doc.__queue.length > 0) {
    const script = doc.__queue.shift();
    if (fail) script.onerror(new Error("Failed to load script: " + script.src));
    else script.onload();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

async function runBoot({
  pageScene,
  pathname = "/",
  search = "",
  hash = "",
  config,
  overlay,
  bootError = null,
  blackholeLayer = null,
  failScripts = false,
} = {}) {
  const resolvedConfig = config || makeConfig();
  const location = makeLocation({ pathname, search, hash });
  const doc = makeDoc({ bootError, blackholeLayer });
  const { win, errors } = makeWin({ location, config: resolvedConfig, overlay });
  const overlayCalls = [];
  const importer = async () => {
    overlayCalls.push(true);
    return { mountBlackholeOverlay: async () => {} };
  };
  const bootApi = createBoot(win, doc, importer);
  const pending = bootApi.start(pageScene);
  const cached = bootApi.start(pageScene);
  assert.equal(cached, pending, "start(pageScene) must return a cached promise");
  await settle(doc, { fail: failScripts });
  const result = await pending;
  return { result, win, doc, errors, location, overlayCalls, config: resolvedConfig, overlay };
}

test("start(pageScene) returns a cached promise that settles with a boot outcome", async () => {
  const { result, win, location } = await runBoot({ pageScene: "starting" });
  assert.equal(result.status, "ready");
  assert.equal(result.scene, "starting");
  assert.equal(location.replaced, null);
  assert.equal(win.STREAM_ASSET_MODE, "auto");
});

test("each entrypoint boots its own scene script and resolves ready", async () => {
  const starting = await runBoot({ pageScene: "starting" });
  assert.equal(starting.result.status, "ready");
  assert.equal(starting.result.scene, "starting");
  assert.deepEqual(starting.doc.__scripts.map((s) => s.src), [LOCAL_THREE, "main.js"]);

  const brb = await runBoot({ pageScene: "brb", blackholeLayer: { hidden: true } });
  assert.equal(brb.result.status, "ready");
  assert.equal(brb.result.scene, "brb");
  assert.deepEqual(brb.doc.__scripts.map((s) => s.src), [LOCAL_THREE, "brb.js"]);
  assert.equal(brb.overlayCalls.length, 1);

  const thanks = await runBoot({ pageScene: "thanks" });
  assert.equal(thanks.result.status, "ready");
  assert.equal(thanks.result.scene, "thanks");
  assert.deepEqual(thanks.doc.__scripts.map((s) => s.src), [LOCAL_THREE, "thanks.js"]);
  assert.equal(thanks.overlayCalls.length, 0);
});

test("cdn asset mode loads the CDN three.js before the scene script", async () => {
  const { result, doc } = await runBoot({ pageScene: "starting", search: "?assets=cdn" });
  assert.equal(result.status, "ready");
  assert.equal(result.scene, "starting");
  assert.equal(result.mode, "cdn");
  assert.deepEqual(doc.__scripts.map((s) => s.src), [CDN_THREE, "main.js"]);
});

test("failed boots report the scene and surface console error plus boot error element", async () => {
  const offline = await runBoot({ pageScene: "starting", search: "?assets=offline", failScripts: true, bootError: { textContent: "", hidden: true } });
  assert.equal(offline.result.status, "failed");
  assert.equal(offline.result.scene, "starting");
  assert.equal(offline.errors.length, 1);
  const element = offline.doc.getElementById("bootError");
  assert.equal(element.hidden, false);
  assert.equal(element.textContent, "Offline mode selected, but local assets could not be loaded. Keep the vendor folder next to index.html, or switch to ?assets=auto.");

  const unknown = await runBoot({ pageScene: "bogus" });
  assert.equal(unknown.result.status, "failed");
  assert.equal(unknown.result.scene, "bogus");
});

test("redirects canonicalize the scene alias, preserve params and hash, and precede asset scripts", async () => {
  const cases = [
    { pageScene: "starting", pathname: "/", search: "?scene=be-right-back&assets=cdn&foo=bar", hash: "#ep", scene: "brb", replaced: "brb.html?scene=brb&assets=cdn&foo=bar#ep" },
    { pageScene: "thanks", pathname: "/thanks.html", search: "?scene=start&assets=offline", scene: "starting", replaced: "index.html?scene=starting&assets=offline" },
    { pageScene: "brb", pathname: "/brb.html", search: "?scene=ty4w", scene: "thanks", replaced: "thanks.html?scene=thanks" },
  ];
  for (const c of cases) {
    const run = await runBoot({ pageScene: c.pageScene, pathname: c.pathname, search: c.search, hash: c.hash });
    assert.equal(run.result.status, "redirected", c.pageScene + c.search);
    assert.equal(run.result.scene, c.scene);
    assert.equal(run.location.replaced, c.replaced);
    // Redirect must not queue asset scripts or publish asset globals first.
    assert.equal(run.doc.__queue.length, 0);
    assert.equal(run.win.STREAM_ASSET_MODE, undefined);
    assert.equal(run.win.STREAM_ASSET_SOURCES, undefined);
    assert.equal(run.win.STREAM_ASSET_RESOLVED_MODE, undefined);
  }
});

test("same-scene aliases and unknown scenes do not redirect", async () => {
  const sameScene = await runBoot({ pageScene: "starting", search: "?scene=soon" });
  assert.equal(sameScene.result.status, "ready");
  assert.equal(sameScene.result.scene, "starting");
  assert.equal(sameScene.location.replaced, null);

  const unknown = await runBoot({ pageScene: "starting", search: "?scene=not-a-scene" });
  assert.equal(unknown.result.status, "ready");
  assert.equal(unknown.result.scene, "starting");
  assert.equal(unknown.location.replaced, null);
});

test("every scene alias on every entrypoint routes compatibly", async () => {
  for (const entrypoint of SCENE_ORDER) {
    for (const [scene, aliases] of SCENE_ALIAS_GROUPS) {
      for (const alias of aliases) {
        const run = await runBoot({ pageScene: entrypoint, search: "?scene=" + alias, pathname: BOOT_PATHNAME[entrypoint] });
        if (entrypoint === scene) {
          assert.equal(run.result.status, "ready", "alias " + alias + " must not redirect on " + entrypoint);
          assert.equal(run.result.scene, entrypoint);
          assert.equal(run.location.replaced, null);
        } else {
          assert.equal(run.result.status, "redirected", "alias " + alias + " must redirect from " + entrypoint);
          assert.equal(run.result.scene, scene);
          assert.equal(run.location.replaced, SCENE_PAGE[scene] + "?scene=" + scene);
        }
      }
    }
  }
});

test("subpath root pathname behaves as starting and redirects stay relative", async () => {
  const subpathStart = await runBoot({ pageScene: "starting", pathname: "/subpath/" });
  assert.equal(subpathStart.result.status, "ready");
  assert.equal(subpathStart.result.scene, "starting");
  assert.equal(subpathStart.location.replaced, null);

  const subpathRedirect = await runBoot({ pageScene: "starting", pathname: "/subpath/", search: "?scene=brb" });
  assert.equal(subpathRedirect.result.status, "redirected");
  assert.equal(subpathRedirect.result.scene, "brb");
  assert.equal(subpathRedirect.location.replaced, "brb.html?scene=brb");
});

test("inherited object names as scene values do not redirect to arbitrary routes", async () => {
  for (const alias of ["constructor", "toString", "__proto__"]) {
    const run = await runBoot({ pageScene: "starting", search: "?scene=" + alias });
    assert.equal(run.result.status, "ready");
    assert.equal(run.result.scene, "starting");
    assert.equal(run.location.replaced, null);
  }
});

test("config and STREAM_OVERLAY are not mutated off the starting page; starting preserves a preexisting alias", async () => {
  const config = makeConfig();
  const snapshot = JSON.parse(JSON.stringify(config));

  const brb = await runBoot({ pageScene: "brb", config });
  assert.equal(brb.result.status, "ready");
  assert.equal(brb.win.STREAM_OVERLAY, undefined);
  assert.deepEqual(brb.config, snapshot);

  const thanks = await runBoot({ pageScene: "thanks", config });
  assert.equal(thanks.result.status, "ready");
  assert.equal(thanks.win.STREAM_OVERLAY, undefined);
  assert.deepEqual(thanks.config, snapshot);

  const starting = await runBoot({ pageScene: "starting", config, overlay: { title: "PREEXISTING STREAM OVERLAY" } });
  assert.equal(starting.result.status, "ready");
  assert.equal(starting.win.STREAM_OVERLAY, starting.overlay);
  assert.deepEqual(starting.config, snapshot);
});
