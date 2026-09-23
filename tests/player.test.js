import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES } from '../apps/web/src/data/exercises.js';
import { DEFAULT_SETTINGS, resolveExercise } from '../apps/web/src/core/settings.js';
import { createSession, transition, validateSession, summarize } from '../apps/web/src/core/session.js';

const exercise = (id, sets = 3, restSeconds = 0) => resolveExercise(EXERCISES.find(e => e.id === id), DEFAULT_SETTINGS, { sets, restSeconds });
const send = (s, type) => {
  const next = transition(s, { type, revision: s.revision }, 2000);
  assert.ok(validateSession(next));
  return next;
};

for (const id of ['squat', 'one_arm_row']) {
  for (const completed of [0, 1, 2]) {
    test(`player ${id}: skip after ${completed} sets only counts remaining sets`, () => {
      let s = createSession([exercise(id), exercise('push_up', 1)], { ...DEFAULT_SETTINGS, betweenExerciseRestSeconds: 0 }, 1000, 'player-skip');
      for (let i = 0; i < completed; i++) s = send(s, 'COMPLETE_SET');
      const event = { type: 'SKIP_EXERCISE', revision: s.revision };
      s = transition(s, event, 2000);
      assert.ok(validateSession(s));
      assert.deepEqual(s.results, [{ id, completed, skipped: 3 - completed }, { id: 'push_up', completed: 0, skipped: 0 }]);
      assert.equal(s.exerciseIndex, 1);
      assert.equal(s.currentSet, 1);
      assert.equal(s.status, 'EXERCISE');
      assert.equal(summarize(s).completedSets + summarize(s).skippedSets, 3);
      assert.strictEqual(transition(s, event, 2001), s);
    });
  }
}

test('player both-side repetitions count one set after both sides are done', () => {
  let s = createSession([exercise('one_arm_row'), exercise('push_up', 1)], { ...DEFAULT_SETTINGS, betweenExerciseRestSeconds: 0 }, 1000, 'player-both');
  for (let completed = 1; completed <= 3; completed++) {
    s = send(s, 'COMPLETE_SET');
    assert.equal(s.results[0].completed, completed);
    assert.equal(summarize(s).completedSets, completed);
    assert.equal(s.exerciseIndex, completed === 3 ? 1 : 0);
    assert.equal(s.currentSet, completed === 3 ? 1 : completed + 1);
  }
});

for (const sets of [1, 3]) {
  test(`player ${sets}-set exercise points to correct target when entering rest`, () => {
    const s = createSession([exercise('squat', sets, 30), exercise('one_arm_row', 3)], { ...DEFAULT_SETTINGS, betweenExerciseRestSeconds: 45 }, 1000, 'player-rest-target');
    const next = send(s, 'COMPLETE_SET');
    assert.equal(next.status, 'REST');
    assert.equal(next.exerciseIndex, sets === 1 ? 1 : 0);
    assert.equal(next.currentSet, sets === 1 ? 1 : 2);
    assert.equal(next.restEndAt, sets === 1 ? 47000 : 32000);
    assert.equal(next.results[0].completed, 1);
  });
}
