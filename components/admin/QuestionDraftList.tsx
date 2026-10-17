"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from "lucide-react";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { QuestionForm, defaultQuestionFormValues } from "@/components/admin/QuestionForm";
import { hasQuestionTranslation } from "@/lib/i18n";
import { visibleQuestionOptions } from "@/lib/utils";
import type { QuestionFormValues } from "@/lib/types";

export function QuestionDraftList({
  drafts,
  onChange,
  title,
  description,
  emptyMessage
}: {
  drafts: QuestionFormValues[];
  onChange: (drafts: QuestionFormValues[]) => void;
  title: string;
  description?: string;
  emptyMessage?: string;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(4);
  const totalPages = Math.max(1, Math.ceil(drafts.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const visibleDrafts = drafts.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (editingIndex !== null && editingIndex >= drafts.length) {
      setEditingIndex(null);
    }
  }, [drafts.length, editingIndex]);

  function updateDraft(index: number, values: QuestionFormValues) {
    onChange(drafts.map((draft, draftIndex) => (draftIndex === index ? values : draft)));
    setEditingIndex(null);
  }

  function removeDraft(index: number) {
    onChange(drafts.filter((_, draftIndex) => draftIndex !== index));
  }

  function moveDraft(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= drafts.length) {
      return;
    }

    const nextDrafts = [...drafts];
    const current = nextDrafts[index];
    nextDrafts[index] = nextDrafts[nextIndex];
    nextDrafts[nextIndex] = current;
    onChange(nextDrafts);
  }

  function addDraft() {
    onChange([...drafts, { ...defaultQuestionFormValues }]);
    setPage(Math.max(1, Math.ceil((drafts.length + 1) / pageSize)));
    setEditingIndex(drafts.length);
  }

  return (
    <div className="rounded-[28px] border border-white/70 bg-white/82 p-4 shadow-[0_16px_44px_rgba(20,20,20,0.08)] backdrop-blur-xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.16em] text-black/45">{title}</div>
          {description ? <p className="mt-2 max-w-3xl text-sm font-bold text-black/58">{description}</p> : null}
        </div>
        <button
          type="button"
          onClick={addDraft}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[18px] border border-black/10 bg-black px-4 text-sm font-black uppercase text-white shadow-engine"
        >
          <Plus className="h-4 w-4" />
          Add Draft
        </button>
      </div>

      {drafts.length === 0 ? (
        <div className="mt-4 rounded-[24px] border border-black/10 bg-black/[0.03] px-4 py-10 text-center text-sm font-bold text-black/55">
          {emptyMessage ?? "No staged questions yet."}
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {visibleDrafts.map((draft, visibleIndex) => {
          const draftIndex = startIndex + visibleIndex;
          const answerOptions = visibleQuestionOptions(draft);

          return (
            <div key={`${draft.questionText}-${draftIndex}`} className="rounded-[24px] border border-black/10 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-black uppercase text-black/45">Draft {draftIndex + 1}</div>
                  <h3 className="mt-1 text-lg font-black">{draft.questionText || "Untitled question"}</h3>
                  <div className="mt-2 grid gap-2 text-sm font-bold text-black/58 md:grid-cols-2">
                    {answerOptions.map((option) => (
                      <span key={option.key}>{option.label}. {option.text}</span>
                    ))}
                  </div>
                  <div className="mt-2 text-xs font-black uppercase text-black/45">
                    Correct: {draft.correctOption.toUpperCase()}
                    {hasQuestionTranslation(draft, "am") ? " | Amharic ready" : ""}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => moveDraft(draftIndex, -1)}
                    className="grid h-10 w-10 place-items-center rounded-md border border-black/10"
                    aria-label="Move draft up"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDraft(draftIndex, 1)}
                    className="grid h-10 w-10 place-items-center rounded-md border border-black/10"
                    aria-label="Move draft down"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingIndex((current) => (current === draftIndex ? null : draftIndex))}
                    className="grid h-10 w-10 place-items-center rounded-md border border-black/10"
                    aria-label="Edit draft"
                  >
                    {editingIndex === draftIndex ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeDraft(draftIndex)}
                    className="grid h-10 w-10 place-items-center rounded-md border border-red-200 text-red-600"
                    aria-label="Delete draft"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {editingIndex === draftIndex ? (
                <div className="mt-4 border-t border-black/10 pt-4">
                  <QuestionForm
                    initialValues={draft}
                    submitLabel="Save Draft"
                    onSubmit={(values) => updateDraft(draftIndex, values)}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {drafts.length > 0 ? (
        <AdminPagination
          itemLabel="drafts"
          page={page}
          pageSize={pageSize}
          totalItems={drafts.length}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
          pageSizeOptions={[4, 8, 12]}
        />
      ) : null}
    </div>
  );
}
