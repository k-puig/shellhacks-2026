import { Hono } from "hono";
import type { AuthEnv } from "@app/rest/lib/auth/current-user.ts";
import { handleRouteError } from "@app/rest/lib/base-class/error-handler.ts";
import {
  createBookRequestZObj,
  deleteBookRequestZObj,
  fetchBookRequestZObj,
  updateBookProgressRequestZObj,
} from "@app/rest/book/dtos/book-request-dto.ts";
import { BookService } from "@app/rest/book/book-service.ts";

// Mounted behind requireUser (api.ts): c.var.user is the signed-in user, and
// every route acts on that user's books only.
export function createBookRouter(bookService: BookService): Hono<AuthEnv> {
  const book = new Hono<AuthEnv>();

  book.onError(handleRouteError);

  const invalid = (message: string, issues: unknown) => ({
    code: 400 as const,
    message,
    content: issues,
  });

  // Upload an .epub (multipart form: book, title, author, optional id and libraryId).
  book.post("/", async (c) => {
    const parsed = await createBookRequestZObj.safeParseAsync(
      await c.req.parseBody(),
    );
    if (!parsed.success) {
      return c.json(invalid("Invalid book request", parsed.error.issues), 400);
    }

    const response = await bookService.createBook(
      parsed.data,
      c.var.user.id,
    );
    return c.json(response, 201);
  });

  // My books, newest first (each with its s3Key).
  book.get("/", async (c) => {
    return c.json(await bookService.listBooks(c.var.user.id));
  });

  book.get("/:id", async (c) => {
    const parsed = await fetchBookRequestZObj.safeParseAsync({
      id: c.req.param("id"),
    });
    if (!parsed.success) {
      return c.json(invalid("Invalid book id", parsed.error.issues), 400);
    }

    return c.json(await bookService.fetchBook(parsed.data, c.var.user.id));
  });

  // The book's .epub file, read from S3.
  book.get("/:id/file", async (c) => {
    const parsed = await fetchBookRequestZObj.safeParseAsync({
      id: c.req.param("id"),
    });
    if (!parsed.success) {
      return c.json(invalid("Invalid book id", parsed.error.issues), 400);
    }

    const file = await bookService.fetchBookFile(parsed.data, c.var.user.id);
    const headers: Record<string, string> = {
      "Content-Type": "application/epub+zip",
      "Content-Disposition": `attachment; filename="${parsed.data.id}.epub"`,
    };
    if (file.size !== undefined) headers["Content-Length"] = String(file.size);
    return new Response(file.body, { headers });
  });

  // Where the reader is: { "position": <word index> }.
  book.patch("/:id/progress", async (c) => {
    const parsed = await updateBookProgressRequestZObj.safeParseAsync({
      ...await c.req.json().catch(() => ({})),
      id: c.req.param("id"),
    });
    if (!parsed.success) {
      return c.json(invalid("Invalid progress", parsed.error.issues), 400);
    }

    return c.json(await bookService.updateProgress(parsed.data, c.var.user.id));
  });

  book.delete("/:id", async (c) => {
    const parsed = await deleteBookRequestZObj.safeParseAsync({
      id: c.req.param("id"),
    });
    if (!parsed.success) {
      return c.json(invalid("Invalid book id", parsed.error.issues), 400);
    }

    return c.json(await bookService.deleteBook(parsed.data, c.var.user.id));
  });

  return book;
}
