import { Hono } from "hono";

import { createBookRouter } from "@app/rest/book/book-router.ts";
import { BookService } from "@app/rest/book/book-service.ts";
import { createHighlightRouter } from "@app/rest/highlight/highlight-router.ts";
import { HighlightService } from "@app/rest/highlight/highlight-service.ts";
import { requireUser } from "@app/rest/lib/auth/current-user.ts";
import { createLibraryRouter } from "@app/rest/library/library-router.ts";
import { LibraryService } from "@app/rest/library/library-service.ts";
import { createNoteRouter } from "@app/rest/note/note-router.ts";
import { NoteService } from "@app/rest/note/note-service.ts";
import { createUserRouter } from "@app/rest/user/user-router.ts";
import { UserService } from "@app/rest/user/user-service.ts";
import { connectPostgresqlDatabase } from "@package/database/config/postgresql-config.ts";

const orm = await connectPostgresqlDatabase();
await orm.schema.update({
  safe: true, // disables destructive changes (table/column drops) [^dc3387#30-31]
  dropTables: false, // don't drop unknown tables
});

const api = new Hono();
const em = orm.em.fork();

api.get("/", (c) => {
  return c.text("api");
});
api.route("/user", createUserRouter(new UserService(em.fork())));

// Everything below needs a signed-in user (the website's or the phone's cookie).
for (const path of ["/library", "/book", "/highlight", "/note"]) {
  api.use(path, requireUser);
  api.use(`${path}/*`, requireUser);
}
api.route("/library", createLibraryRouter(new LibraryService(em.fork())));
api.route("/book", createBookRouter(new BookService(em.fork())));
api.route("/highlight", createHighlightRouter(new HighlightService(em.fork())));
api.route("/note", createNoteRouter(new NoteService(em.fork())));

export { api };
