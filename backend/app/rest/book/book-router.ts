import { Hono } from "hono";
import { handleRouteError } from "@app/rest/lib/base-class/error-handler.ts";
import {
  createBookRequestZObj,
  deleteBookRequestZObj,
  fetchBookRequestZObj,
  updateBookProgressRequestZObj,
  updateBookRequestZObj,
} from "@app/rest/book/dtos/book-request-dto.ts";
import { BookService } from "@app/rest/book/book-service.ts";

export function createBookRouter(
  bookService: BookService,
): Hono<{ Variables: { authenticatedUserId: string } }> {
  const book = new Hono<{ Variables: { authenticatedUserId: string } }>();
  book.onError(handleRouteError);

  const invalid = (message: string, issues: unknown) => ({
    code: 400 as const,
    message,
    content: issues,
  });

  book.post("/", async (c) => {
    const parsed = await createBookRequestZObj.safeParseAsync(
      await c.req.parseBody(),
    );
    if (!parsed.success) {
      return c.json(invalid("Invalid book request", parsed.error.issues), 400);
    }
    const response = await bookService.createBook(
      parsed.data,
      c.get("authenticatedUserId"),
    );
    return c.json(response, 201);
  });

  book.get("/", async (c) => {
    return c.json(await bookService.listBooks(c.get("authenticatedUserId")));
  });

  book.get("/:id", async (c) => {
    const parsed = await fetchBookRequestZObj.safeParseAsync({
      id: c.req.param("id"),
    });
    if (!parsed.success) {
      return c.json(invalid("Invalid book id", parsed.error.issues), 400);
    }
    return c.json(
      await bookService.fetchBook(parsed.data, c.get("authenticatedUserId")),
    );
  });

  book.get("/:id/file", async (c) => {
    const parsed = await fetchBookRequestZObj.safeParseAsync({
      id: c.req.param("id"),
    });
    if (!parsed.success) {
      return c.json(invalid("Invalid book id", parsed.error.issues), 400);
    }
    const file = await bookService.fetchBookObject(
      parsed.data,
      c.get("authenticatedUserId"),
    );
    const headers: Record<string, string> = {
      "Content-Type": file.contentType,
      "Content-Disposition": `inline; filename*=UTF-8''${
        encodeURIComponent(file.filename)
      }`,
    };
    if (file.contentLength !== undefined) {
      headers["Content-Length"] = String(file.contentLength);
    }
    return c.body(file.body, 200, headers);
  });

  // Position is the word index in the book, not a page number.
  book.patch("/:id/progress", async (c) => {
    const parsed = await updateBookProgressRequestZObj.safeParseAsync({
      ...await c.req.json().catch(() => ({})),
      id: c.req.param("id"),
    });
    if (!parsed.success) {
      return c.json(invalid("Invalid progress", parsed.error.issues), 400);
    }
    return c.json(
      await bookService.updateProgress(
        parsed.data,
        c.get("authenticatedUserId"),
      ),
    );
  });

  book.patch("/:id", async (c) => {
    const parsed = await updateBookRequestZObj.safeParseAsync({
      ...await c.req.json().catch(() => ({})),
      id: c.req.param("id"),
    });
    if (!parsed.success) {
      return c.json(invalid("Invalid book request", parsed.error.issues), 400);
    }
    return c.json(
      await bookService.updateBook(parsed.data, c.get("authenticatedUserId")),
    );
  });

  book.delete("/:id", async (c) => {
    const parsed = await deleteBookRequestZObj.safeParseAsync({
      id: c.req.param("id"),
    });
    if (!parsed.success) {
      return c.json(invalid("Invalid book id", parsed.error.issues), 400);
    }
    return c.json(
      await bookService.deleteBook(parsed.data, c.get("authenticatedUserId")),
    );
  });

  return book;
}
