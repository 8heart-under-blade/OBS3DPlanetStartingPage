import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { repoRoot } from '../scripts/lib.mjs';

const require = createRequire(import.meta.url);
const createDrafts = require('../runtime/drafts.js');
const createSnapshots = require('../runtime/snapshots.js');

const KEY = 'obs3dplanet.editor.draft.v1';

function makeStorage({ initial = {}, throwGet = false, throwSet = false, throwRemove = false } = {}) {
  const data = new Map(Object.entries(initial));
  const calls = { getItem: [], setItem: [], removeItem: [], clear: [] };
  const storage = {
    _data: data,
    _calls: calls,
    getItem(key) {
      calls.getItem.push(key);
      if (throwGet) throw new Error('getter blocked');
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      calls.setItem.push([key, value]);
      if (throwSet) throw new Error('quota exceeded');
      data.set(key, value);
    },
    removeItem(key) {
      calls.removeItem.push(key);
      if (throwRemove) throw new Error('remove blocked');
      data.delete(key);
    },
    clear() {
      calls.clear.push(true);
      data.clear();
    },
  };
  return storage;
}

function snapshot() {
  const snapshots = createSnapshots();
  return snapshots.defaults();
}

test('factory exposes only the draft contract methods', () => {
  const drafts = createDrafts(makeStorage(), createSnapshots());
  assert.equal(typeof drafts.load, 'function');
  assert.equal(typeof drafts.save, 'function');
  assert.equal(typeof drafts.clear, 'function');
  assert.deepEqual(Object.keys(drafts).sort(), ['clear', 'load', 'save']);
});

test('roundtrips a canonical snapshot without mutating input', () => {
  const snapshots = createSnapshots();
  const storage = makeStorage();
  const drafts = createDrafts(storage, snapshots);
  const input = snapshots.defaults();
  const before = JSON.stringify(input);

  const saved = drafts.save(input);
  assert.equal(saved.ok, true);
  assert.equal(saved.warning, '');
  assert.equal(JSON.stringify(input), before, 'save must not mutate input');

  const raw = storage._data.get(KEY);
  assert.equal(raw, snapshots.stringify(input), 'must store canonical validated JSON');

  const loaded = drafts.load();
  assert.equal(loaded.warning, '');
  assert.notEqual(loaded.snapshot, input);
  assert.deepEqual(loaded.snapshot, snapshots.parse(raw));
  assert.equal(JSON.stringify(loaded.snapshot), snapshots.stringify(input));

  const cleared = drafts.clear();
  assert.equal(cleared.ok, true);
  assert.equal(cleared.warning, '');
  assert.equal(storage._data.has(KEY), false);
  assert.equal(drafts.load().snapshot, null);
});

test('load returns null with no warning when no draft exists', () => {
  const drafts = createDrafts(makeStorage(), createSnapshots());
  assert.deepEqual(drafts.load(), { snapshot: null, warning: '' });
});

test('blocked or throwing storage is handled without clear or other-key erasure', () => {
  const storage = makeStorage({ initial: { other: 'keep' }, throwGet: true });
  const drafts = createDrafts(storage, createSnapshots());
  assert.deepEqual(drafts.load(), { snapshot: null, warning: 'storage-unavailable' });
  assert.equal(storage._data.get('other'), 'keep');

  const blocked = createDrafts(null, createSnapshots());
  assert.equal(blocked.load().snapshot, null);
  assert.ok(blocked.load().warning);
  assert.equal(blocked.save(snapshot()).ok, false);
  assert.equal(blocked.clear().ok, false);
  assert.ok(!storage._calls.clear.length);
});

test('quota failure returns failure and does not report success', () => {
  const storage = makeStorage({ throwSet: true });
  const drafts = createDrafts(storage, createSnapshots());
  const result = drafts.save(snapshot());
  assert.equal(result.ok, false);
  assert.equal(result.warning, 'storage-quota-exceeded');
  assert.equal(storage._data.has(KEY), false);
});

test('remove failure is reported and does not throw', () => {
  const storage = makeStorage({ throwRemove: true });
  const drafts = createDrafts(storage, createSnapshots());
  const result = drafts.clear();
  assert.equal(result.ok, false);
  assert.ok(result.warning);
});

test('invalid, corrupt, and oversize stored JSON is rejected without erasing', () => {
  const snapshots = createSnapshots();
  for (const raw of ['{bad json', '{"schemaVersion":2}', 'null', JSON.stringify({schemaVersion: 1, secret: 'x'}), 'x'.repeat(9000)]) {
    const storage = makeStorage({ initial: { [KEY]: raw, other: 'keep' } });
    const drafts = createDrafts(storage, snapshots);
    const result = drafts.load();
    assert.equal(result.snapshot, null, raw.slice(0, 40));
    assert.ok(result.warning, raw.slice(0, 40));
    assert.equal(storage._data.get('other'), 'keep', 'other keys must remain');
    assert.equal(storage._data.has(KEY), true, 'invalid draft must not be auto-erased');
  }
});

test('unknown or secret fields are rejected and never written', () => {
  const snapshots = createSnapshots();
  const storage = makeStorage();
  const drafts = createDrafts(storage, snapshots);
  const bad = Object.assign({}, snapshots.defaults(), { password: 'secret', token: 'abc', url: 'https://example.test' });
  const result = drafts.save(bad);
  assert.equal(result.ok, false);
  assert.ok(result.warning);
  assert.equal(storage._data.has(KEY), false);
  assert.ok(!result.warning.includes('secret'));
  assert.ok(!result.warning.includes('abc'));
  assert.ok(!result.warning.includes('example.test'));
});

test('schema version 0 stored drafts migrate through snapshots.parse', () => {
  const snapshots = createSnapshots();
  const oldDraft = { schemaVersion: 0, title: 'OLD TITLE', subtitle: 'OLD SUB', quality: 'low' };
  const storage = makeStorage({ initial: { [KEY]: JSON.stringify(oldDraft) } });
  const drafts = createDrafts(storage, snapshots);
  const loaded = drafts.load();
  assert.equal(loaded.warning, '');
  assert.equal(loaded.snapshot.schemaVersion, 1);
  assert.equal(loaded.snapshot.scenes.starting.title, 'OLD TITLE');
  assert.equal(loaded.snapshot.scenes.starting.subtitle, 'OLD SUB');
  assert.equal(loaded.snapshot.quality, 'low');
});

test('clear removes only the draft key and preserves siblings', () => {
  const storage = makeStorage({ initial: { [KEY]: JSON.stringify(snapshot()), sibling: 'value' } });
  const drafts = createDrafts(storage, createSnapshots());
  const result = drafts.clear();
  assert.equal(result.ok, true);
  assert.equal(result.warning, '');
  assert.equal(storage._data.has(KEY), false);
  assert.equal(storage._data.get('sibling'), 'value');
  assert.deepEqual(storage._calls.removeItem, [KEY]);
  assert.equal(storage._calls.clear.length, 0);
});

test('warnings never echo raw stored or submitted values', () => {
  const secret = 'super-secret-value-123';
  const storage = makeStorage({ initial: { [KEY]: '{"schemaVersion":1,"secret":"' + secret + '"}' } });
  const drafts = createDrafts(storage, createSnapshots());
  const loaded = drafts.load();
  assert.ok(loaded.warning);
  assert.ok(!loaded.warning.includes(secret));

  const storage2 = makeStorage();
  const drafts2 = createDrafts(storage2, createSnapshots());
  const saved = drafts2.save({ schemaVersion: 1, secret });
  assert.equal(saved.ok, false);
  assert.ok(saved.warning);
  assert.ok(!saved.warning.includes(secret));
});

test('browser wrapper catches a throwing localStorage getter', () => {
  const source = readFileSync(join(repoRoot(), 'runtime', 'drafts.js'), 'utf8');
  const window = {
    StreamSnapshots: createSnapshots(),
  };
  Object.defineProperty(window, 'localStorage', {
    get() { throw new Error('localStorage blocked'); },
  });
  const context = vm.createContext({ window, console });
  vm.runInContext(source, context);
  assert.ok(window.StreamDrafts, 'wrapper should create StreamDrafts');
  assert.equal(typeof window.StreamDrafts.load, 'function');
  const result = window.StreamDrafts.load();
  assert.equal(result.snapshot, null);
  assert.ok(result.warning);
});

test('browser wrapper uses provided snapshots and storage', () => {
  const source = readFileSync(join(repoRoot(), 'runtime', 'drafts.js'), 'utf8');
  const storage = makeStorage();
  const snapshots = createSnapshots();
  const window = { localStorage: storage, StreamSnapshots: snapshots };
  const context = vm.createContext({ window, console });
  vm.runInContext(source, context);
  assert.equal(window.StreamDrafts.save(snapshots.defaults()).ok, true);
  assert.equal(window.StreamDrafts.load().snapshot.schemaVersion, 1);
});