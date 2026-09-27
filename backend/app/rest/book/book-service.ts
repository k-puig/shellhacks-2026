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

export type FetchBookObjectResult = {
  body: ReadableStream<Uint8Array>;
  contentLength?: number;
  contentType: string;
  filename: string;
};

function toBookContent(book: BookSchema) {
  return {
    id: book.id,
    libraryId: book.library?.id ?? null,
    userId: book.user.id,
    title: book.title,
    author: book.author,
    s3Key: book.s3Key,
    lastAccessedAt: book.lastAccessedAt?.toISOString() ?? null,
    progress: book.progress === undefined || book.progress === null
      ? null
      : Number(book.progress),
  };
}

export class BookService {
  private readonly bookRepository: BookRepository;
  private readonly s3Client: S3Client;

  constructor(em: EntityManager) {
    this.bookRepository = new BookRepository(em);
    this.s3Client = new S3Client();
  }

  private async findOwned(id: string, userId: string): Promise<BookSchema> {
    const book = await this.bookRepository.findOwnedBook(id, userId);
    if (!book) throw new BaseError(404, "Book not found");
    return book;
  }

  async createBook(
    req: CreateBookRequest,
    userId: string,
  ): Promise<CreateBookBaseResponse> {
    if (
      req.libraryId &&
      !await this.bookRepository.hasOwnedLibrary(req.libraryId, userId)
    ) {
      throw new BaseError(404, "Library not found");
    }

    const id = crypto.randomUUID();
    const s3Key = `books/${userId}/${id}.epub`;
    await this.s3Client.uploadBook({ key: s3Key, book: req.book });
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

  async fetchBookObject(
    req: FetchBookRequest,
    userId: string,
  ): Promise<FetchBookObjectResult> {
    const book = await this.findOwned(req.id, userId);
    const s3Object = await this.s3Client.fetchBook({ key: book.s3Key });
    return {
      body: s3Object.body,
      contentLength: s3Object.contentLength,
      contentType: s3Object.contentType ?? "application/epub+zip",
      filename: `${book.title}.epub`,
    };
  }

  async updateBook(
    req: UpdateBookRequest,
    userId: string,
  ): Promise<UpdateBookBaseResponse> {
    const book = await this.findOwned(req.id, userId);
    if (
      req.libraryId &&
      !await this.bookRepository.hasOwnedLibrary(req.libraryId, userId)
    ) {
      throw new BaseError(404, "Library not found");
    }

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

  async updateProgress(
    req: UpdateBookProgressRequest,
    userId: string,
  ): Promise<UpdateBookBaseResponse> {
    return await this.updateBook({
      id: req.id,
      progress: req.position,
      lastAccessedAt: new Date().toISOString(),
    }, userId);
  }

  async deleteBook(
    req: DeleteBookRequest,
    userId: string,
  ): Promise<DeleteBookBaseResponse> {
    const s3Key = await this.bookRepository.deleteOwnedBook(req.id, userId);
    if (s3Key === null) throw new BaseError(404, "Book not found");

    try {
      await this.s3Client.deleteBook({ key: s3Key });
    } catch (error) {
      // The DB deletion has committed; retrying this HTTP request cannot recover the file.
      console.error(
        `Book ${req.id} deleted from DB, but S3 cleanup failed for key ${s3Key}; retry S3 deletion manually`,
        error,
      );
    }
    return await createBaseResponse(200, "Book deleted", { id: req.id });
  }
}
