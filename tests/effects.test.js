import test from 'node:test';
import assert from 'node:assert/strict';
import { createEffects } from '../apps/web/src/browser/effects.js';

function environment(t, navigator = {}) {
  const contexts = [], calls = [], gains = [], notices = [], intervals = new Map();
  let blocked = false;
  class Audio {
    constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = {}; contexts.push(this); }
    async resume() {
      if (blocked || this.state === 'closed') throw new Error('Cannot resume');
      this.state = 'running';
      this.onstatechange?.();
    }
    async close() { this.state = 'closed'; this.onstatechange?.(); }
    createOscillator() {
      const oscillator = {
        frequency: { value: 0 }, connect() {}, disconnect() {},
        start(at) { calls.push({ op: 'start', at, frequency: oscillator.frequency.value }); },
        stop(at) { calls.push({ op: 'stop', at, frequency: oscillator.frequency.value }); }
      };
      return oscillator;
    }
    createGain() {
      const events = [];
      gains.push(events);
      return { gain: {
        setValueAtTime(value, at) { events.push({ op: 'set', value, at }); },
        linearRampToValueAtTime(value, at) { events.push({ op: 'linear', value, at }); },
        exponentialRampToValueAtTime(value, at) { events.push({ op: 'exponential', value, at }); }
      }, connect() {}, disconnect() {} };
    }
  }
  const document = { hidden: false };
  const values = { window: { AudioContext: Audio }, navigator, document,
    setInterval: fn => { const id = {}; intervals.set(id, fn); return id; }, clearInterval: id => intervals.delete(id) };
  const originals = Object.fromEntries(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  t.after(() => {
    for (const key of Object.keys(values)) {
      if (originals[key]) Object.defineProperty(globalThis, key, originals[key]);
      else delete globalThis[key];
    }
  });
  return { contexts, calls, gains, notices, intervals, document, window: values.window,
    block: value => { blocked = value; }, run: () => [...intervals.values()].forEach(fn => fn()),
    effects: createEffects(text => notices.push(text)) };
}

test('effects tempo schedules phase intervals and skips missed phases without a burst', async t => {
  const e = environment(t);
  await e.effects.activateAudio();
  const context = e.contexts[0];
  e.effects.startTempo([2, 1, 1]);
  context.currentTime = 2; e.run();
  context.currentTime = 3; e.run();
  assert.deepEqual(e.calls.filter(c => c.op === 'start'), [
    { op: 'start', at: 0.04, frequency: 520 },
    { op: 'start', at: 2.04, frequency: 520 },
    { op: 'start', at: 3.04, frequency: 880 }
  ]);
  context.currentTime = 5.5; e.run();
  assert.equal(e.calls.filter(c => c.op === 'start').length, 3);
  context.currentTime = 6; e.run();
  assert.equal(e.calls.filter(c => c.op === 'start').at(-1).at, 6.04);
  e.effects.stopTempo();
  assert.equal(e.intervals.size, 0);
});

test('effects closed audio context can be replaced and reactivated', async t => {
  const e = environment(t);
  await e.effects.activateAudio();
  await e.contexts[0].close();
  await e.effects.activateAudio();
  assert.equal(e.effects.audioRunning, true);
  assert.equal(e.contexts.length, 2);
});

test('effects missing and refused audio activation report failures and allow retry', async t => {
  const e = environment(t);
  e.block(true);
  await e.effects.activateAudio();
  assert.equal(e.effects.audioRunning, false);
  assert.ok(e.notices.at(-1).includes('활성화하지 못했습니다'));
  e.block(false);
  await e.effects.activateAudio();
  assert.equal(e.effects.audioRunning, true);
  delete e.window.AudioContext;
  const missing = createEffects(text => e.notices.push(text));
  await missing.activateAudio();
  assert.ok(e.notices.at(-1).includes('지원하지 않습니다'));
});

test('effects countdown and rest tones use distinct frequencies and durations', async t => {
  const e = environment(t);
  await e.effects.activateAudio();
  e.effects.beep();
  e.effects.beep('rest');
  assert.deepEqual(e.calls.filter(c => c.op === 'start').map(c => c.frequency), [760, 1040, 1040]);
  assert.ok(Math.abs(e.calls[1].at - e.calls[0].at - 0.19) < 1e-9);
  assert.ok(Math.abs(e.calls[3].at - e.calls[2].at - 0.26) < 1e-9);
  assert.ok(Math.abs(e.calls[4].at - e.calls[2].at - 0.37) < 1e-9);
});

test('effects audible envelopes use boosted levels and fade to silence', async t => {
  const e = environment(t);
  await e.effects.activateAudio();
  e.effects.startTempo([1]);
  e.effects.beep();
  e.effects.beep('rest');
  for (const events of e.gains) {
    const attack = events[1], hold = events[2], release = events[3];
    assert.ok(attack.value >= 0.8 && attack.value <= 1);
    assert.equal(hold.value, attack.value);
    assert.ok(hold.at - attack.at >= 0.06);
    assert.equal(release.value, 0);
    assert.ok(release.at > hold.at);
  }
  assert.deepEqual(e.gains.map(events => events[1].value), [0.8, 0.9, 1, 1]);
  e.effects.stopTempo();
  assert.equal(e.calls.filter(c => c.op === 'stop' && c.at === undefined).length, 4);
});

test('effects rest alarm repeats until stopped, deduplicates starts and skips missed cycles', async t => {
  const e = environment(t);
  await e.effects.activateAudio();
  e.effects.startRestAlarm();
  e.effects.startRestAlarm();
  assert.equal(e.intervals.size, 1);
  assert.equal(e.calls.filter(c => c.op === 'start').length, 2);
  e.contexts[0].currentTime = 1.1; e.run();
  assert.equal(e.calls.filter(c => c.op === 'start').length, 4);
  e.contexts[0].currentTime = 8; e.run();
  assert.equal(e.calls.filter(c => c.op === 'start').length, 6);
  assert.equal(e.calls.filter(c => c.op === 'start').at(-2).at, 8.01);
  e.effects.stopRestAlarm();
  assert.equal(e.intervals.size, 0);
  e.contexts[0].currentTime = 10; e.run();
  assert.equal(e.calls.filter(c => c.op === 'start').length, 6);
});

test('effects rest alarm pauses when unavailable or hidden and stop clears all effects', async t => {
  const e = environment(t);
  e.effects.startRestAlarm();
  assert.equal(e.intervals.size, 0);
  await e.effects.activateAudio();
  e.document.hidden = true;
  e.effects.startRestAlarm();
  assert.equal(e.calls.length, 0);
  e.document.hidden = false;
  e.effects.startRestAlarm();
  e.effects.stop();
  assert.equal(e.intervals.size, 0);
  assert.equal(e.calls.filter(c => c.op === 'stop' && c.at === undefined).length, 2);
});

test('effects vibration exceptions cannot interrupt workout progress', t => {
  const e = environment(t, { vibrate() { throw new Error('Unsupported device'); } });
  assert.doesNotThrow(() => e.effects.vibrate());
});

test('effects hidden pages suppress audio and vibration and release wake lock', async t => {
  let vibrations = 0, requests = 0, releases = 0;
  const e = environment(t, { vibrate() { vibrations++; }, wakeLock: { async request() { requests++; return { async release() { releases++; }, addEventListener() {} }; } } });
  await e.effects.activateAudio();
  await e.effects.setWakeLock(true);
  e.document.hidden = true;
  e.effects.startTempo([1]); e.effects.beep(); e.effects.vibrate();
  await e.effects.setWakeLock(true);
  assert.equal(e.calls.length, 0);
  assert.equal(vibrations, 0);
  assert.equal(requests, 1);
  assert.equal(releases, 1);
});

test('effects wake lock deduplicates requests and reacquires after release', async t => {
  let requests = 0, releases = 0, released;
  const e = environment(t, { wakeLock: { async request(kind) {
    assert.equal(kind, 'screen'); requests++;
    return { async release() { releases++; released?.(); }, addEventListener(_, fn) { released = fn; } };
  } } });
  await e.effects.setWakeLock(true);
  await e.effects.setWakeLock(true);
  assert.equal(requests, 1);
  released();
  await e.effects.setWakeLock(true);
  assert.equal(requests, 2);
  await e.effects.setWakeLock(false);
  assert.equal(releases, 1);
});

test('effects pending wake request releases its result when workout has ended', async t => {
  let resolve, requests = 0, releases = 0;
  const e = environment(t, { wakeLock: { request() { requests++; return new Promise(done => { resolve = done; }); } } });
  const pending = e.effects.setWakeLock(true);
  await e.effects.setWakeLock(true);
  await e.effects.setWakeLock(false);
  resolve({ async release() { releases++; }, addEventListener() {} });
  await pending;
  assert.equal(requests, 1);
  assert.equal(releases, 1);
});

test('effects missing wake lock and refused request or release remain optional', async t => {
  const e = environment(t, { wakeLock: { async request() { throw new Error('Denied'); } } });
  await e.effects.setWakeLock(true);
  await e.effects.setWakeLock(false);
  delete globalThis.navigator.wakeLock;
  await e.effects.setWakeLock(true);
  globalThis.navigator.wakeLock = { async request() { return { async release() { throw new Error('Release denied'); }, addEventListener() {} }; } };
  await e.effects.setWakeLock(true);
  await e.effects.setWakeLock(false);
});
