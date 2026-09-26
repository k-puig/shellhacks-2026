import { Entity, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";
import { v4 } from "uuid";
import { Opt } from "@mikro-orm/core";

// base schema that is inherited by all other schemas
// BE CAREFUL CHANGING THIS. THIS WILL AFFECT ALL SCHEMAS

@Entity({ abstract: true })
export abstract class BaseSchema {
  @PrimaryKey({ type: "uuid" })
  id: string = v4();

  @Property()
  createdAt: Date & Opt = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date & Opt = new Date();
}
