import { Hono } from "hono";
import { auth, type OIDCVariables } from "@auth0/auth0-hono";

const user = new Hono<{ Variables: OIDCVariables }>();
user.use(
  auth({
    domain: Deno.env.get("AUTH0_DOMAIN"),
    clientID: Deno.env.get("AUTH0_CLIENT_ID"),
    clientSecret: Deno.env.get("AUTH0_CLIENT_SECRET"),
    baseURL: Deno.env.get("BASE_URL"),
    session: {
      secret: "password_at_least_32_characters_long",
    },
  }),
);

user.get("/", async (c) => {
  const session = await c.var.auth0Client?.getSession(c);
  return c.text(`Hello ${session?.user?.name}!`);
});

export { user };
