import { MikroORM } from "@mikro-orm/mongodb";

export async function connectMongoDatabase() {
  return await MikroORM.init({
    entities: [/*TODO: add entities when sidecar is done*/],
    host: Deno.env.get("MONGODB_HOST") ?? "127.0.0.1",
    port: Number(Deno.env.get("MONGODB_PORT") ?? "27017"),
    dbName: Deno.env.get("MONGODB_DATABASE"),
    user: Deno.env.get("MONGODB_USER_NAME"),
    password: Deno.env.get("MONGODB_PASSWORD"),
  });
}

export default connectMongoDatabase;
