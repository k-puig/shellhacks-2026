import type { EntityManager } from "@mikro-orm/postgresql";
import { BaseError } from "@app/rest/lib/base-class/base-error.ts";
import { createBaseResponse } from "@app/rest/lib/base-class/base-response.ts";
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
  UpdateHighlightBaseResponse,
} from "@app/rest/highlight/dtos/highlight-response-dto.ts";
import { HighlightRepository } from "@app/rest/highlight/highlight-repository.ts";
import { HighlightSchema } from "@package/database/schema/postgresql-schema/index.ts";

function toHighlightContent(highlight: HighlightSchema) {
  return {
    id: highlight.id,
    bookId: highlight.book.id,
    start: highlight.start,
    end: highlight.end,
  };
}

export class HighlightService {
  private readonly highlightRepository: HighlightRepository;

  constructor(em: EntityManager) {
    this.highlightRepository = new HighlightRepository(em);
  }

  async createHighlight(
    req: CreateHighlightRequest,
    userId: string,
  ): Promise<CreateHighlightBaseResponse> {
    if (!await this.highlightRepository.hasOwnedBook(req.bookId, userId)) {
      throw new BaseError(404, "Book not found");
    }

    const highlight = await this.highlightRepository.createHighlight(req);

    return await createBaseResponse(
      201,
      "Highlight created",
      toHighlightContent(highlight),
    );
  }

  async fetchHighlight(
    req: FetchHighlightRequest,
    userId: string,
  ): Promise<FetchHighlightBaseResponse> {
    const highlight = await this.highlightRepository.findOwnedHighlight(
      req.id,
      userId,
    );

    if (!highlight) {
      throw new BaseError(404, "Highlight not found");
    }

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
    const highlight = await this.highlightRepository.findOwnedHighlight(
      req.id,
      userId,
    );

    if (!highlight) {
      throw new BaseError(404, "Highlight not found");
    }

    if (req.bookId !== undefined) {
      if (!await this.highlightRepository.hasOwnedBook(req.bookId, userId)) {
        throw new BaseError(404, "Book not found");
      }
      highlight.book = this.highlightRepository.getBookReference(req.bookId);
    }

    if (req.start !== undefined) {
      highlight.start = req.start;
    }

    if (req.end !== undefined) {
      highlight.end = req.end;
    }

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

    if (!wasDeleted) {
      throw new BaseError(404, "Highlight not found");
    }

    return await createBaseResponse(200, "Highlight deleted", {
      id: req.id,
    });
  }
}
