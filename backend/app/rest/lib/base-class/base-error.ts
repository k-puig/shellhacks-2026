import type { ContentfulStatusCode } from "hono/utils/http-status";

export class BaseError extends Error {
  public code: ContentfulStatusCode;

  constructor(code: ContentfulStatusCode, message: string | null) {
    super(message ?? "Something went wrong");
    this.code = code;
  }
}
