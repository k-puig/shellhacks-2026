import { Hono } from "hono";
import * as z from "@zod/zod";
import { handleRouteError } from "@app/rest/lib/base-class/error-handler.ts";
import {
  createHighlightRequestZObj,
  deleteHighlightRequestZObj,
  fetchHighlightRequestZObj,
} from "@app/rest/highlight/dtos/highlight-request-dto.ts";
import { HighlightService } from "@app/rest/highlight/highlight-service.ts";

export function createHighlightRouter(
  highlightService: HighlightService,
): Hono<{ Variables: { authenticatedUserId: string } }> {
  const highlight = new Hono<{ Variables: { authenticatedUserId: string } }>();
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
    return c.json(
      await highlightService.createHighlight(
        parsed.data,
        c.get("authenticatedUserId"),
      ),
    );
  });

  highlight.get("/book/:bookId", async (c) => {
    const parsed = await z.uuidv4().safeParseAsync(c.req.param("bookId"));
    if (!parsed.success) {
      return c.json(invalid("Invalid book id", parsed.error.issues), 400);
    }
    return c.json(
      await highlightService.listHighlights(
        parsed.data,
        c.get("authenticatedUserId"),
      ),
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
      await highlightService.fetchHighlight(
        parsed.data,
        c.get("authenticatedUserId"),
      ),
    );
  });

  highlight.delete("/:id", async (c) => {
    const parsed = await deleteHighlightRequestZObj.safeParseAsync({
      id: c.req.param("id"),
    });
    if (!parsed.success) {
      return c.json(invalid("Invalid highlight id", parsed.error.issues), 400);
    }
    return c.json(
      await highlightService.deleteHighlight(
        parsed.data,
        c.get("authenticatedUserId"),
      ),
    );
  });

  return highlight;
}
