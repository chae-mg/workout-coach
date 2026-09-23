import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionId } from '../apps/web/src/browser/session-id.js';

test('session id prefers native UUID when available', () => {
  const crypto = { randomUUID() { assert.equal(this, crypto); return 'native-uuid'; }, getRandomValues() { throw new Error('Should not need fallback'); } };
  assert.equal(createSessionId(crypto), 'native-uuid');
});
test('session id supports local HTTP with all sixteen random bytes', () => {
  let requestedBytes;
  const crypto = { getRandomValues(bytes) { requestedBytes = bytes.length; for (let i = 0; i < bytes.length; i++) bytes[i] = i === 15 ? 255 : i; return bytes; } };
  assert.equal(createSessionId(crypto), '000102030405060708090a0b0c0d0eff');
  assert.equal(requestedBytes, 16);
});
