import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { EXERCISES } from '../apps/web/src/data/exercises.js';
import { DEFAULT_SETTINGS } from '../apps/web/src/core/settings.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = fileURLToPath(new URL('../test-results/stage11/', import.meta.url));
const server = spawn(process.execPath, ['scripts/serve.js'], {
  cwd: root, env: { ...process.env, PORT: '0', HOST: '127.0.0.1', WORKOUT_PREVIEW: '' }, stdio: ['ignore', 'ignore', 'pipe', 'ipc']
});
let serverError = '', browser, url;
server.stderr.on('data', chunk => { serverError += chunk; });
const errors = [], results = [];
const settings = { ...DEFAULT_SETTINGS, defaultRestSeconds: 5, betweenExerciseRestSeconds: 5, tempoSound: false, countdownSound: false, restSound: false, wakeLock: false };
const action = (page, name) => page.locator(`[data-action="${name}"]`);
const state = page => page.evaluate(() => JSON.parse(localStorage.getItem('active_session')));
const advance = (page, ms = 600) => page.evaluate(ms => localStorage.setItem('__mobile_now', String(Date.now() + ms)), ms);
async function inspect(page, name) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name);
  await page.screenshot({ path: `${output}${name}.png`, fullPage: true });
}
async function press(page, locator, primary = false) {
  await locator.evaluate(node => node.scrollIntoView({ block: 'center' }));
  if (primary && await page.locator('nav').count()) await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const metrics = await locator.evaluate(node => {
    const r = node.getBoundingClientRect(), nav = document.querySelector('nav');
    const top = nav ? nav.getBoundingClientRect().top : innerHeight;
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { height: r.height, bottom: r.bottom, top, hittable: hit === node || node.contains(hit) };
  });
  assert.ok(metrics.height >= (primary ? 48 : 44), JSON.stringify(metrics));
  assert.ok(metrics.hittable, `Button obscured: ${JSON.stringify(metrics)}`);
  if (primary) assert.ok(metrics.bottom <= metrics.top + 1, 'Primary button overlaps navigation or viewport');
  if (page.viewportSize().width < 1000) await locator.tap();
  else await locator.click();
}
async function fresh(width, height) {
  const touch = width < 1000;
  const context = await browser.newContext({ viewport: { width, height }, isMobile: touch, hasTouch: touch });
  await context.addInitScript(settings => {
    if (!localStorage.getItem('__mobile_seeded')) {
      localStorage.setItem('workout_settings', JSON.stringify(settings));
      localStorage.setItem('__mobile_now', '10000');
      localStorage.setItem('__mobile_seeded', '1');
    }
    Date.now = () => Number(localStorage.getItem('__mobile_now'));
  }, settings);
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(url);
  await page.locator('.exercise-card').first().waitFor();
  assert.ok(await page.locator('.exercise-card img').evaluateAll(async images => {
    await Promise.all(images.map(image => image.decode()));
    return images.every(image => image.naturalWidth > 0);
  }));
  return { context, page };
}
async function scenario(width, height, kind) {
  const { context, page } = await fresh(width, height);
  const tag = `${kind}-${width}x${height}`;
  const ids = kind === 'eight' ? EXERCISES.slice(0, 8).map(e => e.id) : kind === 'mixed' ? ['one_arm_row', 'plank', 'warm_up'] : ['squat'];
  for (const id of ids) await press(page, page.locator(`[data-action="select"][data-id="${id}"]`));
  if (kind === 'eight') await inspect(page, `home-${tag}`);
  await press(page, action(page, 'review'), true);
  if (kind === 'eight') await inspect(page, `review-${tag}`);
  if (kind === 'mixed') {
    for (const id of ['plank', 'warm_up']) {
      await press(page, page.locator(`[data-action="edit-today"][data-id="${id}"]`));
      await page.locator('[name="durationSeconds"]').fill('1');
      if (id === 'plank') await page.locator('[name="sets"]').fill('2');
      if (id === 'plank') await inspect(page, `editor-${tag}`);
      await press(page, page.locator('#exercise-form button[type="submit"]'), true);
    }
  }
  await press(page, action(page, 'start'), true);
  let pausedChecked = false, restChecked = false, playerChecked = false;
  for (let attempts = 0; attempts < 100; attempts++) {
    const current = await state(page);
    if (current.status === 'COMPLETE') break;
    assert.equal(await page.locator('nav').count(), 0);
    const exercise = current.exercises[current.exerciseIndex];
    if (current.status === 'REST') {
      if (!restChecked) {
        await inspect(page, `rest-${tag}`);
        await press(page, page.locator('[data-action="adjust-rest"][data-seconds="15"]'));
        assert.equal((await state(page)).restEndAt, current.restEndAt + 15000);
        await page.reload();
        await press(page, action(page, 'resume'), true);
        assert.equal((await state(page)).restEndAt, current.restEndAt + 15000);
        await press(page, page.locator('[data-action="adjust-rest"][data-seconds="-15"]'));
        assert.equal((await state(page)).restEndAt, current.restEndAt);
        await press(page, action(page, 'skip-rest'), true);
        restChecked = true;
      } else {
        await advance(page, 6000);
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('active_session')).status !== 'REST');
      }
    } else if (exercise.reps) {
      if (!playerChecked && (kind !== 'eight' || exercise.id === 'overhead_triceps_extension')) {
        await inspect(page, `player-${tag}`);
        playerChecked = true;
      }
      await advance(page);
      await press(page, action(page, 'complete-set'), true);
      assert.equal((await state(page)).results[current.exerciseIndex].completed, current.results[current.exerciseIndex].completed + 1);
    } else {
      await press(page, action(page, 'start-timer'), true);
      if (!pausedChecked && exercise.id === 'plank') {
        await advance(page, 300);
        await press(page, action(page, 'pause-timer'), true);
        assert.equal((await state(page)).timerRemainingMs, 700);
        await inspect(page, `paused-${tag}`);
        await page.reload();
        await inspect(page, `resume-${tag}`);
        await press(page, action(page, 'resume'), true);
        assert.equal((await state(page)).timerRemainingMs, 700);
        await press(page, action(page, 'start-timer'), true);
        pausedChecked = true;
      }
      const runningRevision = (await state(page)).revision;
      await advance(page, 1000);
      await page.waitForFunction(revision => JSON.parse(localStorage.getItem('active_session')).revision > revision, runningRevision);
    }
  }
  const finished = await state(page);
  assert.equal(finished.status, 'COMPLETE');
  assert.deepEqual(finished.exercises.map(e => e.id), ids);
  assert.deepEqual(finished.results.map(r => r.completed), finished.exercises.map(e => e.sets));
  assert.ok(finished.results.every(r => r.skipped === 0));
  if (kind === 'eight') assert.equal(finished.results.reduce((n, r) => n + r.completed, 0), 24);
  if (kind === 'mixed') assert.equal(pausedChecked, true);
  await inspect(page, `complete-${tag}`);
  await press(page, action(page, 'done'), true);
  assert.equal(await state(page), null);
  results.push({ name: tag, passed: true, units: finished.results.reduce((n, r) => n + r.completed, 0), touch: width < 1000, controlledClock: true });
  await context.close();
}
try {
  const port = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('서버 시작 시간 초과')), 5000);
    server.once('message', message => { clearTimeout(timeout); resolve(message.port); });
    server.once('error', error => { clearTimeout(timeout); reject(error); });
    server.once('exit', code => { clearTimeout(timeout); reject(new Error(`서버 종료 ${code}: ${serverError}`)); });
  });
  url = `http://127.0.0.1:${port}`;
  await mkdir(output, { recursive: true });
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
  for (const [width, height] of [[360, 800], [390, 844], [412, 915], [844, 390], [1280, 900]]) {
    for (const kind of ['single', 'eight', 'mixed']) {
      await scenario(width, height, kind);
      console.log(`PASS ${kind} ${width}×${height}`);
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(`${output}result.json`, JSON.stringify(results, null, 2));
  console.log(`11단계 화면·전체 흐름 ${results.length}개 통과. Android 실기기 검수는 별도로 필요합니다.`);
} finally {
  await browser?.close();
  server.kill();
}
