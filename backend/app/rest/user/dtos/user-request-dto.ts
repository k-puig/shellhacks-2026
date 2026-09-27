import * as z from "@zod/zod";

export const createUserRequestZObj = z.object({
  id: z.uuidv4(),
  username: z.string(),
  authId: z.string(),
});

export const fetchUserRequestZObject = z.object({
  id: z.uuidv4(),
});

export const updateUserRequestZObject = z.object({
  id: z.uuidv4(),
  username: z.string(),
});

export const deleteUserRequestZObject = z.object({
  id: z.uuidv4(),
});

export const changeUserProfilePictureRequestZObject = z.object({
  id: z.uuidv4(),
  key: z.string(),
  newProfilePicture: z.instanceof(File),
});

export type CreateUserRequest = z.infer<typeof createUserRequestZObj>;
export type FetchUserRequest = z.infer<typeof fetchUserRequestZObject>;
export type UpdateUserRequest = z.infer<typeof updateUserRequestZObject>;
export type DeleteUserRequest = z.infer<typeof deleteUserRequestZObject>;
export type ChangeUserProfilePictureRequest = z.infer<
  typeof changeUserProfilePictureRequestZObject
>;
