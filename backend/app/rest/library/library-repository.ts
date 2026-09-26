import type { EntityManager } from "@mikro-orm/postgresql";
import { BaseRepository } from "@app/rest/lib/base-class/base-repository.ts";
import { LibrarySchema } from "@package/database/schema/postgresql-schema/index.ts";
import type { CreateLibraryRequest } from "@app/rest/library/dtos/library-request-dto.ts";

export class LibraryRepository extends BaseRepository<LibrarySchema> {
  constructor(em: EntityManager) {
    super(em, LibrarySchema);
  }

  async createLibrary(req: CreateLibraryRequest): Promise<LibrarySchema> {
    const now = new Date();

    return await this.create({
      id: req.id ?? crypto.randomUUID(),
      name: req.name,
      createdAt: now,
      updatedAt: now,
    });
  }
}
