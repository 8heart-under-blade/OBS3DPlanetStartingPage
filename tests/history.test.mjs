import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync, gunzipSync } from 'node:zlib';
import { PACKAGE_FILES, repoRoot } from '../scripts/lib.mjs';
import { contentHash, selectRelease, tree } from '../scripts/site-lib.mjs';
import { decodeTar, encodeTar, inspectArchive, prepareHistory, restoreHistory, snapshotHistory, verifyHistory } from '../scripts/history-lib.mjs';

const ROOT = repoRoot();
function temporary(t) {
  const path = mkdtempSync(join(tmpdir(), 'obs3d-history-test-'));
  t.after(() => rmSync(path, {recursive: true, force: true}));
  return path;
}
function fixture(t) {
  const dir = temporary(t), root = join(dir, 'source'); mkdirSync(root);
  for (const path of [...PACKAGE_FILES, 'package.json']) {
    const target = join(root, path); mkdirSync(dirname(target), {recursive: true}); copyFileSync(join(ROOT, path), target);
  }
  const build = () => {
    const result = spawnSync(process.execPath, [join(ROOT, 'scripts/cloudflare.mjs'), 'build', '--root', root], {encoding: 'utf8'});
    assert.equal(result.status, 0, result.stdout + result.stderr);
  };
  build();
  const archive = join(dir, 'history.tar.gz'), backup = snapshotHistory(root, archive);
  return {dir, root, build, archive, backup};
}
const hashes = root => Object.fromEntries(tree(root).map(path => [path, contentHash(readFileSync(join(root, path)))]));
function checksum(tar) {
  tar.fill(32, 148, 156);
  const sum = [...tar.subarray(0, 512)].reduce((a, b) => a + b, 0);
  tar.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 'ascii'); return tar;
}
function mutatedArchive(f, mutate) {
  const files = decodeTar(gunzipSync(readFileSync(f.archive)));
  mutate(files);
  const bytes = gzipSync(encodeTar(files));
  const archive = join(f.dir, 'mutated.tar.gz'); writeFileSync(archive, bytes);
  return {archive, pin: contentHash(bytes)};
}

test('snapshot round-trips exact cumulative catalogs; restore is idempotent and backups cannot be overwritten', t => {
  const f = fixture(t), dest = join(f.dir, 'restored');
  const before = hashes(f.root);
  const inspected = inspectArchive(f.archive, f.backup.sha256);
  assert.equal(inspected.records.length, f.backup.records);
  assert.deepEqual(restoreHistory(f.archive, f.backup.sha256, dest), inspected);
  assert.deepEqual(hashes(join(dest, 'site')), hashes(join(f.root, 'site')));
  assert.deepEqual(hashes(join(dest, 'cf-dist')), hashes(join(f.root, 'cf-dist')));
  restoreHistory(f.archive, f.backup.sha256, dest);
  assert.deepEqual(hashes(f.root), before);
  assert.throws(() => snapshotHistory(f.root, f.archive), /overwrite/);
  assert.throws(() => snapshotHistory(f.root, join(f.root, 'site', 'backup.tar.gz')), /outside/);
});

test('archive pin is checked before decompression and invalid data cannot install history', t => {
  const f = fixture(t), dest = join(f.dir, 'restored');
  assert.throws(() => restoreHistory(f.archive, '0'.repeat(64), dest), /digest/);
  assert.ok(!existsSync(join(dest, 'site')));
  const broken = join(f.dir, 'not-gzip'); writeFileSync(broken, 'not an archive');
  assert.throws(() => inspectArchive(broken, '0'.repeat(64)), /digest/);
  assert.throws(() => inspectArchive(broken, contentHash(Buffer.from('not an archive'))));
});

test('pinned archive still requires exact catalog, sizes, hashes, metadata and both validators', t => {
  const f = fixture(t);
  const cases = [
    files => files.set('site/unknown.txt', Buffer.from('extra')),
    files => files.delete('site/index.html'),
    files => files.set('site/index.html', Buffer.from('tampered')),
    files => {
      const snapshot = JSON.parse(files.get('snapshot.json'));
      snapshot.records.push(snapshot.records[0]); files.set('snapshot.json', Buffer.from(JSON.stringify(snapshot)));
    },
    files => {
      const snapshot = JSON.parse(files.get('snapshot.json'));
      snapshot.currentRelease = 'v0.0.0-' + '0'.repeat(64); files.set('snapshot.json', Buffer.from(JSON.stringify(snapshot)));
    },
    files => {
      // Resealing the catalog cannot bypass the site/Cloudflare validators.
      const path = 'cf-dist/_headers', data = Buffer.from('bad cache policy'); files.set(path, data);
      const snapshot = JSON.parse(files.get('snapshot.json'));
      Object.assign(snapshot.records.find(record => record.path === path), {bytes: data.length, sha256: contentHash(data)});
      files.set('snapshot.json', Buffer.from(JSON.stringify(snapshot)));
    }
  ];
  for (const mutate of cases) {
    const {archive, pin} = mutatedArchive(f, mutate), dest = join(f.dir, 'rejected');
    assert.throws(() => restoreHistory(archive, pin, dest));
    assert.ok(!existsSync(join(dest, 'site'))); assert.ok(!existsSync(join(dest, 'cf-dist')));
  }
});

test('strict tar parser refuses links, devices, extensions, traversal, duplicates and malformed framing', () => {
  const valid = encodeTar(new Map([['snapshot.json', Buffer.from('{}')], ['site/index.html', Buffer.from('safe')]]));
  assert.equal(decodeTar(valid).size, 2);
  for (const type of [49, 50, 51, 52, 54, 120, 103, 76, 75]) {
    const bad = Buffer.from(valid); bad[156] = type;
    assert.throws(() => decodeTar(checksum(bad)), /Nonregular/);
  }
  for (const path of ['../escape', '/absolute', 'site/../../escape', 'site\\escape', 'site/CON.txt', 'site/a:stream', 'unknown/file']) {
    const bad = Buffer.from(valid); bad.fill(0, 0, 100); bad.write(path, 0);
    assert.throws(() => decodeTar(checksum(bad)), /path/);
  }
  const duplicate = Buffer.concat([valid.subarray(0, -1024), valid]);
  assert.throws(() => decodeTar(duplicate), /Duplicate/);
  const caseCollision = Buffer.from(valid); caseCollision.fill(0, 1024, 1124); caseCollision.write('SNAPSHOT.JSON', 1024);
  // Independently sealed uppercase member also fails the exact path policy.
  assert.throws(() => decodeTar(caseCollision));
  const badChecksum = Buffer.from(valid); badChecksum[0] ^= 1; assert.throws(() => decodeTar(badChecksum), /checksum/);
  assert.throws(() => decodeTar(valid.subarray(0, -512)), /terminator/);
  assert.throws(() => decodeTar(Buffer.concat([valid, Buffer.from('junk')])), /alignment/);
  const nonzeroTail = Buffer.from(valid); nonzeroTail[nonzeroTail.length - 1] = 1;
  assert.throws(() => decodeTar(nonzeroTail), /terminator/);
  const collision = encodeTar(new Map([['snapshot.json', Buffer.from('{}')], ['site/a', Buffer.from('x')], ['site/a/b', Buffer.from('x')]]));
  assert.throws(() => decodeTar(collision), /collision/);
});

test('restore preflights both existing folders and refuses differing history without replacing either', t => {
  const f = fixture(t), dest = join(f.dir, 'restored');
  restoreHistory(f.archive, f.backup.sha256, dest);
  writeFileSync(join(dest, 'cf-dist', '_headers'), 'different');
  rmSync(join(dest, 'site'), {recursive: true});
  const before = hashes(dest);
  assert.throws(() => restoreHistory(f.archive, f.backup.sha256, dest), /differ/);
  assert.deepEqual(hashes(dest), before); assert.ok(!existsSync(join(dest, 'site')));
});

test('snapshot refuses inconsistent current selections across the two trees', t => {
  const f = fixture(t), old = f.backup.current;
  writeFileSync(join(f.root, 'editor.css'), readFileSync(join(f.root, 'editor.css'), 'utf8') + '\n/* second namespace */\n');
  f.build(); selectRelease(join(f.root, 'site'), old);
  assert.throws(() => snapshotHistory(f.root, join(f.dir, 'inconsistent.tar.gz')), /differ/);
});

test('fresh preparation restores cumulative history before build, preserves accepted selection and restore-checks a new backup', t => {
  const f = fixture(t), accepted = f.backup.current;
  writeFileSync(join(f.root, 'editor.css'), readFileSync(join(f.root, 'editor.css'), 'utf8') + '\n/* retained second release */\n'); f.build();
  const archive = join(f.dir, 'two.tar.gz'), backup = snapshotHistory(f.root, archive);
  writeFileSync(join(f.root, 'editor.css'), readFileSync(join(f.root, 'editor.css'), 'utf8') + '\n/* next candidate */\n');
  const before = hashes(f.root), output = join(f.dir, 'prepared');
  const result = prepareHistory({root: f.root, archive, pin: backup.sha256, release: accepted, output});
  assert.equal(result.current, accepted); assert.equal(result.releases.length, 3);
  assert.deepEqual(hashes(f.root), before);
  assert.equal(verifyHistory(output).current, accepted);
  for (const record of inspectArchive(archive, backup.sha256).records.filter(record => record.path.includes('/releases/'))) {
    assert.equal(contentHash(readFileSync(join(output, record.path))), record.sha256);
  }
  const proof = JSON.parse(readFileSync(join(output, 'preparation.json')));
  assert.equal(proof.inputArchiveSha256, backup.sha256); assert.equal(proof.outputArchiveSha256, result.sha256);
  assert.equal(proof.productionApproved, false);
  assert.equal(inspectArchive(join(output, 'history.tar.gz'), result.sha256).releases.length, 3);
  const restored = join(f.dir, 'candidate-restored'); restoreHistory(join(output, 'history.tar.gz'), result.sha256, restored);
  assert.deepEqual(hashes(join(restored, 'cf-dist')), hashes(join(output, 'cf-dist')));
  const sourceOutput = join(f.dir, 'source-prepared');
  const source = prepareHistory({root: f.root, archive, pin: backup.sha256, release: 'source', output: sourceOutput});
  assert.notEqual(source.current, accepted); assert.equal(source.releases.length, 3);
  assert.deepEqual(hashes(f.root), before);
});

test('preparation refuses missing selection, unknown release, reused output or invalid archive before building', t => {
  const f = fixture(t), output = join(f.dir, 'prepared'), before = hashes(f.root);
  const options = {root: f.root, archive: f.archive, pin: f.backup.sha256, output};
  for (const release of [undefined, '../bad', 'v0.0.0-' + '0'.repeat(64)]) {
    assert.throws(() => prepareHistory({...options, release})); assert.ok(!existsSync(output));
  }
  assert.throws(() => prepareHistory({...options, release: 'source', pin: '0'.repeat(64)}), /digest/);
  assert.throws(() => prepareHistory({...options, release: 'source', output: join(f.root, 'prepared')}), /destination/);
  assert.throws(() => prepareHistory({...options, release: 'source', output: f.dir}), /already exist/);
  mkdirSync(output);
  assert.throws(() => prepareHistory({...options, release: 'source'}), /already exist/);
  assert.deepEqual(hashes(f.root), before);
  rmSync(output, {recursive: true});
  const config = join(f.root, 'config.js');
  writeFileSync(config, readFileSync(config, 'utf8').replace(/password:\s*""/, 'password: "synthetic-rejected-secret"'));
  const rejectedSource = hashes(f.root);
  assert.throws(() => prepareHistory({...options, release: 'source'}));
  assert.ok(!existsSync(output));
  assert.ok(!readdirSync(f.dir).some(path => path.startsWith('.history-prepare-')));
  assert.deepEqual(hashes(f.root), rejectedSource);
});

test('history paths refuse symlinked output ancestors and source trees', t => {
  const f = fixture(t), alias = join(f.dir, 'alias');
  try { symlinkSync(f.root, alias, 'dir'); }
  catch (error) { if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) { t.skip('Windows symlink privilege unavailable'); return; } throw error; }
  assert.throws(() => snapshotHistory(alias, join(f.dir, 'no.tar.gz')), /Symlink/);
  assert.throws(() => restoreHistory(f.archive, f.backup.sha256, alias), /Symlink/);
  assert.throws(() => prepareHistory({root: f.root, archive: f.archive, pin: f.backup.sha256, release: 'source', output: join(alias, 'out')}), /Symlink/);
});

test('history CLI rejects unknown/duplicate flags and never prints archive contents on failure', t => {
  const dir = temporary(t), archive = join(dir, 'bad.tar.gz'); writeFileSync(archive, 'synthetic-sensitive-content');
  for (const args of [[], ['verify'], ['restore', '--archive', archive, '--sha256', '0'.repeat(64)],
    ['verify', '--archive', archive, '--archive', archive, '--sha256', '0'.repeat(64)], ['verify', '--url', 'https://example.com']]) {
    const result = spawnSync(process.execPath, [join(ROOT, 'scripts/history.mjs'), ...args], {encoding: 'utf8'});
    assert.notEqual(result.status, 0); assert.ok(!(result.stdout + result.stderr).includes('synthetic-sensitive-content'));
  }
});
