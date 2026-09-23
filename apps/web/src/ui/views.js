import { APP_CONFIG, EXERCISES, DEFAULT_EXERCISE_IMAGE } from '../data/exercises.js';
import { estimateSeconds } from '../core/settings.js';
import { currentExercise, summarize, totalUnits, remainingSeconds } from '../core/session.js';

export const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);
const h = escapeHtml;
export const clock = seconds => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
export const goal = e => e.reps ? `${e.type === 'BOTH_SIDE_REPS' ? '좌우 각각 ' : ''}${e.reps.min}~${e.reps.max}회` : `${e.durationSeconds}초`;
const units = e => e.type === 'TIME_BLOCK' ? '1구간' : `${e.sets}세트`;
const imageUrl = value => {
  if (/^data:image\/(svg\+xml|png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) return value;
  try {
    const url = new URL(value, window.location.href);
    return ['http:', 'https:'].includes(url.protocol) ? h(url.href) : h(DEFAULT_EXERCISE_IMAGE);
  } catch { return h(DEFAULT_EXERCISE_IMAGE); }
};
const image = (e, className = '') => `<img class="${className}" src="${imageUrl(e.imageUrl)}" alt="" loading="lazy">`;
const header = () => `<header><div class="brand"><img src="${h(APP_CONFIG.iconUrl)}" alt="">${h(APP_CONFIG.name)}</div><span class="tag">나의 운동 코치</span></header>`;
export const navigation = route => `<nav aria-label="주 메뉴"><button data-action="home" ${route === 'home' ? 'aria-current="page"' : ''}>오늘 운동</button><button data-action="settings" ${route === 'settings' ? 'aria-current="page"' : ''}>설정</button></nav>`;
const back = action => `<button class="text-button back" data-action="${action}">← 뒤로</button>`;
const stat = (value, label) => `<div class="stat"><strong>${h(value)}</strong><span>${label}</span></div>`;
const title = (text, eyebrow = '') => `${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ''}<h1 tabindex="-1" id="screen-title">${text}</h1>`;

export function homeView(ids, filter) {
  const categories = [['all', '전체'], ['upper', '상체'], ['lower', '하체'], ['core', '코어'], ['full', '전신']];
  const list = EXERCISES.filter(e => filter === 'all' || e.category === filter);
  return `${header()}<main>${title('오늘은 어떤 운동을 할까요?', 'YOUR DAILY WORKOUT')}
    <p class="muted intro">진행할 운동을 순서대로 선택하세요.<br>운동부터 휴식까지, 한 흐름으로 안내해 드립니다.</p>
    <div class="filters" role="group" aria-label="운동 부위">${categories.map(([id, text]) => `<button class="chip" data-action="filter" data-id="${id}" aria-pressed="${filter === id}">${text}</button>`).join('')}</div>
    <div class="grid">${list.map(e => `<button class="exercise-card" data-action="select" data-id="${e.id}" aria-label="${h(e.name)}${ids.includes(e.id) ? `, 선택 순서 ${ids.indexOf(e.id) + 1}` : ''}" aria-pressed="${ids.includes(e.id)}">
      ${image(e)}${ids.includes(e.id) ? `<span class="order" aria-hidden="true">${ids.indexOf(e.id) + 1}</span>` : ''}
      <strong>${h(e.name)}</strong><span class="muted">${h(e.target)}</span><span class="muted">${e.type === 'TIME_BLOCK' ? '시간 구간' : e.type === 'TIME' ? '시간 운동' : e.type === 'BOTH_SIDE_REPS' ? '좌우 반복' : '반복 운동'}</span></button>`).join('')}</div>
    <p class="muted small" style="margin-top:12px">이미지는 공통 샘플이며 실제 운동 자세를 설명하지 않습니다.</p>
    <section class="panel selection" aria-label="선택한 운동"><strong>선택한 운동 ${ids.length}개</strong>
    <p class="muted">${ids.length ? ids.map(id => h(EXERCISES.find(e => e.id === id).name)).join(' → ') : '카드를 눌러 오늘 운동을 구성해 보세요.'}</p>
    <button class="primary" data-action="review" ${ids.length ? '' : 'disabled'}>오늘 운동 확인${ids.length ? ` · ${ids.length}개` : ''}</button></section></main>`;
}

export function reviewView(exercises, settings, todayOverrides = {}) {
  const sets = exercises.filter(e => e.type !== 'TIME_BLOCK').reduce((n, e) => n + e.sets, 0);
  const blocks = exercises.filter(e => e.type === 'TIME_BLOCK').length;
  return `${header()}<main>${back('home')}${title('오늘 운동을 확인하세요', 'READY TO MOVE')}
    <p class="muted">선택한 순서대로 진행합니다. 조정한 값은 오늘만 적용됩니다.</p>
    <div class="stats">${stat(exercises.length, '선택한 운동')}${stat(sets + (blocks ? `+${blocks}` : ''), blocks ? '세트 + 시간 구간' : '총 세트')}${stat(Math.ceil(estimateSeconds(exercises, settings) / 60) + '분', '예상 소요시간')}</div>
    <div>${exercises.map((e, i) => `<div class="review-row"><span class="number">${String(i + 1).padStart(2, '0')}</span><div class="details"><strong>${h(e.name)}</strong><p>${h(goal(e))} · ${units(e)}<br>세트 휴식 ${e.restSeconds}초${Object.keys(todayOverrides[e.id] ?? {}).length ? '<br>오늘 조정 적용' : ''}</p></div><button class="text-button" data-action="edit-today" data-id="${e.id}" aria-label="${h(e.name)} 오늘만 조정">조정</button></div>`).join('')}</div>
    <p class="small muted" style="margin:18px 0">운동 간 휴식 ${settings.betweenExerciseRestSeconds}초 · 마지막 운동 뒤에는 휴식 없이 완료합니다.<br>예상시간은 평균 목표 횟수와 저장된 Tempo(없으면 반복당 4초), 휴식을 포함한 추정치입니다. 좌우 반복은 양쪽을 포함하며 실제 수행 속도에 따라 달라집니다.</p>
    <button class="primary" data-action="start">운동 시작</button></main>`;
}

function progress(session) {
  const summary = summarize(session);
  const count = summary.completedSets + summary.skippedSets;
  return `<div class="progress-head"><span>운동 ${session.exerciseIndex + 1} / ${session.exercises.length}</span><span>진행 ${count} / ${totalUnits(session)} 세트·구간</span></div><progress value="${count}" max="${totalUnits(session)}" aria-label="전체 운동 진행률"></progress>`;
}

export function playerView(session, now, soundEnabled, audioRunning) {
  const e = currentExercise(session);
  const soundConfigured = session.settings.tempoSound || session.settings.restSound || session.settings.countdownSound;
  const timerSeconds = e.reps ? null : session.timerPaused ? Math.ceil(session.timerRemainingMs / 1000) : remainingSeconds(session.timerEndAt, now);
  const tempo = e.tempo.enabled && e.reps;
  return `<main>${progress(session)}<section class="player">${image(e, 'exercise-image')}<p class="muted small">공통 샘플 이미지</p>
    ${title(h(e.name))}<p class="name-en">${h(e.nameEn)}</p><p class="target">${h(e.target)}</p>
    ${e.reps ? `<p class="goal">${h(goal(e))}</p>` : `<p class="timer" id="timer" role="timer" aria-label="남은 운동시간">${clock(timerSeconds)}</p>`}
    <p class="set">${e.type === 'TIME_BLOCK' ? '시간 구간' : `SET ${session.currentSet} / ${e.sets}`}</p>
    ${e.reps ? '' : `<p class="muted small timer-state">${session.timerPaused ? '타이머가 멈춰 있습니다. 아래 버튼으로 시작하거나 재개하세요.' : '타이머 진행 중 · 일시정지하면 남은 시간을 보존합니다.'}</p>`}
    <button class="secondary tempo" data-action="toggle-sound" aria-pressed="${soundEnabled && soundConfigured}" ${soundConfigured ? '' : 'disabled'}>안내음 ${!soundConfigured ? '꺼짐 · 기본 설정' : soundEnabled ? (audioRunning ? '켜짐' : '활성화 필요') : '꺼짐'}${tempo ? ` · Tempo ${e.tempo.phases.join(' · ')}` : ''}</button>
    ${soundConfigured && soundEnabled && !audioRunning ? '<button class="text-button wide" data-action="activate-audio">안내음 활성화</button>' : ''}
    ${e.reps ? `<button class="primary" data-action="complete-set" data-revision="${session.revision}">세트 완료</button>` : `<button class="primary" data-action="${session.timerPaused ? 'start-timer' : 'pause-timer'}" data-revision="${session.revision}">${session.timerPaused ? (session.timerRemainingMs === e.durationSeconds * 1000 ? '타이머 시작' : '타이머 재개') : '일시정지'}</button>`}
    <div class="actions"><button class="text-button" data-action="skip-exercise" data-revision="${session.revision}">이 운동 건너뛰기</button><button class="text-button" data-action="exit">운동 종료</button></div>
    <p class="muted small">${e.type === 'BOTH_SIDE_REPS' ? '양쪽을 모두 수행한 뒤 세트 완료를 눌러 주세요.' : e.reps ? '목표 횟수를 수행한 뒤 세트 완료를 눌러 주세요.' : '타이머가 끝나면 완료 처리합니다. 일시정지한 시간은 남은 시간에서 제외합니다.'}</p>
    </section></main>`;
}

export function restAlarmView(session, audioRunning) {
  const e = currentExercise(session);
  return `<main>${progress(session)}<section class="rest">${title('휴식이 끝났어요', 'READY FOR THE NEXT SET')}
    <p class="muted" role="status">휴식 알람을 끄고 다음 운동을 시작하세요.</p>
    <div class="panel next"><p class="eyebrow">UP NEXT</p><strong>${h(e.name)}</strong><p>${e.type === 'TIME_BLOCK' ? '시간 구간' : `SET ${session.currentSet} / ${e.sets}`} · ${h(goal(e))}<br>${h(e.target)}</p></div>
    <button class="primary" data-action="dismiss-rest-alarm" data-revision="${session.revision}">휴식 알람 끄기</button>
    ${audioRunning ? '' : '<p class="muted small">안내음 활성화가 필요합니다. 알람을 끄고 화면 안내로 진행할 수도 있습니다.</p><button class="text-button wide" data-action="activate-audio">안내음 활성화</button>'}
    <div class="actions"><button class="text-button" data-action="toggle-sound" aria-pressed="true">안내음 모두 끄기</button><button class="text-button" data-action="exit">운동 종료</button></div>
    </section></main>`;
}

export function restView(session, now, soundEnabled) {
  const e = currentExercise(session);
  const soundConfigured = session.settings.tempoSound || session.settings.restSound || session.settings.countdownSound;
  return `<main>${progress(session)}<section class="rest">${title('잠시 쉬어 가세요', 'REST & RECOVER')}
    <p class="timer" id="timer" role="timer" aria-label="남은 휴식시간">${clock(remainingSeconds(session.restEndAt, now))}</p>
    <p class="muted">숨을 고르고 다음 운동을 준비하세요.</p>
    <div class="panel next"><p class="eyebrow">UP NEXT</p><strong>${h(e.name)}</strong><p>${e.type === 'TIME_BLOCK' ? '시간 구간' : `SET ${session.currentSet} / ${e.sets}`} · ${h(goal(e))}<br>${h(e.target)}</p></div>
    <div class="actions"><button class="secondary" data-action="adjust-rest" data-seconds="-15" data-revision="${session.revision}">−15초</button><button class="secondary" data-action="adjust-rest" data-seconds="15" data-revision="${session.revision}">+15초</button></div>
    <button class="primary" style="margin-top:16px" data-action="skip-rest" data-revision="${session.revision}">휴식 건너뛰기</button>
    <div class="actions"><button class="text-button" data-action="toggle-sound" aria-pressed="${soundEnabled && soundConfigured}" ${soundConfigured ? '' : 'disabled'}>안내음 ${!soundConfigured ? '꺼짐 · 기본 설정' : soundEnabled ? '켜짐' : '꺼짐'}</button><button class="text-button" data-action="exit">운동 종료</button></div>
    </section></main>`;
}

export function completeView(session) {
  const summary = summarize(session);
  const hasBlocks = session.exercises.some(e => e.type === 'TIME_BLOCK');
  return `<main><div class="finish-mark" aria-hidden="true">✓</div><div class="center">${title('오늘 운동을 마쳤어요', 'WORKOUT COMPLETE')}
    <p class="muted">총 ${clock(summary.elapsedSeconds)} · 운동과 휴식, 앱을 닫아 둔 시간을 포함합니다.</p></div>
    <div class="stats">${stat(summary.completedExercises, '전체 수행 운동')}${stat(summary.completedSets, hasBlocks ? '완료 세트·구간' : '완료 세트')}${stat(summary.skippedSets, hasBlocks ? '건너뛴 세트·구간' : '건너뛴 세트')}</div>
    <div class="panel"><h2>오늘의 진행 결과</h2>${session.exercises.map((e, i) => `<div class="result-row"><strong>${h(e.name)}</strong><span>${session.results[i].completed} / ${e.sets}${e.type === 'TIME_BLOCK' ? '구간' : '세트'}${session.results[i].skipped ? `<br>건너뜀 ${session.results[i].skipped}` : ''}</span></div>`).join('')}</div>
    <p class="muted small">결과는 현재 세션에만 표시되며 별도 운동 기록으로 보관하지 않습니다.</p><button class="primary" data-action="done">완료 · 오늘 운동으로 돌아가기</button></main>`;
}

export function settingsView(settings, overrides) {
  const fields = [['defaultSets', '기본 세트 수', 1, 20, '운동 기본값'], ['defaultRestSeconds', '기본 휴식 (초)', 0, 1800, '운동 기본값'], ['betweenExerciseRestSeconds', '운동 간 휴식 (초)', 0, 1800, '120']];
  const toggles = [['tempoSound', 'Tempo Sound'], ['restSound', '휴식 종료음'], ['countdownSound', '휴식 종료 전 3초 안내음'], ['wakeLock', '화면 꺼짐 방지']];
  return `${header()}<main>${title('나에게 맞는 운동 설정', 'MAKE IT YOURS')}<p class="muted">설정은 이 브라우저에 저장합니다.</p>
    <form id="settings-form"><section class="panel"><h2>운동</h2>${fields.map(([key, text, min, max, placeholder]) => `<label class="setting-row"><span>${text}</span><input name="${key}" type="number" min="${min}" max="${max}" step="1" value="${settings[key] ?? ''}" placeholder="${placeholder}" ${key === 'betweenExerciseRestSeconds' ? 'required' : ''}></label>`).join('')}
    <p class="small muted" style="margin:14px 0 0">기본 세트·휴식을 비워 두면 각 운동의 기본값을 사용합니다. 직접 입력한 값은 전체 운동에 적용되며 운동별 설정이 우선합니다.</p></section>
    <section class="panel"><h2>사운드와 화면</h2><label class="setting-row"><span>화면 테마</span><select name="theme"><option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>다크 모드</option><option value="light" ${settings.theme === 'light' ? 'selected' : ''}>라이트 모드</option></select></label>${toggles.map(([key, text]) => `<label class="setting-row"><span>${text}</span><input name="${key}" type="checkbox" ${settings[key] ? 'checked' : ''}></label>`).join('')}<p class="small muted" style="margin:14px 0 0">화면 꺼짐 방지는 브라우저 지원 범위에서 동작합니다.</p></section>
    <p id="form-error" class="error" role="alert" hidden></p><button class="primary" type="submit">기본 설정 저장</button></form>
    <section class="panel"><h2>운동별 설정</h2>${EXERCISES.map(e => `<div class="review-row"><div class="details"><strong>${h(e.name)}</strong><p>${Object.keys(overrides[e.id] ?? {}).length ? '개별 설정 사용' : '기본 설정 사용'}</p></div><button class="text-button" data-action="edit-exercise" data-id="${e.id}" aria-label="${h(e.name)} 설정">수정</button></div>`).join('')}</section></main>`;
}

export function editorView(e, mode) {
  return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><p class="eyebrow">${mode === 'today' ? 'JUST FOR TODAY' : 'EXERCISE SETTINGS'}</p><h2 id="dialog-title">${h(e.name)} ${mode === 'today' ? '오늘만 조정' : '설정'}</h2>
    <p class="muted small">${mode === 'today' ? '이번 운동에만 적용합니다. 오늘 조정 해제 시 저장된 운동별·기본 설정으로 돌아갑니다.' : '여기서 저장한 값은 기본 설정보다 우선합니다. 기본 설정을 다시 사용하려면 개별 설정을 해제하세요.'}</p>
    <form id="exercise-form">
    ${e.type !== 'TIME_BLOCK' ? `<label class="field"><span>세트 수</span><input name="sets" type="number" min="1" max="20" step="1" required value="${e.sets}"></label>` : '<p class="muted small">시간 구간은 1구간으로 진행합니다.</p>'}
    ${e.reps ? `<div class="field"><span>${e.type === 'BOTH_SIDE_REPS' ? '좌우 각각 목표 횟수' : '목표 횟수'}</span><div class="reps-fields"><input name="repsMin" aria-label="최소 목표 횟수" type="number" min="1" max="300" step="1" required value="${e.reps.min}"><span>~</span><input name="repsMax" aria-label="최대 목표 횟수" type="number" min="1" max="300" step="1" required value="${e.reps.max}"></div></div>` : `<label class="field"><span>운동 시간 (초)</span><input name="durationSeconds" type="number" min="1" max="7200" step="1" required value="${e.durationSeconds}"></label>`}
    <label class="field"><span>세트 간 휴식 (초)</span><input name="restSeconds" type="number" min="0" max="1800" step="1" required value="${e.restSeconds}"></label>
    ${e.reps ? `<label class="switch-label"><span>운동 Tempo 사용</span><input name="tempoEnabled" type="checkbox" ${e.tempo.enabled ? 'checked' : ''}></label><label class="field"><span>Tempo 단계 (초, 1~30 / 최대 6단계)</span><input name="phases" type="text" value="${e.tempo.phases.join('-')}" placeholder="예: 2-1-1"></label>` : ''}
    <p id="editor-error" class="error" role="alert" hidden></p><button class="primary" type="submit">${mode === 'today' ? '오늘 운동에 적용' : '운동별 설정 저장'}</button>
    <div class="actions"><button class="text-button" type="button" data-action="reset-override">${mode === 'today' ? '오늘 조정 해제' : '개별 설정 해제'}</button><button class="text-button" type="button" data-action="close-modal">닫기</button></div></form></section></div>`;
}

export function resumeView(session) {
  const e = currentExercise(session);
  const state = session.restAlarmPending ? '휴식이 끝났습니다. 이어한 뒤 휴식 알람을 꺼 주세요.' : session.status === 'REST' ? '휴식 중이던 상태입니다.' : e.reps ? '수행 중이던 상태입니다.'
    : session.timerPaused ? `타이머가 멈춰 있습니다. 남은 시간 ${clock(Math.ceil(session.timerRemainingMs / 1000))}` : '시간 운동 타이머가 진행 중이던 상태입니다.';
  return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><p class="eyebrow">WELCOME BACK</p><h2 id="dialog-title">진행 중인 운동이 있습니다</h2><p class="muted">${h(e.name)} · ${e.type === 'TIME_BLOCK' ? '시간 구간' : `SET ${session.currentSet} / ${e.sets}`}<br>${state}</p><p class="small muted">시간이 지난 휴식은 종료 처리합니다. 만료된 시간 운동은 현재 세트·구간 하나만 완료합니다. 다음 타이머는 직접 시작하며, 멈춘 타이머의 남은 시간은 유지합니다.</p><button class="primary" data-action="resume">이어하기</button><button class="text-button wide" data-action="new-session">새 운동 시작</button></section></div>`;
}

export function exitView() {
  return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><h2 id="dialog-title">운동을 종료할까요?</h2><p class="muted">종료하면 현재 세션은 지워집니다. 잠시 자리를 비우려면 브라우저를 닫고 나중에 이어할 수 있습니다.</p><p class="small muted">휴식과 실행 중인 운동 타이머는 계속 흐릅니다. 시간 운동을 멈추려면 돌아가서 일시정지를 눌러 주세요.</p><div class="actions"><button class="secondary" data-action="close-modal">계속 운동하기</button><button class="primary" data-action="confirm-exit">운동 종료</button></div></section></div>`;
}
