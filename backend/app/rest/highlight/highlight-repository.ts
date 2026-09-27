import type { Ref } from "@mikro-orm/core";
import type { EntityManager } from "@mikro-orm/postgresql";
import { BaseRepository } from "@app/rest/lib/base-class/base-repository.ts";
import {
  BookSchema,
  HighlightSchema,
  NoteSchema,
} from "@package/database/schema/postgresql-schema/index.ts";
import type { CreateHighlightRequest } from "@app/rest/highlight/dtos/highlight-request-dto.ts";

// A highlight belongs to whoever owns its book, so every lookup filters
// through book.user.
export class HighlightRepository extends BaseRepository<HighlightSchema> {
  constructor(em: EntityManager) {
    super(em, HighlightSchema, (id) => ({ id }));
  }

  getBookReference(id: string): Ref<BookSchema> {
    return this.em.getReference(BookSchema, id, { wrapped: true });
  }

  async ownsBook(bookId: string, userId: string): Promise<boolean> {
    return await this.em.count(BookSchema, { id: bookId, user: userId }) > 0;
  }

  async findOwned(id: string, userId: string): Promise<HighlightSchema | null> {
    return await this.findOne({ id, book: { user: userId } });
  }

  // A book's highlights, in reading order.
  async findByBook(
    bookId: string,
    userId: string,
  ): Promise<HighlightSchema[]> {
    return await this.em.find(
      HighlightSchema,
      { book: { id: bookId, user: userId } },
      { orderBy: { start: "asc" } },
    );
  }

  async createHighlight(
    req: CreateHighlightRequest,
  ): Promise<HighlightSchema> {
    const now = new Date();

    return await this.create({
      id: req.id ?? crypto.randomUUID(),
      book: this.getBookReference(req.bookId),
      start: req.start,
      end: req.end,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Removes the highlight and the note attached to it (one note per highlight).
  async deleteWithNote(id: string): Promise<boolean> {
    await this.em.nativeDelete(NoteSchema, { highlight: id });
    return await this.deleteById(id);
  }
}
