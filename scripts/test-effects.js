import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { DEFAULT_SETTINGS } from '../apps/web/src/core/settings.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = fileURLToPath(new URL('../test-results/stage9-10/', import.meta.url));
const server = spawn(process.execPath, ['scripts/serve.js'], {
  cwd: root, env: { ...process.env, PORT: '0', HOST: '127.0.0.1', WORKOUT_PREVIEW: '' }, stdio: ['ignore', 'ignore', 'pipe', 'ipc']
});
let serverError = '';
server.stderr.on('data', data => { serverError += data; });
let browser, url;
const errors = [], results = [];
const quiet = { ...DEFAULT_SETTINGS, defaultSets: 2, defaultRestSeconds: 1, betweenExerciseRestSeconds: 0, tempoSound: false, countdownSound: false, restSound: false, wakeLock: false, vibration: false };
const action = (page, name) => page.locator(`[data-action="${name}"]`);
const state = page => page.evaluate(() => JSON.parse(localStorage.getItem('active_session')));
const advance = (page, ms) => page.evaluate(ms => { window.__effectsNow += ms; }, ms);
async function fresh(width = 390, height = 844, settings = quiet, mode = 'success') {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript(({ settings, mode }) => {
    if (!localStorage.getItem('__effects_seeded')) {
      localStorage.setItem('workout_settings', JSON.stringify(settings));
      localStorage.setItem('__effects_seeded', '1');
    }
    window.__effectsNow = 10000;
    Date.now = () => window.__effectsNow;
    window.__hidden = false;
    Object.defineProperty(document, 'hidden', { get: () => window.__hidden, configurable: true });
    window.__audio = []; window.__gains = []; window.__contexts = []; window.__locks = [];
    window.__device = { requests: [], releases: 0, vibrations: [] };
    const NativeAudio = window.AudioContext;
    if (mode === 'missing') {
      Object.defineProperty(window, 'AudioContext', { value: undefined, configurable: true });
      Object.defineProperty(window, 'webkitAudioContext', { value: undefined, configurable: true });
    } else if (mode === 'audio-denied') {
      window.AudioContext = class { constructor() { this.state = 'suspended'; window.__contexts.push(this); } async resume() { throw new Error('Test audio denial'); } };
    } else {
      let oscillatorId = 0;
      window.AudioContext = class extends NativeAudio {
        constructor() { super(); this.testId = window.__contexts.length; window.__contexts.push(this); }
        createGain() {
          const gain = super.createGain(), events = [];
          window.__gains.push(events);
          for (const op of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime']) {
            const original = gain.gain[op].bind(gain.gain);
            gain.gain[op] = (value, at) => { events.push({ op, value, at }); return original(value, at); };
          }
          return gain;
        }
        createOscillator() {
          const oscillator = super.createOscillator(), id = ++oscillatorId;
          const start = oscillator.start.bind(oscillator), stop = oscillator.stop.bind(oscillator);
          oscillator.start = at => { window.__audio.push({ id, context: this.testId, op: 'start', at, frequency: oscillator.frequency.value }); return start(at); };
          oscillator.stop = at => { window.__audio.push({ id, context: this.testId, op: 'stop', at, frequency: oscillator.frequency.value }); return stop(at); };
          return oscillator;
        }
      };
    }
    const wakeLock = mode === 'missing' ? undefined : { request(kind) {
      window.__device.requests.push(kind);
      if (mode === 'denied') return Promise.reject(new Error('Test wake denial'));
      const lock = new EventTarget();
      lock.release = async () => {
        window.__device.releases++;
        lock.dispatchEvent(new Event('release'));
        if (mode === 'release-denied') throw new Error('Test release denial');
      };
      window.__locks.push(lock);
      if (mode === 'pending') return new Promise(done => { window.__grantWake = () => done(lock); });
      return Promise.resolve(lock);
    } };
    Object.defineProperty(navigator, 'wakeLock', { value: wakeLock, configurable: true });
    Object.defineProperty(navigator, 'vibrate', { value: mode === 'missing' ? undefined : pattern => {
      window.__device.vibrations.push(pattern);
      if (mode === 'denied') throw new Error('Test vibration denial');
      return mode !== 'vibration-false';
    }, configurable: true });
  }, { settings, mode });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(url);
  return { context, page };
}
async function start(page, tempo = null) {
  await page.locator('[data-action="select"][data-id="squat"]').click();
  await action(page, 'review').click();
  if (tempo) {
    await action(page, 'edit-today').click();
    await page.locator('[name="phases"]').fill(tempo);
    await page.locator('#exercise-form').evaluate(form => form.requestSubmit());
  }
  await action(page, 'start').click();
}
async function capture(page, name) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: `${output}${name}.png` });
}
async function branding(page, name = 'Workout Coach', theme = '#101b20', icon = '/public/icon.svg', apple = false) {
  assert.equal(await page.title(), name);
  assert.ok((await page.locator('.brand').innerText()).includes(name));
  assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'), theme);
  assert.ok((await page.locator('link[rel="icon"]').getAttribute('href')).includes(icon));
  assert.equal(await page.locator('link[rel="apple-touch-icon"]').count(), apple ? 1 : 0);
  assert.ok(await page.locator('.brand img').evaluate(async image => { await image.decode(); return image.naturalWidth > 0; }));
}
async function nativeAudio(width, height) {
  const { context, page } = await fresh(width, height, { ...quiet, defaultRestSeconds: 4, tempoSound: true, restSound: true, countdownSound: true });
  await branding(page);
  assert.equal(await page.evaluate(() => window.__contexts.length), 0);
  await start(page, '1-1-1');
  await page.waitForFunction(() => window.__audio.filter(c => c.op === 'start' && c.frequency === 880).length >= 1);
  const first = await page.evaluate(() => window.__audio.filter(c => c.op === 'start').slice(0, 3));
  assert.deepEqual(first.map(c => c.frequency), [520, 520, 880]);
  assert.ok(Math.abs(first[1].at - first[0].at - 1) < 0.01);
  assert.ok(Math.abs(first[2].at - first[1].at - 1) < 0.01);
  await page.evaluate(() => window.__contexts.at(-1).suspend());
  await action(page, 'activate-audio').waitFor();
  await capture(page, `audio-suspended-${width}`);
  await action(page, 'activate-audio').click();
  await page.waitForFunction(() => window.__contexts.at(-1).state === 'running');
  await page.evaluate(() => window.__contexts.at(-1).close());
  await action(page, 'activate-audio').waitFor();
  await action(page, 'activate-audio').click();
  await page.waitForFunction(() => window.__contexts.length === 2 && window.__contexts[1].state === 'running');
  await action(page, 'toggle-sound').click();
  assert.equal((await state(page)).soundEnabled, false);
  const muted = await page.evaluate(() => window.__audio.filter(c => c.op === 'start').length);
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => window.__audio.filter(c => c.op === 'start').length), muted);
  await page.reload();
  await action(page, 'resume').click();
  assert.equal(await page.evaluate(() => window.__contexts.length), 0);
  assert.equal(await action(page, 'toggle-sound').getAttribute('aria-pressed'), 'false');
  await action(page, 'toggle-sound').click();
  await page.waitForFunction(() => window.__audio.some(c => c.op === 'start'));
  await action(page, 'complete-set').click();
  for (let count = 1; count <= 3; count++) {
    await advance(page, 1000);
    await page.waitForFunction(count => window.__audio.filter(c => c.op === 'start' && c.frequency === 760).length === count, count);
    if (count === 1) {
      await page.waitForTimeout(250);
      assert.equal(await page.evaluate(() => window.__audio.filter(c => c.op === 'start' && c.frequency === 760).length), 1);
    }
  }
  await capture(page, `countdown-${width}`);
  await advance(page, 1000);
  await page.waitForFunction(() => window.__audio.some(c => c.op === 'start' && c.frequency === 1040));
  const end = await page.evaluate(() => window.__audio.filter(c => c.frequency === 1040));
  const endStarts = end.filter(c => c.op === 'start');
  assert.equal(endStarts.length, 2);
  assert.ok(Math.abs(endStarts[1].at - endStarts[0].at - 0.37) < 0.01);
  assert.ok(end.filter(c => c.op === 'stop').every(c => typeof c.at === 'number'));
  assert.ok(Math.abs(end.find(c => c.op === 'stop').at - end.find(c => c.op === 'start').at - 0.26) < 0.01);
  assert.equal((await state(page)).restAlarmPending, true);
  await capture(page, `rest-alarm-${width}`);
  await page.waitForFunction(() => window.__audio.filter(c => c.op === 'start' && c.frequency === 1040).length >= 4);
  assert.equal(await page.evaluate(at => window.__audio.some(c => c.op === 'start' && [520, 880].includes(c.frequency) && c.at >= at), endStarts[0].at), false);
  const gains = await page.evaluate(() => window.__gains);
  for (const events of gains) {
    assert.ok(events[1].value >= 0.8 && events[1].value <= 1);
    assert.equal(events[2].value, events[1].value);
    assert.ok(events[2].at - events[1].at >= 0.06);
    assert.equal(events[3].value, 0);
  }
  await action(page, 'dismiss-rest-alarm').click();
  assert.equal((await state(page)).restAlarmPending, false);
  assert.ok(await page.evaluate(() => window.__audio.some(c => c.frequency === 1040 && c.op === 'stop' && c.at === undefined)));
  await action(page, 'complete-set').click();
  assert.equal((await state(page)).status, 'COMPLETE');
  results.push({ name: 'native-audio', width, phaseIntervals: [first[1].at - first[0].at, first[2].at - first[1].at], countdowns: 3, restAlarmRepeatsUntilDismissed: true, tempoWaitsForDismissal: true, sustainedEnvelopes: true, closedContextRecovery: true });
  await context.close();
}
async function devices(mode, wanted = true) {
  const { context, page } = await fresh(390, 844, { ...quiet, wakeLock: wanted }, mode);
  await start(page);
  if (mode === 'success' && wanted) {
    await page.waitForFunction(() => window.__device.requests.length === 1);
    await action(page, 'exit').click(); await action(page, 'close-modal').click();
    assert.equal(await page.evaluate(() => window.__device.requests.length), 1);
    await page.evaluate(() => { window.__hidden = true; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForFunction(() => window.__device.releases === 1);
    await page.evaluate(() => { window.__hidden = false; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForFunction(() => window.__device.requests.length === 2);
  }
  await action(page, 'complete-set').click();
  await advance(page, 1000);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('active_session')).status === 'EXERCISE');
  await action(page, 'complete-set').click();
  assert.equal((await state(page)).status, 'COMPLETE');
  if (mode === 'pending') {
    await page.evaluate(() => window.__grantWake());
    await page.waitForFunction(() => window.__device.releases === 1);
  }
  if (mode === 'success' && wanted) await page.waitForFunction(() => window.__device.releases === 2);
  if (!wanted) {
    assert.equal(await page.evaluate(() => window.__device.requests.length), 0);
    assert.equal(await page.evaluate(() => window.__contexts.length), 0);
  }
  results.push({ name: `device-${mode}-${wanted}`, mockCalls: await page.evaluate(() => window.__device) });
  await context.close();
}
async function unavailableAudio(mode) {
  const { context, page } = await fresh(390, 844, { ...quiet, tempoSound: true, restSound: true, countdownSound: true, wakeLock: true }, mode);
  await start(page);
  assert.ok((await page.locator('#notice').innerText()).includes(mode === 'missing' ? '지원하지 않습니다' : '활성화하지 못했습니다'));
  await capture(page, `audio-${mode}`);
  await action(page, 'complete-set').click();
  await advance(page, 1000);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('active_session')).status === 'EXERCISE');
  await action(page, 'dismiss-rest-alarm').click();
  await action(page, 'complete-set').click();
  assert.equal((await state(page)).status, 'COMPLETE');
  results.push({ name: `audio-${mode}`, passed: true });
  await context.close();
}
async function independentFlags() {
  for (const disabled of ['tempoSound', 'countdownSound', 'restSound', 'exerciseTempo']) {
    const settings = { ...quiet, defaultRestSeconds: 4, tempoSound: true, countdownSound: true, restSound: true };
    if (disabled !== 'exerciseTempo') settings[disabled] = false;
    const { context, page } = await fresh(390, 844, settings);
    if (disabled === 'exerciseTempo') await page.evaluate(() => localStorage.setItem('exercise_settings', JSON.stringify({ squat: { tempo: { enabled: false, phases: [1, 1, 1] } } })));
    if (disabled === 'exerciseTempo') await page.reload();
    await start(page);
    await page.waitForTimeout(250);
    const tempoCount = await page.evaluate(() => window.__audio.filter(c => c.op === 'start' && [520, 880].includes(c.frequency)).length);
    assert.equal(tempoCount > 0, !['tempoSound', 'exerciseTempo'].includes(disabled));
    await action(page, 'complete-set').click();
    for (let second = 3; second >= 1; second--) {
      await advance(page, 1000);
      await page.waitForFunction(second => Math.ceil((JSON.parse(localStorage.getItem('active_session')).restEndAt - Date.now()) / 1000) === second, second);
      await page.waitForTimeout(250);
    }
    assert.equal(await page.evaluate(() => window.__audio.filter(c => c.op === 'start' && c.frequency === 760).length), disabled === 'countdownSound' ? 0 : 3);
    await advance(page, 1000);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('active_session')).status === 'EXERCISE');
    assert.equal(await page.evaluate(() => window.__audio.filter(c => c.op === 'start' && c.frequency === 1040).length), disabled === 'restSound' ? 0 : 2);
    if (disabled === 'tempoSound') {
      await action(page, 'toggle-sound').click();
      assert.ok(await page.evaluate(() => window.__audio.some(c => c.frequency === 1040 && c.op === 'stop' && c.at === undefined)), 'Mute cancels the pending rest signal even when Tempo is off');
    }
    if (await action(page, 'dismiss-rest-alarm').count()) await action(page, 'dismiss-rest-alarm').click();
    await context.close();
  }
  results.push({ name: 'independent-sound-flags', variants: 4, passed: true });
}
async function alarmLifecycle() {
  const { context, page } = await fresh(390, 844, { ...quiet, defaultSets: 3, restSound: true, tempoSound: true });
  await start(page);
  await action(page, 'complete-set').click();
  await action(page, 'skip-rest').click();
  assert.equal((await state(page)).restAlarmPending, false);
  assert.equal(await page.evaluate(() => window.__audio.filter(c => c.frequency === 1040 && c.op === 'start').length), 0);
  await advance(page, 600);
  await action(page, 'complete-set').click();
  await advance(page, 1000);
  await action(page, 'dismiss-rest-alarm').waitFor();
  const toneCount = () => page.evaluate(() => window.__audio.filter(c => c.frequency === 1040 && c.op === 'start').length);
  await page.waitForFunction(() => window.__audio.some(c => c.frequency === 1040 && c.op === 'start'));
  let count = await toneCount();
  await page.evaluate(() => { window.__hidden = true; document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(300);
  assert.equal(await toneCount(), count);
  assert.equal((await state(page)).restAlarmPending, true);
  await page.evaluate(() => { window.__hidden = false; document.dispatchEvent(new Event('visibilitychange')); });
  assert.equal(await toneCount(), count + 2);
  await action(page, 'exit').click();
  count = await toneCount();
  await page.waitForTimeout(300);
  assert.equal(await toneCount(), count);
  await action(page, 'close-modal').click();
  assert.equal(await toneCount(), count + 2);
  await page.evaluate(() => window.__contexts.at(-1).suspend());
  await action(page, 'activate-audio').waitFor();
  await action(page, 'activate-audio').click();
  await page.waitForFunction(() => window.__contexts.at(-1).state === 'running');
  await page.reload();
  assert.equal((await state(page)).restAlarmPending, true);
  assert.ok((await page.locator('[role="dialog"]').innerText()).includes('휴식이 끝났습니다'));
  await action(page, 'resume').click();
  await action(page, 'dismiss-rest-alarm').waitFor();
  await page.waitForFunction(() => window.__audio.some(c => c.frequency === 1040 && c.op === 'start'));
  await capture(page, 'rest-alarm-resumed');
  await action(page, 'dismiss-rest-alarm').click();
  assert.equal((await state(page)).results[0].completed, 2);
  await page.reload();
  await action(page, 'resume').click();
  assert.equal((await state(page)).restAlarmPending, false);
  assert.equal(await page.evaluate(() => window.__audio.filter(c => c.frequency === 1040 && c.op === 'start').length), 0);
  await action(page, 'complete-set').click();
  assert.equal((await state(page)).status, 'COMPLETE');
  results.push({ name: 'rest-alarm-lifecycle', visibility: true, modal: true, suspendedAudio: true, pendingReload: true, acknowledgedReload: true, manualSkip: true, passed: true });
  await context.close();
}
async function alarmLayout(width, height, id = 'squat') {
  const { context, page } = await fresh(width, height, { ...quiet, restSound: true });
  await page.locator(`[data-action="select"][data-id="${id}"]`).click();
  await action(page, 'review').click();
  if (id === 'plank') {
    await action(page, 'edit-today').click();
    await page.locator('[name="durationSeconds"]').fill('1');
    await page.locator('#exercise-form').evaluate(form => form.requestSubmit());
  }
  await action(page, 'start').click();
  if (id === 'plank') {
    await action(page, 'start-timer').click();
    await advance(page, 1000);
    await action(page, 'skip-rest').waitFor();
  } else await action(page, 'complete-set').click();
  await advance(page, 1000);
  await action(page, 'dismiss-rest-alarm').waitFor();
  assert.equal(await action(page, 'start-timer').count(), 0);
  assert.equal(await action(page, 'complete-set').count(), 0);
  assert.equal(await page.locator('nav').count(), 0);
  await action(page, 'dismiss-rest-alarm').scrollIntoViewIfNeeded();
  const rect = await action(page, 'dismiss-rest-alarm').boundingBox();
  assert.ok(rect.height >= 48 && rect.y >= 0 && rect.y + rect.height <= height);
  await capture(page, `rest-alarm-${id}-${width}x${height}`);
  await action(page, 'dismiss-rest-alarm').click();
  assert.equal((await state(page)).restAlarmPending, false);
  assert.equal((await state(page)).results[0].completed, 1);
  if (id === 'plank') {
    assert.equal((await state(page)).timerPaused, true);
    await action(page, 'start-timer').waitFor();
  } else await action(page, 'complete-set').waitFor();
  results.push({ name: `rest-alarm-${id}-${width}x${height}`, primaryAccessible: true, timerWaitsForAcknowledgement: id === 'plank', passed: true });
  await context.close();
}
async function customBrand() {
  const { context, page } = await fresh();
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7S8AAAAASUVORK5CYII=';
  const source = await readFile(new URL('../apps/web/src/data/exercises.js', import.meta.url), 'utf8');
  const body = source.replace("name: 'Workout Coach'", "name: 'My Coach'")
    .replace("themeColor: '#101b20'", "themeColor: '#223344'")
    .replace('iconUrl: assets.icon', `iconUrl: '${png}'`).replace("appleTouchIconUrl: ''", `appleTouchIconUrl: '${png}'`);
  assert.notEqual(body, source);
  await page.route('**/src/data/exercises.js', route => route.fulfill({ contentType: 'text/javascript', body }));
  await page.reload();
  await branding(page, 'My Coach', '#223344', png, true);
  assert.equal(await page.locator('link[rel="icon"]').getAttribute('type'), null);
  assert.equal(await page.locator('link[rel="apple-touch-icon"]').getAttribute('href'), png);
  results.push({ name: 'custom-branding-png', passed: true });
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
  for (const [width, height] of [[360, 800], [390, 844], [1280, 900]]) { await nativeAudio(width, height); console.log(`PASS ${width}×${height} native audio`); }
  for (const mode of ['success', 'denied', 'pending', 'release-denied', 'vibration-false']) { await devices(mode); console.log(`PASS mocked device ${mode}`); }
  await devices('success', false);
  for (const mode of ['missing', 'audio-denied']) await unavailableAudio(mode);
  await independentFlags();
  await alarmLifecycle();
  await alarmLayout(412, 915);
  await alarmLayout(844, 390);
  await alarmLayout(390, 844, 'plank');
  await customBrand();
  assert.deepEqual(errors, []);
  await writeFile(`${output}result.json`, JSON.stringify(results, null, 2));
  console.log(`9·10단계 브라우저 시나리오 ${results.length}개 통과. 실제 가청·기기 잠금·설치 아이콘·GAS는 미검증입니다.`);
} finally {
  await browser?.close();
  server.kill();
}
