import type { ErrorHandler } from "hono";
import { BaseError } from "@app/rest/lib/base-class/base-error.ts";

// Router onError: a service's BaseError becomes its status code, with the
// usual { code, message, content } body; anything else is a logged 500.
export const handleRouteError: ErrorHandler = (error, c) => {
  if (error instanceof BaseError) {
    return c.json(
      { code: error.code, message: error.message, content: null },
      error.code,
    );
  }
  console.error(`${c.req.method} ${c.req.path} failed:`, error);
  return c.json(
    { code: 500, message: "Something went wrong", content: null },
    500,
  );
};
