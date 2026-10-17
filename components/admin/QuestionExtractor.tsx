"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FileText, Trash2, Upload } from "lucide-react";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { QuestionDraftList } from "@/components/admin/QuestionDraftList";
import { bulkImportRemoteQuestions, fetchRemoteContent } from "@/lib/admin-client";
import { inferQuestionDifficulty, normalizeDifficulty } from "@/lib/difficulty";
import { hasQuestionTranslation } from "@/lib/i18n";
import { visibleQuestionOptions } from "@/lib/utils";
import { useContentStore } from "@/store/contentStore";
import type { CategoryLevel, Difficulty, OptionKey, Question, QuestionFormValues, QuestionTranslation } from "@/lib/types";

type ExtractedQuestionDraft = QuestionFormValues & {
  difficulty: Difficulty;
  targetLevelId?: string;
  targetLevelLabel?: string;
};

const difficulties: Difficulty[] = ["easy", "medium", "hard"];

function normalizeAnswer(value: string | undefined, options?: Partial<Record<OptionKey, string>>): OptionKey {
  const normalized = value?.trim().toLowerCase().replace(/[^a-d]/g, "");
  const optionKey = normalized === "b" || normalized === "c" || normalized === "d" ? normalized : "a";

  return options && !options[optionKey]?.trim() ? "a" : optionKey;
}

function stripDifficulty(draft: ExtractedQuestionDraft): QuestionFormValues {
  return {
    questionText: draft.questionText,
    optionA: draft.optionA,
    optionB: draft.optionB,
    optionC: draft.optionC,
    optionD: draft.optionD,
    correctOption: draft.correctOption,
    explanation: draft.explanation,
    translations: draft.translations ?? {},
    mediaUrl: draft.mediaUrl,
    isActive: draft.isActive
  };
}

function buildTranslation(values: Partial<QuestionTranslation>) {
  const cleaned: Partial<QuestionTranslation> = {
    questionText: values.questionText?.trim() ?? "",
    optionA: values.optionA?.trim() ?? "",
    optionB: values.optionB?.trim() ?? "",
    optionC: values.optionC?.trim() ?? "",
    optionD: values.optionD?.trim() ?? "",
    explanation: values.explanation?.trim() ?? ""
  };

  return Object.values(cleaned).some(Boolean) ? cleaned : null;
}

function parseDelimitedLine(line: string): Omit<ExtractedQuestionDraft, "targetLevelId" | "targetLevelLabel"> | null {
  const delimiter = line.includes("|") ? "|" : ",";
  const parts = line.split(delimiter).map((part) => part.trim());

  if (parts.filter(Boolean).length < 6) {
    return null;
  }

  const difficultyFromSeventh = normalizeDifficulty(parts[6]);
  const difficultyFromEighth = normalizeDifficulty(parts[7]);
  const difficulty = difficultyFromSeventh ?? difficultyFromEighth ?? inferQuestionDifficulty(parts.join(" "));
  const explanationIndex = difficultyFromSeventh ? 7 : 6;
  const translationStartIndex = difficultyFromSeventh || difficultyFromEighth ? 8 : 7;
  const explanation = parts[explanationIndex] ?? "";
  const amharic = buildTranslation({
    questionText: parts[translationStartIndex],
    optionA: parts[translationStartIndex + 1],
    optionB: parts[translationStartIndex + 2],
    optionC: parts[translationStartIndex + 3],
    optionD: parts[translationStartIndex + 4],
    explanation: parts[translationStartIndex + 5]
  });

  return {
    questionText: parts[0],
    optionA: parts[1],
    optionB: parts[2],
    optionC: parts[3],
    optionD: parts[4],
    correctOption: normalizeAnswer(parts[5], {
      a: parts[1],
      b: parts[2],
      c: parts[3],
      d: parts[4]
    }),
    difficulty,
    explanation,
    translations: amharic ? { am: amharic } : {},
    mediaUrl: "",
    isActive: true
  };
}

function parseBlock(block: string): Omit<ExtractedQuestionDraft, "targetLevelId" | "targetLevelLabel"> | null {
  const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const values = new Map<string, string>();

  for (const line of lines) {
    const match = line.match(/^(question|q|a|b|c|d|answer|correct|difficulty|hardness|level|explanation|explain|amharic question|amharic q|question amharic|q amharic|amharic a|a amharic|amharic b|b amharic|amharic c|c amharic|amharic d|d amharic|amharic explanation|explanation amharic|amharic explain|explain amharic)\s*[:.)-]\s*(.+)$/i);
    if (match) {
      values.set(match[1].toLowerCase(), match[2].trim());
    }
  }

  const questionText = values.get("question") ?? values.get("q") ?? lines[0];
  const optionA = values.get("a");
  const optionB = values.get("b");
  const optionC = values.get("c");
  const optionD = values.get("d");
  const explanation = values.get("explanation") ?? values.get("explain") ?? "";
  const amharic = buildTranslation({
    questionText: values.get("amharic question") ?? values.get("amharic q") ?? values.get("question amharic") ?? values.get("q amharic"),
    optionA: values.get("amharic a") ?? values.get("a amharic"),
    optionB: values.get("amharic b") ?? values.get("b amharic"),
    optionC: values.get("amharic c") ?? values.get("c amharic"),
    optionD: values.get("amharic d") ?? values.get("d amharic"),
    explanation:
      values.get("amharic explanation") ??
      values.get("explanation amharic") ??
      values.get("amharic explain") ??
      values.get("explain amharic")
  });

  if (!questionText || !optionA || !optionB) {
    return null;
  }

  return {
    questionText,
    optionA,
    optionB,
    optionC: optionC ?? "",
    optionD: optionD ?? "",
    correctOption: normalizeAnswer(values.get("answer") ?? values.get("correct"), {
      a: optionA,
      b: optionB,
      c: optionC,
      d: optionD
    }),
    difficulty:
      normalizeDifficulty(values.get("difficulty") ?? values.get("hardness") ?? values.get("level")) ??
      inferQuestionDifficulty(`${questionText} ${explanation}`),
    explanation,
    translations: amharic ? { am: amharic } : {},
    mediaUrl: "",
    isActive: true
  };
}

export function extractQuestionsFromText(text: string): ExtractedQuestionDraft[] {
  const delimited = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseDelimitedLine)
    .filter((question): question is Omit<ExtractedQuestionDraft, "targetLevelId" | "targetLevelLabel"> => question !== null);

  const extracted = delimited.length > 0
    ? delimited
    : text
        .split(/\n\s*\n/g)
        .map((block) => block.trim())
        .filter(Boolean)
        .map(parseBlock)
        .filter((question): question is Omit<ExtractedQuestionDraft, "targetLevelId" | "targetLevelLabel"> => question !== null);

  return extracted.map((question) => ({ ...question }));
}

function skippedTargetSummary(drafts: ExtractedQuestionDraft[]) {
  const counts = difficulties
    .map((difficulty) => ({
      difficulty,
      count: drafts.filter((draft) => draft.difficulty === difficulty).length
    }))
    .filter((item) => item.count > 0);

  return counts.map((item) => `${item.count} ${item.difficulty}`).join(", ");
}

function assignTargets(
  drafts: ExtractedQuestionDraft[],
  levels: CategoryLevel[],
  questions: Question[]
): ExtractedQuestionDraft[] {
  const activeLevels = levels.filter((level) => level.isActive).sort((first, second) => first.levelNumber - second.levelNumber);
  const usageByLevel = new Map<string, number>();

  for (const question of questions) {
    if (!question.isActive) {
      continue;
    }

    usageByLevel.set(question.levelId, (usageByLevel.get(question.levelId) ?? 0) + 1);
  }

  return drafts.map((draft) => {
    const matchingLevels = activeLevels.filter((level) => level.difficulty === draft.difficulty);

    if (matchingLevels.length === 0) {
      return { ...draft, targetLevelId: undefined, targetLevelLabel: `No active ${draft.difficulty} level` };
    }

    const target = matchingLevels.find((level) => (usageByLevel.get(level.id) ?? 0) < level.questionCount);

    if (!target) {
      return { ...draft, targetLevelId: undefined, targetLevelLabel: `Create more ${draft.difficulty} levels` };
    }

    usageByLevel.set(target.id, (usageByLevel.get(target.id) ?? 0) + 1);

    return {
      ...draft,
      targetLevelId: target.id,
      targetLevelLabel: `Level ${target.levelNumber}: ${target.title}`
    };
  });
}

function CategoryDraftReview({
  drafts,
  onChange
}: {
  drafts: ExtractedQuestionDraft[];
  onChange: (drafts: ExtractedQuestionDraft[]) => void;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const totalPages = Math.max(1, Math.ceil(drafts.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const visibleDrafts = drafts.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function updateDraft(index: number, values: Partial<ExtractedQuestionDraft>) {
    onChange(drafts.map((draft, draftIndex) => (draftIndex === index ? { ...draft, ...values } : draft)));
  }

  function removeDraft(index: number) {
    onChange(drafts.filter((_, draftIndex) => draftIndex !== index));
  }

  return (
    <div className="rounded-[28px] border border-white/70 bg-white/82 p-4 shadow-[0_16px_44px_rgba(20,20,20,0.08)] backdrop-blur-xl">
      <div>
        <div className="text-xs font-black uppercase tracking-[0.16em] text-black/45">Category Review Queue</div>
        <p className="mt-2 max-w-3xl text-sm font-bold text-black/58">
          Review the detected difficulty and destination level before importing. Question text and answers can still be edited later from the level question page.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {visibleDrafts.map((draft, visibleIndex) => {
          const draftIndex = startIndex + visibleIndex;
          const answerOptions = visibleQuestionOptions(draft);

          return (
            <div key={`${draft.questionText}-${draftIndex}`} className="rounded-[24px] border border-black/10 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-black uppercase text-black/45">Draft {draftIndex + 1}</div>
                  <h3 className="mt-1 text-lg font-black">{draft.questionText || "Untitled question"}</h3>
                  <div className="mt-2 grid gap-2 text-sm font-bold text-black/58 md:grid-cols-2">
                    {answerOptions.map((option) => (
                      <span key={option.key}>{option.label}. {option.text}</span>
                    ))}
                  </div>
                  <div className="mt-2 text-xs font-black uppercase text-black/45">
                    Correct: {draft.correctOption.toUpperCase()} | Target: {draft.targetLevelLabel}
                    {hasQuestionTranslation(draft, "am") ? " | Amharic ready" : ""}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <select
                    value={draft.difficulty}
                    onChange={(event) => updateDraft(draftIndex, { difficulty: event.target.value as Difficulty })}
                    className="h-10 rounded-md border border-black/10 px-3 text-sm font-black capitalize"
                  >
                    {difficulties.map((difficulty) => (
                      <option key={difficulty} value={difficulty}>
                        {difficulty}
                      </option>
                    ))}
                  </select>
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
            </div>
          );
        })}
      </div>

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
        pageSizeOptions={[8, 16, 24, 40]}
      />
    </div>
  );
}

export function QuestionExtractor({
  categoryId: fixedCategoryId,
  levelId: fixedLevelId,
  onImported
}: {
  categoryId?: string;
  levelId?: string;
  onImported?: () => Promise<void> | void;
}) {
  const categories = useContentStore((state) => state.categories);
  const levels = useContentStore((state) => state.levels);
  const questions = useContentStore((state) => state.questions);
  const replaceContent = useContentStore((state) => state.replaceContent);
  const [categoryId, setCategoryId] = useState(fixedCategoryId ?? categories[0]?.id ?? "");
  const categoryLevels = levels
    .filter((level) => level.categoryId === categoryId)
    .sort((first, second) => first.levelNumber - second.levelNumber);
  const [levelId, setLevelId] = useState(fixedLevelId ?? categoryLevels[0]?.id ?? "");
  const [rawText, setRawText] = useState("");
  const [preview, setPreview] = useState<ExtractedQuestionDraft[]>([]);
  const categoryImportMode = !fixedLevelId;
  const assignedPreview = useMemo(
    () => (categoryImportMode ? assignTargets(preview, categoryLevels, questions) : preview),
    [categoryImportMode, categoryLevels, preview, questions]
  );
  const summary = difficulties.map((difficulty) => ({
    difficulty,
    count: assignedPreview.filter((draft) => draft.difficulty === difficulty).length,
    levels: categoryLevels.filter((level) => level.isActive && level.difficulty === difficulty)
  }));

  useEffect(() => {
    if (fixedCategoryId) {
      setCategoryId(fixedCategoryId);
      return;
    }

    if (!categoryId && categories[0]?.id) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId, fixedCategoryId]);

  useEffect(() => {
    if (fixedLevelId) {
      setLevelId(fixedLevelId);
      return;
    }

    if (!categoryLevels.some((level) => level.id === levelId)) {
      setLevelId(categoryLevels[0]?.id ?? "");
    }
  }, [categoryLevels, fixedLevelId, levelId]);

  function parseNow(text = rawText) {
    const extracted = extractQuestionsFromText(text);
    setPreview(extracted);

    if (extracted.length === 0) {
      toast.error("No questions found. Use CSV, pipe-separated rows, or Q/A/B/C/D blocks.");
      return;
    }

    toast.success(`${extracted.length} questions extracted`);
  }

  async function readFile(file: File) {
    if (file.name.toLowerCase().endsWith(".docx")) {
      const mammoth = await import("mammoth/mammoth.browser");
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      setRawText(result.value);
      parseNow(result.value);
      return;
    }

    const text = await file.text();
    setRawText(text);
    parseNow(text);
  }

  async function refreshAfterImport(message: string) {
    if (onImported) {
      await onImported();
    } else {
      const content = await fetchRemoteContent();
      replaceContent(content);
    }

    toast.success(message);
    setPreview([]);
    setRawText("");
  }

  async function importPreview() {
    if (preview.length === 0) {
      parseNow();
      return;
    }

    try {
      if (!categoryImportMode) {
        if (!levelId) {
          toast.error("Choose a level first");
          return;
        }

        await bulkImportRemoteQuestions(levelId, preview.map(stripDifficulty));
        await refreshAfterImport(`${preview.length} questions imported`);
        return;
      }

      // Capacity must be calculated from the database immediately before import.
      // The Zustand/localStorage snapshot may still contain questions deleted in
      // another admin page or browser tab, which would make every level look full.
      const freshContent = await fetchRemoteContent();
      replaceContent(freshContent);
      const freshCategoryLevels = freshContent.levels
        .filter((level) => level.categoryId === categoryId)
        .sort((first, second) => first.levelNumber - second.levelNumber);
      const freshAssignedPreview = assignTargets(preview, freshCategoryLevels, freshContent.questions);
      const assigned = freshAssignedPreview.filter(
        (draft): draft is ExtractedQuestionDraft & { targetLevelId: string } => Boolean(draft.targetLevelId)
      );
      const unassigned = freshAssignedPreview.filter((draft) => !draft.targetLevelId);

      if (assigned.length === 0) {
        const summaryText = skippedTargetSummary(unassigned);
        toast.error(
          `No questions imported. ${unassigned.length} question(s) have no active target${summaryText ? `: ${summaryText}` : ""}. Create more active levels or increase question counts.`
        );
        return;
      }

      const grouped = new Map<string, QuestionFormValues[]>();
      for (const draft of assigned) {
        grouped.set(draft.targetLevelId, [...(grouped.get(draft.targetLevelId) ?? []), stripDifficulty(draft)]);
      }

      await Promise.all(Array.from(grouped.entries()).map(([targetLevelId, questions]) => bulkImportRemoteQuestions(targetLevelId, questions)));
      const skippedMessage = unassigned.length > 0
        ? ` ${unassigned.length} skipped/discarded (${skippedTargetSummary(unassigned)}). Create more active levels or increase question counts for those difficulties.`
        : "";
      await refreshAfterImport(`${assigned.length} question(s) imported across ${grouped.size} level(s).${skippedMessage}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to import questions.");
    }
  }

  return (
    <div className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <FileText className="h-5 w-5" />
        <h2 className="text-xl font-black">Question Extractor</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-bold">
          Category
          <select
            value={categoryId}
            onChange={(event) => {
              const nextCategoryId = event.target.value;
              const nextLevels = levels.filter((level) => level.categoryId === nextCategoryId);
              setCategoryId(nextCategoryId);
              setLevelId(nextLevels[0]?.id ?? "");
              setPreview([]);
            }}
            className="h-11 rounded-md border border-black/15 px-3"
            disabled={Boolean(fixedCategoryId)}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.title}
              </option>
            ))}
          </select>
        </label>
        {!categoryImportMode ? (
          <label className="grid gap-1 text-sm font-bold">
            Level
            <select
              value={levelId}
              onChange={(event) => setLevelId(event.target.value)}
              className="h-11 rounded-md border border-black/15 px-3"
              disabled={Boolean(fixedLevelId)}
            >
              {categoryLevels.map((level) => (
                <option key={level.id} value={level.id}>
                  Level {level.levelNumber}: {level.title}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="rounded-md bg-black/5 p-3 text-xs font-bold text-black/58">
            Category upload assigns questions to active levels by difficulty. Default split: levels 1-5 easy, 6-15 medium, 16-20 hard.
          </div>
        )}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_300px]">
        <textarea
          value={rawText}
          onChange={(event) => setRawText(event.target.value)}
          placeholder={"Q: Which planet is red?\nA: Mars\nB: Venus\nC: Jupiter\nD: Mercury\nAnswer: A\nDifficulty: Easy\nExplanation: Mars is called the red planet."}
          className="min-h-64 rounded-md border border-black/15 p-3 text-sm"
        />
        <div className="space-y-3">
          <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-black/20 bg-black/5 p-4 text-center text-sm font-bold">
            <Upload className="mb-2 h-5 w-5" />
            Upload .txt or .docx
            <input
              type="file"
              accept=".txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void readFile(file);
                }
              }}
            />
          </label>
          <button type="button" onClick={() => parseNow()} className="min-h-11 w-full rounded-md border border-black/15 px-4 text-sm font-black uppercase">
            Extract To Review Queue
          </button>
          <button type="button" onClick={importPreview} className="min-h-11 w-full rounded-md bg-black px-4 text-sm font-black uppercase text-white">
            {categoryImportMode ? "Import To Assigned Levels" : "Import Reviewed Questions"}
          </button>
          <div className="rounded-md bg-black/5 p-3 text-xs font-bold text-black/55">
            Template: Question | A | B | C | D | Answer | Difficulty | Explanation | Amharic Question | Amharic A | Amharic B | Amharic C | Amharic D | Amharic Explanation. Difficulty and translations are optional.
            <a href="/question-import-template.txt" className="mt-2 block font-black text-black underline">
              Open import template
            </a>
          </div>
        </div>
      </div>
      {preview.length > 0 ? (
        <div className="mt-4 space-y-4">
          {categoryImportMode ? (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                {summary.map((item) => (
                  <div key={item.difficulty} className="rounded-2xl border border-black/10 bg-black/[0.03] p-4">
                    <div className="text-xs font-black uppercase text-black/45">{item.difficulty}</div>
                    <div className="mt-1 text-2xl font-black">{item.count}</div>
                    <div className="mt-1 text-xs font-bold text-black/50">
                      {item.levels.length > 0
                        ? item.levels.map((level) => `L${level.levelNumber}`).join(", ")
                        : "No active levels"}
                    </div>
                  </div>
                ))}
              </div>
              <CategoryDraftReview drafts={assignedPreview} onChange={setPreview} />
            </>
          ) : (
            <QuestionDraftList
              drafts={preview.map(stripDifficulty)}
              onChange={(drafts) =>
                setPreview(
                  drafts.map((draft, index) => ({
                    ...draft,
                    difficulty: preview[index]?.difficulty ?? "easy"
                  }))
                )
              }
              title="Extractor Review Queue"
              description="Every extracted question is editable before it is imported into the selected level."
              emptyMessage="Extract text or upload a file to start reviewing questions."
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
