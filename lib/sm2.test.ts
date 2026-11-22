import { describe, expect, it } from "vitest";

import {
  DEFAULT_EASE_FACTOR,
  MIN_EASE_FACTOR,
  calculateSm2,
  formatReviewInterval,
  getMasteryStatus,
  previewRatingIntervals,
  type ReviewRating,
  type SrsCardState,
} from "@/lib/sm2";

const FIXED_NOW = new Date("2026-11-22T12:00:00.000Z");

const NEW_CARD: SrsCardState = {
  ease_factor: DEFAULT_EASE_FACTOR,
  interval_days: 0,
  repetitions: 0,
};

describe("calculateSm2", () => {
  it("handles a new card across all 4 ratings", () => {
    const again = calculateSm2(NEW_CARD, 1, FIXED_NOW);
    expect(again).toEqual({
      ease_factor: 2.3,
      interval_days: 0,
      repetitions: 0,
      next_review_at: new Date("2026-11-22T12:10:00.000Z"),
      last_reviewed_at: FIXED_NOW,
    });

    const hard = calculateSm2(NEW_CARD, 2, FIXED_NOW);
    expect(hard).toEqual({
      ease_factor: 2.36,
      interval_days: 1,
      repetitions: 1,
      next_review_at: new Date("2026-11-23T12:00:00.000Z"),
      last_reviewed_at: FIXED_NOW,
    });

    const good = calculateSm2(NEW_CARD, 3, FIXED_NOW);
    expect(good).toEqual({
      ease_factor: 2.5,
      interval_days: 1,
      repetitions: 1,
      next_review_at: new Date("2026-11-23T12:00:00.000Z"),
      last_reviewed_at: FIXED_NOW,
    });

    const easy = calculateSm2(NEW_CARD, 4, FIXED_NOW);
    expect(easy).toEqual({
      ease_factor: 2.6,
      interval_days: 4,
      repetitions: 1,
      next_review_at: new Date("2026-11-26T12:00:00.000Z"),
      last_reviewed_at: FIXED_NOW,
    });
  });

  it("follows standard SM-2 progression across consecutive Good reviews", () => {
    const r1 = calculateSm2(NEW_CARD, 3, FIXED_NOW);
    expect(r1.interval_days).toBe(1);
    expect(r1.repetitions).toBe(1);

    const r2 = calculateSm2(r1, 3, FIXED_NOW);
    expect(r2.interval_days).toBe(6);
    expect(r2.repetitions).toBe(2);

    const r3 = calculateSm2(r2, 3, FIXED_NOW);
    expect(r3.interval_days).toBe(15);
    expect(r3.repetitions).toBe(3);

    const r4 = calculateSm2(r3, 3, FIXED_NOW);
    expect(r4.interval_days).toBe(38);
    expect(r4.repetitions).toBe(4);
    expect(r4.ease_factor).toBe(2.5);
  });

  it("handles Hard and Easy progression on rep=1 and rep>=2", () => {
    const rep1Card: SrsCardState = {
      ease_factor: 2.5,
      interval_days: 1,
      repetitions: 1,
    };

    const hardRep2 = calculateSm2(rep1Card, 2, FIXED_NOW);
    expect(hardRep2.interval_days).toBe(3);
    expect(hardRep2.repetitions).toBe(2);
    expect(hardRep2.ease_factor).toBe(2.36);

    const hardRep3 = calculateSm2(hardRep2, 2, FIXED_NOW);
    expect(hardRep3.interval_days).toBe(4);
    expect(hardRep3.repetitions).toBe(3);
    expect(hardRep3.ease_factor).toBe(2.22);

    const easyRep2 = calculateSm2(rep1Card, 4, FIXED_NOW);
    expect(easyRep2.interval_days).toBe(10);
    expect(easyRep2.repetitions).toBe(2);
    expect(easyRep2.ease_factor).toBe(2.6);

    const easyRep3 = calculateSm2(easyRep2, 4, FIXED_NOW);
    expect(easyRep3.interval_days).toBe(35);
    expect(easyRep3.repetitions).toBe(3);
    expect(easyRep3.ease_factor).toBe(2.7);
  });

  it("resets repetitions and interval when rating Again on a mature card", () => {
    const matureCard: SrsCardState = {
      ease_factor: 2.5,
      interval_days: 30,
      repetitions: 5,
    };

    const lapsed = calculateSm2(matureCard, 1, FIXED_NOW);
    expect(lapsed.repetitions).toBe(0);
    expect(lapsed.interval_days).toBe(0);
    expect(lapsed.ease_factor).toBe(2.3);
    expect(lapsed.next_review_at).toEqual(new Date("2026-11-22T12:10:00.000Z"));
  });

  it("never drops ease_factor below MIN_EASE_FACTOR (1.3)", () => {
    let state: SrsCardState = {
      ease_factor: 1.4,
      interval_days: 6,
      repetitions: 2,
    };

    state = calculateSm2(state, 1, FIXED_NOW);
    expect(state.ease_factor).toBe(MIN_EASE_FACTOR);

    state = calculateSm2(state, 1, FIXED_NOW);
    expect(state.ease_factor).toBe(MIN_EASE_FACTOR);

    state = calculateSm2(state, 2, FIXED_NOW);
    expect(state.ease_factor).toBe(MIN_EASE_FACTOR);
  });

  it("throws RangeError on invalid inputs", () => {
    expect(() => calculateSm2(NEW_CARD, 5 as ReviewRating, FIXED_NOW)).toThrow(
      RangeError,
    );
    expect(() => calculateSm2(NEW_CARD, 0 as ReviewRating, FIXED_NOW)).toThrow(
      RangeError,
    );
    expect(() =>
      calculateSm2(
        { ease_factor: 1.2, interval_days: 0, repetitions: 0 },
        3,
        FIXED_NOW,
      ),
    ).toThrow(RangeError);
    expect(() =>
      calculateSm2(
        { ease_factor: Number.NaN, interval_days: 0, repetitions: 0 },
        3,
        FIXED_NOW,
      ),
    ).toThrow(RangeError);
    expect(() =>
      calculateSm2(
        { ease_factor: 2.5, interval_days: -1, repetitions: 0 },
        3,
        FIXED_NOW,
      ),
    ).toThrow(RangeError);
    expect(() =>
      calculateSm2(
        { ease_factor: 2.5, interval_days: 1.5, repetitions: 0 },
        3,
        FIXED_NOW,
      ),
    ).toThrow(RangeError);
    expect(() =>
      calculateSm2(
        { ease_factor: 2.5, interval_days: 0, repetitions: -2 },
        3,
        FIXED_NOW,
      ),
    ).toThrow(RangeError);
    expect(() => calculateSm2(NEW_CARD, 3, new Date("invalid-date"))).toThrow(
      RangeError,
    );
  });
});

describe("formatReviewInterval & previewRatingIntervals", () => {
  it("formats minutes, days, months, and years concisely", () => {
    expect(formatReviewInterval(0)).toBe("<10m");
    expect(formatReviewInterval(1)).toBe("1d");
    expect(formatReviewInterval(6)).toBe("6d");
    expect(formatReviewInterval(29)).toBe("29d");
    expect(formatReviewInterval(30)).toBe("1mo");
    expect(formatReviewInterval(75)).toBe("3mo");
    expect(formatReviewInterval(365)).toBe("1y");
    expect(formatReviewInterval(438)).toBe("1.2y");
  });

  it("rejects negative or non-finite intervalDays", () => {
    expect(() => formatReviewInterval(-1)).toThrow(RangeError);
    expect(() => formatReviewInterval(Number.POSITIVE_INFINITY)).toThrow(
      RangeError,
    );
  });

  it("previews interval labels for all 4 buttons", () => {
    expect(previewRatingIntervals(NEW_CARD, FIXED_NOW)).toEqual({
      1: "<10m",
      2: "1d",
      3: "1d",
      4: "4d",
    });

    expect(
      previewRatingIntervals(
        { ease_factor: 2.5, interval_days: 10, repetitions: 2 },
        FIXED_NOW,
      ),
    ).toEqual({
      1: "<10m",
      2: "12d",
      3: "25d",
      4: "1mo",
    });
  });
});

describe("getMasteryStatus", () => {
  it("classifies new, learning, lapsed, and mastered cards accurately", () => {
    expect(getMasteryStatus(null)).toBe("new");
    expect(
      getMasteryStatus({
        repetitions: 0,
        interval_days: 0,
        last_reviewed_at: null,
      }),
    ).toBe("new");

    // Lapsed card (repetitions reset to 0 after having been reviewed)
    expect(
      getMasteryStatus({
        repetitions: 0,
        interval_days: 0,
        last_reviewed_at: "2026-11-22T10:00:00.000Z",
      }),
    ).toBe("learning");

    expect(
      getMasteryStatus({
        repetitions: 2,
        interval_days: 6,
        last_reviewed_at: "2026-11-22T10:00:00.000Z",
      }),
    ).toBe("learning");

    expect(
      getMasteryStatus({
        repetitions: 3,
        interval_days: 20,
        last_reviewed_at: "2026-11-22T10:00:00.000Z",
      }),
    ).toBe("learning");

    expect(
      getMasteryStatus({
        repetitions: 3,
        interval_days: 21,
        last_reviewed_at: "2026-11-22T10:00:00.000Z",
      }),
    ).toBe("mastered");
  });
});
