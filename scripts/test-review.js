import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { EXERCISES } from '../apps/web/src/data/exercises.js';
import { DEFAULT_SETTINGS } from '../apps/web/src/core/settings.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = fileURLToPath(new URL('../test-results/stage3/', import.meta.url));
// Start exercises without requesting audio or device effects; those have later stages.
const settings = { ...DEFAULT_SETTINGS, tempoSound: false, restSound: false, countdownSound: false, wakeLock: false };
const cases = [
  { name: 'single', ids: ['squat'], minutes: 9 },
  { name: 'three', ids: ['one_arm_row', 'push_up', 'dead_bug'], minutes: 23 },
  { name: 'eight', ids: EXERCISES.slice(0, 8).map(e => e.id), minutes: 61 }
];
const server = spawn(process.execPath, ['scripts/serve.js'], {
  cwd: root, env: { ...process.env, PORT: '0', HOST: '127.0.0.1', WORKOUT_PREVIEW: '' },
  stdio: ['ignore', 'ignore', 'pipe', 'ipc']
});
let serverError = '';
server.stderr.on('data', data => { serverError += data; });
let browser;
const errors = [];
const results = [];

async function checkReview(page, scenario) {
  const expected = scenario.ids.map(id => EXERCISES.find(e => e.id === id));
  assert.deepEqual(await page.locator('.review-row strong').allTextContents(), expected.map(e => e.name));
  assert.deepEqual(await page.locator('.review-row .number').allTextContents(), expected.map((_, i) => String(i + 1).padStart(2, '0')));
  assert.deepEqual(await page.locator('.stats strong').allTextContents(), [String(expected.length), String(expected.length * 3), `${scenario.minutes}분`]);
  for (let i = 0; i < expected.length; i++) {
    const e = expected[i];
    const goal = `${e.type === 'BOTH_SIDE_REPS' ? '좌우 각각 ' : ''}${e.reps.min}~${e.reps.max}회`;
    assert.equal(await page.locator('.review-row .details p').nth(i).innerText(), `${goal} · ${e.sets}세트\n세트 휴식 ${e.restSeconds}초`);
  }
  assert.ok((await page.locator('main').innerText()).includes('실제 수행 속도에 따라 달라집니다.'));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
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
  for (const [width, height] of [[360, 800], [390, 844], [1280, 900]]) {
    for (const scenario of cases) {
      const context = await browser.newContext({ viewport: { width, height } });
      await context.addInitScript(value => localStorage.setItem('workout_settings', JSON.stringify(value)), settings);
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
      await page.goto(`http://127.0.0.1:${port}`);
      for (const id of scenario.ids) await page.locator(`[data-action="select"][data-id="${id}"]`).click();
      await page.locator('[data-action="review"]').click();
      await checkReview(page, scenario);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'screen-title');
      await page.locator('.back[data-action="home"]').click();
      assert.equal(await page.locator('.selection p').textContent(), scenario.ids.map(id => EXERCISES.find(e => e.id === id).name).join(' → '));
      await page.locator('[data-action="review"]').click();
      await checkReview(page, scenario);
      await page.screenshot({ path: `${output}${scenario.name}-${width}.png` });
      // Scroll to the end as a user would; viewport scrolling alone ignores the fixed menu.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const buttonFits = await page.locator('[data-action="start"]').evaluate(button => {
        const rect = button.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= document.querySelector('nav').getBoundingClientRect().top && rect.height >= 48;
      });
      assert.equal(buttonFits, true);
      if (scenario.name === 'eight') await page.screenshot({ path: `${output}eight-bottom-${width}.png` });
      await page.locator('[data-action="start"]').click();
      const first = EXERCISES.find(e => e.id === scenario.ids[0]);
      assert.equal(await page.locator('#screen-title').textContent(), first.name);
      assert.equal(await page.locator('.set').textContent(), 'SET 1 / 3');
      assert.equal(await page.locator('nav').count(), 0);
      const session = await page.evaluate(() => JSON.parse(localStorage.getItem('active_session')));
      assert.deepEqual(session.exercises, scenario.ids.map(id => EXERCISES.find(e => e.id === id)));
      assert.deepEqual(session.settings, settings);
      assert.equal(session.exerciseIndex, 0);
      assert.equal(session.currentSet, 1);
      assert.equal(session.status, 'EXERCISE');
      assert.equal(session.results.every(r => r.completed === 0 && r.skipped === 0), true);
      assert.ok(session.startedAt > 0 && session.sessionId);
      results.push({ width, height, scenario: scenario.name, exerciseCount: scenario.ids.length, sets: scenario.ids.length * 3, minutes: scenario.minutes, first: first.id, buttonFits });
      await context.close();
      console.log(`PASS ${width}×${height} ${scenario.name}: 확인·돌아가기·시작`);
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(`${output}result.json`, JSON.stringify(results, null, 2));
  console.log('3단계 검증 통과. 세트 수행·휴식·설정 편집·복구·사운드·GAS 시나리오는 실행하지 않았습니다.');
} finally {
  await browser?.close();
  server.kill();
}
