"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Upload } from "lucide-react";
import { QuestionDraftList } from "@/components/admin/QuestionDraftList";
import { QuestionForm } from "@/components/admin/QuestionForm";
import { QuestionExtractor } from "@/components/admin/QuestionExtractor";
import { QuestionList } from "@/components/admin/QuestionList";
import { bulkImportRemoteQuestions, createRemoteQuestion, fetchRemoteContent } from "@/lib/admin-client";
import { useContentSync } from "@/hooks/useContentSync";
import { useContentStore } from "@/store/contentStore";
import type { OptionKey, QuestionFormValues, QuestionTranslation } from "@/lib/types";

function parseCsvLine(line: string) {
  return line.split(",").map((part) => part.trim());
}

function buildTranslation(values: Partial<QuestionTranslation>) {
  const translation: Partial<QuestionTranslation> = {
    questionText: values.questionText?.trim() ?? "",
    optionA: values.optionA?.trim() ?? "",
    optionB: values.optionB?.trim() ?? "",
    optionC: values.optionC?.trim() ?? "",
    optionD: values.optionD?.trim() ?? "",
    explanation: values.explanation?.trim() ?? ""
  };

  return Object.values(translation).some(Boolean) ? translation : null;
}

function normalizeAnswer(value: string | undefined, options: Partial<Record<OptionKey, string>>): OptionKey {
  const normalized = value?.trim().toLowerCase();
  const optionKey = normalized === "b" || normalized === "c" || normalized === "d" ? normalized : "a";

  return options[optionKey]?.trim() ? optionKey : "a";
}

export default function LevelQuestionsPage({ params }: { params: { id: string; levelId: string } }) {
  useContentSync();
  const [csv, setCsv] = useState("");
  const [csvDrafts, setCsvDrafts] = useState<QuestionFormValues[]>([]);
  const isLoaded = useContentStore((state) => state.isLoaded);
  const category = useContentStore((state) => state.categories.find((item) => item.id === params.id));
  const level = useContentStore((state) => state.levels.find((item) => item.id === params.levelId));
  const allQuestions = useContentStore((state) => state.questions);
  const questions = allQuestions
    .filter((question) => question.levelId === params.levelId)
    .sort((first, second) => first.sortOrder - second.sortOrder);
  const replaceContent = useContentStore((state) => state.replaceContent);

  if (!isLoaded && (!category || !level)) {
    return <div className="rounded-lg bg-white p-6 font-black">Loading questions...</div>;
  }

  if (!category || !level) {
    return <div className="rounded-lg bg-white p-6 font-black">Level not found.</div>;
  }

  const activeQuestions = questions.filter((question) => question.isActive).length;
  const missing = Math.max(level.questionCount - activeQuestions, 0);

  async function refreshContent(successMessage?: string) {
    const content = await fetchRemoteContent();
    replaceContent(content);
    if (successMessage) {
      toast.success(successMessage);
    }
  }

  async function createQuestion(values: QuestionFormValues) {
    try {
      await createRemoteQuestion(params.levelId, (questions[questions.length - 1]?.sortOrder ?? -1) + 1, values);
      await refreshContent("Question added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add question.");
    }
  }

  function parseCsvDrafts() {
    const imported = csv
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line): QuestionFormValues | null => {
        const [
          questionText,
          optionA,
          optionB,
          optionC,
          optionD,
          correctOption,
          explanation = "",
          amharicQuestion,
          amharicA,
          amharicB,
          amharicC,
          amharicD,
          amharicExplanation
        ] = parseCsvLine(line);
        if (!questionText || !optionA || !optionB) {
          return null;
        }

        const safeCorrect = normalizeAnswer(correctOption, {
          a: optionA,
          b: optionB,
          c: optionC,
          d: optionD
        });
        const amharic = buildTranslation({
          questionText: amharicQuestion,
          optionA: amharicA,
          optionB: amharicB,
          optionC: amharicC,
          optionD: amharicD,
          explanation: amharicExplanation
        });

        return {
          questionText,
          optionA,
          optionB,
          optionC: optionC ?? "",
          optionD: optionD ?? "",
          correctOption: safeCorrect,
          explanation,
          translations: amharic ? { am: amharic } : {},
          mediaUrl: "",
          isActive: true
        };
      })
      .filter((item): item is QuestionFormValues => item !== null);

    if (imported.length === 0) {
      toast.error("No valid CSV rows found");
      return [];
    }

    setCsvDrafts(imported);
    toast.success(`${imported.length} questions ready to review`);
    return imported;
  }

  async function importCsvDrafts() {
    if (csvDrafts.length === 0) {
      parseCsvDrafts();
      return;
    }

    try {
      await bulkImportRemoteQuestions(params.levelId, csvDrafts);
      await refreshContent(`${csvDrafts.length} questions imported`);
      setCsv("");
      setCsvDrafts([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to import questions.");
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link href={`/admin/categories/${params.id}/levels`} className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-black/58">
          <ArrowLeft className="h-4 w-4" />
          Levels
        </Link>
        <p className="text-xs font-black uppercase text-black/45">
          {category.title} / Level {level.levelNumber} / {level.difficulty}
        </p>
        <h1 className="font-display text-4xl font-black">{level.title} Questions</h1>
      </div>

      {missing > 0 ? (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-900">
          <AlertTriangle className="h-5 w-5" />
          {activeQuestions} active / {level.questionCount} required. Add {missing} more active question{missing === 1 ? "" : "s"}.
        </div>
      ) : null}

      <div className="mb-6 grid gap-5 xl:grid-cols-[1fr_420px]">
        <QuestionForm submitLabel="Add Question" onSubmit={createQuestion} />
        <div className="rounded-[28px] border border-white/70 bg-white/82 p-4 shadow-[0_16px_44px_rgba(20,20,20,0.08)] backdrop-blur-xl">
          <div className="mb-2 flex items-center gap-2">
            <Upload className="h-4 w-4" />
            <h2 className="font-black">Quick Paste Import</h2>
          </div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-black/45">
            question_text, option_a, option_b, option_c, option_d, correct_option, explanation, amharic_question, amharic_a, amharic_b, amharic_c, amharic_d, amharic_explanation
          </p>
          <textarea
            value={csv}
            onChange={(event) => setCsv(event.target.value)}
            className="min-h-40 w-full rounded-2xl border border-black/15 p-3 text-sm"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={parseCsvDrafts}
              className="min-h-11 rounded-[16px] border border-black/12 bg-white px-4 text-sm font-black uppercase"
            >
              Review Rows
            </button>
            <button
              type="button"
              onClick={importCsvDrafts}
              className="min-h-11 rounded-[16px] bg-black px-4 text-sm font-black uppercase text-white"
            >
              Import Reviewed Rows
            </button>
          </div>
          <p className="mt-3 text-xs font-bold text-black/50">
            Parsed rows now go through a review queue first. Amharic columns are optional; empty translated fields fall back to English.
          </p>
        </div>
      </div>

      {csvDrafts.length > 0 ? (
        <div className="mb-6">
          <QuestionDraftList
            drafts={csvDrafts}
            onChange={setCsvDrafts}
            title="CSV Review Queue"
            description="Edit, remove, reorder, or add pasted questions before importing them into this level."
            emptyMessage="Paste CSV rows above to build a review queue."
          />
        </div>
      ) : null}

      <div className="mb-6">
        <QuestionExtractor
          categoryId={params.id}
          levelId={params.levelId}
          onImported={() => refreshContent()}
        />
      </div>

      <div className="rounded-[28px] border border-white/70 bg-white/78 p-4 shadow-[0_16px_44px_rgba(20,20,20,0.08)] backdrop-blur-xl">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.16em] text-black/45">Saved Questions</div>
            <h2 className="text-2xl font-black">Live level question bank</h2>
          </div>
          <div className="rounded-full bg-black px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-honey">
            {questions.length} total
          </div>
        </div>
        <QuestionList questions={questions} onRefresh={refreshContent} />
      </div>
    </div>
  );
}
