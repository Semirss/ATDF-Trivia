import { z } from "zod";

const questionTranslationSchema = z.object({
  questionText: z.string().optional().default(""),
  optionA: z.string().optional().default(""),
  optionB: z.string().optional().default(""),
  optionC: z.string().optional().default(""),
  optionD: z.string().optional().default(""),
  explanation: z.string().optional().default("")
});

export const categoryFormSchema = z.object({
  title: z.string().min(2, "Title is required"),
  iconUrl: z.string().optional().default(""),
  difficulty: z.enum(["easy", "medium", "hard"]),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6 digit hex color"),
  isRewardBased: z.boolean(),
  isActive: z.boolean(),
  description: z.string().min(8, "Description is required"),
  cardBackgroundUrl: z.string().optional().default(""),
  mapBackgroundUrl: z.string().optional().default(""),
  levelPodiumUrl: z.string().optional().default("")
});

export const levelFormSchema = z.object({
  title: z.string().optional().default(""),
  numberOfLevels: z.coerce.number().int().min(1).max(50).optional().default(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
  questionCount: z.coerce.number().int().min(1).max(50),
  timeLimitSeconds: z.coerce.number().int().min(5).max(180),
  pointsPerCorrect: z.coerce.number().int().min(1).max(1000),
  isActive: z.boolean()
});

export const questionFormSchema = z.object({
  questionText: z.string().min(4, "Question is required"),
  optionA: z.string().min(1, "Option A is required"),
  optionB: z.string().min(1, "Option B is required"),
  optionC: z.string().optional().default(""),
  optionD: z.string().optional().default(""),
  correctOption: z.enum(["a", "b", "c", "d"]),
  explanation: z.string().optional().default(""),
  translations: z.record(questionTranslationSchema.partial()).optional().default({}),
  mediaUrl: z.string().optional().default(""),
  isActive: z.boolean().default(true)
});
