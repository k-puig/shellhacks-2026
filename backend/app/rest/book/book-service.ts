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

  async createBook(req: CreateBookRequest): Promise<CreateBookBaseResponse> {
    const id = req.id ?? crypto.randomUUID();
    const s3Key = `books/${req.userId}/${id}.epub`;

    await this.s3Client.uploadBook({
      key: s3Key,
      book: req.book,
    });

    const book = await this.bookRepository.createBook({
      ...req,
      id,
      s3Key,
    });

    return await createBaseResponse(201, "Book created", toBookContent(book));
  }

  async fetchBook(req: FetchBookRequest): Promise<FetchBookBaseResponse> {
    const book = await this.bookRepository.findById(req.id);

    if (!book) {
      throw new BaseError(404, "Book not found");
    }

    return await createBaseResponse(200, "Book fetched", toBookContent(book));
  }

  async updateBook(req: UpdateBookRequest): Promise<UpdateBookBaseResponse> {
    const book = await this.bookRepository.findById(req.id);

    if (!book) {
      throw new BaseError(404, "Book not found");
    }

    book.library = req.libraryId
      ? this.bookRepository.getLibraryReference(req.libraryId)
      : book.library;
    book.user = req.userId
      ? this.bookRepository.getUserReference(req.userId)
      : book.user;
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

  async deleteBook(req: DeleteBookRequest): Promise<DeleteBookBaseResponse> {
    const book = await this.bookRepository.findById(req.id);

    if (!book) {
      throw new BaseError(404, "Book not found");
    }

    await this.s3Client.deleteBook({ key: book.s3Key });

    const wasDeleted = await this.bookRepository.deleteById(req.id);

    if (!wasDeleted) {
      throw new BaseError(404, "Book not found");
    }

    return await createBaseResponse(200, "Book deleted", {
      id: req.id,
    });
  }
}
