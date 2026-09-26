import { Entity, Property } from "@mikro-orm/core";
import { BaseSchema } from "@package/database/schema/base-schema.ts";

@Entity({ tableName: "user" })
export class UserSchema extends BaseSchema {
  @Property()
  username!: string;

  @Property()
  authId!: string;
}
