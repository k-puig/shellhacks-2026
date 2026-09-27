import type {
  EntityData,
  EntityName,
  FilterQuery,
  RequiredEntityData,
  UpsertOptions,
} from "@mikro-orm/core";
import type { EntityManager } from "@mikro-orm/postgresql";

export type UuidEntity = {
  id: string;
};

//BE CAREFUL EDITING THIS, AS THIS WILL IMPACT ALL REPOSITORIES
export abstract class BaseRepository<TEntity extends UuidEntity> {
  protected constructor(
    protected readonly em: EntityManager,
    protected readonly entity: EntityName<TEntity>,
    private readonly idFilter: (id: string) => FilterQuery<TEntity>,
  ) {}

  async findOne(where: FilterQuery<TEntity>): Promise<TEntity | null> {
    return await this.em.findOne(this.entity, where);
  }

  async findById(id: TEntity["id"]): Promise<TEntity | null> {
    return await this.findOne(this.idFilter(id));
  }

  async findMany(where: FilterQuery<TEntity>): Promise<TEntity[]> {
    return await this.em.find(this.entity, where);
  }

  async findAll(): Promise<TEntity[]> {
    return await this.em.findAll(this.entity);
  }

  async create(data: RequiredEntityData<TEntity>): Promise<TEntity> {
    const entity = this.em.create(this.entity, data);
    await this.em.flush();

    return entity;
  }

  async upsert<Fields extends string = never>(
    data: EntityData<TEntity>,
    options?: UpsertOptions<TEntity, Fields>,
  ): Promise<TEntity> {
    const entity = await this.em.upsert(this.entity, data, options);
    await this.em.flush();

    return entity;
  }

  async delete(where: FilterQuery<TEntity>): Promise<boolean> {
    const deletedCount = await this.em.nativeDelete(this.entity, where);
    return deletedCount > 0;
  }

  async deleteById(id: TEntity["id"]): Promise<boolean> {
    return await this.delete(this.idFilter(id));
  }

  async flush(): Promise<void> {
    await this.em.flush();
  }
}
