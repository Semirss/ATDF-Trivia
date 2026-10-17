import type { ScoreEvent } from "@/lib/types";

export function calculateStars(correctAnswers: number, totalQuestions: number) {
  if (totalQuestions <= 0) {
    return 0;
  }

  return Math.max(1, Math.min(5, Math.ceil((correctAnswers / totalQuestions) * 5)));
}

export function latestScoreEventsByQuestion(events: ScoreEvent[]) {
  const latestEvents = new Map<string, ScoreEvent>();

  const newestFirst = [...events].sort((first, second) => {
    const firstTime = first.answeredAt ? new Date(first.answeredAt).getTime() : 0;
    const secondTime = second.answeredAt ? new Date(second.answeredAt).getTime() : 0;
    return secondTime - firstTime;
  });

  for (const event of newestFirst) {
    if (!event.questionId) continue; // question was deleted; skip
    if (!latestEvents.has(event.questionId)) {
      latestEvents.set(event.questionId, event);
    }
  }

  return Array.from(latestEvents.values());
}
