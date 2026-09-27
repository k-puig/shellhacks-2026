import { S3 } from "@aws-sdk/client-s3";
import {
  EPUB_S3_BUCKET,
  PFP_S3_BUCKET,
  S3settings,
} from "@package/s3/config.ts";
import type {
  DeleteBookInput,
  DeleteProfilePictureInput,
  DownloadBookInput,
  UploadBookInput,
  UploadProfilePictureInput,
} from "@package/s3/function-dtos.ts";

export class S3Client {
  private readonly s3: S3;

  constructor() {
    this.s3 = new S3(S3settings);
  }

  async uploadBook(obj: UploadBookInput): Promise<string> {
    await this.s3.putObject({
      Bucket: EPUB_S3_BUCKET,
      Key: obj.key,
      Body: obj.book.stream(),
      ContentType: obj.book.type || "application/epub+zip",
    });

    return obj.key;
  }

  // The stored .epub, streamed (the phone can't reach RustFS directly).
  async downloadBook(
    obj: DownloadBookInput,
  ): Promise<{ body: ReadableStream<Uint8Array>; size?: number }> {
    const res = await this.s3.getObject({
      Bucket: EPUB_S3_BUCKET,
      Key: obj.key,
    });
    if (!res.Body) throw new Error(`Book file ${obj.key} is empty`);

    return {
      body: res.Body.transformToWebStream() as ReadableStream<Uint8Array>,
      size: res.ContentLength,
    };
  }

  async deleteBook(obj: DeleteBookInput): Promise<void> {
    await this.s3.deleteObject({
      Bucket: EPUB_S3_BUCKET,
      Key: obj.key,
    });
  }

  async uploadProfilePicture(obj: UploadProfilePictureInput): Promise<string> {
    await this.s3.putObject({
      Bucket: PFP_S3_BUCKET,
      Key: obj.key,
      Body: obj.profilePicture.stream(),
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
}
