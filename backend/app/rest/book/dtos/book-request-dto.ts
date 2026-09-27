import * as z from "@zod/zod";

const optionalFormNumber = z.string()
  .regex(/^\d+$/)
  .transform((value) => Number(value))
  .pipe(z.number().safe().int().nonnegative())
  .optional();

// Multipart form. The owner and book id are assigned by the server.
export const createBookRequestZObj = z.object({
  libraryId: z.uuidv4().optional(),
  title: z.string(),
  author: z.string(),
  lastAccessedAt: z.string().datetime().optional(),
  progress: optionalFormNumber,
  book: z.instanceof(File)
    .refine(
      (file) =>
        file.name.toLowerCase().endsWith(".epub") ||
        file.type === "application/epub+zip",
      "Book upload must be an .epub file",
    ),
});

export const fetchBookRequestZObj = z.object({
  id: z.uuidv4(),
});

export const updateBookRequestZObj = z.object({
  id: z.uuidv4(),
  libraryId: z.uuidv4().nullable().optional(),
  title: z.string().optional(),
  author: z.string().optional(),
  lastAccessedAt: z.string().datetime().nullable().optional(),
  progress: z.number().safe().int().nonnegative().nullable().optional(),
});

// PATCH /book/:id/progress: the word the reader is on.
export const updateBookProgressRequestZObj = z.object({
  id: z.uuidv4(),
  position: z.number().safe().int().nonnegative(),
});

export const deleteBookRequestZObj = z.object({
  id: z.uuidv4(),
});

export type CreateBookRequest = z.infer<typeof createBookRequestZObj>;
export type FetchBookRequest = z.infer<typeof fetchBookRequestZObj>;
export type UpdateBookRequest = z.infer<typeof updateBookRequestZObj>;
export type DeleteBookRequest = z.infer<typeof deleteBookRequestZObj>;
export type UpdateBookProgressRequest = z.infer<
  typeof updateBookProgressRequestZObj
>;
