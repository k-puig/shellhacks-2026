import { Hono } from "hono";
import { dummy } from "@app/rest/dummy/router.ts";
import { user } from "@app/rest/user/router.ts";

const api = new Hono();

api.route("/dummy", dummy);
api.route("/user", user);

export { api };
