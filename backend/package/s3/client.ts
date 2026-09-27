import { S3 } from "@aws-sdk/client-s3";
import {
  EPUB_S3_BUCKET,
  PFP_S3_BUCKET,
  S3settings,
} from "@package/s3/config.ts";
import type {
  DeleteBookInput,
  DeleteProfilePictureInput,
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
