// Developer preview archive only; GNU tar is required. No public release/deploy.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, lstatSync, unlinkSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { readPackageVersion, repoRoot, assertNotSymlink } from "./lib.mjs";

try {
  const i = process.argv.indexOf("--root");
  const root = i >= 0 ? resolve(process.argv[i + 1]) : repoRoot();
  // Always rebuild and re-run the credential/input guard. Never trust stale dist.
  execFileSync(process.execPath, [join(repoRoot(), "scripts/build.mjs"), "--root", root], { stdio: "inherit" });
  const version = readPackageVersion(root);
  const dist = join(root, "dist");
  const release = join(root, "release");
  assertNotSymlink(release);
  mkdirSync(release, { recursive: true });
  const tarInfo = execFileSync("tar", ["--version"], { encoding: "utf8" });
  if (!tarInfo.includes("GNU tar")) throw new Error("Reproducible preview packaging requires GNU tar (Linux/CI)");
  const manifest = JSON.parse(readFileSync(join(dist, "build-manifest.json"), "utf8"));
  const files = [...manifest.files.map(f => f.path), "build-manifest.json"].sort();
  const archive = execFileSync("tar", ["-cf", "-", "-C", dist, "--format=ustar", "--mtime=@0", "--owner=0", "--group=0", "--numeric-owner", "--mode=0644", "--", ...files], { maxBuffer: 64 * 1024 * 1024 });
  const bytes = gzipSync(archive, { level: 9 });
  const base = `obs3dplanetstartingpage-preview-v${version}.tar.gz`;
  const archivePath = join(release, base);
  const sumPath = `${archivePath}.sha256`;
  const previousOutputs = [];
  for (const file of [archivePath, sumPath]) {
    assertNotSymlink(file); // lstat detects dangling links too.
    try {
      if (!lstatSync(file).isFile()) throw new Error('Preview output must be a regular file');
      previousOutputs.push(file);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  // Validate the entire pair before deleting either previous output.
  for (const file of previousOutputs) unlinkSync(file);
  // Exclusive creation also refuses a link inserted after preflight.
  writeFileSync(archivePath, bytes, { flag: 'wx' });
  const digest = createHash("sha256").update(bytes).digest("hex");
  writeFileSync(sumPath, `${digest}  ${base}\n`, { flag: 'wx' });
  console.log(`package: ${archivePath}\npackage: sha256 ${digest}`);
  console.log("PREVIEW ONLY: not an end-user installer; public release requires cleared asset rights and runtime qualification.");
} catch (error) {
  // Suppress child syntax/source output; config credentials must never be echoed.
  console.error(`package FAIL: ${error.status !== undefined ? "build or archive command failed" : error.message}`);
  process.exitCode = 1;
}
