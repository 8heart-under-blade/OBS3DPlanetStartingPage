// Build allowlist tests: dist/ must contain exactly the runtime files,
// never docs/dev/git/secrets, and the manifest hashes must verify.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { ALLOW_DIRS, ALLOW_FILES, repoRoot } from "../scripts/lib.mjs";

const ROOT = repoRoot();
const DIST = join(ROOT, "dist");

function runBuild() {
  execFileSync(process.execPath, [join(ROOT, "scripts", "build.mjs")], { stdio: "pipe" });
}

function walkRel(dir, base = "") {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const rel = base === "" ? e.name : `${base}/${e.name}`;
    if (e.isDirectory()) out.push(...walkRel(join(dir, e.name), rel));
    else out.push(rel);
  }
  return out.sort();
}

test("build succeeds and emits a deterministic manifest", () => {
  runBuild();
  const manifest = JSON.parse(readFileSync(join(DIST, "build-manifest.json"), "utf8"));
  assert.equal(manifest.name, "obs3dplanetstartingpage");
  assert.equal(manifest.version, JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version);
  assert.equal(manifest.previewOnly, true, "builds are preview-only until licensing gates release");
  assert.match(manifest.licenseNote, /licensing gate/i);
  const paths = manifest.files.map((f) => f.path);
  assert.deepEqual(paths, [...paths].sort(), "manifest file list must be sorted");
});

test("dist contains all allowlisted runtime files", () => {
  runBuild();
  for (const f of ALLOW_FILES) {
    assert.equal(existsSync(join(DIST, f)), true, `dist missing allowlisted file: ${f}`);
  }
  for (const d of ALLOW_DIRS) {
    const st = statSync(join(DIST, d));
    assert.equal(st.isDirectory(), true, `dist missing allowlisted dir: ${d}`);
  }
  // Spot-check files the OBS pages actually load.
  for (const f of [
    "vendor/three.min.js",
    "brb-blackhole/blackholeOverlay.module.js",
    "textures/planets/earth_day_2048.jpg",
    "oracles.woff",
    "twigs.woff",
  ]) {
    assert.equal(existsSync(join(DIST, f)), true, `dist missing runtime file: ${f}`);
  }
});

test("dist excludes docs, dev, git, and secret-adjacent files", () => {
  runBuild();
  const rels = walkRel(DIST).filter((p) => p !== "build-manifest.json");
  const forbidden = [
    "README.md",
    "TY4Watching.md",
    "package.json",
    "package-lock.json",
    ".gitignore",
    ".env",
    "scripts",
    "tests",
    ".github",
    ".git",
    "node_modules",
    "dist",
    "release",
  ];
  for (const rel of rels) {
    const parts = rel.split("/");
    for (const bad of forbidden) {
      assert.ok(
        !parts.includes(bad) && !rel.endsWith(".map") && parts[parts.length - 1] !== bad,
        `forbidden entry in dist/: ${rel}`,
      );
    }
  }
  assert.ok(!rels.some((r) => r.includes("node_modules")), "node_modules leaked into dist/");
});

test("manifest hashes match dist contents", () => {
  runBuild();
  const manifest = JSON.parse(readFileSync(join(DIST, "build-manifest.json"), "utf8"));
  assert.ok(manifest.files.length > 10, "manifest should list all runtime files");
  for (const f of manifest.files) {
    const bytes = readFileSync(join(DIST, f.path));
    assert.equal(bytes.length, f.bytes, `size mismatch: ${f.path}`);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), f.sha256, `hash mismatch: ${f.path}`);
  }
});

test("clean build removes stale files", () => {
  runBuild();
  const stale = join(DIST, "stale-should-vanish.txt");
  writeFileSync(stale, "stale");
  assert.equal(existsSync(stale), true);
  runBuild();
  assert.equal(existsSync(stale), false, "stale file survived a clean build");
});
