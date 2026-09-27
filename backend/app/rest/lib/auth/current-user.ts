import type { Context, MiddlewareHandler } from "hono";
import { getSignedCookie, setSignedCookie } from "hono/cookie";
import * as z from "@zod/zod";
import { createUserBaseResponseZObj } from "@app/rest/user/dtos/user-response-dto.ts";

// Who is calling: the signed "userinfo" cookie that both logins set (the
// website's Auth0 callback and the phone's /user/mobile-login).

export const USER_COOKIE = "userinfo";

export type CurrentUser = z.infer<typeof createUserBaseResponseZObj>["content"];

// Routers behind requireUser read the caller with c.var.user.
export type AuthEnv = { Variables: { user: CurrentUser } };

function cookieSecret(): string {
  const secret = Deno.env.get("COOKIE_SECRET");
  if (!secret) throw new Error("No cookie secret given");
  return secret;
}

// The signed-in user from the cookie, or null when there is none or it is invalid.
export async function readCurrentUser(c: Context): Promise<CurrentUser | null> {
  const cookie = await getSignedCookie(c, cookieSecret(), USER_COOKIE);
  if (!cookie) return null;
  try {
    const parsed = await createUserBaseResponseZObj.safeParseAsync(JSON.parse(cookie));
    return parsed.success ? parsed.data.content : null;
  } catch {
    return null;
  }
}

// Stores the user (the createUserOrDoNothing response) in the signed cookie.
export async function writeUserCookie(c: Context, userInfo: unknown): Promise<void> {
  await setSignedCookie(c, USER_COOKIE, JSON.stringify(userInfo), cookieSecret(), {
    path: "/",
    secure: false,
    httpOnly: true,
  });
}

// Rejects requests without a signed-in user; otherwise sets c.var.user.
export const requireUser: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const user = await readCurrentUser(c);
  if (!user) {
    return c.json({ code: 401, message: "Not logged in", content: null }, 401);
  }
  c.set("user", user);
  await next();
};
