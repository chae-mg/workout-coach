import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorage, STORAGE_KEYS } from '../apps/web/src/browser/storage.js';
import { DEFAULT_SETTINGS, clone } from '../apps/web/src/core/settings.js';
import { createSession } from '../apps/web/src/core/session.js';
import { EXERCISES } from '../apps/web/src/data/exercises.js';

function memory() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}

test('settings, overrides, and a session survive a storage round trip', () => {
  const backend = memory();
  const store = createStorage(() => backend);
  store.saveSettings({ ...DEFAULT_SETTINGS, defaultSets: 2 });
  store.saveOverrides({ squat: { sets: 1 } });
  const s = createSession([clone(EXERCISES[0])], DEFAULT_SETTINGS, 1000, 'saved');
  store.saveSession(s);
  assert.equal(store.loadSettings().defaultSets, 2);
  assert.deepEqual(store.loadOverrides(EXERCISES), { squat: { sets: 1 } });
  assert.deepEqual(store.loadSession(), s);
  assert.equal(store.clearSession(), true);
  assert.equal(store.loadSession(), null);
});

test('legacy overrides migrate and future versions are not interpreted as legacy maps', () => {
  const backend = memory();
  const store = createStorage(() => backend);
  backend.setItem(STORAGE_KEYS.overrides, JSON.stringify({ squat: { sets: 2 } }));
  assert.deepEqual(store.loadOverrides(EXERCISES), { squat: { sets: 2 } });
  backend.setItem(STORAGE_KEYS.overrides, JSON.stringify({ version: 99, squat: { sets: 2 } }));
  assert.deepEqual(store.loadOverrides(EXERCISES), {});
});

test('invalid JSON and invalid session structure cannot crash initialization', () => {
  const backend = memory();
  const notices = [];
  const store = createStorage(() => backend, message => notices.push(message));
  backend.setItem(STORAGE_KEYS.settings, '{invalid');
  assert.deepEqual(store.loadSettings(), DEFAULT_SETTINGS);
  backend.setItem(STORAGE_KEYS.session, JSON.stringify({ version: 2, exerciseIndex: -1 }));
  assert.equal(store.loadSession(), null);
  assert.equal(notices.length, 2);
});

test('unavailable storage and quota failures are reported without throwing', () => {
  const notices = [];
  const store = createStorage(() => { throw new Error('SecurityError'); }, message => notices.push(message));
  assert.deepEqual(store.loadSettings(), DEFAULT_SETTINGS);
  assert.equal(store.saveSettings(DEFAULT_SETTINGS), false);
  assert.equal(store.clearSession(), false);
  const quota = createStorage(() => ({ setItem() { throw new Error('QuotaExceeded'); } }), message => notices.push(message));
  assert.equal(quota.saveOverrides({}), false);
  assert.equal(notices.length, 4);
});
