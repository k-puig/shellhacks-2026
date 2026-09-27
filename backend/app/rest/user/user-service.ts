import type { EntityManager } from "@mikro-orm/postgresql";
import { createBaseResponse } from "@app/rest/lib/base-class/base-response.ts";
import { BaseError } from "@app/rest/lib/base-class/base-error.ts";
import type {
  ChangeUserProfilePictureRequest,
  CreateUserRequest,
  DeleteUserRequest,
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
    });
  }

  async updateUser(req: UpdateUserRequest): Promise<UpdateUserBaseResponse> {
    const user = await this.userRepository.findById(req.id);

    if (!user) {
      throw new BaseError(404, "User not found");
    }

    user.username = req.username;
    await this.userRepository.flush();

    return await createBaseResponse(200, "User updated", {
      username: user.username,
    });
  }

  async deleteUser(req: DeleteUserRequest): Promise<DeleteUserBaseResponse> {
    const wasUserDeleted = await this.userRepository.deleteById(req.id);

    if (!wasUserDeleted) {
      throw new BaseError(404, "User not found");
    }

    return await createBaseResponse(200, "User deleted successfully", {
      id: req.id,
    });
  }

  async deleteUserByAuthId(authId: string): Promise<DeleteUserBaseResponse> {
    const user = await this.userRepository.findByAuthId(authId);

    if (!user) {
      throw new BaseError(404, "User not found");
    }

    return await this.deleteUser({ id: user.id });
  }

  async uploadOrDeleteProfilePicture(
    req: ChangeUserProfilePictureRequest,
  ): Promise<ChangeUserProfilePictureBaseResponse> {
    const user = await this.userRepository.findById(req.id);

    if (!user) {
      throw new BaseError(404, "User not found");
    }

    if(req.key === ""){
      user.s3Key = undefined;
      await this.userRepository.flush();

      return await createBaseResponse(200, "Profile Picture Removed", {
        id: user.id,
        key: ""
      });
    }

    const previousKey = user.s3Key;

    await this.s3Client.uploadProfilePicture({
      key: req.key,
      profilePicture: req.newProfilePicture,
    });

    user.s3Key = req.key;
    await this.userRepository.flush();

    if (previousKey && previousKey !== req.key) {
      await this.s3Client.deleteProfilePicture({ key: previousKey });
    }

    return await createBaseResponse(200, "Profile picture uploaded", {
      id: user.id,
      key: user.s3Key,
    });
  }
}
