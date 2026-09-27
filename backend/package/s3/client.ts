import { S3 } from "@aws-sdk/client-s3";
import { EPUB_S3_BUCKET, S3settings } from "@package/s3/config.ts";

export type UploadBookInput = {
  key: string;
  book: File;
};

export type DeleteBookInput = {
  key: string;
};

export class S3Client {
  private readonly s3: S3;

  constructor() {
    this.s3 = new S3(S3settings);
  }

  async uploadBook({ key, book }: UploadBookInput): Promise<string> {
    await this.s3.putObject({
      Bucket: EPUB_S3_BUCKET,
      Key: key,
      Body: book.stream(),
      ContentType: book.type || "application/epub+zip",
    });

    return key;
  }

  async deleteBook({ key }: DeleteBookInput): Promise<void> {
    await this.s3.deleteObject({
      Bucket: EPUB_S3_BUCKET,
      Key: key,
    });
  }
}
