import type { EntityManager } from "@mikro-orm/postgresql";
import { BaseError } from "@app/rest/lib/base-class/base-error.ts";
import { createBaseResponse } from "@app/rest/lib/base-class/base-response.ts";
import type {
  CreateBookRequest,
  DeleteBookRequest,
  FetchBookRequest,
  UpdateBookRequest,
} from "@app/rest/book/dtos/book-request-dto.ts";
import type {
  CreateBookBaseResponse,
  DeleteBookBaseResponse,
  FetchBookBaseResponse,
  UpdateBookBaseResponse,
} from "@app/rest/book/dtos/book-response-dto.ts";
import { BookRepository } from "@app/rest/book/book-repository.ts";
import { BookSchema } from "@package/database/schema/postgresql-schema/index.ts";
import { S3Client } from "@package/s3/client.ts";

function toBookContent(book: BookSchema) {
  return {
    id: book.id,
    libraryId: book.library.id,
    userId: book.user.id,
    title: book.title,
    author: book.author,
    s3Key: book.s3Key,
    lastAccessedAt: book.lastAccessedAt?.toISOString() ?? null,
    progress: book.progress === undefined ? null : Number(book.progress),
  };
}

export class BookService {
  private readonly bookRepository: BookRepository;
  private readonly s3Client: S3Client;

  constructor(em: EntityManager) {
    this.bookRepository = new BookRepository(em);
    this.s3Client = new S3Client();
  }

  async createBook(
    req: CreateBookRequest,
    userId: string,
  ): Promise<CreateBookBaseResponse> {
    if (!await this.bookRepository.hasOwnedLibrary(req.libraryId, userId)) {
      throw new BaseError(404, "Library not found");
    }

    const id = crypto.randomUUID();
    const s3Key = `books/${userId}/${id}.epub`;

    await this.s3Client.uploadBook({
      key: s3Key,
      book: req.book,
    });

    const book = await this.bookRepository.createBook({
      ...req,
      id,
      userId,
      s3Key,
    });

    return await createBaseResponse(201, "Book created", toBookContent(book));
  }

  async fetchBook(
    req: FetchBookRequest,
    userId: string,
  ): Promise<FetchBookBaseResponse> {
    const book = await this.bookRepository.findOwnedBook(req.id, userId);

    if (!book) {
      throw new BaseError(404, "Book not found");
    }

    return await createBaseResponse(200, "Book fetched", toBookContent(book));
  }

  async updateBook(
    req: UpdateBookRequest,
    userId: string,
  ): Promise<UpdateBookBaseResponse> {
    const book = await this.bookRepository.findOwnedBook(req.id, userId);

    if (!book) {
      throw new BaseError(404, "Book not found");
    }

    if (
      req.libraryId &&
      !await this.bookRepository.hasOwnedLibrary(req.libraryId, userId)
    ) {
      throw new BaseError(404, "Library not found");
    }

    book.library = req.libraryId
      ? this.bookRepository.getLibraryReference(req.libraryId)
      : book.library;
    book.title = req.title ?? book.title;
    book.author = req.author ?? book.author;
    book.lastAccessedAt = req.lastAccessedAt === undefined
      ? book.lastAccessedAt
      : req.lastAccessedAt === null
      ? undefined
      : new Date(req.lastAccessedAt);
    book.progress = req.progress === undefined
      ? book.progress
      : req.progress === null
      ? undefined
      : BigInt(req.progress);

    await this.bookRepository.flush();

    return await createBaseResponse(200, "Book updated", toBookContent(book));
  }

  async deleteBook(
    req: DeleteBookRequest,
    userId: string,
  ): Promise<DeleteBookBaseResponse> {
    const book = await this.bookRepository.findOwnedBook(req.id, userId);

    if (!book) {
      throw new BaseError(404, "Book not found");
    }

    await this.s3Client.deleteBook({ key: book.s3Key });

    const wasDeleted = await this.bookRepository.deleteOwnedBook(
      req.id,
      userId,
    );

    if (!wasDeleted) {
      throw new BaseError(404, "Book not found");
    }

    return await createBaseResponse(200, "Book deleted", {
      id: req.id,
    });
  }
}
