import type { Ref } from "@mikro-orm/core";
import type { EntityManager } from "@mikro-orm/postgresql";
import { BaseRepository } from "@app/rest/lib/base-class/base-repository.ts";
import {
  BookSchema,
  LibrarySchema,
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

  async deleteOwnedBook(id: string, userId: string): Promise<boolean> {
    return await this.delete({ id, user: userId });
  }

  async createBook(req: CreateBookRecordRequest): Promise<BookSchema> {
    const now = new Date();

    return await this.create({
      id: req.id,
      library: this.getLibraryReference(req.libraryId),
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
