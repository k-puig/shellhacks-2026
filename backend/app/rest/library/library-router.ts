import { Hono } from "hono";
import { BaseError } from "@app/rest/lib/base-class/base-error.ts";
import {
  createLibraryRequestZObj,
  deleteLibraryRequestZObj,
  fetchLibraryRequestZObj,
} from "@app/rest/library/dtos/library-request-dto.ts";
import { LibraryService } from "@app/rest/library/library-service.ts";

export function createLibraryRouter(libraryService: LibraryService): Hono {
  const library = new Hono();

  library.post("/", async (c) => {
    const parsed = await createLibraryRequestZObj.safeParseAsync(
      await c.req.json(),
    );

    if (!parsed.success) {
      return c.json({ code: 400, message: "Invalid library request", content: parsed.error.issues });
    }

    const response = await libraryService.createLibrary(parsed.data);
    return c.json(response);
  });

  library.get("/:id", async (c) => {
    const parsed = await fetchLibraryRequestZObj.safeParseAsync({
      id: c.req.param("id"),
    });

    if (!parsed.success) {
      return c.json({ code: 400, message: "Invalid library id", content: parsed.error.issues });
    }

    try {
      const response = await libraryService.fetchLibrary(parsed.data);
      return c.json(response);
    } catch (error) {
      if (error instanceof BaseError) {
        return c.json({ code: error.code, message: error.message, content: null });
      }

      throw error;
    }
  });

  library.delete("/:id", async (c) => {
    const parsed = await deleteLibraryRequestZObj.safeParseAsync({
      id: c.req.param("id"),
    });

    if (!parsed.success) {
      return c.json({ code: 400, message: "Invalid library id", content: parsed.error.issues });
    }

    try {
      const response = await libraryService.deleteLibrary(parsed.data);
      return c.json(response);
    } catch (error) {
      if (error instanceof BaseError) {
        return c.json({ code: error.code, message: error.message, content: null });
      }

      throw error;
    }
  });

  return library;
}
