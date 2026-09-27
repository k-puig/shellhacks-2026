import { assertEquals } from "@std/assert";
import type { OIDCEnv } from "@auth0/auth0-hono";
import { Hono } from "hono";
import {
  type AuthenticatedEnv,
  requireAuthenticatedUser,
} from "./auth-guard.ts";

const userId = crypto.randomUUID();

function setup(
  sub?: string,
  lookupResult: string | null = userId,
  bearerSub?: string,
) {
  const lookups: string[] = [];
  const api = new Hono<AuthenticatedEnv>();
  api.use("*", async (c, next) => {
    c.set(
      "auth0Client",
      {
        getSession: async () => sub ? { user: { sub } } : null,
      } as unknown as OIDCEnv["Variables"]["auth0Client"],
    );
    await next();
  });
  api.use(
    "*",
    requireAuthenticatedUser(
      async (subject) => {
        lookups.push(subject);
        return lookupResult;
      },
      "https://dodo.test",
      async (token) => token === "valid-api-token" ? bearerSub ?? null : null,
    ),
  );
  api.all("*", (c) => c.json({ userId: c.get("authenticatedUserId") ?? null }));
  const app = new Hono();
  app.route("/api/v1", api);
  return { app, lookups };
}

Deno.test("unauthenticated writes and resource reads return 401 without a database lookup", async () => {
  const { app, lookups } = setup();
  for (
    const [method, path] of [
      ["POST", "/api/v1/book"],
      ["PATCH", "/api/v1/user/update"],
      ["GET", "/api/v1/highlight/123"],
      ["GET", `/api/v1/user/${userId}/profile-picture`],
      ["GET", "/api/v1/user"],
    ]
  ) {
    const response = await app.request(`https://dodo.test${path}`, { method });
    assertEquals(response.status, 401);
  }
  assertEquals(lookups, []);
});

Deno.test("authenticated requests resolve sub, not IDs in the request", async () => {
  const { app, lookups } = setup("auth0|owner");
  const response = await app.request(
    "https://dodo.test/api/v1/book/foreign-id",
    {
      method: "DELETE",
    },
  );
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { userId });
  assertEquals(lookups, ["auth0|owner"]);
});

Deno.test("profile picture reads resolve the authenticated account", async () => {
  const { app, lookups } = setup("auth0|owner");
  const response = await app.request(
    `https://dodo.test/api/v1/user/${userId}/profile-picture`,
  );
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { userId });
  assertEquals(lookups, ["auth0|owner"]);
});

Deno.test("verified API bearer resolves the same account without a browser session", async () => {
  const { app, lookups } = setup(undefined, userId, "auth0|mobile");
  const response = await app.request("https://dodo.test/api/v1/book", {
    method: "GET",
    headers: { Authorization: "Bearer valid-api-token" },
  });
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { userId });
  assertEquals(lookups, ["auth0|mobile"]);
});

Deno.test("invalid bearer never falls back to a valid browser session", async () => {
  const { app, lookups } = setup("auth0|browser", userId, "auth0|mobile");
  const response = await app.request("https://dodo.test/api/v1/book", {
    headers: { Authorization: "Bearer invalid" },
  });
  assertEquals(response.status, 401);
  assertEquals(lookups, []);
});

Deno.test("only a verified mobile bearer can reach provisioning", async () => {
  const { app, lookups } = setup("auth0|browser", userId, "auth0|mobile");
  const url = "https://dodo.test/api/v1/user/mobile-login";
  assertEquals((await app.request(url, { method: "POST" })).status, 401);
  assertEquals(
    (await app.request(url, {
      method: "POST",
      headers: { Authorization: "Bearer invalid" },
    })).status,
    401,
  );
  const valid = await app.request(url, {
    method: "POST",
    headers: { Authorization: "Bearer valid-api-token" },
  });
  assertEquals(valid.status, 200);
  assertEquals(lookups, []);
});

Deno.test("a session without a matching account cannot write", async () => {
  const { app } = setup("auth0|unknown", null);
  const response = await app.request("https://dodo.test/api/v1/library", {
    method: "POST",
  });
  assertEquals(response.status, 401);
});

Deno.test("cross-origin writes are blocked before lookup", async () => {
  const { app, lookups } = setup("auth0|owner");
  const response = await app.request("https://dodo.test/api/v1/user/update", {
    method: "PATCH",
    headers: { origin: "https://attacker.test" },
  });
  assertEquals(response.status, 403);
  assertEquals(lookups, []);
});

Deno.test("Auth0 login and callback are public", async () => {
  const { app, lookups } = setup();
  for (
    const [method, path] of [
      ["GET", "/api/v1/user/login"],
      ["POST", "/api/v1/user/callback"],
    ]
  ) {
    const response = await app.request(`https://dodo.test${path}`, { method });
    assertEquals(response.status, 200);
  }
  assertEquals(lookups, []);
});
