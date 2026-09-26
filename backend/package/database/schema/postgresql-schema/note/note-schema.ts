import type { Ref } from "@mikro-orm/core";
import { Entity, OneToOne, Property } from "@mikro-orm/decorators/legacy";
import { BaseSchema } from "@package/database/schema/postgresql-schema/base-schema.ts";
import { HighlightSchema } from "@package/database/schema/postgresql-schema/highlight/highlight-schema.ts";

@Entity({ tableName: "note" })
export class NoteSchema extends BaseSchema {
  @OneToOne(() => HighlightSchema)
  highlight!: Ref<HighlightSchema>;

  @Property({ type: "text" })
  text!: string;
}
