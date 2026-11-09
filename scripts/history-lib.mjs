// Offline cumulative deployment snapshots. No credentials, network or publishing.
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, parse, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync, gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertRegularFile, PACKAGE_FILES } from './lib.mjs';
import { contentHash, json, tree, validId, verifySite } from './site-lib.mjs';
import { verifyCloudflare } from './cloudflare-lib.mjs';

const LIMIT = 256 * 1024 * 1024;
const HASH = /^[a-f0-9]{64}$/;
const KIND = 'cosmic-stream-scenes-history-backup';
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function check(ok, message) { if (!ok) throw new Error(message); }
// Check every ancestor, not just the final component. Do not follow output symlinks.
export function safeLocation(path) {
  path = resolve(path);
  let current = parse(path).root;
  for (const part of path.slice(current.length).split(/[\\/]/).filter(Boolean)) {
    current = join(current, part);
    try { check(!lstatSync(current).isSymbolicLink(), 'Symlink path refused'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return path;
}
function safePath(path) {
  return typeof path === 'string' && path.split('/').every(part =>
    /^[A-Za-z0-9_.-]+$/.test(part) && !['.', '..'].includes(part) && !part.endsWith('.') &&
    !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part));
}
function allowed(path) { return safePath(path) && (path === 'snapshot.json' || /^(site|cf-dist)(\/|$)/.test(path)); }
function records(root) {
  return ['cf-dist', 'site'].flatMap(folder => tree(join(root, folder)).map(file => {
    const path = `${folder}/${file}`;
    assertRegularFile(root, path);
    const data = readFileSync(join(root, path));
    return {path, bytes: data.length, sha256: contentHash(data)};
  }));
}
export function verifyHistory(root, snapshot) {
  safeLocation(root);
  const site = verifySite(join(root, 'site')), cf = verifyCloudflare(join(root, 'cf-dist'));
  check(same(site, cf), 'Site and Cloudflare selections/history differ');
  // The hosting copy must be byte-identical, not just share its release IDs.
  for (const path of tree(join(root, 'site'))) {
    check(readFileSync(join(root, 'site', path)).equals(readFileSync(join(root, 'cf-dist', path))), 'Hosting copy differs');
  }
  const catalog = records(root);
  if (snapshot) {
    check(snapshot.schemaVersion === 1 && snapshot.kind === KIND && snapshot.productionApproved === false, 'Invalid snapshot metadata');
    check(snapshot.currentRelease === site.current && same(snapshot.retainedReleases, site.releases), 'Snapshot selection/history differs');
    check(Array.isArray(snapshot.records), 'Missing snapshot catalog');
    // Compare by path without locale-dependent sorting or accepting duplicate records.
    const expected = new Map(catalog.map(record => [record.path, record]));
    check(snapshot.records.length === expected.size, 'Catalog count differs');
    for (const record of snapshot.records) {
      check(record && allowed(record.path) && Number.isSafeInteger(record.bytes) && record.bytes >= 0 && HASH.test(record.sha256), 'Invalid catalog record');
      check(same(record, expected.get(record.path)), 'Catalog bytes/hash differs');
      expected.delete(record.path);
    }
    check(expected.size === 0, 'Incomplete catalog');
  }
  return {...site, records: catalog};
}

// Strict ustar subset: no extension headers, links, devices, unsafe paths or permissions.
// Parse and validate the entire archive before writing any member to disk.
export function decodeTar(tar) {
  check(tar.length <= LIMIT && tar.length % 512 === 0, 'Archive size/alignment refused');
  const files = new Map(), directories = new Set(), names = new Set();
  let offset = 0, ended = false;
  const field = (header, start, length) => {
    const bytes = header.subarray(start, start + length), zero = bytes.indexOf(0);
    check(zero < 0 || bytes.subarray(zero).every(byte => byte === 0), 'Invalid tar string');
    return bytes.subarray(0, zero < 0 ? length : zero).toString('utf8');
  };
  const octal = bytes => {
    const text = bytes.toString('ascii').replace(/[\0 ]+$/g, '').replace(/^ +/, '');
    check(/^[0-7]+$/.test(text), 'Invalid tar number');
    const value = Number.parseInt(text, 8);
    check(Number.isSafeInteger(value), 'Oversized tar number');
    return value;
  };
  while (offset + 512 <= tar.length) {
    const h = tar.subarray(offset, offset + 512); offset += 512;
    if (h.every(byte => byte === 0)) {
      check(tar.length - offset >= 512 && tar.subarray(offset).every(byte => byte === 0), 'Invalid tar terminator');
      ended = true; break;
    }
    check(h.subarray(257, 265).equals(Buffer.from('ustar\0' + '00')), 'Only ustar archives are supported');
    const sum = [...h].reduce((n, byte, i) => n + (i >= 148 && i < 156 ? 32 : byte), 0);
    check(sum === octal(h.subarray(148, 156)), 'Tar checksum mismatch');
    const type = h[156], directory = type === 53;
    check(directory || type === 48 || type === 0, 'Nonregular tar member refused');
    check(field(h, 157, 100) === '', 'Tar link refused');
    const prefix = field(h, 345, 155), name = field(h, 0, 100);
    let path = prefix ? `${prefix}/${name}` : name;
    if (directory && path.endsWith('/')) path = path.slice(0, -1);
    check(allowed(path) && !(directory && path === 'snapshot.json'), 'Unsafe/unknown archive path');
    check(!names.has(path.toLowerCase()), 'Duplicate/case-colliding archive member');
    names.add(path.toLowerCase());
    check(names.size <= 40001, 'Too many archive members');
    const size = octal(h.subarray(124, 136));
    check(!directory || size === 0, 'Nonempty tar directory');
    const end = offset + size, padded = offset + Math.ceil(size / 512) * 512;
    check(padded <= tar.length, 'Truncated archive');
    check(tar.subarray(end, padded).every(byte => byte === 0), 'Nonzero tar padding');
    if (directory) directories.add(path); else files.set(path, tar.subarray(offset, end));
    offset = padded;
  }
  check(ended && files.has('snapshot.json'), 'Missing archive terminator/snapshot');
  const ancestors = new Set();
  for (const path of files.keys()) {
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) ancestors.add(parts.slice(0, i).join('/'));
  }
  check([...directories].every(path => ancestors.has(path)), 'Unknown archive directory');
  check([...files.keys()].every(path => !ancestors.has(path)), 'File/directory collision');
  return files;
}
export function encodeTar(files) {
  const chunks = [];
  for (const [path, data] of files) {
    check(allowed(path), 'Unsafe archive path');
    let name = path, prefix = '';
    if (Buffer.byteLength(name) > 100) {
      const slash = path.lastIndexOf('/'); prefix = path.slice(0, slash); name = path.slice(slash + 1);
    }
    check(Buffer.byteLength(name) <= 100 && Buffer.byteLength(prefix) <= 155, 'Ustar path limit exceeded');
    const h = Buffer.alloc(512);
    const octal = (value, start, length) => {
      const text = value.toString(8).padStart(length - 1, '0');
      check(text.length < length, 'Ustar numeric limit exceeded'); h.write(text, start, 'ascii');
    };
    h.write(name); octal(0o644, 100, 8); octal(0, 108, 8); octal(0, 116, 8);
    octal(data.length, 124, 12); octal(0, 136, 12); h.fill(32, 148, 156); h[156] = 48;
    h.write('ustar\0' + '00', 257, 'ascii'); h.write(prefix, 345);
    const sum = [...h].reduce((a, b) => a + b, 0);
    h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 'ascii');
    chunks.push(h, data, Buffer.alloc((512 - data.length % 512) % 512));
  }
  chunks.push(Buffer.alloc(1024));
  const tar = Buffer.concat(chunks);
  check(tar.length <= LIMIT, 'History archive exceeds safety limit; do not prune history');
  return tar;
}
function unpack(bytes, pin, root) {
  check(HASH.test(pin) && contentHash(bytes) === pin, 'Pinned archive digest mismatch');
  const files = decodeTar(gunzipSync(bytes, {maxOutputLength: LIMIT}));
  const snapshot = JSON.parse(files.get('snapshot.json').toString('utf8'));
  check(Array.isArray(snapshot.records), 'Missing snapshot catalog');
  check(files.size === snapshot.records.length + 1, 'Unexpected archive file count');
  const seen = new Set();
  for (const record of snapshot.records) {
    check(record && typeof record.path === 'string' && /^(site|cf-dist)\//.test(record.path) && !seen.has(record.path), 'Invalid/duplicate catalog path');
    const data = files.get(record.path);
    check(data && data.length === record.bytes && contentHash(data) === record.sha256, 'Archive catalog integrity failed');
    seen.add(record.path);
  }
  for (const [path, data] of files) {
    const dest = join(root, path); mkdirSync(dirname(dest), {recursive: true, mode: 0o755});
    writeFileSync(dest, data, {flag: 'wx', mode: 0o644});
  }
  return verifyHistory(root, snapshot);
}
function archiveBytes(path) {
  safeLocation(path); check(lstatSync(path).isFile() && lstatSync(path).size <= LIMIT, 'Archive file/size refused');
  return readFileSync(path);
}
export function inspectArchive(archive, pin, callback = () => {}) {
  const stage = mkdtempSync(join(tmpdir(), 'obs3d-history-'));
  try { const verified = unpack(archiveBytes(archive), pin, stage); callback(stage, verified); return verified; }
  finally { rmSync(stage, {recursive: true, force: true}); }
}
function inside(parent, child) {
  const rel = relative(resolve(parent), resolve(child));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}
export function snapshotHistory(root, output) {
  safeLocation(root); safeLocation(output);
  check(!['site', 'cf-dist'].some(folder => inside(join(root, folder), output)), 'Backup must be outside deployment trees');
  check(!existsSync(output), 'Refusing to overwrite retained backup');
  const verified = verifyHistory(root);
  const snapshot = {schemaVersion: 1, kind: KIND, createdAt: new Date().toISOString(), productionApproved: false,
    currentRelease: verified.current, retainedReleases: verified.releases, records: verified.records};
  const files = new Map(verified.records.map(record => [record.path, readFileSync(join(root, record.path))]));
  files.set('snapshot.json', Buffer.from(json(snapshot)));
  const bytes = gzipSync(encodeTar(files), {level: 9}), pin = contentHash(bytes);
  const stage = mkdtempSync(join(tmpdir(), 'obs3d-history-check-'));
  try { unpack(bytes, pin, stage); } finally { rmSync(stage, {recursive: true, force: true}); }
  mkdirSync(dirname(output), {recursive: true});
  writeFileSync(output, bytes, {flag: 'wx', mode: 0o644});
  // Re-read the stored artifact, not only the memory buffer.
  inspectArchive(output, pin);
  return {sha256: pin, current: verified.current, releases: verified.releases, records: verified.records.length};
}
export function restoreHistory(archive, pin, destination) {
  safeLocation(destination); mkdirSync(destination, {recursive: true});
  return inspectArchive(archive, pin, (stage, verified) => {
    // Preflight BOTH folders before installing either. Existing differing history is never replaced.
    for (const folder of ['site', 'cf-dist']) {
      const target = join(destination, folder); safeLocation(target);
      if (existsSync(target)) {
        const actual = tree(target).map(path => `${folder}/${path}`);
        const expected = verified.records.filter(record => record.path.startsWith(folder + '/'));
        check(same(actual, expected.map(record => record.path)), 'Existing history catalog differs');
        for (const record of expected) check(contentHash(readFileSync(join(destination, record.path))) === record.sha256, 'Existing history bytes differ');
      }
    }
    // Copy into a sibling staging folder so installation uses same-filesystem renames.
    const local = mkdtempSync(join(destination, '.history-stage-'));
    try {
      for (const folder of ['site', 'cf-dist']) {
        if (existsSync(join(destination, folder))) continue;
        for (const path of tree(join(stage, folder))) {
          const target = join(local, folder, path); mkdirSync(dirname(target), {recursive: true});
          copyFileSync(join(stage, folder, path), target);
        }
      }
      for (const folder of ['site', 'cf-dist']) if (existsSync(join(local, folder))) renameSync(join(local, folder), join(destination, folder));
      verifyHistory(destination);
    } finally { rmSync(local, {recursive: true, force: true}); }
  });
}
export function prepareHistory({root, archive, pin, release, output}) {
  safeLocation(root); safeLocation(output);
  check(!existsSync(output), 'Preparation output must not already exist');
  check(release === 'source' || validId(release), 'Explicit current selection required');
  // Keep the bundle entirely outside the source checkout (and vice versa).
  check(!inside(output, root) && !inside(root, output), 'Unsafe preparation destination');
  // Authenticate/validate the archive before creating an output staging directory.
  const prior = inspectArchive(archive, pin);
  check(release === 'source' || prior.releases.includes(release), 'Selected release is not retained');
  mkdirSync(dirname(output), {recursive: true});
  const stage = mkdtempSync(join(dirname(output), '.history-prepare-'));
  try {
    for (const path of [...PACKAGE_FILES, 'package.json']) {
      assertRegularFile(root, path);
      const target = join(stage, path); mkdirSync(dirname(target), {recursive: true}); copyFileSync(join(root, path), target);
    }
    restoreHistory(archive, pin, stage);
    const args = [join(dirname(fileURLToPath(import.meta.url)), 'cloudflare.mjs'), 'build', '--root', stage];
    if (release !== 'source') args.push('--release', release);
    execFileSync(process.execPath, args, {stdio: 'pipe', env: {...process.env, OBS3DSP_ROOT: stage}});
    const next = verifyHistory(stage);
    check(prior.releases.every(id => next.releases.includes(id)), 'Preparation dropped history');
    for (const record of prior.records.filter(record => record.path.includes('/releases/'))) {
      check(contentHash(readFileSync(join(stage, record.path))) === record.sha256, 'Preparation changed a pinned file');
    }
    const backup = snapshotHistory(stage, join(stage, 'history.tar.gz'));
    writeFileSync(join(stage, 'preparation.json'), json({schemaVersion: 1, preparationOnly: true, productionApproved: false,
      inputArchiveSha256: pin, requestedCurrent: release, currentRelease: next.current,
      retainedReleases: next.releases, outputArchiveSha256: backup.sha256, records: backup.records}));
    // A complete isolated bundle appears only after restore/build/snapshot/restore-check succeed.
    check(!existsSync(output), 'Preparation output appeared concurrently'); renameSync(stage, output);
    return backup;
  } finally { rmSync(stage, {recursive: true, force: true}); }
}
