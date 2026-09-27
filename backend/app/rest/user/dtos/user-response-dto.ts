import * as z from "@zod/zod";
import { baseResponseZObj } from "@app/rest/lib/base-class/base-response.ts";

export const createUserBaseResponseZObj = baseResponseZObj(
  z.object({
    id: z.uuidv4(),
    username: z.string(),
    authId: z.string(),
  }),
);

export const fetchUserBaseResponseZObj = baseResponseZObj(
  z.object({
    id: z.uuidv4(),
    username: z.string(),
    authId: z.string(),
  }),
);

export const updateUserBaseResponseZObj = baseResponseZObj(
  z.object({
    username: z.string(),
  }),
);

export const deleteUserBaseResponseZObj = baseResponseZObj(
  z.object({
    id: z.uuidv4(),
  }),
);

export const changeUserProfilePictureBaseResponseZObj = baseResponseZObj(
  z.object({
    id: z.uuidv4(),
    key: z.string(),
  }),
);

export type CreateUserBaseResponse = z.infer<
  typeof createUserBaseResponseZObj
>;
export type FetchUserBaseResponse = z.infer<typeof fetchUserBaseResponseZObj>;
export type UpdateUserBaseResponse = z.infer<
  typeof updateUserBaseResponseZObj
>;
export type DeleteUserBaseResponse = z.infer<
  typeof deleteUserBaseResponseZObj
>;
export type ChangeUserProfilePictureBaseResponse = z.infer<
  typeof changeUserProfilePictureBaseResponseZObj
>;

export type CreateUserResponse = CreateUserBaseResponse["content"];
export type FetchUserResponse = FetchUserBaseResponse["content"];
export type UpdateUserResponse = UpdateUserBaseResponse["content"];
export type DeleteUserResponse = DeleteUserBaseResponse["content"];
export type ChangeUserProfilePictureResponse =
  ChangeUserProfilePictureBaseResponse["content"];
