import type {
  Category,
  CategoryLevel,
  GameConfig,
  GameContent,
  LeaderboardRow,
  Message,
  Player,
  PlayerProgress,
  Question,
  RewardProfile,
  ScoreEvent
} from "@/lib/types";
import type { Database } from "@/lib/supabase/types";
import { defaultDifficultyForLevel } from "@/lib/difficulty";
import { normalizeQuestionTranslations } from "@/lib/i18n";
import { normalizeYouTubeAds, normalizeYouTubeAdTargetLevels, normalizeYouTubeAdUrls } from "@/lib/youtube-ad";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type LevelRow = Database["public"]["Tables"]["category_levels"]["Row"];
type QuestionRow = Database["public"]["Tables"]["questions"]["Row"];
type PlayerRow = Database["public"]["Tables"]["players"]["Row"];
type RewardProfileRow = Database["public"]["Tables"]["reward_profiles"]["Row"];
type PlayerProgressRow = Database["public"]["Tables"]["player_progress"]["Row"];
type ScoreEventRow = Database["public"]["Tables"]["score_events"]["Row"];
type GameConfigRow = Database["public"]["Tables"]["game_config"]["Row"];
type LeaderboardRowDb = Database["public"]["Views"]["leaderboard"]["Row"];

function cleanOptionalUrl(value?: string | null) {
  return value?.trim() || null;
}

function legacyTelegramPhotoUrl(row: PlayerRow) {
  const value = (row as { telegram_photo_url?: unknown }).telegram_photo_url;
  return typeof value === "string" ? cleanOptionalUrl(value) : null;
}

const defaultConfig: GameConfig = {
  maxStreakBonus: {
    multiplier: 2,
    triggerAt: 3
  },
  defaultTimeLimitSeconds: 30,
  leaderboardDisplayCount: 100,
  youtubeAd: {
    enabled: false,
    url: "",
    urls: [],
    ads: [],
    durationSeconds: 15,
    aspectRatio: "normal",
    levelInterval: 2,
    selectionMode: "rotate",
    triggerMode: "interval",
    targetLevels: []
  }
};

export function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    title: row.title,
    iconUrl: row.icon_url,
    difficulty: row.difficulty,
    isRewardBased: row.is_reward_based,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    colorHex: row.color_hex,
    description: row.description,
    cardBackgroundUrl: row.card_background_url ?? "",
    mapBackgroundUrl: row.map_background_url,
    levelPodiumUrl: row.level_podium_url,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? ""
  };
}

export function mapLevel(row: LevelRow): CategoryLevel {
  return {
    id: row.id,
    categoryId: row.category_id,
    levelNumber: row.level_number,
    title: row.title,
    difficulty: row.difficulty ?? defaultDifficultyForLevel(row.level_number),
    questionCount: row.question_count,
    timeLimitSeconds: row.time_limit_seconds,
    pointsPerCorrect: row.points_per_correct,
    isActive: row.is_active,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? ""
  };
}

export function mapQuestion(row: QuestionRow): Question {
  return {
    id: row.id,
    levelId: row.level_id,
    questionText: row.question_text,
    optionA: row.option_a,
    optionB: row.option_b,
    optionC: row.option_c,
    optionD: row.option_d,
    correctOption: row.correct_option,
    explanation: row.explanation ?? "",
    translations: normalizeQuestionTranslations(row.translations),
    mediaUrl: row.media_url ?? "",
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? ""
  };
}

export function mapPlayer(row: PlayerRow): Player {
  const avatarUrl = cleanOptionalUrl(row.avatar_url) ?? legacyTelegramPhotoUrl(row);

  return {
    id: row.id,
    name: row.name,
    age: row.age,
    avatarUrl: avatarUrl ?? undefined,
    telegramId: row.telegram_id ?? undefined,
    telegramUsername: row.telegram_username ?? undefined,
    telegramPhone: row.telegram_phone ?? undefined,
    source: row.source === "telegram" ? "telegram" : "web",
    createdAt: row.created_at ?? ""
  };
}

export function mapRewardProfile(row: RewardProfileRow): RewardProfile {
  return {
    id: row.id,
    playerId: row.player_id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    telegramUsername: row.telegram_username,
    createdAt: row.created_at ?? ""
  };
}

export function mapPlayerProgress(row: PlayerProgressRow): PlayerProgress {
  return {
    id: row.id,
    playerId: row.player_id,
    categoryId: row.category_id,
    currentLevel: row.current_level,
    currentQuestionIndex: row.current_question_index,
    score: row.score,
    levelsCompleted: row.levels_completed,
    lastPlayedAt: row.last_played_at ?? ""
  };
}

export function mapScoreEvent(row: ScoreEventRow): ScoreEvent {
  return {
    id: row.id,
    playerId: row.player_id,
    categoryId: row.category_id,
    levelId: row.level_id,
    questionId: row.question_id ?? null,
    isCorrect: row.is_correct,
    points: row.points,
    answeredAt: row.answered_at ?? ""
  };
}

export function mapMessage(row: {
  id: string;
  player_id: string;
  text: string;
  posted_at: string | null;
  reply_to_message_id?: string | null;
  players?: { name?: string | null; avatar_url?: string | null } | Array<{ name?: string | null; avatar_url?: string | null }> | null;
}): Message {
  const playerRelation = Array.isArray(row.players) ? row.players[0] : row.players;

  return {
    id: row.id,
    playerId: row.player_id,
    playerName: playerRelation?.name?.trim() || "Player",
    avatarUrl: playerRelation?.avatar_url?.trim() || undefined,
    text: row.text,
    postedAt: row.posted_at ?? "",
    replyToMessageId: row.reply_to_message_id ?? undefined
  };
}

export function mapConfig(rows: GameConfigRow[] | null | undefined): GameConfig {
  const byKey = new Map((rows ?? []).map((row) => [row.key, row.value]));
  const maxStreakBonus = byKey.get("max_streak_bonus");
  const defaultTimeLimitSeconds = byKey.get("default_time_limit_seconds");
  const leaderboardDisplayCount = byKey.get("leaderboard_display_count");
  const youtubeAd = byKey.get("youtube_ad_config");
  const mappedYoutubeAd =
    typeof youtubeAd === "object" && youtubeAd !== null && !Array.isArray(youtubeAd)
      ? {
          enabled: typeof youtubeAd.enabled === "boolean" ? youtubeAd.enabled : defaultConfig.youtubeAd.enabled,
          url: typeof youtubeAd.url === "string" ? youtubeAd.url : defaultConfig.youtubeAd.url,
          urls: normalizeYouTubeAdUrls(youtubeAd.urls, youtubeAd.url),
          ads: normalizeYouTubeAds(
            youtubeAd.ads,
            youtubeAd.urls,
            youtubeAd.url,
            typeof youtubeAd.duration_seconds === "number"
              ? youtubeAd.duration_seconds
              : defaultConfig.youtubeAd.durationSeconds
          ),
          durationSeconds:
            typeof youtubeAd.duration_seconds === "number"
              ? youtubeAd.duration_seconds
              : defaultConfig.youtubeAd.durationSeconds,
          aspectRatio:
            youtubeAd.aspect_ratio === "vertical" || youtubeAd.aspect_ratio === "normal"
              ? youtubeAd.aspect_ratio
              : defaultConfig.youtubeAd.aspectRatio,
          levelInterval:
            typeof youtubeAd.level_interval === "number"
              ? youtubeAd.level_interval
              : defaultConfig.youtubeAd.levelInterval,
          selectionMode: youtubeAd.selection_mode === "shuffle" ? "shuffle" : defaultConfig.youtubeAd.selectionMode,
          triggerMode: youtubeAd.trigger_mode === "levels" ? "levels" : defaultConfig.youtubeAd.triggerMode,
          targetLevels: normalizeYouTubeAdTargetLevels(youtubeAd.target_levels)
        }
      : defaultConfig.youtubeAd;
  const youtubeAdUrls = normalizeYouTubeAdUrls(mappedYoutubeAd.urls, mappedYoutubeAd.url);
  const youtubeAds = normalizeYouTubeAds(
    mappedYoutubeAd.ads,
    youtubeAdUrls,
    mappedYoutubeAd.url,
    mappedYoutubeAd.durationSeconds
  );

  return {
    maxStreakBonus:
      typeof maxStreakBonus === "object" &&
      maxStreakBonus !== null &&
      !Array.isArray(maxStreakBonus) &&
      typeof maxStreakBonus.multiplier === "number" &&
      typeof maxStreakBonus.trigger_at === "number"
        ? {
            multiplier: maxStreakBonus.multiplier,
            triggerAt: maxStreakBonus.trigger_at
          }
        : defaultConfig.maxStreakBonus,
    defaultTimeLimitSeconds:
      typeof defaultTimeLimitSeconds === "number" ? defaultTimeLimitSeconds : defaultConfig.defaultTimeLimitSeconds,
    leaderboardDisplayCount:
      typeof leaderboardDisplayCount === "number" ? leaderboardDisplayCount : defaultConfig.leaderboardDisplayCount,
    youtubeAd: {
      enabled: mappedYoutubeAd.enabled,
      url: youtubeAds[0]?.url ?? youtubeAdUrls[0] ?? "",
      urls: youtubeAds.map((ad) => ad.url),
      ads: youtubeAds,
      durationSeconds:
        youtubeAds[0]?.durationSeconds ?? Math.max(3, Math.min(180, Math.round(mappedYoutubeAd.durationSeconds))),
      aspectRatio: mappedYoutubeAd.aspectRatio,
      levelInterval: Math.max(1, Math.min(50, Math.round(mappedYoutubeAd.levelInterval))),
      selectionMode: mappedYoutubeAd.selectionMode,
      triggerMode: mappedYoutubeAd.triggerMode,
      targetLevels: normalizeYouTubeAdTargetLevels(mappedYoutubeAd.targetLevels)
    }
  };
}

export function mapLeaderboardRow(row: LeaderboardRowDb): LeaderboardRow {
  return {
    playerId: row.player_id,
    name: row.name,
    avatarUrl: row.avatar_url ?? undefined,
    totalScore: row.total_score,
    categoriesPlayed: row.categories_played,
    globalRank: row.global_rank,
    completionPercent: row.completion_percent ?? 0,
    questionsAnswered: row.questions_answered ?? 0,
    totalQuestions: row.total_questions ?? 0,
    currentLevelReached: row.current_level_reached ?? 1,
    isVerified: row.is_verified ?? false
  };
}

export function buildGameContent(content: Pick<GameContent, "categories" | "levels" | "questions" | "messages" | "config">): GameContent {
  return {
    categories: content.categories,
    levels: content.levels,
    questions: content.questions,
    messages: content.messages,
    rewards: [],
    config: content.config
  };
}
