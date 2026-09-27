import type { EntityManager } from "@mikro-orm/postgresql";
import { BaseRepository } from "@app/rest/lib/base-class/base-repository.ts";
import {
  LibrarySchema,
  UserSchema,
} from "@package/database/schema/postgresql-schema/index.ts";
import type { CreateLibraryRequest } from "@app/rest/library/dtos/library-request-dto.ts";

export class LibraryRepository extends BaseRepository<LibrarySchema> {
  constructor(em: EntityManager) {
    super(em, LibrarySchema, (id) => ({ id }));
  }

  async createLibrary(
    req: CreateLibraryRequest,
    ownerId: string,
  ): Promise<LibrarySchema> {
    const now = new Date();

    return await this.create({
      id: crypto.randomUUID(),
      owner: this.em.getReference(UserSchema, ownerId),
      name: req.name,
      createdAt: now,
      updatedAt: now,
    });
  }

  async findOwnedLibrary(
    id: string,
    ownerId: string,
  ): Promise<LibrarySchema | null> {
    return await this.findOne({ id, owner: ownerId });
  }

  async deleteOwnedLibrary(id: string, ownerId: string): Promise<boolean> {
    return await this.delete({ id, owner: ownerId });
  }
}
