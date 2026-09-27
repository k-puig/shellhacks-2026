import type { EntityManager } from "@mikro-orm/postgresql";
import { createBaseResponse } from "@app/rest/lib/base-class/base-response.ts";
import { BaseError } from "@app/rest/lib/base-class/base-error.ts";
import type {
  CreateUserRequest,
  DeleteUserRequest,
  FetchUserRequest,
  UpdateUserRequest,
} from "@app/rest/user/dtos/user-request-dto.ts";
import type {
  CreateUserBaseResponse,
  DeleteUserBaseResponse,
  FetchUserBaseResponse,
  UpdateUserBaseResponse,
} from "@app/rest/user/dtos/user-response-dto.ts";
import { UserRepository } from "@app/rest/user/user-repository.ts";

export class UserService {
  private readonly userRepository: UserRepository;

  constructor(em: EntityManager) {
    this.userRepository = new UserRepository(em);
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
}
