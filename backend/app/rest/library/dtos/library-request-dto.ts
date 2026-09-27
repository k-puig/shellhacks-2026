import * as z from "@zod/zod";

export const createLibraryRequestZObj = z.object({
  name: z.string(),
});

export const fetchLibraryRequestZObj = z.object({
  id: z.uuidv4(),
});

export const updateLibraryRequestZObj = z.object({
  id: z.uuidv4(),
  name: z.string(),
});

export const deleteLibraryRequestZObj = z.object({
  id: z.uuidv4(),
});

export type CreateLibraryRequest = z.infer<typeof createLibraryRequestZObj>;
export type FetchLibraryRequest = z.infer<typeof fetchLibraryRequestZObj>;
export type UpdateLibraryRequest = z.infer<typeof updateLibraryRequestZObj>;
export type DeleteLibraryRequest = z.infer<typeof deleteLibraryRequestZObj>;
