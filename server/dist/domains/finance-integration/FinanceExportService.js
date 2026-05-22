"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinanceExportService = exports.ZohoBooksAdapter = exports.TallyAdapter = void 0;
class TallyAdapter {
    platformName = 'Tally';
    async exportJournalEntries(payrollData) {
        // In real life, generates Tally XML
        return `<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY>...${payrollData.length} entries...</BODY></ENVELOPE>`;
    }
}
exports.TallyAdapter = TallyAdapter;
class ZohoBooksAdapter {
    platformName = 'ZohoBooks';
    async exportJournalEntries(payrollData) {
        // In real life, calls Zoho Books API
        return `Exported ${payrollData.length} journals to Zoho via API`;
    }
}
exports.ZohoBooksAdapter = ZohoBooksAdapter;
class FinanceExportService {
    static adapters = {
        TALLY: new TallyAdapter(),
        ZOHO: new ZohoBooksAdapter()
    };
    static async export(platform, runCycle, data) {
        const adapter = this.adapters[platform.toUpperCase()];
        if (!adapter)
            throw new Error(`Finance platform ${platform} not supported.`);
        return await adapter.exportJournalEntries(data);
    }
}
exports.FinanceExportService = FinanceExportService;
