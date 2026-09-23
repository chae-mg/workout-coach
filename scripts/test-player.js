import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { EXERCISES } from '../apps/web/src/data/exercises.js';
import { DEFAULT_SETTINGS } from '../apps/web/src/core/settings.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = fileURLToPath(new URL('../test-results/stage4/', import.meta.url));
const settings = { ...DEFAULT_SETTINGS, defaultRestSeconds: 0, betweenExerciseRestSeconds: 0, tempoSound: false, restSound: false, countdownSound: false, wakeLock: false };
const server = spawn(process.execPath, ['scripts/serve.js'], {
  cwd: root, env: { ...process.env, PORT: '0', HOST: '127.0.0.1', WORKOUT_PREVIEW: '' }, stdio: ['ignore', 'ignore', 'pipe', 'ipc']
});
let serverError = '';
server.stderr.on('data', data => { serverError += data; });
let browser;
const errors = [];
const results = [];
const snapshot = page => page.evaluate(() => JSON.parse(localStorage.getItem('active_session')));
const advance = (page, ms = 500) => page.evaluate(ms => { window.__playerNow += ms; }, ms);
const click = (page, action) => page.locator(`[data-action="${action}"]`).evaluate(button => button.click());
const double = (page, action) => page.evaluate(action => {
  document.querySelector(`[data-action="${action}"]`).click();
  document.querySelector(`[data-action="${action}"]`)?.click();
}, action);

async function checkPlayer(page, id, set, sets, count, total) {
  const e = EXERCISES.find(e => e.id === id);
  assert.equal(await page.locator('#screen-title').textContent(), e.name);
  assert.equal(await page.locator('.name-en').textContent(), e.nameEn);
  assert.equal(await page.locator('.target').textContent(), e.target);
  assert.equal(await page.locator('.goal').textContent(), `${e.type === 'BOTH_SIDE_REPS' ? '좌우 각각 ' : ''}${e.reps.min}~${e.reps.max}회`);
  assert.equal(await page.locator('.set').textContent(), `SET ${set} / ${sets}`);
  assert.equal(await page.locator('progress').getAttribute('value'), String(count));
  assert.equal(await page.locator('progress').getAttribute('max'), String(total));
  assert.equal(await page.locator('nav').count(), 0);
  if (e.type === 'BOTH_SIDE_REPS') assert.ok((await page.locator('.player').innerText()).includes('양쪽을 모두 수행한 뒤 세트 완료를 눌러 주세요.'));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
}

async function start(url, width, height, ids, globals) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript(globals => {
    localStorage.setItem('workout_settings', JSON.stringify(globals));
    // Control event times without sleeping or letting later-stage timers expire.
    window.__playerNow = 10000;
    Date.now = () => window.__playerNow;
  }, globals);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(url);
  for (const id of ids) await page.locator(`[data-action="select"][data-id="${id}"]`).click();
  await page.locator('[data-action="review"]').click();
  await page.locator('[data-action="start"]').click();
  return { context, page };
}

try {
  const port = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('서버 시작 시간 초과')), 5000);
    server.once('message', value => { clearTimeout(timeout); resolve(value.port); });
    server.once('error', error => { clearTimeout(timeout); reject(error); });
    server.once('exit', code => { clearTimeout(timeout); reject(new Error(`서버 종료 ${code}: ${serverError}`)); });
  });
  await mkdir(output, { recursive: true });
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
  const url = `http://127.0.0.1:${port}`;
  for (const [width, height] of [[360, 800], [390, 844], [1280, 900]]) {
    {
      const { context, page } = await start(url, width, height, ['squat', 'one_arm_row', 'overhead_triceps_extension'], settings);
      await checkPlayer(page, 'squat', 1, 3, 0, 9);
      await page.locator('[data-action="complete-set"]').dblclick({ delay: 100 });
      await checkPlayer(page, 'squat', 2, 3, 1, 9);
      await advance(page, 499);
      await click(page, 'complete-set');
      assert.equal((await snapshot(page)).results[0].completed, 1);
      await advance(page, 1);
      await click(page, 'complete-set');
      await checkPlayer(page, 'squat', 3, 3, 2, 9);
      await advance(page);
      await click(page, 'complete-set');
      await checkPlayer(page, 'one_arm_row', 1, 3, 3, 9);
      await page.screenshot({ path: `${output}both-sides-${width}.png` });
      await advance(page);
      // Replay an earlier revision through the currently rendered control.
      await page.locator('[data-action="complete-set"]').evaluate(button => { button.dataset.revision = '0'; button.click(); });
      assert.equal((await snapshot(page)).results[1].completed, 0);
      await page.locator('[data-action="complete-set"]').evaluate(button => {
        button.dataset.revision = String(JSON.parse(localStorage.getItem('active_session')).revision);
      });
      await click(page, 'complete-set');
      await checkPlayer(page, 'one_arm_row', 2, 3, 4, 9);
      // A rapid change from completion to skip must not affect the next set either.
      await click(page, 'skip-exercise');
      assert.equal((await snapshot(page)).exerciseIndex, 1);
      assert.equal((await snapshot(page)).results[1].skipped, 0);
      await advance(page);
      await double(page, 'skip-exercise');
      const s = await snapshot(page);
      assert.deepEqual(s.results.map(r => [r.completed, r.skipped]), [[3, 0], [1, 2], [0, 0]]);
      assert.equal(s.status, 'EXERCISE');
      await checkPlayer(page, 'overhead_triceps_extension', 1, 3, 6, 9);
      await page.screenshot({ path: `${output}long-name-${width}.png` });
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const fits = await page.locator('[data-action="complete-set"]').evaluate(button => { const r = button.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.height >= 48; });
      assert.equal(fits, true);
      await page.screenshot({ path: `${output}actions-${width}.png` });
      results.push({ width, scenario: 'zero-rest', completed: 4, skipped: 2, next: s.exercises[s.exerciseIndex].id, fits });
      await context.close();
    }
    {
      const { context, page } = await start(url, width, height, ['one_arm_row', 'squat'], { ...settings, defaultSets: 1 });
      await checkPlayer(page, 'one_arm_row', 1, 1, 0, 2);
      await double(page, 'complete-set');
      await checkPlayer(page, 'squat', 1, 1, 1, 2);
      assert.deepEqual((await snapshot(page)).results.map(r => r.completed), [1, 0]);
      results.push({ width, scenario: 'one-set', next: 'squat' });
      await context.close();
    }
    for (const sets of [1, 3]) {
      const { context, page } = await start(url, width, height, ['one_arm_row', 'push_up'], { ...settings, defaultSets: sets, defaultRestSeconds: 30, betweenExerciseRestSeconds: 45 });
      await double(page, 'complete-set');
      const s = await snapshot(page);
      assert.equal(s.status, 'REST');
      assert.equal(s.exerciseIndex, sets === 1 ? 1 : 0);
      assert.equal(s.currentSet, sets === 1 ? 1 : 2);
      assert.equal(s.results[0].completed, 1);
      assert.equal(await page.locator('.next strong').textContent(), sets === 1 ? '팔굽혀펴기' : '원암 덤벨 로우');
      assert.ok((await page.locator('.next').innerText()).includes(`SET ${s.currentSet} / ${sets}`));
      results.push({ width, scenario: `rest-target-${sets}`, next: s.exercises[s.exerciseIndex].id, set: s.currentSet });
      await context.close();
    }
    console.log(`PASS ${width}×${height}: 반복·좌우 반복·1/3세트·중복 클릭·건너뛰기·휴식 다음 대상`);
  }
  assert.deepEqual(errors, []);
  await writeFile(`${output}result.json`, JSON.stringify(results, null, 2));
  console.log('4단계 브라우저 검증 12개 통과. 휴식 만료·조정·완료 화면·시간 운동·사운드·GAS는 검수하지 않았습니다.');
} finally {
  await browser?.close();
  server.kill();
}
