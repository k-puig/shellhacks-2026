import { Hono } from "hono";
import { deleteCookie, getCookie } from "hono/cookie";
import { callback, logout, type OIDCEnv } from "@auth0/auth0-hono";
import * as z from "@zod/zod";
import { BaseError } from "@app/rest/lib/base-class/base-error.ts";
import {
  changeUserProfilePictureRequestZObject,
  fetchUserRequestZObject,
  updateUserRequestZObject,
} from "@app/rest/user/dtos/user-request-dto.ts";

import { UserService } from "@app/rest/user/user-service.ts";

type UserEnv = OIDCEnv & {
  Variables: { authenticatedUserId?: string; authenticatedSub?: string };
};

export function createUserRouter(
  userService: UserService,
): Hono<UserEnv> {
  const user = new Hono<UserEnv>();

  // Remove every cookie sent to this backend before ending the Auth0 session.
  // All backend-issued cookies use the root path, which must match to expire them.
  user.get("/logout", (c, next) => {
    for (const name of Object.keys(getCookie(c))) {
      deleteCookie(c, name, { path: "/" });
    }

    return logout()(c, next);
  });

  user.get("/", async (c) => {
    const userId = c.get("authenticatedUserId");
    if (!userId) return c.text("Unauthorized", 401);
    try {
      const response = await userService.fetchUser({ id: userId });
      return c.json(response, response.code);
    } catch (error) {
      if (error instanceof BaseError) {
        return c.json({
          code: error.code,
          message: error.message,
          content: null,
        }, error.code);
      }
      throw error;
    }
  });

  // The Auth0 callback writes the session cookie to its response. Redirect once so
  // the browser sends that new cookie before we attempt to read the session.
  user.get("/callback", callback({ redirectAfterLogin: false }), (c) => {
    return c.redirect("/api/v1/user/callback/complete", 302);
  });

  user.get("/callback/complete", async (c) => {
    const session = await c.var.auth0Client?.getSession(c);
    const userData = z.object({
      name: z.string(),
      sub: z.string(),
    });

    const parsedUserData = await userData.safeParseAsync(session?.user);
    if (!parsedUserData.success) {
      console.error(
        "Auth0 session user did not match expected schema:",
        parsedUserData.error.issues,
      );
      return c.newResponse("unable to parse user name and/or sub", 400);
    }

    await userService.createUserOrDoNothing({
      id: crypto.randomUUID(),
      username: parsedUserData.data.name,
      authId: parsedUserData.data.sub,
    });

    return c.redirect("/", 302);
  });

  // A verified API bearer token may provision the matching account once.
  user.post("/mobile-login", async (c) => {
    const sub = c.get("authenticatedSub");
    if (!sub) {
      return c.json({
        code: 401,
        message: "Authentication required",
        content: null,
      }, 401);
    }

    const userInfo = await userService.createUserOrDoNothing({
      id: crypto.randomUUID(),
      username: "Reader",
      authId: sub,
    });
    return c.json(userInfo, 200);
  });

  user.delete("/delete", async (c) => {
    const userId = c.get("authenticatedUserId");
    if (!userId) {
      return c.text("Unauthorized", 401);
    }

    try {
      const response = await userService.deleteUser(userId);

      return c.json(response, response.code);
    } catch (error) {
      if (error instanceof BaseError) {
        return c.json({
          code: error.code,
          message: error.message,
          content: null,
        }, error.code);
      }

      throw error;
    }
  });

  user.patch("/profile-picture", async (c) => {
    const userId = c.get("authenticatedUserId");
    if (!userId) {
      return c.text("Unauthorized", 401);
    }

    const parsedUserData = await changeUserProfilePictureRequestZObject
      .safeParseAsync(
        await c.req.parseBody(),
      );

    if (!parsedUserData.success) {
      return c.json({
        code: 400,
        message: "Invalid profile picture request",
        content: parsedUserData.error.issues,
      }, 400);
    }

    try {
      const response = await userService.uploadOrDeleteProfilePicture(
        userId,
        parsedUserData.data,
      );

      return c.json(response, response.code);
    } catch (error) {
      if (error instanceof BaseError) {
        return c.json({
          code: error.code,
          message: error.message,
          content: null,
        }, error.code);
      }

      throw error;
    }
  });

  user.get("/:id/profile-picture", async (c) => {
    const userId = c.get("authenticatedUserId");
    if (!userId) {
      return c.text("Unauthorized", 401);
    }

    const parsedUserData = await fetchUserRequestZObject.safeParseAsync({
      id: c.req.param("id"),
    });

    if (!parsedUserData.success) {
      return c.json({
        code: 400,
        message: "Invalid user id",
        content: parsedUserData.error.issues,
      }, 400);
    }

    if (parsedUserData.data.id !== userId) {
      return c.json(
        { code: 404, message: "User not found", content: null },
        404,
      );
    }

    try {
      const profilePicture = await userService.fetchProfilePicture(
        parsedUserData.data,
        userId,
      );
      const headers: Record<string, string> = {
        "Content-Type": profilePicture.contentType,
      };

      if (profilePicture.contentLength !== undefined) {
        headers["Content-Length"] = String(profilePicture.contentLength);
      }

      return c.body(profilePicture.body, 200, headers);
    } catch (error) {
      if (error instanceof BaseError) {
        return c.json({
          code: error.code,
          message: error.message,
          content: null,
        }, error.code);
      }

      throw error;
    }
  });

  user.patch("/update", async (c) => {
    const userId = c.get("authenticatedUserId");
    if (!userId) {
      return c.text("Unauthorized", 401);
    }

    const parsedUserData = await updateUserRequestZObject.safeParseAsync(
      await c.req.json(),
    );

    if (!parsedUserData.success) {
      return c.json({
        code: 400,
        message: "Invalid update user request",
        content: parsedUserData.error.issues,
      }, 400);
    }

    try {
      const response = await userService.updateUser(
        userId,
        parsedUserData.data,
      );

      return c.json(response, response.code);
    } catch (error) {
      if (error instanceof BaseError) {
        return c.json({
          code: error.code,
          message: error.message,
          content: null,
        }, error.code);
      }

      throw error;
    }
  });

  return user;
}
