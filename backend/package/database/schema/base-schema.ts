import { Entity, PrimaryKey, Property } from "@mikro-orm/core";

// base schema that is inherited by all other schemas
// BE CAREFUL CHANGING THIS. THIS WILL AFFECT ALL SCHEMAS

@Entity({ abstract: true })
export abstract class BaseSchema {
  @PrimaryKey()
  id!: number;

  @Property({ onCreate: () => new Date() })
  createdAt!: Date;

  @Property({ onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt!: Date;
}
