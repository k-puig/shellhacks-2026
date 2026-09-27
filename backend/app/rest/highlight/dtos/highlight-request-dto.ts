import * as z from "@zod/zod";

export const createHighlightRequestZObj = z.object({
  bookId: z.uuidv4(),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
});

export const fetchHighlightRequestZObj = z.object({
  id: z.uuidv4(),
});

export const updateHighlightRequestZObj = z.object({
  id: z.uuidv4(),
  bookId: z.uuidv4().optional(),
  start: z.number().int().nonnegative().optional(),
  end: z.number().int().nonnegative().optional(),
});

export const deleteHighlightRequestZObj = z.object({
  id: z.uuidv4(),
});

export type CreateHighlightRequest = z.infer<typeof createHighlightRequestZObj>;
export type FetchHighlightRequest = z.infer<typeof fetchHighlightRequestZObj>;
export type UpdateHighlightRequest = z.infer<typeof updateHighlightRequestZObj>;
export type DeleteHighlightRequest = z.infer<typeof deleteHighlightRequestZObj>;
