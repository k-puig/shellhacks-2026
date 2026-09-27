import type { EntityManager } from "@mikro-orm/postgresql";
import { BaseError } from "@app/rest/lib/base-class/base-error.ts";
import { createBaseResponse } from "@app/rest/lib/base-class/base-response.ts";
import type {
  CreateBookRequest,
  DeleteBookRequest,
  FetchBookRequest,
  UpdateBookProgressRequest,
  UpdateBookRequest,
} from "@app/rest/book/dtos/book-request-dto.ts";
import type {
  CreateBookBaseResponse,
  DeleteBookBaseResponse,
  FetchBookBaseResponse,
  ListBooksBaseResponse,
  UpdateBookBaseResponse,
} from "@app/rest/book/dtos/book-response-dto.ts";
import { BookRepository } from "@app/rest/book/book-repository.ts";
import { BookSchema } from "@package/database/schema/postgresql-schema/index.ts";
import { S3Client } from "@package/s3/client.ts";

function toBookContent(book: BookSchema) {
  return {
    id: book.id,
    libraryId: book.library?.id ?? null,
    userId: book.user.id,
    title: book.title,
    author: book.author,
    s3Key: book.s3Key,
    lastAccessedAt: book.lastAccessedAt?.toISOString() ?? null,
    progress: book.progress === undefined ? null : Number(book.progress),
  };
}

// Every method acts for the signed-in user (userId from requireUser). Another
// user's book is "not found", so its existence isn't revealed.
export class BookService {
  private readonly bookRepository: BookRepository;
  private readonly s3Client: S3Client;

  constructor(em: EntityManager) {
    this.bookRepository = new BookRepository(em);
    this.s3Client = new S3Client();
  }

  private async findOwned(id: string, userId: string): Promise<BookSchema> {
    const book = await this.bookRepository.findById(id);
    if (!book || book.user.id !== userId) {
      throw new BaseError(404, "Book not found");
    }
    return book;
  }

  async createBook(
    req: CreateBookRequest,
    userId: string,
  ): Promise<CreateBookBaseResponse> {
    const id = req.id ?? crypto.randomUUID();
    if (await this.bookRepository.findById(id)) {
      throw new BaseError(409, "A book with this id already exists");
    }
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

  async listBooks(userId: string): Promise<ListBooksBaseResponse> {
    const books = await this.bookRepository.findByUser(userId);
    return await createBaseResponse(
      200,
      "Books fetched",
      books.map(toBookContent),
    );
  }

  async fetchBook(
    req: FetchBookRequest,
    userId: string,
  ): Promise<FetchBookBaseResponse> {
    const book = await this.findOwned(req.id, userId);
    return await createBaseResponse(200, "Book fetched", toBookContent(book));
  }

  // The book's .epub from S3 (RustFS), streamed to the caller.
  async fetchBookFile(req: FetchBookRequest, userId: string) {
    const book = await this.findOwned(req.id, userId);
    return await this.s3Client.downloadBook({ key: book.s3Key });
  }

  async updateBook(
    req: UpdateBookRequest,
    userId: string,
  ): Promise<UpdateBookBaseResponse> {
    const book = await this.findOwned(req.id, userId);

    book.library = req.libraryId === undefined
      ? book.library
      : req.libraryId === null
      ? undefined
      : this.bookRepository.getLibraryReference(req.libraryId);
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

  // Saves where the reader is, and when they last read.
  async updateProgress(
    req: UpdateBookProgressRequest,
    userId: string,
  ): Promise<UpdateBookBaseResponse> {
    return await this.updateBook(
      {
        id: req.id,
        progress: req.position,
        lastAccessedAt: new Date().toISOString(),
      },
      userId,
    );
  }

  async deleteBook(
    req: DeleteBookRequest,
    userId: string,
  ): Promise<DeleteBookBaseResponse> {
    const book = await this.findOwned(req.id, userId);

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
