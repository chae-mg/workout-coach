import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES } from '../apps/web/src/data/exercises.js';
import { DEFAULT_SETTINGS, resolveExercise, clone } from '../apps/web/src/core/settings.js';
import { createSession, transition, validateSession } from '../apps/web/src/core/session.js';
import { createStorage } from '../apps/web/src/browser/storage.js';

function resting(id = 'squat', settings = DEFAULT_SETTINGS) {
  const exercise = resolveExercise(EXERCISES.find(e => e.id === id), settings, { sets: 3, restSeconds: 1, durationSeconds: 1 });
  let session = createSession([exercise], settings, 1000, 'rest-alarm');
  if (exercise.reps) session = transition(session, { type: 'COMPLETE_SET' }, 2000);
  else {
    session = transition(session, { type: 'START_TIMER' }, 1000);
    session = transition(session, { type: 'TICK' }, 2000);
  }
  return session;
}
test('rest alarm waits for acknowledgement without crediting another set or starting its timer', () => {
  for (const id of ['squat', 'plank']) {
    let session = transition(resting(id), { type: 'TICK' }, 3000);
    assert.equal(session.restAlarmPending, true);
    assert.equal(session.currentSet, 2);
    assert.equal(session.results[0].completed, 1);
    for (const type of ['TICK', 'COMPLETE_SET', 'SKIP_EXERCISE', 'START_TIMER']) assert.strictEqual(transition(session, { type }, 99999), session);
    session = transition(session, { type: 'DISMISS_REST_ALARM', revision: session.revision }, 99999);
    assert.equal(session.restAlarmPending, false);
    assert.equal(session.results[0].completed, 1);
    assert.equal(session.timerPaused, true);
    assert.ok(validateSession(session));
  }
});
test('rest alarm survives a storage round trip and does not replay after acknowledgement', () => {
  let raw;
  const storage = createStorage(() => ({ getItem: () => raw, setItem: (_, value) => { raw = value; } }));
  let session = transition(resting(), { type: 'TICK' }, 3000);
  storage.saveSession(session);
  session = storage.loadSession();
  assert.equal(session.restAlarmPending, true);
  session = transition(session, { type: 'DISMISS_REST_ALARM' }, 4000);
  storage.saveSession(session);
  session = storage.loadSession();
  assert.equal(session.restAlarmPending, false);
  assert.strictEqual(transition(session, { type: 'TICK' }, 99999), session);
});
test('rest alarm is not raised for muted sound, disabled rest sound or manual rest skipping', () => {
  const disabled = resting('squat', { ...DEFAULT_SETTINGS, restSound: false });
  const muted = transition(resting(), { type: 'SET_SOUND', enabled: false }, 2000);
  for (const session of [disabled, muted]) assert.equal(transition(session, { type: 'TICK' }, 3000).restAlarmPending, false);
  for (const event of [{ type: 'SKIP_REST' }, { type: 'ADJUST_REST', seconds: -15 }]) assert.equal(transition(resting(), event, 2000).restAlarmPending, false);
});
test('rest alarm mute acknowledges it and stale acknowledgements cannot silence a later rest', () => {
  let session = transition(resting(), { type: 'TICK' }, 3000);
  const oldAck = { type: 'DISMISS_REST_ALARM', revision: session.revision };
  const muted = transition(session, { type: 'SET_SOUND', enabled: false }, 4000);
  assert.equal(muted.restAlarmPending, false);
  session = transition(session, oldAck, 4000);
  session = transition(session, { type: 'COMPLETE_SET' }, 5000);
  session = transition(session, { type: 'TICK' }, 6000);
  assert.equal(session.restAlarmPending, true);
  assert.strictEqual(transition(session, oldAck, 6001), session);
});
test('rest alarm accepts older v2 snapshots and rejects inconsistent pending flags', () => {
  const old = resting();
  delete old.restAlarmPending;
  assert.ok(validateSession(old));
  assert.equal(transition(old, { type: 'TICK' }, 3000).restAlarmPending, true);
  for (const mutate of [s => { s.restAlarmPending = 'true'; }, s => { s.restAlarmPending = true; }, s => { s.restAlarmPending = true; s.soundEnabled = false; }]) {
    const bad = clone(resting());
    mutate(bad);
    assert.equal(validateSession(bad), false);
  }
});
