import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES } from '../apps/web/src/data/exercises.js';
import { DEFAULT_SETTINGS, resolveExercise } from '../apps/web/src/core/settings.js';
import { createSession, transition, remainingSeconds, validateSession, summarize } from '../apps/web/src/core/session.js';

const exercise = (id, values = {}) => resolveExercise(EXERCISES.find(e => e.id === id), DEFAULT_SETTINGS, values);

test('rest-settings remaining seconds round up and never become negative', () => {
  assert.equal(remainingSeconds(1001, 1000), 1);
  assert.equal(remainingSeconds(2001, 1000), 2);
  assert.equal(remainingSeconds(1000, 1000), 0);
  assert.equal(remainingSeconds(1000, 2000), 0);
});

test('rest-settings rest adjustment clamps at maximum and zero without crediting a set', () => {
  let s = createSession([exercise('squat', { sets: 2, restSeconds: 1800 })], DEFAULT_SETTINGS, 1000, 'rest-limit');
  s = transition(s, { type: 'COMPLETE_SET', revision: s.revision }, 2000);
  const event = { type: 'ADJUST_REST', seconds: 15, revision: s.revision };
  s = transition(s, event, 2000);
  assert.equal(s.restEndAt, 1802000);
  assert.strictEqual(transition(s, event, 2000), s);
  s = transition(s, { type: 'ADJUST_REST', seconds: -15, revision: s.revision }, 1801000);
  assert.equal(s.status, 'EXERCISE');
  assert.equal(s.currentSet, 2);
  assert.equal(s.results[0].completed, 1);
  assert.ok(validateSession(s));
});

test('rest-settings final skip finishes immediately with separate completed and skipped totals', () => {
  let s = createSession([exercise('squat', { sets: 1 }), exercise('one_arm_row', { sets: 2 })], { ...DEFAULT_SETTINGS, betweenExerciseRestSeconds: 0 }, 1000, 'final-skip');
  s = transition(s, { type: 'COMPLETE_SET', revision: s.revision }, 2000);
  s = transition(s, { type: 'SKIP_EXERCISE', revision: s.revision }, 12000);
  assert.equal(s.status, 'COMPLETE');
  assert.equal(s.restEndAt, null);
  assert.equal(s.endedAt, 12000);
  assert.deepEqual(summarize(s), { completedSets: 1, skippedSets: 2, completedExercises: 1, completedBlocks: 0, elapsedSeconds: 11 });
  assert.ok(validateSession(s));
});

test('rest-settings partial overrides inherit and deleting layers restores the next source', () => {
  const base = EXERCISES.find(e => e.id === 'crunch');
  const globals = { ...DEFAULT_SETTINGS, defaultSets: 2, defaultRestSeconds: 45 };
  const saved = { restSeconds: 30, reps: { min: 10, max: 12 } };
  const today = { sets: 1, restSeconds: 0 };
  assert.deepEqual([resolveExercise(base, globals, saved, today).sets, resolveExercise(base, globals, saved, today).restSeconds], [1, 0]);
  const withoutToday = resolveExercise(base, globals, saved);
  assert.deepEqual([withoutToday.sets, withoutToday.restSeconds, withoutToday.reps], [2, 30, { min: 10, max: 12 }]);
  const withoutSaved = resolveExercise(base, globals);
  assert.deepEqual([withoutSaved.sets, withoutSaved.restSeconds, withoutSaved.reps], [2, 45, base.reps]);
  const inherited = resolveExercise(base, { ...globals, defaultSets: null, defaultRestSeconds: null });
  assert.deepEqual([inherited.sets, inherited.restSeconds], [3, 60]);
});
