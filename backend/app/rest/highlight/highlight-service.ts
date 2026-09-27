import type { EntityManager } from "@mikro-orm/postgresql";
import { HighlightSchema } from "@package/database/schema/postgresql-schema/index.ts";
import { createBaseResponse } from "@app/rest/lib/base-class/base-response.ts";
import { BaseError } from "@app/rest/lib/base-class/base-error.ts";
import type {
  CreateHighlightRequest,
  DeleteHighlightRequest,
  FetchHighlightRequest,
  UpdateHighlightRequest,
} from "@app/rest/highlight/dtos/highlight-request-dto.ts";
import type {
  CreateHighlightBaseResponse,
  DeleteHighlightBaseResponse,
  FetchHighlightBaseResponse,
  ListHighlightsBaseResponse,
  UpdateHighlightBaseResponse,
} from "@app/rest/highlight/dtos/highlight-response-dto.ts";
import { HighlightRepository } from "@app/rest/highlight/highlight-repository.ts";

function toHighlightContent(highlight: HighlightSchema) {
  return {
    id: highlight.id,
    bookId: highlight.book.id,
    start: Number(highlight.start),
    end: Number(highlight.end),
  };
}

export class HighlightService {
  private readonly highlightRepository: HighlightRepository;

  constructor(em: EntityManager) {
    this.highlightRepository = new HighlightRepository(em);
  }

  private async findOwned(
    id: string,
    userId: string,
  ): Promise<HighlightSchema> {
    const highlight = await this.highlightRepository.findOwnedHighlight(
      id,
      userId,
    );
    if (!highlight) throw new BaseError(404, "Highlight not found");
    return highlight;
  }

  private async requireBook(bookId: string, userId: string): Promise<void> {
    if (!await this.highlightRepository.hasOwnedBook(bookId, userId)) {
      throw new BaseError(404, "Book not found");
    }
  }

  async createHighlight(
    req: CreateHighlightRequest,
    userId: string,
  ): Promise<CreateHighlightBaseResponse> {
    await this.requireBook(req.bookId, userId);
    if (req.end < req.start) {
      throw new BaseError(400, "A highlight must end after it starts");
    }
    const highlight = await this.highlightRepository.createHighlight(req);
    return await createBaseResponse(
      201,
      "Highlight created",
      toHighlightContent(highlight),
    );
  }

  async listHighlights(
    bookId: string,
    userId: string,
  ): Promise<ListHighlightsBaseResponse> {
    await this.requireBook(bookId, userId);
    const highlights = await this.highlightRepository.findByBook(
      bookId,
      userId,
    );
    return await createBaseResponse(
      200,
      "Highlights fetched",
      highlights.map(toHighlightContent),
    );
  }

  async fetchHighlight(
    req: FetchHighlightRequest,
    userId: string,
  ): Promise<FetchHighlightBaseResponse> {
    const highlight = await this.findOwned(req.id, userId);
    return await createBaseResponse(
      200,
      "Highlight fetched",
      toHighlightContent(highlight),
    );
  }

  async updateHighlight(
    req: UpdateHighlightRequest,
    userId: string,
  ): Promise<UpdateHighlightBaseResponse> {
    const highlight = await this.findOwned(req.id, userId);
    if (req.bookId !== undefined) {
      await this.requireBook(req.bookId, userId);
    }
    const start = req.start ?? Number(highlight.start);
    const end = req.end ?? Number(highlight.end);
    if (end < start) {
      throw new BaseError(400, "A highlight must end after it starts");
    }
    if (req.bookId !== undefined) {
      highlight.book = this.highlightRepository.getBookReference(req.bookId);
    }
    if (req.start !== undefined) highlight.start = req.start;
    if (req.end !== undefined) highlight.end = req.end;
    await this.highlightRepository.flush();
    return await createBaseResponse(
      200,
      "Highlight updated",
      toHighlightContent(highlight),
    );
  }

  async deleteHighlight(
    req: DeleteHighlightRequest,
    userId: string,
  ): Promise<DeleteHighlightBaseResponse> {
    const wasDeleted = await this.highlightRepository.deleteOwnedHighlight(
      req.id,
      userId,
    );
    if (!wasDeleted) throw new BaseError(404, "Highlight not found");
    return await createBaseResponse(200, "Highlight deleted", { id: req.id });
  }
}
