import * as z from "@zod/zod";

export const createHighlightRequestZObj = z.object({
  id: z.uuidv4().optional(),
  bookId: z.uuidv4(),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
});

export const fetchHighlightRequestZObj = z.object({
  id: z.uuidv4(),
});

export const deleteHighlightRequestZObj = z.object({
  id: z.uuidv4(),
});

export type CreateHighlightRequest = z.infer<typeof createHighlightRequestZObj>;
export type FetchHighlightRequest = z.infer<typeof fetchHighlightRequestZObj>;
export type DeleteHighlightRequest = z.infer<typeof deleteHighlightRequestZObj>;
