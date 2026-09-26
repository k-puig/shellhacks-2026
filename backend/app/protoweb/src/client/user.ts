import * as z from "zod";

const CurrentUserInfo = z.object({
  id: z.uuidv4(),
  username: z.string(),
  authId: z.string(),
});
export async function getCurrentUserInfo(): Promise<
  z.infer<typeof CurrentUserInfo>
> {
  const res = await fetch("/api/v1/user");

  if (!res.ok) {
    throw res;
  }

  const json = await res.json();
  const userInfo = await CurrentUserInfo.safeParseAsync(json);

  if (!userInfo.success) {
    throw userInfo.error;
  }
  return userInfo.data;
}
