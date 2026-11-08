// Tests for runtime/overlay.js startClock (overlay clock).
// Dependency-free: node:test + node:assert/strict + node:module only.
// All window timers, Date, and Intl are faked; no real waiting.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const createOverlay = require('../runtime/overlay.js');

function makeFakeDateClass(controller) {
  class FakeDate {
    constructor(...args) {
      if (args.length === 0) {
        this.ts = controller.timestamp;
        this.tz = controller.tzOffset;
      } else if (typeof args[0] === 'number') {
        this.ts = args[0];
        this.tz = controller.tzOffset;
      } else if (args[0] instanceof FakeDate) {
        this.ts = args[0].ts;
        this.tz = args[0].tz;
      } else {
        this.ts = controller.timestamp;
        this.tz = controller.tzOffset;
      }
    }
    getTime() { return this.ts; }
    getTimezoneOffset() { return this.tz; }
    toLocaleString() { return 'LOCALE_' + this.ts; }
  }
  return FakeDate;
}

function makeIntl(opts) {
  opts = opts || {};
  const {
    constructorThrows = false,
    dateConstructorThrows = false,
    tzConstructorThrows = false,
    formatToParts = 'present',
    formatToPartsThrows = false,
    tzLabel = 'TZLABEL',
  } = opts;

  function DateTimeFormat(locale, options) {
    const isTz = !!(options && options.timeZoneName);
    if (constructorThrows) throw new Error('constructor boom');
    if (isTz && tzConstructorThrows) throw new Error('tz constructor boom');
    if (!isTz && dateConstructorThrows) throw new Error('date constructor boom');

    const inst = {
      format: (d) => 'DATE_' + d.getTime(),
    };
    if (isTz && formatToParts === 'present') {
      inst.formatToParts = (d) => {
        if (formatToPartsThrows) throw new Error('parts boom');
        return [{ type: 'timeZoneName', value: tzLabel }];
      };
    }
    return inst;
  }
  return { DateTimeFormat };
}

function makeSetIntervalRecorder() {
  const calls = [];
  const fn = (cb, delay) => {
    calls.push({ callback: cb, delay });
    return calls.length;
  };
  return { fn, calls };
}

function setup(opts) {
  opts = opts || {};
  const controller = {
    timestamp: opts.timestamp !== undefined ? opts.timestamp : 1000,
    tzOffset: opts.tzOffset !== undefined ? opts.tzOffset : 0,
  };
  const FakeDate = makeFakeDateClass(controller);
  const rec = makeSetIntervalRecorder();
  const cleared = [];
  const clearFn = (t) => cleared.push(t);

  let intl;
  if (opts.intlAbsent) {
    intl = undefined;
  } else if (opts.intlOverride !== undefined) {
    intl = opts.intlOverride;
  } else {
    intl = makeIntl(opts.intlOpts || {});
  }

  const win = {
    Date: FakeDate,
    Intl: intl,
    setInterval: rec.fn,
    clearInterval: clearFn,
  };
  const doc = {};
  const overlay = createOverlay(win, doc);
  const element = { textContent: '' };
  return { overlay, element, controller, rec, cleared, win, doc };
}

test('startClock immediately updates text and schedules exactly a 1000ms interval', () => {
  const { overlay, element, rec } = setup({ timestamp: 5000, intlOpts: { tzLabel: 'EST' } });
  const stop = overlay.startClock(element);
  assert.equal(element.textContent, 'DATE_5000 EST');
  assert.equal(rec.calls.length, 1);
  assert.equal(rec.calls[0].delay, 1000);
  assert.equal(typeof rec.calls[0].callback, 'function');
  stop();
});

test('repeated interval ticks use the current date each time', () => {
  const { overlay, element, controller, rec } = setup({ timestamp: 1000, intlOpts: { tzLabel: 'EST' } });
  const stop = overlay.startClock(element);
  assert.equal(element.textContent, 'DATE_1000 EST');

  controller.timestamp = 2000;
  rec.calls[0].callback();
  assert.equal(element.textContent, 'DATE_2000 EST');

  controller.timestamp = 3000;
  rec.calls[0].callback();
  assert.equal(element.textContent, 'DATE_3000 EST');

  stop();
});

test('uses timeZoneName from formatToParts as the timezone label', () => {
  const { overlay, element } = setup({ timestamp: 7000, intlOpts: { tzLabel: 'PDT' } });
  overlay.startClock(element);
  assert.equal(element.textContent, 'DATE_7000 PDT');
});

test('falls back to UTC offset when Intl is absent', () => {
  const { overlay, element } = setup({ timestamp: 8000, intlAbsent: true, tzOffset: 0 });
  overlay.startClock(element);
  assert.equal(element.textContent, 'LOCALE_8000 UTC+00:00');
});

test('falls back to UTC offset when DateTimeFormat constructor throws', () => {
  const { overlay, element } = setup({ timestamp: 9000, intlOpts: { constructorThrows: true }, tzOffset: -330 });
  overlay.startClock(element);
  assert.equal(element.textContent, 'LOCALE_9000 UTC+05:30');
});

test('falls back to UTC offset when formatToParts is absent', () => {
  const { overlay, element } = setup({ timestamp: 10000, intlOpts: { formatToParts: 'absent' }, tzOffset: 210 });
  overlay.startClock(element);
  assert.equal(element.textContent, 'DATE_10000 UTC-03:30');
});

test('falls back to UTC offset when formatToParts throws', () => {
  const { overlay, element } = setup({ timestamp: 11000, intlOpts: { formatToPartsThrows: true }, tzOffset: 60 });
  overlay.startClock(element);
  assert.equal(element.textContent, 'DATE_11000 UTC-01:00');
});

test('fallback UTC offset supports positive and negative half-hours', () => {
  const pos = setup({ timestamp: 1, intlAbsent: true, tzOffset: -90 });
  pos.overlay.startClock(pos.element);
  assert.equal(pos.element.textContent, 'LOCALE_1 UTC+01:30');

  const neg = setup({ timestamp: 2, intlAbsent: true, tzOffset: 90 });
  neg.overlay.startClock(neg.element);
  assert.equal(neg.element.textContent, 'LOCALE_2 UTC-01:30');
});

test('startClock with missing element sets no timer and returns a no-op', () => {
  const { overlay, rec, cleared } = setup({});
  const stop = overlay.startClock(null);
  assert.equal(typeof stop, 'function');
  assert.equal(rec.calls.length, 0);
  stop();
  assert.equal(cleared.length, 0);

  const stop2 = overlay.startClock(undefined);
  assert.equal(typeof stop2, 'function');
  assert.equal(rec.calls.length, 0);
});

test('returned stop function clears the timer once and is idempotent', () => {
  const { overlay, element, rec, cleared } = setup({});
  const stop = overlay.startClock(element);
  assert.equal(rec.calls.length, 1);
  const handle = 1;

  stop();
  assert.deepEqual(cleared, [handle]);

  stop();
  assert.deepEqual(cleared, [handle]);
});
