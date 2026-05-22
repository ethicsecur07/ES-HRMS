import { PayrollRun } from '../../models/payroll/PayrollRun.js';
import { Payroll } from '../../models/Payroll.js';
import { SalaryStructure } from '../../models/payroll/SalaryStructure.js';
import { FormulaEvaluator } from './FormulaEvaluator.js';
import { PayrollAdapterFactory } from './adapters/PayrollAdapterFactory.js';
import { Leave } from '../../models/Leave.js';
import { LeavePolicy } from '../../models/LeavePolicy.js';
import { Attendance } from '../../models/Attendance.js';
import { Organization } from '../../models/Organization.js';
import { ReimbursementClaim } from '../../models/SelfService.js';
import { Payslip } from '../../models/Payslip.js';
import mongoose, { Types } from 'mongoose';

export class PayrollPipeline {
  /**
   * Triggers an asynchronous bulk payroll processing run for a given cycle.
   * Lock-guaranteed atomic implementation.
   */
  public static async triggerBulkProcessing(organizationId: Types.ObjectId, runCycle: string) {
    // Atomic check-and-lock to prevent race conditions
    let run = await PayrollRun.findOneAndUpdate(
      { organizationId, runCycle, status: { $nin: ['PROCESSING', 'LOCKED', 'COMPLETED'] } },
      { $set: { status: 'PROCESSING' } },
      { new: true }
    );

    if (!run) {
      const existing = await PayrollRun.findOne({ organizationId, runCycle });
      if (existing) {
        throw new Error(`Payroll run is already in ${existing.status} state.`);
      }
      run = new PayrollRun({ organizationId, runCycle, status: 'PROCESSING' });
      await run.save();
    }

    // Start async processing (detached)
    this.processBatch(run).catch(console.error);

    return run;
  }

  private static async processBatch(run: any) {
    let processed = 0;
    let failed = 0;
    let totalPayout = 0;
    
    try {
      const [year, month] = run.runCycle.split('-');
      const startStr = `${run.runCycle}-01`;
      const yearNum = parseInt(year);
      const monthNum = parseInt(month);
      const endDay = new Date(yearNum, monthNum, 0).getDate();
      const endStr = `${run.runCycle}-${endDay < 10 ? '0' + endDay : endDay}`;
      
      const cycleStart = new Date(startStr);
      const cycleEnd = new Date(endStr);
      
      // Fetch Organization for working days settings
      const org = await Organization.findById(run.organizationId);
      const activeWorkdays = org?.settings?.activeWorkdays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      const customHolidays = org?.settings?.customHolidays || [];
      
      // Build list of active working days in the cycle
      const workdaysList: string[] = [];
      for (let d = 1; d <= endDay; d++) {
        const dStr = d < 10 ? `0${d}` : `${d}`;
        const dateStr = `${run.runCycle}-${dStr}`;
        const dateObj = new Date(dateStr);
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' }); // 'Mon', 'Tue', etc.
        
        if (activeWorkdays.includes(dayName) && !customHolidays.some(h => h.date === dateStr)) {
          workdaysList.push(dateStr);
        }
      }

      // Fetch all active structures
      const structures = await SalaryStructure.find({ 
        organizationId: run.organizationId,
        status: 'ACTIVE' 
      }).populate('components.componentId');

      for (const structure of structures) {
        try {
          // Fetch leaves, attendance, reimbursements
          const approvedLeaves = await Leave.find({
            organizationId: run.organizationId,
            employeeId: structure.employeeId,
            status: 'APPROVED',
            startDate: { $lte: endStr },
            endDate: { $gte: startStr }
          });

          const attendanceRecords = await Attendance.find({
            organizationId: run.organizationId,
            employeeId: structure.employeeId,
            date: { $gte: startStr, $lte: endStr }
          });

          const reimbursementClaims = await ReimbursementClaim.find({
            organizationId: run.organizationId,
            employeeId: structure.employeeId,
            status: 'APPROVED',
            expenseDate: { $gte: cycleStart, $lte: cycleEnd }
          });

          // Calculate Unpaid Leave days
          let unpaidDays = 0;
          const getOverlapDays = (start: string, end: string, cStart: Date, cEnd: Date): number => {
            const s = new Date(start) > cStart ? new Date(start) : cStart;
            const e = new Date(end) < cEnd ? new Date(end) : cEnd;
            if (s > e) return 0;
            return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          };

          for (const leave of approvedLeaves) {
            if (leave.leaveType === 'Unpaid Leave') {
              unpaidDays += getOverlapDays(leave.startDate, leave.endDate, cycleStart, cycleEnd);
            }
          }

          // Calculate Absent days (no attendance and no approved leave on a workday)
          let absentDays = 0;
          for (const dateStr of workdaysList) {
            const att = attendanceRecords.find(a => a.date === dateStr);
            const isPresent = att && (att.status === 'OFFICE' || att.status === 'WFH');
            if (isPresent) continue;
            
            const isOnLeave = approvedLeaves.some(l => dateStr >= l.startDate && dateStr <= l.endDate);
            if (isOnLeave) continue;

            absentDays++;
          }

          // Calculate Late Penalties (using LeavePolicy settings)
          const leavePolicies = await LeavePolicy.find({ organizationId: run.organizationId });
          const latePolicy = leavePolicies.find(p => p.latePenaltyCount > 0);
          let lateDeductionDays = 0;
          let lateCount = 0;
          if (latePolicy) {
            lateCount = attendanceRecords.filter(a => a.isLate).length;
            lateDeductionDays = Math.floor(lateCount / latePolicy.latePenaltyCount) * 0.5;
          }

          // Total Loss of Pay Days
          const totalLOPDays = unpaidDays + absentDays + lateDeductionDays;

          // Calculate Overtime Hours
          let approvedOTHours = 0;
          for (const record of attendanceRecords) {
            if (record.overtime?.isApproved && record.overtime?.hours) {
              approvedOTHours += record.overtime.hours;
            }
          }

          // Calculate Reimbursements
          let approvedReimbursementAmount = 0;
          for (const claim of reimbursementClaims) {
            approvedReimbursementAmount += claim.amount;
          }

          // Rule Engine Variable Bindings
          const variables: Record<string, number> = { 
            Base: structure.baseSalary,
            Present_Days: Math.max(0, workdaysList.length - absentDays - unpaidDays),
            Late_Days: lateCount,
            OT_Hours: approvedOTHours,
            Unpaid_Days: totalLOPDays,
            Reimbursements: approvedReimbursementAmount
          };
          
          let totalEarnings = 0;
          let totalDeductions = 0;
          let basicSalaryVal = structure.baseSalary; // default basic fallback

          for (const item of structure.components) {
            const comp = item.componentId as any;
            let amount = 0;
            
            if (comp.isConditional && comp.conditionExpression) {
              const conditionMet = FormulaEvaluator.evaluateCondition(comp.conditionExpression, variables);
              if (!conditionMet) continue;
            }

            if (comp.calculationType === 'FIXED') {
              amount = item.fixedValue || 0;
            } else if (comp.calculationType === 'FORMULA' && comp.formula) {
              amount = FormulaEvaluator.evaluate(comp.formula, variables);
            }

            // Expose computed components as variables for subsequent formulas
            variables[comp.name] = amount;
            
            if (comp.name.toUpperCase() === 'BASIC') {
              basicSalaryVal = amount;
            }

            if (comp.type === 'EARNING') totalEarnings += amount;
            if (comp.type === 'DEDUCTION') totalDeductions += amount;
          }

          let grossSalary = totalEarnings;
          
          // Apply LOP salary deductions
          const dailyRate = grossSalary / endDay;
          const lopDeductionAmount = Math.round(dailyRate * totalLOPDays);
          totalDeductions += lopDeductionAmount;

          // Apply Overtime Earnings
          const otRate = (structure.baseSalary / 240) * 1.5;
          const otEarnings = Math.round(approvedOTHours * otRate);
          grossSalary += otEarnings;
          variables['OvertimeEarnings'] = otEarnings;

          // Apply Country Adapter (Statutory + Taxes)
          const adapter = PayrollAdapterFactory.getAdapter('IN'); 
          
          const statutory = await adapter.applyStatutoryCompliance(grossSalary, basicSalaryVal);
          for (const val of Object.values(statutory)) totalDeductions += val;

          const taxResult = await adapter.calculateTaxes({
            organizationId: run.organizationId,
            employeeId: structure.employeeId,
            grossSalary: grossSalary,
            yearToDateTaxPaid: 0,
            monthIndex: monthNum,
            runCycle: run.runCycle
          });
          totalDeductions += taxResult.totalTaxes;

          // Net Salary cannot be negative
          const netSalary = Math.max(0, grossSalary - totalDeductions + approvedReimbursementAmount);

          // Upsert the Payroll record
          const payrollRecord = await Payroll.findOneAndUpdate(
            { organizationId: run.organizationId, employeeId: structure.employeeId, month: run.runCycle },
            {
              baseSalary: structure.baseSalary,
              bonus: otEarnings,
              deductions: totalDeductions,
              reimbursements: approvedReimbursementAmount,
              finalSalary: netSalary,
              paidStatus: 'PROCESSING'
            },
            { upsert: true, new: true }
          );

          // Generate detailed Payslip record
          await Payslip.findOneAndUpdate(
            { organizationId: run.organizationId, payrollId: payrollRecord._id, employeeId: structure.employeeId, month: run.runCycle },
            {
              allowances: {
                basic: basicSalaryVal,
                hra: variables['HRA'] || 0,
                conveyance: variables['Conveyance'] || 0,
                medical: variables['Medical'] || 0,
                bonus: otEarnings,
              },
              deductions: {
                professionalTax: statutory['Professional Tax'] || 0,
                providentFund: statutory['EPF'] || 0,
                leaveDeductions: lopDeductionAmount,
                latePenalties: Math.round(lateDeductionDays * dailyRate),
              },
              reimbursements: approvedReimbursementAmount,
              netSalary: netSalary,
            },
            { upsert: true }
          );

          processed++;
          totalPayout += netSalary;
        } catch (err: any) {
          failed++;
          run.processingLog.push(`Error for Employee ${structure.employeeId}: ${err.message}`);
        }
      }

      run.status = 'LOCKED'; // Awaiting approval
      run.totalProcessedCount = processed;
      run.totalFailedCount = failed;
      run.totalPayoutAmount = totalPayout;
      await run.save();

    } catch (err: any) {
      run.status = 'FAILED';
      run.processingLog.push(`Batch crash: ${err.message}`);
      await run.save();
    }
  }

  public static async approveRun(organizationId: Types.ObjectId, runCycle: string, approvedBy: Types.ObjectId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const run = await PayrollRun.findOne({ organizationId, runCycle }).session(session);
      if (!run) throw new Error("Payroll run not found");
      if (run.status !== 'LOCKED') {
        throw new Error(`Cannot approve payroll run in ${run.status} status`);
      }

      run.status = 'COMPLETED';
      run.approvedBy = approvedBy;
      await run.save({ session });

      // Update all payroll records for this month to PAID
      await Payroll.updateMany(
        { organizationId, month: runCycle },
        { paidStatus: 'PAID', paymentDate: new Date() },
        { session }
      );

      await session.commitTransaction();
      return run;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  public static async rollbackRun(organizationId: Types.ObjectId, runCycle: string) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const run = await PayrollRun.findOne({ organizationId, runCycle }).session(session);
      if (!run) throw new Error("Run not found");
      if (run.status === 'COMPLETED') {
        throw new Error("Cannot rollback a completed/paid payroll run without finance voiding.");
      }

      await Payroll.deleteMany({ organizationId, month: runCycle, paidStatus: { $ne: 'PAID' } }, { session });
      await Payslip.deleteMany({ organizationId, month: runCycle }, { session });
      
      run.status = 'ROLLED_BACK';
      run.processingLog.push(`Rolled back on ${new Date().toISOString()}`);
      await run.save({ session });

      await session.commitTransaction();
      return run;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }
}
