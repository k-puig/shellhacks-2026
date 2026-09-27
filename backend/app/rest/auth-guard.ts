import type { OIDCEnv } from "@auth0/auth0-hono";
import type { MiddlewareHandler } from "hono";

export type AuthenticatedEnv = OIDCEnv & {
  Variables: { authenticatedUserId: string; authenticatedSub: string };
};

type VerifyBearer = (token: string) => Promise<string | null>;

export function requireAuthenticatedUser(
  findUserId: (sub: string) => Promise<string | null>,
  baseURL: string | undefined,
  verifyBearer?: VerifyBearer,
): MiddlewareHandler<AuthenticatedEnv> {
  return async (c, next) => {
    const path = c.req.path;
    const method = c.req.method;
    const mobileLogin = path === "/api/v1/user/mobile-login";
    const publicAuthPath = path === "/api/v1/user/login" ||
      path === "/api/v1/user/callback" ||
      path === "/api/v1/user/logout";
    const resourcePath = /^\/api\/v1\/(library|book|highlight|note)(\/|$)/.test(
      path,
    );
    const privateUserPath = path === "/api/v1/user" ||
      path === "/api/v1/user/" ||
      /^\/api\/v1\/user\/[^/]+\/profile-picture\/?$/.test(path);
    const safeMethod = ["GET", "HEAD", "OPTIONS"].includes(method);
    const needsUser = !publicAuthPath &&
      (resourcePath || privateUserPath || !safeMethod);

    if (!needsUser) {
      return next();
    }

    const authorization = c.req.header("authorization");
    const bearer = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
    // A supplied Authorization header must never fall back to browser cookies.
    if (authorization && !bearer) {
      return c.json({
        code: 401,
        message: "Invalid bearer token",
        content: null,
      }, 401);
    }

    let sub: string | null | undefined;
    if (bearer) {
      try {
        sub = await verifyBearer?.(bearer);
      } catch {
        sub = null;
      }
    } else if (!mobileLogin) {
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
      const session = await c.var.auth0Client?.getSession(c);
      sub = session?.user?.sub;
    }

    if (typeof sub !== "string" || !sub) {
      return c.json({
        code: 401,
        message: "Authentication required",
        content: null,
      }, 401);
    }

    c.set("authenticatedSub", sub);
    // This is the only route permitted to provision a user; its bearer is
    // already verified against this API's Auth0 audience above.
    if (mobileLogin) {
      return next();
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
