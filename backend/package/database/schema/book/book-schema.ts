import { Entity, ManyToOne, Property, Ref } from "@mikro-orm/core";
import { BaseSchema } from "@package/database/schema/base-schema.ts";
import { LibrarySchema } from "@package/database/schema/library/library-schema.ts";
import { UserSchema } from "@package/database/schema/user/user-schema.ts";

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
