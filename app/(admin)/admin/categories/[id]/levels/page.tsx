"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, SlidersHorizontal, Trash2 } from "lucide-react";
import { LevelForm } from "@/components/admin/LevelForm";
import { LevelList } from "@/components/admin/LevelList";
import { useContentSync } from "@/hooks/useContentSync";
import { defaultDifficultyForLevel } from "@/lib/difficulty";
import { bulkRemoveRemoteQuestions, createRemoteLevel, fetchRemoteContent, updateRemoteLevel } from "@/lib/admin-client";
import { useContentStore } from "@/store/contentStore";
import type { CategoryLevel, Difficulty, LevelFormValues, Question } from "@/lib/types";

const difficulties: Difficulty[] = ["easy", "medium", "hard"];

function BulkDifficultyEditor({
  levels,
  onApply
}: {
  levels: CategoryLevel[];
  onApply: (targetLevels: CategoryLevel[], difficulty: Difficulty) => Promise<void>;
}) {
  const firstLevel = levels[0]?.levelNumber ?? 1;
  const lastLevel = levels[levels.length - 1]?.levelNumber ?? 20;
  const [fromLevel, setFromLevel] = useState(1);
  const [toLevel, setToLevel] = useState(5);
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const start = Math.min(fromLevel, toLevel);
    const end = Math.max(fromLevel, toLevel);
    const targetLevels = levels.filter((level) => level.levelNumber >= start && level.levelNumber <= end);

    if (targetLevels.length === 0) {
      toast.error("No levels found in that range.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onApply(targetLevels, difficulty);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update level difficulties.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <SlidersHorizontal className="h-5 w-5" />
        <h2 className="text-lg font-black">Bulk Difficulty</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
        <label className="grid gap-1 text-sm font-bold">
          From Level
          <input
            className="h-11 rounded-md border border-black/15 px-3"
            type="number"
            min={firstLevel}
            max={lastLevel}
            value={fromLevel}
            onChange={(event) => setFromLevel(Number(event.target.value))}
          />
        </label>
        <label className="grid gap-1 text-sm font-bold">
          To Level
          <input
            className="h-11 rounded-md border border-black/15 px-3"
            type="number"
            min={firstLevel}
            max={lastLevel}
            value={toLevel}
            onChange={(event) => setToLevel(Number(event.target.value))}
          />
        </label>
        <label className="grid gap-1 text-sm font-bold">
          Difficulty
          <select
            className="h-11 rounded-md border border-black/15 px-3 capitalize"
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value as Difficulty)}
          >
            {difficulties.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={isSubmitting || levels.length === 0}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-black px-4 text-sm font-black uppercase text-white disabled:opacity-55"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {isSubmitting ? "Updating..." : "Apply"}
        </button>
      </div>
    </form>
  );
}

function BulkQuestionRemover({
  levels,
  questions,
  onRemove
}: {
  levels: CategoryLevel[];
  questions: Question[];
  onRemove: (targetLevels: CategoryLevel[]) => Promise<number>;
}) {
  const firstLevel = levels[0]?.levelNumber ?? 1;
  const lastLevel = levels[levels.length - 1]?.levelNumber ?? 20;
  const [fromLevel, setFromLevel] = useState(1);
  const [toLevel, setToLevel] = useState(20);
  const [confirmText, setConfirmText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const start = Math.min(fromLevel, toLevel);
  const end = Math.max(fromLevel, toLevel);
  const targetLevels = levels.filter((level) => level.levelNumber >= start && level.levelNumber <= end);
  const targetLevelIds = new Set(targetLevels.map((level) => level.id));
  const activeQuestionCount = questions.filter(
    (question) => targetLevelIds.has(question.levelId) && question.isActive
  ).length;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (targetLevels.length === 0) {
      toast.error("No levels found in that range.");
      return;
    }

    if (activeQuestionCount === 0) {
      toast.error("No active questions found in that range.");
      return;
    }

    if (confirmText.trim().toUpperCase() !== "REMOVE") {
      toast.error("Type REMOVE to confirm.");
      return;
    }

    setIsSubmitting(true);
    try {
      const removed = await onRemove(targetLevels);
      setConfirmText("");
      toast.success(`Removed ${removed} active question${removed === 1 ? "" : "s"}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove questions.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-red-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-red-700">
        <Trash2 className="h-5 w-5" />
        <h2 className="text-lg font-black">Bulk Question Remover</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_1fr_auto] md:items-end">
        <label className="grid gap-1 text-sm font-bold">
          From Level
          <input
            className="h-11 rounded-md border border-black/15 px-3"
            type="number"
            min={firstLevel}
            max={lastLevel}
            value={fromLevel}
            onChange={(event) => setFromLevel(Number(event.target.value))}
          />
        </label>
        <label className="grid gap-1 text-sm font-bold">
          To Level
          <input
            className="h-11 rounded-md border border-black/15 px-3"
            type="number"
            min={firstLevel}
            max={lastLevel}
            value={toLevel}
            onChange={(event) => setToLevel(Number(event.target.value))}
          />
        </label>
        <label className="grid gap-1 text-sm font-bold">
          Active Questions
          <input className="h-11 rounded-md border border-black/15 px-3 text-black/55" value={activeQuestionCount} readOnly />
        </label>
        <label className="grid gap-1 text-sm font-bold">
          Confirm
          <input
            className="h-11 rounded-md border border-black/15 px-3"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            placeholder="Type REMOVE"
          />
        </label>
        <button
          type="submit"
          disabled={isSubmitting || activeQuestionCount === 0}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-red-300 px-4 text-sm font-black uppercase text-red-700 disabled:opacity-55"
        >
          <Trash2 className="h-4 w-4" />
          {isSubmitting ? "Removing..." : "Remove"}
        </button>
      </div>
    </form>
  );
}

export default function CategoryLevelsPage({ params }: { params: { id: string } }) {
  useContentSync();
  const isLoaded = useContentStore((state) => state.isLoaded);
  const category = useContentStore((state) => state.categories.find((item) => item.id === params.id));
  const allLevels = useContentStore((state) => state.levels);
  const questions = useContentStore((state) => state.questions);
  const levels = allLevels
    .filter((level) => level.categoryId === params.id)
    .sort((first, second) => first.levelNumber - second.levelNumber);
  const replaceContent = useContentStore((state) => state.replaceContent);
  const nextLevelNumber = levels.length + 1;
  const defaultDifficulty = defaultDifficultyForLevel(nextLevelNumber, Math.max(20, nextLevelNumber));

  if (!isLoaded && !category) {
    return <div className="rounded-lg bg-white p-6 font-black">Loading levels...</div>;
  }

  if (!category) {
    return <div className="rounded-lg bg-white p-6 font-black">Category not found.</div>;
  }

  async function refreshContent(successMessage?: string) {
    const content = await fetchRemoteContent();
    replaceContent(content);
    if (successMessage) {
      toast.success(successMessage);
    }
  }

  async function createLevel(values: LevelFormValues) {
    try {
      const count = values.numberOfLevels || 1;
      for (let i = 0; i < count; i++) {
        await createRemoteLevel(params.id, levels.length + 1 + i, { ...values, title: values.title || "" });
      }
      await refreshContent(count > 1 ? `Added ${count} levels` : "Level added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add level(s).");
    }
  }

  async function updateLevelDifficulties(targetLevels: CategoryLevel[], difficulty: Difficulty) {
    await Promise.all(targetLevels.map((level) => updateRemoteLevel(level.id, { difficulty })));
    await refreshContent(
      `Updated ${targetLevels.length} level${targetLevels.length === 1 ? "" : "s"} to ${difficulty}`
    );
  }

  async function removeQuestionsFromLevels(targetLevels: CategoryLevel[]) {
    const result = await bulkRemoveRemoteQuestions(targetLevels.map((level) => level.id));
    await refreshContent();
    return result.data.removed;
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Link href="/admin/categories" className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-black/58">
            <ArrowLeft className="h-4 w-4" />
            Categories
          </Link>
          <p className="text-xs font-black uppercase text-black/45">{category.title}</p>
          <h1 className="font-display text-4xl font-black">Levels</h1>
          <p className="mt-2 text-sm font-bold text-black/55">
            Recommended plan: levels 1-5 easy, 6-15 medium, 16-20 hard. You can change each level&apos;s difficulty.
          </p>
        </div>
        <Link href={`/category/${category.id}`} className="min-h-11 rounded-md bg-black px-4 py-3 text-sm font-black uppercase text-white">
          View Map
        </Link>
      </div>

      <div className="mb-6">
        <LevelForm defaultDifficulty={defaultDifficulty} submitLabel="Add Level" onSubmit={createLevel} />
      </div>
      <div className="mb-6">
        <BulkDifficultyEditor levels={levels} onApply={updateLevelDifficulties} />
      </div>
      <div className="mb-6">
        <BulkQuestionRemover levels={levels} questions={questions} onRemove={removeQuestionsFromLevels} />
      </div>
      <LevelList categoryId={category.id} levels={levels} onRefresh={refreshContent} />
    </div>
  );
}
