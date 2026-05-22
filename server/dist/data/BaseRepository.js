"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseRepository = void 0;
/**
 * BaseRepository enforces tenant isolation by automatically injecting the organizationId
 * into all queries. It prevents accidental cross-tenant data leaks.
 */
class BaseRepository {
    model;
    constructor(model) {
        this.model = model;
    }
    /**
     * Helper to ensure organizationId is always present in the query
     */
    enforceTenant(organizationId, query) {
        if (!organizationId) {
            throw new Error('Tenant isolation violation: organizationId is required.');
        }
        return { ...query, organizationId };
    }
    async findOne(organizationId, query, options) {
        return this.model.findOne(this.enforceTenant(organizationId, query), null, options).exec();
    }
    async find(organizationId, query, options) {
        return this.model.find(this.enforceTenant(organizationId, query), null, options).exec();
    }
    async create(organizationId, data) {
        if (!organizationId) {
            throw new Error('Tenant isolation violation: organizationId is required.');
        }
        const doc = new this.model({ ...data, organizationId });
        return doc.save();
    }
    async updateOne(organizationId, query, update, options) {
        return this.model.findOneAndUpdate(this.enforceTenant(organizationId, query), update, { new: true, ...options }).exec();
    }
    async deleteOne(organizationId, query) {
        const result = await this.model.deleteOne(this.enforceTenant(organizationId, query)).exec();
        return result.deletedCount === 1;
    }
}
exports.BaseRepository = BaseRepository;
