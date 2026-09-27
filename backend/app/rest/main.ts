import { Hono } from "hono";
import { S3Client } from "@package/s3/client.ts";
import { api } from "./api.ts";

const app = new Hono();
app.route("/api/v1", api);

const baseURL = Deno.env.get("BASE_URL");
const publicProtocol = baseURL ? new URL(baseURL).protocol : undefined;
const authCallbackPath = "/api/v1/user/callback";

await new S3Client().ensureBucketsExist();

Deno.serve((request) => {
  const requestUrl = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");

  if (
    request.method === "GET" &&
    requestUrl.pathname === authCallbackPath &&
    publicProtocol === "https:" &&
    forwardedProto === "https"
  ) {
    requestUrl.protocol = publicProtocol;
    return app.fetch(new Request(requestUrl, request));
  }

  return app.fetch(request);
});
