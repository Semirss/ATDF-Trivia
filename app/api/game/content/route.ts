import { NextResponse } from "next/server";
import { buildGameContent } from "@/lib/data-mappers";
import { fetchCachedGameCoreContent } from "@/lib/supabase/game-content-cache";

export const dynamic = "force-dynamic";

const fallbackContent = buildGameContent({
  categories: [],
  levels: [],
  questions: [],
  messages: [],
  config: {
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
  }
});

function cacheHeaders() {
  return { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400" };
}

export async function GET(request: Request) {
  try {
    const data = await fetchCachedGameCoreContent();
    const searchParams = new URL(request.url).searchParams;
    const scope = searchParams.get("scope") ?? "full";

    if (scope === "bootstrap") {
      return NextResponse.json(
        {
          data: {
            ...data,
            categories: data.categories.filter((category) => category.isActive),
            levels: [],
            questions: []
          },
          source: "supabase"
        },
        { headers: cacheHeaders() }
      );
    }

    if (scope === "category") {
      const categoryId = searchParams.get("categoryId")?.trim();
      const requestedLevelId = searchParams.get("levelId")?.trim();
      const includePreviousLevels = searchParams.get("includePrevious") === "true";
      const requestedStart = Math.max(1, Number.parseInt(searchParams.get("startLevel") ?? "1", 10) || 1);
      const limit = Math.max(1, Math.min(5, Number.parseInt(searchParams.get("limit") ?? "5", 10) || 5));
      const category = data.categories.find((item) => item.id === categoryId && item.isActive);

      if (!category) {
        return NextResponse.json({ error: "Category not found." }, { status: 404 });
      }

      const categoryLevels = data.levels
        .filter((level) => level.categoryId === category.id && level.isActive)
        .sort((first, second) => first.levelNumber - second.levelNumber);
      const requestedLevel = requestedLevelId
        ? categoryLevels.find((level) => level.id === requestedLevelId)
        : null;
      const startLevel = requestedLevel
        ? Math.floor((requestedLevel.levelNumber - 1) / limit) * limit + 1
        : requestedStart;
      const currentLevels = categoryLevels
        .filter((level) => level.levelNumber >= startLevel)
        .slice(0, limit);
      const currentEndLevel = currentLevels[currentLevels.length - 1]?.levelNumber ?? startLevel + limit - 1;
      const levels = includePreviousLevels
        ? categoryLevels.filter((level) => level.levelNumber <= currentEndLevel)
        : currentLevels;
      // The map renders previous completed levels as well as the current page.
      // Include their questions so completion and stars can be validated against
      // the current content instead of trusting an old levels_completed value.
      const levelIds = new Set(levels.map((level) => level.id));
      const questions = data.questions.filter((question) => levelIds.has(question.levelId) && question.isActive);

      return NextResponse.json(
        {
          data: {
            ...data,
            categories: [category],
            levels,
            questions
          },
          meta: {
            startLevel,
            limit,
            totalLevels: categoryLevels.length,
            hasPrevious: startLevel > 1,
            hasMore:
              currentLevels.length > 0 &&
              currentLevels[currentLevels.length - 1].levelNumber < (categoryLevels[categoryLevels.length - 1]?.levelNumber ?? 0)
          },
          source: "supabase"
        },
        { headers: cacheHeaders() }
      );
    }

    return NextResponse.json(
      { data, source: "supabase" },
      { headers: cacheHeaders() }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load game content.";
    if (message === "Supabase is not configured." && process.env.NODE_ENV !== "production") {
      return NextResponse.json(
        { data: fallbackContent, source: "local-empty", warning: message },
        { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
      );
    }

    const status = message === "Supabase is not configured." ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
