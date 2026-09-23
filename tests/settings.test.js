import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES } from '../apps/web/src/data/exercises.js';
import { DEFAULT_SETTINGS, clone, resolveExercise, toggleSelection, normalizeSettings, normalizeOverrides, estimateSeconds } from '../apps/web/src/core/settings.js';

test('selection preserves order through deselect and reselect', () => {
  let ids = [];
  for (const id of ['squat', 'push_up', 'crunch', 'push_up', 'push_up']) ids = toggleSelection(ids, id);
  assert.deepEqual(ids, ['squat', 'crunch', 'push_up']);
});

test('exercise defaults survive until a global value is explicitly supplied', () => {
  const crunch = EXERCISES.find(e => e.id === 'crunch');
  assert.equal(resolveExercise(crunch, DEFAULT_SETTINGS).restSeconds, 60);
  const globals = { ...DEFAULT_SETTINGS, defaultSets: 2, defaultRestSeconds: 45 };
  const resolved = resolveExercise(crunch, globals, { restSeconds: 30, reps: { min: 10, max: 12 } }, { sets: 1 });
  assert.equal(resolved.sets, 1);
  assert.equal(resolved.restSeconds, 30);
  assert.deepEqual(resolved.reps, { min: 10, max: 12 });
  assert.equal(resolveExercise(crunch, globals).sets, 2);
  assert.equal(resolveExercise(crunch, globals).restSeconds, 45);
  assert.equal(crunch.restSeconds, 60);
});

test('resolved nested values do not mutate exercises or overrides', () => {
  const override = { tempo: { enabled: true, phases: [1, 2] } };
  const before = clone(EXERCISES[0]);
  const result = resolveExercise(EXERCISES[0], DEFAULT_SETTINGS, override);
  result.tempo.phases[0] = 9;
  result.reps.min = 99;
  assert.deepEqual(EXERCISES[0], before);
  assert.equal(override.tempo.phases[0], 1);
});

test('corrupt or future settings fall back safely and valid zero rest is retained', () => {
  assert.deepEqual(normalizeSettings({ version: 99, defaultSets: 10 }), DEFAULT_SETTINGS);
  const normalized = normalizeSettings({ version: 1, defaultSets: -1, defaultRestSeconds: 0, wakeLock: 'true', tempoSound: false });
  assert.equal(normalized.version, 2);
  assert.equal(normalized.defaultSets, null);
  assert.equal(normalized.defaultRestSeconds, 0);
  assert.equal(normalized.wakeLock, true);
  assert.equal(normalized.tempoSound, false);
  assert.equal(normalizeSettings({ version: 2, theme: 'light' }).theme, 'light');
  assert.equal(normalizeSettings({ version: 2, theme: 'sepia' }).theme, 'dark');
});

test('invalid overrides are excluded and time blocks remain one block', () => {
  const block = EXERCISES.find(e => e.type === 'TIME_BLOCK');
  const result = resolveExercise(block, { ...DEFAULT_SETTINGS, defaultSets: 8 }, { sets: 6, durationSeconds: 60 });
  assert.equal(result.sets, 1);
  assert.equal(result.durationSeconds, 60);
  const normalized = normalizeOverrides({ squat: { sets: 0, reps: { min: 20, max: 10 }, tempo: { enabled: true, phases: [] } }, unknown: { sets: 3 } }, EXERCISES);
  assert.deepEqual(normalized, { squat: {} });
});

test('estimated duration includes both sides, set rest, and between-exercise rest without final rest', () => {
  const row = resolveExercise(EXERCISES.find(e => e.id === 'one_arm_row'), DEFAULT_SETTINGS, { sets: 2, reps: { min: 10, max: 10 }, restSeconds: 30, tempo: { enabled: true, phases: [2, 1, 2] } });
  const plank = resolveExercise(EXERCISES.find(e => e.id === 'plank'), DEFAULT_SETTINGS, { sets: 1, durationSeconds: 30 });
  assert.equal(estimateSeconds([row, plank], { ...DEFAULT_SETTINGS, betweenExerciseRestSeconds: 60 }), 320);
  assert.equal(estimateSeconds([], DEFAULT_SETTINGS), 0);
});
