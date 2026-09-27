import * as z from "zod";

const CurrentUserInfo = z.object({
  id: z.uuidv4(),
  username: z.string(),
  authId: z.string(),
});
const CurrentUserInfoResponse = z.object({
  code: z.number(),
  message: z.string(),
  content: CurrentUserInfo,
});
export async function getCurrentUserInfo(): Promise<
  z.infer<typeof CurrentUserInfo>
> {
  const res = await fetch("/api/v1/user");

  if (!res.ok) {
    throw res;
  }

  const json = await res.json();
  const response = await CurrentUserInfoResponse.safeParseAsync(json);

  if (!response.success) {
    throw response.error;
  }
  return response.data.content;
}
