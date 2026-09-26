import type { EntityManager } from "@mikro-orm/postgresql";
import { BaseError } from "@app/rest/lib/base-class/base-error.ts";
import { createBaseResponse } from "@app/rest/lib/base-class/base-response.ts";
import type {
  CreateBookRequest,
  DeleteBookRequest,
  FetchBookRequest,
} from "@app/rest/book/dtos/book-request-dto.ts";
import type {
  CreateBookBaseResponse,
  DeleteBookBaseResponse,
  FetchBookBaseResponse,
} from "@app/rest/book/dtos/book-response-dto.ts";
import { BookRepository } from "@app/rest/book/book-repository.ts";
import { BookSchema } from "@package/database/schema/postgresql-schema/index.ts";

function toBookContent(book: BookSchema) {
  return {
    id: book.id,
    libraryId: book.library.id,
    userId: book.user.id,
    title: book.title,
    author: book.author,
    lastAccessedAt: book.lastAccessedAt?.toISOString() ?? null,
    progress: book.progress === undefined ? null : Number(book.progress),
  };
}

export class BookService {
  private readonly bookRepository: BookRepository;

  constructor(em: EntityManager) {
    this.bookRepository = new BookRepository(em);
  }

  async createBook(req: CreateBookRequest): Promise<CreateBookBaseResponse> {
    const book = await this.bookRepository.createBook(req);

    return await createBaseResponse(201, "Book created", toBookContent(book));
  }

  async fetchBook(req: FetchBookRequest): Promise<FetchBookBaseResponse> {
    const book = await this.bookRepository.findById(req.id);

    if (!book) {
      throw new BaseError(404, "Book not found");
    }

    return await createBaseResponse(200, "Book fetched", toBookContent(book));
  }

  async deleteBook(req: DeleteBookRequest): Promise<DeleteBookBaseResponse> {
    const wasDeleted = await this.bookRepository.deleteById(req.id);

    if (!wasDeleted) {
      throw new BaseError(404, "Book not found");
    }

    return await createBaseResponse(200, "Book deleted", {
      id: req.id,
    });
  }
}
