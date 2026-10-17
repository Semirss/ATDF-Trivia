import { z } from "zod";

export const donationInputSchema = z.object({
  amount: z.coerce.number().min(10).max(100000),
  playerId: z.string().optional().nullable(),
  donorName: z.string().trim().max(80).optional().nullable(),
  donorEmail: z.string().trim().email().max(120).optional().or(z.literal("")).nullable(),
  donorPhone: z.string().trim().max(40).optional().or(z.literal("")).nullable()
});

