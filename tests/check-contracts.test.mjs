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
  "main.js",
  "brb.js",
  "thanks.js",
  "oracles.woff",
  "twigs.woff",
  "vendor/three.min.js",
  "brb-blackhole/blackholeOverlay.module.js",
];

test("required runtime files exist", () => {
  for (const f of REQUIRED) {
    assert.equal(existsSync(join(ROOT, f)), true, `missing required runtime file: ${f}`);
  }
});

test("HTML pages reference config + scene scripts", () => {
  const pairs = [
    ["index.html", "main.js"],
    ["brb.html", "brb.js"],
    ["thanks.html", "thanks.js"],
  ];
  for (const [page, scene] of pairs) {
    const html = readFileSync(join(ROOT, page), "utf8");
    assert.match(html, /config\.js/, `${page} must load config.js`);
    assert.match(html, new RegExp(scene.replace(".", "\\.")), `${page} must load ${scene}`);
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
