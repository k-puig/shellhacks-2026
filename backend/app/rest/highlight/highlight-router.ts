import { Hono } from "hono";
import * as z from "@zod/zod";
import type { AuthEnv } from "@app/rest/lib/auth/current-user.ts";
import { handleRouteError } from "@app/rest/lib/base-class/error-handler.ts";
import {
  createHighlightRequestZObj,
  deleteHighlightRequestZObj,
  fetchHighlightRequestZObj,
} from "@app/rest/highlight/dtos/highlight-request-dto.ts";
import { HighlightService } from "@app/rest/highlight/highlight-service.ts";

// Mounted behind requireUser (api.ts): only the signed-in user's highlights.
export function createHighlightRouter(
  highlightService: HighlightService,
): Hono<AuthEnv> {
  const highlight = new Hono<AuthEnv>();
  highlight.onError(handleRouteError);

  const invalid = (message: string, issues: unknown) => ({
    code: 400 as const,
    message,
    content: issues,
  });

  highlight.post("/", async (c) => {
    const parsed = await createHighlightRequestZObj.safeParseAsync(
      await c.req.json(),
    );
    if (!parsed.success) {
      return c.json(
        invalid("Invalid highlight request", parsed.error.issues),
        400,
      );
    }

    const response = await highlightService.createHighlight(
      parsed.data,
      c.var.user.id,
    );
    return c.json(response, 201);
  });

  // A book's highlights, in reading order.
  highlight.get("/book/:bookId", async (c) => {
    const parsed = await z.uuidv4().safeParseAsync(c.req.param("bookId"));
    if (!parsed.success) {
      return c.json(invalid("Invalid book id", parsed.error.issues), 400);
    }

    return c.json(
      await highlightService.listHighlights(parsed.data, c.var.user.id),
    );
  });

  highlight.get("/:id", async (c) => {
    const parsed = await fetchHighlightRequestZObj.safeParseAsync({
      id: c.req.param("id"),
    });
    if (!parsed.success) {
      return c.json(invalid("Invalid highlight id", parsed.error.issues), 400);
    }

    return c.json(
      await highlightService.fetchHighlight(parsed.data, c.var.user.id),
    );
  });

  // Also deletes the note attached to the highlight.
  highlight.delete("/:id", async (c) => {
    const parsed = await deleteHighlightRequestZObj.safeParseAsync({
      id: c.req.param("id"),
    });
    if (!parsed.success) {
      return c.json(invalid("Invalid highlight id", parsed.error.issues), 400);
    }

    return c.json(
      await highlightService.deleteHighlight(parsed.data, c.var.user.id),
    );
  });

  return highlight;
}
