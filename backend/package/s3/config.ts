import type { S3ClientConfig } from "@aws-sdk/client-s3";

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const hostname = "rustfs";
const port = "9000";

export const EPUB_S3_BUCKET = "epub";
export const PFP_S3_BUCKET = "pfp";

export const S3settings: S3ClientConfig = {
  region: Deno.env.get("AWS_REGION") ?? "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: requiredEnv("RUSTFS_ACCESS_KEY"),
    secretAccessKey: requiredEnv("RUSTFS_SECRET_KEY"),
  },
  endpoint: `http://${hostname}${port ? `:${port}` : ""}`,
};
