import type { EntityManager } from "@mikro-orm/postgresql";
import { BaseError } from "@app/rest/lib/base-class/base-error.ts";
import { createBaseResponse } from "@app/rest/lib/base-class/base-response.ts";
import type {
  CreateHighlightRequest,
  DeleteHighlightRequest,
  FetchHighlightRequest,
} from "@app/rest/highlight/dtos/highlight-request-dto.ts";
import type {
  CreateHighlightBaseResponse,
  DeleteHighlightBaseResponse,
  FetchHighlightBaseResponse,
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
  ): Promise<CreateHighlightBaseResponse> {
    const highlight = await this.highlightRepository.createHighlight(req);

    return await createBaseResponse(
      201,
      "Highlight created",
      toHighlightContent(highlight),
    );
  }

  async fetchHighlight(
    req: FetchHighlightRequest,
  ): Promise<FetchHighlightBaseResponse> {
    const highlight = await this.highlightRepository.findById(req.id);

    if (!highlight) {
      throw new BaseError(404, "Highlight not found");
    }

    return await createBaseResponse(
      200,
      "Highlight fetched",
      toHighlightContent(highlight),
    );
  }

  async deleteHighlight(
    req: DeleteHighlightRequest,
  ): Promise<DeleteHighlightBaseResponse> {
    const wasDeleted = await this.highlightRepository.deleteById(req.id);

    if (!wasDeleted) {
      throw new BaseError(404, "Highlight not found");
    }

    return await createBaseResponse(200, "Highlight deleted", {
      id: req.id,
    });
  }
}
