import { assertEquals, assertRejects } from "@std/assert";
import { Hono } from "hono";
import { BaseError } from "../lib/base-class/base-error.ts";
import { createHighlightRouter } from "./highlight-router.ts";
import { HighlightService } from "./highlight-service.ts";
import type { HighlightRepository } from "./highlight-repository.ts";

const owner = crypto.randomUUID();
const foreignBook = crypto.randomUUID();
const highlightId = crypto.randomUUID();

function setup(options: { highlightExists?: boolean } = {}) {
  const calls: string[] = [];
  const highlight = {
    id: highlightId,
    book: { id: crypto.randomUUID() },
    start: 1,
    end: 5,
  };
  const repository = {
    hasOwnedBook: async (id: string, userId: string) => {
      calls.push(`hasOwnedBook:${id}:${userId}`);
      return false;
    },
    findOwnedHighlight: async (id: string, userId: string) => {
      calls.push(`findOwnedHighlight:${id}:${userId}`);
      return options.highlightExists ? highlight : null;
    },
    createHighlight: async () => {
      calls.push("createHighlight");
      return highlight;
    },
    deleteOwnedHighlight: async (id: string, userId: string) => {
      calls.push(`deleteOwnedHighlight:${id}:${userId}`);
      return false;
    },
    getBookReference: () => {
      calls.push("getBookReference");
      return highlight.book;
    },
    flush: async () => {
      calls.push("flush");
    },
  } as unknown as HighlightRepository;
  const service = Object.assign(Object.create(HighlightService.prototype), {
    highlightRepository: repository,
  }) as HighlightService;
  return { service, calls, highlight };
}

async function expectNotFound(action: () => Promise<unknown>, message: string) {
  const error = await assertRejects(action, BaseError, message);
  assertEquals(error.code, 404);
}

Deno.test("highlight create rejects a foreign book before persistence", async () => {
  const { service, calls } = setup();
  await expectNotFound(
    () =>
      service.createHighlight({ bookId: foreignBook, start: 1, end: 5 }, owner),
    "Book not found",
  );
  assertEquals(calls, [`hasOwnedBook:${foreignBook}:${owner}`]);
});

Deno.test("highlight fetch, update, and delete cannot access another owner's highlight", async () => {
  const { service, calls } = setup();
  await expectNotFound(
    () => service.fetchHighlight({ id: highlightId }, owner),
    "Highlight not found",
  );
  await expectNotFound(
    () => service.updateHighlight({ id: highlightId, start: 2 }, owner),
    "Highlight not found",
  );
  await expectNotFound(
    () => service.deleteHighlight({ id: highlightId }, owner),
    "Highlight not found",
  );
  assertEquals(calls, [
    `findOwnedHighlight:${highlightId}:${owner}`,
    `findOwnedHighlight:${highlightId}:${owner}`,
    `deleteOwnedHighlight:${highlightId}:${owner}`,
  ]);
});

Deno.test("highlight update rejects moving to a foreign book before mutation or flush", async () => {
  const { service, calls, highlight } = setup({ highlightExists: true });
  const originalBook = highlight.book;
  await expectNotFound(
    () =>
      service.updateHighlight({
        id: highlightId,
        bookId: foreignBook,
        start: 2,
      }, owner),
    "Book not found",
  );
  assertEquals(highlight.book, originalBook);
  assertEquals(highlight.start, 1);
  assertEquals(calls, [
    `findOwnedHighlight:${highlightId}:${owner}`,
    `hasOwnedBook:${foreignBook}:${owner}`,
  ]);
});

Deno.test("highlight router forwards the authenticated principal to the service", async () => {
  const calls: unknown[][] = [];
  const service = {
    createHighlight: async (...args: unknown[]) => {
      calls.push(args);
      return { code: 201, message: "Highlight created", content: null };
    },
  } as unknown as HighlightService;
  const app = new Hono<{ Variables: { authenticatedUserId: string } }>();
  app.use("*", async (c, next) => {
    c.set("authenticatedUserId", owner);
    await next();
  });
  app.route("/highlight", createHighlightRouter(service));

  const response = await app.request("http://localhost/highlight", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ bookId: foreignBook, start: 1, end: 5 }),
  });
  assertEquals(response.status, 200);
  assertEquals(calls, [[{ bookId: foreignBook, start: 1, end: 5 }, owner]]);
});
