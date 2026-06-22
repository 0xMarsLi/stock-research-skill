import { z } from "zod";

/**
 * Position + lots model. Defined now to lock the cost-basis decision
 * (average cost + retained lots), but NOT wired into the Research flow.
 * Used by the future Trade Journal / Position Review flows.
 */

export const LotSchema = z.object({
  date: z.string(),
  quantity: z.number().positive(),
  price: z.number().positive(),
});
export type Lot = z.infer<typeof LotSchema>;

export const PositionSchema = z.object({
  ticker: z.string(),
  status: z.enum(["open", "closed"]),
  quantity: z.number(),
  avgCost: z.number(),
  /** Retained buy lots — enables future FIFO/tax recompute without data loss. */
  lots: z.array(LotSchema),
  openDate: z.string(),
  strategy: z.string().optional(),
  source: z.string().optional().describe("e.g. research recommendation date/file"),
});
export type Position = z.infer<typeof PositionSchema>;
