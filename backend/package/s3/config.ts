import type { S3ClientConfig } from "@aws-sdk/client-s3";

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const hostname = requiredEnv("AWS_S3_HOSTNAME");
const port = Deno.env.get("AWS_S3_PORT");
const sessionToken = Deno.env.get("AWS_S3_SESSION_TOKEN");

export const S3_BUCKET = requiredEnv("AWS_S3_BUCKET");

export const S3settings: S3ClientConfig = {
  region: Deno.env.get("AWS_REGION") ?? "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: requiredEnv("AWS_S3_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("AWS_S3_SECRET_KEY"),
    ...(sessionToken ? { sessionToken } : {}),
  },
  endpoint: `http://${hostname}${port ? `:${port}` : ""}`,
};
