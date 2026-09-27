import { assertEquals, assertRejects } from "@std/assert";
import { Hono } from "hono";
import { BaseError } from "../lib/base-class/base-error.ts";
import { createBookRouter } from "./book-router.ts";
import { BookService } from "./book-service.ts";
import { BookRepository } from "./book-repository.ts";
import { LockMode } from "@mikro-orm/core";
import type { EntityManager } from "@mikro-orm/postgresql";
import {
  BookSchema,
  HighlightSchema,
  NoteSchema,
} from "@package/database/schema/postgresql-schema/index.ts";
import type { S3Client } from "@package/s3/client.ts";

const owner = crypto.randomUUID();
const foreignLibrary = crypto.randomUUID();
const foreignBook = crypto.randomUUID();
const file = new File(["epub"], "book.epub", { type: "application/epub+zip" });

function setup(
  options: {
    bookExists?: boolean;
    libraryOwned?: boolean;
    s3DeleteFails?: boolean;
    dbDeleteFails?: boolean;
  } = {},
) {
  const calls: string[] = [];
  const book = {
    id: foreignBook,
    library: { id: crypto.randomUUID() },
    user: { id: owner },
    title: "Original",
    author: "Author",
    s3Key: "books/original.epub",
    progress: undefined as bigint | undefined,
    lastAccessedAt: undefined as Date | undefined,
  };
  const repository = {
    hasOwnedLibrary: async (id: string, userId: string) => {
      calls.push(`hasOwnedLibrary:${id}:${userId}`);
      return options.libraryOwned ?? false;
    },
    findByUser: async (userId: string) => {
      calls.push(`findByUser:${userId}`);
      return [book];
    },
    findOwnedBook: async (id: string, userId: string) => {
      calls.push(`findOwnedBook:${id}:${userId}`);
      return options.bookExists ? book : null;
    },
    createBook: async (req: { id: string; userId: string; s3Key: string }) => {
      calls.push(`createBook:${req.id}:${req.userId}:${req.s3Key}`);
      return { ...book, id: req.id, s3Key: req.s3Key };
    },
    deleteOwnedBook: async (id: string, userId: string) => {
      calls.push(`deleteOwnedBook:${id}:${userId}`);
      if (options.dbDeleteFails) throw new Error("DB transaction rolled back");
      return options.bookExists ? book.s3Key : null;
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
    uploadBook: async (input: { key: string }) => {
      calls.push(`uploadBook:${input.key}`);
      return input.key;
    },
    deleteBook: async (input: { key: string }) => {
      calls.push(`deleteBook:${input.key}`);
      if (options.s3DeleteFails) throw new Error("S3 unavailable");
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
  assertEquals(calls, [
    `findOwnedBook:${foreignBook}:${owner}`,
    `findOwnedBook:${foreignBook}:${owner}`,
    `deleteOwnedBook:${foreignBook}:${owner}`,
  ]);
});

Deno.test("repository removes notes, highlights, then book in one owner-checked transaction", async () => {
  const calls: string[] = [];
  const highlightId = crypto.randomUUID();
  const book = { id: foreignBook, s3Key: "books/owned.epub" };
  const tx = {
    findOne: async (entity: unknown, where: unknown, options: unknown) => {
      assertEquals(entity, BookSchema);
      assertEquals(where, { id: foreignBook, user: owner });
      assertEquals(options, { lockMode: LockMode.PESSIMISTIC_WRITE });
      calls.push("lockOwnedBook");
      return book;
    },
    find: async (entity: unknown, where: unknown) => {
      assertEquals(entity, HighlightSchema);
      assertEquals(where, { book: foreignBook });
      calls.push("findHighlights");
      return [{ id: highlightId }];
    },
    nativeDelete: async (entity: unknown, where: unknown) => {
      if (entity === NoteSchema) {
        assertEquals(where, { highlight: { $in: [highlightId] } });
        calls.push("deleteNotes");
      } else {
        assertEquals(entity, HighlightSchema);
        assertEquals(where, { id: { $in: [highlightId] } });
        calls.push("deleteHighlights");
      }
    },
    remove: (entity: unknown) => {
      assertEquals(entity, book);
      calls.push("removeBook");
    },
    flush: async () => {
      calls.push("flushBook");
    },
  };
  const em = {
    transactional: async (run: (em: typeof tx) => Promise<unknown>) => {
      calls.push("begin");
      const result = await run(tx);
      calls.push("commit");
      return result;
    },
  } as unknown as EntityManager;
  const repository = new BookRepository(em);
  assertEquals(
    await repository.deleteOwnedBook(foreignBook, owner),
    book.s3Key,
  );
  assertEquals(calls, [
    "begin",
    "lockOwnedBook",
    "findHighlights",
    "deleteNotes",
    "deleteHighlights",
    "removeBook",
    "flushBook",
    "commit",
  ]);
});

Deno.test("repository does not delete dependents of an unowned book", async () => {
  const calls: string[] = [];
  const tx = {
    findOne: async (_entity: unknown, where: unknown) => {
      assertEquals(where, { id: foreignBook, user: owner });
      calls.push("findOwnedBook");
      return null;
    },
  };
  const em = {
    transactional: async (run: (em: typeof tx) => Promise<unknown>) => {
      calls.push("begin");
      const result = await run(tx);
      calls.push("commit");
      return result;
    },
  } as unknown as EntityManager;
  assertEquals(
    await new BookRepository(em).deleteOwnedBook(foreignBook, owner),
    null,
  );
  assertEquals(calls, ["begin", "findOwnedBook", "commit"]);
});

Deno.test("book deletion commits DB before cleaning up its owned S3 object", async () => {
  const { service, calls, book } = setup({ bookExists: true });
  const response = await service.deleteBook({ id: foreignBook }, owner);
  assertEquals(response.code, 200);
  assertEquals(calls, [
    `deleteOwnedBook:${foreignBook}:${owner}`,
    `deleteBook:${book.s3Key}`,
  ]);
});

Deno.test("book deletion never touches S3 if DB transaction fails", async () => {
  const { service, calls } = setup({ bookExists: true, dbDeleteFails: true });
  await assertRejects(
    () => service.deleteBook({ id: foreignBook }, owner),
    Error,
    "DB transaction rolled back",
  );
  assertEquals(calls, [`deleteOwnedBook:${foreignBook}:${owner}`]);
});

Deno.test("S3 deletion failure logs an actionable orphan key after DB commit", async () => {
  const { service, calls, book } = setup({
    bookExists: true,
    s3DeleteFails: true,
  });
  const errors: unknown[][] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => errors.push(args);
  try {
    const response = await service.deleteBook({ id: foreignBook }, owner);
    assertEquals(response.code, 200);
  } finally {
    console.error = originalError;
  }
  assertEquals(calls, [
    `deleteOwnedBook:${foreignBook}:${owner}`,
    `deleteBook:${book.s3Key}`,
  ]);
  assertEquals(String(errors[0][0]).includes(book.s3Key), true);
  assertEquals(String(errors[0][0]).includes(foreignBook), true);
  assertEquals(String(errors[0][1]).includes("S3 unavailable"), true);
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

Deno.test("book create generates an id and S3 key and returns the id", async () => {
  const { service, calls } = setup();
  const response = await service.createBook({
    title: "New",
    author: "Author",
    book: file,
  }, owner);
  const id = response.content.id;
  assertEquals(response.code, 201);
  assertEquals(typeof id, "string");
  assertEquals(id.length, 36);
  assertEquals(calls, [
    `uploadBook:books/${owner}/${id}.epub`,
    `createBook:${id}:${owner}:books/${owner}/${id}.epub`,
  ]);
});

Deno.test("book list serializes string last-accessed timestamps", async () => {
  const { service, book } = setup();
  (book as unknown as { lastAccessedAt: string }).lastAccessedAt =
    "2026-09-27T12:34:56.000Z";
  const list = await service.listBooks(owner);
  assertEquals(list.content[0].lastAccessedAt, "2026-09-27T12:34:56.000Z");
});

Deno.test("book list is scoped and progress saves a word index", async () => {
  const { service, calls, book } = setup({ bookExists: true });
  const list = await service.listBooks(owner);
  assertEquals(list.content[0].id, book.id);
  const updated = await service.updateProgress({
    id: foreignBook,
    position: 42,
  }, owner);
  assertEquals(updated.content.progress, 42);
  assertEquals(book.progress, 42n);
  assertEquals(book.lastAccessedAt instanceof Date, true);
  assertEquals(calls, [
    `findByUser:${owner}`,
    `findOwnedBook:${foreignBook}:${owner}`,
    "flush",
  ]);
});

Deno.test("book update can remove its library without checking ownership", async () => {
  const { service, calls, book } = setup({ bookExists: true });
  await service.updateBook({ id: foreignBook, libraryId: null }, owner);
  assertEquals(book.library, undefined);
  assertEquals(calls, [`findOwnedBook:${foreignBook}:${owner}`, "flush"]);
});

Deno.test("book routes return creation status and forward list and progress principal", async () => {
  const calls: unknown[][] = [];
  const createdId = crypto.randomUUID();
  const service = {
    createBook: async (...args: unknown[]) => {
      calls.push(args);
      return { code: 201, message: "Book created", content: { id: createdId } };
    },
    listBooks: async (...args: unknown[]) => {
      calls.push(args);
      return { code: 200, message: "Books fetched", content: [] };
    },
    updateProgress: async (...args: unknown[]) => {
      calls.push(args);
      return { code: 200, message: "Book updated", content: { progress: 42 } };
    },
  } as unknown as BookService;
  const app = new Hono<{ Variables: { authenticatedUserId: string } }>();
  app.use("*", async (c, next) => {
    c.set("authenticatedUserId", owner);
    await next();
  });
  app.route("/book", createBookRouter(service));

  const form = new FormData();
  form.set("title", "New");
  form.set("author", "Author");
  form.set("book", file);
  const created = await app.request("http://localhost/book", {
    method: "POST",
    body: form,
  });
  assertEquals(created.status, 201);
  assertEquals((await created.json()).content.id, createdId);
  assertEquals((await app.request("http://localhost/book")).status, 200);
  const progress = await app.request(
    `http://localhost/book/${foreignBook}/progress`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position: 42 }),
    },
  );
  assertEquals(progress.status, 200);
  assertEquals(calls[0][1], owner);
  assertEquals(calls[1], [owner]);
  assertEquals(calls[2], [{ id: foreignBook, position: 42 }, owner]);
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
