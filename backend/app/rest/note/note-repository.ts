import type { EntityManager } from "@mikro-orm/postgresql";
import { BaseRepository } from "@app/rest/lib/base-class/base-repository.ts";
import {
  HighlightSchema,
  NoteSchema,
} from "@package/database/schema/postgresql-schema/index.ts";
import type { CreateNoteRequest } from "@app/rest/note/dtos/note-request-dto.ts";

export class NoteRepository extends BaseRepository<NoteSchema> {
  constructor(em: EntityManager) {
    super(em, NoteSchema, (id: string) => ({ id }));
  }
  async createNote(newNote: CreateNoteRequest): Promise<NoteSchema> {
    return await this.create({
      highlight: this.em.getReference(HighlightSchema, newNote.highlightId),
      text: newNote.text,
    });
  }
  async findByBookId(bookId: string): Promise<NoteSchema[]> {
    return await this.em.find(
      NoteSchema,
      { highlight: { book: bookId } },
      { populate: ["highlight"] },
    );
  }
  async updateNoteText(id: string, text: string): Promise<NoteSchema | null> {
    const note = await this.findById(id);
    if (!note) {
      return null;
    }

    note.text = text;
    await this.em.flush();
    return note;
  }
}
