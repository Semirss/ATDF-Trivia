import {
  buildGameContent,
  mapCategory,
  mapConfig,
  mapLeaderboardRow,
  mapLevel,
  mapMessage,
  mapPlayer,
  mapPlayerProgress,
  mapQuestion,
  mapRewardProfile,
  mapScoreEvent
} from "@/lib/data-mappers";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { getConfiguredSupabaseVideoUrls, getVideoAdId } from "@/lib/video-ad-url";
import type {
  AdminAnalyticsRow,
  AdminAnalyticsSummary,
  AdminAdVideoAnalytics,
  AdminActivityPoint,
  AdminPlayerDetail,
  AdminOverview,
  AdminPlayerSummary,
  GameContent,
  LeaderboardRow,
  Message,
  PlayerSnapshot
} from "@/lib/types";

async function requireSupabase() {
  const supabase = await createServiceSupabaseClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase;
}

const postgrestPageSize = 1000;

async function fetchAllPages<T>(fetchPage: (from: number, to: number) => PromiseLike<any>): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += postgrestPageSize) {
    const result = await fetchPage(from, from + postgrestPageSize - 1);

    if (result.error) {
      throw new Error(result.error.message);
    }

    const page = (result.data ?? []) as T[];
    rows.push(...page);

    if (page.length < postgrestPageSize) {
      break;
    }
  }

  return rows;
}

type RawAuthoritativeScoreEvent = {
  id: string;
  player_id: string;
  category_id: string;
  level_id: string;
  question_id: string | null;
  points: number;
  answered_at: string | null;
};

type RawPlayerSession = {
  id: string;
  player_id: string;
  category_id: string;
  level_id: string;
  started_at: string | null;
};

function isMissingPlayerSessionsTable(error: { code?: string; message?: string } | null) {
  if (!error) {
    return false;
  }

  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    Boolean(error.message?.includes("player_game_sessions") && error.message.toLowerCase().includes("not"))
  );
}

async function fetchPlayerSessions(
  supabase: Awaited<ReturnType<typeof requireSupabase>>,
  playerId?: string
): Promise<RawPlayerSession[]> {
  try {
    return await fetchAllPages<RawPlayerSession>((from, to) => {
      let query = supabase
        .from("player_game_sessions")
        .select("id, player_id, category_id, level_id, started_at")
        .order("started_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to);

      if (playerId) query = query.eq("player_id", playerId);
      return query;
    });
  } catch (error) {
    const sessionError = error instanceof Error ? { message: error.message } : null;
    if (!isMissingPlayerSessionsTable(sessionError)) throw error;
  }

  // Keeps the admin usable before migration 017 is applied. Historical score data
  // can establish at least one session per player/level, but not repeated attempts.
  const scoreRows = await fetchAllPages<{
    player_id: string;
    category_id: string;
    level_id: string;
    answered_at: string | null;
  }>((from, to) => {
    let query = supabase
      .from("score_events")
      .select("id, player_id, category_id, level_id, answered_at")
      .order("answered_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);

    if (playerId) query = query.eq("player_id", playerId);
    return query;
  });

  const sessionsByLevel = new Map<string, RawPlayerSession>();
  for (const row of scoreRows) {
    const key = `${row.player_id}:${row.category_id}:${row.level_id}`;
    const existing = sessionsByLevel.get(key);
    const startedAt = row.answered_at ?? null;

    if (!existing || (startedAt && (!existing.started_at || startedAt < existing.started_at))) {
      sessionsByLevel.set(key, {
        id: key,
        player_id: row.player_id,
        category_id: row.category_id,
        level_id: row.level_id,
        started_at: startedAt
      });
    }
  }

  return Array.from(sessionsByLevel.values());
}

async function fetchAdVideoAnalytics(
  supabase: Awaited<ReturnType<typeof requireSupabase>>
): Promise<AdminAdVideoAnalytics[]> {
  const [statsResult, configResult] = await Promise.all([
    supabase
      .from("youtube_ad_view_stats")
      .select("video_id, video_url, views, completed_views, watched_seconds, last_viewed_at")
      .order("views", { ascending: false }),
    supabase.from("game_config").select("value").eq("key", "youtube_ad_config").maybeSingle()
  ]);

  const { data, error } = statsResult;

  if (error) {
    const missingView =
      error.code === "42P01" ||
      error.code === "PGRST205" ||
      Boolean(error.message?.includes("youtube_ad_view_stats"));
    if (missingView) {
      return [];
    }
    throw new Error(error.message);
  }

  if (configResult.error) {
    throw new Error(configResult.error.message);
  }

  const configuredUrls = getConfiguredSupabaseVideoUrls(configResult.data?.value);
  const configuredSet = new Set(configuredUrls);
  const totalsByUrl = new Map<
    string,
    { views: number; completedViews: number; watchedSeconds: number; lastViewedAt: string | null }
  >();

  for (const row of data ?? []) {
    const videoUrl = row.video_url ?? "";
    if (!configuredSet.has(videoUrl)) {
      continue;
    }

    const existing = totalsByUrl.get(videoUrl) ?? {
      views: 0,
      completedViews: 0,
      watchedSeconds: 0,
      lastViewedAt: null
    };
    const lastViewedAt = row.last_viewed_at ?? null;
    totalsByUrl.set(videoUrl, {
      views: existing.views + (row.views ?? 0),
      completedViews: existing.completedViews + (row.completed_views ?? 0),
      watchedSeconds: existing.watchedSeconds + (row.watched_seconds ?? 0),
      lastViewedAt:
        lastViewedAt && (!existing.lastViewedAt || lastViewedAt > existing.lastViewedAt)
          ? lastViewedAt
          : existing.lastViewedAt
    });
  }

  return configuredUrls
    .map((videoUrl) => {
      const totals = totalsByUrl.get(videoUrl) ?? {
        views: 0,
        completedViews: 0,
        watchedSeconds: 0,
        lastViewedAt: null
      };
      return {
        videoId: getVideoAdId(videoUrl),
        videoUrl,
        views: totals.views,
        completedViews: totals.completedViews,
        completionRate: totals.views > 0 ? Math.round((totals.completedViews / totals.views) * 100) : 0,
        watchedSeconds: totals.watchedSeconds,
        lastViewedAt: totals.lastViewedAt
      };
    })
    .sort((first, second) => second.views - first.views || first.videoId.localeCompare(second.videoId));
}

function rankLeaderboardRows(rows: LeaderboardRow[]) {
  return [...rows]
    .sort(
      (first, second) =>
        second.totalScore - first.totalScore ||
        second.questionsAnswered - first.questionsAnswered ||
        second.currentLevelReached - first.currentLevelReached ||
        first.name.localeCompare(second.name) ||
        first.playerId.localeCompare(second.playerId)
    )
    .map((row, index) => ({ ...row, globalRank: index + 1 }));
}

async function applyAuthoritativeLeaderboardScores(rows: LeaderboardRow[], rerank = true) {
  if (rows.length === 0) {
    return rows;
  }

  const supabase = await requireSupabase();
  const [categoriesResult, levelsResult, questionsResult] = await Promise.all([
    supabase.from("categories").select("id").eq("is_active", true),
    supabase.from("category_levels").select("id, category_id").eq("is_active", true),
    supabase.from("questions").select("id, level_id").eq("is_active", true)
  ]);

  const contentError = categoriesResult.error ?? levelsResult.error ?? questionsResult.error;
  if (contentError) {
    throw new Error(contentError.message);
  }

  const activeCategoryIds = new Set((categoriesResult.data ?? []).map((category) => category.id));
  const activeLevels = new Map(
    (levelsResult.data ?? [])
      .filter((level) => activeCategoryIds.has(level.category_id))
      .map((level) => [level.id, level.category_id])
  );
  const activeQuestions = new Map(
    (questionsResult.data ?? [])
      .filter((question) => activeLevels.has(question.level_id))
      .map((question) => [
        question.id,
        { levelId: question.level_id, categoryId: activeLevels.get(question.level_id) as string }
      ])
  );
  const playerIds = rows.map((row) => row.playerId);
  const playerChunkSize = 100;
  const pageSize = 1000;
  const playerChunks: string[][] = [];

  for (let chunkStart = 0; chunkStart < playerIds.length; chunkStart += playerChunkSize) {
    playerChunks.push(playerIds.slice(chunkStart, chunkStart + playerChunkSize));
  }

  const scoreEventChunks = await Promise.all(
    playerChunks.map(async (playerChunk) => {
      const firstPageResult = await supabase
        .from("score_events")
        .select("id, player_id, category_id, level_id, question_id, points, answered_at", { count: "exact" })
        .in("player_id", playerChunk)
        .order("answered_at", { ascending: false })
        .order("id", { ascending: false })
        .range(0, pageSize - 1);

      if (firstPageResult.error) {
        throw new Error(firstPageResult.error.message);
      }

      const firstPage = (firstPageResult.data ?? []) as RawAuthoritativeScoreEvent[];
      const totalEvents = firstPageResult.count ?? firstPage.length;
      if (totalEvents <= pageSize) {
        return firstPage;
      }

      const remainingPageStarts = Array.from(
        { length: Math.ceil(totalEvents / pageSize) - 1 },
        (_, index) => (index + 1) * pageSize
      );
      const remainingPageResults = await Promise.all(
        remainingPageStarts.map((pageStart) =>
          supabase
            .from("score_events")
            .select("id, player_id, category_id, level_id, question_id, points, answered_at")
            .in("player_id", playerChunk)
            .order("answered_at", { ascending: false })
            .order("id", { ascending: false })
            .range(pageStart, pageStart + pageSize - 1)
        )
      );

      const pageError = remainingPageResults.find((result) => result.error)?.error;
      if (pageError) {
        throw new Error(pageError.message);
      }

      return [
        ...firstPage,
        ...remainingPageResults.flatMap((result) => (result.data ?? []) as RawAuthoritativeScoreEvent[])
      ];
    })
  );
  const scoreEvents = scoreEventChunks.flat();

  const stats = new Map<
    string,
    { totalScore: number; questionsAnswered: number; categoriesPlayed: Set<string>; seenQuestionIds: Set<string> }
  >();

  for (const event of scoreEvents) {
    if (!event.question_id) {
      continue;
    }

    const activeQuestion = activeQuestions.get(event.question_id);
    if (
      !activeQuestion ||
      activeQuestion.levelId !== event.level_id ||
      activeQuestion.categoryId !== event.category_id
    ) {
      continue;
    }

    const playerStats = stats.get(event.player_id) ?? {
      totalScore: 0,
      questionsAnswered: 0,
      categoriesPlayed: new Set<string>(),
      seenQuestionIds: new Set<string>()
    };

    if (playerStats.seenQuestionIds.has(event.question_id)) {
      continue;
    }

    playerStats.seenQuestionIds.add(event.question_id);
    playerStats.questionsAnswered += 1;
    playerStats.totalScore += Math.max(0, event.points);
    playerStats.categoriesPlayed.add(event.category_id);
    stats.set(event.player_id, playerStats);
  }

  const totalQuestions = activeQuestions.size;
  const reconciled = rows.map((row) => {
      const playerStats = stats.get(row.playerId);
      const questionsAnswered = playerStats?.questionsAnswered ?? 0;

      return {
        ...row,
        totalScore: playerStats?.totalScore ?? 0,
        categoriesPlayed: playerStats?.categoriesPlayed.size ?? 0,
        questionsAnswered,
        totalQuestions,
        completionPercent:
          totalQuestions > 0 ? Math.min(100, Math.round((questionsAnswered / totalQuestions) * 100)) : 0
      };
    });

  if (!rerank) {
    return reconciled;
  }

  return rankLeaderboardRows(reconciled);
}

function dayKey(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
}

function buildRecentActivity(): AdminActivityPoint[] {
  const points: AdminActivityPoint[] = [];
  const now = new Date();

  for (let index = 6; index >= 0; index -= 1) {
    const date = new Date(now);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - index);
    points.push({
      date: date.toISOString().slice(0, 10),
      players: 0,
      messages: 0,
      answers: 0
    });
  }

  return points;
}

function buildRecentAnalyticsDays(): AdminAnalyticsSummary["recentDays"] {
  const points: AdminAnalyticsSummary["recentDays"] = [];
  const now = new Date();

  for (let index = 6; index >= 0; index -= 1) {
    const date = new Date(now);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - index);
    points.push({
      date: date.toISOString().slice(0, 10),
      buttonTaps: 0,
      gamesPlayed: 0,
      levelsCompleted: 0
    });
  }

  return points;
}

export async function fetchGameContent(): Promise<GameContent> {
  const supabase = await requireSupabase();
  const [categories, levels, questions, messages, config] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("category_levels").select("*").order("level_number"),
    supabase.from("questions").select("*").order("sort_order"),
    supabase
      .from("messages")
      .select("id, player_id, text, reply_to_message_id, posted_at, players(name, avatar_url)")
      .order("posted_at", { ascending: false })
      .limit(80),
    supabase.from("game_config").select("*")
  ]);

  const error = categories.error ?? levels.error ?? questions.error ?? messages.error ?? config.error;

  if (error) {
    throw new Error(error.message);
  }

  return buildGameContent({
    categories: (categories.data ?? []).map(mapCategory),
    levels: (levels.data ?? []).map(mapLevel),
    questions: (questions.data ?? []).map(mapQuestion),
    messages: ((messages.data ?? []) as Array<{
      id: string;
      player_id: string;
      text: string;
      posted_at: string | null;
      reply_to_message_id?: string | null;
      players?: { name?: string | null; avatar_url?: string | null } | Array<{ name?: string | null; avatar_url?: string | null }> | null;
    }>).map(mapMessage),
    config: mapConfig(config.data)
  });
}

/**
 * The shared game shell only needs categories, levels, questions and config.
 * Chat has its own paginated/realtime endpoint, so keeping that query out of
 * the critical content request lets the first screen render independently.
 */
export async function fetchGameCoreContent(): Promise<GameContent> {
  const supabase = await requireSupabase();
  const [categories, levels, questions, config] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("category_levels").select("*").order("level_number"),
    supabase.from("questions").select("*").order("sort_order"),
    supabase.from("game_config").select("*")
  ]);

  const error = categories.error ?? levels.error ?? questions.error ?? config.error;

  if (error) {
    throw new Error(error.message);
  }

  return buildGameContent({
    categories: (categories.data ?? []).map(mapCategory),
    levels: (levels.data ?? []).map(mapLevel),
    questions: (questions.data ?? []).map(mapQuestion),
    messages: [],
    config: mapConfig(config.data)
  });
}

export async function fetchPlayerSnapshot(playerId: string): Promise<PlayerSnapshot | null> {
  const supabase = await requireSupabase();
  const [player, rewardProfiles, progress, scoreEvents] = await Promise.all([
    supabase.from("players").select("*").eq("id", playerId).maybeSingle(),
    supabase.from("reward_profiles").select("*").eq("player_id", playerId).order("created_at", { ascending: false }),
    supabase.from("player_progress").select("*").eq("player_id", playerId).order("last_played_at", { ascending: false }),
    supabase.from("score_events").select("*").eq("player_id", playerId).order("answered_at", { ascending: false })
  ]);

  const error = player.error ?? rewardProfiles.error ?? progress.error ?? scoreEvents.error;
  if (error) {
    throw new Error(error.message);
  }

  if (!player.data) {
    return null;
  }

  return {
    player: mapPlayer(player.data),
    rewardProfiles: (rewardProfiles.data ?? []).map(mapRewardProfile),
    progress: (progress.data ?? []).map(mapPlayerProgress),
    scoreEvents: (scoreEvents.data ?? []).map(mapScoreEvent)
  };
}

export async function fetchLeaderboard(limit?: number): Promise<LeaderboardRow[]> {
  const supabase = await requireSupabase();
  const [data, authoritativeViewProbe] = await Promise.all([
    fetchAllPages<any>((from, to) =>
      supabase
        .from("leaderboard")
        .select("*")
        .order("total_score", { ascending: false })
        .order("questions_answered", { ascending: false })
        .order("player_id", { ascending: true })
        .range(from, to)
    ),
    (supabase as any).rpc("reconcile_progress_scores", { target_category_ids: [] })
  ]);

  const mappedRows = data.map(mapLeaderboardRow);
  const authoritativeRows = authoritativeViewProbe.error
    ? await applyAuthoritativeLeaderboardScores(mappedRows)
    : mappedRows;
  const rankedRows = rankLeaderboardRows(authoritativeRows);
  return typeof limit === "number" && Number.isFinite(limit) ? rankedRows.slice(0, limit) : rankedRows;
}

export async function fetchLeaderboardRow(playerId: string): Promise<LeaderboardRow | null> {
  const rows = await fetchLeaderboard();
  return rows.find((row) => row.playerId === playerId) ?? null;
}

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const supabase = await requireSupabase();
  const activity = buildRecentActivity();
  const activitySince = activity[0]?.date ?? new Date().toISOString().slice(0, 10);
  const [
    categoryRows,
    levelRows,
    questionRows,
    progressRows,
    rewardProfileRows,
    recentPlayerRows,
    recentMessageRows,
    recentScoreRows,
    recentSessionRows,
    playerCountResult,
    messageCountResult,
    answerCountResult,
    correctAnswerCountResult,
    pendingRewardCountResult
  ] = await Promise.all([
    fetchAllPages<any>((from, to) => supabase.from("categories").select("*").order("sort_order").order("id").range(from, to)),
    fetchAllPages<any>((from, to) => supabase.from("category_levels").select("*").order("level_number").order("id").range(from, to)),
    fetchAllPages<any>((from, to) => supabase.from("questions").select("*").order("sort_order").order("id").range(from, to)),
    fetchAllPages<any>((from, to) => supabase.from("player_progress").select("*").order("id").range(from, to)),
    fetchAllPages<{ player_id: string }>((from, to) => supabase.from("reward_profiles").select("player_id").order("player_id").range(from, to)),
    fetchAllPages<{ created_at: string | null }>((from, to) =>
      supabase.from("players").select("id,created_at").gte("created_at", activitySince).order("created_at").order("id").range(from, to)
    ),
    fetchAllPages<{ posted_at: string | null }>((from, to) =>
      supabase.from("messages").select("id,posted_at").gte("posted_at", activitySince).order("posted_at").order("id").range(from, to)
    ),
    fetchAllPages<{ player_id: string; answered_at: string | null }>((from, to) =>
      supabase.from("score_events").select("id,player_id,answered_at").gte("answered_at", activitySince).order("answered_at").order("id").range(from, to)
    ),
    fetchAllPages<{ player_id: string; started_at: string | null }>((from, to) =>
      supabase.from("player_game_sessions").select("id,player_id,started_at").gte("started_at", activitySince).order("started_at").order("id").range(from, to)
    ).catch((sessionError) => {
      const err = sessionError instanceof Error ? { message: sessionError.message } : null;
      if (isMissingPlayerSessionsTable(err)) return [];
      throw sessionError;
    }),
    supabase.from("players").select("id", { count: "exact", head: true }),
    supabase.from("messages").select("id", { count: "exact", head: true }),
    supabase.from("score_events").select("id", { count: "exact", head: true }),
    supabase.from("score_events").select("id", { count: "exact", head: true }).eq("is_correct", true),
    supabase.from("rewards").select("id", { count: "exact", head: true }).eq("status", "pending")
  ]);

  const countError =
    playerCountResult.error ??
    messageCountResult.error ??
    answerCountResult.error ??
    correctAnswerCountResult.error ??
    pendingRewardCountResult.error;
  if (countError) throw new Error(countError.message);

  const mappedCategories = categoryRows.map(mapCategory);
  const mappedLevels = levelRows.map(mapLevel);
  const mappedQuestions = questionRows.map(mapQuestion);
  const mappedProgress = progressRows.map(mapPlayerProgress);
  const activityMap = new Map(activity.map((point) => [point.date, point]));
  const dailyPlayerIds = new Map(activity.map((point) => [point.date, new Set<string>()]));
  const activePlayers7d = new Set<string>();
  const totalScore = mappedProgress.reduce((sum, item) => sum + item.score, 0);
  const totalAnswers = answerCountResult.count ?? 0;
  const totalCorrect = correctAnswerCountResult.count ?? 0;
  const playerCount = playerCountResult.count ?? 0;
  const rewardProfilePlayerIds = new Set(rewardProfileRows.map((item) => item.player_id));

  for (const message of recentMessageRows) {
    const point = activityMap.get(dayKey(message.posted_at));
    if (point) point.messages += 1;
  }
  for (const event of recentScoreRows) {
    const day = dayKey(event.answered_at);
    const point = activityMap.get(day);
    if (point) point.answers += 1;
    if (event.player_id) {
      activePlayers7d.add(event.player_id);
      dailyPlayerIds.get(day)?.add(event.player_id);
    }
  }
  for (const session of recentSessionRows) {
    const day = dayKey(session.started_at);
    if (session.player_id) {
      activePlayers7d.add(session.player_id);
      dailyPlayerIds.get(day)?.add(session.player_id);
    }
  }
  for (const point of activity) {
    point.players = dailyPlayerIds.get(point.date)?.size ?? 0;
  }

  return {
    totals: {
      categories: mappedCategories.length,
      activeCategories: mappedCategories.filter((item) => item.isActive).length,
      levels: mappedLevels.length,
      activeLevels: mappedLevels.filter((item) => item.isActive).length,
      questions: mappedQuestions.length,
      activeQuestions: mappedQuestions.filter((item) => item.isActive).length,
      players: playerCount,
      verifiedPlayers: rewardProfilePlayerIds.size,
      messages: messageCountResult.count ?? 0,
      rewardsPending: pendingRewardCountResult.count ?? 0,
      activePlayersLast7Days: activePlayers7d.size
    },
    performance: {
      totalScore,
      averagePlayerScore: playerCount > 0 ? Math.round(totalScore / playerCount) : 0,
      totalAnswers,
      accuracyPercent: totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0
    },
    activity,
    activePlayersLast7Days: activePlayers7d.size,
    categoryBreakdown: mappedCategories
      .map((category) => {
        const categoryLevels = mappedLevels.filter((level) => level.categoryId === category.id);
        const categoryQuestions = mappedQuestions.filter((question) =>
          categoryLevels.some((level) => level.id === question.levelId && question.isActive)
        );
        const categoryProgress = mappedProgress.filter((item) => item.categoryId === category.id);
        return {
          categoryId: category.id,
          title: category.title,
          colorHex: category.colorHex,
          difficulty: category.difficulty,
          activeLevels: categoryLevels.filter((level) => level.isActive).length,
          activeQuestions: categoryQuestions.length,
          players: categoryProgress.length,
          totalScore: categoryProgress.reduce((sum, item) => sum + item.score, 0)
        };
      })
      .sort((first, second) => second.totalScore - first.totalScore || second.players - first.players)
  };
}

export async function fetchAdminAnalytics(): Promise<AdminAnalyticsSummary> {
  const supabase = await requireSupabase();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);
  const [analyticsResult, playerRows, playerSessions, adVideos, questionSubmissionRows] = await Promise.all([
    supabase
      .from("analytics_daily")
      .select("*")
      .gte("event_date", since.toISOString().slice(0, 10))
      .order("count", { ascending: false }),
    fetchAllPages<{ id: string; name: string; avatar_url: string | null }>((from, to) =>
      supabase.from("players").select("id, name, avatar_url").order("id").range(from, to)
    ),
    fetchPlayerSessions(supabase),
    fetchAdVideoAnalytics(supabase),
    fetchAllPages<{
      id: string;
      player_id: string | null;
      player_name: string;
      question_text: string;
      source: string;
      created_at: string | null;
    }>((from, to) =>
      supabase
        .from("question_submissions")
        .select("id, player_id, player_name, question_text, source, created_at")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to)
    )
  ]);

  const error = analyticsResult.error;
  if (error) {
    throw new Error(error.message);
  }

  const rows: AdminAnalyticsRow[] = (analyticsResult.data ?? []).map((row) => ({
    eventDate: row.event_date,
    eventType: row.event_type,
    eventKey: row.event_key,
    label: row.label,
    path: row.path,
    count: row.count,
    lastSeenAt: row.last_seen_at ?? ""
  }));
  const recentDays = buildRecentAnalyticsDays();
  const dayMap = new Map(recentDays.map((point) => [point.date, point]));

  for (const row of rows) {
    const day = dayMap.get(row.eventDate);
    if (!day) {
      continue;
    }

    if (row.eventType === "button_tap") {
      day.buttonTaps += row.count;
    } else if (row.eventType === "game_played") {
      day.gamesPlayed += row.count;
    } else if (row.eventType === "level_completed") {
      day.levelsCompleted += row.count;
    }
  }

  const playerSessionCounts = new Map<string, { count: number; lastPlayedAt: string | null }>();
  for (const session of playerSessions) {
    const existing = playerSessionCounts.get(session.player_id) ?? { count: 0, lastPlayedAt: null };
    playerSessionCounts.set(session.player_id, {
      count: existing.count + 1,
      lastPlayedAt:
        session.started_at && (!existing.lastPlayedAt || session.started_at > existing.lastPlayedAt)
          ? session.started_at
          : existing.lastPlayedAt
    });
  }

  const topPlayersBySessions = playerRows
    .map((player) => {
      const sessions = playerSessionCounts.get(player.id);
      return {
        playerId: player.id,
        name: player.name,
        avatarUrl: player.avatar_url ?? undefined,
        sessionCount: sessions?.count ?? 0,
        lastPlayedAt: sessions?.lastPlayedAt ?? null
      };
    })
    .sort(
      (first, second) =>
        second.sessionCount - first.sessionCount ||
        (second.lastPlayedAt ?? "").localeCompare(first.lastPlayedAt ?? "") ||
        first.name.localeCompare(second.name)
    )
    .slice(0, 20);

  const questionSubmissions = questionSubmissionRows.map((submission, index) => ({
    id: submission.id,
    questionNumber: questionSubmissionRows.length - index,
    playerId: submission.player_id,
    playerName: submission.player_name,
    questionText: submission.question_text,
    source: submission.source,
    createdAt: submission.created_at ?? ""
  }));

  return {
    totals: {
      buttonTaps: rows.filter((row) => row.eventType === "button_tap").reduce((sum, row) => sum + row.count, 0),
      gamesPlayed: rows.filter((row) => row.eventType === "game_played").reduce((sum, row) => sum + row.count, 0),
      levelsCompleted: rows.filter((row) => row.eventType === "level_completed").reduce((sum, row) => sum + row.count, 0),
      playerSessions: playerSessions.length,
      adViews: adVideos.reduce((sum, video) => sum + video.views, 0),
      completedAdViews: adVideos.reduce((sum, video) => sum + video.completedViews, 0),
      questionSubmissions: questionSubmissions.length
    },
    topButtons: rows.filter((row) => row.eventType === "button_tap").slice(0, 12),
    topGames: rows.filter((row) => row.eventType === "game_played").slice(0, 12),
    topLevels: rows.filter((row) => row.eventType === "level_completed").slice(0, 12),
    topPlayersBySessions,
    adVideos,
    questionSubmissions,
    recentDays
  };
}

export async function fetchAdminPlayers(): Promise<AdminPlayerSummary[]> {
  const supabase = await requireSupabase();
  const [playerRows, progressRows, rewardProfileRows, messageRows, playerSessions] = await Promise.all([
    fetchAllPages<any>((from, to) => supabase.from("players").select("*").order("created_at", { ascending: false }).order("id").range(from, to)),
    fetchAllPages<any>((from, to) => supabase.from("player_progress").select("*").order("id").range(from, to)),
    fetchAllPages<{ player_id: string }>((from, to) => supabase.from("reward_profiles").select("player_id").order("player_id").range(from, to)),
    fetchAllPages<{ player_id: string }>((from, to) => supabase.from("messages").select("id,player_id").order("id").range(from, to)),
    fetchPlayerSessions(supabase)
  ]);

  const mappedPlayers = playerRows.map(mapPlayer);
  const mappedProgress = progressRows.map(mapPlayerProgress);
  const verifiedPlayerIds = new Set(rewardProfileRows.map((item) => item.player_id));
  const progressByPlayer = new Map<string, typeof mappedProgress>();
  const messageCounts = new Map<string, number>();
  const sessionCounts = new Map<string, number>();
  const latestSessionAt = new Map<string, string>();

  for (const progress of mappedProgress) {
    const items = progressByPlayer.get(progress.playerId) ?? [];
    items.push(progress);
    progressByPlayer.set(progress.playerId, items);
  }
  for (const message of messageRows) {
    messageCounts.set(message.player_id, (messageCounts.get(message.player_id) ?? 0) + 1);
  }
  for (const session of playerSessions) {
    sessionCounts.set(session.player_id, (sessionCounts.get(session.player_id) ?? 0) + 1);
    if (session.started_at && session.started_at > (latestSessionAt.get(session.player_id) ?? "")) {
      latestSessionAt.set(session.player_id, session.started_at);
    }
  }

  return mappedPlayers
    .map((player) => {
      const playerProgress = progressByPlayer.get(player.id) ?? [];
      const lastPlayedAt = [...playerProgress.map((item) => item.lastPlayedAt), latestSessionAt.get(player.id)]
        .filter((value): value is string => Boolean(value))
        .sort((first, second) => second.localeCompare(first))[0] ?? null;
      return {
        id: player.id,
        name: player.name,
        age: player.age,
        avatarUrl: player.avatarUrl,
        createdAt: player.createdAt,
        totalScore: playerProgress.reduce((sum, item) => sum + item.score, 0),
        categoriesPlayed: playerProgress.filter((item) => item.score > 0 || item.levelsCompleted > 0).length,
        levelsCompleted: playerProgress.reduce((sum, item) => sum + item.levelsCompleted, 0),
        messageCount: messageCounts.get(player.id) ?? 0,
        sessionCount: sessionCounts.get(player.id) ?? 0,
        rewardVerified: verifiedPlayerIds.has(player.id),
        lastPlayedAt
      };
    })
    .sort((first, second) => second.totalScore - first.totalScore || second.levelsCompleted - first.levelsCompleted);
}

export async function fetchAdminPlayerDetail(playerId: string): Promise<AdminPlayerDetail | null> {
  const supabase = await requireSupabase();
  const [player, progress, rewardProfiles, scoreEvents, categories, levels, messages, playerSessions] = await Promise.all([
    supabase.from("players").select("*").eq("id", playerId).maybeSingle(),
    supabase.from("player_progress").select("*").eq("player_id", playerId).order("last_played_at", { ascending: false }),
    supabase.from("reward_profiles").select("*").eq("player_id", playerId).order("created_at", { ascending: false }),
    supabase.from("score_events").select("*").eq("player_id", playerId),
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("category_levels").select("*").order("level_number"),
    supabase.from("messages").select("*").eq("player_id", playerId),
    fetchPlayerSessions(supabase, playerId)
  ]);

  const error =
    player.error ??
    progress.error ??
    rewardProfiles.error ??
    scoreEvents.error ??
    categories.error ??
    levels.error ??
    messages.error;

  if (error) {
    throw new Error(error.message);
  }

  if (!player.data) {
    return null;
  }

  const mappedPlayer = mapPlayer(player.data);
  const mappedProgress = (progress.data ?? []).map(mapPlayerProgress);
  const mappedCategories = (categories.data ?? []).map(mapCategory);
  const mappedLevels = (levels.data ?? []).map(mapLevel);
  const mappedScoreEvents = (scoreEvents.data ?? []).map(mapScoreEvent);
  const totalScore = mappedProgress.reduce((sum, item) => sum + item.score, 0);
  const categoriesPlayed = mappedProgress.filter((item) => item.score > 0 || item.levelsCompleted > 0).length;
  const lastPlayedAt =
    [...mappedProgress.map((item) => item.lastPlayedAt), ...playerSessions.map((session) => session.started_at)]
      .filter((value): value is string => Boolean(value))
      .sort((first, second) => second.localeCompare(first))[0] ?? null;

  return {
    id: mappedPlayer.id,
    name: mappedPlayer.name,
    age: mappedPlayer.age,
    avatarUrl: mappedPlayer.avatarUrl,
    createdAt: mappedPlayer.createdAt,
    totalScore,
    categoriesPlayed,
    levelsCompleted: mappedProgress.reduce((sum, item) => sum + item.levelsCompleted, 0),
    messageCount: (messages.data ?? []).length,
    sessionCount: playerSessions.length,
    rewardVerified: (rewardProfiles.data ?? []).length > 0,
    lastPlayedAt,
    rewardProfiles: (rewardProfiles.data ?? []).map(mapRewardProfile),
    progressItems: mappedProgress.map((item) => {
      const category = mappedCategories.find((entry) => entry.id === item.categoryId);
      const categoryLevels = mappedLevels.filter((level) => level.categoryId === item.categoryId && level.isActive);
      const totalLevels = categoryLevels.length;
      const currentLevel = categoryLevels.find((level) => level.levelNumber === item.currentLevel);

      return {
        categoryId: item.categoryId,
        categoryTitle: category?.title ?? item.categoryId,
        categoryColorHex: category?.colorHex ?? "#56bdd7",
        difficulty: currentLevel?.difficulty ?? "easy",
        currentLevel: item.currentLevel,
        currentQuestionIndex: item.currentQuestionIndex,
        score: item.score,
        levelsCompleted: item.levelsCompleted,
        lastPlayedAt: item.lastPlayedAt,
        totalLevels
      };
    }),
    totalAnswers: mappedScoreEvents.length,
    correctAnswers: mappedScoreEvents.filter((item) => item.isCorrect).length
  };
}

export async function fetchAdminMessages(limit = 150, before?: string): Promise<Message[]> {
  const supabase = await requireSupabase();
  let query = supabase
    .from("messages")
    .select("id, player_id, text, reply_to_message_id, posted_at, players(name, avatar_url)")
    .order("posted_at", { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt("posted_at", before);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<{
    id: string;
    player_id: string;
    text: string;
    posted_at: string | null;
    reply_to_message_id?: string | null;
    players?: { name?: string | null; avatar_url?: string | null } | Array<{ name?: string | null; avatar_url?: string | null }> | null;
  }>).map(mapMessage);
}
