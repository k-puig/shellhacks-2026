import { Hono } from "hono";
import { dummy } from "./dummy/router.ts";
import { user } from "./user/router.ts";

const api = new Hono();

api.get("/", (c) => {
  return c.text("Hello Hono!");
});
api.route("/dummy", dummy);
api.route("/user", user);

const app = new Hono();
app.route("/api/v1", api);

Deno.serve(app.fetch);
