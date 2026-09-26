import * as z from "@zod/zod";

export const baseResponseZObj = <TContent extends z.ZodType>(
  content: TContent,
) =>
  z.object({
    code: z.number(),
    message: z.string(),
    content,
  });

export type BaseResponse<TContent> = {
  code: number;
  message: string;
  content: TContent;
};

export type BaseResponseFromSchema<TContent extends z.ZodType> = BaseResponse<
  z.infer<TContent>
>;

export async function createBaseResponse<TContent>(
  code: number,
  message: string,
  content: TContent,
): BaseResponse<TContent> {
  return {
    code,
    message,
    content,
  };
}
