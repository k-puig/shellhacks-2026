import { Entity, Property } from "@mikro-orm/decorators/legacy";
import { BaseSchema } from "@package/database/schema/base-schema.ts";

@Entity({ tableName: "user" })
export class UserSchema extends BaseSchema {
  @Property()
  username!: string;

  @Property()
  authId!: string;
}
