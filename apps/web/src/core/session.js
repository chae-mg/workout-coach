import { clone, isInteger, isObject, normalizeSettings } from './settings.js';

export const SESSION_VERSION = 2;
export const remainingSeconds = (endAt, now) => Math.max(0, Math.ceil((endAt - now) / 1000));
export const currentExercise = session => session.exercises[session.exerciseIndex];
export const totalUnits = session => session.exercises.reduce((n, e) => n + e.sets, 0);

export function createSession(exercises, settings, now, sessionId) {
  if (!exercises.length || new Set(exercises.map(e => e.id)).size !== exercises.length) {
    throw new Error('운동을 하나 이상 선택해야 하며 같은 운동은 중복할 수 없습니다.');
  }
  const session = {
    version: SESSION_VERSION, sessionId, revision: 0, startedAt: now, endedAt: null,
    status: 'EXERCISE', exerciseIndex: 0, currentSet: 1,
    exercises: clone(exercises), settings: normalizeSettings(settings), soundEnabled: true, restAlarmPending: false,
    results: exercises.map(e => ({ id: e.id, completed: 0, skipped: 0 })),
    restEndAt: null, timerEndAt: null, timerRemainingMs: null, timerPaused: true
  };
  enterExercise(session);
  if (!validateSession(session)) throw new Error('운동 설정이 올바르지 않습니다.');
  return session;
}

function enterExercise(session) {
  session.status = 'EXERCISE';
  session.restEndAt = null;
  session.timerEndAt = null;
  session.timerPaused = true;
  session.timerRemainingMs = currentExercise(session).reps ? null : currentExercise(session).durationSeconds * 1000;
}

function finish(session, now) {
  session.restAlarmPending = false;
  session.status = 'COMPLETE';
  session.endedAt = now;
  session.restEndAt = null;
  session.timerEndAt = null;
  session.timerRemainingMs = null;
  session.timerPaused = true;
}

function moveOn(session, now, skipExercise = false) {
  const previous = currentExercise(session);
  const between = skipExercise || session.currentSet >= previous.sets;
  if (between) {
    if (session.exerciseIndex === session.exercises.length - 1) {
      finish(session, now);
      return;
    }
    session.exerciseIndex += 1;
    session.currentSet = 1;
  } else {
    session.currentSet += 1;
  }
  const seconds = between ? session.settings.betweenExerciseRestSeconds : previous.restSeconds;
  enterExercise(session);
  if (seconds > 0) {
    session.status = 'REST';
    session.restEndAt = now + seconds * 1000;
  }
}

// Events carry the rendered revision, so repeated events cannot credit a set twice.
export function transition(session, event, now) {
  if (!session || session.status === 'COMPLETE' || !Number.isFinite(now)
    || (event.revision !== undefined && event.revision !== session.revision)) return session;
  if (session.restAlarmPending && !['SET_SOUND', 'DISMISS_REST_ALARM', 'TICK'].includes(event.type)) return session;
  const next = clone(session);
  const exercise = currentExercise(next);
  let changed = false;
  if (event.type === 'SET_SOUND' && typeof event.enabled === 'boolean' && event.enabled !== next.soundEnabled) {
    next.soundEnabled = event.enabled;
    if (!event.enabled) next.restAlarmPending = false;
    changed = true;
  } else if (event.type === 'DISMISS_REST_ALARM' && next.restAlarmPending) {
    next.restAlarmPending = false;
    changed = true;
  } else if (event.type === 'COMPLETE_SET' && next.status === 'EXERCISE' && exercise.reps) {
    next.results[next.exerciseIndex].completed += 1;
    moveOn(next, now);
    changed = true;
  } else if (event.type === 'SKIP_EXERCISE' && next.status === 'EXERCISE') {
    next.results[next.exerciseIndex].skipped += exercise.sets - next.currentSet + 1;
    moveOn(next, now, true);
    changed = true;
  } else if (event.type === 'ADJUST_REST' && next.status === 'REST' && [-15, 15].includes(event.seconds)) {
    next.restEndAt = Math.min(now + 1800 * 1000, Math.max(now, next.restEndAt + event.seconds * 1000));
    if (next.restEndAt <= now) enterExercise(next);
    changed = true;
  } else if (event.type === 'SKIP_REST' && next.status === 'REST') {
    enterExercise(next);
    changed = true;
  } else if (event.type === 'START_TIMER' && next.status === 'EXERCISE' && !exercise.reps && next.timerPaused) {
    next.timerEndAt = now + next.timerRemainingMs;
    next.timerPaused = false;
    changed = true;
  } else if (event.type === 'PAUSE_TIMER' && next.status === 'EXERCISE' && !exercise.reps && !next.timerPaused) {
    // A pause at/after the deadline must complete the timer rather than resurrect it.
    if (next.timerEndAt <= now) {
      next.results[next.exerciseIndex].completed += 1;
      moveOn(next, now);
    } else {
      next.timerRemainingMs = next.timerEndAt - now;
      next.timerEndAt = null;
      next.timerPaused = true;
    }
    changed = true;
  } else if (event.type === 'TICK') {
    if (next.status === 'REST' && next.restEndAt <= now) {
      enterExercise(next);
      next.restAlarmPending = Boolean(next.settings.restSound && next.soundEnabled);
      changed = true;
    } else if (next.status === 'EXERCISE' && !exercise.reps && !next.timerPaused && next.timerEndAt <= now) {
      next.results[next.exerciseIndex].completed += 1;
      moveOn(next, now);
      changed = true;
    }
  }
  if (!changed) return session;
  next.revision += 1;
  return next;
}

export function summarize(session) {
  return {
    completedSets: session.results.reduce((n, r) => n + r.completed, 0),
    skippedSets: session.results.reduce((n, r) => n + r.skipped, 0),
    completedExercises: session.results.filter((r, i) => r.completed === session.exercises[i].sets).length,
    completedBlocks: session.results.filter((r, i) => session.exercises[i].type === 'TIME_BLOCK' && r.completed === 1).length,
    elapsedSeconds: Math.max(0, Math.round(((session.endedAt ?? session.startedAt) - session.startedAt) / 1000))
  };
}

export function validateSession(s) {
  if (!isObject(s) || s.version !== SESSION_VERSION || typeof s.sessionId !== 'string'
    || !s.sessionId.length || !isInteger(s.revision, 0, Number.MAX_SAFE_INTEGER)
    || !Number.isFinite(s.startedAt) || s.startedAt < 0
    || !['EXERCISE', 'REST', 'COMPLETE'].includes(s.status)
    || !Array.isArray(s.exercises) || !s.exercises.length || s.exercises.length > 100
    || !Array.isArray(s.results) || s.results.length !== s.exercises.length
    || !isInteger(s.exerciseIndex, 0, s.exercises.length - 1)
    || !isObject(s.settings) || s.settings.version !== 2
    || !Object.entries(normalizeSettings(s.settings)).every(([key, value]) => s.settings[key] === value)
    || typeof s.timerPaused !== 'boolean' || typeof s.soundEnabled !== 'boolean'
    || (s.restAlarmPending !== undefined && typeof s.restAlarmPending !== 'boolean')) return false;
  if (s.restAlarmPending && (s.status !== 'EXERCISE' || !s.timerPaused || !s.soundEnabled || !s.settings.restSound)) return false;
  const ids = new Set();
  for (let i = 0; i < s.exercises.length; i++) {
    const e = s.exercises[i];
    const r = s.results[i];
    if (!isObject(e) || typeof e.id !== 'string' || !e.id.length || ids.has(e.id)
      || !['REPS', 'BOTH_SIDE_REPS', 'TIME', 'TIME_BLOCK'].includes(e.type)
      || !['name', 'nameEn', 'target', 'imageUrl'].every(key => typeof e[key] === 'string')
      || !isInteger(e.sets, 1, 20) || !isInteger(e.restSeconds, 0, 1800)
      || !isObject(e.tempo) || typeof e.tempo.enabled !== 'boolean'
      || !Array.isArray(e.tempo.phases) || e.tempo.phases.length > 6
      || !e.tempo.phases.every(n => isInteger(n, 1, 30))
      || (e.tempo.enabled && !e.tempo.phases.length)
      || !isObject(r) || r.id !== e.id || !isInteger(r.completed, 0, e.sets)
      || !isInteger(r.skipped, 0, e.sets) || r.completed + r.skipped > e.sets) return false;
    ids.add(e.id);
    if (['REPS', 'BOTH_SIDE_REPS'].includes(e.type)) {
      if (!isObject(e.reps) || !isInteger(e.reps.min, 1, 300) || !isInteger(e.reps.max, e.reps.min, 300)) return false;
    } else if (e.reps !== null || !isInteger(e.durationSeconds, 1, 7200)
      || (e.type === 'TIME_BLOCK' && e.sets !== 1)) return false;
    const accounted = r.completed + r.skipped;
    if (s.status === 'COMPLETE' || i < s.exerciseIndex) {
      if (accounted !== e.sets) return false;
    } else if (i === s.exerciseIndex) {
      if (accounted !== s.currentSet - 1) return false;
    } else if (accounted !== 0) return false;
  }
  const e = currentExercise(s);
  if (!isInteger(s.currentSet, 1, e.sets)) return false;
  if (s.status === 'COMPLETE') {
    return s.exerciseIndex === s.exercises.length - 1 && Number.isFinite(s.endedAt)
      && s.endedAt >= s.startedAt && s.restEndAt === null && s.timerEndAt === null
      && s.timerRemainingMs === null && s.timerPaused;
  }
  if (s.endedAt !== null) return false;
  if (s.status === 'REST') {
    if (!Number.isFinite(s.restEndAt) || s.restEndAt < s.startedAt || s.timerEndAt !== null || !s.timerPaused) return false;
  } else if (s.restEndAt !== null) return false;
  if (e.reps) return s.timerEndAt === null && s.timerRemainingMs === null && s.timerPaused;
  if (!Number.isFinite(s.timerRemainingMs) || s.timerRemainingMs <= 0
    || s.timerRemainingMs > e.durationSeconds * 1000) return false;
  return s.timerPaused ? s.timerEndAt === null : Number.isFinite(s.timerEndAt) && s.timerEndAt >= s.startedAt;
}
