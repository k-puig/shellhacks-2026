import { Entity, ManyToOne, Property, Ref } from "@mikro-orm/core";
import { BaseSchema } from "@package/database/schema/base-schema.ts";
import { BookSchema } from "@package/database/schema/book/book-schema.ts";

@Entity({ tableName: "highlight" })
export class HighlightSchema extends BaseSchema {
  @ManyToOne(() => BookSchema)
  book!: Ref<BookSchema>;

  @Property()
  start!: number;

  @Property()
  end!: number;
}
