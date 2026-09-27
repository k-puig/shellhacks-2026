import * as z from "@zod/zod";

const optionalFormNumber = z.string()
  .regex(/^\d+$/)
  .transform((value) => Number(value))
  .optional();

// Multipart form. The owner is the signed-in user (never sent by the client);
// the phone sends its own id so the book keeps the same id on every device.
export const createBookRequestZObj = z.object({
  id: z.uuidv4().optional(),
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
  progress: z.number().int().nonnegative().nullable().optional(),
});

// PATCH /book/:id/progress: the word the reader is on.
export const updateBookProgressRequestZObj = z.object({
  id: z.uuidv4(),
  position: z.number().int().nonnegative(),
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
