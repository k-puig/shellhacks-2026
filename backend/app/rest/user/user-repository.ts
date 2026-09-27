import type { EntityManager } from "@mikro-orm/postgresql";
import { BaseRepository } from "@app/rest/lib/base-class/base-repository.ts";
import { UserSchema } from "@package/database/schema/postgresql-schema/index.ts";
import type { CreateUserRequest } from "@app/rest/user/dtos/user-request-dto.ts";

export class UserRepository extends BaseRepository<UserSchema> {
  constructor(em: EntityManager) {
    super(em, UserSchema, (id) => ({ id }));
  }

  async createUserOrIgnore(newUser: CreateUserRequest): Promise<UserSchema> {
    const now = new Date();

    return await this.upsert({
      id: newUser.id,
      username: newUser.username,
      authId: newUser.authId,
      createdAt: now,
      updatedAt: now,
    }, {
      onConflictFields: ["authId"],
      onConflictAction: "ignore",
    });
  }

  async findByAuthId(authId: string): Promise<UserSchema | null> {
    return await this.findOne({ authId });
  }
}
