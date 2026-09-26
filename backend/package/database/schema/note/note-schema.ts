import { Entity, OneToOne, Property, Ref } from "@mikro-orm/core";
import { BaseSchema } from "@package/database/schema/base-schema.ts";
import { HighlightSchema } from "@package/database/schema/highlight/highlight-schema.ts";

@Entity({ tableName: "note" })
export class NoteSchema extends BaseSchema {
  @OneToOne(() => HighlightSchema)
  highlight!: Ref<HighlightSchema>;

  @Property({ type: "varchar", length: 1000 })
  text!: string;
}
