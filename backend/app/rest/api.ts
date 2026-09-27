import { Hono } from "hono";
import { auth } from "@auth0/auth0-hono";
import {
  type AuthenticatedEnv,
  requireAuthenticatedUser,
} from "@app/rest/auth-guard.ts";

import { createBookRouter } from "@app/rest/book/book-router.ts";
import { BookService } from "@app/rest/book/book-service.ts";
import { createHighlightRouter } from "@app/rest/highlight/highlight-router.ts";
import { HighlightService } from "@app/rest/highlight/highlight-service.ts";
import { createLibraryRouter } from "@app/rest/library/library-router.ts";
import { LibraryService } from "@app/rest/library/library-service.ts";
import { createUserRouter } from "@app/rest/user/user-router.ts";
import { UserService } from "@app/rest/user/user-service.ts";
import { connectPostgresqlDatabase } from "@package/database/config/postgresql-config.ts";
import { UserSchema } from "@package/database/schema/postgresql-schema/index.ts";

const orm = await connectPostgresqlDatabase();
await orm.schema.update({
  safe: true, // disables destructive changes (table/column drops) [^dc3387#30-31]
  dropTables: false, // don't drop unknown tables
});

const api = new Hono<AuthenticatedEnv>();
const em = orm.em.fork();

// Install the Auth0 session client once for every router; login and callback stay public.
api.use(
  "*",
  auth({
    domain: Deno.env.get("AUTH0_DOMAIN"),
    clientID: Deno.env.get("AUTH0_CLIENT_ID"),
    clientSecret: Deno.env.get("AUTH0_CLIENT_SECRET"),
    baseURL: Deno.env.get("BASE_URL"),
    session: { secret: Deno.env.get("SESSION_SECRET") },
    routes: {
      login: "/api/v1/user/login",
      callback: "/api/v1/user/callback",
      logout: "/api/v1/user/logout",
    },
    customRoutes: ["callback", "logout"],
    authRequired: false,
  }),
);

api.use(
  "*",
  requireAuthenticatedUser(async (sub) => {
    const requestEm = orm.em.fork();
    const user = await requestEm.findOne(UserSchema, { authId: sub });
    return user?.id ?? null;
  }, Deno.env.get("BASE_URL")),
);

api.get("/", (c) => {
  return c.text("api");
});
api.route("/user", createUserRouter(new UserService(em.fork())));
api.route("/library", createLibraryRouter(new LibraryService(em.fork())));
api.route("/book", createBookRouter(new BookService(em.fork())));
api.route("/highlight", createHighlightRouter(new HighlightService(em.fork())));

export { api };
