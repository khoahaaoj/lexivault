import { z } from "zod";

import type { MasteryStatus } from "@/lib/sm2";
import type { EntryRow, SrsCardRow } from "@/types/database";

const blankToUndefined = (value: string | undefined): string | undefined => {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const submitReviewSchema = z.object({
  card_id: z.uuid({ error: "Invalid flashcard ID." }),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)], {
    error: "Rating must be 1 (Again), 2 (Hard), 3 (Good), or 4 (Easy).",
  }),
});

export const vaultQuerySchema = z.object({
  q: z
    .string()
    .optional()
    .transform(blankToUndefined)
    .pipe(
      z
        .string()
        .max(80, { error: "Search query must be 80 characters or fewer." })
        .optional(),
    ),
  cefr: z
    .string()
    .optional()
    .transform(blankToUndefined)
    .pipe(z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]).optional()),
  status: z
    .string()
    .optional()
    .transform(blankToUndefined)
    .pipe(z.enum(["new", "learning", "mastered"]).optional()),
});

export const entryIdParamSchema = z.uuid({ error: "Invalid entry ID." });

export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;
export type VaultQueryInput = z.infer<typeof vaultQuerySchema>;

export type DictionaryEntryView = Omit<EntryRow, "user_id">;
export type SrsCardView = Omit<SrsCardRow, "user_id" | "entry_id">;

export type ReviewCardItem = SrsCardView & {
  entry_id: string;
  entry: DictionaryEntryView;
};

export type ReviewQueueResponse = {
  due_count: number;
  total_cards: number;
  next_upcoming_at: string | null;
  cards: ReviewCardItem[];
};

export type ReviewSubmitResponse = SrsCardView & {
  entry_id: string;
  mastery_status: MasteryStatus;
};

export type VaultEntryItem = DictionaryEntryView & {
  srs_card: SrsCardView | null;
  mastery_status: MasteryStatus;
  is_due: boolean;
};

export type VaultCounts = {
  total: number;
  new: number;
  learning: number;
  mastered: number;
  due: number;
};

export type VaultListResponse = {
  counts: VaultCounts;
  items: VaultEntryItem[];
};
