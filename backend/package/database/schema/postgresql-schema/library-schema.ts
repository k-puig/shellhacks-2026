import type { Ref } from "@mikro-orm/core";
import { Entity, ManyToOne, Property } from "@mikro-orm/decorators/legacy";
import { BaseSchema } from "@package/database/schema/postgresql-schema/base-schema.ts";
import { UserSchema } from "@package/database/schema/postgresql-schema/user-schema.ts";

@Entity({ tableName: "library" })
export class LibrarySchema extends BaseSchema {
  // Legacy libraries can remain unowned until their owners are backfilled.
  @ManyToOne(() => UserSchema, { nullable: true })
  owner!: Ref<UserSchema> | null;

  @Property({ type: "string" })
  name!: string;
}
