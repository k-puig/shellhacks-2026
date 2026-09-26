import { Hono } from "hono";
import { dummy } from "@app/rest/dummy/router.ts";
import { createUserRouter } from "@app/rest/user/router.ts";
import { connectPostgresqlDatabase } from "@package/database/config/postgresql-config.ts";
import { UserService } from "@app/rest/user/service/user-service.ts";

const orm = await connectPostgresqlDatabase();
await orm.schema.refresh(); // Clear db if schema doesn't match, then regenerate

const api = new Hono();

api.get("/", (c) => {
  return c.text("api");
});
api.route("/dummy", dummy);
api.route("/user", createUserRouter(new UserService(orm.em.fork())));

export { api };
