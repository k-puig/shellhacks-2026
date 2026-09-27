import { Hono } from "hono";
import {
  deleteCookie,
  getCookie,
  getSignedCookie,
  setSignedCookie,
} from "hono/cookie";
import { callback, logout, type OIDCEnv } from "@auth0/auth0-hono";
import * as z from "@zod/zod";
import { BaseError } from "@app/rest/lib/base-class/base-error.ts";
import {
  changeUserProfilePictureRequestZObject,
  fetchUserRequestZObject,
  updateUserRequestZObject,
} from "@app/rest/user/dtos/user-request-dto.ts";
import { createUserBaseResponseZObj } from "@app/rest/user/dtos/user-response-dto.ts";
import { UserService } from "@app/rest/user/user-service.ts";

type UserEnv = OIDCEnv & {
  Variables: { authenticatedUserId?: string };
};

export function createUserRouter(
  userService: UserService,
): Hono<UserEnv> {
  const user = new Hono<UserEnv>();

  const cookieSecret = Deno.env.get("COOKIE_SECRET");
  if (!cookieSecret) {
    throw new Error("No cookie secret given");
  }

  // Remove every cookie sent to this backend before ending the Auth0 session.
  // All backend-issued cookies use the root path, which must match to expire them.
  user.get("/logout", (c, next) => {
    for (const name of Object.keys(getCookie(c))) {
      deleteCookie(c, name, { path: "/" });
    }

    return logout()(c, next);
  });

  // Current signed in user info
  user.get("/", async (c) => {
    const cookie = await getSignedCookie(
      c,
      cookieSecret,
      "userinfo",
    );
    try {
      const obj = JSON.parse(cookie || "");
      const userInfo = await createUserBaseResponseZObj.safeParseAsync(obj);
      if (!userInfo.success) {
        return c.text("could not parse cookie info", 401);
      }
      return c.json(userInfo.data);
    } catch {
      return c.text("bad cookie data", 401);
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

    const userInfo = await userService.createUserOrDoNothing({
      id: crypto.randomUUID(),
      username: parsedUserData.data.name,
      authId: parsedUserData.data.sub,
    });

    await setSignedCookie(
      c,
      "userinfo",
      JSON.stringify(userInfo),
      cookieSecret,
      {
        path: "/",
        secure: false,
        httpOnly: true,
      },
    );

    return c.redirect("/", 302);
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

    try {
      const profilePicture = await userService.fetchProfilePicture(
        parsedUserData.data,
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
