import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { OptionKey, Question } from "@/lib/types";

type QuestionOptionSource = Pick<Question, "optionA" | "optionB" | "optionC" | "optionD">;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function isUuid(value: string | null | undefined) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value ?? "");
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function shuffleArray<T>(items: T[]) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = copy[index];
    const swap = copy[swapIndex];
    copy[index] = swap;
    copy[swapIndex] = current;
  }

  return copy;
}

export function optionText(question: Question, key: OptionKey) {
  const options: Record<OptionKey, string> = {
    a: question.optionA,
    b: question.optionB,
    c: question.optionC,
    d: question.optionD
  };

  return options[key];
}

export function visibleQuestionOptions(question: QuestionOptionSource) {
  return ([
    { key: "a", label: "A", text: question.optionA },
    { key: "b", label: "B", text: question.optionB },
    { key: "c", label: "C", text: question.optionC },
    { key: "d", label: "D", text: question.optionD }
  ] satisfies Array<{ key: OptionKey; label: string; text: string }>).filter((option) => option.text.trim().length > 0);
}

export function hexToRgba(hex: string, alpha: number) {
  const safeHex = hex.replace("#", "");
  const numeric = Number.parseInt(safeHex.length === 3 ? safeHex.repeat(2) : safeHex, 16);
  const red = (numeric >> 16) & 255;
  const green = (numeric >> 8) & 255;
  const blue = numeric & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function percent(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
}
