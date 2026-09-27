import type { EntityManager } from "@mikro-orm/postgresql";
import { BaseRepository } from "@app/rest/lib/base-class/base-repository.ts";
import {
  BookSchema,
  HighlightSchema,
  NoteSchema,
} from "@package/database/schema/postgresql-schema/index.ts";
import type { CreateNoteRequest } from "@app/rest/note/dtos/note-request-dto.ts";

// A note belongs to whoever owns its highlight's book (note → highlight →
// book.user), so every lookup filters through that chain.
export class NoteRepository extends BaseRepository<NoteSchema> {
  constructor(em: EntityManager) {
    super(em, NoteSchema, (id: string) => ({ id }));
  }

  async ownsHighlight(highlightId: string, userId: string): Promise<boolean> {
    return await this.em.count(HighlightSchema, {
      id: highlightId,
      book: { user: userId },
    }) > 0;
  }

  async ownsBook(bookId: string, userId: string): Promise<boolean> {
    return await this.em.count(BookSchema, { id: bookId, user: userId }) > 0;
  }

  async hasNote(highlightId: string): Promise<boolean> {
    return await this.em.count(NoteSchema, { highlight: highlightId }) > 0;
  }

  async findOwned(id: string, userId: string): Promise<NoteSchema | null> {
    return await this.findOne({ id, highlight: { book: { user: userId } } });
  }

  async createNote(newNote: CreateNoteRequest): Promise<NoteSchema> {
    return await this.create({
      id: crypto.randomUUID(),
      highlight: this.em.getReference(HighlightSchema, newNote.highlightId, {
        wrapped: true,
      }),
      text: newNote.text,
    });
  }

  async findByBookId(bookId: string, userId: string): Promise<NoteSchema[]> {
    return await this.em.find(
      NoteSchema,
      { highlight: { book: { id: bookId, user: userId } } },
      { populate: ["highlight"] },
    );
  }

  async deleteOwnedNote(id: string, userId: string): Promise<boolean> {
    return await this.em.transactional(async (em) => {
      const note = await em.findOne(NoteSchema, {
        id,
        highlight: { book: { user: userId } },
      });
      if (!note) return false;
      em.remove(note);
      await em.flush();
      return true;
    });
  }

  async updateNoteText(
    id: string,
    userId: string,
    text: string,
  ): Promise<NoteSchema | null> {
    const note = await this.findOwned(id, userId);
    if (!note) {
      return null;
    }

    note.text = text;
    await this.em.flush();
    return note;
  }
}
