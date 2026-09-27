import type { OIDCEnv } from "@auth0/auth0-hono";
import type { MiddlewareHandler } from "hono";

export type AuthenticatedEnv = OIDCEnv & {
  Variables: { authenticatedUserId: string };
};

export function requireAuthenticatedUser(
  findUserId: (sub: string) => Promise<string | null>,
  baseURL: string | undefined,
): MiddlewareHandler<AuthenticatedEnv> {
  return async (c, next) => {
    const path = c.req.path;
    const method = c.req.method;
    const publicAuthPath = path === "/api/v1/user/login" ||
      path === "/api/v1/user/callback" ||
      path === "/api/v1/user/logout";
    const resourcePath = /^\/api\/v1\/(library|book|highlight)(\/|$)/.test(
      path,
    );
    const safeMethod = ["GET", "HEAD", "OPTIONS"].includes(method);
    const needsUser = !publicAuthPath && (resourcePath || !safeMethod);

    if (!needsUser) {
      return next();
    }

    const session = await c.var.auth0Client?.getSession(c);
    const sub = session?.user?.sub;
    if (typeof sub !== "string" || !sub) {
      return c.json({
        code: 401,
        message: "Authentication required",
        content: null,
      }, 401);
    }

    // Auth0 session cookies should not authorize cross-origin writes.
    if (!safeMethod) {
      const origin = c.req.header("origin");
      if (
        c.req.header("sec-fetch-site") === "cross-site" ||
        (origin && baseURL && origin !== new URL(baseURL).origin)
      ) {
        return c.json({
          code: 403,
          message: "Cross-origin write forbidden",
          content: null,
        }, 403);
      }
    }

    const userId = await findUserId(sub);
    if (!userId) {
      return c.json({
        code: 401,
        message: "User account not found",
        content: null,
      }, 401);
    }

    c.set("authenticatedUserId", userId);
    return next();
  };
}
