"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { levelFormSchema } from "@/lib/validators";
import type { CategoryLevel, LevelFormValues } from "@/lib/types";

const defaults: LevelFormValues = {
  title: "",
  numberOfLevels: 1,
  difficulty: "easy",
  questionCount: 5,
  timeLimitSeconds: 30,
  pointsPerCorrect: 10,
  isActive: true
};

export function LevelForm({
  level,
  defaultDifficulty,
  submitLabel,
  onSubmit
}: {
  level?: CategoryLevel;
  defaultDifficulty?: LevelFormValues["difficulty"];
  submitLabel: string;
  onSubmit: (values: LevelFormValues) => void;
}) {
  const emptyValues = useMemo(
    () => ({ ...defaults, difficulty: defaultDifficulty ?? defaults.difficulty }),
    [defaultDifficulty]
  );
  const [values, setValues] = useState<LevelFormValues>(
    level
      ? {
          title: level.title,
          numberOfLevels: 1,
          difficulty: level.difficulty,
          questionCount: level.questionCount,
          timeLimitSeconds: level.timeLimitSeconds,
          pointsPerCorrect: level.pointsPerCorrect,
          isActive: level.isActive
        }
      : emptyValues
  );

  useEffect(() => {
    setValues(
      level
        ? {
            title: level.title,
            numberOfLevels: 1,
            difficulty: level.difficulty,
            questionCount: level.questionCount,
            timeLimitSeconds: level.timeLimitSeconds,
            pointsPerCorrect: level.pointsPerCorrect,
            isActive: level.isActive
          }
        : emptyValues
    );
  }, [defaultDifficulty, emptyValues, level]);

  function setValue<Key extends keyof LevelFormValues>(key: Key, value: LevelFormValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = levelFormSchema.safeParse(values);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the level fields");
      return;
    }

    onSubmit(parsed.data);
    if (!level) {
      setValues(emptyValues);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <div className="grid gap-4 md:grid-cols-7">
        <label className="grid gap-1 text-sm font-bold md:col-span-2">
          Title {(!values.numberOfLevels || values.numberOfLevels > 1) && "(Optional)"}
          <input className="h-11 rounded-md border border-black/15 px-3" value={values.title ?? ""} onChange={(event) => setValue("title", event.target.value)} disabled={values.numberOfLevels ? values.numberOfLevels > 1 : false} placeholder={values.numberOfLevels && values.numberOfLevels > 1 ? "Auto-generated" : ""} />
        </label>
        {!level && (
          <label className="grid gap-1 text-sm font-bold">
            Count
            <input className="h-11 rounded-md border border-black/15 px-3" type="number" min={1} max={50} value={values.numberOfLevels ?? 1} onChange={(event) => setValue("numberOfLevels", Number(event.target.value))} />
          </label>
        )}
        <label className={`grid gap-1 text-sm font-bold ${level ? "md:col-span-2" : ""}`}>
          Difficulty
          <select className="h-11 rounded-md border border-black/15 px-3 capitalize" value={values.difficulty} onChange={(event) => setValue("difficulty", event.target.value as LevelFormValues["difficulty"])}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-bold">
          Questions
          <input className="h-11 rounded-md border border-black/15 px-3" type="number" min={1} value={values.questionCount} onChange={(event) => setValue("questionCount", Number(event.target.value))} />
        </label>
        <label className="grid gap-1 text-sm font-bold">
          Seconds
          <input className="h-11 rounded-md border border-black/15 px-3" type="number" min={5} value={values.timeLimitSeconds} onChange={(event) => setValue("timeLimitSeconds", Number(event.target.value))} />
        </label>
        <label className="grid gap-1 text-sm font-bold">
          Points
          <input className="h-11 rounded-md border border-black/15 px-3" type="number" min={1} value={values.pointsPerCorrect} onChange={(event) => setValue("pointsPerCorrect", Number(event.target.value))} />
        </label>
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm font-bold">
        <input type="checkbox" checked={values.isActive} onChange={(event) => setValue("isActive", event.target.checked)} />
        Active
      </label>
      <button type="submit" className="mt-4 min-h-11 rounded-md bg-black px-4 text-sm font-black uppercase text-white">
        {submitLabel}
      </button>
    </form>
  );
}
