import type { Ref } from "@mikro-orm/core";
import type { EntityManager } from "@mikro-orm/postgresql";
import { BaseRepository } from "@app/rest/lib/base-class/base-repository.ts";
import {
  BookSchema,
  HighlightSchema,
  NoteSchema,
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

  async findByBook(bookId: string, userId: string): Promise<HighlightSchema[]> {
    return await this.em.find(
      HighlightSchema,
      { book: { id: bookId, user: userId } },
      { orderBy: { start: "asc" } },
    );
  }

  async createHighlight(req: CreateHighlightRequest): Promise<HighlightSchema> {
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

  // Check ownership inside the transaction before deleting the dependent note.
  async deleteOwnedHighlight(id: string, userId: string): Promise<boolean> {
    return await this.em.transactional(async (em) => {
      const highlight = await em.findOne(HighlightSchema, {
        id,
        book: { user: userId },
      });
      if (!highlight) return false;
      await em.nativeDelete(NoteSchema, { highlight: id });
      em.remove(highlight);
      await em.flush();
      return true;
    });
  }
}
