import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES } from '../apps/web/src/data/exercises.js';
import { DEFAULT_SETTINGS, clone, estimateSeconds, resolveExercise } from '../apps/web/src/core/settings.js';
import { createSession, transition, validateSession } from '../apps/web/src/core/session.js';
import { createStorage } from '../apps/web/src/browser/storage.js';

const exercise = (id, values) => resolveExercise(EXERCISES.find(e => e.id === id), DEFAULT_SETTINGS, values);
for (const restSeconds of [0, 10]) {
  test(`timer-resume expired timer credits one set with ${restSeconds}s rest`, () => {
    let s = createSession([exercise('plank', { sets: 3, durationSeconds: 5, restSeconds })], DEFAULT_SETTINGS, 1000, 'expired');
    s = transition(s, { type: 'START_TIMER', revision: s.revision }, 1000);
    let raw;
    const store = createStorage(() => ({ setItem: (_, value) => { raw = value; }, getItem: () => raw }));
    assert.equal(store.saveSession(s), true);
    s = transition(store.loadSession(), { type: 'TICK' }, 100000);
    assert.equal(s.results[0].completed, 1);
    assert.equal(s.currentSet, 2);
    assert.equal(s.timerPaused, true);
    assert.equal(s.timerEndAt, null);
    assert.equal(s.timerRemainingMs, 5000);
    if (restSeconds) s = transition(s, { type: 'TICK' }, 200000);
    assert.strictEqual(transition(s, { type: 'TICK' }, 300000), s);
    assert.ok(validateSession(s));
  });
}

test('timer-resume rejects inconsistent time and count snapshots', () => {
  const paused = createSession([exercise('plank', { sets: 2 })], DEFAULT_SETTINGS, 1000, 'invalid');
  for (const mutate of [
    s => { s.timerRemainingMs = 0; },
    s => { s.timerRemainingMs = 31000; },
    s => { s.timerPaused = false; },
    s => { s.results[0].completed = 1; },
    s => { s.version = 99; },
    s => { s.exercises[0].type = 'TIME_BLOCK'; },
    s => { s.restEndAt = 2000; }
  ]) {
    const bad = clone(paused);
    mutate(bad);
    assert.equal(validateSession(bad), false);
  }
});

test('timer-resume mixed estimate counts blocks once and time sets individually', () => {
  const globals = { ...DEFAULT_SETTINGS, defaultSets: 4, betweenExerciseRestSeconds: 10 };
  const plan = [
    resolveExercise(EXERCISES.find(e => e.id === 'warm_up'), globals, { durationSeconds: 2, sets: 20 }),
    exercise('plank', { sets: 2, durationSeconds: 5, restSeconds: 0 }),
    exercise('squat', { sets: 1, reps: { min: 1, max: 1 }, tempo: { enabled: true, phases: [1] } })
  ];
  assert.equal(plan[0].sets, 1);
  assert.equal(estimateSeconds(plan, globals), 33);
});
