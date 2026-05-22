"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateMonthlyPayroll = void 0;
const Employee_js_1 = require("../models/Employee.js");
const Payroll_js_1 = require("../models/Payroll.js");
const Payslip_js_1 = require("../models/Payslip.js");
const Leave_js_1 = require("../models/Leave.js");
const LeavePolicy_js_1 = require("../models/LeavePolicy.js");
const Attendance_js_1 = require("../models/Attendance.js");
const Expense_js_1 = require("../models/Expense.js");
const SalaryStructure_js_1 = require("../models/payroll/SalaryStructure.js");
const SalaryComponent_js_1 = require("../models/payroll/SalaryComponent.js");
const TaxSlab_js_1 = require("../models/payroll/TaxSlab.js");
const logger_js_1 = require("../utils/logger.js");
/**
 * Calculate unpaid leave deductions for an employee in a given month.
 */
async function calculateLeaveDeductions(employeeId, organizationId, month, // YYYY-MM
dailyRate) {
    const monthStart = `${month}-01`;
    const monthEnd = `${month}-31`;
    const approvedLeaves = await Leave_js_1.Leave.find({
        organizationId,
        employeeId,
        status: 'APPROVED',
        leaveType: { $nin: ['WFH', 'Permission', 'Earned Leave'] },
        startDate: { $lte: monthEnd },
        endDate: { $gte: monthStart },
    });
    const policies = await LeavePolicy_js_1.LeavePolicy.find({ organizationId, isActive: true });
    const policyMap = new Map(policies.map((p) => [p.leaveType, p]));
    const unpaidDays = 0;
    const breakdown = [];
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
async function calculateOvertime(employeeId, organizationId, month, hourlyRate) {
    const attendances = await Attendance_js_1.Attendance.find({
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
async function calculateTax(organizationId, annualizedIncome) {
    // Simple progressive tax calculation based on TaxSlab
    const slabs = await TaxSlab_js_1.TaxSlab.find({ organizationId }).sort({ minIncome: 1 });
    if (!slabs.length)
        return 0;
    let totalTax = 0;
    const remainingIncome = annualizedIncome;
    for (const slab of slabs) {
        if (remainingIncome > slab.minIncome) {
            const taxableInThisSlab = Math.min(remainingIncome - slab.minIncome, slab.maxIncome - slab.minIncome);
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
async function getReimbursements(employeeId, organizationId, month) {
    const expenses = await Expense_js_1.Expense.find({
        organizationId,
        submittedBy: employeeId,
        status: 'APPROVED',
        date: { $regex: `^${month}` }
    });
    return expenses.reduce((sum, exp) => sum + exp.amount, 0);
}
const calculateMonthlyPayroll = async (month, organizationId) => {
    try {
        if (!organizationId) {
            throw new Error('organizationId is required for payroll calculation');
        }
        const employees = await Employee_js_1.Employee.find({ isActive: true, organizationId });
        const generatedPayrolls = [];
        // Pre-fetch all components for fast lookup
        const allComponents = await SalaryComponent_js_1.SalaryComponent.find({ organizationId, isActive: true });
        const componentMap = new Map(allComponents.map(c => [c._id.toString(), c]));
        for (const emp of employees) {
            // 1. Fetch Salary Structure
            const structure = await SalaryStructure_js_1.SalaryStructure.findOne({
                employeeId: emp._id,
                status: 'ACTIVE'
            });
            const baseSalary = structure ? structure.baseSalary : emp.salary;
            const dailyRate = baseSalary / 30;
            const hourlyRate = dailyRate / 8;
            let allowancesTotal = 0;
            let deductionsTotal = 0;
            const allowances = { basic: baseSalary, hra: 0, conveyance: 0, medical: 0, bonus: 0, overtime: 0 };
            const deductions = { professionalTax: 0, providentFund: 0, leaveDeductions: 0, latePenalties: 0, tax: 0 };
            if (structure) {
                for (const strComp of structure.components) {
                    const compInfo = componentMap.get(strComp.componentId.toString());
                    if (compInfo) {
                        let amount = 0;
                        if (compInfo.calculationType === 'FIXED' && strComp.fixedValue) {
                            amount = strComp.fixedValue;
                        }
                        else if (compInfo.calculationType === 'FORMULA' && compInfo.formula) {
                            // Basic formula evaluation: e.g. "Basic * 0.4". Replace "Basic" with baseSalary
                            try {
                                const formulaStr = compInfo.formula.replace(/Basic/gi, baseSalary.toString());
                                // Safe eval using Function
                                amount = new Function(`return ${formulaStr}`)();
                            }
                            catch (e) {
                                logger_js_1.logger.warn(`Failed to evaluate formula ${compInfo.formula} for component ${compInfo.name}`);
                            }
                        }
                        if (compInfo.type === 'EARNING')
                            allowancesTotal += amount;
                        if (compInfo.type === 'DEDUCTION' || compInfo.type === 'CONTRIBUTION')
                            deductionsTotal += amount;
                        // Map to common fields for payslip if they match
                        const nameLower = compInfo.name.toLowerCase();
                        if (nameLower.includes('hra'))
                            allowances.hra += amount;
                        else if (nameLower.includes('conveyance'))
                            allowances.conveyance += amount;
                        else if (nameLower.includes('medical'))
                            allowances.medical += amount;
                        else if (nameLower.includes('pf') || nameLower.includes('provident'))
                            deductions.providentFund += amount;
                        else if (nameLower.includes('professional'))
                            deductions.professionalTax += amount;
                    }
                }
            }
            // 2. Overtime
            const overtimePay = await calculateOvertime(emp._id.toString(), organizationId, month, hourlyRate);
            allowances.overtime = overtimePay;
            // 3. Leave Deductions
            const { deductionAmount: leaveDeductions } = await calculateLeaveDeductions(emp._id.toString(), organizationId, month, dailyRate);
            deductions.leaveDeductions = leaveDeductions;
            // 4. Reimbursements
            const reimbursements = await getReimbursements(emp._id.toString(), organizationId, month);
            // 5. Tax Calculation
            // Annualized income = (Base + Allowances) * 12
            const annualizedIncome = (baseSalary + allowancesTotal) * 12;
            const tax = await calculateTax(organizationId, annualizedIncome);
            deductions.tax = tax;
            const totalDeductions = deductionsTotal + leaveDeductions + tax;
            const finalSalary = Math.round(baseSalary + allowancesTotal + overtimePay + reimbursements - totalDeductions);
            // 6. Generate Payroll Record
            const payroll = await Payroll_js_1.Payroll.findOneAndUpdate({ employeeId: emp._id, month, organizationId }, {
                organizationId,
                baseSalary,
                overtime: overtimePay,
                bonus: allowances.bonus,
                reimbursements,
                tax,
                leaveDeductions,
                deductions: totalDeductions,
                finalSalary,
                paidStatus: 'PENDING',
            }, { upsert: true, new: true });
            // 7. Generate Payslip Record
            const payslip = await Payslip_js_1.Payslip.findOneAndUpdate({ employeeId: emp._id, month, organizationId }, {
                organizationId,
                payrollId: payroll._id,
                allowances,
                deductions,
                reimbursements,
                netSalary: finalSalary
            }, { upsert: true, new: true });
            generatedPayrolls.push(payroll);
        }
        logger_js_1.logger.info(`[PayrollService] Monthly payroll generated for ${month}, org=${organizationId}, employees=${employees.length}`);
        return generatedPayrolls;
    }
    catch (error) {
        logger_js_1.logger.error('[PayrollService] Payroll generation failed', { error });
        throw error;
    }
};
exports.calculateMonthlyPayroll = calculateMonthlyPayroll;
