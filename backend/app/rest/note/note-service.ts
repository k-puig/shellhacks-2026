import type { EntityManager } from "@mikro-orm/postgresql";
import { HighlightSchema } from "@package/database/schema/postgresql-schema/index.ts";
import { NoteSchema } from "@package/database/schema/postgresql-schema/index.ts";
import { createBaseResponse } from "@app/rest/lib/base-class/base-response.ts";
import { BaseError } from "@app/rest/lib/base-class/base-error.ts";
import type {
  ChangeNoteByBookRequest,
  CreateNoteRequest,
  DeleteNoteRequest,
  FetchNoteRequest,
  UpdateNoteRequest,
} from "@app/rest/note/dtos/note-request-dto.ts";
import type {
  CreateNoteBaseResponse,
  DeleteNoteBaseResponse,
  FetchNoteBaseResponse,
  FetchNotesByBookBaseResponse,
  UpdateNoteBaseResponse,
} from "@app/rest/note/dtos/note-response.dto.ts";
import { NoteRepository } from "@app/rest/note/note-repository.ts";

type NoteHighlight = NoteSchema["highlight"] | string | HighlightSchema;

function getHighlightId(highlight: NoteHighlight): string {
  if (typeof highlight === "string") {
    return highlight;
  }

  if (
    typeof highlight === "object" &&
    highlight !== null &&
    "id" in highlight &&
    typeof highlight.id === "string"
  ) {
    return highlight.id;
  }

  throw new Error("Note highlight does not contain a valid ID");
}

export class NoteService {
  private readonly noteRepository: NoteRepository;

  constructor(em: EntityManager) {
    this.noteRepository = new NoteRepository(em);
  }

  async createNote(
    req: CreateNoteRequest,
    userId: string,
  ): Promise<CreateNoteBaseResponse> {
    if (!await this.noteRepository.ownsHighlight(req.highlightId, userId)) {
      throw new BaseError(404, "Highlight not found");
    }
    // One note per highlight.
    if (await this.noteRepository.hasNote(req.highlightId)) {
      throw new BaseError(409, "This highlight already has a note");
    }

    const note = await this.noteRepository.createNote(req);

    const highlightId = getHighlightId(note.highlight);

    return await createBaseResponse(201, "Note created successfully", {
      id: note.id,
      highlightId,
      text: note.text,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    });
  }

  async fetchNote(
    req: FetchNoteRequest,
    userId: string,
  ): Promise<FetchNoteBaseResponse> {
    const note = await this.noteRepository.findOwned(req.id, userId);

    if (!note) {
      throw new BaseError(404, "Note not found");
    }

    const highlightId = getHighlightId(note.highlight);

    return await createBaseResponse(200, "Note fetched", {
      id: note.id,
      highlightId,
      text: note.text,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    });
  }

  async fetchNotesByBook(
    req: ChangeNoteByBookRequest,
    userId: string,
  ): Promise<FetchNotesByBookBaseResponse> {
    if (!await this.noteRepository.ownsBook(req.bookId, userId)) {
      throw new BaseError(404, "Book not found");
    }
    const notes = await this.noteRepository.findByBookId(req.bookId, userId);

    const content = notes.map((n) => {
      const highlightId = getHighlightId(n.highlight);

      return {
        id: n.id,
        highlightId,
        text: n.text,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      };
    });

    return await createBaseResponse(200, "Notes fetched for book", content);
  }

  async updateNote(
    req: UpdateNoteRequest,
    userId: string,
  ): Promise<UpdateNoteBaseResponse> {
    const updated = await this.noteRepository.updateNoteText(
      req.id,
      userId,
      req.text,
    );

    if (!updated) {
      throw new BaseError(404, "Note not found");
    }

    const highlightId = getHighlightId(updated.highlight);

    return await createBaseResponse(200, "Note updated successfully", {
      id: updated.id,
      highlightId,
      text: updated.text,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  }

  async deleteNote(
    req: DeleteNoteRequest,
    userId: string,
  ): Promise<DeleteNoteBaseResponse> {
    const wasDeleted = await this.noteRepository.deleteOwnedNote(
      req.id,
      userId,
    );

    if (!wasDeleted) {
      throw new BaseError(404, "Note not found");
    }

    return await createBaseResponse(200, "Note deleted successfully", {
      id: req.id,
    });
  }
}
