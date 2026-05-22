export interface IFinanceAdapter {
  platformName: string;
  exportJournalEntries(payrollData: any[]): Promise<string>;
}

export class TallyAdapter implements IFinanceAdapter {
  platformName = 'Tally';

  public async exportJournalEntries(payrollData: any[]): Promise<string> {
    // In real life, generates Tally XML
    return `<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY>...${payrollData.length} entries...</BODY></ENVELOPE>`;
  }
}

export class ZohoBooksAdapter implements IFinanceAdapter {
  platformName = 'ZohoBooks';

  public async exportJournalEntries(payrollData: any[]): Promise<string> {
    // In real life, calls Zoho Books API
    return `Exported ${payrollData.length} journals to Zoho via API`;
  }
}

export class FinanceExportService {
  private static adapters: Record<string, IFinanceAdapter> = {
    TALLY: new TallyAdapter(),
    ZOHO: new ZohoBooksAdapter()
  };

  public static async export(platform: string, runCycle: string, data: any[]): Promise<string> {
    const adapter = this.adapters[platform.toUpperCase()];
    if (!adapter) throw new Error(`Finance platform ${platform} not supported.`);
    
    return await adapter.exportJournalEntries(data);
  }
}
