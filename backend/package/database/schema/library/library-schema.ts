import { Entity, Property } from "@mikro-orm/core";
import { BaseSchema } from "@package/database/schema/base-schema.ts";

@Entity({ tableName: "library" })
export class LibrarySchema extends BaseSchema {
  @Property()
  name!: string;
}
