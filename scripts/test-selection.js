import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { EXERCISES } from '../apps/web/src/data/exercises.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = fileURLToPath(new URL('../test-results/stage2/', import.meta.url));
const initial = EXERCISES.slice(0, 8);
const server = spawn(process.execPath, ['scripts/serve.js'], {
  cwd: root, env: { ...process.env, PORT: '0', HOST: '127.0.0.1', WORKOUT_PREVIEW: '' },
  stdio: ['ignore', 'ignore', 'pipe', 'ipc']
});
let serverError = '';
server.stderr.on('data', data => { serverError += data; });
let browser;
const problems = [];
const results = [];

async function checkSelection(page, ids) {
  assert.equal(await page.locator('.selection strong').textContent(), `선택한 운동 ${ids.length}개`);
  assert.equal(await page.locator('.selection .primary').isDisabled(), ids.length === 0);
  const summary = ids.length ? ids.map(id => EXERCISES.find(e => e.id === id).name).join(' → ') : '카드를 눌러 오늘 운동을 구성해 보세요.';
  assert.equal(await page.locator('.selection p').textContent(), summary);
  for (const card of await page.locator('.exercise-card').all()) {
    const id = await card.getAttribute('data-id');
    const order = ids.indexOf(id) + 1;
    assert.equal(await card.getAttribute('aria-pressed'), String(order > 0), id);
    assert.equal(await card.locator('.order').count(), order > 0 ? 1 : 0, id);
    if (order) {
      assert.equal(await card.locator('.order').textContent(), String(order), id);
      assert.ok((await card.getAttribute('aria-label')).endsWith(`선택 순서 ${order}`), id);
    }
  }
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
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    page.on('pageerror', error => problems.push(error.message));
    page.on('response', response => { if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`); });
    await page.goto(`http://127.0.0.1:${port}`);
    await page.locator('.exercise-card').first().waitFor();
    const card = id => page.locator(`.exercise-card[data-id="${id}"]`);
    const filter = id => page.locator(`[data-action="filter"][data-id="${id}"]`);
    for (const e of initial) {
      assert.equal(await card(e.id).locator('strong').textContent(), e.name);
      assert.equal(await card(e.id).locator('.muted').first().textContent(), e.target);
      await card(e.id).scrollIntoViewIfNeeded();
      assert.ok(await card(e.id).locator('img').evaluate(async image => { await image.decode(); return image.naturalWidth > 0; }), e.id);
    }
    await checkSelection(page, []);
    for (const id of ['squat', 'push_up', 'crunch']) await card(id).click();
    await checkSelection(page, ['squat', 'push_up', 'crunch']);
    await card('push_up').click();
    await checkSelection(page, ['squat', 'crunch']);
    await card('push_up').click();
    const ids = ['squat', 'crunch', 'push_up'];
    await checkSelection(page, ids);
    for (const category of ['upper', 'lower', 'core', 'all']) {
      await filter(category).click();
      assert.equal(await filter(category).getAttribute('aria-pressed'), 'true');
      const visible = await page.locator('.exercise-card').evaluateAll(cards => cards.map(c => c.dataset.id));
      assert.deepEqual(visible, EXERCISES.filter(e => category === 'all' || e.category === category).map(e => e.id));
      await checkSelection(page, ids);
    }
    // Native buttons must support both Space and Enter, preserving focus on rerender.
    await card('push_up').focus();
    await page.keyboard.press('Space');
    await checkSelection(page, ['squat', 'crunch']);
    await page.keyboard.press('Enter');
    await checkSelection(page, ids);
    for (const id of ids) await card(id).click();
    await checkSelection(page, []);
    for (const e of initial) await card(e.id).click();
    await checkSelection(page, initial.map(e => e.id));
    await filter('upper').click();
    await card('overhead_triceps_extension').evaluate(element => {
      window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top - 100);
    });
    const longName = await card('overhead_triceps_extension').evaluate(element => {
      const card = element.getBoundingClientRect();
      const name = element.querySelector('strong');
      const nameRect = name.getBoundingClientRect();
      const badge = element.querySelector('.order').getBoundingClientRect();
      const image = element.querySelector('img').getBoundingClientRect();
      return {
        nameFits: name.scrollWidth <= name.clientWidth && nameRect.left >= card.left && nameRect.right <= card.right,
        nameVisible: nameRect.top >= 0 && nameRect.bottom <= document.querySelector('.selection').getBoundingClientRect().top,
        badgeFits: badge.left >= image.left && badge.right <= image.right && badge.top >= image.top && badge.bottom <= image.bottom
      };
    });
    assert.deepEqual(longName, { nameFits: true, nameVisible: true, badgeFits: true });
    await page.screenshot({ path: `${output}upper-${width}.png` });
    await filter('all').click();
    await page.screenshot({ path: `${output}selected-${width}.png` });
    const metrics = await page.evaluate(() => {
      const panel = document.querySelector('.selection').getBoundingClientRect();
      const nav = document.querySelector('nav').getBoundingClientRect();
      return {
        width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth,
        panelHeight: panel.height, panelTop: panel.top, panelBottom: panel.bottom, navTop: nav.top
      };
    });
    assert.equal(metrics.overflow, false);
    assert.ok(metrics.panelTop >= 0 && metrics.panelBottom <= metrics.navTop);
    results.push({ ...metrics, longName });
    for (const e of initial) await card(e.id).click();
    await checkSelection(page, []);
    await context.close();
    console.log(`PASS ${width}×${height}: 초기 8개 카드·이미지, 선택·해제·재선택, 부위 필터, 순번·키보드, 0개·8개 선택`);
  }
  assert.deepEqual(problems, []);
  await writeFile(`${output}result.json`, JSON.stringify(results, null, 2));
  console.log('2단계 선택 검증 통과. 세션 시작·설정·저장·사운드·GAS 시나리오는 실행하지 않았습니다.');
} finally {
  await browser?.close();
  server.kill();
}
