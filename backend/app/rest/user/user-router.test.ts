import { assertEquals } from "@std/assert";
import { Hono } from "hono";
import { createUserRouter } from "./user-router.ts";
import type { UserService } from "./user-service.ts";

const owner = crypto.randomUUID();
const foreignUser = crypto.randomUUID();

function setup(authenticatedUserId?: string) {
  const calls: unknown[][] = [];
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]));
      controller.close();
    },
  });
  const service = {
    fetchProfilePicture: async (...args: unknown[]) => {
      calls.push(args);
      return { body, contentType: "image/png", contentLength: 3 };
    },
  } as unknown as UserService;
  const app = new Hono<{ Variables: { authenticatedUserId?: string } }>();
  if (authenticatedUserId) {
    app.use("*", async (c, next) => {
      c.set("authenticatedUserId", authenticatedUserId);
      await next();
    });
  }
  app.route("/user", createUserRouter(service));
  return { app, calls };
}

Deno.test("profile picture route requires the guard's authenticated DB user ID", async () => {
  const { app, calls } = setup();
  const response = await app.request(
    `http://localhost/user/${owner}/profile-picture`,
  );
  assertEquals(response.status, 401);
  assertEquals(calls, []);
});

Deno.test("profile picture route returns 404 for another user without calling the service", async () => {
  const { app, calls } = setup(owner);
  const response = await app.request(
    `http://localhost/user/${foreignUser}/profile-picture`,
  );
  assertEquals(response.status, 404);
  assertEquals(await response.json(), {
    code: 404,
    message: "User not found",
    content: null,
  });
  assertEquals(calls, []);
});

Deno.test("profile picture route forwards the principal and streams only its own image", async () => {
  const { app, calls } = setup(owner);
  const response = await app.request(
    `http://localhost/user/${owner}/profile-picture`,
  );
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("content-type"), "image/png");
  assertEquals(response.headers.get("content-length"), "3");
  assertEquals(
    new Uint8Array(await response.arrayBuffer()),
    new Uint8Array([1, 2, 3]),
  );
  assertEquals(calls, [[{ id: owner }, owner]]);
});

Deno.test("profile picture route retains invalid ID validation", async () => {
  const { app, calls } = setup(owner);
  const response = await app.request(
    "http://localhost/user/not-a-uuid/profile-picture",
  );
  assertEquals(response.status, 400);
  assertEquals(calls, []);
});
