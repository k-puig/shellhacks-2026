import { assertEquals, assertRejects } from "@std/assert";
import { Hono } from "hono";
import { BaseError } from "../lib/base-class/base-error.ts";
import { createBookRouter } from "./book-router.ts";
import { BookService } from "./book-service.ts";
import type { BookRepository } from "./book-repository.ts";
import type { S3Client } from "@package/s3/client.ts";

const owner = crypto.randomUUID();
const foreignLibrary = crypto.randomUUID();
const foreignBook = crypto.randomUUID();
const file = new File(["epub"], "book.epub", { type: "application/epub+zip" });

function setup(options: { bookExists?: boolean } = {}) {
  const calls: string[] = [];
  const book = {
    id: foreignBook,
    library: { id: crypto.randomUUID() },
    user: { id: owner },
    title: "Original",
    author: "Author",
    s3Key: "books/original.epub",
  };
  const repository = {
    hasOwnedLibrary: async (id: string, userId: string) => {
      calls.push(`hasOwnedLibrary:${id}:${userId}`);
      return false;
    },
    findOwnedBook: async (id: string, userId: string) => {
      calls.push(`findOwnedBook:${id}:${userId}`);
      return options.bookExists ? book : null;
    },
    createBook: async () => {
      calls.push("createBook");
      return book;
    },
    deleteOwnedBook: async () => {
      calls.push("deleteOwnedBook");
      return true;
    },
    getLibraryReference: () => {
      calls.push("getLibraryReference");
      return book.library;
    },
    flush: async () => {
      calls.push("flush");
    },
  } as unknown as BookRepository;
  const s3 = {
    uploadBook: async () => {
      calls.push("uploadBook");
      return "key";
    },
    deleteBook: async () => {
      calls.push("deleteBook");
    },
    fetchBook: async (input: { key: string }) => {
      calls.push(`fetchBook:${input.key}`);
      return {
        body: new Blob(["epub"]).stream(),
        contentLength: 4,
        contentType: "application/epub+zip",
      };
    },
  } as unknown as S3Client;
  // Avoid constructors: neither a real EntityManager nor a real S3 client is needed.
  const service = Object.assign(Object.create(BookService.prototype), {
    bookRepository: repository,
    s3Client: s3,
  }) as BookService;
  return { service, calls, book };
}

async function expectNotFound(action: () => Promise<unknown>, message: string) {
  const error = await assertRejects(action, BaseError, message);
  assertEquals(error.code, 404);
}

Deno.test("book create rejects a foreign library before upload or persistence", async () => {
  const { service, calls } = setup();
  await expectNotFound(
    () =>
      service.createBook({
        libraryId: foreignLibrary,
        title: "New",
        author: "Author",
        book: file,
      }, owner),
    "Library not found",
  );
  assertEquals(calls, [`hasOwnedLibrary:${foreignLibrary}:${owner}`]);
});

Deno.test("book fetch, update, and delete cannot access another owner's book", async () => {
  const { service, calls } = setup();
  await expectNotFound(
    () => service.fetchBook({ id: foreignBook }, owner),
    "Book not found",
  );
  await expectNotFound(
    () => service.updateBook({ id: foreignBook, title: "Changed" }, owner),
    "Book not found",
  );
  await expectNotFound(
    () => service.deleteBook({ id: foreignBook }, owner),
    "Book not found",
  );
  assertEquals(calls, Array(3).fill(`findOwnedBook:${foreignBook}:${owner}`));
});

Deno.test("book file download rejects a foreign book before fetching S3", async () => {
  const { service, calls } = setup();
  await expectNotFound(
    () => service.fetchBookObject({ id: foreignBook }, owner),
    "Book not found",
  );
  assertEquals(calls, [`findOwnedBook:${foreignBook}:${owner}`]);
});

Deno.test("book file download fetches the owned book object", async () => {
  const { service, calls, book } = setup({ bookExists: true });
  const result = await service.fetchBookObject({ id: foreignBook }, owner);
  assertEquals(await new Response(result.body).text(), "epub");
  assertEquals(result.contentType, "application/epub+zip");
  assertEquals(result.contentLength, 4);
  assertEquals(result.filename, "Original.epub");
  assertEquals(calls, [
    `findOwnedBook:${foreignBook}:${owner}`,
    `fetchBook:${book.s3Key}`,
  ]);
});

Deno.test("book update rejects a foreign destination library without changing or flushing the book", async () => {
  const { service, calls, book } = setup({ bookExists: true });
  await expectNotFound(
    () =>
      service.updateBook({
        id: foreignBook,
        libraryId: foreignLibrary,
        title: "Changed",
      }, owner),
    "Library not found",
  );
  assertEquals(book.title, "Original");
  assertEquals(calls, [
    `findOwnedBook:${foreignBook}:${owner}`,
    `hasOwnedLibrary:${foreignLibrary}:${owner}`,
  ]);
});

Deno.test("book router forwards the authenticated principal to the service", async () => {
  const calls: unknown[][] = [];
  const service = {
    fetchBook: async (...args: unknown[]) => {
      calls.push(args);
      return { code: 200, message: "Book fetched", content: null };
    },
    fetchBookObject: async (...args: unknown[]) => {
      calls.push(args);
      return {
        body: new Blob(["epub"]).stream(),
        contentLength: 4,
        contentType: "application/epub+zip",
        filename: "Original.epub",
      };
    },
  } as unknown as BookService;
  const app = new Hono<{ Variables: { authenticatedUserId: string } }>();
  app.use("*", async (c, next) => {
    c.set("authenticatedUserId", owner);
    await next();
  });
  app.route("/book", createBookRouter(service));

  const response = await app.request(`http://localhost/book/${foreignBook}`);
  assertEquals(response.status, 200);

  const fileResponse = await app.request(
    `http://localhost/book/${foreignBook}/file`,
  );
  assertEquals(fileResponse.status, 200);
  assertEquals(
    fileResponse.headers.get("content-type"),
    "application/epub+zip",
  );
  assertEquals(fileResponse.headers.get("content-length"), "4");
  assertEquals(
    fileResponse.headers.get("content-disposition"),
    "inline; filename*=UTF-8''Original.epub",
  );
  assertEquals(await fileResponse.text(), "epub");
  assertEquals(calls, [
    [{ id: foreignBook }, owner],
    [{ id: foreignBook }, owner],
  ]);
});
