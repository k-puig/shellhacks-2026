import type { EntityManager } from "@mikro-orm/postgresql";
import { createBaseResponse } from "@app/rest/lib/base-class/base-response.ts";
import { BaseError } from "@app/rest/lib/base-class/base-error.ts";
import type {
  ChangeUserProfilePictureRequest,
  CreateUserRequest,
  FetchUserRequest,
  UpdateUserRequest,
} from "@app/rest/user/dtos/user-request-dto.ts";
import type {
  ChangeUserProfilePictureBaseResponse,
  CreateUserBaseResponse,
  DeleteUserBaseResponse,
  FetchUserBaseResponse,
  UpdateUserBaseResponse,
} from "@app/rest/user/dtos/user-response-dto.ts";
import { UserRepository } from "@app/rest/user/user-repository.ts";
import { S3Client } from "@package/s3/client.ts";

export type FetchProfilePictureResult = {
  body: ReadableStream<Uint8Array>;
  contentLength?: number;
  contentType: string;
};

export class UserService {
  private readonly userRepository: UserRepository;
  private readonly s3Client: S3Client;

  constructor(em: EntityManager) {
    this.userRepository = new UserRepository(em);
    this.s3Client = new S3Client();
  }

  async createUserOrDoNothing(
    req: CreateUserRequest,
  ): Promise<CreateUserBaseResponse> {
    const user = await this.userRepository.createUserOrIgnore(req);

    return await createBaseResponse(200, "User created or already exists", {
      id: user.id,
      username: user.username,
      authId: user.authId,
    });
  }

  async fetchUser(req: FetchUserRequest): Promise<FetchUserBaseResponse> {
    const user = await this.userRepository.findById(req.id);

    if (!user) {
      throw new BaseError(404, "User not found");
    }

    return await createBaseResponse(200, "User fetched", {
      id: user.id,
      username: user.username,
      authId: user.authId,
    });
  }

  async updateUser(
    userId: string,
    req: UpdateUserRequest,
  ): Promise<UpdateUserBaseResponse> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new BaseError(404, "User not found");
    }

    user.username = req.username;
    await this.userRepository.flush();

    return await createBaseResponse(200, "User updated", {
      username: user.username,
    });
  }

  async fetchProfilePicture(
    req: FetchUserRequest,
    userId: string,
  ): Promise<FetchProfilePictureResult> {
    if (req.id !== userId) {
      throw new BaseError(404, "User not found");
    }

    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new BaseError(404, "User not found");
    }

    if (!user.s3Key) {
      throw new BaseError(404, "Profile picture not found");
    }

    const s3Object = await this.s3Client.fetchProfilePicture({
      key: user.s3Key,
    });

    return {
      body: s3Object.body,
      contentLength: s3Object.contentLength,
      contentType: s3Object.contentType ?? "application/octet-stream",
    };
  }

  async deleteUser(userId: string): Promise<DeleteUserBaseResponse> {
    const wasUserDeleted = await this.userRepository.deleteById(userId);

    if (!wasUserDeleted) {
      throw new BaseError(404, "User not found");
    }

    return await createBaseResponse(200, "User deleted successfully", {
      id: userId,
    });
  }

  async uploadOrDeleteProfilePicture(
    userId: string,
    req: ChangeUserProfilePictureRequest,
  ): Promise<ChangeUserProfilePictureBaseResponse> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new BaseError(404, "User not found");
    }

    const ownedKey = `profile-pictures/${user.id}/profile-picture`;

    if (req.key === "") {
      // Legacy stored keys cannot be trusted to identify an owned object.
      if (user.s3Key === ownedKey) {
        await this.s3Client.deleteProfilePicture({ key: ownedKey });
      }
      user.s3Key = undefined;
      await this.userRepository.flush();

      return await createBaseResponse(200, "Profile Picture Removed", {
        id: user.id,
        key: "",
      });
    }

    if (!req.newProfilePicture) {
      throw new BaseError(400, "A profile picture is required for upload");
    }

    await this.s3Client.uploadProfilePicture({
      key: ownedKey,
      profilePicture: req.newProfilePicture,
    });

    // Re-uploads overwrite the same owned object; never delete a stored legacy key.
    user.s3Key = ownedKey;
    await this.userRepository.flush();

    return await createBaseResponse(200, "Profile picture uploaded", {
      id: user.id,
      key: user.s3Key,
    });
  }
}
