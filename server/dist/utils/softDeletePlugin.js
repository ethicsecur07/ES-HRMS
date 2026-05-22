"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.softDeletePlugin = softDeletePlugin;
function softDeletePlugin(schema) {
    schema.add({
        isDeleted: { type: Boolean, default: false, index: true },
        deletedAt: { type: Date, default: null }
    });
    // Filter out soft deleted documents on common read queries
    const activeQueries = ['find', 'findOne', 'findOneAndUpdate', 'updateMany', 'updateOne', 'countDocuments'];
    activeQueries.forEach(type => {
        schema.pre(type, function (next) {
            const filter = this.getFilter();
            if (filter.isDeleted === undefined) {
                this.where({ isDeleted: { $ne: true } });
            }
            next();
        });
    });
    // Custom softDelete method
    schema.methods.softDelete = async function () {
        this.isDeleted = true;
        this.deletedAt = new Date();
        return this.save();
    };
    // Custom restore method
    schema.methods.restore = async function () {
        this.isDeleted = false;
        this.deletedAt = null;
        return this.save();
    };
}
