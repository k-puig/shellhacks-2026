import { Entity, Property } from "@mikro-orm/decorators/legacy";
import { BaseSchema } from "@package/database/schema/postgresql-schema/base-schema.ts";

@Entity({ tableName: "library" })
export class LibrarySchema extends BaseSchema {
  @Property()
  name!: string;
}
