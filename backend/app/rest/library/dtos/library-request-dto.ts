import * as z from "@zod/zod";

export const createLibraryRequestZObj = z.object({
  id: z.uuidv4().optional(),
  name: z.string(),
});

export const fetchLibraryRequestZObj = z.object({
  id: z.uuidv4(),
});

export const deleteLibraryRequestZObj = z.object({
  id: z.uuidv4(),
});

export type CreateLibraryRequest = z.infer<typeof createLibraryRequestZObj>;
export type FetchLibraryRequest = z.infer<typeof fetchLibraryRequestZObj>;
export type DeleteLibraryRequest = z.infer<typeof deleteLibraryRequestZObj>;
