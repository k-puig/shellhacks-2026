import { Hono } from "hono";
import { BaseError } from "@app/rest/lib/base-class/base-error.ts";
import {
    CreateNoteRequest,
    DeleteNoteRequest,
    FetchNoteRequest,
    UpdateNoteRequest,
    ChangeNoteByBookRequest,
} from "@app/rest/note/dtos/note-request-dto.ts";
import { NoteService } from "@app/rest/note/note-service.ts";

export function createNoteRouter(noteService: NoteService): Hono {
    const note = new Hono();

    //Create a note for a highlight
    note.post("/", async (c) => {
        try {
            const body = await c.req.json();
            const parsedBody = await CreateNoteRequestZObj.safeParseAsync(body);

            if (!parsedBody.success) {
                return c.json(
                    {
                        code: 400,
                        message: "Invalid note creation payload",
                        content: parsedBody.error.issues,
                    },
                    400,
                );
            }

            const response = await noteService.createNote(parsedBody.data);
            return c.json(response, response.code as any);
        } catch (error) {
            if (error instanceof BaseError) {
                return c.json(
                    { code: error.code, message: error.message, content: null },
                    error.code as any,
                );
            }
            throw error;
        }
    });
}