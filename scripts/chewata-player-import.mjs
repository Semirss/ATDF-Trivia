import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { chooseActivityBatchSize, chooseGradualBatch } from "./chewata-import-pacing.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const DEFAULT_CSV_PATH = "C:/Users/hp/Downloads/Chewata Notifier - users.csv";
const DEFAULT_STATE_PATH = path.join(PROJECT_ROOT, "outputs", "chewata-player-import-state.json");
const DEFAULT_LOG_PATH = path.join(PROJECT_ROOT, "outputs", "chewata-player-import-worker.log");
const DEFAULT_TARGET = 6000;
const DEFAULT_INITIAL_LIMIT = 2000;
const DEFAULT_BATCH_LABEL = "chewata-csv-2026-10-08";
const DEFAULT_DEADLINE = "2026-10-18T12:00:00+03:00";
const INSERT_BATCH_SIZE = 400;

function parseArguments(argv) {
  const positional = [];
  const flags = new Map();

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) {
      positional.push(value);
      continue;
    }

    const [rawKey, inlineValue] = value.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      flags.set(rawKey, inlineValue);
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      flags.set(rawKey, next);
      index += 1;
    } else {
      flags.set(rawKey, true);
    }
  }

  return {
    command: positional[0] ?? "dry-run",
    csvPath: path.resolve(String(flags.get("csv") ?? DEFAULT_CSV_PATH)),
    statePath: path.resolve(String(flags.get("state") ?? DEFAULT_STATE_PATH)),
    target: Number(flags.get("target") ?? DEFAULT_TARGET),
    limit: Number(flags.get("limit") ?? DEFAULT_INITIAL_LIMIT),
    batchLabel: String(flags.get("batch-label") ?? DEFAULT_BATCH_LABEL),
    deadline: String(flags.get("deadline") ?? DEFAULT_DEADLINE),
    skipTelegram: flags.has("skip-telegram")
  };
}

const options = parseArguments(process.argv.slice(2));

function requireEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

const supabaseUrl = requireEnvironment("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = requireEnvironment("SUPABASE_SERVICE_ROLE_KEY");
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function chunk(values, size = INSERT_BATCH_SIZE) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function clean(value) {
  const source = String(value ?? "");
  const wellFormed = typeof source.toWellFormed === "function"
    ? source.toWellFormed()
    : source.replace(/[\uD800-\uDFFF]/g, "");
  return wellFormed
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function deterministicUuid(value) {
  const bytes = crypto.createHash("sha256").update(value).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function seededRandom(seed) {
  let state = Number.parseInt(sha256(seed).slice(0, 8), 16) >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInteger(random, minimum, maximum) {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

function randomItem(random, values) {
  return values[Math.floor(random() * values.length)];
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (character === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  const [headerRow = [], ...dataRows] = rows;
  const headers = headerRow.map((header) => clean(header.replace(/^\uFEFF/, "")));
  return dataRows
    .filter((values) => values.some((value) => clean(value)))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function mergeCsvRows(existing, incoming) {
  const merged = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    if (!clean(merged[key]) && clean(value)) {
      merged[key] = value;
    }
  }

  const existingPlays = Number.parseInt(clean(existing["Play Count"]), 10);
  const incomingPlays = Number.parseInt(clean(incoming["Play Count"]), 10);
  if (Number.isFinite(incomingPlays) && (!Number.isFinite(existingPlays) || incomingPlays > existingPlays)) {
    merged["Play Count"] = String(incomingPlays);
  }

  return merged;
}

function loadCsvRows(csvPath) {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  const records = parseCsv(fs.readFileSync(csvPath, "utf8"));
  const byTelegramId = new Map();
  let invalidTelegramIds = 0;
  let duplicateRows = 0;

  for (const record of records) {
    const telegramId = clean(record["Telegram ID"]);
    if (!/^\d+$/.test(telegramId)) {
      invalidTelegramIds += 1;
      continue;
    }

    if (byTelegramId.has(telegramId)) {
      duplicateRows += 1;
      byTelegramId.set(telegramId, mergeCsvRows(byTelegramId.get(telegramId), record));
    } else {
      byTelegramId.set(telegramId, record);
    }
  }

  return {
    rows: Array.from(byTelegramId.entries()).map(([telegramId, record]) => ({ ...record, telegramId })),
    sourceRows: records.length,
    invalidTelegramIds,
    duplicateRows
  };
}

async function fetchAll(table, columns, orderColumn = "id") {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const response = await supabase.from(table).select(columns).order(orderColumn).range(from, from + 999);
    if (response.error) {
      throw new Error(`${table}: ${response.error.message}`);
    }
    rows.push(...response.data);
    if (response.data.length < 1000) {
      return rows;
    }
  }
}

function parseSourceDate(value) {
  const normalized = clean(value);
  if (!normalized) return null;
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)
    ? `${normalized.replace(" ", "T")}+03:00`
    : normalized;
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? date : null;
}

function stateTemplate() {
  return {
    version: 1,
    batchLabel: options.batchLabel,
    csvPath: options.csvPath,
    targetTotal: options.target,
    deadline: new Date(options.deadline).toISOString(),
    startedAt: new Date().toISOString(),
    protectedPlayerIds: [],
    importedPlayerIds: [],
    completedPlayerIds: [],
    rejectedPlayerIds: [],
    playerMeta: {},
    playerActivity: {},
    activityTotals: {
      sessions: 0,
      scoreEvents: 0,
      progressUpdates: 0,
      analytics: 0,
      adViews: 0
    },
    totals: {
      players: 0,
      sessions: 0,
      scoreEvents: 0,
      progress: 0,
      analytics: 0,
      adViews: 0,
      avatars: 0,
      avatarsUnavailable: 0,
      avatarFailures: 0,
      skippedExisting: 0,
      skippedMissingName: 0
    },
    runs: [],
    status: "initialized",
    workerPid: null,
    updatedAt: new Date().toISOString()
  };
}

function readState() {
  if (!fs.existsSync(options.statePath)) return null;
  return JSON.parse(fs.readFileSync(options.statePath, "utf8"));
}

function writeState(state) {
  fs.mkdirSync(path.dirname(options.statePath), { recursive: true });
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(options.statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function validateState(state) {
  if (state.batchLabel !== options.batchLabel) {
    throw new Error(`State belongs to ${state.batchLabel}, not ${options.batchLabel}.`);
  }
  if (path.resolve(state.csvPath) !== options.csvPath) {
    throw new Error("State CSV path does not match the requested CSV path.");
  }
  state.rejectedPlayerIds = Array.isArray(state.rejectedPlayerIds) ? state.rejectedPlayerIds : [];
  state.playerActivity = state.playerActivity && typeof state.playerActivity === "object" ? state.playerActivity : {};
  state.activityTotals = {
    sessions: Number(state.activityTotals?.sessions) || 0,
    scoreEvents: Number(state.activityTotals?.scoreEvents) || 0,
    progressUpdates: Number(state.activityTotals?.progressUpdates) || 0,
    analytics: Number(state.activityTotals?.analytics) || 0,
    adViews: Number(state.activityTotals?.adViews) || 0
  };
}

function normalizeAdConfig(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.enabled !== true) return [];
  const fallbackDuration = clamp(Math.round(Number(value.duration_seconds) || 15), 3, 180);
  const candidates = [];

  if (Array.isArray(value.ads)) {
    for (const ad of value.ads) {
      if (ad && typeof ad === "object" && typeof ad.url === "string" && ad.url.trim()) {
        candidates.push({
          url: ad.url.trim(),
          durationSeconds: clamp(Math.round(Number(ad.durationSeconds ?? ad.duration_seconds) || fallbackDuration), 3, 180)
        });
      }
    }
  }

  const urls = Array.isArray(value.urls) ? value.urls : [];
  if (typeof value.url === "string") urls.push(value.url);
  for (const url of urls) {
    if (typeof url === "string" && url.trim()) {
      candidates.push({ url: url.trim(), durationSeconds: fallbackDuration });
    }
  }

  return Array.from(new Map(candidates.map((ad) => [ad.url, ad])).values());
}

async function loadDatabaseContext() {
  const [players, profiles, categoriesResponse, levelsResponse, questionsResponse, leaderboardResponse, adConfigResponse] =
    await Promise.all([
      fetchAll("players", "id,name,age,avatar_url,telegram_id,telegram_username,telegram_phone,source,created_at"),
      fetchAll("telegram_user_profiles", "telegram_id,phone,username,first_name,last_name,age", "telegram_id"),
      supabase.from("categories").select("id,title,is_active,sort_order").eq("is_active", true).order("sort_order"),
      supabase
        .from("category_levels")
        .select("id,category_id,level_number,difficulty,question_count,points_per_correct,is_active")
        .eq("is_active", true)
        .order("category_id")
        .order("level_number"),
      supabase.from("questions").select("id,level_id,is_active,sort_order").eq("is_active", true).order("level_id").order("sort_order"),
      supabase.from("leaderboard").select("player_id,total_score,global_rank").order("global_rank").limit(100),
      supabase.from("game_config").select("value").eq("key", "youtube_ad_config").maybeSingle()
    ]);

  for (const response of [categoriesResponse, levelsResponse, questionsResponse, leaderboardResponse, adConfigResponse]) {
    if (response.error) throw new Error(response.error.message);
  }

  const activeCategoryIds = new Set((categoriesResponse.data ?? []).map((category) => category.id));
  const levels = (levelsResponse.data ?? []).filter((level) => activeCategoryIds.has(level.category_id));
  const activeLevelIds = new Set(levels.map((level) => level.id));
  const questions = (questionsResponse.data ?? []).filter((question) => activeLevelIds.has(question.level_id));
  const top20 = (leaderboardResponse.data ?? []).filter((row) => row.global_rank <= 20);
  const rank20Score = top20.length > 0 ? Math.min(...top20.map((row) => row.total_score)) : 0;

  if (levels.length === 0 || questions.length === 0) {
    throw new Error("No active levels/questions are available for consistent gameplay generation.");
  }

  return {
    players,
    playerByTelegramId: new Map(players.filter((player) => player.telegram_id).map((player) => [player.telegram_id, player])),
    playerById: new Map(players.map((player) => [player.id, player])),
    profilesByTelegramId: new Map(profiles.map((profile) => [profile.telegram_id, profile])),
    categories: categoriesResponse.data ?? [],
    levels,
    questions,
    rank20Score,
    top20PlayerIds: new Set(top20.map((row) => row.player_id)),
    ads: normalizeAdConfig(adConfigResponse.data?.value)
  };
}

let telegramGate = Promise.resolve();
let nextTelegramRequestAt = 0;

async function acquireTelegramSlot() {
  const queued = telegramGate.then(async () => {
    const delay = Math.max(0, nextTelegramRequestAt - Date.now());
    if (delay > 0) await sleep(delay);
    nextTelegramRequestAt = Date.now() + 45;
  });
  telegramGate = queued.catch(() => undefined);
  await queued;
}

async function telegramApi(method, parameters, attempts = 5) {
  if (!telegramBotToken) return null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await acquireTelegramSlot();
    const url = new URL(`https://api.telegram.org/bot${telegramBotToken}/${method}`);
    for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, String(value));

    try {
      const response = await fetch(url);
      const payload = await response.json();
      if (payload.ok) return payload.result;
      if (payload.error_code === 429 && attempt < attempts) {
        await sleep(Math.max(1000, Number(payload.parameters?.retry_after ?? 1) * 1000));
        continue;
      }
      if (payload.error_code >= 500 && attempt < attempts) {
        await sleep(500 * attempt);
        continue;
      }
      return null;
    } catch {
      if (attempt === attempts) return null;
      await sleep(500 * attempt);
    }
  }

  return null;
}

async function mapLimit(values, limit, mapper) {
  const results = new Array(values.length);
  let cursor = 0;

  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(values[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, () => worker()));
  return results;
}

function profileName(profile) {
  if (!profile) return "";
  return clean([profile.first_name, profile.last_name].filter(Boolean).join(" ")) || clean(profile.username);
}

async function resolveTelegramRows(rows, context, { skipTelegram = false } = {}) {
  let processed = 0;
  return mapLimit(rows, 10, async (row) => {
    const profile = context.profilesByTelegramId.get(row.telegramId);
    const csvName = clean(row.Name);
    let chat = null;

    if (!skipTelegram && telegramBotToken) {
      chat = await telegramApi("getChat", { chat_id: row.telegramId });
    }

    processed += 1;
    if (!skipTelegram && processed % 250 === 0) {
      console.log(`Resolved Telegram profiles: ${processed}/${rows.length}`);
    }

    const telegramName = chat
      ? clean([chat.first_name, chat.last_name].filter(Boolean).join(" ")) || clean(chat.username)
      : "";
    const name = csvName || profileName(profile) || telegramName;
    const photoFileId = chat?.photo?.big_file_id || chat?.photo?.small_file_id || null;

    return {
      ...row,
      name: name.slice(0, 80),
      telegramUsername: clean(chat?.username || profile?.username).replace(/^@/, "") || null,
      telegramPhone: clean(row.Phone || profile?.phone) || null,
      photoFileId
    };
  });
}

function createdAtFor(row, mode, asOf, random) {
  const sourceDate = parseSourceDate(row["Date Joined"]);
  const latest = new Date(asOf.getTime() - 60 * 60 * 1000);
  const defaultEarliest = mode === "initial"
    ? new Date("2025-12-01T00:00:00Z")
    : new Date(asOf.getTime() - 60 * 24 * 60 * 60 * 1000);
  let earliest = defaultEarliest;

  if (sourceDate && sourceDate < latest && sourceDate > earliest) {
    earliest = sourceDate;
  }
  if (earliest >= latest) {
    earliest = new Date(latest.getTime() - 14 * 24 * 60 * 60 * 1000);
  }

  const span = Math.max(1, latest.getTime() - earliest.getTime());
  const weighted = mode === "initial" ? random() : Math.pow(random(), 0.65);
  return new Date(earliest.getTime() + span * weighted);
}

function sessionsFor(row, random, mode) {
  if (mode === "gradual") {
    const draw = random();
    if (draw < 0.52) return 0;
    if (draw < 0.91) return 1;
    return 2;
  }

  const sourcePlays = Number.parseInt(clean(row["Play Count"]), 10);
  if (Number.isFinite(sourcePlays)) {
    if (sourcePlays <= 0) return random() < 0.78 ? 0 : 1;
    const jitter = randomInteger(random, -1, 2);
    return clamp(Math.round(sourcePlays * (0.7 + random() * 0.45)) + jitter, 1, 18);
  }

  const segment = random();
  if (segment < 0.24) return 0;
  if (segment < 0.67) return randomInteger(random, 1, 3);
  if (segment < 0.93) return randomInteger(random, 4, 8);
  return randomInteger(random, 9, 16);
}

function getVideoId(url) {
  let hash = 2166136261;
  for (let index = 0; index < url.length; index += 1) {
    hash ^= url.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  let filename = "video";
  try {
    const lastSegment = new URL(url).pathname.split("/").filter(Boolean).at(-1);
    if (lastSegment) {
      filename = decodeURIComponent(lastSegment)
        .replace(/\.[a-z0-9]+$/i, "")
        .replace(/[^a-z0-9_-]+/gi, "-")
        .replace(/^-+|-+$/g, "") || "video";
    }
  } catch {
    // Existing configuration validation owns URL correctness.
  }

  return `${filename.slice(0, 55)}-${(hash >>> 0).toString(36)}`;
}

function buildGameplayPlan(players, context, runMarker) {
  const levelsByCategory = new Map();
  for (const level of context.levels) {
    const items = levelsByCategory.get(level.category_id) ?? [];
    items.push(level);
    levelsByCategory.set(level.category_id, items);
  }

  const questionsByLevel = new Map();
  for (const question of context.questions) {
    const items = questionsByLevel.get(question.level_id) ?? [];
    items.push(question);
    questionsByLevel.set(question.level_id, items);
  }

  const categories = context.categories.filter((category) => (levelsByCategory.get(category.id) ?? []).length > 0);
  const sessions = [];
  const scoreEvents = [];
  const progressRows = [];
  const adViews = [];
  const analyticsMap = new Map();
  const minimumPositivePoints = Math.min(...context.levels.map((level) => Math.max(1, level.points_per_correct)));
  const scoreCeiling = Math.max(0, context.rank20Score - minimumPositivePoints);

  function addAnalytics(date, eventType, eventKey, label, routePath, count, seenAt) {
    const key = [date, eventType, eventKey, routePath].join("|");
    const existing = analyticsMap.get(key);
    if (existing) {
      existing.count += count;
      if (seenAt > existing.last_seen_at) existing.last_seen_at = seenAt;
      return;
    }
    analyticsMap.set(key, {
      id: deterministicUuid(`${options.batchLabel}:analytics:${key}`),
      event_date: date,
      event_type: eventType,
      event_key: eventKey.slice(0, 120),
      label: label.slice(0, 120),
      path: routePath.slice(0, 160),
      count,
      last_seen_at: seenAt
    });
  }

  for (const player of players) {
    const random = seededRandom(`${options.batchLabel}:behavior:${player.telegramId}`);
    const asOf = new Date(player.asOf);
    const createdAt = new Date(player.created_at);
    const sessionCount = sessionsFor(player.sourceRow, random, player.importMode);
    const categoryCount = sessionCount === 0 ? 0 : clamp(randomInteger(random, 1, 3), 1, Math.min(3, categories.length));
    const selectedCategories = [...categories]
      .sort((left, right) => sha256(`${player.id}:${left.id}`).localeCompare(sha256(`${player.id}:${right.id}`)))
      .slice(0, categoryCount);
    const skill = 0.48 + random() * 0.3;
    const categorySessionCounts = new Map();
    const categoryDetails = new Map();
    let totalScore = 0;
    const sessionTimes = [];

    for (let index = 0; index < sessionCount; index += 1) {
      const span = Math.max(60_000, asOf.getTime() - createdAt.getTime() - 5 * 60_000);
      const weighted = 0.03 + Math.pow(random(), 0.62) * 0.97;
      sessionTimes.push(new Date(createdAt.getTime() + span * weighted));
    }
    sessionTimes.sort((left, right) => left.getTime() - right.getTime());

    for (let sessionIndex = 0; sessionIndex < sessionTimes.length; sessionIndex += 1) {
      const category = selectedCategories[sessionIndex % selectedCategories.length];
      const categoryIndex = categorySessionCounts.get(category.id) ?? 0;
      categorySessionCounts.set(category.id, categoryIndex + 1);
      const availableLevels = levelsByCategory.get(category.id) ?? [];
      const level = availableLevels[Math.min(categoryIndex, availableLevels.length - 1)];
      const questions = questionsByLevel.get(level.id) ?? [];
      const startedAt = sessionTimes[sessionIndex];
      const sessionId = deterministicUuid(`${options.batchLabel}:session:${player.id}:${sessionIndex}`);
      const detail = categoryDetails.get(category.id) ?? {
        score: 0,
        completedLevels: new Set(),
        latestLevel: level,
        latestAnsweredCount: 0,
        lastPlayedAt: startedAt.toISOString()
      };

      sessions.push({
        id: sessionId,
        player_id: player.id,
        category_id: category.id,
        level_id: level.id,
        started_at: startedAt.toISOString()
      });
      addAnalytics(
        startedAt.toISOString().slice(0, 10),
        "game_played",
        `${category.id}:${level.id}:import:${runMarker}`,
        `${category.title} L${level.level_number}`,
        `/category/${category.id}/play`,
        1,
        startedAt.toISOString()
      );
      addAnalytics(
        startedAt.toISOString().slice(0, 10),
        "button_tap",
        `button:play:import:${runMarker}`,
        "Play",
        `/category/${category.id}`,
        1,
        startedAt.toISOString()
      );

      const abandoned = random() < 0.09;
      const completed = !abandoned && questions.length > 0 && random() < 0.58;
      const answeredCount = abandoned
        ? 0
        : completed
          ? questions.length
          : randomInteger(random, 1, Math.max(1, questions.length - 1));

      for (let questionIndex = 0; questionIndex < answeredCount; questionIndex += 1) {
        const question = questions[questionIndex];
        if (!question) continue;
        const difficultyAdjustment = level.difficulty === "easy" ? 0.07 : level.difficulty === "hard" ? -0.09 : 0;
        let isCorrect = random() < clamp(skill + difficultyAdjustment, 0.38, 0.88);
        const points = Math.max(0, level.points_per_correct);
        if (isCorrect && totalScore + points > scoreCeiling) isCorrect = false;
        const awarded = isCorrect ? points : 0;
        const answeredAt = new Date(startedAt.getTime() + (questionIndex + 1) * randomInteger(random, 18, 52) * 1000);

        totalScore += awarded;
        detail.score += awarded;
        scoreEvents.push({
          id: deterministicUuid(`${options.batchLabel}:score:${player.id}:${question.id}`),
          player_id: player.id,
          category_id: category.id,
          level_id: level.id,
          question_id: question.id,
          is_correct: isCorrect,
          points: awarded,
          answered_at: answeredAt.toISOString()
        });
        addAnalytics(
          answeredAt.toISOString().slice(0, 10),
          "button_tap",
          `button:answer:import:${runMarker}`,
          "Answer option",
          `/category/${category.id}/play`,
          1,
          answeredAt.toISOString()
        );
      }

      if (completed) {
        detail.completedLevels.add(level.id);
        const completedAt = new Date(startedAt.getTime() + Math.max(1, questions.length) * 45 * 1000);
        addAnalytics(
          completedAt.toISOString().slice(0, 10),
          "level_completed",
          `${category.id}:${level.id}:import:${runMarker}`,
          `${category.title} L${level.level_number}`,
          `/category/${category.id}/play`,
          1,
          completedAt.toISOString()
        );

        if (context.ads.length > 0 && random() < 0.42) {
          const ad = randomItem(random, context.ads);
          const adStarted = new Date(completedAt.getTime() + randomInteger(random, 5, 40) * 1000);
          const adCompleted = random() < 0.82;
          adViews.push({
            id: deterministicUuid(`${options.batchLabel}:ad:${player.id}:${level.id}`),
            player_id: player.id,
            video_id: getVideoId(ad.url),
            video_url: ad.url,
            started_at: adStarted.toISOString(),
            completed_at: adCompleted ? new Date(adStarted.getTime() + ad.durationSeconds * 1000).toISOString() : null,
            watched_seconds: adCompleted ? ad.durationSeconds : randomInteger(random, 1, Math.max(1, ad.durationSeconds - 1))
          });
        }
      }

      detail.latestLevel = level;
      detail.latestAnsweredCount = answeredCount;
      detail.lastPlayedAt = startedAt.toISOString();
      categoryDetails.set(category.id, detail);
    }

    for (const [categoryId, detail] of categoryDetails) {
      const availableLevels = levelsByCategory.get(categoryId) ?? [];
      const latestIndex = Math.max(0, availableLevels.findIndex((level) => level.id === detail.latestLevel.id));
      const latestWasCompleted = detail.completedLevels.has(detail.latestLevel.id);
      const nextLevel = latestWasCompleted ? availableLevels[Math.min(latestIndex + 1, availableLevels.length - 1)] : detail.latestLevel;
      progressRows.push({
        id: deterministicUuid(`${options.batchLabel}:progress:${player.id}:${categoryId}`),
        player_id: player.id,
        category_id: categoryId,
        current_level: nextLevel?.level_number ?? 1,
        current_question_index: latestWasCompleted ? 0 : detail.latestAnsweredCount,
        score: detail.score,
        levels_completed: detail.completedLevels.size,
        last_played_at: detail.lastPlayedAt
      });
    }
  }

  return {
    sessions,
    scoreEvents,
    progressRows,
    adViews,
    analyticsRows: Array.from(analyticsMap.values()),
    scoreCeiling
  };
}

async function insertRows(table, rows, onConflict = "id") {
  for (const items of chunk(rows)) {
    const response = await supabase.from(table).upsert(items, { onConflict, ignoreDuplicates: true });
    if (response.error) throw new Error(`${table}: ${response.error.message}`);
  }
}

async function upsertRows(table, rows, onConflict) {
  for (const items of chunk(rows)) {
    const response = await supabase.from(table).upsert(items, { onConflict });
    if (response.error) throw new Error(`${table}: ${response.error.message}`);
  }
}

async function insertPlayers(rows) {
  const acceptedIds = [];
  const rejected = [];

  async function insertGroup(items) {
    if (items.length === 0) return;
    const response = await supabase.from("players").insert(items);
    if (!response.error) {
      acceptedIds.push(...items.map((item) => item.id));
      return;
    }

    if (items.length > 1) {
      const middle = Math.ceil(items.length / 2);
      await insertGroup(items.slice(0, middle));
      await insertGroup(items.slice(middle));
      return;
    }

    const [item] = items;
    const existing = await supabase.from("players").select("id").eq("telegram_id", item.telegram_id).maybeSingle();
    if (existing.error) throw new Error(`players duplicate check: ${existing.error.message}`);
    if (existing.data?.id === item.id) {
      acceptedIds.push(item.id);
      return;
    }

    rejected.push({ id: item.id, reason: response.error.message });
    console.warn(`Skipped one uninsertable CSV player (${sha256(item.id).slice(0, 12)}): ${response.error.message}`);
  }

  for (const items of chunk(rows, 200)) await insertGroup(items);
  return { acceptedIds, rejected };
}

async function ensureStorageBucket() {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET?.trim() || "trivia-assets";
  const existing = await supabase.storage.getBucket(bucket);
  if (!existing.data && existing.error) {
    const created = await supabase.storage.createBucket(bucket, { public: true, fileSizeLimit: "10MB" });
    if (created.error) throw new Error(`storage bucket: ${created.error.message}`);
  }
  return bucket;
}

async function uploadTelegramAvatar(player, bucket) {
  if (!player.photoFileId) return "unavailable";
  const file = await telegramApi("getFile", { file_id: player.photoFileId });
  if (!file?.file_path) return "failed";

  try {
    const response = await fetch(`https://api.telegram.org/file/bot${telegramBotToken}/${file.file_path}`);
    if (!response.ok) return "failed";
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const extension = path.extname(file.file_path).replace(/[^.a-z0-9]/gi, "") || ".jpg";
    const storagePath = `players/avatars/${player.id}${extension}`;
    const upload = await supabase.storage.from(bucket).upload(storagePath, Buffer.from(await response.arrayBuffer()), {
      cacheControl: "86400",
      upsert: true,
      contentType
    });
    if (upload.error) return "failed";
    const publicUrl = supabase.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl;
    const update = await supabase
      .from("players")
      .update({ avatar_url: publicUrl })
      .eq("id", player.id)
      .eq("telegram_id", player.telegramId);
    return update.error ? "failed" : "uploaded";
  } catch {
    return "failed";
  }
}

function orderedCsvRows(rows, state) {
  return [...rows].sort((left, right) =>
    sha256(`${state.batchLabel}:order:${left.telegramId}`).localeCompare(
      sha256(`${state.batchLabel}:order:${right.telegramId}`)
    )
  );
}

async function gatherNewPlayers(state, context, csvRows, requested, mode, { skipTelegram = false } = {}) {
  const protectedIds = new Set(state.protectedPlayerIds);
  const importedIds = new Set(state.importedPlayerIds);
  const rejectedIds = new Set(state.rejectedPlayerIds ?? []);
  const ordered = orderedCsvRows(csvRows, state);
  const namedCandidates = [];
  const unnamedCandidates = [];
  let skippedExisting = 0;

  for (const row of ordered) {
    const existing = context.playerByTelegramId.get(row.telegramId);
    const expectedId = deterministicUuid(`${state.batchLabel}:player:${row.telegramId}`);
    if (rejectedIds.has(expectedId)) continue;
    if (existing) {
      if (existing.id === expectedId && !protectedIds.has(existing.id) && !importedIds.has(existing.id)) {
        state.importedPlayerIds.push(existing.id);
        importedIds.add(existing.id);
      } else if (!importedIds.has(existing.id)) {
        skippedExisting += 1;
      }
      continue;
    }
    const knownName = clean(row.Name) || profileName(context.profilesByTelegramId.get(row.telegramId));
    if (knownName) namedCandidates.push(row);
    else unnamedCandidates.push(row);
    if (namedCandidates.length >= requested) break;
  }

  const candidates = namedCandidates.length >= requested
    ? namedCandidates.slice(0, requested)
    : [...namedCandidates, ...unnamedCandidates.slice(0, requested - namedCandidates.length + 30)];
  const resolved = await resolveTelegramRows(candidates, context, { skipTelegram });
  const valid = resolved.filter((row) => row.name).slice(0, requested);
  const skippedMissingName = resolved.filter((row) => !row.name).length;
  const asOf = new Date();
  const players = valid.map((row) => {
    const id = deterministicUuid(`${state.batchLabel}:player:${row.telegramId}`);
    const random = seededRandom(`${state.batchLabel}:profile:${row.telegramId}`);
    const createdAt = createdAtFor(row, mode, asOf, random);
    return {
      id,
      telegramId: row.telegramId,
      photoFileId: row.photoFileId,
      sourceRow: row,
      importMode: mode,
      asOf: asOf.toISOString(),
      created_at: createdAt.toISOString(),
      databaseRow: {
        id,
        name: row.name,
        age: randomInteger(random, 18, 45),
        avatar_url: null,
        telegram_id: row.telegramId,
        telegram_username: row.telegramUsername,
        telegram_phone: row.telegramPhone,
        source: "telegram",
        created_at: createdAt.toISOString()
      }
    };
  });

  return { players, skippedExisting, skippedMissingName };
}

async function gatherPendingPlayers(state, context, csvRows, { skipTelegram = false } = {}) {
  const completed = new Set(state.completedPlayerIds);
  const pendingIds = state.importedPlayerIds.filter((id) => !completed.has(id));
  if (pendingIds.length === 0) return [];

  const csvByTelegramId = new Map(csvRows.map((row) => [row.telegramId, row]));
  const pendingRows = [];
  for (const playerId of pendingIds) {
    const player = context.playerById.get(playerId);
    if (!player?.telegram_id) continue;
    const sourceRow = csvByTelegramId.get(player.telegram_id);
    if (!sourceRow) continue;
    pendingRows.push({ sourceRow, player });
  }

  const resolved = await resolveTelegramRows(pendingRows.map((item) => item.sourceRow), context, { skipTelegram });
  return resolved.map((row, index) => {
    const existing = pendingRows[index].player;
    const meta = state.playerMeta[existing.id] ?? { asOf: state.startedAt, mode: "initial" };
    return {
      id: existing.id,
      telegramId: existing.telegram_id,
      photoFileId: row.photoFileId,
      sourceRow: row,
      importMode: meta.mode,
      asOf: meta.asOf,
      created_at: existing.created_at,
      databaseRow: null
    };
  });
}

async function verifyRun(state, runPlayerIds, scoreCeiling) {
  const leaderboard = await fetchAll("leaderboard", "player_id,total_score,global_rank", "player_id");
  const runIds = new Set(runPlayerIds);
  const importedTop20 = leaderboard.filter((row) => row.global_rank <= 20 && runIds.has(row.player_id));
  const overCeiling = leaderboard.filter((row) => runIds.has(row.player_id) && row.total_score > scoreCeiling);
  const currentPlayers = await fetchAll("players", "id,age", "id");
  const invalidAges = currentPlayers.filter((player) => runIds.has(player.id) && (player.age < 18 || player.age > 45));

  if (importedTop20.length > 0) throw new Error("Validation failed: an imported player entered the top 20.");
  if (overCeiling.length > 0) throw new Error("Validation failed: an imported score exceeded the safe ceiling.");
  if (invalidAges.length > 0) throw new Error("Validation failed: an imported age is outside 18-45.");

  return { importedTop20: 0, overCeiling: 0, invalidAges: 0, importedTotal: state.importedPlayerIds.length };
}

async function runImport(requested, mode, { dryRun = false, skipTelegram = false } = {}) {
  const csv = loadCsvRows(options.csvPath);
  let state = readState();
  const context = await loadDatabaseContext();

  if (!state) {
    state = stateTemplate();
    state.protectedPlayerIds = context.players.map((player) => player.id);
    if (!dryRun) writeState(state);
  } else {
    validateState(state);
  }

  const remainingTarget = Math.max(0, state.targetTotal - state.importedPlayerIds.length);
  if (remainingTarget === 0) {
    state.status = "complete";
    if (!dryRun) writeState(state);
    console.log(JSON.stringify({ status: "complete", imported: state.importedPlayerIds.length, target: state.targetTotal }, null, 2));
    return state;
  }

  let players = await gatherPendingPlayers(state, context, csv.rows, { skipTelegram });
  let skippedExisting = 0;
  let skippedMissingName = 0;

  if (players.length === 0) {
    const gathered = await gatherNewPlayers(
      state,
      context,
      csv.rows,
      Math.min(requested, remainingTarget),
      mode,
      { skipTelegram }
    );
    players = gathered.players;
    skippedExisting = gathered.skippedExisting;
    skippedMissingName = gathered.skippedMissingName;
  }

  if (players.length === 0) {
    throw new Error("No eligible new CSV players could be resolved without inventing a name.");
  }

  const runMarker = sha256(players.map((player) => player.id).sort().join(":" )).slice(0, 10);
  let gameplay = buildGameplayPlan(players, context, runMarker);
  const preview = {
    mode,
    dryRun,
    requested,
    csvSourceRows: csv.sourceRows,
    csvUniqueValidIds: csv.rows.length,
    csvDuplicateRows: csv.duplicateRows,
    skippedExisting,
    skippedMissingName,
    players: players.length,
    sessions: gameplay.sessions.length,
    scoreEvents: gameplay.scoreEvents.length,
    progress: gameplay.progressRows.length,
    analytics: gameplay.analyticsRows.length,
    adViews: gameplay.adViews.length,
    rank20Score: context.rank20Score,
    importedScoreCeiling: gameplay.scoreCeiling
  };
  console.log(JSON.stringify(preview, null, 2));

  if (dryRun) return state;

  const newPlayers = players.filter((player) => player.databaseRow);
  if (newPlayers.length > 0) {
    const insertion = await insertPlayers(newPlayers.map((player) => player.databaseRow));
    const acceptedIds = new Set(insertion.acceptedIds);
    for (const rejected of insertion.rejected) {
      if (!state.rejectedPlayerIds.includes(rejected.id)) state.rejectedPlayerIds.push(rejected.id);
    }
    players = players.filter((player) => !player.databaseRow || acceptedIds.has(player.id));
    gameplay = buildGameplayPlan(players, context, runMarker);
    for (const player of newPlayers.filter((player) => acceptedIds.has(player.id))) {
      if (!state.importedPlayerIds.includes(player.id)) state.importedPlayerIds.push(player.id);
      state.playerMeta[player.id] = { asOf: player.asOf, mode };
    }
    state.totals.players = state.importedPlayerIds.length;
    state.totals.skippedExisting = skippedExisting;
    state.totals.skippedMissingName += skippedMissingName;
    state.status = "importing";
    writeState(state);
  }

  await insertRows("player_game_sessions", gameplay.sessions);
  await insertRows("score_events", gameplay.scoreEvents);
  await insertRows("player_progress", gameplay.progressRows, "player_id,category_id");
  await insertRows("youtube_ad_views", gameplay.adViews);
  await insertRows("analytics_daily", gameplay.analyticsRows);

  let avatarUploaded = 0;
  let avatarUnavailable = 0;
  let avatarFailures = 0;
  if (!skipTelegram && telegramBotToken) {
    const bucket = await ensureStorageBucket();
    let avatarProcessed = 0;
    const avatarResults = await mapLimit(players, 5, async (player) => {
      const result = await uploadTelegramAvatar(player, bucket);
      avatarProcessed += 1;
      if (avatarProcessed % 100 === 0) console.log(`Processed avatars: ${avatarProcessed}/${players.length}`);
      return result;
    });
    avatarUploaded = avatarResults.filter((result) => result === "uploaded").length;
    avatarUnavailable = avatarResults.filter((result) => result === "unavailable").length;
    avatarFailures = avatarResults.filter((result) => result === "failed").length;
  } else {
    avatarUnavailable = players.length;
  }

  for (const player of players) {
    if (!state.completedPlayerIds.includes(player.id)) state.completedPlayerIds.push(player.id);
  }
  state.totals.sessions += gameplay.sessions.length;
  state.totals.scoreEvents += gameplay.scoreEvents.length;
  state.totals.progress += gameplay.progressRows.length;
  state.totals.analytics += gameplay.analyticsRows.length;
  state.totals.adViews += gameplay.adViews.length;
  state.totals.avatars += avatarUploaded;
  state.totals.avatarsUnavailable += avatarUnavailable;
  state.totals.avatarFailures += avatarFailures;
  state.runs.push({
    id: runMarker,
    mode,
    completedAt: new Date().toISOString(),
    players: players.length,
    sessions: gameplay.sessions.length,
    scoreEvents: gameplay.scoreEvents.length,
    progress: gameplay.progressRows.length,
    analytics: gameplay.analyticsRows.length,
    adViews: gameplay.adViews.length,
    avatars: avatarUploaded,
    avatarsUnavailable: avatarUnavailable,
    avatarFailures
  });
  state.status = state.importedPlayerIds.length >= state.targetTotal ? "complete" : "scheduled";
  await verifyRun(state, players.map((player) => player.id), gameplay.scoreCeiling);
  writeState(state);
  console.log(JSON.stringify({ status: state.status, imported: state.importedPlayerIds.length, target: state.targetTotal, ...state.totals }, null, 2));
  return state;
}

async function reconcileState() {
  const state = readState();
  if (!state) throw new Error("Import state does not exist. Run the initial import first.");
  validateState(state);
  const csv = loadCsvRows(options.csvPath);
  const context = await loadDatabaseContext();
  const protectedIds = new Set(state.protectedPlayerIds);
  const importedIds = new Set(state.importedPlayerIds);
  let adopted = 0;

  for (const row of csv.rows) {
    const expectedId = deterministicUuid(`${state.batchLabel}:player:${row.telegramId}`);
    const existing = context.playerByTelegramId.get(row.telegramId);
    if (!existing || existing.id !== expectedId || protectedIds.has(existing.id) || importedIds.has(existing.id)) continue;
    state.importedPlayerIds.push(existing.id);
    state.playerMeta[existing.id] = state.playerMeta[existing.id] ?? { asOf: state.startedAt, mode: "initial" };
    importedIds.add(existing.id);
    adopted += 1;
  }

  state.totals.players = state.importedPlayerIds.length;
  state.status = state.importedPlayerIds.length >= state.targetTotal ? "complete" : "scheduled";
  writeState(state);
  console.log(JSON.stringify({ status: state.status, adopted, imported: state.importedPlayerIds.length, completed: state.completedPlayerIds.length }, null, 2));
}

function activityProfileFor(state, playerId) {
  const existing = state.playerActivity[playerId];
  if (existing) return existing;

  const random = seededRandom(`${state.batchLabel}:activity-profile:${playerId}`);
  const paretoPower = Math.min(30, Math.pow(Math.max(0.000001, 1 - random()), -1 / 1.35));
  const tier = paretoPower < 1.6
    ? "dormant"
    : paretoPower < 3.2
      ? "casual"
      : paretoPower < 8
        ? "regular"
        : "power";
  const initialDelayHours = {
    dormant: [36, 96],
    casual: [8, 30],
    regular: [2, 12],
    power: [0.75, 4]
  }[tier];
  const importedAt = new Date(state.playerMeta[playerId]?.asOf ?? state.startedAt).getTime();
  const delayHours = initialDelayHours[0] + random() * (initialDelayHours[1] - initialDelayHours[0]);

  return {
    tier,
    power: Number(paretoPower.toFixed(4)),
    skill: Number((0.42 + random() * 0.28).toFixed(4)),
    sequence: 0,
    lastActiveAt: null,
    nextEligibleAt: new Date(importedAt + delayHours * 60 * 60 * 1000).toISOString()
  };
}

function chooseActivityPlayers(state, requested, now) {
  if (requested <= 0) return [];
  const completed = new Set(state.completedPlayerIds);
  const candidates = state.importedPlayerIds
    .filter((playerId) => completed.has(playerId))
    .map((playerId) => ({ playerId, profile: activityProfileFor(state, playerId) }))
    .filter(({ profile }) => new Date(profile.nextEligibleAt).getTime() <= now.getTime());
  const selected = [];

  while (selected.length < requested && candidates.length > 0) {
    const totalWeight = candidates.reduce((sum, item) => sum + Math.max(0.05, item.profile.power), 0);
    let cursor = (crypto.randomInt(0, 1_000_000) / 1_000_000) * totalWeight;
    let selectedIndex = candidates.length - 1;
    for (let index = 0; index < candidates.length; index += 1) {
      cursor -= Math.max(0.05, candidates[index].profile.power);
      if (cursor <= 0) {
        selectedIndex = index;
        break;
      }
    }
    selected.push(candidates[selectedIndex]);
    candidates.splice(selectedIndex, 1);
  }

  return selected;
}

function nextActivityTime(profile, random, now) {
  const cooldownHours = {
    dormant: [48, 120],
    casual: [12, 48],
    regular: [3, 18],
    power: [0.75, 8]
  }[profile.tier];
  const hours = cooldownHours[0] + random() * (cooldownHours[1] - cooldownHours[0]);
  return new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
}

async function resolveActivitySequences(selected, state) {
  const resolved = selected.map((item) => ({ ...item, sequence: item.profile.sequence + 1 }));
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const sessionIdByPlayer = new Map(
      resolved.map((item) => [
        item.playerId,
        deterministicUuid(`${state.batchLabel}:growth-session:${item.playerId}:${item.sequence}`)
      ])
    );
    const { data, error } = await supabase
      .from("player_game_sessions")
      .select("id")
      .in("id", [...sessionIdByPlayer.values()]);
    if (error) throw new Error(error.message);
    const existingIds = new Set((data ?? []).map((row) => row.id));
    if (existingIds.size === 0) return resolved;
    for (const item of resolved) {
      if (existingIds.has(sessionIdByPlayer.get(item.playerId))) item.sequence += 1;
    }
  }
  throw new Error("Unable to reserve a unique activity sequence.");
}

async function loadActivityContext(playerIds) {
  const [categoriesResponse, levelsResponse, questionsResponse, leaderboardResponse, adConfigResponse, progressResponse] =
    await Promise.all([
      supabase.from("categories").select("id,title,is_active,sort_order").eq("is_active", true).order("sort_order"),
      supabase
        .from("category_levels")
        .select("id,category_id,level_number,difficulty,question_count,points_per_correct,is_active")
        .eq("is_active", true)
        .order("category_id")
        .order("level_number"),
      supabase.from("questions").select("id,level_id,is_active,sort_order").eq("is_active", true).order("level_id").order("sort_order"),
      supabase.from("leaderboard").select("player_id,total_score,global_rank").order("global_rank").limit(20),
      supabase.from("game_config").select("value").eq("key", "youtube_ad_config").maybeSingle(),
      supabase
        .from("player_progress")
        .select("id,player_id,category_id,current_level,current_question_index,score,levels_completed,last_played_at")
        .in("player_id", playerIds)
    ]);

  for (const response of [categoriesResponse, levelsResponse, questionsResponse, leaderboardResponse, adConfigResponse, progressResponse]) {
    if (response.error) throw new Error(response.error.message);
  }

  const rank20 = (leaderboardResponse.data ?? []).find((row) => row.global_rank === 20);
  const minimumPositivePoints = Math.min(
    ...(levelsResponse.data ?? []).map((level) => Math.max(1, level.points_per_correct))
  );
  return {
    categories: categoriesResponse.data ?? [],
    levels: levelsResponse.data ?? [],
    questions: questionsResponse.data ?? [],
    progress: progressResponse.data ?? [],
    ads: normalizeAdConfig(adConfigResponse.data?.value),
    scoreCeiling: Math.max(0, (rank20?.total_score ?? 370) - minimumPositivePoints)
  };
}

async function runActivityGrowth(state) {
  validateState(state);
  const now = new Date();
  if (now.getTime() >= new Date(state.deadline).getTime()) {
    return { selected: 0, sessions: 0, scoreEvents: 0, progress: 0, analytics: 0, adViews: 0 };
  }

  const selected = chooseActivityPlayers(state, chooseActivityBatchSize(state, now.getTime()), now);
  if (selected.length === 0) {
    return { selected: 0, sessions: 0, scoreEvents: 0, progress: 0, analytics: 0, adViews: 0 };
  }

  const sequencedPlayers = await resolveActivitySequences(selected, state);

  const context = await loadActivityContext(sequencedPlayers.map((item) => item.playerId));
  const levelsByCategory = new Map();
  for (const level of context.levels) {
    const items = levelsByCategory.get(level.category_id) ?? [];
    items.push(level);
    levelsByCategory.set(level.category_id, items);
  }
  const questionsByLevel = new Map();
  for (const question of context.questions) {
    const items = questionsByLevel.get(question.level_id) ?? [];
    items.push(question);
    questionsByLevel.set(question.level_id, items);
  }
  const playableCategories = context.categories.filter((category) =>
    (levelsByCategory.get(category.id) ?? []).some((level) => (questionsByLevel.get(level.id) ?? []).length > 0)
  );
  const progressByPlayer = new Map();
  for (const progress of context.progress) {
    const items = progressByPlayer.get(progress.player_id) ?? [];
    items.push(progress);
    progressByPlayer.set(progress.player_id, items);
  }

  const sessions = [];
  const scoreEvents = [];
  const progressRows = [];
  const analyticsRows = [];
  const adViews = [];
  const nextProfiles = new Map();

  function addAnalytics(playerId, sequence, eventType, suffix, label, routePath, count, seenAt) {
    const activityEventKey = deterministicUuid(
      `${state.batchLabel}:growth-analytics-key:${playerId}:${sequence}:${eventType}:${suffix}`
    );
    analyticsRows.push({
      id: deterministicUuid(`${state.batchLabel}:growth-analytics:${playerId}:${sequence}:${eventType}:${suffix}`),
      event_date: seenAt.slice(0, 10),
      event_type: eventType,
      event_key: `growth:${activityEventKey}:${suffix}`.slice(0, 120),
      label: label.slice(0, 120),
      path: routePath.slice(0, 160),
      count,
      last_seen_at: seenAt
    });
  }

  for (const { playerId, profile, sequence } of sequencedPlayers) {
    const random = seededRandom(`${state.batchLabel}:activity:${playerId}:${sequence}`);
    const existingProgress = progressByPlayer.get(playerId) ?? [];
    const categoryPool = existingProgress.length > 0 && random() < 0.84
      ? playableCategories.filter((category) => existingProgress.some((item) => item.category_id === category.id))
      : playableCategories;
    const orderedCategories = [...categoryPool].sort((left, right) =>
      sha256(`${playerId}:${sequence}:${left.id}`).localeCompare(sha256(`${playerId}:${sequence}:${right.id}`))
    );
    const category = orderedCategories[0];
    if (!category) continue;

    const categoryProgress = existingProgress.find((item) => item.category_id === category.id);
    const availableLevels = levelsByCategory.get(category.id) ?? [];
    let levelIndex = Math.max(
      0,
      availableLevels.findIndex((level) => level.level_number === (categoryProgress?.current_level ?? 1))
    );
    if ((questionsByLevel.get(availableLevels[levelIndex]?.id) ?? []).length === 0) {
      const playableIndex = availableLevels.findIndex((level) => (questionsByLevel.get(level.id) ?? []).length > 0);
      levelIndex = Math.max(0, playableIndex);
    }
    const level = availableLevels[levelIndex];
    const questions = questionsByLevel.get(level?.id) ?? [];
    if (!level || questions.length === 0) continue;

    let currentQuestionIndex = clamp(categoryProgress?.current_question_index ?? 0, 0, questions.length);
    if (currentQuestionIndex >= questions.length && levelIndex < availableLevels.length - 1) {
      levelIndex += 1;
      currentQuestionIndex = 0;
    }
    const activeLevel = availableLevels[levelIndex];
    const activeQuestions = questionsByLevel.get(activeLevel.id) ?? [];
    const startedAt = new Date(now.getTime() - randomInteger(random, 20, 260) * 1000);
    const activityKey = `${playerId}:${sequence}`;
    sessions.push({
      id: deterministicUuid(`${state.batchLabel}:growth-session:${activityKey}`),
      player_id: playerId,
      category_id: category.id,
      level_id: activeLevel.id,
      started_at: startedAt.toISOString()
    });
    addAnalytics(playerId, sequence, "game_played", `${category.id}:${activeLevel.id}`, `${category.title} L${activeLevel.level_number}`, `/category/${category.id}/play`, 1, startedAt.toISOString());
    addAnalytics(playerId, sequence, "button_tap", "button:play", "Play", `/category/${category.id}`, 1, startedAt.toISOString());

    const limits = { dormant: 1, casual: 2, regular: 4, power: 5 };
    const abandonChance = { dormant: 0.24, casual: 0.15, regular: 0.08, power: 0.04 }[profile.tier];
    const remainingQuestions = Math.max(0, activeQuestions.length - currentQuestionIndex);
    const answerLimit = Math.min(remainingQuestions, limits[profile.tier]);
    const answeredCount = random() < abandonChance || answerLimit === 0
      ? 0
      : randomInteger(random, 1, answerLimit);
    const totalScore = existingProgress.reduce((sum, item) => sum + Math.max(0, item.score), 0);
    let awardedTotal = 0;
    const skill = clamp(profile.skill + Math.log2(Math.max(1, profile.power)) * 0.045, 0.38, 0.86);

    for (let offset = 0; offset < answeredCount; offset += 1) {
      const questionIndex = currentQuestionIndex + offset;
      const question = activeQuestions[questionIndex];
      if (!question) continue;
      const difficultyAdjustment = activeLevel.difficulty === "easy" ? 0.07 : activeLevel.difficulty === "hard" ? -0.09 : 0;
      let isCorrect = random() < clamp(skill + difficultyAdjustment, 0.32, 0.9);
      const points = Math.max(0, activeLevel.points_per_correct);
      if (isCorrect && totalScore + awardedTotal + points > context.scoreCeiling) isCorrect = false;
      const awarded = isCorrect ? points : 0;
      awardedTotal += awarded;
      const answeredAt = new Date(startedAt.getTime() + (offset + 1) * randomInteger(random, 18, 55) * 1000);
      scoreEvents.push({
        id: deterministicUuid(`${state.batchLabel}:growth-score:${activityKey}:${question.id}`),
        player_id: playerId,
        category_id: category.id,
        level_id: activeLevel.id,
        question_id: question.id,
        is_correct: isCorrect,
        points: awarded,
        answered_at: answeredAt.toISOString()
      });
      addAnalytics(playerId, sequence, "button_tap", `button:answer:${offset}`, "Answer option", `/category/${category.id}/play`, 1, answeredAt.toISOString());
    }

    const nextQuestionIndex = currentQuestionIndex + answeredCount;
    const completed = activeQuestions.length > 0 && nextQuestionIndex >= activeQuestions.length;
    const nextLevel = completed ? availableLevels[levelIndex + 1] : null;
    const lastPlayedAt = new Date(
      startedAt.getTime() + Math.max(1, answeredCount) * randomInteger(random, 22, 58) * 1000
    ).toISOString();
    progressRows.push({
      id: categoryProgress?.id ?? deterministicUuid(`${state.batchLabel}:progress:${playerId}:${category.id}`),
      player_id: playerId,
      category_id: category.id,
      current_level: nextLevel?.level_number ?? activeLevel.level_number,
      current_question_index: completed ? (nextLevel ? 0 : activeQuestions.length) : nextQuestionIndex,
      score: Math.max(0, categoryProgress?.score ?? 0) + awardedTotal,
      levels_completed: Math.max(0, categoryProgress?.levels_completed ?? 0) + (completed ? 1 : 0),
      last_played_at: lastPlayedAt
    });

    if (completed) {
      addAnalytics(playerId, sequence, "level_completed", `${category.id}:${activeLevel.id}`, `${category.title} L${activeLevel.level_number}`, `/category/${category.id}/play`, 1, lastPlayedAt);
      const adChance = clamp(0.24 + Math.log2(Math.max(1, profile.power)) * 0.08, 0.24, 0.58);
      if (context.ads.length > 0 && random() < adChance) {
        const ad = randomItem(random, context.ads);
        const adStarted = new Date(new Date(lastPlayedAt).getTime() + randomInteger(random, 5, 35) * 1000);
        const adCompleted = random() < clamp(0.68 + skill * 0.2, 0.72, 0.9);
        adViews.push({
          id: deterministicUuid(`${state.batchLabel}:growth-ad:${activityKey}`),
          player_id: playerId,
          video_id: getVideoId(ad.url),
          video_url: ad.url,
          started_at: adStarted.toISOString(),
          completed_at: adCompleted ? new Date(adStarted.getTime() + ad.durationSeconds * 1000).toISOString() : null,
          watched_seconds: adCompleted ? ad.durationSeconds : randomInteger(random, 1, Math.max(1, ad.durationSeconds - 1))
        });
      }
    }

    nextProfiles.set(playerId, {
      ...profile,
      sequence,
      lastActiveAt: startedAt.toISOString(),
      nextEligibleAt: nextActivityTime(profile, random, now)
    });
  }

  await insertRows("player_game_sessions", sessions);
  await insertRows("score_events", scoreEvents);
  await upsertRows("player_progress", progressRows, "player_id,category_id");
  await insertRows("youtube_ad_views", adViews);
  await insertRows("analytics_daily", analyticsRows);

  for (const [playerId, profile] of nextProfiles) state.playerActivity[playerId] = profile;
  state.activityTotals.sessions += sessions.length;
  state.activityTotals.scoreEvents += scoreEvents.length;
  state.activityTotals.progressUpdates += progressRows.length;
  state.activityTotals.analytics += analyticsRows.length;
  state.activityTotals.adViews += adViews.length;
  state.totals.sessions += sessions.length;
  state.totals.scoreEvents += scoreEvents.length;
  state.totals.progress += progressRows.length;
  state.totals.analytics += analyticsRows.length;
  state.totals.adViews += adViews.length;
  writeState(state);

  const { data: leaderboardRows, error: leaderboardError } = await supabase
    .from("leaderboard")
    .select("player_id,total_score,global_rank")
    .in("player_id", [...nextProfiles.keys()]);
  if (leaderboardError) throw new Error(leaderboardError.message);
  if ((leaderboardRows ?? []).some((row) => row.global_rank <= 20 || row.total_score > context.scoreCeiling)) {
    throw new Error("Activity integrity check failed: an imported player exceeded the leaderboard ceiling.");
  }

  return {
    selected: nextProfiles.size,
    sessions: sessions.length,
    scoreEvents: scoreEvents.length,
    progress: progressRows.length,
    analytics: analyticsRows.length,
    adViews: adViews.length,
    scoreCeiling: context.scoreCeiling
  };
}

function nextWorkerDelay(state) {
  const remaining = Math.max(0, state.targetTotal - state.importedPlayerIds.length);
  const millisecondsRemaining = new Date(state.deadline).getTime() - Date.now();
  if (remaining <= 0) return 0;
  if (millisecondsRemaining <= 0) return 30_000;
  const expectedBatchSize = 2.08;
  const remainingRuns = Math.max(1, remaining / expectedBatchSize);
  const baseDelay = millisecondsRemaining / remainingRuns;
  const jitter = 0.72 + crypto.randomInt(0, 57) / 100;
  return clamp(Math.round(baseDelay * jitter), 30_000, 15 * 60_000);
}

function ensurePacingBaselines(state) {
  let updated = false;
  if (!state.pacing) {
    state.pacing = {
      startedAt: new Date().toISOString(),
      importedAtStart: state.importedPlayerIds.length
    };
    updated = true;
  }
  if (!state.activityRampStartedAt) {
    state.activityRampStartedAt = new Date().toISOString();
    updated = true;
  }
  if (updated) writeState(state);
}

async function runWorker() {
  let state = readState();
  if (!state) throw new Error("Run the initial import before starting the gradual worker.");
  validateState(state);
  ensurePacingBaselines(state);
  state.workerPid = process.pid;
  state.status = "running";
  writeState(state);

  while (state.importedPlayerIds.length < state.targetTotal) {
    const delay = nextWorkerDelay(state);
    console.log(`Next gradual import in ${Math.round(delay / 1000)} seconds.`);
    await sleep(delay);
    const remaining = state.targetTotal - state.importedPlayerIds.length;
    const batchSize = chooseGradualBatch(remaining, state);
    if (batchSize === 0) {
      console.log(`[${new Date().toISOString()}] No arrivals during this interval.`);
      continue;
    }
    try {
      state = await runImport(batchSize, "gradual", { dryRun: false, skipTelegram: false });
      state.workerPid = process.pid;
      writeState(state);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
      await sleep(5 * 60_000);
      state = readState() ?? state;
    }
  }

  state.status = "complete";
  state.workerPid = null;
  writeState(state);
  console.log("Chewata player import complete.");
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function startDetachedWorker(state) {
  fs.mkdirSync(path.dirname(DEFAULT_LOG_PATH), { recursive: true });
  const log = fs.openSync(DEFAULT_LOG_PATH, "a");
  const child = spawn(process.execPath, [SCRIPT_PATH, "worker", "--csv", options.csvPath, "--state", options.statePath, "--batch-label", state.batchLabel], {
    cwd: PROJECT_ROOT,
    detached: true,
    windowsHide: true,
    stdio: ["ignore", log, log],
    env: process.env
  });
  child.unref();
  fs.closeSync(log);
  state.workerPid = child.pid;
  state.status = "running";
  writeState(state);
  return child.pid;
}

async function watchdog() {
  const state = readState();
  if (!state) throw new Error("Import state does not exist. Run the initial import first.");
  validateState(state);

  if (state.importedPlayerIds.length >= state.targetTotal) {
    state.status = "complete";
    state.workerPid = null;
    writeState(state);
    console.log(JSON.stringify({ status: "complete", imported: state.importedPlayerIds.length, target: state.targetTotal }, null, 2));
    return;
  }

  if (processIsAlive(state.workerPid)) {
    console.log(JSON.stringify({ status: "healthy", workerPid: state.workerPid, imported: state.importedPlayerIds.length, target: state.targetTotal }, null, 2));
    return;
  }

  const workerPid = startDetachedWorker(state);
  console.log(JSON.stringify({ status: "restarted", workerPid, imported: state.importedPlayerIds.length, target: state.targetTotal }, null, 2));
}

async function status() {
  const state = readState();
  if (!state) {
    console.log(JSON.stringify({ status: "not-started" }, null, 2));
    return;
  }
  validateState(state);
  const context = await loadDatabaseContext();
  const imported = new Set(state.importedPlayerIds);
  const present = context.players.filter((player) => imported.has(player.id));
  const importedTop20 = [...context.top20PlayerIds].filter((id) => imported.has(id));
  console.log(JSON.stringify({
    status: state.status,
    importedRecorded: state.importedPlayerIds.length,
    importedPresent: present.length,
    completedHistories: state.completedPlayerIds.length,
    target: state.targetTotal,
    remaining: Math.max(0, state.targetTotal - state.importedPlayerIds.length),
    projectedServerPlayers: state.protectedPlayerIds.length + state.targetTotal,
    deadline: state.deadline,
    workerPid: state.workerPid,
    workerAlive: processIsAlive(state.workerPid),
    importedInTop20: importedTop20.length,
    totals: state.totals,
    activityTotals: state.activityTotals
  }, null, 2));
}

function configureSchedule() {
  const state = readState();
  if (!state) throw new Error("Import state does not exist. Run the initial import first.");
  validateState(state);
  if (options.target < state.importedPlayerIds.length) {
    throw new Error(`Target ${options.target} is below the ${state.importedPlayerIds.length} players already imported.`);
  }
  const deadline = new Date(options.deadline);
  if (!Number.isFinite(deadline.getTime())) throw new Error("--deadline must be a valid date.");
  state.targetTotal = options.target;
  state.deadline = deadline.toISOString();
  state.workerPid = null;
  state.status = state.importedPlayerIds.length >= state.targetTotal && Date.now() >= deadline.getTime()
    ? "complete"
    : "scheduled";
  writeState(state);
  console.log(JSON.stringify({
    status: state.status,
    imported: state.importedPlayerIds.length,
    target: state.targetTotal,
    projectedServerPlayers: state.protectedPlayerIds.length + state.targetTotal,
    deadline: state.deadline
  }, null, 2));
}

async function main() {
  if (!Number.isInteger(options.target) || options.target <= 0) throw new Error("--target must be a positive integer.");
  if (!Number.isInteger(options.limit) || options.limit <= 0) throw new Error("--limit must be a positive integer.");

  if (options.command === "dry-run") {
    await runImport(options.limit, "initial", { dryRun: true, skipTelegram: options.skipTelegram });
  } else if (options.command === "initial") {
    await runImport(options.limit, "initial", { dryRun: false, skipTelegram: false });
  } else if (options.command === "tick") {
    const state = readState();
    if (!state) throw new Error("Run the initial import first.");
    validateState(state);
    ensurePacingBaselines(state);
    const batchSize = chooseGradualBatch(state.targetTotal - state.importedPlayerIds.length, state);
    let updated = state;
    if (batchSize > 0) {
      updated = await runImport(batchSize, "gradual", {
        dryRun: false,
        skipTelegram: false
      });
    } else {
      console.log(JSON.stringify({ status: state.status, imported: state.importedPlayerIds.length, added: 0 }, null, 2));
    }
    const activity = await runActivityGrowth(updated);
    updated.workerPid = null;
    const importsComplete = updated.importedPlayerIds.length >= updated.targetTotal;
    const activityWindowComplete = Date.now() >= new Date(updated.deadline).getTime();
    updated.status = importsComplete && activityWindowComplete ? "complete" : "scheduled";
    writeState(updated);
    console.log(JSON.stringify({
      status: updated.status,
      imported: updated.importedPlayerIds.length,
      target: updated.targetTotal,
      activity
    }, null, 2));
  } else if (options.command === "worker") {
    await runWorker();
  } else if (options.command === "watchdog") {
    await watchdog();
  } else if (options.command === "status") {
    await status();
  } else if (options.command === "reconcile") {
    await reconcileState();
  } else if (options.command === "configure") {
    configureSchedule();
  } else {
    throw new Error(`Unknown command: ${options.command}`);
  }
}

function acquireMutationLock() {
  const lockPath = `${options.statePath}.lock`;
  try {
    const descriptor = fs.openSync(lockPath, "wx");
    fs.writeFileSync(descriptor, `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`, "utf8");
    return () => {
      fs.closeSync(descriptor);
      try {
        fs.unlinkSync(lockPath);
      } catch {
        // Another recovery path may already have removed a stale lock.
      }
    };
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const age = Date.now() - fs.statSync(lockPath).mtimeMs;
    if (age > 20 * 60_000) {
      fs.unlinkSync(lockPath);
      return acquireMutationLock();
    }
    console.log(JSON.stringify({ status: "busy", message: "Another importer tick is already running." }, null, 2));
    return null;
  }
}

async function runMain() {
  const needsLock = ["initial", "tick", "watchdog", "reconcile", "configure"].includes(options.command);
  const releaseLock = needsLock ? acquireMutationLock() : () => {};
  if (!releaseLock) return;
  try {
    await main();
  } finally {
    releaseLock();
  }
}

runMain().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
