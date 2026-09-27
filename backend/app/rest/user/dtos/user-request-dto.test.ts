import { assert, assertEquals } from "@std/assert";
import {
  changeUserProfilePictureRequestZObject,
  updateUserRequestZObject,
} from "./user-request-dto.ts";

Deno.test("user mutations reject client-supplied IDs", () => {
  const id = crypto.randomUUID();
  const picture = new File(["image"], "picture.png", { type: "image/png" });

  assert(
    !updateUserRequestZObject.safeParse({ id, username: "new name" }).success,
  );
  assert(
    !changeUserProfilePictureRequestZObject.safeParse({
      id,
      newProfilePicture: picture,
    }).success,
  );
});

Deno.test("profile picture requests support upload and removal without an ID", () => {
  const picture = new File(["image"], "picture.png", { type: "image/png" });

  assert(
    changeUserProfilePictureRequestZObject.safeParse({
      key: "client-key-is-ignored",
      newProfilePicture: picture,
    }).success,
  );
  assertEquals(
    changeUserProfilePictureRequestZObject.safeParse({ key: "" }).success,
    true,
  );
  assert(
    !changeUserProfilePictureRequestZObject.safeParse({ key: "x" }).success,
  );
});
