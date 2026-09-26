import { EntityManager } from "@mikro-orm/postgresql";
import { UserSchema } from "@package/database/schema/postgresql-schema/index.ts";
import * as z from "@zod/zod";
import { v4 } from "uuid";

export const createUserResponse = z.object({
  id: z.uuidv4(),
  username: z.string(),
  authId: z.string(),
});

export class UserService {
  private em: EntityManager;
  constructor(em: EntityManager) {
    this.em = em;
  }

  async createUserOrDoNothing(
    name: string,
    authId: string,
  ): Promise<z.infer<typeof createUserResponse>> {
    const now = new Date();
    const user = await this.em.upsert(UserSchema, {
      id: v4(),
      username: name,
      authId: authId,
      createdAt: now,
      updatedAt: now,
    }, {
      onConflictFields: ["authId"],
      onConflictAction: "ignore",
    });
    await this.em.flush();

    return {
      id: user.id,
      username: user.username,
      authId: user.authId,
    };
  }
}
