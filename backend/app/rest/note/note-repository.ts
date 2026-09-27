import type { EntityManager } from "@mikro-orm/postgresql";
import { BaseRepository } from "@app/rest/lib/base-class/base-repository.ts";
import { NoteSchema } from "@package/database/schema/postgresql-schema/index.ts";
import type { CreateNoteRequest } from "@app/rest/note/dtos/note-request-dto.ts";

export class NoteRepository extends BaseRepository<NoteSchema> {
    constructor(em: EntityManager) {
        super(em, NoteSchema);
    }
    async createNote(newNote: CreateNoteRequest): Promise<NoteSchema> {
        const note = this.em.create(NoteSchema, {
            highlight: newNote.highlightId,
            text: newNote.text,
        });

        await this.em.persistAndFlush(note);
        return note;
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