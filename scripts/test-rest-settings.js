import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { DEFAULT_SETTINGS } from '../apps/web/src/core/settings.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = fileURLToPath(new URL('../test-results/stage5-6/', import.meta.url));
const defaults = { ...DEFAULT_SETTINGS, tempoSound: false, restSound: false, countdownSound: false, wakeLock: false };
const server = spawn(process.execPath, ['scripts/serve.js'], {
  cwd: root, env: { ...process.env, PORT: '0', HOST: '127.0.0.1', WORKOUT_PREVIEW: '' }, stdio: ['ignore', 'ignore', 'pipe', 'ipc']
});
let serverError = '';
server.stderr.on('data', data => { serverError += data; });
let browser;
let url;
const errors = [];
const results = [];
const action = (page, name) => page.locator(name === 'home' ? 'nav [data-action="home"]' : `[data-action="${name}"]`);
const session = page => page.evaluate(() => JSON.parse(localStorage.getItem('active_session')));
const stored = (page, key) => page.evaluate(key => localStorage.getItem(key), key);
const advance = (page, ms = 500) => page.evaluate(ms => { window.__stage56Now += ms; }, ms);
const submit = form => form.evaluate(form => form.requestSubmit());
async function fill(form, values) {
  for (const [name, value] of Object.entries(values)) await form.locator(`[name="${name}"]`).fill(String(value));
}
async function fresh(width, height, exercises = {}) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript(({ defaults, exercises }) => {
    if (!localStorage.getItem('__stage56_seeded')) {
      localStorage.setItem('workout_settings', JSON.stringify(defaults));
      if (Object.keys(exercises).length) localStorage.setItem('exercise_settings', JSON.stringify({ version: 2, exercises }));
      localStorage.setItem('__stage56_seeded', '1');
    }
    window.__stage56Now = 10000;
    Date.now = () => window.__stage56Now;
  }, { defaults, exercises });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(url);
  await page.locator('.exercise-card').first().waitFor();
  return { context, page };
}
async function select(page, ids) {
  for (const id of ids) await page.locator(`[data-action="select"][data-id="${id}"]`).click();
  await action(page, 'review').click();
}
async function editor(page, id, mode = 'today') {
  await page.locator(`[data-action="${mode === 'today' ? 'edit-today' : 'edit-exercise'}"][data-id="${id}"]`).click();
  return page.locator('#exercise-form');
}
async function today(page, id, values) {
  await fill(await editor(page, id), values);
  await submit(page.locator('#exercise-form'));
  assert.equal(await page.locator('[role="dialog"]').count(), 0);
}
async function capture(page, name, bottom = false) {
  if (bottom) await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: `${output}${name}.png` });
}
async function saveGlobals(page, values) {
  const form = page.locator('#settings-form');
  await fill(form, values);
  await submit(form);
  assert.ok((await page.locator('#notice').innerText()).includes('기본 설정을 저장했습니다.'));
  await page.locator('#notice button').click();
}
async function complete(page, expected, elapsed) {
  assert.equal(await page.locator('#screen-title').textContent(), '오늘 운동을 마쳤어요');
  assert.deepEqual(await page.locator('.stats strong').allTextContents(), expected.map(String));
  const s = await session(page);
  assert.equal(s.status, 'COMPLETE');
  assert.equal(s.restEndAt, null);
  if (elapsed !== undefined) assert.equal(s.endedAt - s.startedAt, elapsed);
  return s;
}

async function restFlow(width, height) {
  const { context, page } = await fresh(width, height);
  await select(page, ['squat', 'one_arm_row']);
  await today(page, 'squat', { sets: 2, restSeconds: 30 });
  await today(page, 'one_arm_row', { sets: 2, restSeconds: 30 });
  await action(page, 'start').click();
  await action(page, 'complete-set').click();
  assert.equal((await session(page)).restEndAt, 40000);
  assert.equal(await page.locator('#timer').textContent(), '00:30');
  await page.locator('[data-action="adjust-rest"][data-seconds="15"]').click();
  assert.equal((await session(page)).restEndAt, 55000);
  await page.locator('[data-action="adjust-rest"][data-seconds="-15"]').click();
  assert.equal((await session(page)).restEndAt, 40000);
  await capture(page, `rest-${width}`);
  await advance(page, 29999);
  await page.waitForFunction(() => document.querySelector('#timer')?.textContent === '00:01');
  await advance(page, 1);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('active_session')).status === 'EXERCISE');
  assert.equal((await session(page)).currentSet, 2);
  assert.equal((await session(page)).results[0].completed, 1);
  await action(page, 'complete-set').click();
  assert.equal((await session(page)).restEndAt, 160000);
  assert.equal(await page.locator('.next strong').textContent(), '원암 덤벨 로우');
  await action(page, 'skip-rest').click();
  await advance(page);
  await action(page, 'complete-set').click();
  assert.equal((await session(page)).currentSet, 2);
  await page.locator('[data-action="adjust-rest"][data-seconds="-15"]').click();
  await page.locator('[data-action="adjust-rest"][data-seconds="-15"]').click();
  assert.equal((await session(page)).status, 'EXERCISE');
  await advance(page);
  await action(page, 'skip-exercise').click();
  const s = await complete(page, [1, 3, 1], 31000);
  assert.deepEqual(s.results.map(r => [r.completed, r.skipped]), [[2, 0], [1, 1]]);
  assert.deepEqual(await page.locator('.result-row span').allInnerTexts(), ['2 / 2세트', '1 / 2세트\n건너뜀 1']);
  assert.ok((await page.locator('main').innerText()).includes('총 00:31'));
  await capture(page, `complete-${width}`);
  await action(page, 'done').click();
  assert.equal(await session(page), null);
  assert.equal(await page.locator('.selection strong').textContent(), '선택한 운동 0개');
  await context.close();
}

async function zeroFlow(width, height) {
  const { context, page } = await fresh(width, height);
  await select(page, ['squat', 'one_arm_row']);
  await today(page, 'squat', { sets: 1, restSeconds: 0 });
  await today(page, 'one_arm_row', { sets: 1, restSeconds: 0 });
  // Apply zero exercise rest through the actual settings UI, preserving today's choices.
  await action(page, 'settings').click();
  await saveGlobals(page, { betweenExerciseRestSeconds: 0 });
  await action(page, 'home').click();
  await action(page, 'review').click();
  await action(page, 'start').click();
  await action(page, 'complete-set').click();
  assert.equal((await session(page)).status, 'EXERCISE');
  assert.equal((await session(page)).exerciseIndex, 1);
  await advance(page);
  await action(page, 'complete-set').click();
  await complete(page, [2, 2, 0], 500);
  await context.close();
}

async function settingsFlow(width, height) {
  const { context, page } = await fresh(width, height);
  await action(page, 'settings').click();
  const toggles = ['tempoSound', 'restSound', 'countdownSound', 'wakeLock'];
  for (const name of toggles) await page.locator(`[name="${name}"]`).check();
  await page.locator('[name="theme"]').selectOption('light');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  await saveGlobals(page, { defaultSets: 2, defaultRestSeconds: 45, betweenExerciseRestSeconds: 30 });
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  await capture(page, `settings-${width}`);
  await page.reload();
  await action(page, 'settings').click();
  assert.equal(await page.locator('[name="theme"]').inputValue(), 'light');
  for (const name of toggles) {
    assert.equal(await page.locator(`[name="${name}"]`).isChecked(), true);
    await page.locator(`[name="${name}"]`).uncheck();
  }
  await saveGlobals(page, {});
  await fill(await editor(page, 'crunch', 'saved'), { sets: 3, restSeconds: 15, repsMin: 10, repsMax: 12, phases: '2-1-2' });
  await submit(page.locator('#exercise-form'));
  const savedGlobals = await stored(page, 'workout_settings');
  const savedExercise = await stored(page, 'exercise_settings');
  await page.reload();
  await action(page, 'settings').click();
  assert.equal(await page.locator('[name="defaultSets"]').inputValue(), '2');
  assert.equal(await page.locator('[name="defaultRestSeconds"]').inputValue(), '45');
  let form = await editor(page, 'crunch', 'saved');
  assert.equal(await form.locator('[name="sets"]').inputValue(), '3');
  assert.equal(await form.locator('[name="repsMin"]').inputValue(), '10');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.id), 'crunch');
  await action(page, 'home').click();
  await select(page, ['crunch', 'squat']);
  await today(page, 'crunch', { sets: 1, restSeconds: 0, repsMin: 12, repsMax: 14, phases: '1-1' });
  assert.ok((await page.locator('.review-row').first().innerText()).includes('오늘 조정 적용'));
  assert.equal(await stored(page, 'workout_settings'), savedGlobals);
  assert.equal(await stored(page, 'exercise_settings'), savedExercise);
  // Before a session starts, refreshing clears temporary choices and today's overrides.
  await page.reload();
  await select(page, ['crunch', 'squat']);
  assert.equal((await page.locator('.review-row').first().innerText()).includes('오늘 조정 적용'), false);
  await today(page, 'crunch', { sets: 1, restSeconds: 0 });
  await editor(page, 'crunch');
  await action(page, 'reset-override').click();
  assert.equal((await page.locator('.review-row').first().innerText()).includes('오늘 조정 적용'), false);
  assert.ok((await page.locator('.review-row').first().innerText()).includes('10~12회 · 3세트'));
  await today(page, 'crunch', { sets: 1, restSeconds: 0 });
  await action(page, 'home').click();
  // Deselecting an exercise clears its temporary adjustment.
  for (const id of ['crunch', 'crunch', 'squat', 'squat']) await page.locator(`[data-action="select"][data-id="${id}"]`).click();
  await action(page, 'review').click();
  assert.equal((await page.locator('.review-row').first().innerText()).includes('오늘 조정 적용'), false);
  await today(page, 'crunch', { sets: 1, restSeconds: 0, repsMin: 12, repsMax: 14, phases: '1-1' });
  await capture(page, `today-${width}`);
  await action(page, 'start').click();
  let s = await session(page);
  assert.deepEqual(s.exercises.map(e => [e.sets, e.restSeconds]), [[1, 0], [2, 45]]);
  assert.deepEqual(s.exercises[0].reps, { min: 12, max: 14 });
  assert.deepEqual(s.exercises[0].tempo.phases, [1, 1]);
  await action(page, 'complete-set').click();
  assert.equal((await session(page)).restEndAt, 40000);
  await action(page, 'skip-rest').click();
  await advance(page);
  await action(page, 'complete-set').click();
  assert.equal((await session(page)).restEndAt, 55500);
  await advance(page, 45000);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('active_session')).status === 'EXERCISE');
  await action(page, 'complete-set').click();
  await complete(page, [2, 3, 0], 45500);
  await action(page, 'done').click();
  await select(page, ['crunch']);
  await action(page, 'start').click();
  s = await session(page);
  assert.deepEqual([s.exercises[0].sets, s.exercises[0].restSeconds, s.exercises[0].reps], [3, 15, { min: 10, max: 12 }]);
  await action(page, 'exit').click();
  await action(page, 'confirm-exit').click();
  await action(page, 'settings').click();
  await editor(page, 'crunch', 'saved');
  await action(page, 'reset-override').click();
  assert.deepEqual(JSON.parse(await stored(page, 'exercise_settings')).exercises, {});
  form = await editor(page, 'crunch', 'saved');
  assert.equal(await form.locator('[name="sets"]').inputValue(), '2');
  assert.equal(await form.locator('[name="restSeconds"]').inputValue(), '45');
  await action(page, 'close-modal').click();
  await saveGlobals(page, { defaultSets: '', defaultRestSeconds: '' });
  await page.reload();
  await select(page, ['crunch']);
  await action(page, 'start').click();
  s = await session(page);
  assert.deepEqual([s.exercises[0].sets, s.exercises[0].restSeconds], [3, 60]);
  assert.equal(s.settings.defaultSets, null);
  assert.equal(s.settings.defaultRestSeconds, null);
  await context.close();
}

async function validationFlow(width, height) {
  const { context, page } = await fresh(width, height);
  await action(page, 'settings').click();
  const original = await stored(page, 'workout_settings');
  const globals = page.locator('#settings-form');
  for (const [key, value, reset] of [['defaultSets', '0', ''], ['defaultSets', '21', ''], ['defaultSets', '1.5', ''], ['defaultRestSeconds', '-1', ''], ['defaultRestSeconds', '1801', ''], ['betweenExerciseRestSeconds', '', '120']]) {
    await fill(globals, { [key]: value });
    assert.equal(await globals.evaluate(form => form.checkValidity()), false);
    await submit(globals);
    assert.equal(await stored(page, 'workout_settings'), original);
    await fill(globals, { [key]: reset });
  }
  const form = await editor(page, 'overhead_triceps_extension', 'saved');
  await action(page, 'close-modal').focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.name), 'sets');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'close-modal');
  await fill(form, { repsMin: 12, repsMax: 8 });
  await submit(form);
  assert.ok((await page.locator('#editor-error').innerText()).includes('최대'));
  await fill(form, { repsMin: 8, repsMax: 12 });
  for (const phases of ['0', '31', '1.5', '', '1-1-1-1-1-1-1', 'abc', '-2-1']) {
    await fill(form, { phases });
    await submit(form);
    assert.ok((await page.locator('#editor-error').innerText()).includes('Tempo'));
    assert.equal(await stored(page, 'exercise_settings'), null);
  }
  await capture(page, `validation-${width}`);
  await fill(form, { sets: 20, restSeconds: 1800, repsMin: 300, repsMax: 300, phases: '30-1' });
  await submit(form);
  const e = JSON.parse(await stored(page, 'exercise_settings')).exercises.overhead_triceps_extension;
  assert.deepEqual([e.sets, e.restSeconds, e.reps, e.tempo.phases], [20, 1800, { min: 300, max: 300 }, [30, 1]]);
  await page.reload();
  await action(page, 'settings').click();
  await editor(page, 'dead_bug', 'saved');
  await fill(page.locator('#exercise-form'), { restSeconds: 0, phases: '' });
  await submit(page.locator('#exercise-form'));
  assert.deepEqual(JSON.parse(await stored(page, 'exercise_settings')).exercises.dead_bug.tempo, { enabled: false, phases: [] });
  await context.close();
}

async function storageFailure() {
  const { context, page } = await fresh(390, 844, { crunch: { sets: 1 } });
  const original = await stored(page, 'workout_settings');
  const originalExercise = await stored(page, 'exercise_settings');
  await action(page, 'settings').click();
  await page.evaluate(() => {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (['workout_settings', 'exercise_settings'].includes(key)) throw new DOMException('Test quota', 'QuotaExceededError');
      return write.call(this, key, value);
    };
  });
  await fill(page.locator('#settings-form'), { defaultSets: 2 });
  await submit(page.locator('#settings-form'));
  assert.ok((await page.locator('#notice').innerText()).includes('저장하지 못했습니다'));
  assert.equal(await stored(page, 'workout_settings'), original);
  await page.locator('#notice button').click();
  await action(page, 'home').click();
  await action(page, 'settings').click();
  assert.equal(await page.locator('[name="defaultSets"]').inputValue(), '');
  const form = await editor(page, 'crunch', 'saved');
  await fill(form, { sets: 2 });
  await submit(form);
  assert.equal(await page.locator('[role="dialog"]').count(), 1);
  assert.equal(await stored(page, 'exercise_settings'), originalExercise);
  await page.locator('#notice button').click();
  await action(page, 'reset-override').click();
  assert.equal(await page.locator('[role="dialog"]').count(), 1);
  assert.equal(await stored(page, 'exercise_settings'), originalExercise);
  await context.close();
}

try {
  const port = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('서버 시작 시간 초과')), 5000);
    server.once('message', value => { clearTimeout(timeout); resolve(value.port); });
    server.once('error', error => { clearTimeout(timeout); reject(error); });
    server.once('exit', code => { clearTimeout(timeout); reject(new Error(`서버 종료 ${code}: ${serverError}`)); });
  });
  url = `http://127.0.0.1:${port}`;
  await mkdir(output, { recursive: true });
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
  for (const [width, height] of [[360, 800], [390, 844], [1280, 900]]) {
    for (const [name, run] of [['rest-complete', restFlow], ['zero-rest', zeroFlow], ['settings', settingsFlow], ['validation', validationFlow]]) {
      await run(width, height);
      results.push({ name, width, height, passed: true });
      console.log(`PASS ${width}×${height} ${name}`);
    }
  }
  await storageFailure();
  results.push({ name: 'settings-storage-failure', passed: true });
  assert.deepEqual(errors, []);
  await writeFile(`${output}result.json`, JSON.stringify(results, null, 2));
  console.log('5·6단계 브라우저 시나리오 13개 통과. 이어하기·시간 운동·실제 사운드·기기 기능·GAS는 검수하지 않았습니다.');
} finally {
  await browser?.close();
  server.kill();
}
