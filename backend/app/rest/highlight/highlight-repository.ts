import type { Ref } from "@mikro-orm/core";
import type { EntityManager } from "@mikro-orm/postgresql";
import { BaseRepository } from "@app/rest/lib/base-class/base-repository.ts";
import {
  BookSchema,
  HighlightSchema,
} from "@package/database/schema/postgresql-schema/index.ts";
import type { CreateHighlightRequest } from "@app/rest/highlight/dtos/highlight-request-dto.ts";

export class HighlightRepository extends BaseRepository<HighlightSchema> {
  constructor(em: EntityManager) {
    super(em, HighlightSchema, (id) => ({ id }));
  }

  getBookReference(id: string): Ref<BookSchema> {
    return this.em.getReference(BookSchema, id, { wrapped: true });
  }

  async hasOwnedBook(bookId: string, userId: string): Promise<boolean> {
    return (await this.em.findOne(BookSchema, { id: bookId, user: userId })) !==
      null;
  }

  async findOwnedHighlight(
    id: string,
    userId: string,
  ): Promise<HighlightSchema | null> {
    return await this.findOne({ id, book: { user: userId } });
  }

  async deleteOwnedHighlight(id: string, userId: string): Promise<boolean> {
    return await this.delete({ id, book: { user: userId } });
  }

  async createHighlight(
    req: CreateHighlightRequest,
  ): Promise<HighlightSchema> {
    const now = new Date();

    return await this.create({
      id: crypto.randomUUID(),
      book: this.getBookReference(req.bookId),
      start: req.start,
      end: req.end,
      createdAt: now,
      updatedAt: now,
    });
  }
}
