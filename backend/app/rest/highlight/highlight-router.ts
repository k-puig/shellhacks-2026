import { Hono } from "hono";
import { BaseError } from "@app/rest/lib/base-class/base-error.ts";
import {
  createHighlightRequestZObj,
  deleteHighlightRequestZObj,
  fetchHighlightRequestZObj,
} from "@app/rest/highlight/dtos/highlight-request-dto.ts";
import { HighlightService } from "@app/rest/highlight/highlight-service.ts";

export function createHighlightRouter(
  highlightService: HighlightService,
): Hono {
  const highlight = new Hono();

  highlight.post("/", async (c) => {
    const parsed = await createHighlightRequestZObj.safeParseAsync(
      await c.req.json(),
    );

    if (!parsed.success) {
      return c.json({ code: 400, message: "Invalid highlight request", content: parsed.error.issues });
    }

    const response = await highlightService.createHighlight(parsed.data);
    return c.json(response);
  });

  highlight.get("/:id", async (c) => {
    const parsed = await fetchHighlightRequestZObj.safeParseAsync({
      id: c.req.param("id"),
    });

    if (!parsed.success) {
      return c.json({ code: 400, message: "Invalid highlight id", content: parsed.error.issues });
    }

    try {
      const response = await highlightService.fetchHighlight(parsed.data);
      return c.json(response);
    } catch (error) {
      if (error instanceof BaseError) {
        return c.json({ code: error.code, message: error.message, content: null });
      }

      throw error;
    }
  });

  highlight.delete("/:id", async (c) => {
    const parsed = await deleteHighlightRequestZObj.safeParseAsync({
      id: c.req.param("id"),
    });

    if (!parsed.success) {
      return c.json({ code: 400, message: "Invalid highlight id", content: parsed.error.issues });
    }

    try {
      const response = await highlightService.deleteHighlight(parsed.data);
      return c.json(response);
    } catch (error) {
      if (error instanceof BaseError) {
        return c.json({ code: error.code, message: error.message, content: null });
      }

      throw error;
    }
  });

  return highlight;
}
