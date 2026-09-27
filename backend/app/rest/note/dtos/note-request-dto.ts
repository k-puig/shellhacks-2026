import * as z from "@zod/zod";

export const createNoteRequestZObj = z.object({
    highlightId: z.string().uuid(),
    text: z.string().min(1),
});

export const fetchNoteRequestZObj = z.object({
    id: z.string().uuid(),
})

export const updateNoteRequestZObj = z.object({
    id: z.string().uuid(),
    text: z.string().min(1),
})

export const deleteNoteRequestZObj = z.object({
    id: z.string().uuid(),
})

export const changeNoteByBookRequestZobj = z.object({
    bookId: z.string().uuid(),
})


export type CreateNoteRequest = z.infer<typeof createNoteRequestZObj>;
export type FetchNoteRequest = z.infer<typeof fetchNoteRequestZObj>;
export type UpdateNoteRequest = z.infer<typeof updateNoteRequestZObj>;
export type DeleteNoteRequest = z.infer<typeof deleteNoteRequestZObj>;
export type ChangeNoteByBookRequest = z.infer<typeof changeNoteByBookRequestZobj>;
