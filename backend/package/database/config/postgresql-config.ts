import { MikroORM } from "@mikro-orm/postgresql";
import {
  BookSchema,
  HighlightSchema,
  LibrarySchema,
  NoteSchema,
  UserSchema,
} from "@package/database/schema/postgresql-schema/index.ts";

export async function connectPostgresqlDatabase() {
  return await MikroORM.init({
    entities: [
      UserSchema,
      LibrarySchema,
      BookSchema,
      HighlightSchema,
      NoteSchema,
    ],
    host: Deno.env.get("PGSQL_HOST") ?? "127.0.0.1",
    port: Number(Deno.env.get("PGSQL_PORT") ?? "5432"),
    dbName: Deno.env.get("PGSQL_DATABASE"),
    user: Deno.env.get("PGSQL_USER_NAME"),
    password: Deno.env.get("PGSQL_PASSWORD"),
  });
}

export default connectPostgresqlDatabase;
