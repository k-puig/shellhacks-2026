import { assertEquals, assertRejects } from "@std/assert";
import { Hono } from "hono";
import { BaseError } from "../lib/base-class/base-error.ts";
import { createLibraryRouter } from "./library-router.ts";
import { LibraryService } from "./library-service.ts";
import type { LibraryRepository } from "./library-repository.ts";

const owner = crypto.randomUUID();
const libraryId = crypto.randomUUID();

function setup() {
  const calls: unknown[][] = [];
  const repository = {
    createLibrary: async (...args: unknown[]) => {
      calls.push(["createLibrary", ...args]);
      return { id: libraryId, name: "New" };
    },
    findOwnedLibrary: async (...args: unknown[]) => {
      calls.push(["findOwnedLibrary", ...args]);
      return null;
    },
    deleteOwnedLibrary: async (...args: unknown[]) => {
      calls.push(["deleteOwnedLibrary", ...args]);
      return false;
    },
    flush: async () => {
      calls.push(["flush"]);
    },
  } as unknown as LibraryRepository;
  const service = Object.assign(Object.create(LibraryService.prototype), {
    libraryRepository: repository,
  }) as LibraryService;
  return { service, calls };
}

async function expectNotFound(action: () => Promise<unknown>) {
  const error = await assertRejects(action, BaseError, "Library not found");
  assertEquals(error.code, 404);
}

Deno.test("library fetch, update, and delete reject another owner's library without mutation", async () => {
  const { service, calls } = setup();
  await expectNotFound(() => service.fetchLibrary({ id: libraryId }, owner));
  await expectNotFound(() =>
    service.updateLibrary({ id: libraryId, name: "Changed" }, owner)
  );
  await expectNotFound(() => service.deleteLibrary({ id: libraryId }, owner));
  assertEquals(calls, [
    ["findOwnedLibrary", libraryId, owner],
    ["findOwnedLibrary", libraryId, owner],
    ["deleteOwnedLibrary", libraryId, owner],
  ]);
});

Deno.test("library creation assigns the authenticated owner", async () => {
  const { service, calls } = setup();
  const response = await service.createLibrary({ name: "New" }, owner);
  assertEquals(response.code, 201);
  assertEquals(calls, [["createLibrary", { name: "New" }, owner]]);
});

Deno.test("library router forwards the authenticated principal to the service", async () => {
  const calls: unknown[][] = [];
  const service = {
    fetchLibrary: async (...args: unknown[]) => {
      calls.push(args);
      return { code: 200, message: "Library fetched", content: null };
    },
  } as unknown as LibraryService;
  const app = new Hono<{ Variables: { authenticatedUserId: string } }>();
  app.use("*", async (c, next) => {
    c.set("authenticatedUserId", owner);
    await next();
  });
  app.route("/library", createLibraryRouter(service));

  const response = await app.request(`http://localhost/library/${libraryId}`);
  assertEquals(response.status, 200);
  assertEquals(calls, [[{ id: libraryId }, owner]]);
});
