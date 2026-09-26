import type { EntityManager } from "@mikro-orm/postgresql";
import { BaseError } from "@app/rest/lib/base-class/base-error.ts";
import { createBaseResponse } from "@app/rest/lib/base-class/base-response.ts";
import type {
  CreateLibraryRequest,
  DeleteLibraryRequest,
  FetchLibraryRequest,
} from "@app/rest/library/dtos/library-request-dto.ts";
import type {
  CreateLibraryBaseResponse,
  DeleteLibraryBaseResponse,
  FetchLibraryBaseResponse,
} from "@app/rest/library/dtos/library-response-dto.ts";
import { LibraryRepository } from "@app/rest/library/library-repository.ts";

export class LibraryService {
  private readonly libraryRepository: LibraryRepository;

  constructor(em: EntityManager) {
    this.libraryRepository = new LibraryRepository(em);
  }

  async createLibrary(
    req: CreateLibraryRequest,
  ): Promise<CreateLibraryBaseResponse> {
    const library = await this.libraryRepository.createLibrary(req);

    return await createBaseResponse(201, "Library created", {
      id: library.id,
      name: library.name,
    });
  }

  async fetchLibrary(
    req: FetchLibraryRequest,
  ): Promise<FetchLibraryBaseResponse> {
    const library = await this.libraryRepository.findById(req.id);

    if (!library) {
      throw new BaseError(404, "Library not found");
    }

    return await createBaseResponse(200, "Library fetched", {
      id: library.id,
      name: library.name,
    });
  }

  async deleteLibrary(
    req: DeleteLibraryRequest,
  ): Promise<DeleteLibraryBaseResponse> {
    const wasDeleted = await this.libraryRepository.deleteById(req.id);

    if (!wasDeleted) {
      throw new BaseError(404, "Library not found");
    }

    return await createBaseResponse(200, "Library deleted", {
      id: req.id,
    });
  }
}
