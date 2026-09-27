import { Hono } from "hono";
import { BaseError } from "@app/rest/lib/base-class/base-error.ts";
import {
  createBookRequestZObj,
  deleteBookRequestZObj,
  fetchBookRequestZObj,
} from "@app/rest/book/dtos/book-request-dto.ts";
import { BookService } from "@app/rest/book/book-service.ts";

export function createBookRouter(bookService: BookService): Hono {
  const book = new Hono();

  book.post("/", async (c) => {
    const parsed = await createBookRequestZObj.safeParseAsync(
      await c.req.parseBody(),
    );

    if (!parsed.success) {
      return c.json({
        code: 400,
        message: "Invalid book request",
        content: parsed.error.issues,
      });
    }

    const response = await bookService.createBook(parsed.data);
    return c.json(response);
  });

  book.get("/:id", async (c) => {
    const parsed = await fetchBookRequestZObj.safeParseAsync({
      id: c.req.param("id"),
    });

    if (!parsed.success) {
      return c.json({
        code: 400,
        message: "Invalid book id",
        content: parsed.error.issues,
      });
    }

    try {
      const response = await bookService.fetchBook(parsed.data);
      return c.json(response);
    } catch (error) {
      if (error instanceof BaseError) {
        return c.json({
          code: error.code,
          message: error.message,
          content: null,
        });
      }

      throw error;
    }
  });

  book.delete("/:id", async (c) => {
    const parsed = await deleteBookRequestZObj.safeParseAsync({
      id: c.req.param("id"),
    });

    if (!parsed.success) {
      return c.json({
        code: 400,
        message: "Invalid book id",
        content: parsed.error.issues,
      });
    }

    try {
      const response = await bookService.deleteBook(parsed.data);
      return c.json(response);
    } catch (error) {
      if (error instanceof BaseError) {
        return c.json({
          code: error.code,
          message: error.message,
          content: null,
        });
      }

      throw error;
    }
  });

  return book;
}
