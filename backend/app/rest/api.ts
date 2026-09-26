import { Hono } from "hono";

import { createBookRouter } from "@app/rest/book/book-router.ts";
import { BookService } from "@app/rest/book/book-service.ts";
import { createHighlightRouter } from "@app/rest/highlight/highlight-router.ts";
import { HighlightService } from "@app/rest/highlight/highlight-service.ts";
import { createLibraryRouter } from "@app/rest/library/library-router.ts";
import { LibraryService } from "@app/rest/library/library-service.ts";
import { createUserRouter } from "@app/rest/user/user-router.ts";
import { UserService } from "@app/rest/user/user-service.ts";
import { connectPostgresqlDatabase } from "@package/database/config/postgresql-config.ts";

const orm = await connectPostgresqlDatabase();
await orm.schema.refresh(); // Clear db if schema doesn't match, then regenerate

const api = new Hono();
const em = orm.em.fork();

api.get("/", (c) => {
  return c.text("api");
});
api.route("/user", createUserRouter(new UserService(em.fork())));
api.route("/library", createLibraryRouter(new LibraryService(em.fork())));
api.route("/book", createBookRouter(new BookService(em.fork())));
api.route("/highlight", createHighlightRouter(new HighlightService(em.fork())));

export { api };
