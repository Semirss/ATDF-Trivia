import type { Difficulty } from "@/lib/types";

const difficultyOrder: Difficulty[] = ["easy", "medium", "hard"];

export function normalizeDifficulty(value: string | null | undefined): Difficulty | null {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "easy" || normalized === "medium" || normalized === "hard") {
    return normalized;
  }

  return null;
}

export function defaultDifficultyForLevel(levelNumber: number, totalLevels = 20): Difficulty {
  const safeTotal = Math.max(1, totalLevels);
  const easyEnd = Math.max(1, Math.round(safeTotal * 0.25));
  const mediumEnd = Math.max(easyEnd + 1, Math.round(safeTotal * 0.75));

  if (levelNumber <= easyEnd) {
    return "easy";
  }

  if (levelNumber <= mediumEnd) {
    return "medium";
  }

  return "hard";
}

export function compareDifficulty(first: Difficulty, second: Difficulty) {
  return difficultyOrder.indexOf(first) - difficultyOrder.indexOf(second);
}

export function inferQuestionDifficulty(text: string): Difficulty {
  const normalized = text.toLowerCase();

  if (/\b(hard|expert|advanced|difficult|complex|analy[sz]e|calculate|evaluate)\b/.test(normalized)) {
    return "hard";
  }

  if (/\b(medium|intermediate|compare|explain|identify why|which statement)\b/.test(normalized)) {
    return "medium";
  }

  return "easy";
}
