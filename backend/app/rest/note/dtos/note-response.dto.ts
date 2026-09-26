import * as z from "@zod/zod";
import { baseResponseZObj } from "@app/rest/lib/base-class/base-response";

export const noteContentZObj = baseResponseZObj({
    id: z.string().uuid(),
    highlightId: z.string().uuid(),
    text: z.string(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
});

export const createNoteBaseResponseZObj = baseResponseZObj(noteContentZObj);

export const fetchNoteBaseResponseZObj = baseResponseZObj(noteContentZObj);

export const updateNoteBaseResponseZObj = baseResponseZObj(noteContentZObj);

export const deleteNoteBaseResponseZObj = baseResponseZObj(
    z.object({
        id: z.uuidv4(),
    }),
);

export const fetchNotesByBookBaseResponseZObj = baseResponseZObj(
    z.array(noteContentZObj),
);

export type CreateNoteBaseResponse = z.infer<typeof createNoteBaseResponseZObj>;
export type FetchNoteBaseResponse = z.infer<typeof fetchNoteBaseResponseZObj>;
export type UpdateNoteBaseResponse = z.infer<typeof updateNoteBaseResponseZObj>;
export type DeleteNoteBaseResponse = z.infer<typeof deleteNoteBaseResponseZObj>;
export type FetchNotesByBookBaseResponse = z.infer<
    typeof fetchNotesByBookBaseResponseZObj
>;

export type CreateNoteResponse = CreateNoteBaseResponse["content"];
export type FetchNoteResponse = FetchNoteBaseResponse["content"];
export type UpdateNoteResponse = UpdateNoteBaseResponse["content"];
export type DeleteNoteResponse = DeleteNoteBaseResponse["content"];
export type FetchNotesByBookResponse = FetchNotesByBookBaseResponse["content"];