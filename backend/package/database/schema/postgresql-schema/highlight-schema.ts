import type { Ref } from "@mikro-orm/core";
import { Entity, ManyToOne, Property } from "@mikro-orm/decorators/legacy";
import { BaseSchema } from "@package/database/schema/postgresql-schema/base-schema.ts";
import { BookSchema } from "@package/database/schema/postgresql-schema/book-schema.ts";

@Entity({ tableName: "highlight" })
export class HighlightSchema extends BaseSchema {
  @ManyToOne(() => BookSchema)
  book!: Ref<BookSchema>;

  @Property({ type: "bigint" })
  start!: number;

  @Property({ type: "bigint" })
  end!: number;
}
