import crypto from "node:crypto";

const HOUR_MS = 60 * 60_000;
const MAX_BATCH_SIZE = 30;

export function chooseGradualBatch(
  remaining,
  state,
  nowMs = Date.now(),
  random = () => crypto.randomInt(0, 1_000_000) / 1_000_000
) {
  if (remaining <= 0) return 0;

  const deadlineMs = new Date(state.deadline).getTime();
  if (nowMs >= deadlineMs) {
    throw new Error(`Chewata import deadline passed with ${remaining} players still missing.`);
  }

  const paceStartMs = new Date(state.pacing?.startedAt).getTime();
  const paceStartCount = state.pacing?.importedAtStart;
  if (!Number.isFinite(paceStartMs) || !Number.isInteger(paceStartCount)) {
    throw new Error("Chewata import pacing baseline is missing or invalid.");
  }

  // Aim to finish before the hard deadline, leaving up to 12 hours for outages.
  const bufferMs = Math.min(12 * HOUR_MS, (deadlineMs - paceStartMs) / 10);
  const paceEndMs = deadlineMs - bufferMs;
  const elapsed = Math.min(1, Math.max(0, (nowMs - paceStartMs) / (paceEndMs - paceStartMs)));
  const plannedCount = paceStartCount + (state.targetTotal - paceStartCount) * elapsed;
  const currentCount = state.targetTotal - remaining;
  const deficit = Math.max(0, plannedCount - currentCount);
  const irregularAmount = deficit * (0.7 + random() * 0.6);
  const whole = Math.floor(irregularAmount);
  const selected = whole + (random() < irregularAmount - whole ? 1 : 0);

  return Math.min(remaining, MAX_BATCH_SIZE, selected);
}

export function chooseActivityBatchSize(
  state,
  nowMs = Date.now(),
  random = () => crypto.randomInt(0, 1_000_000) / 1_000_000
) {
  const startedMs = new Date(state.activityRampStartedAt).getTime();
  const deadlineMs = new Date(state.deadline).getTime();
  if (!Number.isFinite(startedMs) || !Number.isFinite(deadlineMs)) {
    throw new Error("Chewata activity ramp baseline is missing or invalid.");
  }

  const progress = Math.min(1, Math.max(0, (nowMs - startedMs) / Math.max(1, deadlineMs - startedMs)));
  const draw = random();
  const noActivityCutoff = 0.28 - 0.08 * progress;
  const onePlayerCutoff = 0.65 - 0.12 * progress;
  const twoPlayerCutoff = 0.92 - 0.04 * progress;
  if (draw < noActivityCutoff) return 0;
  if (draw < onePlayerCutoff) return 1;
  if (draw < twoPlayerCutoff) return 2;
  return 5;
}
