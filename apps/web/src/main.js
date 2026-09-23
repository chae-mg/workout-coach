import { EXERCISES, APP_CONFIG } from './data/exercises.js';
import { clone, isInteger, normalizeSettings, resolveExercise, toggleSelection } from './core/settings.js';
import { createSession, currentExercise, remainingSeconds, transition } from './core/session.js';
import { createStorage } from './browser/storage.js';
import { createEffects } from './browser/effects.js';
import { createSessionId } from './browser/session-id.js';
import { homeView, reviewView, playerView, restView, restAlarmView, completeView, settingsView, editorView, resumeView, exitView, navigation, escapeHtml, clock } from './ui/views.js';

const app = document.querySelector('#app');
const notice = document.querySelector('#notice');
function showNotice(text) {
  notice.innerHTML = `${escapeHtml(text)}<button aria-label="알림 닫기" type="button">×</button>`;
  notice.hidden = false;
  notice.querySelector('button').onclick = () => { notice.hidden = true; };
}
const storage = createStorage(() => window.localStorage, showNotice);
const effects = createEffects(showNotice, () => { if (route === 'workout') render(); });
let settings = storage.loadSettings();
let overrides = storage.loadOverrides(EXERCISES);
let session = storage.loadSession();
let selectedIds = [];
let todayOverrides = {};
let filter = 'all';
let route = session?.status === 'COMPLETE' ? 'complete' : 'home';
let modal = session && session.status !== 'COMPLETE' ? { kind: 'resume' } : null;
let modalReturnFocus = null;
let soundEnabled = session?.soundEnabled ?? true;
let tempoKey = '';
let countdownKey = '';
let lastProgressClickAt = -Infinity;

function applyTheme(theme = settings.theme) {
  const selected = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = selected;
  document.querySelector('meta[name="theme-color"]').content = selected === 'light' ? '#f4f8f6' : APP_CONFIG.themeColor;
}

document.title = APP_CONFIG.name;
applyTheme();
const icon = document.querySelector('link[rel="icon"]');
icon.href = APP_CONFIG.iconUrl;
icon.removeAttribute('type');
if (APP_CONFIG.appleTouchIconUrl) {
  const link = document.createElement('link');
  link.rel = 'apple-touch-icon'; link.href = APP_CONFIG.appleTouchIconUrl;
  document.head.append(link);
}

function plannedExercises() {
  return selectedIds.map(id => {
    const base = EXERCISES.find(e => e.id === id);
    return resolveExercise(base, settings, overrides[id], todayOverrides[id]);
  });
}

function focusIdentifier() {
  const active = document.activeElement;
  if (!active || !app.contains(active) || !active.dataset.action) return null;
  return { action: active.dataset.action, id: active.dataset.id ?? null };
}
function restoreFocus(identifier) {
  if (!identifier) return false;
  const node = [...app.querySelectorAll('[data-action]')].find(n => n.dataset.action === identifier.action && (n.dataset.id ?? null) === identifier.id);
  if (!node || node.disabled || node.closest('[inert]')) return false;
  node.focus({ preventScroll: true });
  return true;
}

function render(moveFocus = false) {
  const previousFocus = focusIdentifier();
  const now = Date.now();
  const focused = route === 'workout' || route === 'complete';
  app.classList.toggle('focus', focused);
  let content;
  if (route === 'review') content = reviewView(plannedExercises(), settings, todayOverrides);
  else if (route === 'settings') content = settingsView(settings, overrides);
  else if (route === 'workout') content = session.restAlarmPending ? restAlarmView(session, effects.audioRunning) : session.status === 'REST' ? restView(session, now, soundEnabled) : playerView(session, now, soundEnabled, effects.audioRunning);
  else if (route === 'complete') content = completeView(session);
  else content = homeView(selectedIds, filter);
  let overlay = '';
  if (modal?.kind === 'editor') {
    const base = EXERCISES.find(e => e.id === modal.id);
    overlay = editorView(resolveExercise(base, settings, overrides[base.id], modal.mode === 'today' ? todayOverrides[base.id] : {}), modal.mode);
  } else if (modal?.kind === 'resume') overlay = resumeView(session);
  else if (modal?.kind === 'exit') overlay = exitView();
  app.innerHTML = `<div id="page" ${modal ? 'inert' : ''}>${content}${focused ? '' : navigation(route)}</div>${overlay}`;
  if (moveFocus) {
    const first = modal ? app.querySelector('[role="dialog"] button, [role="dialog"] input:not([type="hidden"])') : app.querySelector('#screen-title');
    first?.focus({ preventScroll: true });
  } else {
    restoreFocus(previousFocus);
  }
  syncEffects();
}

function syncEffects() {
  const active = route === 'workout' && session && session.status !== 'COMPLETE';
  const e = active ? currentExercise(session) : null;
  const play = active && !modal && !session.restAlarmPending && session.status === 'EXERCISE' && e.reps && e.tempo.enabled
    && session.settings.tempoSound && soundEnabled && effects.audioRunning && !document.hidden;
  const nextKey = play ? `${session.sessionId}:${session.exerciseIndex}:${session.currentSet}:${e.tempo.phases.join(',')}` : '';
  if (nextKey !== tempoKey) {
    effects.stopTempo();
    if (play) effects.startTempo(e.tempo.phases);
    tempoKey = nextKey;
  } else if (!active || !soundEnabled || modal || document.hidden) {
    effects.stopTempo();
  }
  if (active && session.restAlarmPending && soundEnabled && !modal && !document.hidden && effects.audioRunning) effects.startRestAlarm();
  else effects.stopRestAlarm();
  void effects.setWakeLock(Boolean(active && session.settings.wakeLock && !document.hidden));
}

function saveProgress() {
  if (session) storage.saveSession(session);
}
function applyEvent(event, now = Date.now()) {
  const previous = session;
  const next = transition(session, event, now);
  if (next === previous) return;
  session = next;
  soundEnabled = next.soundEnabled;
  saveProgress();
  if (session.status === 'COMPLETE') {
    modal = null;
    route = 'complete';
  }
  render(previous.status !== next.status || previous.exerciseIndex !== next.exerciseIndex || previous.currentSet !== next.currentSet);
}
function activateAudio() {
  if (!soundEnabled) return;
  const sounds = session?.settings ?? settings;
  if (!(sounds.tempoSound || sounds.restSound || sounds.countdownSound)) return;
  void effects.activateAudio().then(() => {
    syncEffects();
    const button = app.querySelector('[data-action="toggle-sound"]');
    if (button && route === 'workout' && session.status === 'EXERCISE' && !session.restAlarmPending) {
      const e = currentExercise(session);
      button.textContent = `안내음 ${soundEnabled ? (effects.audioRunning ? '켜짐' : '활성화 필요') : '꺼짐'}${e.tempo.enabled && e.reps ? ` · Tempo ${e.tempo.phases.join(' · ')}` : ''}`;
      if (effects.audioRunning) app.querySelector('[data-action="activate-audio"]')?.remove();
    }
  });
}

function closeModal() {
  modal = null;
  render();
  if (!restoreFocus(modalReturnFocus)) app.querySelector('#screen-title')?.focus({ preventScroll: true });
  modalReturnFocus = null;
}
function discardSession() {
  const cleared = storage.clearSession();
  session = null;
  modal = null;
  route = 'home';
  selectedIds = [];
  todayOverrides = {};
  soundEnabled = true;
  effects.stop();
  tempoKey = '';
  countdownKey = '';
  render(true);
  window.scrollTo(0, 0);
  if (!cleared) showNotice('화면의 운동은 종료했습니다. 기기의 저장 데이터를 삭제하지 못해 다시 열면 이전 운동이 표시될 수 있습니다.');
  return true;
}

app.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button || button.disabled || button.closest('[inert]')) return;
  const action = button.dataset.action;
  const id = button.dataset.id;
  if (action === 'select') {
    if (!EXERCISES.some(e => e.id === id)) return;
    selectedIds = toggleSelection(selectedIds, id);
    if (!selectedIds.includes(id)) delete todayOverrides[id];
    render();
  } else if (action === 'filter') { filter = id; render(); }
  else if (action === 'home' || action === 'settings') {
    route = action; render(true); window.scrollTo(0, 0);
  } else if (action === 'review' && selectedIds.length) {
    route = 'review'; render(true); window.scrollTo(0, 0);
  } else if (action === 'edit-today' || action === 'edit-exercise') {
    modalReturnFocus = focusIdentifier();
    modal = { kind: 'editor', id, mode: action === 'edit-today' ? 'today' : 'exercise' };
    render(true);
  } else if (action === 'close-modal') closeModal();
  else if (action === 'reset-override' && modal?.kind === 'editor') {
    if (modal.mode === 'today') delete todayOverrides[modal.id];
    else {
      const nextOverrides = clone(overrides);
      delete nextOverrides[modal.id];
      if (!storage.saveOverrides(nextOverrides)) return;
      overrides = nextOverrides;
    }
    closeModal();
  } else if (action === 'start') {
    if (!selectedIds.length || session) return;
    session = createSession(plannedExercises(), settings, Date.now(), createSessionId());
    lastProgressClickAt = -Infinity;
    soundEnabled = true;
    saveProgress(); route = 'workout';
    activateAudio(); render(true); window.scrollTo(0, 0);
  } else if (action === 'resume') {
    modal = null;
    route = 'workout';
    activateAudio();
    applyEvent({ type: 'TICK' });
    render(true); window.scrollTo(0, 0);
  } else if (['new-session', 'confirm-exit', 'done'].includes(action)) discardSession();
  else if (action === 'exit') {
    modalReturnFocus = focusIdentifier(); modal = { kind: 'exit' }; render(true);
  } else if (action === 'toggle-sound') {
    applyEvent({ type: 'SET_SOUND', enabled: !soundEnabled, revision: session.revision });
    if (soundEnabled) activateAudio();
  } else if (action === 'activate-audio') {
    activateAudio();
  } else {
    const types = {
      'complete-set': 'COMPLETE_SET', 'skip-exercise': 'SKIP_EXERCISE',
      'dismiss-rest-alarm': 'DISMISS_REST_ALARM',
      'adjust-rest': 'ADJUST_REST', 'skip-rest': 'SKIP_REST',
      'start-timer': 'START_TIMER', 'pause-timer': 'PAUSE_TIMER'
    };
    if (!types[action]) return;
    if (Number(button.dataset.revision) !== session?.revision) return;
    const now = Date.now();
    // Protect both progress actions when zero rest immediately renders the next target.
    if (action === 'complete-set' || action === 'skip-exercise') {
      if (now - lastProgressClickAt < 500) return;
      lastProgressClickAt = now;
    }
    activateAudio();
    applyEvent({ type: types[action], revision: Number(button.dataset.revision), seconds: Number(button.dataset.seconds) }, now);
  }
});

app.addEventListener('change', event => {
  if (event.target.matches('#settings-form select[name="theme"]')) applyTheme(event.target.value);
});

function formError(id, text) {
  const element = document.getElementById(id);
  element.textContent = text;
  element.hidden = false;
}
app.addEventListener('submit', event => {
  event.preventDefault();
  const form = event.target;
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const number = key => Number(data.get(key));
  if (form.getAttribute('id') === 'settings-form') {
    const next = clone(settings);
    for (const [key, min, max] of [['defaultSets', 1, 20], ['defaultRestSeconds', 0, 1800], ['betweenExerciseRestSeconds', 0, 1800]]) {
      const value = data.get(key) === '' && key !== 'betweenExerciseRestSeconds' ? null : number(key);
      if (value !== null && !isInteger(value, min, max)) { formError('form-error', '세트와 휴식은 표시된 범위의 정수로 입력해 주세요.'); return; }
      next[key] = value;
    }
    for (const key of ['tempoSound', 'restSound', 'countdownSound', 'wakeLock']) next[key] = data.has(key);
    next.theme = data.get('theme') === 'light' ? 'light' : 'dark';
    if (!storage.saveSettings(next)) return;
    settings = normalizeSettings(next);
    applyTheme();
    render(); showNotice('기본 설정을 저장했습니다. 다음 운동을 시작할 때 적용합니다.');
  } else if (form.getAttribute('id') === 'exercise-form' && modal?.kind === 'editor') {
    const e = EXERCISES.find(value => value.id === modal.id);
    const value = { restSeconds: number('restSeconds') };
    if (e.type !== 'TIME_BLOCK') value.sets = number('sets');
    if (e.reps) {
      value.reps = { min: number('repsMin'), max: number('repsMax') };
      if (value.reps.min > value.reps.max) { formError('editor-error', '최대 횟수는 최소 횟수 이상이어야 합니다.'); return; }
      const raw = String(data.get('phases')).trim();
      const phases = raw ? raw.split(/[\s,·-]+/).map(Number) : [];
      const enabled = data.has('tempoEnabled');
      if (phases.length > 6 || phases.some(n => !isInteger(n, 1, 30)) || (enabled && !phases.length)) {
        formError('editor-error', 'Tempo는 1~30초의 정수를 최대 6단계로 입력해 주세요. 예: 2-1-1'); return;
      }
      value.tempo = { enabled, phases };
    } else value.durationSeconds = number('durationSeconds');
    if (modal.mode === 'today') todayOverrides[modal.id] = value;
    else {
      const nextOverrides = { ...overrides, [modal.id]: value };
      if (!storage.saveOverrides(nextOverrides)) return;
      overrides = nextOverrides;
    }
    closeModal();
  }
});

document.addEventListener('keydown', event => {
  if (!modal) return;
  if (event.key === 'Escape' && modal.kind !== 'resume') { event.preventDefault(); closeModal(); return; }
  if (event.key !== 'Tab') return;
  const nodes = [...app.querySelectorAll('[role="dialog"] button, [role="dialog"] input:not([type="hidden"])')].filter(n => !n.disabled);
  if (!nodes.length) return;
  const first = nodes[0], last = nodes.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});

function tick() {
  if (route !== 'workout' || !session || modal?.kind === 'resume') return;
  applyEvent({ type: 'TICK' });
  if (route !== 'workout') return;
  const timer = document.querySelector('#timer');
  const e = currentExercise(session);
  const seconds = session.status === 'REST' ? remainingSeconds(session.restEndAt, Date.now())
    : e.reps ? null : session.timerPaused ? Math.ceil(session.timerRemainingMs / 1000) : remainingSeconds(session.timerEndAt, Date.now());
  if (timer && seconds !== null) timer.textContent = clock(seconds);
  if (session.status === 'REST' && seconds > 0 && seconds <= 3 && !modal && !document.hidden) {
    const key = `${session.sessionId}:${session.restEndAt}:${seconds}`;
    if (key !== countdownKey) {
      if (soundEnabled && session.settings.countdownSound) effects.beep();
      countdownKey = key;
    }
  }
}
setInterval(tick, 200);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { effects.stopTempo(); effects.stopRestAlarm(); tempoKey = ''; void effects.setWakeLock(false); saveProgress(); }
  else { tick(); syncEffects(); }
});
window.addEventListener('pagehide', () => { saveProgress(); effects.stop(); tempoKey = ''; });
window.addEventListener('pageshow', () => { tick(); syncEffects(); });
render(Boolean(modal));
