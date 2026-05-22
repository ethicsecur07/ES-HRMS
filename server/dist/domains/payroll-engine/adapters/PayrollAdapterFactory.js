"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayrollAdapterFactory = void 0;
class PayrollAdapterFactory {
    static adapters = {};
    static register(adapter) {
        this.adapters[adapter.countryCode.toUpperCase()] = adapter;
    }
    static getAdapter(countryCode) {
        const adapter = this.adapters[countryCode.toUpperCase()];
        if (!adapter) {
            throw new Error(`Payroll adapter not implemented for country: ${countryCode}`);
        }
        return adapter;
    }
}
exports.PayrollAdapterFactory = PayrollAdapterFactory;
