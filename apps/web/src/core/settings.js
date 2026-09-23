export const DEFAULT_SETTINGS = {
  version: 2,
  defaultSets: null,
  defaultRestSeconds: null,
  betweenExerciseRestSeconds: 120,
  tempoSound: true,
  restSound: true,
  countdownSound: true,
  wakeLock: true,
  theme: 'dark'
};

export const clone = value => structuredClone(value);
export const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const isInteger = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

export function normalizeSettings(input) {
  const result = clone(DEFAULT_SETTINGS);
  if (!isObject(input)) return result;
  if (input.version !== 1 && input.version !== 2) return result;
  for (const [key, min, max] of [
    ['defaultSets', 1, 20], ['defaultRestSeconds', 0, 1800], ['betweenExerciseRestSeconds', 0, 1800]
  ]) {
    if (isInteger(input[key], min, max)) result[key] = input[key];
  }
  for (const key of ['tempoSound', 'restSound', 'countdownSound', 'wakeLock']) {
    if (typeof input[key] === 'boolean') result[key] = input[key];
  }
  if (input.theme === 'light' || input.theme === 'dark') result.theme = input.theme;
  return result;
}

export function normalizeOverride(input, exercise) {
  if (!isObject(input)) return {};
  const result = {};
  if (exercise.type !== 'TIME_BLOCK' && isInteger(input.sets, 1, 20)) result.sets = input.sets;
  if (isInteger(input.restSeconds, 0, 1800)) result.restSeconds = input.restSeconds;
  if (exercise.reps && isObject(input.reps)
    && isInteger(input.reps.min, 1, 300) && isInteger(input.reps.max, input.reps.min, 300)) {
    result.reps = { min: input.reps.min, max: input.reps.max };
  }
  if (exercise.reps === null && isInteger(input.durationSeconds, 1, 7200)) {
    result.durationSeconds = input.durationSeconds;
  }
  if (exercise.reps && isObject(input.tempo) && typeof input.tempo.enabled === 'boolean'
    && Array.isArray(input.tempo.phases) && input.tempo.phases.length <= 6
    && input.tempo.phases.every(n => isInteger(n, 1, 30))
    && (!input.tempo.enabled || input.tempo.phases.length > 0)) {
    result.tempo = clone(input.tempo);
  }
  return result;
}

export function normalizeOverrides(input, exercises) {
  if (!isObject(input)) return {};
  return Object.fromEntries(exercises.filter(e => Object.hasOwn(input, e.id))
    .map(e => [e.id, normalizeOverride(input[e.id], e)]));
}

export function resolveExercise(exercise, settings, override = {}, today = {}) {
  const globals = normalizeSettings(settings);
  const result = clone(exercise);
  if (globals.defaultSets !== null && exercise.type !== 'TIME_BLOCK') result.sets = globals.defaultSets;
  if (globals.defaultRestSeconds !== null) result.restSeconds = globals.defaultRestSeconds;
  Object.assign(result, normalizeOverride(override, exercise), normalizeOverride(today, exercise));
  if (result.type === 'TIME_BLOCK') result.sets = 1;
  return result;
}

export function toggleSelection(ids, id) {
  return ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id];
}

export function estimateSeconds(exercises, settings) {
  const globals = normalizeSettings(settings);
  const work = exercises.reduce((total, e) => {
    const cycle = e.tempo.phases.length ? e.tempo.phases.reduce((a, b) => a + b, 0) : 4;
    const seconds = e.reps ? ((e.reps.min + e.reps.max) / 2) * cycle
      * (e.type === 'BOTH_SIDE_REPS' ? 2 : 1) : e.durationSeconds;
    return total + seconds * e.sets + Math.max(0, e.sets - 1) * e.restSeconds;
  }, 0);
  return Math.round(work + Math.max(0, exercises.length - 1) * globals.betweenExerciseRestSeconds);
}
