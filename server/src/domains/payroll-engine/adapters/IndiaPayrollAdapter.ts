import { IPayrollAdapter, PayrollCalculationContext, PayrollTaxResult, PayrollAdapterFactory } from './PayrollAdapterFactory.js';
import { TaxSlab } from '../../../models/payroll/TaxSlab.js';
import { TaxDeclaration } from '../../../models/SelfService.js';

export class IndiaPayrollAdapter implements IPayrollAdapter {
  public countryCode = 'IN';

  public async calculateTaxes(context: PayrollCalculationContext): Promise<PayrollTaxResult> {
    const { organizationId, employeeId, grossSalary, runCycle } = context;
    
    // 1. Annualize income
    const annualizedIncome = grossSalary * 12;

    // 2. Calculate Indian Financial Year (starts in April)
    let financialYear: string;
    if (runCycle) {
      const [yearStr, monthStr] = runCycle.split('-');
      const y = parseInt(yearStr);
      const m = parseInt(monthStr);
      if (m >= 4) {
        financialYear = `${y}-${y + 1}`;
      } else {
        financialYear = `${y - 1}-${y}`;
      }
    } else {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      if (m >= 4) {
        financialYear = `${y}-${y + 1}`;
      } else {
        financialYear = `${y - 1}-${y}`;
      }
    }

    // 3. Fetch and aggregate approved tax declarations for the financial year
    const declarations = await TaxDeclaration.find({
      organizationId,
      employeeId,
      financialYear,
      status: 'APPROVED'
    });

    let exemption80C = 0;
    let exemption80D = 0;
    let exemptionSection24 = 0;
    let exemptionOther = 0;

    for (const dec of declarations) {
      if (dec.declarationSection === '80C') {
        exemption80C += dec.declaredAmount;
      } else if (dec.declarationSection === '80D') {
        exemption80D += dec.declaredAmount;
      } else if (dec.declarationSection === 'SECTION_24') {
        exemptionSection24 += dec.declaredAmount;
      } else {
        exemptionOther += dec.declaredAmount;
      }
    }

    // Apply standard Indian statutory limits (80C capped at 1.5L, 80D capped at 25k)
    const totalExemptions = 
      Math.min(exemption80C, 150000) + 
      Math.min(exemption80D, 25000) + 
      exemptionSection24 + 
      exemptionOther;

    const taxableIncome = Math.max(0, annualizedIncome - totalExemptions);

    // Fetch applicable tax slabs
    const slabs = await TaxSlab.find({
      organizationId,
      country: this.countryCode,
      effectiveYear: new Date().getFullYear() // simplified
    }).sort({ minIncome: 1 });

    let annualTax = 0;
    
    for (const slab of slabs) {
      if (taxableIncome > slab.minIncome) {
        const maxLimit = slab.maxIncome || Infinity;
        const taxableAmountInSlab = Math.min(taxableIncome, maxLimit) - slab.minIncome;
        if (taxableAmountInSlab > 0) {
          annualTax += taxableAmountInSlab * (slab.taxRatePercentage / 100);
        }
      }
    }

    // Pro-rate for the current month
    const monthlyTDS = annualTax / 12;

    return {
      totalTaxes: Math.round(monthlyTDS),
      breakdown: {
        'Income Tax (TDS)': Math.round(monthlyTDS)
      }
    };
  }

  public async applyStatutoryCompliance(grossSalary: number, basicSalary?: number): Promise<Record<string, number>> {
    const breakdown: Record<string, number> = {};

    // 1. Employee Provident Fund (EPF)
    // Capped at 12% of 15,000 normally, or Basic salary.
    const pfBasicLimit = 15000;
    const baseForPF = basicSalary !== undefined ? basicSalary : (grossSalary * 0.4);
    const pfBase = Math.min(baseForPF, pfBasicLimit);
    breakdown['EPF'] = Math.round(pfBase * 0.12);

    // 2. Professional Tax (PT)
    // Varies by state, using a flat approximation
    if (grossSalary > 15000) {
      breakdown['Professional Tax'] = 200;
    }

    // 3. Employee State Insurance (ESI)
    if (grossSalary <= 21000) {
      breakdown['ESI'] = Math.round(grossSalary * 0.0075);
    }

    return breakdown;
  }
}

// Auto-register
PayrollAdapterFactory.register(new IndiaPayrollAdapter());
