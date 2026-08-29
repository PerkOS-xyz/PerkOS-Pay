import { z } from "zod";

export const creditPacks = {
  credits_10: { credits: 10, amountCents: 1000 },
  credits_25: { credits: 25, amountCents: 2500 },
  credits_50: { credits: 50, amountCents: 5000 },
  credits_100: { credits: 100, amountCents: 10000 },
} as const;

export const creditPackIdSchema = z.enum([
  "credits_10",
  "credits_25",
  "credits_50",
  "credits_100",
]);

export type CreditPackId = z.infer<typeof creditPackIdSchema>;

export function getCreditPack(value: unknown) {
  const id = creditPackIdSchema.parse(value);
  return { id, ...creditPacks[id] };
}
