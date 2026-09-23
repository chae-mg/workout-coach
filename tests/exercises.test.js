import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { EXERCISES, DEFAULT_EXERCISE_IMAGE } from '../apps/web/src/data/exercises.js';

const model = readFileSync(new URL('../docs/02_ARCHITECTURE/DATA_MODEL.md', import.meta.url), 'utf8');
const literal = model.match(/const EXERCISES = (\[[\s\S]*?\n\]);/);
assert.ok(literal, 'DATA_MODEL의 초기 운동 예시가 있어야 합니다.');
// Trusted local design document: read its literal, rather than duplicating defaults here.
const documented = JSON.parse(JSON.stringify(runInNewContext(literal[1], {}, { timeout: 1000 })));

test('initial eight exercises match DATA_MODEL defaults and filter categories', () => {
  assert.equal(documented.length, 8);
  assert.equal(new Set(EXERCISES.map(e => e.id)).size, EXERCISES.length);
  assert.deepEqual(EXERCISES.slice(0, 8).map(e => e.id), documented.map(e => e.id));
  for (const expected of documented) {
    const actual = EXERCISES.find(e => e.id === expected.id);
    for (const [field, value] of Object.entries(expected)) {
      assert.deepEqual(actual[field], value, `${expected.id}.${field}`);
    }
    assert.equal(actual.durationSeconds, null, expected.id);
    assert.equal(actual.imageUrl, DEFAULT_EXERCISE_IMAGE, expected.id);
  }
});

test('initial exercise names, types and targets agree with PRD', () => {
  const prd = readFileSync(new URL('../docs/01_PRODUCT/PRD.md', import.meta.url), 'utf8');
  for (const e of documented) {
    const row = prd.split(/\r?\n/).find(line => line.startsWith(`| ${e.id} |`));
    assert.ok(row, `${e.id} PRD 항목`);
    assert.deepEqual(row.split('|').slice(1, -1).map(cell => cell.trim()), [e.id, e.name, e.type, e.target]);
  }
});

test('timed exercise defaults match the reviewed DATA_MODEL list', () => {
  const literal = model.match(/const TIMED_EXERCISES = (\[[\s\S]*?\n\]);/);
  assert.ok(literal, '시간 운동 기본값 예시가 있어야 합니다.');
  const timed = JSON.parse(JSON.stringify(runInNewContext(literal[1], {}, { timeout: 1000 })));
  assert.equal(timed.length, 2);
  assert.deepEqual(EXERCISES.filter(e => e.reps === null).map(e => e.id), timed.map(e => e.id));
  for (const expected of timed) {
    const actual = EXERCISES.find(e => e.id === expected.id);
    for (const [field, value] of Object.entries(expected)) assert.deepEqual(actual[field], value, `${expected.id}.${field}`);
    assert.equal(actual.imageUrl, DEFAULT_EXERCISE_IMAGE);
  }
});
