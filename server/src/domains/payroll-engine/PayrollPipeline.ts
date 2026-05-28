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
import { PermissionRequest } from '../../models/PermissionRequest.js';
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

  public static getCycleDates(runCycle: string, startDay: number = 1): { startDate: Date; endDate: Date; startStr: string; endStr: string; endDay: number } {
    const [year, month] = runCycle.split('-').map(Number);
    
    if (startDay === 1) {
      const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
      const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
      
      const startStr = `${runCycle}-01`;
      const lastDay = endDate.getUTCDate();
      const endStr = `${runCycle}-${lastDay < 10 ? '0' + lastDay : lastDay}`;
      
      return { startDate, endDate, startStr, endStr, endDay: lastDay };
    } else {
      const prevDate = new Date(Date.UTC(year, month - 2, 1));
      const prevYear = prevDate.getUTCFullYear();
      const prevMonth = prevDate.getUTCMonth() + 1;
      const maxDaysPrev = new Date(prevYear, prevMonth, 0).getDate();
      const clampedStartDay = Math.min(startDay, maxDaysPrev);
      
      const startDate = new Date(Date.UTC(prevYear, prevMonth - 1, clampedStartDay, 0, 0, 0, 0));
      
      const currentMonthMaxDays = new Date(year, month, 0).getDate();
      const endDayVal = startDay - 1;
      const clampedEndDay = Math.min(endDayVal, currentMonthMaxDays);
      const endDate = new Date(Date.UTC(year, month - 1, clampedEndDay, 23, 59, 59, 999));
      
      const startMonthStr = prevMonth < 10 ? `0${prevMonth}` : `${prevMonth}`;
      const startDayStr = clampedStartDay < 10 ? `0${clampedStartDay}` : `${clampedStartDay}`;
      const startStr = `${prevYear}-${startMonthStr}-${startDayStr}`;
      
      const endMonthStr = month < 10 ? `0${month}` : `${month}`;
      const endDayStr = clampedEndDay < 10 ? `0${clampedEndDay}` : `${clampedEndDay}`;
      const endStr = `${year}-${endMonthStr}-${endDayStr}`;
      
      const msDiff = endDate.getTime() - startDate.getTime();
      const totalCalendarDays = Math.round(msDiff / (1000 * 60 * 60 * 24)) + 1;

      return { startDate, endDate, startStr, endStr, endDay: totalCalendarDays };
    }
  }

  private static async processBatch(run: any) {
    let processed = 0;
    let failed = 0;
    let totalPayout = 0;
    try {
      const org = await Organization.findById(run.organizationId);
      const salaryCycleStartDay = org?.settings?.salaryCycleStartDay || 1;
      const monthNum = parseInt(run.runCycle.split('-')[1]);

      const { startDate, endDate, startStr, endStr, endDay } = this.getCycleDates(run.runCycle, salaryCycleStartDay);
      
      const cycleStart = startDate;
      const cycleEnd = endDate;
      
      const activeWorkdays = org?.settings?.activeWorkdays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      const customHolidays = org?.settings?.customHolidays || [];
      
      // Build list of active working days in the cycle
      const workdaysList: string[] = [];
      const currentCursor = new Date(cycleStart);
      while (currentCursor <= cycleEnd) {
        const yearCursor = currentCursor.getUTCFullYear();
        const monthCursor = currentCursor.getUTCMonth() + 1;
        const dayCursor = currentCursor.getUTCDate();
        
        const yStr = yearCursor;
        const mStr = monthCursor < 10 ? `0${monthCursor}` : `${monthCursor}`;
        const dStr = dayCursor < 10 ? `0${dayCursor}` : `${dayCursor}`;
        const dateStr = `${yStr}-${mStr}-${dStr}`;
        
        const dayName = currentCursor.toLocaleDateString('en-US', { weekday: 'short' });
        
        if (activeWorkdays.includes(dayName) && !customHolidays.some(h => h.date === dateStr)) {
          workdaysList.push(dateStr);
        }
        
        currentCursor.setUTCDate(currentCursor.getUTCDate() + 1);
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

          const approvedPermissions = await PermissionRequest.find({
            organizationId: run.organizationId,
            employeeId: structure.employeeId,
            approvalStatus: 'APPROVED',
            date: { $gte: startStr, $lte: endStr }
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

          // Calculate Paid Leave days (excluding unpaid leaves and WFH)
          let paidLeaveDays = 0;
          for (const leave of approvedLeaves) {
            if (leave.leaveType !== 'Unpaid Leave' && leave.leaveType !== 'WFH') {
              paidLeaveDays += getOverlapDays(leave.startDate, leave.endDate, cycleStart, cycleEnd);
            }
          }

          const leaveLimit = org?.settings?.monthlyLeaveLimit || 2;
          const excessLeaveDays = Math.max(0, paidLeaveDays - leaveLimit);

          // Calculate Permission hours LOP
          let totalPermissionHours = 0;
          for (const perm of approvedPermissions) {
            totalPermissionHours += perm.totalHours;
          }
          const permissionLimit = org?.settings?.monthlyPermissionHours || 3;
          const excessPermissionHours = Math.max(0, totalPermissionHours - permissionLimit);
          const permissionLopDays = excessPermissionHours / 8; // Assuming 8-hour workday

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
          const totalLOPDays = unpaidDays + absentDays + lateDeductionDays + excessLeaveDays + permissionLopDays;

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

  /**
   * Generates a list of all YYYY-MM cycles between start and end cycles (inclusive)
   */
  public static generateCycleRange(start: string, end: string): string[] {
    const startParts = start.split('-');
    const endParts = end.split('-');
    
    const startYear = parseInt(startParts[0]);
    const startMonth = parseInt(startParts[1]);
    const endYear = parseInt(endParts[0]);
    const endMonth = parseInt(endParts[1]);
    
    const cycles: string[] = [];
    
    let year = startYear;
    let month = startMonth;
    
    while (year < endYear || (year === endYear && month <= endMonth)) {
      const monthStr = String(month).padStart(2, '0');
      cycles.push(`${year}-${monthStr}`);
      
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }
    
    return cycles;
  }
}
