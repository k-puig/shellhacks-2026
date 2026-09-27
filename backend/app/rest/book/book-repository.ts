import { LockMode, type Ref } from "@mikro-orm/core";
import type { EntityManager } from "@mikro-orm/postgresql";
import { BaseRepository } from "@app/rest/lib/base-class/base-repository.ts";
import {
  BookSchema,
  HighlightSchema,
  LibrarySchema,
  NoteSchema,
  UserSchema,
} from "@package/database/schema/postgresql-schema/index.ts";
import type { CreateBookRequest } from "@app/rest/book/dtos/book-request-dto.ts";

type CreateBookRecordRequest = Omit<CreateBookRequest, "book"> & {
  id: string;
  userId: string;
  s3Key: string;
};

export class BookRepository extends BaseRepository<BookSchema> {
  constructor(em: EntityManager) {
    super(em, BookSchema, (id) => ({ id }));
  }

  getLibraryReference(id: string): Ref<LibrarySchema> {
    return this.em.getReference(LibrarySchema, id, { wrapped: true });
  }

  getUserReference(id: string): Ref<UserSchema> {
    return this.em.getReference(UserSchema, id, { wrapped: true });
  }

  async hasOwnedLibrary(libraryId: string, userId: string): Promise<boolean> {
    return (await this.em.findOne(LibrarySchema, {
      id: libraryId,
      owner: userId,
    })) !== null;
  }

  async findOwnedBook(id: string, userId: string): Promise<BookSchema | null> {
    return await this.findOne({ id, user: userId });
  }

  async findByUser(userId: string): Promise<BookSchema[]> {
    return await this.em.find(BookSchema, { user: userId }, {
      orderBy: { createdAt: "desc" },
    });
  }

  async deleteOwnedBook(id: string, userId: string): Promise<string | null> {
    return await this.em.transactional(async (em) => {
      const book = await em.findOne(
        BookSchema,
        { id, user: userId },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      );
      if (!book) return null;

      const highlights = await em.find(HighlightSchema, { book: id });
      const highlightIds = highlights.map((highlight) => highlight.id);
      if (highlightIds.length > 0) {
        await em.nativeDelete(NoteSchema, { highlight: { $in: highlightIds } });
        await em.nativeDelete(HighlightSchema, { id: { $in: highlightIds } });
      }
      em.remove(book);
      await em.flush();
      return book.s3Key;
    });
  }

  async createBook(req: CreateBookRecordRequest): Promise<BookSchema> {
    const now = new Date();
    return await this.create({
      id: req.id,
      library: req.libraryId
        ? this.getLibraryReference(req.libraryId)
        : undefined,
      user: this.getUserReference(req.userId),
      title: req.title,
      author: req.author,
      s3Key: req.s3Key,
      lastAccessedAt: req.lastAccessedAt
        ? new Date(req.lastAccessedAt)
        : undefined,
      progress: req.progress === undefined ? undefined : BigInt(req.progress),
      createdAt: now,
      updatedAt: now,
    });
  }
}
