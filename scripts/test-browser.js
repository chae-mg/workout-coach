import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  if (!process.env.WORKOUT_PLAYWRIGHT_PATH) {
    throw new Error('playwright를 개발 의존성으로 설치하거나 WORKOUT_PLAYWRIGHT_PATH에 설치 경로를 지정해 주세요.');
  }
  playwright = require(process.env.WORKOUT_PLAYWRIGHT_PATH);
}
const root = fileURLToPath(new URL('../', import.meta.url));
const output = fileURLToPath(new URL(process.env.WORKOUT_PREVIEW === 'gas' ? '../test-results/gas/' : '../test-results/local/', import.meta.url));
let url;
const server = spawn(process.execPath, ['scripts/serve.js'], {
  cwd: root, env: { ...process.env, PORT: '0', HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe', 'ipc']
});
let serverError = '';
server.stderr.on('data', chunk => { serverError += chunk; });
let browser;
let passed = 0;
const failures = [];
const errors = [];
const screenshots = [];
const requestedPaths = new Set();
const failedResponses = [];
const pause = milliseconds => new Promise(done => setTimeout(done, milliseconds));
const settings = {
  version: 2, defaultSets: null, defaultRestSeconds: null, betweenExerciseRestSeconds: 0,
  tempoSound: false, restSound: false, countdownSound: false, wakeLock: false
};
async function fresh(width = 390, height = 844, initial = {}) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript(({ settings, initial }) => {
    // Seed once: reload must exercise the actual app's storage writes.
    if (!localStorage.getItem('__test_seeded')) {
      localStorage.setItem('workout_settings', JSON.stringify(settings));
      for (const [key, value] of Object.entries(initial)) localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      localStorage.setItem('__test_seeded', '1');
    }
  }, { settings, initial });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.url().startsWith(url)) requestedPaths.add(new URL(request.url()).pathname);
  });
  page.on('response', response => {
    if (response.url().startsWith(url) && response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(url);
  await page.locator('.exercise-card').first().waitFor();
  return { context, page };
}
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`FAIL ${name}\n${error.stack}`); }
}
const action = (page, name) => page.locator(`[data-action="${name}"]`);
const select = (page, id) => page.locator(`.exercise-card[data-id="${id}"]`).click();
const storedSession = page => page.evaluate(() => JSON.parse(localStorage.getItem('active_session')));
async function editToday(page, id, values) {
  await page.locator(`[data-action="edit-today"][data-id="${id}"]`).click();
  const form = page.locator('#exercise-form');
  for (const [name, value] of Object.entries(values)) await form.locator(`[name="${name}"]`).fill(String(value));
  await form.locator('button[type="submit"]').click();
}
async function capture(page, name) {
  const path = `${output}${name}.png`;
  await page.screenshot({ path, fullPage: true });
  screenshots.push(path);
}
try {
  const port = await new Promise((done, reject) => {
    const timeout = setTimeout(() => reject(new Error('Test server did not become ready')), 5000);
    server.once('message', message => { clearTimeout(timeout); done(message.port); });
    server.once('error', error => { clearTimeout(timeout); reject(error); });
    server.once('exit', () => { clearTimeout(timeout); reject(new Error(`Test server failed: ${serverError}`)); });
  });
  url = `http://127.0.0.1:${port}`;
  await mkdir(output, { recursive: true });
  browser = await playwright.chromium.launch({ headless: true, ...(process.env.WORKOUT_BROWSER_CHANNEL ? { channel: process.env.WORKOUT_BROWSER_CHANNEL } : {}) });

  await test('selection order, filtering, deselect and reselect', async () => {
    const { context, page } = await fresh();
    assert.equal(await action(page, 'review').isDisabled(), true);
    for (const id of ['squat', 'push_up', 'crunch', 'push_up', 'push_up']) await select(page, id);
    await page.locator('[data-action="filter"][data-id="upper"]').click();
    assert.equal(await page.locator('.exercise-card[data-id="push_up"] .order').textContent(), '3');
    await action(page, 'review').click();
    assert.deepEqual(await page.locator('.review-row strong').allTextContents(), ['스쿼트', '크런치', '팔굽혀펴기']);
    await capture(page, 'review-390');
    await context.close();
  });

  await test('today overrides, rest resume, both-side guidance, skip and final summary', async () => {
    const { context, page } = await fresh();
    await select(page, 'squat'); await select(page, 'one_arm_row');
    await action(page, 'review').click();
    await editToday(page, 'squat', { sets: 2, restSeconds: 30 });
    await editToday(page, 'one_arm_row', { sets: 1 });
    await action(page, 'start').click();
    await capture(page, 'player-390');
    await action(page, 'complete-set').click();
    assert.equal((await storedSession(page)).currentSet, 2);
    const deadline = (await storedSession(page)).restEndAt;
    await page.locator('[data-action="adjust-rest"][data-seconds="15"]').click();
    assert.equal((await storedSession(page)).restEndAt, deadline + 15000);
    await capture(page, 'rest-390');
    await page.reload();
    await page.locator('[role="dialog"]').waitFor();
    await action(page, 'resume').click();
    assert.equal((await storedSession(page)).restEndAt, deadline + 15000);
    await action(page, 'skip-rest').click();
    await action(page, 'complete-set').click();
    await page.locator('#screen-title').filter({ hasText: '원암 덤벨 로우' }).waitFor();
    assert.match(await page.locator('.goal').textContent(), /좌우 각각/);
    // A deliberate action on the next target must follow the 500 ms progress guard.
    await pause(550);
    await action(page, 'skip-exercise').click();
    await page.locator('#screen-title').filter({ hasText: '오늘 운동을 마쳤어요' }).waitFor();
    const session = await storedSession(page);
    assert.equal(session.status, 'COMPLETE');
    assert.deepEqual(session.results, [{ id: 'squat', completed: 2, skipped: 0 }, { id: 'one_arm_row', completed: 0, skipped: 1 }]);
    assert.equal(await page.evaluate(() => localStorage.getItem('exercise_settings')), null);
    await capture(page, 'complete-390');
    await page.reload();
    await action(page, 'done').click();
    assert.equal(await storedSession(page), null);
    await context.close();
  });

  await test('global settings, per-exercise overrides and reset survive reload', async () => {
    const { context, page } = await fresh();
    await action(page, 'settings').click();
    const globals = page.locator('#settings-form');
    await globals.locator('[name="defaultSets"]').fill('2');
    await globals.locator('[name="defaultRestSeconds"]').fill('45');
    await globals.locator('button[type="submit"]').click();
    await page.locator('#notice button').click();
    await page.locator('[data-action="edit-exercise"][data-id="crunch"]').click();
    const form = page.locator('#exercise-form');
    await form.locator('[name="sets"]').fill('1');
    await form.locator('[name="restSeconds"]').fill('15');
    await form.locator('button[type="submit"]').click();
    await page.reload();
    await select(page, 'crunch'); await select(page, 'squat');
    await action(page, 'review').click(); await action(page, 'start').click();
    const snapshot = await storedSession(page);
    assert.deepEqual(snapshot.exercises.map(e => [e.sets, e.restSeconds]), [[1, 15], [2, 45]]);
    await action(page, 'exit').click(); await action(page, 'confirm-exit').click();
    await action(page, 'settings').click();
    await page.locator('[data-action="edit-exercise"][data-id="crunch"]').click();
    await action(page, 'reset-override').click();
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('exercise_settings')).exercises), {});
    await capture(page, 'settings-390');
    await context.close();
  });

  await test('timed exercise pause, reload, resume and auto completion', async () => {
    const { context, page } = await fresh();
    await select(page, 'plank'); await action(page, 'review').click();
    await editToday(page, 'plank', { sets: 1, durationSeconds: 2 });
    await action(page, 'start').click();
    await action(page, 'start-timer').click();
    await action(page, 'pause-timer').click();
    const remaining = (await storedSession(page)).timerRemainingMs;
    assert.ok(remaining > 0 && remaining <= 2000);
    await page.reload(); await action(page, 'resume').click();
    assert.equal((await storedSession(page)).timerRemainingMs, remaining);
    assert.equal((await storedSession(page)).timerPaused, true);
    await action(page, 'start-timer').click();
    await action(page, 'done').waitFor({ timeout: 5000 });
    assert.equal((await storedSession(page)).results[0].completed, 1);
    await context.close();
  });

  await test('expired rest resumes at the next set without crediting extra sets', async () => {
    const { context, page } = await fresh();
    await select(page, 'squat'); await action(page, 'review').click();
    await editToday(page, 'squat', { sets: 2, restSeconds: 1 });
    await action(page, 'start').click(); await action(page, 'complete-set').click();
    await page.reload(); await action(page, 'resume').waitFor();
    await pause(1200); await action(page, 'resume').click();
    await action(page, 'complete-set').waitFor();
    const session = await storedSession(page);
    assert.equal(session.currentSet, 2); assert.equal(session.results[0].completed, 1);
    await context.close();
  });

  await test('time block is one unit and completes automatically', async () => {
    const { context, page } = await fresh();
    await select(page, 'warm_up'); await action(page, 'review').click();
    await editToday(page, 'warm_up', { durationSeconds: 1 });
    await action(page, 'start').click(); await action(page, 'start-timer').click();
    await action(page, 'done').waitFor({ timeout: 4000 });
    const session = await storedSession(page);
    assert.equal(session.exercises[0].sets, 1); assert.equal(session.results[0].completed, 1);
    await context.close();
  });

  await test('invalid saved data recovers and invalid rep range remains editable', async () => {
    const { context, page } = await fresh(390, 844, { active_session: { version: 2, status: 'REST' }, exercise_settings: '{broken' });
    assert.equal(await page.locator('[role="dialog"]').count(), 0);
    assert.equal(await page.locator('#notice').isVisible(), true);
    await page.locator('#notice button').click();
    await select(page, 'squat'); await action(page, 'review').click();
    await page.locator('[data-action="edit-today"][data-id="squat"]').click();
    const form = page.locator('#exercise-form');
    await form.locator('[name="repsMin"]').fill('30');
    await form.locator('[name="repsMax"]').fill('10');
    await form.locator('button[type="submit"]').click();
    assert.equal(await page.locator('#editor-error').isVisible(), true);
    assert.equal(await form.locator('[name="repsMin"]').inputValue(), '30');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('[role="dialog"]').count(), 0);
    await context.close();
  });

  await test('zero-rest double click cannot complete two sets', async () => {
    const { context, page } = await fresh();
    await select(page, 'squat'); await action(page, 'review').click();
    await editToday(page, 'squat', { sets: 3, restSeconds: 0 });
    await action(page, 'start').click();
    await action(page, 'complete-set').click();
    await action(page, 'complete-set').click();
    assert.equal((await storedSession(page)).results[0].completed, 1);
    await context.close();
  });

  await test('tempo phases, countdown, rest-end audio and session sound toggle', async () => {
    const { context, page } = await fresh(390, 844, { workout_settings: { ...settings, tempoSound: true, restSound: true, countdownSound: true } });
    await page.evaluate(() => {
      const NativeAudio = window.AudioContext;
      window.__audioCalls = [];
      let id = 0;
      window.AudioContext = class extends NativeAudio {
        constructor() { super(); window.__testAudioContext = this; }
        createOscillator() {
          const oscillator = super.createOscillator();
          const oscillatorId = ++id;
          const start = oscillator.start.bind(oscillator), stop = oscillator.stop.bind(oscillator);
          oscillator.start = at => { window.__audioCalls.push({ id: oscillatorId, op: 'start', frequency: oscillator.frequency.value, at }); return start(at); };
          oscillator.stop = at => { window.__audioCalls.push({ id: oscillatorId, op: 'stop', frequency: oscillator.frequency.value, at }); return stop(at); };
          return oscillator;
        }
      };
    });
    await select(page, 'squat'); await action(page, 'review').click();
    await editToday(page, 'squat', { sets: 2, restSeconds: 4, phases: '1-1-1' });
    await action(page, 'start').click();
    await page.waitForFunction(() => window.__audioCalls.some(c => c.op === 'start' && c.frequency === 880), undefined, { timeout: 4000 });
    const starts = await page.evaluate(() => window.__audioCalls.filter(c => c.op === 'start'));
    assert.equal(starts[0].frequency, 520);
    assert.ok(Math.abs(starts[1].at - starts[0].at - 1) < 0.01);
    assert.ok(Math.abs(starts[2].at - starts[1].at - 1) < 0.01);
    await page.evaluate(() => window.__testAudioContext.suspend());
    await action(page, 'activate-audio').waitFor();
    await action(page, 'activate-audio').click();
    await page.waitForFunction(() => window.__testAudioContext.state === 'running');
    await action(page, 'complete-set').click();
    await action(page, 'dismiss-rest-alarm').waitFor({ timeout: 6000 });
    const calls = await page.evaluate(() => window.__audioCalls);
    assert.ok(calls.some(c => c.op === 'start' && c.frequency === 760), 'Countdown tone was scheduled');
    assert.ok(calls.some(c => c.op === 'start' && c.frequency === 1040), 'Rest-end tone was scheduled');
    assert.ok(calls.filter(c => c.op === 'stop' && c.frequency === 1040).every(c => c.at !== undefined), 'Rest-end tone is not immediately stopped by tempo startup');
    await action(page, 'dismiss-rest-alarm').click();
    await action(page, 'toggle-sound').click();
    assert.equal((await storedSession(page)).soundEnabled, false);
    await page.reload(); await action(page, 'resume').click();
    assert.equal(await action(page, 'toggle-sound').getAttribute('aria-pressed'), 'false');
    await context.close();
  });

  await test('unsupported audio and wake lock do not interrupt a workout', async () => {
    const { context, page } = await fresh(390, 844, { workout_settings: { ...settings, tempoSound: true, restSound: true, vibration: true, wakeLock: true } });
    await page.evaluate(() => {
      Object.defineProperty(window, 'AudioContext', { value: undefined, configurable: true });
      Object.defineProperty(window, 'webkitAudioContext', { value: undefined, configurable: true });
      Object.defineProperty(navigator, 'wakeLock', { value: undefined, configurable: true });
      Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true });
    });
    await select(page, 'squat'); await action(page, 'review').click();
    await editToday(page, 'squat', { sets: 1 });
    await action(page, 'start').click();
    assert.match(await page.locator('#notice').textContent(), /안내음을 지원하지/);
    await page.locator('#notice button').click();
    await action(page, 'toggle-sound').click();
    assert.equal((await storedSession(page)).soundEnabled, false);
    await action(page, 'complete-set').click();
    await action(page, 'done').waitFor();
    await context.close();
  });

  await test('storage write and removal failures are visible while workout navigation remains usable', async () => {
    const { context, page } = await fresh();
    await page.evaluate(() => {
      Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); };
      Storage.prototype.removeItem = () => { throw new Error('SecurityError'); };
    });
    await select(page, 'squat'); await action(page, 'review').click(); await action(page, 'start').click();
    assert.match(await page.locator('#notice').textContent(), /저장하지 못했습니다/);
    await page.locator('#notice button').click();
    await action(page, 'exit').click(); await action(page, 'confirm-exit').click();
    await page.locator('.exercise-card').first().waitFor();
    assert.match(await page.locator('#notice').textContent(), /저장 데이터를 삭제하지 못해/);
    await context.close();
  });

  await test('mobile and landscape layouts have no horizontal overflow; modal focus is trapped', async () => {
    for (const [width, height] of [[360, 800], [390, 844], [412, 915], [844, 390], [1280, 900]]) {
      const { context, page } = await fresh(width, height);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `home width ${width}`);
      await capture(page, `home-${width}`);
      await select(page, 'overhead_triceps_extension'); await action(page, 'review').click();
      await page.locator('[data-action="edit-today"]').click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `editor width ${width}`);
      await action(page, 'close-modal').focus(); await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.name), 'sets');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'close-modal');
      await capture(page, `editor-${width}`);
      await action(page, 'close-modal').click(); await action(page, 'start').click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `player width ${width}`);
      assert.equal(await page.locator('nav').count(), 0);
      await action(page, 'complete-set').click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `rest width ${width}`);
      await context.close();
    }
  });

  assert.deepEqual(errors, [], 'Unexpected browser JavaScript errors');
  assert.deepEqual(failedResponses, [], 'Browser assets must load successfully');
  if (process.env.WORKOUT_PREVIEW === 'gas') assert.deepEqual([...requestedPaths], ['/'], 'GAS preview must not request local JS, CSS or image files');
  console.log(`Screenshots: ${screenshots.length} in ${output}`);
  if (failures.length) throw new Error(`${failures.length} browser scenarios failed: ${failures.join(', ')}`);
  console.log(`All ${passed} browser scenarios passed${process.env.WORKOUT_PREVIEW === 'gas' ? ' (GAS bundle preview)' : ''}.`);
} finally {
  await browser?.close();
  server.kill();
}
