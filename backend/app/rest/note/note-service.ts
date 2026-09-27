import type { EntityManager } from "@mikro-orm/postgresql";
import { createBaseResponse } from "@app/rest/lib/base-class/base-response.ts";
import { BaseError } from "@app/rest/lib/base-class/base-error.ts";
import type {
    CreateNoteRequest,
    DeleteNoteRequest,
    FetchNoteRequest,
    FetchNotesByBookRequest,
    UpdateNoteRequest,
} from "@app/rest/note/dtos/note-request-dto.ts";
import type {
    CreateNoteBaseResponse,
    DeleteNoteBaseResponse,
    FetchNoteBaseResponse,
    FetchNotesByBookBaseResponse,
    UpdateNoteBaseResponse,
} from "@app/rest/note/dtos/note-response-dto.ts";
import { NoteRepository } from "@app/rest/note/note-repository.ts";

export class NoteService {
    private readonly noteRepository: NoteRepository;

    constructor(em: EntityManager) {
        this.noteRepository = new NoteRepository(em);
    }

    async createNote(req: CreateNoteRequest): Promise<CreateNoteBaseResponse> {
        const note = await this.noteRepository.createNote(req);

        const highlightId =
        typeof note.highlight === "string"
        ? note.highlight
        : (note.highlight as any)?.id ?? (note.highlight as any);

        return await createBaseResponse(201, "Note created successfully", {
            id: note.id,
            highlightId,
            text: note.text,
            createdAt: note.createdAt,
            updatedAt: note.updatedAt,
        });
    }

    async fetchNote(req: FetchNoteRequest): Promise<FetchNoteBaseResponse> {
        const note = await this.noteRepository.findById(req.id);

        if (!note) {
            throw new BaseError(404, "Note not found");
        }

        const highlightId =
        typeof note.highlight === "string"
        ? note.highlight
        : (note.highlight as any)?.id ?? (note.highlight as any);

        return await createBaseResponse(200, "Note fetched", {
            id: note.id,
            highlightId,
            text: note.text,
            createdAt: note.createdAt,
            updatedAt: note.updatedAt,
        });
    }

    async fetchNotesByBook(
        req: FetchNotesByBookRequest,
    ):    
    Promise<FetchNotesByBookBaseResponse> {
        const notes = await this.noteRepository.findByBookId(req.bookId);

        const content = notes.map((n) => {
            const highlightId =
            typeof n.highlight === "string"
            ? n.highlight
            : (n.highlight as any)?.id ?? (n.highlight as any);

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

    async updateNote(req: UpdateNoteRequest): Promise<UpdateNoteBaseResponse> {
        // NoteRepository has updateNoteText
        const updated = await this.noteRepository.updateNoteText(req.id, req.text);

        if (!updated) {
            throw new BaseError(404, "Note not found");
        }

        const highlightId =
        typeof updated.highlight === "string"
        ? updated.highlight
        : (updated.highlight as any)?.id ?? (updated.highlight as any);

        return await createBaseResponse(200, "Note updated successfully", {
            id: updated.id,
            highlightId,
            text: updated.text,
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt,
        });
    }

    async deleteNote(req: DeleteNoteRequest): Promise<DeleteNoteBaseResponse> {
        const wasDeleted = await this.noteRepository.deleteById(req.id);

        if (!wasDeleted) {
            throw new BaseError(404, "Note not found");
        }

        return await createBaseResponse(200, "Note deleted successfully", {
            id: req.id,
        });
    }
}