import * as z from "@zod/zod";
import { baseResponseZObj } from "@app/rest/lib/base-class/base-response.ts";

export const bookContentZObj = z.object({
  id: z.uuidv4(),
  libraryId: z.uuidv4(),
  userId: z.uuidv4(),
  title: z.string(),
  author: z.string(),
  s3Key: z.string(),
  lastAccessedAt: z.string().datetime().nullable(),
  progress: z.number().nullable(),
});

export const createBookBaseResponseZObj = baseResponseZObj(bookContentZObj);
export const fetchBookBaseResponseZObj = baseResponseZObj(bookContentZObj);
export const updateBookBaseResponseZObj = baseResponseZObj(bookContentZObj);
export const deleteBookBaseResponseZObj = baseResponseZObj(
  z.object({ id: z.uuidv4() }),
);

export type CreateBookBaseResponse = z.infer<typeof createBookBaseResponseZObj>;
export type FetchBookBaseResponse = z.infer<typeof fetchBookBaseResponseZObj>;
export type UpdateBookBaseResponse = z.infer<typeof updateBookBaseResponseZObj>;
export type DeleteBookBaseResponse = z.infer<typeof deleteBookBaseResponseZObj>;
