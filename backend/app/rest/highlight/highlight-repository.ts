import type { EntityManager } from "@mikro-orm/postgresql";
import { BaseRepository } from "@app/rest/lib/base-class/base-repository.ts";
import {
  BookSchema,
  HighlightSchema,
} from "@package/database/schema/postgresql-schema/index.ts";
import type { CreateHighlightRequest } from "@app/rest/highlight/dtos/highlight-request-dto.ts";

export class HighlightRepository extends BaseRepository<HighlightSchema> {
  constructor(em: EntityManager) {
    super(em, HighlightSchema);
  }

  async createHighlight(
    req: CreateHighlightRequest,
  ): Promise<HighlightSchema> {
    const now = new Date();

    return await this.create({
      id: req.id ?? crypto.randomUUID(),
      book: this.em.getReference(BookSchema, req.bookId),
      start: req.start,
      end: req.end,
      createdAt: now,
      updatedAt: now,
    });
  }
}
