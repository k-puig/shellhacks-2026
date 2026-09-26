import type { Ref } from "@mikro-orm/core";
import { Entity, ManyToOne, Property } from "@mikro-orm/decorators/legacy";
import { BaseSchema } from "@package/database/schema/postgresql-schema/base-schema.ts";
import { LibrarySchema } from "@package/database/schema/postgresql-schema/library/library-schema.ts";
import { UserSchema } from "@package/database/schema/postgresql-schema/user/user-schema.ts";

@Entity({ tableName: "book" })
export class BookSchema extends BaseSchema {
  @ManyToOne(() => LibrarySchema)
  library!: Ref<LibrarySchema>;

  @ManyToOne(() => UserSchema)
  user!: Ref<UserSchema>;

  @Property()
  title!: string;

  @Property()
  author!: string;

  @Property({ nullable: true })
  lastAccessedAt?: Date;

  // saved in seconds
  @Property({ type: "bigint", nullable: true })
  progress?: bigint;
}
