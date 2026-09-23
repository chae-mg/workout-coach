import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { EXERCISES } from '../apps/web/src/data/exercises.js';
import { DEFAULT_SETTINGS, clone, resolveExercise } from '../apps/web/src/core/settings.js';
import { createSession } from '../apps/web/src/core/session.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = fileURLToPath(new URL('../test-results/stage7-8/', import.meta.url));
const settings = { ...DEFAULT_SETTINGS, tempoSound: false, restSound: false, countdownSound: false, wakeLock: false };
const server = spawn(process.execPath, ['scripts/serve.js'], {
  cwd: root, env: { ...process.env, PORT: '0', HOST: '127.0.0.1', WORKOUT_PREVIEW: '' }, stdio: ['ignore', 'ignore', 'pipe', 'ipc']
});
let serverError = '';
server.stderr.on('data', data => { serverError += data; });
let browser;
let url;
const errors = [];
const results = [];
const action = (page, name) => page.locator(`[data-action="${name}"]`);
const state = page => page.evaluate(() => JSON.parse(localStorage.getItem('active_session')));
const advance = (page, ms) => page.evaluate(ms => localStorage.setItem('__resume_now', String(Date.now() + ms)), ms);
const waitState = (page, status) => page.waitForFunction(status => JSON.parse(localStorage.getItem('active_session')).status === status, status);
const submit = form => form.evaluate(form => form.requestSubmit());
function observe(page) {
  page.setDefaultTimeout(5000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
}
async function fresh(width = 390, height = 844, globals = settings, initial = null, fail = '') {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript(({ globals, initial, fail }) => {
    if (!localStorage.getItem('__resume_seeded')) {
      localStorage.setItem('workout_settings', JSON.stringify(globals));
      if (initial !== null) localStorage.setItem('active_session', typeof initial === 'string' ? initial : JSON.stringify(initial));
      localStorage.setItem('__resume_now', '10000');
      localStorage.setItem('__resume_seeded', '1');
    }
    Date.now = () => Number(localStorage.getItem('__resume_now'));
    if (fail) {
      const method = Storage.prototype[fail];
      Storage.prototype[fail] = function(key, ...args) {
        if (key === 'active_session') throw new DOMException('Test storage failure', 'SecurityError');
        return method.call(this, key, ...args);
      };
    }
  }, { globals, initial, fail });
  const page = await context.newPage();
  observe(page);
  await page.goto(url);
  return { context, page };
}
async function plan(page, ids) {
  for (const id of ids) await page.locator(`[data-action="select"][data-id="${id}"]`).click();
  await action(page, 'review').click();
}
async function edit(page, id, values) {
  await page.locator(`[data-action="edit-today"][data-id="${id}"]`).click();
  const form = page.locator('#exercise-form');
  for (const [key, value] of Object.entries(values)) await form.locator(`[name="${key}"]`).fill(String(value));
  await submit(form);
}
async function reload(page) {
  await page.reload();
  await page.locator('[role="dialog"]').waitFor();
  assert.equal(await page.locator('#page').getAttribute('inert'), '');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'resume');
}
async function capture(page, name) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: `${output}${name}.png` });
}
async function mixed(width, height) {
  const { context, page: original } = await fresh(width, height, { ...settings, defaultSets: 2, defaultRestSeconds: 0, betweenExerciseRestSeconds: 0 });
  let page = original;
  await plan(page, ['warm_up', 'plank', 'squat']);
  await edit(page, 'warm_up', { durationSeconds: 2 });
  await edit(page, 'plank', { sets: 2, durationSeconds: 5 });
  await edit(page, 'squat', { sets: 1, repsMin: 1, repsMax: 1, phases: '1' });
  assert.deepEqual(await page.locator('.stats strong').allTextContents(), ['3', '3+1', '1분']);
  await action(page, 'start').click();
  assert.equal((await state(page)).exercises[0].sets, 1);
  assert.equal(await page.locator('#timer').textContent(), '00:02');
  await advance(page, 10000);
  assert.equal((await state(page)).results[0].completed, 0);
  await action(page, 'start-timer').click();
  await advance(page, 1250);
  await action(page, 'pause-timer').click();
  assert.equal((await state(page)).timerRemainingMs, 750);
  await advance(page, 20000);
  await reload(page);
  assert.ok((await page.locator('[role="dialog"]').innerText()).includes('남은 시간 00:01'));
  await capture(page, `paused-resume-${width}`);
  await action(page, 'resume').click();
  assert.equal((await state(page)).timerPaused, true);
  // Close and reopen a tab in the same isolated browser context.
  await page.close();
  page = await context.newPage();
  observe(page);
  await page.goto(url);
  await action(page, 'resume').click();
  assert.equal((await state(page)).timerRemainingMs, 750);
  await action(page, 'start-timer').click();
  await advance(page, 750);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('active_session')).exerciseIndex === 1);
  assert.equal((await state(page)).results[0].completed, 1);
  assert.equal((await state(page)).timerPaused, true);
  await advance(page, 60000);
  assert.equal((await state(page)).results[1].completed, 0);
  await capture(page, `time-waiting-${width}`);
  await action(page, 'start-timer').click();
  await advance(page, 5000);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('active_session')).currentSet === 2);
  assert.equal((await state(page)).results[1].completed, 1);
  assert.equal((await state(page)).timerPaused, true);
  await action(page, 'start-timer').click();
  const endAt = (await state(page)).timerEndAt;
  await advance(page, 2000);
  await reload(page);
  await action(page, 'resume').click();
  assert.equal((await state(page)).timerEndAt, endAt);
  assert.equal(await page.locator('#timer').textContent(), '00:03');
  await advance(page, 3000);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('active_session')).exerciseIndex === 2);
  await action(page, 'complete-set').click();
  await waitState(page, 'COMPLETE');
  assert.deepEqual(await page.locator('.stats strong').allTextContents(), ['3', '4', '0']);
  const finished = await state(page);
  await page.reload();
  assert.deepEqual(await state(page), finished);
  assert.equal(await page.locator('[role="dialog"]').count(), 0);
  await capture(page, `mixed-complete-${width}`);
  await action(page, 'done').click();
  assert.equal(await state(page), null);
  await context.close();
}
async function repsRest(width, height) {
  const globals = { ...settings, defaultSets: 2, defaultRestSeconds: 5, betweenExerciseRestSeconds: 7 };
  const { context, page } = await fresh(width, height, globals);
  await plan(page, ['squat', 'one_arm_row']);
  await action(page, 'start').click();
  await action(page, 'complete-set').click();
  const before = await state(page);
  await reload(page);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('[role="dialog"]').count(), 1);
  await action(page, 'new-session').focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'resume');
  await advance(page, 2000);
  await action(page, 'resume').click();
  assert.equal((await state(page)).restEndAt, before.restEndAt);
  assert.equal(await page.locator('#timer').textContent(), '00:03');
  await reload(page);
  await advance(page, 4000);
  await action(page, 'resume').click();
  assert.equal((await state(page)).status, 'EXERCISE');
  assert.equal((await state(page)).currentSet, 2);
  assert.deepEqual((await state(page)).results, before.results);
  await action(page, 'complete-set').click();
  await action(page, 'skip-rest').click();
  const reps = await state(page);
  await reload(page);
  await action(page, 'resume').click();
  assert.deepEqual(await state(page), reps);
  assert.ok((await page.locator('.goal').innerText()).includes('좌우 각각'));
  await reload(page);
  await action(page, 'new-session').click();
  assert.equal(await state(page), null);
  assert.equal(await page.locator('.selection strong').textContent(), '선택한 운동 0개');
  await page.reload();
  assert.equal(await page.locator('[role="dialog"]').count(), 0);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('workout_settings'))), globals);
  await context.close();
}
async function expired(width, height, restSeconds) {
  const { context, page } = await fresh(width, height, { ...settings, defaultRestSeconds: restSeconds });
  await plan(page, ['plank']);
  await edit(page, 'plank', { durationSeconds: 5 });
  await action(page, 'start').click();
  await action(page, 'start-timer').click();
  await reload(page);
  await advance(page, 100000);
  await action(page, 'resume').click();
  let s = await state(page);
  assert.equal(s.results[0].completed, 1);
  assert.equal(s.currentSet, 2);
  assert.equal(s.timerPaused, true);
  assert.equal(s.timerEndAt, null);
  if (restSeconds) {
    assert.equal(s.status, 'REST');
    assert.equal(s.restEndAt, 110000 + restSeconds * 1000);
    await reload(page);
    await advance(page, 20000);
    await action(page, 'resume').click();
  }
  s = await state(page);
  assert.equal(s.status, 'EXERCISE');
  assert.equal(s.results[0].completed, 1);
  assert.equal(s.timerRemainingMs, 5000);
  assert.equal(await action(page, 'start-timer').textContent(), '타이머 시작');
  await capture(page, `expired-${restSeconds}-${width}`);
  await context.close();
}
async function bounds() {
  const { context, page } = await fresh();
  await action(page, 'settings').click();
  await page.locator('[data-action="edit-exercise"][data-id="warm_up"]').click();
  const form = page.locator('#exercise-form');
  assert.equal(await form.locator('[name="sets"]').count(), 0);
  for (const value of ['0', '7201', '1.5', '']) {
    await form.locator('[name="durationSeconds"]').fill(value);
    assert.equal(await form.evaluate(form => form.checkValidity()), false);
    await submit(form);
    assert.equal(await page.evaluate(() => localStorage.getItem('exercise_settings')), null);
  }
  await form.locator('[name="durationSeconds"]').fill('7200');
  await submit(form);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('exercise_settings')).exercises.warm_up.durationSeconds), 7200);
  await page.locator('[data-action="edit-exercise"][data-id="plank"]').click();
  await page.locator('[name="durationSeconds"]').fill('1');
  await submit(page.locator('#exercise-form'));
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('exercise_settings')).exercises.plank.durationSeconds), 1);
  await context.close();
}
const valid = createSession([resolveExercise(EXERCISES.find(e => e.id === 'plank'), settings)], settings, 1000, 'recovery-fixture');
async function corruption() {
  const cases = [
    ['json', '{broken'], ['old-version', { ...valid, version: 1 }], ['future-version', { ...valid, version: 99 }],
    ['count', { ...valid, results: [{ id: 'plank', completed: 20, skipped: 0 }] }],
    ['remaining', { ...valid, timerRemainingMs: 0 }], ['rest', { ...valid, status: 'REST', restEndAt: null }],
    ['block-sets', { ...valid, exercises: [{ ...valid.exercises[0], type: 'TIME_BLOCK' }] }]
  ];
  for (const [name, initial] of cases) {
    const { context, page } = await fresh(390, 844, settings, initial);
    assert.equal(await page.locator('[role="dialog"]').count(), 0);
    assert.equal(await page.locator('#notice').isVisible(), true);
    await plan(page, ['squat']);
    await action(page, 'start').click();
    assert.equal((await state(page)).exercises[0].id, 'squat');
    await context.close();
    results.push({ name: `corrupt-${name}`, passed: true });
  }
}
async function failures() {
  for (const fail of ['getItem', 'setItem', 'removeItem']) {
    const { context, page } = await fresh(390, 844, settings, fail === 'setItem' ? null : clone(valid), fail);
    if (fail === 'getItem') {
      assert.equal(await page.locator('[role="dialog"]').count(), 0);
      assert.equal(await page.locator('#notice').isVisible(), true);
      await plan(page, ['plank']);
      await action(page, 'start').click();
      assert.equal(await page.locator('#screen-title').textContent(), '플랭크');
    } else if (fail === 'setItem') {
      await plan(page, ['plank']);
      await action(page, 'start').click();
      assert.ok((await page.locator('#notice').innerText()).includes('저장하지 못했습니다'));
      assert.equal(await state(page), null);
      await action(page, 'start-timer').click();
      await advance(page, 2000);
      await action(page, 'pause-timer').click();
      assert.equal(await page.locator('#timer').textContent(), '00:28');
      await page.reload();
      assert.equal(await page.locator('[role="dialog"]').count(), 0);
    } else {
      await action(page, 'new-session').click();
      assert.equal(await page.locator('.selection strong').textContent(), '선택한 운동 0개');
      assert.ok((await page.locator('#notice').innerText()).includes('삭제하지 못해'));
      assert.deepEqual(await state(page), valid);
      await page.reload();
      assert.equal(await page.locator('[role="dialog"]').count(), 1);
    }
    await context.close();
    results.push({ name: `storage-${fail}`, passed: true });
  }
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
    for (const [name, run] of [['mixed', mixed], ['reps-rest', repsRest], ['expired-rest', (w, h) => expired(w, h, 10)], ['expired-zero', (w, h) => expired(w, h, 0)]]) {
      await run(width, height);
      results.push({ name, width, height, passed: true });
      console.log(`PASS ${width}×${height} ${name}`);
    }
  }
  await bounds();
  results.push({ name: 'time-input-bounds', passed: true });
  await corruption();
  await failures();
  assert.deepEqual(errors, []);
  await writeFile(`${output}result.json`, JSON.stringify(results, null, 2));
  console.log(`7·8단계 브라우저 시나리오 ${results.length}개 통과. 실제 모바일·사운드·기기 기능·GAS는 검수하지 않았습니다.`);
} finally {
  await browser?.close();
  server.kill();
}
