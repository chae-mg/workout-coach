import { normalizeSettings, normalizeOverrides, isObject } from '../core/settings.js';
import { validateSession } from '../core/session.js';

export const STORAGE_KEYS = {
  settings: 'workout_settings', overrides: 'exercise_settings', session: 'active_session'
};

export function createStorage(getStorage, onError = () => {}) {
  function read(key) {
    try {
      const raw = getStorage().getItem(key);
      return raw === null ? null : JSON.parse(raw);
    } catch (error) {
      onError('저장된 데이터를 읽지 못했습니다. 기본값으로 실행합니다.', error);
      return null;
    }
  }
  function write(key, value) {
    try {
      getStorage().setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      onError('기기에 저장하지 못했습니다. 새로고침하면 현재 진행 상태가 사라질 수 있습니다.', error);
      return false;
    }
  }
  function remove(key) {
    try {
      getStorage().removeItem(key);
      return true;
    } catch (error) {
      onError('기기의 저장 데이터를 삭제하지 못했습니다.', error);
      return false;
    }
  }
  return {
    loadSettings: () => normalizeSettings(read(STORAGE_KEYS.settings)),
    saveSettings: value => write(STORAGE_KEYS.settings, value),
    loadOverrides(exercises) {
      const value = read(STORAGE_KEYS.overrides);
      if (!value) return {};
      // v1 documents used an unwrapped exercise map; migrate it on the next save.
      if (isObject(value) && value.version === 2) return normalizeOverrides(value.exercises, exercises);
      if (isObject(value) && value.version === undefined) return normalizeOverrides(value, exercises);
      return {};
    },
    saveOverrides: value => write(STORAGE_KEYS.overrides, { version: 2, exercises: value }),
    loadSession() {
      const value = read(STORAGE_KEYS.session);
      if (value === null) return null;
      if (validateSession(value)) return value;
      onError('이전 운동의 저장 형식이 올바르지 않아 이어하기를 제공할 수 없습니다.');
      return null;
    },
    saveSession: value => write(STORAGE_KEYS.session, value),
    clearSession: () => remove(STORAGE_KEYS.session)
  };
}
