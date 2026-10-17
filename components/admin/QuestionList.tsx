"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Pencil, Trash2, X } from "lucide-react";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { deleteRemoteQuestion, updateRemoteQuestion } from "@/lib/admin-client";
import { QuestionForm } from "@/components/admin/QuestionForm";
import { hasQuestionTranslation } from "@/lib/i18n";
import { visibleQuestionOptions } from "@/lib/utils";
import type { Question, QuestionFormValues } from "@/lib/types";

export function QuestionList({
  questions,
  onRefresh
}: {
  questions: Question[];
  onRefresh: (successMessage?: string) => Promise<void>;
}) {
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const totalPages = Math.max(1, Math.ceil(questions.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const visibleQuestions = questions.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  async function saveQuestion(id: string, values: QuestionFormValues) {
    try {
      await updateRemoteQuestion(id, values);
      setEditingQuestionId(null);
      await onRefresh("Question saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save question.");
    }
  }

  async function toggleQuestion(question: Question) {
    try {
      await updateRemoteQuestion(question.id, { isActive: !question.isActive });
      await onRefresh("Question updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update question.");
    }
  }

  async function removeQuestion(id: string) {
    try {
      await deleteRemoteQuestion(id);
      await onRefresh("Question archived");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to archive question.");
    }
  }

  return (
    <div className="space-y-3">
      {visibleQuestions.map((question, index) => {
        const answerOptions = visibleQuestionOptions(question);

        return (
          <div key={question.id} className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="text-xs font-black uppercase text-black/45">Question {startIndex + index + 1}</div>
                <h3 className="mt-1 text-lg font-black">{question.questionText}</h3>
                <div className="mt-2 grid gap-2 text-sm font-bold text-black/58 md:grid-cols-2">
                  {answerOptions.map((option) => (
                    <span key={option.key}>{option.label}. {option.text}</span>
                  ))}
                </div>
                <div className="mt-2 text-xs font-black uppercase text-black/45">
                  Correct: {question.correctOption}
                  {hasQuestionTranslation(question, "am") ? " | Amharic ready" : ""}
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => void toggleQuestion(question)} className="grid h-10 w-10 place-items-center rounded-md border border-black/10" aria-label="Toggle question">
                  {question.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingQuestionId((current) => (current === question.id ? null : question.id))}
                  className="grid h-10 w-10 place-items-center rounded-md border border-black/10"
                  aria-label="Edit question"
                >
                  {editingQuestionId === question.id ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                </button>
                <button type="button" onClick={() => void removeQuestion(question.id)} className="grid h-10 w-10 place-items-center rounded-md border border-red-200 text-red-600" aria-label="Delete question">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            {editingQuestionId === question.id ? (
              <div className="mt-4 border-t border-black/10 pt-4">
                <QuestionForm question={question} submitLabel="Save Question" onSubmit={(values) => void saveQuestion(question.id, values)} />
              </div>
            ) : null}
          </div>
        );
      })}

      {questions.length > 0 ? (
        <AdminPagination
          itemLabel="questions"
          page={page}
          pageSize={pageSize}
          totalItems={questions.length}
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
