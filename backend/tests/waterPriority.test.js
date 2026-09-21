import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateWaterPriority, getWaterPriorityLevel } from '../src/services/waterPriority.service.js';

function district(id, population, count, coverage) {
  return {
    id, name: `District ${id}`, state: 'Karnataka', population,
    _count: { requests: count },
    infrastructure: coverage === undefined ? [] : [{ value: coverage }],
  };
}

test('water rates, normalization, gaps, scores, and descending ordering', () => {
  const result = calculateWaterPriority([
    district(1, 100000, 10, 80),
    district(2, 200000, 40, 60),
    district(3, 50000, 15, 20),
  ]);
  assert.deepEqual(result.map(row => row.districtId), [3, 2, 1]);
  assert.deepEqual(result.map(row => row.waterRequestCount), [15, 40, 10]);
  assert.deepEqual(result.map(row => row.waterRequestsPer100k), [30, 20, 10]);
  assert.deepEqual(result.map(row => row.demandIndex), [100, 50, 0]);
  assert.deepEqual(result.map(row => row.infrastructureGap), [80, 40, 20]);
  assert.deepEqual(result.map(row => row.priorityScore), [90, 45, 10]);
  assert.deepEqual(result.map(row => row.priorityLevel), ['VERY_HIGH', 'MEDIUM', 'LOW']);
  assert.ok(result.every(row => row.dataCompleteness === 'COMPLETE'));
});

test('display rounding occurs after normalization and score calculation', () => {
  const result = calculateWaterPriority([
    district(1, 300000, 1, 33.3333),
    district(2, 100000, 0, 100),
    district(3, 100000, 1, 100),
  ]);
  const row = result.find(item => item.districtId === 1);
  assert.equal(row.waterRequestsPer100k, 0.33);
  assert.equal(row.tapWaterCoverage, 33.33);
  assert.equal(row.demandIndex, 33.33);
  assert.equal(row.infrastructureGap, 66.67);
  assert.equal(row.priorityScore, 50);
  assert.equal(row.priorityLevel, 'HIGH');
});

test('priority level boundaries are inclusive at 0, 25, 50, 75, and 100', () => {
  for (const [score, level] of [
    [0, 'LOW'], [24.99, 'LOW'], [25, 'MEDIUM'], [49.99, 'MEDIUM'],
    [50, 'HIGH'], [74.99, 'HIGH'], [75, 'VERY_HIGH'], [100, 'VERY_HIGH'],
  ]) assert.equal(getWaterPriorityLevel(score), level);
  for (const invalid of [null, undefined, NaN, Infinity, -1, 101]) {
    assert.equal(getWaterPriorityLevel(invalid), null);
  }
});

test('level agrees with the rounded score near a threshold', () => {
  const [row] = calculateWaterPriority([district(1, 100000, 1, 50.008)]);
  assert.equal(row.priorityScore, 25);
  assert.equal(row.priorityLevel, 'MEDIUM');
});

test('missing coverage remains incomplete but its demand participates in normalization', () => {
  const result = calculateWaterPriority([
    district(1, 100000, 30), district(2, 100000, 20, 80), district(3, 100000, 10, 80),
  ]);
  assert.deepEqual(result.map(row => row.districtId), [2, 3, 1]);
  assert.equal(result[0].demandIndex, 50);
  const missing = result[2];
  assert.equal(missing.dataCompleteness, 'INCOMPLETE');
  assert.equal(missing.waterRequestsPer100k, 30);
  assert.equal(missing.demandIndex, 100);
  for (const field of ['tapWaterCoverage', 'infrastructureGap', 'priorityScore', 'priorityLevel']) {
    assert.equal(missing[field], null);
  }
});

test('invalid coverage is not clamped, scored, or replaced by an older valid value', () => {
  for (const coverage of [-0.01, 100.01, NaN, Infinity, -Infinity, null, '50']) {
    const input = district(1, 100000, 1, coverage);
    input.infrastructure.push({ value: 50 });
    const [row] = calculateWaterPriority([input]);
    assert.equal(row.dataCompleteness, 'INCOMPLETE');
    assert.equal(row.tapWaterCoverage, null);
    assert.equal(row.infrastructureGap, null);
    assert.equal(row.priorityScore, null);
    assert.equal(row.priorityLevel, null);
  }
});

test('coverage endpoints 0 and 100 are valid', () => {
  const result = calculateWaterPriority([district(1, 100000, 0, 0), district(2, 100000, 0, 100)]);
  assert.deepEqual(result.map(row => row.infrastructureGap), [100, 0]);
  assert.ok(result.every(row => row.dataCompleteness === 'COMPLETE'));
});

test('equal nonzero demand uses zero demandIndex without division by zero', () => {
  const result = calculateWaterPriority([district(1, 100000, 10, 50), district(2, 200000, 20, 80)]);
  assert.deepEqual(result.map(row => row.demandIndex), [0, 0]);
  assert.deepEqual(result.map(row => row.priorityScore), [25, 10]);
});

test('zero demand and a single district use zero demandIndex', () => {
  for (const inputs of [
    [district(1, 100000, 0, 50), district(2, 200000, 0, 80)],
    [district(1, 100000, 10, 50)],
  ]) assert.ok(calculateWaterPriority(inputs).every(row => row.demandIndex === 0));
});

test('invalid population yields null demand and is excluded from normalization', () => {
  for (const population of [0, -1, null, NaN, Infinity, 1.5]) {
    const result = calculateWaterPriority([district(1, population, 20, 50), district(2, 100000, 10, 80)]);
    assert.equal(result[0].districtId, 2);
    assert.equal(result[0].demandIndex, 0);
    const row = result[1];
    assert.equal(row.dataCompleteness, 'INCOMPLETE');
    assert.equal(row.waterRequestsPer100k, null);
    assert.equal(row.demandIndex, null);
    assert.equal(row.priorityScore, null);
    assert.equal(row.priorityLevel, null);
    assert.equal(row.infrastructureGap, 50);
  }
});

test('empty input returns an empty array', () => {
  assert.deepEqual(calculateWaterPriority([]), []);
});

test('all incomplete results avoid nonfinite calculated values and use ID order', () => {
  const result = calculateWaterPriority([district(2, 0, 1), district(1, 0, 2)]);
  assert.deepEqual(result.map(row => row.districtId), [1, 2]);
  for (const row of result) {
    for (const field of ['waterRequestsPer100k', 'demandIndex', 'infrastructureGap', 'priorityScore']) {
      assert.equal(row[field], null);
    }
  }
});

test('equal scores use district ID as a deterministic tiebreaker', () => {
  const result = calculateWaterPriority([district(2, 100000, 1, 50), district(1, 100000, 1, 50)]);
  assert.deepEqual(result.map(row => row.districtId), [1, 2]);
});
