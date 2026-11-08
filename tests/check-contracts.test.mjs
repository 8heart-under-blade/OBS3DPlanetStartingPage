// Static contract tests: files the OBS pages need must exist, and the full
// `npm run check` gate must pass on the clean tree.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isSafeRelativePath, repoRoot, resolvesInsideRoot } from "../scripts/lib.mjs";

const ROOT = repoRoot();

// Files the three HTML boot loaders and overlay require at runtime.
const REQUIRED = [
  "index.html",
  "brb.html",
  "thanks.html",
  "styles.css",
  "brb.css",
  "thanks.css",
  "config.js",
  "runtime/boot.js",
  "runtime/overlay.js",
  "runtime/audio.js",
  "runtime/recovery.js",
  "runtime/settings.js",
  "main.js",
  "brb.js",
  "thanks.js",
  "cinzel-decorative.ttf",
  "macondo.ttf",
  "credits.html",
  "vendor/three.min.js",
  "brb-blackhole/blackholeOverlay.module.js",
];

test("required runtime files exist", () => {
  for (const f of REQUIRED) {
    assert.equal(existsSync(join(ROOT, f)), true, `missing required runtime file: ${f}`);
  }
});

test("HTML pages load config before the shared bootstrap with the correct scene", () => {
  const pairs = [
    ["index.html", "starting"],
    ["brb.html", "brb"],
    ["thanks.html", "thanks"],
  ];
  for (const [page, scene] of pairs) {
    const html = readFileSync(join(ROOT, page), "utf8");
    const configTag = '<script src="config.js"></script>';
    const overlayTag = '<script src="runtime/overlay.js"';
    const settingsTag = '<script src="runtime/settings.js"';
    const audioTag = '<script src="runtime/audio.js"';
    const recoveryTag = '<script src="runtime/recovery.js"';
    const bootTag = '<script src="runtime/boot.js" data-scene="' + scene + '"';
    assert.ok(html.includes(configTag), page);
    assert.ok(html.indexOf(settingsTag) > html.indexOf(configTag), page + ' must load config before settings helpers');
    assert.ok(html.indexOf(overlayTag) > html.indexOf(settingsTag), page + ' must load settings before overlay helpers');
    assert.equal(html.split('src="runtime/settings.js"').length - 1, 1, page);
    assert.ok(html.indexOf(audioTag) > html.indexOf(overlayTag), page + ' must load overlay then audio helpers');
    assert.ok(html.indexOf(recoveryTag) > html.indexOf(audioTag), page + ' must load audio then recovery helpers');
    assert.ok(html.indexOf(bootTag) > html.indexOf(recoveryTag), page + ' must load recovery before bootstrap');
    assert.equal(html.split('src="runtime/recovery.js"').length - 1, 1, page);
    assert.equal(html.split('src="runtime/audio.js"').length - 1, 1, page);
    assert.equal(html.split('src="runtime/overlay.js"').length - 1, 1, page);
    assert.equal(html.split('src="runtime/boot.js"').length - 1, 1, page);
    assert.doesNotMatch(html, /function bootLoader|<script>/);
    assert.match(html, /onerror="document.getElementById\('bootError'\).hidden = false"/);
    assert.match(html, /Scene bootstrap could not load/);
  }
});

test("path guard rejects traversal and absolute paths", () => {
  assert.equal(isSafeRelativePath(ROOT, "../outside.txt"), false);
  assert.equal(isSafeRelativePath(ROOT, "/etc/passwd"), false);
  assert.equal(isSafeRelativePath(ROOT, "https://example.com/x.js"), false);
  assert.equal(isSafeRelativePath(ROOT, ""), false);
  assert.equal(isSafeRelativePath(ROOT, "vendor/three.min.js"), true);
  assert.equal(resolvesInsideRoot(ROOT, "textures/planets/earth_day_2048.jpg"), true);
  assert.equal(resolvesInsideRoot(ROOT, "../escape.txt"), false);
});

test("npm run check passes on the clean tree", () => {
  const out = execFileSync(process.execPath, [join(ROOT, "scripts", "check.mjs")], {
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.match(out, /all checks passed/);
});
