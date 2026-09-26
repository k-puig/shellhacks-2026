import { MikroORM } from "@mikro-orm/postgresql";
import {
  BookSchema,
  HighlightSchema,
  LibrarySchema,
  NoteSchema,
  UserSchema,
} from "@package/database/schema/index.ts";

export async function connectDatabase() {
  return await MikroORM.init({
    entities: [
      UserSchema,
      LibrarySchema,
      BookSchema,
      HighlightSchema,
      NoteSchema,
    ],
    dbName: Deno.env.get("PGSQL_DATABASE"),
    user: Deno.env.get("PGSQL_USER_NAME"),
    password: Deno.env.get("PGSQL_PASSWORD"),
  });
}

export default connectDatabase;
