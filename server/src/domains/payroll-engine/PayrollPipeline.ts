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
import { Employee } from '../../models/Employee.js';
import { PayrollConfig, DEFAULT_PAYROLL_CONFIG } from '../../models/payroll/PayrollConfig.js';
import { PermissionRequest } from '../../models/PermissionRequest.js';
import mongoose, { Types } from 'mongoose';

export class PayrollPipeline {
  /**
   * Triggers an asynchronous bulk payroll processing run for a given cycle.
   * Lock-guaranteed atomic implementation.
   */
  /**
   * Atomically locks a range of target cycles to PROCESSING state first,
   * then launches sequential batch calculations in a detached background worker.
   */
  public static async triggerRangeProcessing(organizationId: Types.ObjectId, startCycle: string, endCycle: string) {
    const cycles = this.generateCycleRange(startCycle, endCycle);
    const runs = [];

    // Atomically check and lock all cycles in the range
    for (const cycle of cycles) {
      let run = await PayrollRun.findOneAndUpdate(
        { organizationId, runCycle: cycle, status: { $nin: ['PROCESSING', 'LOCKED', 'COMPLETED'] } },
        { $set: { status: 'PROCESSING', processingLog: [`Batch trigger range started on ${new Date().toISOString()}`] } },
        { new: true }
      );

      if (!run) {
        const existing = await PayrollRun.findOne({ organizationId, runCycle: cycle });
        if (existing) {
          throw new Error(`Payroll run for ${cycle} is already in ${existing.status} state.`);
        }
        run = new PayrollRun({ organizationId, runCycle: cycle, status: 'PROCESSING', processingLog: [`Batch trigger range started on ${new Date().toISOString()}`] });
        await run.save();
      }
      runs.push(run);
    }

    // Detach and run sequentially to ensure month-over-month cumulative consistency
    this.processSequentialRange(runs).catch(console.error);

    return runs;
  }

  private static async processSequentialRange(runs: any[]) {
    for (const run of runs) {
      try {
        await this.processBatch(run);
      } catch (err: any) {
        run.status = 'FAILED';
        run.processingLog.push(`Sequential batch run failed: ${err.message}`);
        await run.save();
      }
    }
  }

  /**
   * Triggers an asynchronous bulk payroll processing run for a given cycle.
   * Lock-guaranteed atomic implementation (Backward compatible fallback).
   */
  public static async triggerBulkProcessing(organizationId: Types.ObjectId, runCycle: string) {
    const runs = await this.triggerRangeProcessing(organizationId, runCycle, runCycle);
    return runs[0];
  }

  private static async processBatch(run: any) {
    let processed = 0;
    let failed = 0;
    let totalPayout = 0;
    
    try {
      // Fetch Organization for settings first
      const org = await Organization.findById(run.organizationId);
      const startDay = org?.settings?.payrollCycleStartDay || 1;

      const [year, month] = run.runCycle.split('-');
      const yearNum = parseInt(year);
      const monthNum = parseInt(month);
      
      let startStr = '';
      let endStr = '';
      let endDay = 0;

      if (startDay <= 1) {
        endDay = new Date(yearNum, monthNum, 0).getDate();
        startStr = `${run.runCycle}-01`;
        endStr = `${run.runCycle}-${endDay < 10 ? '0' + endDay : endDay}`;
      } else {
        const prevDate = new Date(yearNum, monthNum - 2, 1);
        const prevYear = prevDate.getFullYear();
        const prevMonth = prevDate.getMonth() + 1;
        const prevMonthStr = prevMonth < 10 ? `0${prevMonth}` : `${prevMonth}`;
        const startDayStr = startDay < 10 ? `0${startDay}` : `${startDay}`;
        startStr = `${prevYear}-${prevMonthStr}-${startDayStr}`;

        const endDayVal = startDay - 1;
        const endDayStr = endDayVal < 10 ? `0${endDayVal}` : `${endDayVal}`;
        endStr = `${run.runCycle}-${endDayStr}`;

        const date1 = new Date(startStr);
        const date2 = new Date(endStr);
        endDay = Math.round((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      }
      
      const cycleStart = new Date(startStr);
      const cycleEnd = new Date(endStr);
      
      const activeWorkdays = org?.settings?.activeWorkdays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      const customHolidays = org?.settings?.customHolidays || [];
      
      // Build list of active working days in the cycle
      const workdaysList: string[] = [];
      const curDate = new Date(cycleStart);
      while (curDate <= cycleEnd) {
        const dStr = curDate.getDate() < 10 ? `0${curDate.getDate()}` : `${curDate.getDate()}`;
        const mStr = (curDate.getMonth() + 1) < 10 ? `0${(curDate.getMonth() + 1)}` : `${(curDate.getMonth() + 1)}`;
        const dateStr = `${curDate.getFullYear()}-${mStr}-${dStr}`;
        const dayName = curDate.toLocaleDateString('en-US', { weekday: 'short' });
        
        if (activeWorkdays.includes(dayName) && !customHolidays.some(h => h.date === dateStr)) {
          workdaysList.push(dateStr);
        }
        curDate.setDate(curDate.getDate() + 1);
      }

      // Fetch all active employees
      const employees = await Employee.find({
        organizationId: run.organizationId,
        isActive: true
      });

      // Fetch organization-wide default configurations
      let defaultConfig = await PayrollConfig.findOne({ organizationId: run.organizationId, employeeId: null });
      const defaultConfigValues = defaultConfig ? defaultConfig.toObject() : { ...DEFAULT_PAYROLL_CONFIG };

      for (const employee of employees) {
        try {
          // Check if employee has an active SalaryStructure
          const structure = await SalaryStructure.findOne({
            organizationId: run.organizationId,
            employeeId: employee._id,
            status: 'ACTIVE'
          }).populate('components.componentId');

          // Fetch leaves, attendance, and reimbursements
          const approvedLeaves = await Leave.find({
            organizationId: run.organizationId,
            employeeId: employee._id,
            status: 'APPROVED',
            startDate: { $lte: endStr },
            endDate: { $gte: startStr }
          });

          const attendanceRecords = await Attendance.find({
            organizationId: run.organizationId,
            employeeId: employee._id,
            date: { $gte: startStr, $lte: endStr }
          });

          const reimbursementClaims = await ReimbursementClaim.find({
            organizationId: run.organizationId,
            employeeId: employee._id,
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

          // Calculate Absent / Auto-Leave days (anyone not logged in is considered on auto-leave for that workday)
          let absentDays = 0;
          let unloggedLeaveDays = 0;
          for (const dateStr of workdaysList) {
            const att = attendanceRecords.find(a => a.date === dateStr);
            const isPresent = att && (att.status === 'OFFICE' || att.status === 'WFH');
            if (isPresent) continue;
            
            const isOnLeave = approvedLeaves.some(l => dateStr >= l.startDate && dateStr <= l.endDate);
            if (isOnLeave) continue;

            unloggedLeaveDays++;
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

          // Fetch employee-specific or organization default configuration
          const empConfig = await PayrollConfig.findOne({ organizationId: run.organizationId, employeeId: employee._id });
          const config = empConfig ? empConfig.toObject() : defaultConfigValues;

          // Calculate approved Casual Leave days taken in the month
          let casualLeaveDays = 0;
          for (const leave of approvedLeaves) {
            if (leave.leaveType === 'Casual Leave') {
              let days = getOverlapDays(leave.startDate, leave.endDate, cycleStart, cycleEnd);
              if (leave.isHalfDay) days = 0.5;
              casualLeaveDays += days;
            }
          }
          // Automatically consider any unlogged workday as a Casual Leave day
          casualLeaveDays += unloggedLeaveDays;

          // Fetch approved Permission requests taken in the month
          const approvedPermissions = await PermissionRequest.find({
            organizationId: run.organizationId,
            employeeId: employee._id,
            approvalStatus: 'APPROVED',
            date: { $gte: startStr, $lte: endStr }
          });
          const totalPermissionHours = approvedPermissions.reduce((sum, p) => sum + (p.totalHours || 0), 0);

          // Retrieve monthly limits configured by admin
          const casualLeaveLimit = org?.settings?.monthlyLeaveLimit || 2;
          const permissionLimit = org?.settings?.monthlyPermissionHours || 3;

          // Compute excess over limits
          const excessLeaveDays = Math.max(0, casualLeaveDays - casualLeaveLimit);
          const excessPermissionHours = Math.max(0, totalPermissionHours - permissionLimit);

          // Total base Loss of Pay Days (unpaid, absent, late penalty)
          const baseLOPDays = unpaidDays + absentDays + lateDeductionDays;

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

          let grossSalary = 0;
          let totalDeductions = 0;
          let basicSalaryVal = 0;
          let otEarnings = 0;
          let netSalary = 0;
          let dailyRate = 0;
          let lopDeductionAmount = 0;

          // Variables map to save to Payslip
          let allowancesObj: any = {};
          let deductionsObj: any = {};
          let employerContributionsObj: any = {};

          if (structure) {
            // Rule Engine Variable Bindings
            const variables: Record<string, number> = { 
              Base: structure.baseSalary,
              Present_Days: Math.max(0, workdaysList.length - absentDays - unpaidDays),
              Late_Days: lateCount,
              OT_Hours: approvedOTHours,
              Unpaid_Days: baseLOPDays,
              Reimbursements: approvedReimbursementAmount
            };
            
            let totalEarnings = 0;
            let structureDeductions = 0;
            basicSalaryVal = structure.baseSalary; // default basic fallback

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
              if (comp.type === 'DEDUCTION') structureDeductions += amount;
            }

            grossSalary = totalEarnings;
            
            // Calculate Sundays and Divisor Days for per-day rate
            let sundaysCount = 0;
            const sunCur = new Date(cycleStart);
            while (sunCur <= cycleEnd) {
              if (sunCur.getDay() === 0) {
                sundaysCount++;
              }
              sunCur.setDate(sunCur.getDate() + 1);
            }
            const paidCasualLeaveDays = Math.min(casualLeaveLimit, casualLeaveDays);
            const paidPermissionHours = Math.min(permissionLimit, totalPermissionHours);
            const paidPermissionDays = paidPermissionHours / 8;
            const divisorDays = Math.max(1, endDay - sundaysCount - paidCasualLeaveDays - paidPermissionDays);

            // Apply Loss of Pay salary deductions (base LOP days + exceeding leave days + exceeding permission hours)
            dailyRate = grossSalary / divisorDays;
            const baseLOPAmount = Math.round(dailyRate * baseLOPDays);
            const excessLeaveLOPAmount = Math.round(excessLeaveDays * (config.lossOfPayPerLeaveDay || dailyRate));
            const excessPermissionLOPAmount = Math.round(excessPermissionHours * (config.lossOfPayPerPermissionHour || (dailyRate / 8)));
            
            lopDeductionAmount = baseLOPAmount + excessLeaveLOPAmount + excessPermissionLOPAmount;
            totalDeductions = structureDeductions + lopDeductionAmount;

            // Apply Overtime Earnings
            const otRate = (structure.baseSalary / 240) * 1.5;
            otEarnings = Math.round(approvedOTHours * otRate);
            grossSalary += otEarnings;
            variables['OvertimeEarnings'] = otEarnings;

            // Apply Country Adapter (Statutory + Taxes)
            const adapter = PayrollAdapterFactory.getAdapter('IN'); 
            
            const statutory = await adapter.applyStatutoryCompliance(grossSalary, basicSalaryVal);
            for (const val of Object.values(statutory)) totalDeductions += val;

            const taxResult = await adapter.calculateTaxes({
              organizationId: run.organizationId,
              employeeId: employee._id,
              grossSalary: grossSalary,
              yearToDateTaxPaid: 0,
              monthIndex: monthNum,
              runCycle: run.runCycle
            });
            totalDeductions += taxResult.totalTaxes;

            // Net Salary cannot be negative
            netSalary = Math.max(0, grossSalary - totalDeductions + approvedReimbursementAmount);

            allowancesObj = {
              basic: basicSalaryVal,
              hra: variables['HRA'] || 0,
              conveyance: variables['Conveyance'] || 0,
              medical: variables['Medical'] || 0,
              bonus: otEarnings,
              specialAllowance: variables['SpecialAllowance'] || 0,
              performanceIncentive: variables['PerformanceIncentive'] || 0,
            };

            deductionsObj = {
              professionalTax: statutory['Professional Tax'] || 0,
              providentFund: statutory['EPF'] || 0,
              leaveDeductions: lopDeductionAmount,
              latePenalties: Math.round(lateDeductionDays * dailyRate),
              tds: taxResult.totalTaxes || 0,
            };

            employerContributionsObj = {
              pfEmployer: 0,
              gratuity: 0,
              esi: 0,
              insurance: 0,
            };

          } else {
            const ctcMonthly = employee.salary || 0;
            const ctcAnnual = ctcMonthly * 12;

            // Earnings calculation
            basicSalaryVal = Math.round(ctcMonthly * config.basicSalaryPercent / 100);
            const hra = Math.round(basicSalaryVal * config.hraPercent / 100);
            const conveyance = ctcMonthly > 0 ? config.conveyanceMonthly : 0;
            const performanceIncentive = ctcMonthly > 0 ? config.performanceIncentiveMonthly : 0;
            const otherAllowances = ctcMonthly > 0 ? config.otherAllowancesMonthly : 0;

            // Employer contributions (part of CTC)
            const pfEmployer = Math.round(basicSalaryVal * config.pfEmployerPercent / 100);
            const gratuity = Math.round(basicSalaryVal * config.gratuityPercent / 100);

            const grossBeforeSpecial = basicSalaryVal + hra + conveyance + performanceIncentive + otherAllowances;

            // ESI Employer (conditional)
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

            // Special allowance fills the gap
            const specialAllowance = Math.max(0, Math.round(ctcMonthly - grossBeforeSpecial - totalEmployerContributions));
            grossSalary = grossBeforeSpecial + specialAllowance;

            // Deductions
            const pfEmployee = Math.round(basicSalaryVal * config.pfEmployeePercent / 100);
            const professionalTax = ctcMonthly > 0 ? config.professionalTaxMonthly : 0;
            const tds = ctcMonthly > 0 ? config.incomeTaxTdsMonthly : 0;
            const baseDeductions = pfEmployee + professionalTax + tds;

            // Calculate Sundays and Divisor Days for per-day rate
            let sundaysCount = 0;
            const sunCur = new Date(cycleStart);
            while (sunCur <= cycleEnd) {
              if (sunCur.getDay() === 0) {
                sundaysCount++;
              }
              sunCur.setDate(sunCur.getDate() + 1);
            }
            const paidCasualLeaveDays = Math.min(casualLeaveLimit, casualLeaveDays);
            const paidPermissionHours = Math.min(permissionLimit, totalPermissionHours);
            const paidPermissionDays = paidPermissionHours / 8;
            const divisorDays = Math.max(1, endDay - sundaysCount - paidCasualLeaveDays - paidPermissionDays);

            // Apply Loss of Pay salary deductions (base LOP days + exceeding leave days + exceeding permission hours)
            dailyRate = grossSalary / divisorDays;
            const baseLOPAmount = Math.round(dailyRate * baseLOPDays);
            const excessLeaveLOPAmount = Math.round(excessLeaveDays * (config.lossOfPayPerLeaveDay || dailyRate));
            const excessPermissionLOPAmount = Math.round(excessPermissionHours * (config.lossOfPayPerPermissionHour || (dailyRate / 8)));
            
            lopDeductionAmount = baseLOPAmount + excessLeaveLOPAmount + excessPermissionLOPAmount;

            // Apply Overtime Earnings
            const otRate = (basicSalaryVal / 240) * 1.5;
            otEarnings = Math.round(approvedOTHours * otRate);

            // Total pay with overtime, deductions with LOP
            const finalGross = grossSalary + otEarnings;
            totalDeductions = baseDeductions + lopDeductionAmount;

            netSalary = Math.max(0, Math.round(finalGross - totalDeductions + approvedReimbursementAmount));

            allowancesObj = {
              basic: basicSalaryVal,
              hra,
              conveyance,
              medical: 0,
              bonus: otEarnings,
              specialAllowance,
              performanceIncentive,
            };

            deductionsObj = {
              professionalTax,
              providentFund: pfEmployee,
              leaveDeductions: lopDeductionAmount,
              latePenalties: Math.round(lateDeductionDays * dailyRate),
              tds,
            };

            employerContributionsObj = {
              pfEmployer,
              gratuity,
              esi: esiEmployer,
              insurance,
            };
          }

          // Upsert the Payroll record
          const payrollRecord = await Payroll.findOneAndUpdate(
            { organizationId: run.organizationId, employeeId: employee._id, month: run.runCycle },
            {
              baseSalary: basicSalaryVal,
              bonus: otEarnings,
              deductions: totalDeductions,
              reimbursements: approvedReimbursementAmount,
              finalSalary: netSalary,
              paidStatus: 'PROCESSING',
              ctcAnnual: (employee.salary || basicSalaryVal) * 12,
              grossPay: grossSalary + otEarnings,
            },
            { upsert: true, new: true }
          );

          // Generate detailed Payslip record
          await Payslip.findOneAndUpdate(
            { organizationId: run.organizationId, payrollId: payrollRecord._id, employeeId: employee._id, month: run.runCycle },
            {
              allowances: allowancesObj,
              deductions: deductionsObj,
              employerContributions: employerContributionsObj,
              reimbursements: approvedReimbursementAmount,
              netSalary: netSalary,
            },
            { upsert: true }
          );

          processed++;
          totalPayout += netSalary;

        } catch (err: any) {
          failed++;
          run.processingLog.push(`Error for Employee ${employee._id}: ${err.message}`);
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
