import { S3 } from "@aws-sdk/client-s3";
import {
  EPUB_S3_BUCKET,
  PFP_S3_BUCKET,
  S3settings,
} from "@package/s3/config.ts";
import type {
  DeleteBookInput,
  DeleteProfilePictureInput,
  FetchBookInput,
  FetchProfilePictureInput,
  FetchS3ObjectOutput,
  UploadBookInput,
  UploadProfilePictureInput,
} from "@package/s3/function-dtos.ts";

function toReadableStream(body: unknown): ReadableStream<Uint8Array> {
  if (body instanceof ReadableStream) {
    return body as ReadableStream<Uint8Array>;
  }

  if (
    body && typeof body === "object" && "transformToWebStream" in body &&
    typeof body.transformToWebStream === "function"
  ) {
    return body.transformToWebStream() as ReadableStream<Uint8Array>;
  }

  throw new Error("S3 object body is not a readable stream");
}

export class S3Client {
  private readonly s3: S3;

  constructor() {
    this.s3 = new S3(S3settings);
  }

  async uploadBook(obj: UploadBookInput): Promise<string> {
    await this.s3.putObject({
      Bucket: EPUB_S3_BUCKET,
      Key: obj.key,
      Body: new Uint8Array(await obj.book.arrayBuffer()),
      ContentLength: obj.book.size,
      ContentType: obj.book.type || "application/epub+zip",
    });

    return obj.key;
  }

  async deleteBook(obj: DeleteBookInput): Promise<void> {
    await this.s3.deleteObject({
      Bucket: EPUB_S3_BUCKET,
      Key: obj.key,
    });
  }

  async fetchBook(obj: FetchBookInput): Promise<FetchS3ObjectOutput> {
    const response = await this.s3.getObject({
      Bucket: EPUB_S3_BUCKET,
      Key: obj.key,
    });

    if (!response.Body) {
      throw new Error("Book object has no body");
    }

    return {
      body: toReadableStream(response.Body),
      contentLength: response.ContentLength,
      contentType: response.ContentType,
    };
  }

  async uploadProfilePicture(obj: UploadProfilePictureInput): Promise<string> {
    await this.s3.putObject({
      Bucket: PFP_S3_BUCKET,
      Key: obj.key,
      Body: new Uint8Array(await obj.profilePicture.arrayBuffer()),
      ContentLength: obj.profilePicture.size,
      ContentType: obj.profilePicture.type || "application/octet-stream",
    });

    return obj.key;
  }

  async deleteProfilePicture(obj: DeleteProfilePictureInput): Promise<void> {
    await this.s3.deleteObject({
      Bucket: PFP_S3_BUCKET,
      Key: obj.key,
    });
  }

  async fetchProfilePicture(
    obj: FetchProfilePictureInput,
  ): Promise<FetchS3ObjectOutput> {
    const response = await this.s3.getObject({
      Bucket: PFP_S3_BUCKET,
      Key: obj.key,
    });

    if (!response.Body) {
      throw new Error("Profile picture object has no body");
    }

    return {
      body: toReadableStream(response.Body),
      contentLength: response.ContentLength,
      contentType: response.ContentType,
    };
  }
}
