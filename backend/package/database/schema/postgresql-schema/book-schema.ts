import type { Ref } from "@mikro-orm/core";
import { Entity, ManyToOne, Property } from "@mikro-orm/decorators/legacy";
import { BaseSchema } from "@package/database/schema/postgresql-schema/base-schema.ts";
import { LibrarySchema } from "@package/database/schema/postgresql-schema/library-schema.ts";
import { UserSchema } from "@package/database/schema/postgresql-schema/user-schema.ts";

@Entity({ tableName: "book" })
export class BookSchema extends BaseSchema {
  @ManyToOne(() => LibrarySchema)
  library!: Ref<LibrarySchema>;

  @ManyToOne(() => UserSchema)
  user!: Ref<UserSchema>;

  @Property({ type: "string" })
  title!: string;

  @Property({ type: "string" })
  author!: string;

  @Property({ type: "string" })
  s3Key!: string;

  @Property({ type: "date", nullable: true })
  lastAccessedAt?: Date;

  // saved in seconds
  @Property({ type: "bigint", nullable: true })
  progress?: bigint;
}
