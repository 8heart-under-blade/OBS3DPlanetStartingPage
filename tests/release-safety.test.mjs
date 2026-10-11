import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, existsSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { PACKAGE_FILES, inspectPasswordAssignment, repoRoot } from '../scripts/lib.mjs';
const root = repoRoot();
const build = join(root, 'scripts/build.mjs');
const pack = join(root, 'scripts/package.mjs');
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'obs3d-safety-'));
  for (const rel of [...PACKAGE_FILES, 'package.json']) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    copyFileSync(join(root, rel), join(dir, rel));
  }
  return dir;
}
function run(script, dir, extra = []) {
  return execFileSync(process.execPath, [script, '--root', dir, ...extra], { encoding: 'utf8', stdio: 'pipe' });
}

test('credential guard rejects dynamic values, quoted/computed keys and later assignments', () => {
  for (const src of ['password: `secret`', '"password": "secret"', 'password: "" + secret', 'password: variable', 'password: "", x: 1; config.password = "secret"', 'password: "", x: { ["password"]: "secret" }']) {
    assert.deepEqual(inspectPasswordAssignment(src), { found: true, blank: false });
  }
  for (const src of [String.raw`pass\u0077ord: "secret"`, String.raw`password: "", pass\u0077ord: "secret"`, String.raw`"pass\x77ord": "secret"`]) {
    assert.deepEqual(inspectPasswordAssignment(src), { found: true, blank: false });
  }
  assert.deepEqual(inspectPasswordAssignment('// password: ""'), { found: false, blank: true });
  assert.deepEqual(inspectPasswordAssignment('/* password: "" */ password: "secret"'), { found: true, blank: false });
});

test('directory allowlist never includes additional config/secret files', () => {
  const dir = fixture();
  try {
    writeFileSync(join(dir, 'vendor/config.local.json'), '{"password":"private"}');
    writeFileSync(join(dir, 'textures/.env.local'), 'private');
    run(build, dir);
    assert.equal(existsSync(join(dir, 'dist/vendor/config.local.json')), false);
    assert.equal(existsSync(join(dir, 'dist/textures/.env.local')), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('build refuses dangerous output overrides without deleting files', () => {
  const dir = fixture();
  try {
    const sentinel = join(dir, 'keep.txt'); writeFileSync(sentinel, 'keep');
    assert.throws(() => run(build, dir, ['--out', dir]));
    assert.equal(readFileSync(sentinel, 'utf8'), 'keep');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('build rejects symlinked inputs', () => {
  const dir = fixture();
  try {
    const target = join(dir, 'config.js');
    copyFileSync(target, join(dir, 'original.js')); rmSync(target);
    symlinkSync(join(dir, 'original.js'), target);
    assert.throws(() => run(build, dir), /Symlink not permitted/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('packaging rechecks credentials even when a prior dist exists', () => {
  const dir = fixture();
  try {
    run(build, dir);
    const secret = 'regression_secret_not_for_output';
    const config = readFileSync(join(dir, 'config.js'), 'utf8').replace('password: ""', `password: "${secret}"`);
    writeFileSync(join(dir, 'config.js'), config);
    let failed = false;
    try { run(pack, dir); }
    catch (error) {
      failed = true;
      assert.doesNotMatch(String(error.stdout) + String(error.stderr), new RegExp(secret));
    }
    assert.equal(failed, true);
    assert.equal(existsSync(join(dir, 'release')), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('packaging refuses dangling output symlinks without creating their targets', () => {
  for (const suffix of ['', '.sha256']) {
    const dir = fixture();
    try {
      mkdirSync(join(dir, 'release'));
      const version = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version;
      const target = join(dir, 'must-not-be-created');
      symlinkSync(target, join(dir, 'release', `obs3dplanetstartingpage-preview-v${version}.tar.gz${suffix}`));
      assert.throws(() => run(pack, dir));
      assert.equal(existsSync(target), false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

test('unsafe checksum output does not remove an existing archive', () => {
  const dir = fixture();
  try {
    mkdirSync(join(dir, 'release'));
    const version = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version;
    const archive = join(dir, 'release', `obs3dplanetstartingpage-preview-v${version}.tar.gz`);
    writeFileSync(archive, 'previous preview');
    symlinkSync(join(dir, 'missing-target'), archive + '.sha256');
    assert.throws(() => run(pack, dir));
    assert.equal(readFileSync(archive, 'utf8'), 'previous preview');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('archive bytes are reproducible and contain the complete independent baseline plus notices', t => {
  let gnuTar = false;
  try { gnuTar = execFileSync('tar', ['--version'], { encoding: 'utf8' }).includes('GNU tar'); } catch {}
  if (!gnuTar) { t.skip('GNU tar packaging is qualified on Linux/CI only'); return; }
  const dir = fixture();
  try {
    run(pack, dir);
    const version = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version;
    const path = join(dir, 'release', `obs3dplanetstartingpage-preview-v${version}.tar.gz`);
    const first = readFileSync(path);
    run(pack, dir); assert.deepEqual(readFileSync(path), first);
    const baseline = JSON.parse(readFileSync(join(root, 'docs/source-baseline.json'), 'utf8'));
    const expected = [...baseline.files.map(f => f.path), 'LICENSE', 'ATTRIBUTIONS.md', 'docs/ASSET_AUDIT.md', 'docs/asset-inventory.json', 'build-manifest.json'].sort();
    const members = execFileSync('tar', ['-tzf', path], { encoding: 'utf8' }).trim().split('\n').sort();
    assert.deepEqual(members, expected);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('build manifest is byte reproducible', () => {
  const dir = fixture();
  try {
    run(build, dir); const first = readFileSync(join(dir, 'dist/build-manifest.json'));
    run(build, dir); assert.deepEqual(readFileSync(join(dir, 'dist/build-manifest.json')), first);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
