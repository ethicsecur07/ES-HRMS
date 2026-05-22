import { TaxSlab } from '../../../models/payroll/TaxSlab.js';
import { Types } from 'mongoose';

export interface PayrollCalculationContext {
  organizationId: Types.ObjectId;
  employeeId: Types.ObjectId;
  grossSalary: number;
  yearToDateTaxPaid: number;
  monthIndex: number; // 1-12 (e.g. April to March)
  runCycle?: string; // YYYY-MM
}

export interface PayrollTaxResult {
  totalTaxes: number;
  breakdown: Record<string, number>;
}

export interface IPayrollAdapter {
  countryCode: string;
  calculateTaxes(context: PayrollCalculationContext): Promise<PayrollTaxResult>;
  applyStatutoryCompliance(grossSalary: number, basicSalary?: number): Promise<Record<string, number>>;
}

export class PayrollAdapterFactory {
  private static adapters: Record<string, IPayrollAdapter> = {};

  public static register(adapter: IPayrollAdapter) {
    this.adapters[adapter.countryCode.toUpperCase()] = adapter;
  }

  public static getAdapter(countryCode: string): IPayrollAdapter {
    const adapter = this.adapters[countryCode.toUpperCase()];
    if (!adapter) {
      throw new Error(`Payroll adapter not implemented for country: ${countryCode}`);
    }
    return adapter;
  }
}
