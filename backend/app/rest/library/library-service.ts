import type { EntityManager } from "@mikro-orm/postgresql";
import { BaseError } from "@app/rest/lib/base-class/base-error.ts";
import { createBaseResponse } from "@app/rest/lib/base-class/base-response.ts";
import type {
  CreateLibraryRequest,
  DeleteLibraryRequest,
  FetchLibraryRequest,
  UpdateLibraryRequest,
} from "@app/rest/library/dtos/library-request-dto.ts";
import type {
  CreateLibraryBaseResponse,
  DeleteLibraryBaseResponse,
  FetchLibraryBaseResponse,
  UpdateLibraryBaseResponse,
} from "@app/rest/library/dtos/library-response-dto.ts";
import { LibraryRepository } from "@app/rest/library/library-repository.ts";

export class LibraryService {
  private readonly libraryRepository: LibraryRepository;

  constructor(em: EntityManager) {
    this.libraryRepository = new LibraryRepository(em);
  }

  async createLibrary(
    req: CreateLibraryRequest,
    ownerId: string,
  ): Promise<CreateLibraryBaseResponse> {
    const library = await this.libraryRepository.createLibrary(req, ownerId);

    return await createBaseResponse(201, "Library created", {
      id: library.id,
      name: library.name,
    });
  }

  async fetchLibrary(
    req: FetchLibraryRequest,
    ownerId: string,
  ): Promise<FetchLibraryBaseResponse> {
    const library = await this.libraryRepository.findOwnedLibrary(
      req.id,
      ownerId,
    );

    if (!library) {
      throw new BaseError(404, "Library not found");
    }

    return await createBaseResponse(200, "Library fetched", {
      id: library.id,
      name: library.name,
    });
  }

  async updateLibrary(
    req: UpdateLibraryRequest,
    ownerId: string,
  ): Promise<UpdateLibraryBaseResponse> {
    const library = await this.libraryRepository.findOwnedLibrary(
      req.id,
      ownerId,
    );

    if (!library) {
      throw new BaseError(404, "Library not found");
    }

    library.name = req.name;
    await this.libraryRepository.flush();

    return await createBaseResponse(200, "Library updated", {
      id: library.id,
      name: library.name,
    });
  }

  async deleteLibrary(
    req: DeleteLibraryRequest,
    ownerId: string,
  ): Promise<DeleteLibraryBaseResponse> {
    const wasDeleted = await this.libraryRepository.deleteOwnedLibrary(
      req.id,
      ownerId,
    );

    if (!wasDeleted) {
      throw new BaseError(404, "Library not found");
    }

    return await createBaseResponse(200, "Library deleted", {
      id: req.id,
    });
  }
}
