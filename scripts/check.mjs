// npm run check — static contributor checks (dependency-free, Node built-ins only).
//  1. Node >= 22 (required for tooling and test runner).
//  2. First-party JS syntax, including inline <script> blocks in HTML pages.
//  3. Local asset links resolve to files inside the repo root (no traversal).
//  4. config.js OBS WebSocket password must be blank (never echoed on failure).
//
// Usage: node scripts/check.mjs [--root <dir>]
// Env override for tests: OBS3DSP_ROOT=<dir>
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import {
  FIRST_PARTY_JS,
  HTML_PAGES,
  RUNTIME_FILES,
  assertRegularFile,
  extractHtmlRefs,
  extractInlineScripts,
  inspectPasswordAssignment,
  isSafeRelativePath,
  repoRoot,
  resolvesInsideRoot,
  walkSync,
} from "./lib.mjs";

const failures = [];
function fail(msg) {
  failures.push(msg);
  console.error(`check FAIL: ${msg}`);
}
function pass(msg) {
  console.log(`check ok: ${msg}`);
}

function rootFromArgs() {
  const i = process.argv.indexOf("--root");
  if (i >= 0 && process.argv[i + 1]) return resolve(process.argv[i + 1]);
  return repoRoot();
}

function checkNodeVersion() {
  const major = Number(process.versions.node.split(".")[0]);
  if (!Number.isInteger(major) || major < 22) {
    fail(`Node >= 22 required, found ${process.version}`);
    return;
  }
  pass(`Node version ${process.version} (>= 22)`);
}

function syntaxCheckFile(absPath, label) {
  try {
    // Node 22 `node --check` auto-detects classic vs module goals.
    execFileSync(process.execPath, ["--check", absPath], { stdio: "pipe" });
    return true;
  } catch (e) {
    const detail = (e.stderr || e.stdout || e.message || "").toString().split("\n").slice(0, 4).join("\n");
    fail(`syntax error in ${label}: ${detail}`);
    return false;
  }
}

function syntaxCheckInline(code, label) {
  const dir = mkdtempSync(join(tmpdir(), "obs3d-check-"));
  const tmp = join(dir, "inline.mjs");
  try {
    writeFileSync(tmp, code);
    execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" });
    return true;
  } catch (e) {
    const detail = (e.stderr || e.stdout || e.message || "").toString().split("\n").slice(0, 4).join("\n");
    fail(`syntax error in ${label}: ${detail}`);
    return false;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function checkSyntax(root) {
  let files = 0;
  let blocks = 0;
  for (const rel of FIRST_PARTY_JS) {
    const abs = join(root, rel);
    if (!existsSync(abs)) {
      fail(`expected first-party file missing: ${rel}`);
      continue;
    }
    files += 1;
    syntaxCheckFile(abs, rel);
  }
  // brb-blackhole overlay modules (first-party ESM).
  const overlayDir = join(root, "brb-blackhole");
  if (existsSync(overlayDir)) {
    for (const abs of walkSync(overlayDir).filter((f) => f.endsWith(".js"))) {
      files += 1;
      syntaxCheckFile(abs, abs.replace(root + "/", ""));
    }
  }
  for (const page of HTML_PAGES) {
    const abs = join(root, page);
    if (!existsSync(abs)) continue; // missing pages are reported by the contract test
    const html = readFileSync(abs, "utf8");
    for (const [i, b] of extractInlineScripts(html).entries()) {
      blocks += 1;
      syntaxCheckInline(b.code, `${page} inline script #${i + 1} (line ~${b.line})`);
    }
  }
  if (!failures.some((f) => f.startsWith("syntax error"))) {
    pass(`syntax: ${files} JS file(s), ${blocks} inline HTML script block(s)`);
  }
}

function isSkippableRef(value) {
  const v = value.trim();
  if (v === "" || v.startsWith("#")) return true;
  if (/^(https?|wss?|data|blob|mailto):/i.test(v)) return true;
  if (/^(\?|&)/.test(v)) return true;
  const pathPart = v.split(/[?#]/)[0];
  return pathPart === "";
}

function checkHtmlAssetLinks(root) {
  let checked = 0;
  for (const page of HTML_PAGES) {
    const abs = join(root, page);
    if (!existsSync(abs)) continue;
    const html = readFileSync(abs, "utf8");
    for (const ref of extractHtmlRefs(html)) {
      if (isSkippableRef(ref.value)) continue;
      const target = ref.value.split(/[?#]/)[0].replace(/^\.\//, "");
      if (!isSafeRelativePath(root, target)) {
        fail(`${page}:${ref.line}: unsafe ${ref.attr} target (outside root or absolute): ${target}`);
        continue;
      }
      if (!resolvesInsideRoot(root, target)) {
        fail(`${page}:${ref.line}: path traversal in ${ref.attr}: ${target}`);
        continue;
      }
      if (!existsSync(join(root, target))) {
        fail(`${page}:${ref.line}: missing local asset ${ref.attr}="${target}"`);
        continue;
      }
      checked += 1;
    }
  }
  // Dynamic script loads referenced by the boot loaders (loadScript/import strings).
  for (const dyn of ["main.js", "brb.js", "thanks.js", "brb-blackhole/blackholeOverlay.module.js"]) {
    if (!existsSync(join(root, dyn))) fail(`dynamically loaded file missing: ${dyn}`);
    else checked += 1;
  }
  // config.js-declared local assets: localThree, texture/font paths (skip URLs).
  const cfgPath = join(root, "config.js");
  if (existsSync(cfgPath)) {
    const src = readFileSync(cfgPath, "utf8");
    const lit = /"([^"]*)"|'([^']*)'/g;
    let m;
    const exts = [".js", ".woff", ".woff2", ".png", ".jpg", ".jpeg", ".webp", ".css", ".json"];
    const seen = new Set();
    while ((m = lit.exec(src)) !== null) {
      const v = (m[1] !== undefined ? m[1] : m[2]).trim();
      if (v === "" || seen.has(v)) continue;
      seen.add(v);
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v)) continue; // URL / scheme
      if (!exts.some((e) => v.toLowerCase().split(/[?#]/)[0].endsWith(e))) continue;
      const target = v.replace(/^@/, "").split(/[?#]/)[0]; // "@oracles.woff" -> root file
      if (!isSafeRelativePath(root, target)) {
        fail(`config.js: unsafe local asset path: ${target}`);
        continue;
      }
      if (!existsSync(join(root, target))) {
        fail(`config.js: missing local asset: ${target}`);
        continue;
      }
      checked += 1;
    }
  }
  if (!failures.some((f) => f.includes("asset") || f.includes("unsafe") || f.includes("traversal") || f.includes("missing local"))) {
    pass(`asset links: ${checked} local reference(s) resolve inside root`);
  }
}

function checkPasswordBlank(root) {
  const cfgPath = join(root, "config.js");
  if (!existsSync(cfgPath)) {
    fail("config.js missing; cannot verify OBS password safeguard");
    return;
  }
  const src = readFileSync(cfgPath, "utf8");
  const { found, blank } = inspectPasswordAssignment(src);
  if (!found) {
    fail("config.js: no password assignment found; expected blank `password: \"\"`");
    return;
  }
  // Deliberately never print the value: a non-blank password is a secret.
  if (!blank) {
    fail("config.js: OBS WebSocket password must be blank before sharing/packaging (value withheld)");
    return;
  }
  pass("config.js OBS password is blank");
}

function main() {
  const root = rootFromArgs();
  console.log(`check: root=${root}`);
  checkNodeVersion();
  // Credentials must be checked before syntax diagnostics can quote config.js.
  checkPasswordBlank(root);
  if (failures.length > 0) process.exit(1);
  for (const rel of RUNTIME_FILES) {
    try { assertRegularFile(root, rel); }
    catch { fail(`required regular runtime file missing or unsafe: ${rel}`); }
  }
  checkSyntax(root);
  checkHtmlAssetLinks(root);
  if (failures.length > 0) {
    console.error(`check: ${failures.length} failure(s)`);
    process.exit(1);
  }
  console.log("check: all checks passed");
}

main();
