import type { ContentfulStatusCode } from "hono/utils/http-status";
import * as z from "@zod/zod";

export const baseResponseZObj = <TContent extends z.ZodType>(
  content: TContent,
) =>
  z.object({
    code: z.custom<ContentfulStatusCode>(
      (value) => typeof value === "number",
    ),
    message: z.string(),
    content,
  });

export type BaseResponse<TContent> = {
  code: ContentfulStatusCode;
  message: string;
  content: TContent;
};

export type BaseResponseFromSchema<TContent extends z.ZodType> = BaseResponse<
  z.infer<TContent>
>;

export function createBaseResponse<TContent>(
  code: ContentfulStatusCode,
  message: string,
  content: TContent,
): BaseResponse<TContent> {
  return {
    code,
    message,
    content,
  };
}
