import { assertEquals, assertRejects } from "@std/assert";
import { BaseError } from "@app/rest/lib/base-class/base-error.ts";
import type { S3Client } from "@package/s3/client.ts";
import type { UserRepository } from "./user-repository.ts";
import { UserService } from "./user-service.ts";

const owner = crypto.randomUUID();
const foreignUser = crypto.randomUUID();
const key = `profile-pictures/${owner}/profile-picture`;

function setup(user: { s3Key?: string } | null = { s3Key: key }) {
  const calls: string[] = [];
  const repository = {
    findById: async (id: string) => {
      calls.push(`findById:${id}`);
      return user;
    },
  } as unknown as UserRepository;
  const body = new ReadableStream<Uint8Array>();
  const s3 = {
    fetchProfilePicture: async ({ key }: { key: string }) => {
      calls.push(`fetchProfilePicture:${key}`);
      return { body, contentType: "image/png", contentLength: 42 };
    },
  } as unknown as S3Client;
  const service = Object.assign(Object.create(UserService.prototype), {
    userRepository: repository,
    s3Client: s3,
  }) as UserService;
  return { service, calls, body };
}

async function expectNotFound(action: () => Promise<unknown>, message: string) {
  const error = await assertRejects(action, BaseError, message);
  assertEquals(error.code, 404);
}

Deno.test("profile picture service rejects a foreign ID without DB or S3 access", async () => {
  const { service, calls } = setup();
  await expectNotFound(
    () => service.fetchProfilePicture({ id: foreignUser }, owner),
    "User not found",
  );
  assertEquals(calls, []);
});

Deno.test("profile picture service looks up only the authenticated user", async () => {
  const { service, calls, body } = setup();
  const result = await service.fetchProfilePicture({ id: owner }, owner);
  assertEquals(result, { body, contentType: "image/png", contentLength: 42 });
  assertEquals(calls, [`findById:${owner}`, `fetchProfilePicture:${key}`]);
});

Deno.test("profile picture service returns 404 without fetching S3 when the user or key is missing", async () => {
  for (
    const [user, message] of [
      [null, "User not found"],
      [{}, "Profile picture not found"],
    ] as const
  ) {
    const { service, calls } = setup(user);
    await expectNotFound(
      () => service.fetchProfilePicture({ id: owner }, owner),
      message,
    );
    assertEquals(calls, [`findById:${owner}`]);
  }
});
