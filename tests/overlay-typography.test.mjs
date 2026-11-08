import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { repoRoot } from '../scripts/lib.mjs';
import { restoreAudio } from './helpers/restore-audio.mjs';
import { restoreIntegration } from './helpers/restore-integration.mjs';
const require = createRequire(import.meta.url);
const createOverlay = require('../runtime/overlay.js');
const root = repoRoot();
const read = file => readFileSync(join(root, file), 'utf8');

function fixture({head = true, rootElement = true} = {}) {
  const variables = {}, nodes = [];
  const doc = {
    documentElement: rootElement ? {style: {setProperty: (name, value) => { variables[name] = value; }}} : null,
    head: head ? {appendChild: node => nodes.push(node)} : null,
    createElement: tag => ({tag}),
  };
  const win = {Date, Intl, setInterval() { throw Error('Typography must not start clocks'); }, clearInterval() {}};
  return {api: createOverlay(win, doc), win, doc, variables, nodes};
}

function functionSource(source, name) {
  const start = source.indexOf('  function ' + name + '(');
  assert.ok(start >= 0, name);
  const end = source.indexOf('\n  }\n', start) + 5;
  assert.ok(end > start, name);
  return source.slice(start, end);
}

const helperNames = ['startDateTimeTicker', 'createDateTimeFormatter', 'extractTimeZoneLabel',
  'fallbackTimeZoneLabel', 'pad2', 'applyOverlayTypography', 'setRootCssVariable',
  'normalizeCssValue', 'normalizeFontSource', 'guessFontFormat', 'escapeCssText'];

// Restore the extracted definitions at their original anchors and undo only the
// two call-site substitutions. Matching the pre-P1 byte hashes proves that audio,
// scene math, shaders, lifecycle handlers AND all shared helper bodies are intact.
function restoreOriginal(sceneSource, sharedSource, scene) {
  let source = sceneSource
    .replace('window.StreamOverlay.applyTypography(CONFIG.overlay);', 'applyOverlayTypography(CONFIG.overlay);')
    .replace('window.StreamOverlay.startClock(dateTimeEl);', 'startDateTimeTicker(dateTimeEl);');
  const groups = scene === 'thanks.js' ? [
    [helperNames.slice(0, 9), '\n  function normalizeOptionalUrl('],
    [['guessFontFormat'], '\n  function mergeUniqueStrings('],
    [['escapeCssText'], '})();'],
  ] : [[helperNames, '\n  function pickDefined(']];
  for (const [names, anchor] of groups) {
    assert.ok(source.includes(anchor), scene + ' insertion anchor');
    source = source.replace(anchor, names.map(name => functionSource(sharedSource, name)).join('\n') + anchor);
  }
  return source;
}

test('extraction reconstructs all three original renderers exactly, including unchanged helper bodies', () => {
  const baseline = JSON.parse(read('docs/source-baseline-assets.json'));
  const shared = read('runtime/overlay.js');
  for (const scene of ['main.js', 'brb.js', 'thanks.js']) {
    const current = restoreIntegration(read(scene), scene);
    assert.match(current, /window\.StreamOverlay\.applyTypography\(CONFIG.overlay\)/);
    assert.match(current, /window\.StreamOverlay\.startClock\(dateTimeEl\)/);
    for (const name of helperNames) assert.ok(!current.includes('  function ' + name + '('), scene + ': ' + name);
    for (const dependency of ['pickDefined', 'ensureArray']) {
      assert.equal(functionSource(shared, dependency), functionSource(current, dependency), scene + ': ' + dependency);
    }
    const restored = restoreOriginal(restoreAudio(current, read('tests/fixtures/audio-before-lifecycle.js'), scene), shared, scene);
    const expected = baseline.files.find(file => file.path === scene);
    assert.equal(Buffer.byteLength(restored), expected.bytes, scene);
    assert.equal(createHash('sha256').update(restored).digest('hex'), expected.sha256, scene);
    assert.match(current, /stopDateTimeTicker\(\)/, 'existing unload cleanup remains');
  }
});

test('typography preserves CSS variable names, strings, numeric units and zero values', () => {
  const f = fixture();
  f.api.applyTypography({titleFontFamily: "'Cinzel Decorative', serif", subtitleFontFamily: "'Macondo', serif",
    titleFontWeight: 400, subtitleFontWeight: 400, titleTextTransform: 'uppercase', subtitleTextTransform: 'none',
    overlayTop: 12, overlayTopMobile: ' 6vh ', titleOffsetX: 0, titleOffsetY: -3,
    subtitleOffsetX: 2, subtitleOffsetY: 'calc(1vh + 2px)', titleKerning: 0.06, subtitleKerning: 0});
  assert.deepEqual(f.variables, {
    '--font-title': "'Cinzel Decorative', serif", '--font-subtitle': "'Macondo', serif",
    '--title-weight': '400', '--subtitle-weight': '400', '--title-transform': 'uppercase', '--subtitle-transform': 'none',
    '--overlay-top': '12px', '--overlay-top-mobile': '6vh', '--title-offset-x': '0px', '--title-offset-y': '-3px',
    '--subtitle-offset-x': '2px', '--subtitle-offset-y': 'calc(1vh + 2px)', '--title-kerning': '0.06em', '--subtitle-kerning': '0em',
  });
});

test('missing or unsupported CSS values leave existing defaults alone', () => {
  const f = fixture();
  f.api.applyTypography(null);
  f.api.applyTypography({titleFontFamily: ' ', titleFontWeight: NaN, overlayTop: Infinity,
    titleOffsetX: false, titleKerning: {}, subtitleOffsetY: null});
  assert.deepEqual(f.variables, {});
  assert.deepEqual(f.nodes, []);
});

test('stylesheet strings and valid custom font faces retain the existing insertion behavior', () => {
  const f = fixture();
  f.api.applyTypography({externalFontStylesheets: [' https://example.test/font.css ', '', null, 7],
    customFontFaces: [{family: ' Cinzel Decorative ', src: '@cinzel-decorative.ttf'}, {family: ' ', src: 'ignored.woff'}, null]});
  assert.equal(f.nodes.length, 2);
  assert.deepEqual(f.nodes[0], {tag: 'link', rel: 'stylesheet', href: 'https://example.test/font.css'});
  assert.equal(f.nodes[1].type, 'text/css');
  assert.equal(f.nodes[1].textContent, "@font-face{font-family:'Cinzel Decorative';src:url('cinzel-decorative.ttf') format('truetype');font-style:normal;font-weight:400;font-display:swap;}");
  const single = fixture();
  single.api.applyTypography({externalFontStylesheets: 'font.css', customFontFaces: {family: 'Macondo', src: '@macondo.ttf'}});
  assert.equal(single.nodes[0].href, 'font.css');
  assert.equal(single.nodes.length, 2);
});

test('font sources retain @ handling, extension inference, slash normalization and CSS url passthrough', () => {
  const cases = [
    ['@face.WOFF2?rev=1#font', "url('face.WOFF2?rev=1#font') format('woff2')"],
    ['face.woff', "url('face.woff') format('woff')"],
    ['fonts\\face.ttf', "url('fonts/face.ttf') format('truetype')"],
    ['face.otf', "url('face.otf') format('opentype')"],
    ['face.custom', "url('face.custom')"],
    ["url('custom.woff2') format('woff2')", "url('custom.woff2') format('woff2')"],
  ];
  for (const [src, expected] of cases) {
    const f = fixture();
    f.api.applyTypography({customFontFaces: [{family: 'Example', src}]});
    assert.ok(f.nodes[0].textContent.includes('src:' + expected + ';'), src);
  }
  for (const src of [null, 7, '', ' @ ']) {
    const f = fixture(); f.api.applyTypography({customFontFaces: [{family: 'Example', src}]});
    assert.equal(f.nodes.length, 0);
  }
});

test('custom family apostrophes remain escaped and explicit face settings are preserved', () => {
  const f = fixture();
  f.api.applyTypography({customFontFaces: [{family: "My'Font", src: '@face.ttf', style: 'italic', weight: 700, display: 'block'}]});
  assert.ok(f.nodes[0].textContent.includes("font-family:'My\\'Font';"));
  assert.ok(f.nodes[0].textContent.includes('font-style:italic;font-weight:700;font-display:block;'));
});

test('missing root or head does not prevent the other supported typography work', () => {
  const noRoot = fixture({rootElement: false});
  noRoot.api.applyTypography({titleFontWeight: 400, externalFontStylesheets: 'font.css'});
  assert.equal(noRoot.nodes.length, 1);
  const noHead = fixture({head: false});
  noHead.api.applyTypography({titleFontWeight: 400, externalFontStylesheets: 'font.css'});
  assert.equal(noHead.variables['--title-weight'], '400');
});

test('browser wrapper installs shared overlay methods without starting a timer or modifying DOM', () => {
  const f = fixture();
  vm.runInNewContext(read('runtime/overlay.js'), {window: f.win, document: f.doc});
  assert.equal(typeof f.win.StreamOverlay.applyTypography, 'function');
  assert.equal(typeof f.win.StreamOverlay.startClock, 'function');
  assert.deepEqual(f.nodes, []);
  assert.deepEqual(f.variables, {});
});
