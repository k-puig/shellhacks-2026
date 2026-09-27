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

function isBucketNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const s3Error = error as {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };

  return s3Error.$metadata?.httpStatusCode === 404 ||
    s3Error.name === "NotFound" || s3Error.name === "NoSuchBucket" ||
    s3Error.Code === "NoSuchBucket";
}

function isBucketAlreadyOwned(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const s3Error = error as { name?: string; Code?: string };
  return s3Error.name === "BucketAlreadyOwnedByYou" ||
    s3Error.Code === "BucketAlreadyOwnedByYou";
}

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

  async ensureBucketsExist(): Promise<void> {
    for (const Bucket of new Set([EPUB_S3_BUCKET, PFP_S3_BUCKET])) {
      try {
        await this.s3.headBucket({ Bucket });
      } catch (error) {
        if (!isBucketNotFound(error)) {
          throw error;
        }

        try {
          await this.s3.createBucket({ Bucket });
        } catch (createError) {
          if (!isBucketAlreadyOwned(createError)) {
            throw createError;
          }
        }
      }
    }
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
