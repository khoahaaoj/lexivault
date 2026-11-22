export const MIN_EASE_FACTOR = 1.3;
export const DEFAULT_EASE_FACTOR = 2.5;
export const AGAIN_DELAY_MINUTES = 10;
export const REVIEW_RATINGS = [1, 2, 3, 4] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ReviewRating = (typeof REVIEW_RATINGS)[number];

export type SrsCardState = {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
};

export type Sm2Result = SrsCardState & {
  next_review_at: Date;
  last_reviewed_at: Date;
};

export type MasteryStatus = "new" | "learning" | "mastered";

function clampAndRoundEase(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return Math.max(MIN_EASE_FACTOR, rounded);
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * DAY_MS);
}

function assertValidInput(
  card: SrsCardState,
  rating: ReviewRating,
  now: Date,
): void {
  if (!REVIEW_RATINGS.includes(rating)) {
    throw new RangeError(
      `Invalid SM-2 rating "${String(rating)}". Expected 1, 2, 3, or 4.`,
    );
  }
  if (
    !Number.isFinite(card.ease_factor) ||
    card.ease_factor < MIN_EASE_FACTOR
  ) {
    throw new RangeError(
      `ease_factor must be a finite number >= ${MIN_EASE_FACTOR}, received ${card.ease_factor}.`,
    );
  }
  if (!Number.isInteger(card.interval_days) || card.interval_days < 0) {
    throw new RangeError(
      `interval_days must be a non-negative integer, received ${card.interval_days}.`,
    );
  }
  if (!Number.isInteger(card.repetitions) || card.repetitions < 0) {
    throw new RangeError(
      `repetitions must be a non-negative integer, received ${card.repetitions}.`,
    );
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new RangeError("now must be a valid Date instance.");
  }
}

/**
 * Pure SM-2 spaced repetition calculation supporting 4 ratings:
 * - `1` Again: resets repetitions and interval, schedules retry in 10 minutes
 * - `2` Hard: minor ease penalty, conservative interval growth
 * - `3` Good: standard SM-2 schedule (`1d -> 6d -> interval * EF`)
 * - `4` Easy: ease bonus and accelerated interval growth
 */
export function calculateSm2(
  card: SrsCardState,
  rating: ReviewRating,
  now: Date = new Date(),
): Sm2Result {
  assertValidInput(card, rating, now);

  const lastReviewedAt = new Date(now.getTime());

  if (rating === 1) {
    return {
      ease_factor: clampAndRoundEase(card.ease_factor - 0.2),
      interval_days: 0,
      repetitions: 0,
      next_review_at: new Date(now.getTime() + AGAIN_DELAY_MINUTES * 60_000),
      last_reviewed_at: lastReviewedAt,
    };
  }

  let nextEase = card.ease_factor;
  if (rating === 2) {
    nextEase = clampAndRoundEase(card.ease_factor - 0.14);
  } else if (rating === 4) {
    nextEase = clampAndRoundEase(card.ease_factor + 0.1);
  } else {
    nextEase = clampAndRoundEase(card.ease_factor);
  }

  const nextRepetitions = card.repetitions + 1;
  let nextIntervalDays: number;

  if (rating === 2) {
    if (card.repetitions === 0) {
      nextIntervalDays = 1;
    } else if (card.repetitions === 1) {
      nextIntervalDays = 3;
    } else {
      nextIntervalDays = Math.max(
        card.interval_days + 1,
        Math.round(card.interval_days * 1.2),
      );
    }
  } else if (rating === 3) {
    if (card.repetitions === 0) {
      nextIntervalDays = 1;
    } else if (card.repetitions === 1) {
      nextIntervalDays = 6;
    } else {
      nextIntervalDays = Math.max(
        card.interval_days + 1,
        Math.round(card.interval_days * nextEase),
      );
    }
  } else {
    if (card.repetitions === 0) {
      nextIntervalDays = 4;
    } else if (card.repetitions === 1) {
      nextIntervalDays = 10;
    } else {
      nextIntervalDays = Math.max(
        Math.round(card.interval_days * nextEase) + 1,
        Math.round(card.interval_days * nextEase * 1.3),
      );
    }
  }

  return {
    ease_factor: nextEase,
    interval_days: nextIntervalDays,
    repetitions: nextRepetitions,
    next_review_at: addDays(now, nextIntervalDays),
    last_reviewed_at: lastReviewedAt,
  };
}

/**
 * Formats an interval in days into a compact label (`<10m`, `1d`, `6d`, `1mo`, `1.2y`).
 */
export function formatReviewInterval(intervalDays: number): string {
  if (!Number.isFinite(intervalDays) || intervalDays < 0) {
    throw new RangeError(
      `intervalDays must be a finite non-negative number, received ${intervalDays}.`,
    );
  }
  if (intervalDays === 0) {
    return `<${AGAIN_DELAY_MINUTES}m`;
  }
  if (intervalDays < 30) {
    return `${intervalDays}d`;
  }
  if (intervalDays < 365) {
    return `${Math.round(intervalDays / 30)}mo`;
  }
  return `${Number((intervalDays / 365).toFixed(1))}y`;
}

/**
 * Computes human-readable interval previews for all 4 SM-2 rating buttons.
 */
export function previewRatingIntervals(
  card: SrsCardState,
  now: Date = new Date(),
): Record<ReviewRating, string> {
  return {
    1: formatReviewInterval(calculateSm2(card, 1, now).interval_days),
    2: formatReviewInterval(calculateSm2(card, 2, now).interval_days),
    3: formatReviewInterval(calculateSm2(card, 3, now).interval_days),
    4: formatReviewInterval(calculateSm2(card, 4, now).interval_days),
  };
}

/**
 * Derives a card's mastery stage for Vault filtering and badges.
 */
export function getMasteryStatus(
  card: {
    repetitions: number;
    interval_days: number;
    last_reviewed_at: string | null;
  } | null,
): MasteryStatus {
  if (!card || (card.repetitions === 0 && card.last_reviewed_at === null)) {
    return "new";
  }
  if (card.repetitions >= 3 && card.interval_days >= 21) {
    return "mastered";
  }
  return "learning";
}
