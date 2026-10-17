import assert from "node:assert/strict";
import test from "node:test";
import { chooseActivityBatchSize, chooseGradualBatch } from "./chewata-import-pacing.mjs";

const start = Date.parse("2026-10-12T12:40:00Z");
const hour = 60 * 60_000;
const fiveMinutes = 5 * 60_000;

function pacingState() {
  return {
    targetTotal: 6000,
    deadline: "2026-10-18T09:00:00Z",
    pacing: { startedAt: new Date(start).toISOString(), importedAtStart: 2596 }
  };
}

test("uses small batches while five-minute runs stay on schedule", () => {
  const state = pacingState();
  let imported = 2596;
  let largestBatch = 0;
  for (let time = start; time < start + 24 * hour; time += fiveMinutes) {
    const batch = chooseGradualBatch(state.targetTotal - imported, state, time, () => 0.5);
    imported += batch;
    largestBatch = Math.max(largestBatch, batch);
  }
  assert.ok(largestBatch <= 5, `unexpectedly large on-schedule batch: ${largestBatch}`);
  assert.ok(imported > 3100 && imported < 3300, `unexpected first-day total: ${imported}`);
});

test("never adds more than the exact remaining target", () => {
  const state = pacingState();
  const batch = chooseGradualBatch(3, state, Date.parse(state.deadline) - 6 * hour, () => 0.99);
  assert.ok(batch >= 0 && batch <= 3);
});

test("allows a no-arrival interval when comfortably ahead", () => {
  assert.equal(chooseGradualBatch(3404, pacingState(), start, () => 0.5), 0);
});

test("catches up after a missed day and still finishes before the deadline", () => {
  const state = pacingState();
  let imported = 2596;
  let firstBatch = null;
  let completedAt = null;
  for (let time = start + 24 * hour; time < Date.parse(state.deadline); time += fiveMinutes) {
    const batch = chooseGradualBatch(state.targetTotal - imported, state, time, () => 0.5);
    if (firstBatch === null) firstBatch = batch;
    imported += batch;
    if (imported === state.targetTotal) {
      completedAt = time;
      break;
    }
  }
  assert.equal(firstBatch, 30);
  assert.equal(imported, 6000);
  assert.ok(completedAt < Date.parse(state.deadline));
});

test("fails visibly instead of importing after the deadline", () => {
  const state = pacingState();
  assert.throws(() => chooseGradualBatch(10, state, Date.parse(state.deadline)), /deadline passed/);
  assert.equal(chooseGradualBatch(0, state, Date.parse(state.deadline)), 0);
});

test("rejects a missing pacing baseline", () => {
  const state = pacingState();
  delete state.pacing;
  assert.throws(() => chooseGradualBatch(3404, state, start), /baseline/);
});

test("activity volume rises modestly across the remaining window", () => {
  const state = { ...pacingState(), activityRampStartedAt: new Date(start).toISOString() };
  const averageAt = (time) => {
    let total = 0;
    for (let index = 0; index < 10_000; index += 1) {
      total += chooseActivityBatchSize(state, time, () => index / 10_000);
    }
    return total / 10_000;
  };
  const midpoint = (start + Date.parse(state.deadline)) / 2;
  assert.equal(averageAt(start), 1.31);
  assert.ok(averageAt(midpoint) > 1.31 && averageAt(midpoint) < 1.63);
  assert.equal(averageAt(Date.parse(state.deadline)), 1.63);
});

test("activity remains irregular and never selects more than five players", () => {
  const state = { ...pacingState(), activityRampStartedAt: new Date(start).toISOString() };
  const sizes = new Set(Array.from({ length: 100 }, (_, index) =>
    chooseActivityBatchSize(state, start, () => index / 100)
  ));
  assert.deepEqual([...sizes].sort((a, b) => a - b), [0, 1, 2, 5]);
});
