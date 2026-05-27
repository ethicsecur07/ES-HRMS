import { Employee } from '../models/Employee.js';
import { Payroll } from '../models/Payroll.js';
import { Payslip } from '../models/Payslip.js';
import { Leave } from '../models/Leave.js';
import { LeavePolicy } from '../models/LeavePolicy.js';
import { Attendance } from '../models/Attendance.js';
import { Expense } from '../models/Expense.js';
import { SalaryStructure } from '../models/payroll/SalaryStructure.js';
import { SalaryComponent } from '../models/payroll/SalaryComponent.js';
import { TaxSlab } from '../models/payroll/TaxSlab.js';
import { PayrollConfig, DEFAULT_PAYROLL_CONFIG } from '../models/payroll/PayrollConfig.js';
import { logger } from '../utils/logger.js';

/**
 * Calculate unpaid leave deductions for an employee in a given month.
 */
async function calculateLeaveDeductions(
  employeeId: string,
  organizationId: string,
  month: string, // YYYY-MM
  dailyRate: number
): Promise<{ unpaidDays: number; deductionAmount: number; deductionBreakdown: any[] }> {
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-31`;

  const approvedLeaves = await Leave.find({
    organizationId,
    employeeId,
    status: 'APPROVED',
    leaveType: { $nin: ['WFH', 'Permission', 'Earned Leave'] } as any,
    startDate: { $lte: monthEnd },
    endDate: { $gte: monthStart },
  });

  const policies = await LeavePolicy.find({ organizationId, isActive: true });
  const policyMap = new Map(policies.map((p) => [p.leaveType, p]));

  const unpaidDays = 0;
  const breakdown: any[] = [];

  for (const leave of approvedLeaves) {
    breakdown.push({
      leaveType: leave.leaveType,
      days: leave.totalDays,
      isPaid: true,
    });
  }

  const deductionAmount = Math.round(unpaidDays * dailyRate);

  return { unpaidDays, deductionAmount, deductionBreakdown: breakdown };
}

/**
 * Calculate approved overtime pay for the month.
 */
async function calculateOvertime(
  employeeId: string,
  organizationId: string,
  month: string,
  hourlyRate: number
): Promise<number> {
  const attendances = await Attendance.find({
    organizationId,
    employeeId,
    date: { $regex: `^${month}` },
    'overtime.isApproved': true
  });

  let totalOvertimeHours = 0;
  for (const att of attendances) {
    if (att.overtime && att.overtime.hours) {
      totalOvertimeHours += att.overtime.hours;
    }
  }

  return Math.round(totalOvertimeHours * hourlyRate);
}

/**
 * Calculate tax based on annualized income.
 */
async function calculateTax(
  organizationId: string,
  annualizedIncome: number
): Promise<number> {
  // Simple progressive tax calculation based on TaxSlab
  const slabs = await TaxSlab.find({ organizationId }).sort({ minIncome: 1 });
  
  if (!slabs.length) return 0;

  let totalTax = 0;
  const remainingIncome = annualizedIncome;

  for (const slab of slabs) {
    if (remainingIncome > slab.minIncome) {
      const taxableInThisSlab = Math.min(
        remainingIncome - slab.minIncome,
        slab.maxIncome - slab.minIncome
      );
      totalTax += taxableInThisSlab * (slab.taxRatePercentage / 100);
      if (remainingIncome <= slab.maxIncome) {
        break;
      }
    }
  }

  // Monthly tax
  return Math.round(totalTax / 12);
}

/**
 * Get total approved reimbursements (Expenses) for the month.
 */
async function getReimbursements(
  employeeId: string,
  organizationId: string,
  month: string
): Promise<number> {
  const expenses = await Expense.find({
    organizationId,
    submittedBy: employeeId,
    status: 'APPROVED',
    date: { $regex: `^${month}` }
  });

  return expenses.reduce((sum, exp) => sum + exp.amount, 0);
}

/**
 * Calculate payroll using PayrollConfig (CTC breakup approach).
 * Uses the org-level payroll configuration for percentage-based CTC splitting.
 */
async function calculateWithPayrollConfig(
  emp: any,
  config: any,
  organizationId: string,
  month: string
) {
  const ctcMonthly = emp.salary || 0;
  const ctcAnnual = ctcMonthly * 12;

  // Earnings calculation
  const basic = Math.round(ctcMonthly * config.basicSalaryPercent / 100);
  const hra = Math.round(basic * config.hraPercent / 100);
  const conveyance = ctcMonthly > 0 ? config.conveyanceMonthly : 0;
  const performanceIncentive = ctcMonthly > 0 ? config.performanceIncentiveMonthly : 0;
  const otherAllowances = ctcMonthly > 0 ? config.otherAllowancesMonthly : 0;

  // Employer contributions (part of CTC, not part of gross)
  const pfEmployer = Math.round(basic * config.pfEmployerPercent / 100);
  const gratuity = Math.round(basic * config.gratuityPercent / 100);

  // Gross = CTC/Month - Employer contributions that are part of CTC
  // Special Allowance fills the gap
  const grossBeforeSpecial = basic + hra + conveyance + performanceIncentive + otherAllowances;

  // ESI employer (conditional)
  let esiEmployer = 0;
  if (config.applyEsiOnlyIfGrossBelow21000) {
    if (grossBeforeSpecial < 21000 && grossBeforeSpecial > 0) {
      esiEmployer = Math.round(grossBeforeSpecial * config.esiEmployerPercent / 100);
    }
  } else {
    esiEmployer = Math.round(grossBeforeSpecial * config.esiEmployerPercent / 100);
  }

  const insurance = ctcMonthly > 0 ? config.insuranceMonthly : 0;
  const totalEmployerContributions = pfEmployer + gratuity + esiEmployer + insurance;

  // Special allowance = CTC/Month - all explicit components - employer contributions
  const specialAllowance = Math.max(0, Math.round(ctcMonthly - grossBeforeSpecial - totalEmployerContributions));
  const grossPay = grossBeforeSpecial + specialAllowance;

  // Deductions (from employee)
  const pfEmployee = Math.round(basic * config.pfEmployeePercent / 100);
  const professionalTax = ctcMonthly > 0 ? config.professionalTaxMonthly : 0;
  const tds = ctcMonthly > 0 ? config.incomeTaxTdsMonthly : 0;
  const totalDeductions = pfEmployee + professionalTax + tds;

  // Net Pay
  const netPay = Math.round(grossPay - totalDeductions);

  // Leave deductions
  const dailyRate = grossPay / 30;
  const { deductionAmount: leaveDeductions } = await calculateLeaveDeductions(
    emp._id.toString(),
    organizationId,
    month,
    dailyRate
  );

  // Overtime
  const hourlyRate = dailyRate / 8;
  const overtimePay = await calculateOvertime(emp._id.toString(), organizationId, month, hourlyRate);

  // Reimbursements
  const reimbursements = await getReimbursements(emp._id.toString(), organizationId, month);

  const finalNetPay = Math.max(0, Math.round(netPay - leaveDeductions + overtimePay + reimbursements));
  const finalTotalDeductions = totalDeductions + leaveDeductions;

  return {
    ctcAnnual,
    grossPay,
    baseSalary: basic,
    overtime: overtimePay,
    bonus: 0,
    reimbursements,
    tax: tds,
    leaveDeductions,
    deductions: finalTotalDeductions,
    finalSalary: finalNetPay,
    // Payslip details
    allowances: {
      basic,
      hra,
      conveyance,
      medical: 0,
      bonus: 0,
      overtime: overtimePay,
      specialAllowance,
      performanceIncentive,
    },
    deductionsBreakdown: {
      professionalTax,
      providentFund: pfEmployee,
      leaveDeductions,
      latePenalties: 0,
      tax: 0,
      tds,
    },
    employerContributions: {
      pfEmployer,
      gratuity,
      esi: esiEmployer,
      insurance,
    },
  };
}

export const calculateMonthlyPayroll = async (
  month: string,
  organizationId: string
): Promise<any[]> => {
  try {
    if (!organizationId) {
      throw new Error('organizationId is required for payroll calculation');
    }

    const employees = await Employee.find({ isActive: true, organizationId });

    // Fetch org default payroll config
    let defaultConfig = await PayrollConfig.findOne({ organizationId, employeeId: null });
    const defaultConfigValues = defaultConfig ? defaultConfig.toObject() : { ...DEFAULT_PAYROLL_CONFIG };

    const generatedPayrolls = [];

    // Pre-fetch all components for SalaryStructure-based fallback
    const allComponents = await SalaryComponent.find({ organizationId, isActive: true });
    const componentMap = new Map(allComponents.map(c => [c._id.toString(), c]));

    for (const emp of employees) {
      // Check if employee has an active SalaryStructure
      const structure = await SalaryStructure.findOne({
        employeeId: emp._id,
        status: 'ACTIVE'
      });

      let payrollData: any;

      if (structure) {
        // Use legacy SalaryStructure-based calculation
        payrollData = await calculateWithSalaryStructure(
          emp, structure, componentMap, organizationId, month
        );
      } else {
        // Check if employee has a custom payroll config
        const empConfig = await PayrollConfig.findOne({ organizationId, employeeId: emp._id });
        const finalConfigValues = empConfig ? empConfig.toObject() : defaultConfigValues;

        // Use PayrollConfig-based CTC breakup calculation
        payrollData = await calculateWithPayrollConfig(
          emp, finalConfigValues, organizationId, month
        );
      }

      // Generate Payroll Record
      const payroll = await Payroll.findOneAndUpdate(
        { employeeId: emp._id, month, organizationId },
        {
          organizationId,
          ctcAnnual: payrollData.ctcAnnual || emp.salary || 0,
          grossPay: payrollData.grossPay || 0,
          baseSalary: payrollData.baseSalary,
          overtime: payrollData.overtime,
          bonus: payrollData.bonus,
          reimbursements: payrollData.reimbursements,
          tax: payrollData.tax,
          leaveDeductions: payrollData.leaveDeductions,
          deductions: payrollData.deductions,
          finalSalary: payrollData.finalSalary,
          paidStatus: 'PENDING',
        },
        { upsert: true, new: true }
      );

      // Generate Payslip Record
      await Payslip.findOneAndUpdate(
        { employeeId: emp._id, month, organizationId },
        {
          organizationId,
          payrollId: payroll._id,
          allowances: payrollData.allowances,
          deductions: payrollData.deductionsBreakdown,
          employerContributions: payrollData.employerContributions || {
            pfEmployer: 0,
            gratuity: 0,
            esi: 0,
            insurance: 0,
          },
          reimbursements: payrollData.reimbursements,
          netSalary: payrollData.finalSalary,
        },
        { upsert: true, new: true }
      );

      generatedPayrolls.push(payroll);
    }

    logger.info(`[PayrollService] Monthly payroll generated for ${month}, org=${organizationId}, employees=${employees.length}`);
    return generatedPayrolls;
  } catch (error) {
    logger.error('[PayrollService] Payroll generation failed', { error });
    throw error;
  }
};

/**
 * Legacy SalaryStructure-based calculation (kept for backward compatibility).
 */
async function calculateWithSalaryStructure(
  emp: any,
  structure: any,
  componentMap: Map<string, any>,
  organizationId: string,
  month: string
) {
  const baseSalary = structure.baseSalary;
  const dailyRate = baseSalary / 30;
  const hourlyRate = dailyRate / 8;

  let allowancesTotal = 0;
  let deductionsTotal = 0;

  const allowances: any = { basic: baseSalary, hra: 0, conveyance: 0, medical: 0, bonus: 0, overtime: 0, specialAllowance: 0, performanceIncentive: 0 };
  const deductions: any = { professionalTax: 0, providentFund: 0, leaveDeductions: 0, latePenalties: 0, tax: 0, tds: 0 };

  for (const strComp of structure.components) {
    const compInfo = componentMap.get(strComp.componentId.toString());
    if (compInfo) {
      let amount = 0;
      if (compInfo.calculationType === 'FIXED' && strComp.fixedValue) {
        amount = strComp.fixedValue;
      } else if (compInfo.calculationType === 'FORMULA' && compInfo.formula) {
        try {
          const formulaStr = compInfo.formula.replace(/Basic/gi, baseSalary.toString());
          amount = new Function(`return ${formulaStr}`)();
        } catch (e) {
          logger.warn(`Failed to evaluate formula ${compInfo.formula} for component ${compInfo.name}`);
        }
      }

      if (compInfo.type === 'EARNING') allowancesTotal += amount;
      if (compInfo.type === 'DEDUCTION' || compInfo.type === 'CONTRIBUTION') deductionsTotal += amount;

      const nameLower = compInfo.name.toLowerCase();
      if (nameLower.includes('hra')) allowances.hra += amount;
      else if (nameLower.includes('conveyance')) allowances.conveyance += amount;
      else if (nameLower.includes('medical')) allowances.medical += amount;
      else if (nameLower.includes('pf') || nameLower.includes('provident')) deductions.providentFund += amount;
      else if (nameLower.includes('professional')) deductions.professionalTax += amount;
    }
  }

  // Overtime
  const overtimePay = await calculateOvertime(emp._id.toString(), organizationId, month, hourlyRate);
  allowances.overtime = overtimePay;

  // Leave Deductions
  const { deductionAmount: leaveDeductions } = await calculateLeaveDeductions(
    emp._id.toString(),
    organizationId,
    month,
    dailyRate
  );
  deductions.leaveDeductions = leaveDeductions;

  // Reimbursements
  const reimbursements = await getReimbursements(emp._id.toString(), organizationId, month);

  // Tax Calculation
  const annualizedIncome = (baseSalary + allowancesTotal) * 12;
  const tax = await calculateTax(organizationId, annualizedIncome);
  deductions.tax = tax;

  const totalDeductions = deductionsTotal + leaveDeductions + tax;
  const grossPay = baseSalary + allowancesTotal;
  const finalSalary = Math.round(grossPay + overtimePay + reimbursements - totalDeductions);

  return {
    ctcAnnual: (emp.salary || grossPay) * 12,
    grossPay,
    baseSalary,
    overtime: overtimePay,
    bonus: allowances.bonus,
    reimbursements,
    tax,
    leaveDeductions,
    deductions: totalDeductions,
    finalSalary,
    allowances,
    deductionsBreakdown: deductions,
    employerContributions: {
      pfEmployer: 0,
      gratuity: 0,
      esi: 0,
      insurance: 0,
    },
  };
}
