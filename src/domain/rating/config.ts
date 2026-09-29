import { z } from "zod";

/**
 * Rating engine configuration (spec §11, §12, §13, §15, §77, §99).
 * Stored per club in clubs.settings.rating; this is the schema + defaults.
 */
export const ratingConfigSchema = z.object({
  algorithm: z.literal("RTTF_LIKE"),
  version: z.number().int().positive(),
  /** Ordered bands: first band whose `max` is null or > avgRating wins. */
  k_by_avg_rating: z
    .array(z.object({ max: z.number().nullable(), k: z.number().positive() }))
    .min(1),
  /** k used for CHALLENGE matches (no tournament average). Open decision from spec review. */
  challenge_k: z.number().positive(),
  /** D by set score "winnerSets:loserSets". */
  d_by_sets: z.record(z.string(), z.number().positive()),
  /** Winner ahead by >= threshold → delta 0 (spec §13). */
  big_gap_threshold: z.number().positive(),
  /** Player is newcomer (PROVISIONAL) while tournament_count <= this value (spec §15). */
  newcomer_tournaments: z.number().int().nonnegative(),
  newcomer_win_k: z.number().positive(),
  newcomer_loss_k: z.number().positive(),
  newcomer_initial_step: z.number().int().positive(),
  newcomer_initial_min: z.number().int().positive(),
  rounding: z.enum(["HALF_UP_INTEGER", "DECIMAL_2"]),
  rated_match_types: z.array(z.enum(["TOURNAMENT", "CHALLENGE", "CASUAL"])),
  external_seed_policy: z.enum(["USE_VERIFIED_AS_PROVISIONAL", "REFERENCE_ONLY"]),
});

export type RatingConfig = z.infer<typeof ratingConfigSchema>;

export const DEFAULT_RATING_CONFIG: RatingConfig = {
  algorithm: "RTTF_LIKE",
  version: 1,
  k_by_avg_rating: [
    { max: 250, k: 0.2 },
    { max: 350, k: 0.25 },
    { max: 450, k: 0.3 },
    { max: 550, k: 0.35 },
    { max: null, k: 0.4 },
  ],
  challenge_k: 0.3,
  d_by_sets: { "3:2": 0.8, "2:1": 0.8, "3:1": 1.0, "2:0": 1.0, "3:0": 1.2 },
  big_gap_threshold: 100,
  newcomer_tournaments: 5,
  newcomer_win_k: 1.0,
  newcomer_loss_k: 0.5,
  newcomer_initial_step: 25,
  newcomer_initial_min: 100,
  rounding: "HALF_UP_INTEGER",
  rated_match_types: ["TOURNAMENT", "CHALLENGE"],
  external_seed_policy: "USE_VERIFIED_AS_PROVISIONAL",
};

/** Parse clubs.settings → RatingConfig, falling back to defaults for missing keys. */
export function parseRatingConfig(settings: unknown): RatingConfig {
  const raw =
    settings && typeof settings === "object" && "rating" in settings
      ? (settings as { rating: unknown }).rating
      : undefined;
  return ratingConfigSchema.parse({ ...DEFAULT_RATING_CONFIG, ...(raw as object) });
}
