import { Hono } from "hono";

import { BaseError } from "@app/rest/lib/base-class/base-error.ts";
import {
  changeNoteByBookRequestZobj,
  createNoteRequestZObj,
  deleteNoteRequestZObj,
  fetchNoteRequestZObj,
  updateNoteRequestZObj,
} from "@app/rest/note/dtos/note-request-dto.ts";
import { NoteService } from "@app/rest/note/note-service.ts";

export function createNoteRouter(
  noteService: NoteService,
): Hono<{ Variables: { authenticatedUserId: string } }> {
  const note = new Hono<{ Variables: { authenticatedUserId: string } }>();
  note.use("*", async (c, next) => {
    if (!c.get("authenticatedUserId")) {
      return c.json({
        code: 401,
        message: "Authentication required",
        content: null,
      }, 401);
    }
    await next();
  });

  // POST /api/v1/note - Create a note for a highlight
  note.post("/", async (c) => {
    try {
      const body = await c.req.json();
      const parsedBody = await createNoteRequestZObj.safeParseAsync(body);

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
      const response = await noteService.createNote(
        parsedBody.data,
        c.get("authenticatedUserId"),
      );
      return c.json(response, response.code);
    } catch (error) {
      if (error instanceof BaseError) {
        return c.json(
          { code: error.code, message: error.message, content: null },
          error.code,
        );
      }
      throw error;
    }
  });

  // GET /api/v1/note/book/:bookId - Fetch all notes for a specific book
  note.get("/book/:bookId", async (c) => {
    try {
      const bookId = c.req.param("bookId");
      const parsed = await changeNoteByBookRequestZobj.safeParseAsync({
        bookId,
      });

      if (!parsed.success) {
        return c.json(
          {
            code: 400,
            message: "Invalid book ID parameter",
            content: parsed.error.issues,
          },
          400,
        );
      }

      const response = await noteService.fetchNotesByBook(
        parsed.data,
        c.get("authenticatedUserId"),
      );
      return c.json(response, response.code);
    } catch (error) {
      if (error instanceof BaseError) {
        return c.json(
          { code: error.code, message: error.message, content: null },
          error.code,
        );
      }
      throw error;
    }
  });

  // GET /api/v1/note/:id - Fetch a single note by note ID
  note.get("/:id", async (c) => {
    try {
      const id = c.req.param("id");
      const parsed = await fetchNoteRequestZObj.safeParseAsync({ id });

      if (!parsed.success) {
        return c.json(
          {
            code: 400,
            message: "Invalid note ID parameter",
            content: parsed.error.issues,
          },
          400,
        );
      }

      const response = await noteService.fetchNote(
        parsed.data,
        c.get("authenticatedUserId"),
      );
      return c.json(response, response.code);
    } catch (error) {
      if (error instanceof BaseError) {
        return c.json(
          { code: error.code, message: error.message, content: null },
          error.code,
        );
      }
      throw error;
    }
  });

  // PUT /api/v1/note/:id - Update note content
  note.put("/:id", async (c) => {
    try {
      const id = c.req.param("id");
      const body = await c.req.json();
      const parsed = await updateNoteRequestZObj.safeParseAsync({
        ...body,
        id,
      });

      if (!parsed.success) {
        return c.json(
          {
            code: 400,
            message: "Invalid note update payload",
            content: parsed.error.issues,
          },
          400,
        );
      }

      const response = await noteService.updateNote(
        parsed.data,
        c.get("authenticatedUserId"),
      );
      return c.json(response, response.code);
    } catch (error) {
      if (error instanceof BaseError) {
        return c.json(
          { code: error.code, message: error.message, content: null },
          error.code,
        );
      }
      throw error;
    }
  });

  // DELETE /api/v1/note/:id - Delete a note by ID
  note.delete("/:id", async (c) => {
    try {
      const id = c.req.param("id");
      const parsed = await deleteNoteRequestZObj.safeParseAsync({ id });

      if (!parsed.success) {
        return c.json(
          {
            code: 400,
            message: "Invalid note ID parameter",
            content: parsed.error.issues,
          },
          400,
        );
      }

      const response = await noteService.deleteNote(
        parsed.data,
        c.get("authenticatedUserId"),
      );
      return c.json(response, response.code);
    } catch (error) {
      if (error instanceof BaseError) {
        return c.json(
          { code: error.code, message: error.message, content: null },
          error.code,
        );
      }
      throw error;
    }
  });

  return note;
}
