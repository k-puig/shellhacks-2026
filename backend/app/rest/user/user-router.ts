import { Hono } from "hono";
import {
  deleteCookie,
  getCookie,
  getSignedCookie,
  setSignedCookie,
} from "hono/cookie";
import { auth, callback, logout, type OIDCEnv } from "@auth0/auth0-hono";
import * as z from "@zod/zod";
import { BaseError } from "@app/rest/lib/base-class/base-error.ts";
import { updateUserRequestZObject } from "@app/rest/user/dtos/user-request-dto.ts";
import { createUserBaseResponseZObj } from "@app/rest/user/dtos/user-response-dto.ts";
import { UserService } from "@app/rest/user/user-service.ts";

export function createUserRouter(
  userService: UserService,
): Hono<OIDCEnv> {
  // Initialize router with auth middleware
  const baseURL = Deno.env.get("BASE_URL");

  if (baseURL !== "http://localhost:5173") {
    throw new Error(`Unexpected BASE_URL: ${JSON.stringify(baseURL)}`);
  }
  const user = new Hono<OIDCEnv>();
  user.use(
    auth({
      domain: Deno.env.get("AUTH0_DOMAIN"),
      clientID: Deno.env.get("AUTH0_CLIENT_ID"),
      clientSecret: Deno.env.get("AUTH0_CLIENT_SECRET"),
      baseURL: Deno.env.get("BASE_URL"),
      session: {
        secret: "password_at_least_32_characters_long",
      },
      routes: {
        login: "/api/v1/user/login",
        callback: "/api/v1/user/callback",
        logout: "/api/v1/user/logout",
      },
      customRoutes: ["callback", "logout"],
      authRequired: false,
    }),
  );

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
      "secret",
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
      "secret",
      {
        path: "/",
        secure: false,
        httpOnly: true,
      },
    );

    return c.redirect("/", 302);
  });

  user.delete("/delete", async (c) => {
    const session = await c.var.auth0Client?.getSession(c);
    const userData = z.object({
      sub: z.string(),
    });

    const parsedUserData = await userData.safeParseAsync(session?.user);
    if (!parsedUserData.success) {
      console.error(
        "Auth0 session user did not match expected schema:",
        parsedUserData.error.issues,
      );
      return c.newResponse("unable to parse user auth id", 400);
    }

    try {
      const response = await userService.deleteUserByAuthId(
        parsedUserData.data.sub,
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

  user.patch("/update", async (c) => {
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
      const response = await userService.updateUser(parsedUserData.data);

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
