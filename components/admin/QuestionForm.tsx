"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AssetUploader } from "@/components/admin/AssetUploader";
import { normalizeQuestionTranslations, supportedLanguages } from "@/lib/i18n";
import { visibleQuestionOptions } from "@/lib/utils";
import { questionFormSchema } from "@/lib/validators";
import type { OptionKey, Question, QuestionFormValues, QuestionTranslation } from "@/lib/types";

export const defaultQuestionFormValues: QuestionFormValues = {
  questionText: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correctOption: "a",
  explanation: "",
  translations: {},
  mediaUrl: "",
  isActive: true
};

const translationLanguages = supportedLanguages.filter((language) => language.code !== "en");

export function QuestionForm({
  question,
  initialValues,
  submitLabel,
  onSubmit
}: {
  question?: Question;
  initialValues?: QuestionFormValues;
  submitLabel: string;
  onSubmit: (values: QuestionFormValues) => void;
}) {
  const [values, setValues] = useState<QuestionFormValues>(
    question
      ? {
          questionText: question.questionText,
          optionA: question.optionA,
          optionB: question.optionB,
          optionC: question.optionC,
          optionD: question.optionD,
          correctOption: question.correctOption,
          explanation: question.explanation ?? "",
          translations: question.translations ?? {},
          mediaUrl: question.mediaUrl ?? "",
          isActive: question.isActive
        }
      : initialValues ?? { ...defaultQuestionFormValues }
  );

  useEffect(() => {
    if (question) {
      setValues({
        questionText: question.questionText,
        optionA: question.optionA,
        optionB: question.optionB,
        optionC: question.optionC,
        optionD: question.optionD,
        correctOption: question.correctOption,
        explanation: question.explanation ?? "",
        translations: question.translations ?? {},
        mediaUrl: question.mediaUrl ?? "",
        isActive: question.isActive
      });
      return;
    }

    setValues(initialValues ?? { ...defaultQuestionFormValues });
  }, [initialValues, question]);

  function setValue<Key extends keyof QuestionFormValues>(key: Key, value: QuestionFormValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function setTranslationValue(language: string, key: keyof QuestionTranslation, value: string) {
    setValues((current) => ({
      ...current,
      translations: {
        ...current.translations,
        [language]: {
          ...current.translations[language],
          [key]: value
        }
      }
    }));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = questionFormSchema.safeParse({
      ...values,
      translations: normalizeQuestionTranslations(values.translations)
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the question fields");
      return;
    }

    onSubmit(parsed.data);
    if (!question && !initialValues) {
      setValues({ ...defaultQuestionFormValues });
    }
  }

  const previewOptions = visibleQuestionOptions(values);

  return (
    <form onSubmit={submit} className="rounded-[28px] border border-black/10 bg-white p-5 shadow-sm">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="grid gap-4">
          <label className="grid gap-1 text-sm font-bold">
          Question
            <textarea className="min-h-28 rounded-2xl border border-black/15 p-3" value={values.questionText} onChange={(event) => setValue("questionText", event.target.value)} />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            {(["A", "B", "C", "D"] as const).map((label) => {
              const key = `option${label}` as keyof Pick<QuestionFormValues, "optionA" | "optionB" | "optionC" | "optionD">;
              return (
                <label key={label} className="grid gap-1 text-sm font-bold">
                  Option {label}
                  <input className="h-11 rounded-xl border border-black/15 px-3" value={values[key]} onChange={(event) => setValue(key, event.target.value)} />
                </label>
              );
            })}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-bold">
              Correct answer
              <select className="h-11 rounded-xl border border-black/15 px-3" value={values.correctOption} onChange={(event) => setValue("correctOption", event.target.value as OptionKey)}>
                <option value="a">A</option>
                <option value="b">B</option>
                <option value="c">C</option>
                <option value="d">D</option>
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-3 text-sm font-bold">
              <input type="checkbox" checked={values.isActive} onChange={(event) => setValue("isActive", event.target.checked)} />
              Active in gameplay
            </label>
          </div>
          <label className="grid gap-1 text-sm font-bold">
            Explanation
            <textarea className="min-h-24 rounded-2xl border border-black/15 p-3" value={values.explanation} onChange={(event) => setValue("explanation", event.target.value)} />
          </label>
          {translationLanguages.map((language) => {
            const translation = values.translations[language.code] ?? {};

            return (
              <section key={language.code} className="rounded-2xl border border-black/10 bg-black/[0.025] p-4">
                <div className="mb-3">
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-black/45">
                    {language.label} translation
                  </div>
                  <p className="mt-1 text-xs font-bold text-black/50">
                    Optional. Empty fields fall back to the English version in gameplay.
                  </p>
                </div>
                <div className="grid gap-3">
                  <label className="grid gap-1 text-sm font-bold">
                    Question ({language.nativeLabel})
                    <textarea
                      className="min-h-24 rounded-2xl border border-black/15 bg-white p-3"
                      value={translation.questionText ?? ""}
                      onChange={(event) => setTranslationValue(language.code, "questionText", event.target.value)}
                    />
                  </label>
                  <div className="grid gap-3 md:grid-cols-2">
                    {(["A", "B", "C", "D"] as const).map((label) => {
                      const key = `option${label}` as keyof Pick<QuestionTranslation, "optionA" | "optionB" | "optionC" | "optionD">;
                      return (
                        <label key={label} className="grid gap-1 text-sm font-bold">
                          Option {label} ({language.nativeLabel})
                          <input
                            className="h-11 rounded-xl border border-black/15 bg-white px-3"
                            value={translation[key] ?? ""}
                            onChange={(event) => setTranslationValue(language.code, key, event.target.value)}
                          />
                        </label>
                      );
                    })}
                  </div>
                  <label className="grid gap-1 text-sm font-bold">
                    Explanation ({language.nativeLabel})
                    <textarea
                      className="min-h-20 rounded-2xl border border-black/15 bg-white p-3"
                      value={translation.explanation ?? ""}
                      onChange={(event) => setTranslationValue(language.code, "explanation", event.target.value)}
                    />
                  </label>
                </div>
              </section>
            );
          })}
        </div>
        <div className="grid gap-4">
          <AssetUploader
            label="Question image"
            value={values.mediaUrl}
            folder="questions/media"
            description="Drop in an image from any device or paste a public asset URL."
            onChange={(nextValue) => setValue("mediaUrl", nextValue)}
          />
          <div className="rounded-2xl border border-black/10 bg-black/[0.03] p-4">
            <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-black/45">Quick review</div>
            <div className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
              <div className="text-base font-black">{values.questionText || "Question preview"}</div>
              {previewOptions.length > 0 ? (
                <div className="grid gap-2 text-sm font-bold text-black/65">
                  {previewOptions.map((option) => (
                    <div key={option.key} className={values.correctOption === option.key ? "text-emerald-700" : ""}>
                      {option.label}. {option.text}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <button type="submit" className="mt-5 min-h-12 rounded-xl bg-black px-5 text-sm font-black uppercase text-white">
        {submitLabel}
      </button>
    </form>
  );
}
