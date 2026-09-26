import * as z from "@zod/zod";
import { baseResponseZObj } from "@app/rest/lib/base-class/base-response.ts";

export const libraryContentZObj = z.object({
  id: z.uuidv4(),
  name: z.string(),
});

export const createLibraryBaseResponseZObj = baseResponseZObj(libraryContentZObj);
export const fetchLibraryBaseResponseZObj = baseResponseZObj(libraryContentZObj);
export const deleteLibraryBaseResponseZObj = baseResponseZObj(
  z.object({ id: z.uuidv4() }),
);

export type CreateLibraryBaseResponse = z.infer<typeof createLibraryBaseResponseZObj>;
export type FetchLibraryBaseResponse = z.infer<typeof fetchLibraryBaseResponseZObj>;
export type DeleteLibraryBaseResponse = z.infer<typeof deleteLibraryBaseResponseZObj>;
