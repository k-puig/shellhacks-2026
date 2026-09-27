import { assertEquals, assertRejects } from "@std/assert";
import { Hono } from "hono";
import { BaseError } from "@app/rest/lib/base-class/base-error.ts";
import type { NoteRepository } from "./note-repository.ts";
import { createNoteRouter } from "./note-router.ts";
import { NoteService } from "./note-service.ts";

const owner = crypto.randomUUID();
const bookId = crypto.randomUUID();
const highlightId = crypto.randomUUID();
const noteId = crypto.randomUUID();

Deno.test("notes reject foreign highlights and books before reading or writing", async () => {
  const calls: string[] = [];
  const repository = {
    ownsHighlight: async (id: string, userId: string) => {
      calls.push(`ownsHighlight:${id}:${userId}`);
      return false;
    },
    ownsBook: async (id: string, userId: string) => {
      calls.push(`ownsBook:${id}:${userId}`);
      return false;
    },
    createNote: async () => {
      calls.push("createNote");
    },
    findByBookId: async () => {
      calls.push("findByBookId");
    },
  } as unknown as NoteRepository;
  const service = Object.assign(Object.create(NoteService.prototype), {
    noteRepository: repository,
  }) as NoteService;
  const createError = await assertRejects(
    () => service.createNote({ highlightId, text: "note" }, owner),
    BaseError,
    "Highlight not found",
  );
  assertEquals(createError.code, 404);
  const listError = await assertRejects(
    () => service.fetchNotesByBook({ bookId }, owner),
    BaseError,
    "Book not found",
  );
  assertEquals(listError.code, 404);
  assertEquals(calls, [
    `ownsHighlight:${highlightId}:${owner}`,
    `ownsBook:${bookId}:${owner}`,
  ]);
});

Deno.test("note deletion scopes the operation to the owner", async () => {
  const calls: string[] = [];
  const repository = {
    deleteOwnedNote: async (id: string, userId: string) => {
      calls.push(`${id}:${userId}`);
      return false;
    },
  } as unknown as NoteRepository;
  const service = Object.assign(Object.create(NoteService.prototype), {
    noteRepository: repository,
  }) as NoteService;
  const error = await assertRejects(
    () => service.deleteNote({ id: noteId }, owner),
    BaseError,
    "Note not found",
  );
  assertEquals(error.code, 404);
  assertEquals(calls, [`${noteId}:${owner}`]);
});

Deno.test("note routes reject requests missing the authenticated principal", async () => {
  const app = new Hono<{ Variables: { authenticatedUserId: string } }>();
  const service = {
    fetchNote: () => {
      throw new Error("should not be called");
    },
  } as unknown as NoteService;
  app.route("/note", createNoteRouter(service));
  const response = await app.request(`http://localhost/note/${noteId}`);
  assertEquals(response.status, 401);
});

Deno.test("note routes forward authenticated principal for all methods", async () => {
  const calls: Array<[string, unknown, string]> = [];
  const service = Object.fromEntries(
    ["createNote", "fetchNotesByBook", "fetchNote", "updateNote", "deleteNote"]
      .map((method) => [method, async (req: unknown, userId: string) => {
        calls.push([method, req, userId]);
        return {
          code: method === "createNote" ? 201 : 200,
          message: "ok",
          content: null,
        };
      }]),
  ) as unknown as NoteService;
  const app = new Hono<{ Variables: { authenticatedUserId: string } }>();
  app.use("*", async (c, next) => {
    c.set("authenticatedUserId", owner);
    await next();
  });
  app.route("/note", createNoteRouter(service));
  const requests: Array<[string, string, unknown?]> = [
    ["POST", "/note", { id: noteId, highlightId, text: "note" }],
    ["GET", `/note/book/${bookId}`],
    ["GET", `/note/${noteId}`],
    ["PUT", `/note/${noteId}`, { text: "updated" }],
    ["DELETE", `/note/${noteId}`],
  ];
  for (const [method, path, body] of requests) {
    const response = await app.request(`http://localhost${path}`, {
      method,
      ...(body
        ? {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
        : {}),
    });
    assertEquals(response.status, method === "POST" ? 201 : 200);
  }
  assertEquals(calls, [
    ["createNote", { highlightId, text: "note" }, owner],
    ["fetchNotesByBook", { bookId }, owner],
    ["fetchNote", { id: noteId }, owner],
    ["updateNote", { id: noteId, text: "updated" }, owner],
    ["deleteNote", { id: noteId }, owner],
  ]);
});
