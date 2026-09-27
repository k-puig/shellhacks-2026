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
  s3Key: string;
};

export class BookRepository extends BaseRepository<BookSchema> {
  constructor(em: EntityManager) {
    super(em, BookSchema, (id) => ({ id }));
  }

  getLibraryReference(id: string): Ref<LibrarySchema> {
    return this.em.getReference(LibrarySchema, id);
  }

  getUserReference(id: string): Ref<UserSchema> {
    return this.em.getReference(UserSchema, id);
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
