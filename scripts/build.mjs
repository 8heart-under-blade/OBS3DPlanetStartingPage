// Preview-only deterministic static build. No scene transformation.
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { PACKAGE_FILES, assertRegularFile, inspectPasswordAssignment, readPackageVersion, repoRoot, sha256File, assertNotSymlink } from "./lib.mjs";

try {
  const i = process.argv.indexOf("--root");
  const root = i >= 0 ? resolve(process.argv[i + 1]) : repoRoot();
  const out = join(root, "dist");
  // Never recursively remove an arbitrary caller-supplied output or a symlink.
  if (process.argv.includes("--out")) throw new Error("Custom build output is not supported; use dist/ under --root");
  assertNotSymlink(out);
  const { found, blank } = inspectPasswordAssignment(readFileSync(join(root, "config.js"), "utf8"));
  if (!found || !blank) throw new Error("config.js OBS password must be blank (value withheld)");
  const version = readPackageVersion(root);
  // Preflight every exact input before copying; no recursive directory wildcard.
  for (const rel of PACKAGE_FILES) assertRegularFile(root, rel);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  for (const rel of PACKAGE_FILES) {
    const dest = join(out, rel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(join(root, rel), dest);
  }
  const manifest = {
    schemaVersion: 1, name: "obs3dplanetstartingpage", version, previewOnly: true,
    licenseNote: "UNVERIFIED: public release requires the licensing gate. Local preview only.",
    files: PACKAGE_FILES.map(path => ({ path, bytes: readFileSync(join(out, path)).length, sha256: sha256File(join(out, path)) })),
  };
  writeFileSync(join(out, "build-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`build: ${manifest.files.length} exact allowlisted files -> ${relative(root, out)} (v${version}, preview-only)`);
} catch (error) {
  console.error(`build FAIL: ${error.message}`);
  process.exitCode = 1;
}
