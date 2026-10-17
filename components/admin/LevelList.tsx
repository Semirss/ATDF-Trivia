"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Trash2, X } from "lucide-react";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { updateRemoteLevel, deleteRemoteLevel } from "@/lib/admin-client";
import { useContentStore } from "@/store/contentStore";
import type { CategoryLevel, LevelFormValues } from "@/lib/types";
import { LevelForm } from "@/components/admin/LevelForm";

export function LevelList({
  categoryId,
  levels,
  onRefresh
}: {
  categoryId: string;
  levels: CategoryLevel[];
  onRefresh: (successMessage?: string) => Promise<void>;
}) {
  const [editingLevelId, setEditingLevelId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const questions = useContentStore((state) => state.questions);
  const totalPages = Math.max(1, Math.ceil(levels.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleLevels = levels.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  async function toggleLevel(level: CategoryLevel) {
    try {
      await updateRemoteLevel(level.id, { isActive: !level.isActive });
      await onRefresh("Level updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update level.");
    }
  }

  async function saveLevel(id: string, values: LevelFormValues) {
    try {
      await updateRemoteLevel(id, values);
      setEditingLevelId(null);
      await onRefresh("Level saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save level.");
    }
  }

  async function deleteLevel(levelId: string) {
    try {
      await deleteRemoteLevel(levelId);
      await onRefresh("Level deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete level.");
    }
  }

  async function reorderLevel(level: CategoryLevel, direction: -1 | 1) {
    const categoryLevels = [...levels].sort((first, second) => first.levelNumber - second.levelNumber);
    const index = categoryLevels.findIndex((item) => item.id === level.id);
    const swapIndex = index + direction;

    if (index < 0 || swapIndex < 0 || swapIndex >= categoryLevels.length) {
      return;
    }

    const swap = categoryLevels[swapIndex];

    try {
      await Promise.all([
        updateRemoteLevel(level.id, { levelNumber: swap.levelNumber }),
        updateRemoteLevel(swap.id, { levelNumber: level.levelNumber })
      ]);
      await onRefresh("Level order updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to reorder levels.");
    }
  }

  return (
    <div className="space-y-3">
      {visibleLevels.map((level) => {
        const activeQuestions = questions.filter((question) => question.levelId === level.id && question.isActive).length;
        const missing = Math.max(level.questionCount - activeQuestions, 0);

        return (
          <div key={level.id} className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-xs font-black uppercase text-black/45">Level {level.levelNumber}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-black">{level.title}</h3>
                  <span className="rounded-full bg-black px-2.5 py-1 text-[10px] font-black uppercase text-white">
                    {level.difficulty}
                  </span>
                </div>
                <div className="mt-1 text-sm font-bold text-black/55">
                  {activeQuestions} active / {level.questionCount} required, {level.timeLimitSeconds}s, {level.pointsPerCorrect} pts
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void reorderLevel(level, -1)} className="grid h-10 w-10 place-items-center rounded-md border border-black/10" aria-label="Move up">
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => void reorderLevel(level, 1)} className="grid h-10 w-10 place-items-center rounded-md border border-black/10" aria-label="Move down">
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => void toggleLevel(level)} className="grid h-10 w-10 place-items-center rounded-md border border-black/10" aria-label="Toggle active">
                  {level.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingLevelId((current) => (current === level.id ? null : level.id))}
                  className="grid h-10 w-10 place-items-center rounded-md border border-black/10"
                  aria-label="Edit level"
                >
                  {editingLevelId === level.id ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                </button>
                <Link href={`/admin/categories/${categoryId}/levels/${level.id}/questions`} className="inline-flex min-h-10 items-center rounded-md bg-black px-3 text-sm font-black uppercase text-white">
                  Questions
                </Link>
                <button
                  type="button"
                  onClick={() =>
                    void saveLevel(level.id, {
                      title: level.title,
                      difficulty: level.difficulty,
                      questionCount: level.questionCount + 1,
                      timeLimitSeconds: level.timeLimitSeconds,
                      pointsPerCorrect: level.pointsPerCorrect,
                      isActive: level.isActive
                    })
                  }
                  className="min-h-10 rounded-md border border-black/10 px-3 text-sm font-black"
                >
                  + Count
                </button>
                <button type="button" onClick={() => void deleteLevel(level.id)} className="grid h-10 w-10 place-items-center rounded-md border border-red-200 text-red-600" aria-label="Delete level">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            {editingLevelId === level.id ? (
              <div className="mt-4 border-t border-black/10 pt-4">
                <LevelForm level={level} submitLabel="Save Level" onSubmit={(values) => void saveLevel(level.id, values)} />
              </div>
            ) : null}
            {missing > 0 ? (
              <div className="mt-3 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-900">
                <AlertTriangle className="h-4 w-4" />
                Add {missing} more active question{missing === 1 ? "" : "s"} before players can use this level.
              </div>
            ) : null}
          </div>
        );
      })}

      {levels.length > 0 ? (
        <AdminPagination
          itemLabel="levels"
          page={page}
          pageSize={pageSize}
          totalItems={levels.length}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
        />
      ) : null}
    </div>
  );
}
