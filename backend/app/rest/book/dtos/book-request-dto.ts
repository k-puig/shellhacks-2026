import * as z from "@zod/zod";

export const createBookRequestZObj = z.object({
  id: z.uuidv4().optional(),
  libraryId: z.uuidv4(),
  userId: z.uuidv4(),
  title: z.string(),
  author: z.string(),
  lastAccessedAt: z.string().datetime().optional(),
  progress: z.number().int().nonnegative().optional(),
});

export const fetchBookRequestZObj = z.object({
  id: z.uuidv4(),
});

export const deleteBookRequestZObj = z.object({
  id: z.uuidv4(),
});

export type CreateBookRequest = z.infer<typeof createBookRequestZObj>;
export type FetchBookRequest = z.infer<typeof fetchBookRequestZObj>;
export type DeleteBookRequest = z.infer<typeof deleteBookRequestZObj>;
