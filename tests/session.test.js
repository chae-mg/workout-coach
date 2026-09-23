import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES } from '../apps/web/src/data/exercises.js';
import { DEFAULT_SETTINGS, clone, resolveExercise } from '../apps/web/src/core/settings.js';
import { createSession, transition, validateSession, remainingSeconds, summarize, totalUnits } from '../apps/web/src/core/session.js';

const exercise = (id, override = {}) => resolveExercise(EXERCISES.find(e => e.id === id), DEFAULT_SETTINGS, override);
const create = (exercises, settings = DEFAULT_SETTINGS) => createSession(exercises, settings, 1000, 'test-session');
const send = (s, type, now = 1000, extra = {}) => {
  const next = transition(s, { type, revision: s.revision, ...extra }, now);
  assert.ok(validateSession(next), `Invalid state after ${type}`);
  return next;
};

test('full sequence credits sets once and uses the appropriate rest duration', () => {
  let s = create([exercise('squat', { sets: 2, restSeconds: 30 }), exercise('push_up', { sets: 1 })]);
  s = send(s, 'COMPLETE_SET', 2000);
  assert.equal(s.status, 'REST');
  assert.equal(s.currentSet, 2);
  assert.equal(s.restEndAt, 32000);
  s = send(s, 'TICK', 32000);
  s = send(s, 'DISMISS_REST_ALARM', 32500);
  s = send(s, 'COMPLETE_SET', 33000);
  assert.equal(s.exerciseIndex, 1);
  assert.equal(s.currentSet, 1);
  assert.equal(s.restEndAt, 153000);
  s = send(s, 'SKIP_REST', 34000);
  s = send(s, 'COMPLETE_SET', 35000);
  assert.equal(s.status, 'COMPLETE');
  assert.equal(s.restEndAt, null);
  assert.deepEqual(summarize(s), { completedSets: 3, skippedSets: 0, completedExercises: 2, completedBlocks: 0, elapsedSeconds: 34 });
  assert.strictEqual(send(s, 'COMPLETE_SET', 36000), s);
});

test('stale completion cannot credit a newly rendered next set with zero rest', () => {
  const original = create([exercise('squat', { sets: 2, restSeconds: 0 })]);
  const event = { type: 'COMPLETE_SET', revision: original.revision };
  const next = transition(original, event, 2000);
  const duplicate = transition(next, event, 2001);
  assert.strictEqual(duplicate, next);
  assert.equal(next.results[0].completed, 1);
  assert.equal(original.results[0].completed, 0);
});

test('skipping an exercise accounts only its remaining sets', () => {
  let s = create([exercise('squat', { sets: 3, restSeconds: 0 }), exercise('crunch', { sets: 1 })], { ...DEFAULT_SETTINGS, betweenExerciseRestSeconds: 0 });
  s = send(s, 'COMPLETE_SET', 2000);
  s = send(s, 'SKIP_EXERCISE', 3000);
  assert.deepEqual(s.results[0], { id: 'squat', completed: 1, skipped: 2 });
  s = send(s, 'SKIP_EXERCISE', 4000);
  assert.equal(s.status, 'COMPLETE');
  assert.equal(summarize(s).skippedSets, 3);
  assert.equal(summarize(s).completedExercises, 0);
});

test('rest adjustment uses an absolute deadline, clamps at zero, and skip never credits a set', () => {
  let s = create([exercise('squat', { sets: 2, restSeconds: 30 })]);
  s = send(s, 'COMPLETE_SET', 2000);
  s = send(s, 'ADJUST_REST', 12000, { seconds: 15 });
  assert.equal(s.restEndAt, 47000);
  assert.equal(remainingSeconds(s.restEndAt, 12500), 35);
  s = send(s, 'ADJUST_REST', 46000, { seconds: -15 });
  assert.equal(s.status, 'EXERCISE');
  assert.equal(s.results[0].completed, 1);
});

test('background expiry advances a rest only once', () => {
  let s = create([exercise('squat', { sets: 3 })]);
  s = send(s, 'COMPLETE_SET', 2000);
  const resumed = send(JSON.parse(JSON.stringify(s)), 'TICK', 900000);
  assert.equal(resumed.status, 'EXERCISE');
  assert.equal(resumed.currentSet, 2);
  assert.equal(resumed.results[0].completed, 1);
  assert.strictEqual(send(resumed, 'TICK', 901000), resumed);
});

test('time exercises start explicitly, preserve precise pause time, and finish automatically', () => {
  let s = create([exercise('plank', { sets: 1, durationSeconds: 30 })]);
  assert.equal(s.timerPaused, true);
  assert.strictEqual(send(s, 'COMPLETE_SET', 2000), s);
  s = send(s, 'START_TIMER', 2000);
  assert.equal(s.timerEndAt, 32000);
  s = send(s, 'PAUSE_TIMER', 7250);
  assert.equal(s.timerRemainingMs, 24750);
  assert.strictEqual(send(s, 'TICK', 900000), s);
  s = send(JSON.parse(JSON.stringify(s)), 'START_TIMER', 900000);
  assert.equal(s.timerEndAt, 924750);
  s = send(s, 'TICK', 924750);
  assert.equal(s.status, 'COMPLETE');
  assert.equal(s.results[0].completed, 1);
});

test('background expiry completes only the current timed set and starts a fresh rest', () => {
  let s = create([exercise('plank', { sets: 3, durationSeconds: 10, restSeconds: 30 })]);
  s = send(s, 'START_TIMER', 2000);
  s = send(JSON.parse(JSON.stringify(s)), 'TICK', 900000);
  assert.equal(s.results[0].completed, 1);
  assert.equal(s.status, 'REST');
  assert.equal(s.restEndAt, 930000);
  s = send(s, 'TICK', 950000);
  assert.equal(s.timerPaused, true);
  assert.equal(s.timerRemainingMs, 10000);
});

test('pause at the deadline completes the current timed set', () => {
  let s = create([exercise('plank', { sets: 1, durationSeconds: 5 })]);
  s = send(s, 'START_TIMER', 2000);
  s = send(s, 'PAUSE_TIMER', 7000);
  assert.equal(s.status, 'COMPLETE');
});

test('time block counts one block and advances without repeated sets', () => {
  let s = create([exercise('warm_up', { durationSeconds: 5 })]);
  assert.equal(totalUnits(s), 1);
  s = send(s, 'START_TIMER', 2000);
  s = send(s, 'TICK', 7000);
  assert.equal(summarize(s).completedBlocks, 1);
  assert.equal(s.status, 'COMPLETE');
});

test('exercise and global settings are independent session snapshots', () => {
  const e = exercise('squat');
  const globals = clone(DEFAULT_SETTINGS);
  const s = create([e], globals);
  e.tempo.phases[0] = 15;
  globals.betweenExerciseRestSeconds = 0;
  globals.restSound = false;
  assert.equal(s.exercises[0].tempo.phases[0], 3);
  assert.equal(s.settings.betweenExerciseRestSeconds, 120);
  assert.equal(s.settings.restSound, true);
});

test('session validation rejects malformed snapshots and inconsistent counts', () => {
  const s = create([exercise('squat'), exercise('plank')]);
  const corruptions = [
    x => { x.version = 1; },
    x => { x.exerciseIndex = 10; },
    x => { x.currentSet = 2; },
    x => { x.exercises[0].tempo.phases = [0]; },
    x => { x.results[1].completed = 1; },
    x => { x.exercises[0].reps.max = 1; },
    x => { x.settings.defaultSets = -1; },
    x => { x.status = 'REST'; x.restEndAt = null; },
    x => { x.exercises[1].id = 'squat'; }
  ];
  for (const mutate of corruptions) { const bad = clone(s); mutate(bad); assert.equal(validateSession(bad), false); }
  assert.equal(validateSession(null), false);
});

test('empty and duplicated exercise selections are rejected', () => {
  assert.throws(() => create([]));
  assert.throws(() => create([exercise('squat'), exercise('squat')]));
});
