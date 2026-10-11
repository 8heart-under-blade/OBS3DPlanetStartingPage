// Shared dependency-free helpers for contributor tooling (check / build / package / tests).
// Only Node.js built-ins are used so contributors do not need `npm install`.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, lstatSync } from "node:fs";
import { dirname, join, posix, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export function repoRoot() {
  // scripts/<file>.mjs -> repo root. Overridable for tests via OBS3DSP_ROOT.
  if (process.env.OBS3DSP_ROOT) return resolve(process.env.OBS3DSP_ROOT);
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}

// Exact runtime files shipped to OBS browser sources. Allowlist: no docs,
// dev tooling, git metadata, or secrets may enter dist/ through the build.
export const ALLOW_FILES = [
  "LICENSE",
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
];

// Directory names are retained for contract tests; only these exact files ship.
export const ALLOW_DIRS = ["brb-blackhole", "textures", "vendor"];
export const DIRECTORY_FILES = [
  "brb-blackhole/blackholeOverlay.module.js",
  "textures/planets/earth_clouds_1024.png",
  "textures/planets/earth_clouds_2k_solarsystemscope.jpg",
  "textures/planets/earth_day_2048.jpg",
  "textures/planets/earth_night_2048.png",
  "textures/planets/earth_specular_2048.jpg",
  "textures/planets/moon_1024.jpg",
  "vendor/three.min.js",
  "vendor/three-0.181.0/build/three.core.js",
  "vendor/three-0.181.0/build/three.module.js",
  "vendor/three-0.181.0/examples/jsm/controls/OrbitControls.js",
  "vendor/three-0.181.0/examples/jsm/postprocessing/EffectComposer.js",
  "vendor/three-0.181.0/examples/jsm/postprocessing/MaskPass.js",
  "vendor/three-0.181.0/examples/jsm/postprocessing/Pass.js",
  "vendor/three-0.181.0/examples/jsm/postprocessing/RenderPass.js",
  "vendor/three-0.181.0/examples/jsm/postprocessing/ShaderPass.js",
  "vendor/three-0.181.0/examples/jsm/postprocessing/UnrealBloomPass.js",
  "vendor/three-0.181.0/examples/jsm/shaders/CopyShader.js",
  "vendor/three-0.181.0/examples/jsm/shaders/LuminosityHighPassShader.js",
];
export const RUNTIME_FILES = [...ALLOW_FILES, ...DIRECTORY_FILES].sort();
export const NOTICE_FILES = ['ATTRIBUTIONS.md', 'docs/ASSET_AUDIT.md', 'docs/asset-inventory.json'];
export const PACKAGE_FILES = [...RUNTIME_FILES, ...NOTICE_FILES].sort();

export function assertNotSymlink(path) {
  try {
    if (lstatSync(path).isSymbolicLink()) throw new Error('Symlink output is not permitted');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

export function assertRegularFile(root, rel) {
  if (!isSafeRelativePath(root, rel)) throw new Error("Unsafe runtime path");
  const parts = rel.split("/");
  for (let i = 1; i <= parts.length; i++) {
    const stat = lstatSync(join(root, ...parts.slice(0, i)));
    if (stat.isSymbolicLink()) throw new Error(`Symlink not permitted: ${rel}`);
    if (i === parts.length && !stat.isFile()) throw new Error(`Not a regular file: ${rel}`);
  }
}

// Names that must never appear in dist/ (case-sensitive basename match).
export const FORBIDDEN_BASENAMES = new Set([
  ".git",
  ".github",
  ".gitignore",
  "node_modules",
  "scripts",
  "tests",
  "dist",
  "release",
  "package.json",
  "package-lock.json",
  "README.md",
  "TY4Watching.md",
  ".env",
]);

export const HTML_PAGES = ["index.html", "brb.html", "thanks.html"];

// First-party JS checked for syntax (vendor/ is third-party and excluded).
export const FIRST_PARTY_JS = [
  "config.js",
  "main.js",
  "brb.js",
  "thanks.js",
];

export function walkSync(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  )) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkSync(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

export function sha256File(absPath) {
  const h = createHash("sha256");
  h.update(readFileSync(absPath));
  return h.digest("hex");
}

export function toPosixRel(root, absPath) {
  return resolve(absPath).replace(resolve(root) + sep, "").split(sep).join(posix.sep);
}

// Returns true for relative in-tree paths. Rejects absolute paths, URLs,
// protocol schemes, home-dir shortcuts, and anything escaping the root.
export function isSafeRelativePath(root, rel) {
  if (typeof rel !== "string" || rel.length === 0) return false;
  const v = rel.trim();
  if (v === "") return false;
  if (v.startsWith("/") || v.startsWith("\\")) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v)) return false; // scheme: http:, ws:, data:, ...
  if (v.startsWith("~")) return false;
  if (v.includes("\0")) return false;
  const abs = resolve(root, v);
  return abs === resolve(root) || abs.startsWith(resolve(root) + sep);
}

export function resolvesInsideRoot(root, rel) {
  const abs = resolve(root, rel);
  return abs === resolve(root) || abs.startsWith(resolve(root) + sep);
}

// Extract static src=/href= references from HTML: [{ attr, value, line }].
// Filters out empty values; caller decides which schemes to skip.
export function extractHtmlRefs(html) {
  const refs = [];
  const re = /(src|href)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const value = m[3] !== undefined ? m[3] : m[4];
    if (value === "") continue;
    const line = html.slice(0, m.index).split("\n").length;
    refs.push({ attr: m[1], value, line });
  }
  return refs;
}

// Extract inline <script> blocks without a src attribute: [{ code, line }].
export function extractInlineScripts(html) {
  const blocks = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (/\bsrc\s*=/.test(m[1])) continue;
    const code = m[2];
    if (code.trim() === "") continue;
    const line = html.slice(0, m.index).split("\n").length;
    blocks.push({ code, line });
  }
  return blocks;
}

// Inspect the OBS WebSocket password assignment in config.js source.
// Returns { found: boolean, blank: boolean }. Never returns the value,
// so failure messages cannot echo a secret.
export function inspectPasswordAssignment(source) {
  // Lex comments and quoted literals without evaluating config.js. Fail closed
  // on dynamic/backtick values or later password assignments. This is a narrow
  // release guard for the current config contract, not a general secret scanner.
  // Reject escaped spellings conservatively rather than risk ignoring an
  // equivalent password key (e.g. pass\\u0077ord). Current config needs none.
  // Tokenize first so ordinary comment text does not trigger the restriction.
  const tokens = source.match(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`|[A-Za-z_$][\w$]*|[^\s]/g) || [];
  const code = tokens.filter(t => !t.startsWith("//") && !t.startsWith("/*"));
  if (code.some(t => t.includes('\\'))) return { found: true, blank: false };
  let found = false;
  let blank = true;
  for (let i = 0; i < code.length; i++) {
    if (!["password", '"password"', "'password'"].includes(code[i])) continue;
    found = true;
    const literal = code[i + 2];
    if (code[i + 1] !== ":" || !['""', "''"].includes(literal) ||
        ![",", "}", undefined].includes(code[i + 3])) blank = false;
  }
  return { found, blank };
}

export function readPackageVersion(root) {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  if (typeof pkg.version !== "string" || !/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(pkg.version)) {
    throw new Error("package.json version must be a safe semantic version");
  }
  return pkg.version;
}

export function existsFile(absPath) {
  try {
    return statSync(absPath).isFile();
  } catch {
    return false;
  }
}
