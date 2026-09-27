import { Entity, Property } from "@mikro-orm/decorators/legacy";
import { BaseSchema } from "@package/database/schema/postgresql-schema/base-schema.ts";

@Entity({ tableName: "user" })
export class UserSchema extends BaseSchema {
  @Property({ type: "string" })
  username!: string;

  @Property({ type: "string", unique: true })
  authId!: string;
}
