import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES } from '../apps/web/src/data/exercises.js';
import { clone, DEFAULT_SETTINGS, estimateSeconds, resolveExercise } from '../apps/web/src/core/settings.js';
import { createSession, currentExercise, validateSession } from '../apps/web/src/core/session.js';

const exercise = id => resolveExercise(EXERCISES.find(e => e.id === id), DEFAULT_SETTINGS);

test('review estimate matches a single exercise and includes no final rest', () => {
  // Squat: 17.5 reps × 6 seconds × 3 sets + two 90-second rests.
  assert.equal(estimateSeconds([exercise('squat')], DEFAULT_SETTINGS), 495);
  assert.equal(estimateSeconds([], DEFAULT_SETTINGS), 0);
});

test('review estimate includes both sides and the four-second fallback', () => {
  // Row 480s, push-up 318s, dead bug 312s, two exercise rests 240s.
  const plan = ['one_arm_row', 'push_up', 'dead_bug'].map(exercise);
  assert.equal(estimateSeconds(plan, DEFAULT_SETTINGS), 1350);
  // Muting tempo retains the saved pace in this estimate.
  plan[0].tempo.enabled = false;
  assert.equal(estimateSeconds(plan, DEFAULT_SETTINGS), 1350);
});

test('review estimate matches all eight initial exercises', () => {
  // Work and set rests: 2820s; seven exercise rests: 840s.
  const plan = EXERCISES.slice(0, 8).map(e => resolveExercise(e, DEFAULT_SETTINGS));
  assert.equal(estimateSeconds(plan, DEFAULT_SETTINGS), 3660);
  assert.equal(plan.reduce((n, e) => n + e.sets, 0), 24);
});

test('review session snapshots preserve resolved values and chosen order', () => {
  const bases = ['one_arm_row', 'push_up'].map(id => clone(EXERCISES.find(e => e.id === id)));
  const globals = { ...DEFAULT_SETTINGS, defaultSets: 2, defaultRestSeconds: 45, betweenExerciseRestSeconds: 75 };
  const saved = { sets: 3, restSeconds: 30, reps: { min: 6, max: 8 }, tempo: { enabled: true, phases: [1, 2, 1] } };
  const today = { sets: 1, reps: { min: 9, max: 11 }, tempo: { enabled: true, phases: [2, 2, 2] } };
  const plan = [resolveExercise(bases[0], globals, saved, today), resolveExercise(bases[1], globals)];
  const s = createSession(plan, globals, 1234, 'review-snapshot');
  assert.equal(validateSession(s), true);
  assert.deepEqual(s.exercises.map(e => e.id), ['one_arm_row', 'push_up']);
  assert.deepEqual(s.exercises.map(e => e.sets), [1, 2]);
  assert.deepEqual(s.exercises.map(e => e.restSeconds), [30, 45]);
  assert.deepEqual(currentExercise(s).reps, { min: 9, max: 11 });
  assert.equal(s.exerciseIndex, 0);
  assert.equal(s.currentSet, 1);
  assert.equal(s.startedAt, 1234);
  assert.equal(s.status, 'EXERCISE');
  assert.deepEqual(s.results, [{ id: 'one_arm_row', completed: 0, skipped: 0 }, { id: 'push_up', completed: 0, skipped: 0 }]);
  const snapshot = clone(s);
  bases[0].name = 'changed';
  bases[0].reps.min = 99;
  saved.reps.min = 99;
  today.tempo.phases[0] = 30;
  globals.betweenExerciseRestSeconds = 0;
  globals.restSound = false;
  plan[0].reps.max = 99;
  plan[0].tempo.phases[0] = 30;
  plan.reverse();
  assert.deepEqual(s, snapshot);
  s.exercises[0].tempo.phases[1] = 20;
  assert.equal(today.tempo.phases[1], 2);
  assert.equal(plan[1].tempo.phases[1], 2);
});
