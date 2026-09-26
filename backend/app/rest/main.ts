import { Hono } from "hono";
import { api } from "./api.ts";
import { connectPostgresqlDatabase } from "@package/database/config/postgresql-config.ts";
import { UserSchema } from "@package/database/schema/postgresql-schema/user/user-schema.ts";

const orm = await connectPostgresqlDatabase();
await orm.schema.refresh(); // Clear db if schema doesn't match, then regenerate

// const em = orm.em.fork();
// em.create(UserSchema, {
//   username: "pingas",
//   authId: "weegee",
// });
// em.flush();
// const res = await em.findAll(UserSchema);
// console.log(res);

const app = new Hono();
app.route("/api/v1", api);

Deno.serve(app.fetch);
