import { Model, FilterQuery, UpdateQuery, QueryOptions, Document } from 'mongoose';

/**
 * BaseRepository enforces tenant isolation by automatically injecting the organizationId
 * into all queries. It prevents accidental cross-tenant data leaks.
 */
export class BaseRepository<T extends Document> {
  protected model: Model<T>;

  constructor(model: Model<T>) {
    this.model = model;
  }

  /**
   * Helper to ensure organizationId is always present in the query
   */
  private enforceTenant(organizationId: string, query: FilterQuery<T>): FilterQuery<T> {
    if (!organizationId) {
      throw new Error('Tenant isolation violation: organizationId is required.');
    }
    return { ...query, organizationId };
  }

  async findOne(organizationId: string, query: FilterQuery<T>, options?: QueryOptions): Promise<T | null> {
    return this.model.findOne(this.enforceTenant(organizationId, query), null, options).exec();
  }

  async find(organizationId: string, query: FilterQuery<T>, options?: QueryOptions): Promise<T[]> {
    return this.model.find(this.enforceTenant(organizationId, query), null, options).exec();
  }

  async create(organizationId: string, data: Partial<T>): Promise<T> {
    if (!organizationId) {
      throw new Error('Tenant isolation violation: organizationId is required.');
    }
    const doc = new this.model({ ...data, organizationId });
    return doc.save();
  }

  async updateOne(organizationId: string, query: FilterQuery<T>, update: UpdateQuery<T>, options?: QueryOptions): Promise<T | null> {
    return this.model.findOneAndUpdate(
      this.enforceTenant(organizationId, query),
      update,
      { new: true, ...options }
    ).exec();
  }

  async deleteOne(organizationId: string, query: FilterQuery<T>): Promise<boolean> {
    const result = await this.model.deleteOne(this.enforceTenant(organizationId, query)).exec();
    return result.deletedCount === 1;
  }
}
