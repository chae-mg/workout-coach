import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const tests = readdirSync(new URL('../tests/', import.meta.url))
  .filter(name => name.endsWith('.test.js') && name !== 'gas.test.js')
  .map(name => `tests/${name}`);
const tasks = [['--test', ...tests], ['scripts/test-browser.js'], ['scripts/test-mobile.js']];
for (const args of tasks) {
  const result = spawnSync(process.execPath, args, {
    cwd: root, stdio: 'inherit',
    env: { ...process.env, WORKOUT_PREVIEW: '', WORKOUT_BROWSER_CHANNEL: process.env.WORKOUT_BROWSER_CHANNEL || process.env.PLAYWRIGHT_CHANNEL || 'msedge' }
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
