"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConditionEvaluator = void 0;
class ConditionEvaluator {
    /**
     * Evaluates a node's condition against a context dictionary.
     */
    static evaluate(context, field, operator, value) {
        const actualValue = this.resolvePath(context, field);
        if (actualValue === undefined || actualValue === null) {
            console.warn(`[ConditionEvaluator] Field "${field}" resolved to null/undefined in context.`);
            return false;
        }
        const op = operator.toUpperCase();
        // String normalize helper for case-insensitive checks
        const normalize = (v) => typeof v === 'string' ? v.trim().toLowerCase() : v;
        switch (op) {
            case 'EQ':
                if (typeof actualValue === 'string' && typeof value === 'string') {
                    return normalize(actualValue) === normalize(value);
                }
                return actualValue === value;
            case 'NE':
                if (typeof actualValue === 'string' && typeof value === 'string') {
                    return normalize(actualValue) !== normalize(value);
                }
                return actualValue !== value;
            case 'GT':
                return Number(actualValue) > Number(value);
            case 'LT':
                return Number(actualValue) < Number(value);
            case 'IN':
                if (Array.isArray(value)) {
                    return value.map(normalize).includes(normalize(actualValue));
                }
                if (typeof value === 'string') {
                    return value.split(',').map(normalize).includes(normalize(actualValue));
                }
                return false;
            default:
                console.warn(`Unknown condition operator: ${operator}`);
                return false;
        }
    }
    /**
     * Safe property path resolution (e.g. 'user.department')
     */
    static resolvePath(obj, path) {
        if (!obj)
            return undefined;
        return path.split('.').reduce((prev, curr) => (prev ? prev[curr] : undefined), obj);
    }
}
exports.ConditionEvaluator = ConditionEvaluator;
