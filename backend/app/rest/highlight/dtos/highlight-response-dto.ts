import * as z from "@zod/zod";
import { baseResponseZObj } from "@app/rest/lib/base-class/base-response.ts";

export const highlightContentZObj = z.object({
  id: z.uuidv4(),
  bookId: z.uuidv4(),
  start: z.number(),
  end: z.number(),
});

export const createHighlightBaseResponseZObj = baseResponseZObj(
  highlightContentZObj,
);
export const fetchHighlightBaseResponseZObj = baseResponseZObj(
  highlightContentZObj,
);
export const updateHighlightBaseResponseZObj = baseResponseZObj(
  highlightContentZObj,
);
export const deleteHighlightBaseResponseZObj = baseResponseZObj(
  z.object({ id: z.uuidv4() }),
);

export type CreateHighlightBaseResponse = z.infer<
  typeof createHighlightBaseResponseZObj
>;
export type FetchHighlightBaseResponse = z.infer<
  typeof fetchHighlightBaseResponseZObj
>;
export type UpdateHighlightBaseResponse = z.infer<
  typeof updateHighlightBaseResponseZObj
>;
export type DeleteHighlightBaseResponse = z.infer<
  typeof deleteHighlightBaseResponseZObj
>;
