import type { EntityManager } from "@mikro-orm/postgresql";
import { BaseRepository } from "@app/rest/lib/base-class/base-repository.ts";
import {
  BookSchema,
  LibrarySchema,
  UserSchema,
} from "@package/database/schema/postgresql-schema/index.ts";
import type { CreateBookRequest } from "@app/rest/book/dtos/book-request-dto.ts";

export class BookRepository extends BaseRepository<BookSchema> {
  constructor(em: EntityManager) {
    super(em, BookSchema);
  }

  async createBook(req: CreateBookRequest): Promise<BookSchema> {
    const now = new Date();

    return await this.create({
      id: req.id ?? crypto.randomUUID(),
      library: this.em.getReference(LibrarySchema, req.libraryId),
      user: this.em.getReference(UserSchema, req.userId),
      title: req.title,
      author: req.author,
      lastAccessedAt: req.lastAccessedAt
        ? new Date(req.lastAccessedAt)
        : undefined,
      progress: req.progress === undefined ? undefined : BigInt(req.progress),
      createdAt: now,
      updatedAt: now,
    });
  }
}
