import React, { useState, useMemo, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../WrapperComponents/Modal';
import { Button } from '../WrapperComponents/Button';

import { payrollConfigApi } from '../../api_service/payrollConfigApi';
import { employeeApi } from '../../api_service/employeeApi';
import { leaveBalanceApi } from '../../api_service/leavePolicyApi';
import { analyticsApi } from '../../api_service/analyticsApi';
import { useNotificationStore } from '../../store/useNotificationStore';
import { formatCurrency } from '../../utils/formatters';
import type { PayrollConfig } from '../../types';
import { Save, Info, Users, Calendar, Clock, Home } from 'lucide-react';



interface PayrollSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}



export const PayrollSetupModal: React.FC<PayrollSetupModalProps> = ({ isOpen, onClose }) => {
  const { addToast } = useNotificationStore();
  const queryClient = useQueryClient();

  // Employee Selection State (required — no organization-wide mode)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  // Local state for the preview/editable salary (Monthly CTC)
  const [currentSalary, setCurrentSalary] = useState<number>(0);

  // Fetch all active employees for dropdown (setting high limit to bypass default pagination)
  const { data: employees } = useQuery({
    queryKey: ['employees', 'all-active-for-payroll-setup'],
    queryFn: () => employeeApi.getAll({ limit: 1000, isActive: true }).then(res => res.employees),
    enabled: isOpen,
  });

  // Form state
  const [formData, setFormData] = useState<PayrollConfig>({
    basicSalaryPercent: 55,
    hraPercent: 20,
    conveyanceMonthly: 5,
    performanceIncentiveMonthly: 10,
    otherAllowancesMonthly: 10,
    pfEmployeePercent: 0,
    professionalTaxMonthly: 0,
    incomeTaxTdsMonthly: 0,
    pfEmployerPercent: 0,
    gratuityPercent: 0,
    esiEmployerPercent: 0,
    insuranceMonthly: 0,
    applyEsiOnlyIfGrossBelow21000: false,
  });

  // Fetch existing config (automatically refetches when selectedEmployeeId changes)
  const { data: existingConfig, isLoading } = useQuery({
    queryKey: ['payrollConfig', selectedEmployeeId],
    queryFn: () => payrollConfigApi.get(selectedEmployeeId),
    enabled: isOpen,
  });

  // Fetch leave balance for selected employee to show statistics
  const { data: leaveBalances } = useQuery({
    queryKey: ['leaveBalances', selectedEmployeeId],
    queryFn: () => leaveBalanceApi.getEmployeeBalances(selectedEmployeeId!),
    enabled: !!selectedEmployeeId && isOpen,
  });

  // Fetch organization settings to get leave and holiday configurations
  const { data: orgSettings } = useQuery({
    queryKey: ['companySettings'],
    queryFn: analyticsApi.getSettings,
    enabled: isOpen,
  });

  // Calculate Loss of Pay (LOP) details dynamically
  // LOP is ONLY triggered when company limits are exceeded — not otherwise.
  const lopDetails = useMemo(() => {
    if (!selectedEmployeeId || !leaveBalances || !orgSettings) {
      return {
        totalLeavesTaken: 0,
        excessLeaves: 0,
        excessPermissions: 0,
        permissionLopDays: 0,
        excessWfh: 0,
        wfhLopDays: 0,
        lopDays: 0,
        workingDays: 30,
        holidayCount: 0,
        dailyRate: 0,
        lopAmount: 0
      };
    }

    const leaveLimit = orgSettings.monthlyLeaveLimit ?? 2;
    const wfhLimit = orgSettings.monthlyWFHLimit ?? 1;
    const permissionLimit = orgSettings.monthlyPermissionHours ?? 3;

    // 1. All leave types (including unpaid) are counted together.
    //    LOP only applies when the total exceeds the company's monthly leave limit.
    const totalLeavesTaken = leaveBalances
      .filter(b => {
        const type = (b.leaveType || '').toLowerCase().trim();
        return type !== 'wfh' && type !== 'permission';
      })
      .reduce((sum, b) => sum + (b.used || 0), 0);
    const excessLeaves = Math.max(0, totalLeavesTaken - leaveLimit);

    // 2. Permissions — LOP only when total hours exceed the monthly permission limit.
    //    Excess hours are converted to LOP days (8 hrs = 1 day).
    const permissionsTaken = leaveBalances
      .filter(b => (b.leaveType || '').toLowerCase().trim() === 'permission')
      .reduce((sum, b) => sum + (b.used || 0), 0);
    const excessPermissions = Math.max(0, permissionsTaken - permissionLimit);
    const permissionLopDays = excessPermissions / 8;

    // 3. WFH — LOP only when days taken exceed the monthly WFH limit (1-to-1).
    const wfhTaken = leaveBalances
      .filter(b => (b.leaveType || '').toLowerCase().trim() === 'wfh')
      .reduce((sum, b) => sum + (b.used || 0), 0);
    const excessWfh = Math.max(0, wfhTaken - wfhLimit);
    const wfhLopDays = excessWfh;

    // Total LOP days — zero if no limits are exceeded
    const lopDays = excessLeaves + permissionLopDays + wfhLopDays;

    // Daily rate calculation excludes public holidays for the current month
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIndex = now.getMonth();
    const totalDaysInMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();

    const holidayCount = orgSettings.customHolidays
      ? orgSettings.customHolidays.filter((h: any) => {
          if (!h.date) return false;
          const hDate = new Date(h.date);
          return hDate.getFullYear() === currentYear && hDate.getMonth() === currentMonthIndex;
        }).length
      : 0;

    const workingDays = Math.max(1, totalDaysInMonth - holidayCount);
    const dailyRate = currentSalary / workingDays;
    const lopAmount = Math.round(lopDays * dailyRate);

    return {
      totalLeavesTaken,
      excessLeaves,
      excessPermissions,
      permissionLopDays,
      excessWfh,
      wfhLopDays,
      lopDays,
      workingDays,
      holidayCount,
      dailyRate,
      lopAmount
    };
  }, [selectedEmployeeId, leaveBalances, orgSettings, currentSalary]);



  // Find selected employee object
  const targetEmployee = useMemo(() => {
    if (!selectedEmployeeId || !employees) return null;
    return employees.find((e: any) => e._id === selectedEmployeeId);
  }, [selectedEmployeeId, employees]);

  // Sync currentSalary state when selected employee changes
  useEffect(() => {
    if (targetEmployee) {
      setCurrentSalary(targetEmployee.salary || 0);
    } else {
      setCurrentSalary(0);
    }
  }, [targetEmployee]);

  const handleSalaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value) || 0;
    setCurrentSalary(val / 12);
  };

  useEffect(() => {
    if (existingConfig) {
      let conveyance = existingConfig.conveyanceMonthly;
      let otherAllowances = existingConfig.otherAllowancesMonthly;
      let performance = existingConfig.performanceIncentiveMonthly;

      // Migrate legacy default/fixed values to percentages
      if (conveyance === 1600 || conveyance > 100) {
        conveyance = 5;
        otherAllowances = 10;
      }
      if (performance > 100) {
        performance = 10;
      }

      setFormData({
        employeeId: existingConfig.employeeId || null,
        basicSalaryPercent: existingConfig.basicSalaryPercent,
        hraPercent: existingConfig.hraPercent,
        conveyanceMonthly: conveyance,
        performanceIncentiveMonthly: performance,
        otherAllowancesMonthly: otherAllowances,
        pfEmployeePercent: 0,
        professionalTaxMonthly: 0,
        incomeTaxTdsMonthly: 0,
        pfEmployerPercent: 0,
        gratuityPercent: 0,
        esiEmployerPercent: 0,
        insuranceMonthly: 0,
        applyEsiOnlyIfGrossBelow21000: false,
      });
    }
  }, [existingConfig]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: payrollConfigApi.save,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrollConfig'] });
      addToast('Configuration Saved', 'Payroll setup has been saved and will apply to future payroll calculations.', 'success');
      onClose();
    },
    onError: (error: any) => {
      addToast('Save Failed', error?.response?.data?.message || error.message || 'Could not save payroll configuration.', 'error');
    },
  });

  const handleChange = (field: keyof PayrollConfig, value: number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNumberChange = (field: keyof PayrollConfig) => (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = parseFloat(e.target.value) || 0;
    // Constrain percentage fields to maximum 100
    if ((field.endsWith('Percent') || field === 'conveyanceMonthly' || field === 'otherAllowancesMonthly' || field === 'performanceIncentiveMonthly') && val > 100) {
      val = 100;
    }
    handleChange(field, val);
  };

  // Live preview calculations
  const preview = useMemo(() => {
    const ctcMonthly = currentSalary;
    const basic = Math.round(ctcMonthly * formData.basicSalaryPercent / 100);
    const hra = Math.round(ctcMonthly * formData.hraPercent / 100);
    const conveyance = Math.round(ctcMonthly * formData.conveyanceMonthly / 100);
    const performance = Math.round(ctcMonthly * formData.performanceIncentiveMonthly / 100);
    const otherAllowances = Math.round(ctcMonthly * formData.otherAllowancesMonthly / 100);

    // Employer contributions
    const pfEmployer = Math.round(basic * formData.pfEmployerPercent / 100);
    const gratuity = Math.round(basic * formData.gratuityPercent / 100);

    const grossBeforeSpecial = basic + hra + conveyance + performance + otherAllowances;

    let esiEmployer = 0;
    if (formData.applyEsiOnlyIfGrossBelow21000) {
      if (grossBeforeSpecial < 21000) {
        esiEmployer = Math.round(grossBeforeSpecial * formData.esiEmployerPercent / 100);
      }
    } else {
      esiEmployer = Math.round(grossBeforeSpecial * formData.esiEmployerPercent / 100);
    }

    const insurance = formData.insuranceMonthly;
    const totalEmployerContributions = pfEmployer + gratuity + esiEmployer + insurance;

    const specialAllowance = Math.max(0, Math.round(ctcMonthly - grossBeforeSpecial - totalEmployerContributions));
    const grossPay = grossBeforeSpecial + specialAllowance;

    // Deductions
    const pfEmployee = Math.round(basic * formData.pfEmployeePercent / 100);
    const professionalTax = formData.professionalTaxMonthly;
    const tds = formData.incomeTaxTdsMonthly;
    const lopDeduction = lopDetails.lopAmount;
    const totalDeductions = pfEmployee + professionalTax + tds + lopDeduction;

    const netPay = grossPay - totalDeductions;

    return {
      ctcMonthly,
      grossPay,
      basic,
      hra,
      conveyance,
      performance,
      otherAllowances,
      specialAllowance,
      pfEmployee,
      professionalTax,
      tds,
      totalDeductions,
      netPay,
      lopDeduction,
      pfEmployer,
      gratuity,
      esiEmployer,
      insurance,
    };
  }, [formData, currentSalary, lopDetails]);

  const handleSubmit = async () => {
    if (!selectedEmployeeId) {
      addToast('No Employee Selected', 'Please select an employee before saving.', 'error');
      return;
    }
    try {
      // Save the employee's new salary first
      await employeeApi.update(selectedEmployeeId, { salary: currentSalary });
      queryClient.invalidateQueries({ queryKey: ['employees'] });

      // Then save the payroll config for this employee
      saveMutation.mutate({ ...formData, employeeId: selectedEmployeeId } as any);
    } catch (err: any) {
      addToast('Error', err.message || 'Failed to update employee salary.', 'error');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Payroll Setup" maxWidth="max-w-6xl">
      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="space-y-6 text-left">
          {/* Employee Selection Dropdown */}
          <div className="rounded-xl border border-border p-4 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">Select Employee</h4>
                <p className="text-xs text-muted-foreground">
                  Choose the employee to configure payroll structure and calculate their net pay.
                </p>
              </div>
            </div>
            <div className="w-full sm:w-80">
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full h-10 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors"
              >
                <option value="">— Select an employee —</option>
                {employees?.map((emp: any) => {
                  const hasRealCode = emp.employeeCode && !emp.employeeCode.startsWith('TEMP-EMP-');
                  return (
                    <option key={emp._id} value={emp._id}>
                      {emp.fullName}{hasRealCode ? ` (${emp.employeeCode})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {selectedEmployeeId && employees && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
              {/* Leaves Taken Card */}
              <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between transition-all hover:shadow-md hover:border-primary/30 group">
                <div className="space-y-1 z-10">
                  <span className="text-[10px] uppercase font-black text-muted-foreground tracking-wider block">Total Leaves Taken</span>
                  <span className="text-2xl font-black text-foreground tracking-tight">
                    {leaveBalances ? (
                      leaveBalances
                        .filter(b => {
                          const type = (b.leaveType || '').toLowerCase().trim();
                          return type !== 'wfh' && type !== 'permission';
                        })
                        .reduce((sum, b) => sum + (b.used || 0), 0)
                    ) : (
                      <span className="inline-block animate-pulse w-8 h-6 bg-muted rounded" />
                    )}{' '}
                    <span className="text-xs font-semibold text-muted-foreground">Days</span>
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-primary/10 text-primary transition-all group-hover:scale-110">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="absolute right-0 bottom-0 w-24 h-24 bg-gradient-to-tr from-primary/10 to-transparent rounded-full translate-x-8 translate-y-8 blur-md -z-0" />
              </div>

              {/* Permission Taken Card */}
              <div className="relative overflow-hidden rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 flex items-center justify-between transition-all hover:shadow-md hover:border-sky-500/30 group">
                <div className="space-y-1 z-10">
                  <span className="text-[10px] uppercase font-black text-muted-foreground tracking-wider block">Permission Taken</span>
                  <span className="text-2xl font-black text-foreground tracking-tight">
                    {leaveBalances ? (
                      leaveBalances
                        .filter(b => (b.leaveType || '').toLowerCase().trim() === 'permission')
                        .reduce((sum, b) => sum + (b.used || 0), 0)
                    ) : (
                      <span className="inline-block animate-pulse w-8 h-6 bg-muted rounded" />
                    )}{' '}
                    <span className="text-xs font-semibold text-muted-foreground">Hours</span>
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-sky-500/10 text-sky-500 transition-all group-hover:scale-110">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="absolute right-0 bottom-0 w-24 h-24 bg-gradient-to-tr from-sky-500/10 to-transparent rounded-full translate-x-8 translate-y-8 blur-md -z-0" />
              </div>

              {/* WFH Taken Card */}
              <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center justify-between transition-all hover:shadow-md hover:border-emerald-500/30 group">
                <div className="space-y-1 z-10">
                  <span className="text-[10px] uppercase font-black text-muted-foreground tracking-wider block">WFH Taken</span>
                  <span className="text-2xl font-black text-foreground tracking-tight">
                    {leaveBalances ? (
                      leaveBalances
                        .filter(b => (b.leaveType || '').toLowerCase().trim() === 'wfh')
                        .reduce((sum, b) => sum + (b.used || 0), 0)
                    ) : (
                      <span className="inline-block animate-pulse w-8 h-6 bg-muted rounded" />
                    )}{' '}
                    <span className="text-xs font-semibold text-muted-foreground">Days</span>
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500 transition-all group-hover:scale-110">
                  <Home className="w-5 h-5" />
                </div>
                <div className="absolute right-0 bottom-0 w-24 h-24 bg-gradient-to-tr from-emerald-500/10 to-transparent rounded-full translate-x-8 translate-y-8 blur-md -z-0" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT COLUMN — Configuration Inputs */}
            <div className="space-y-6">
              {/* Earnings (CTC Breakup) */}
              <div className="rounded-xl border border-border p-5 space-y-4 bg-card">
                <h4 className="text-sm font-bold text-foreground tracking-tight border-b border-border pb-2">
                  Earnings (CTC Breakup)
                </h4>

                {/* CTC / Salary Input */}
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                  <label className="block text-xs font-bold text-primary uppercase tracking-wider text-left">
                    Yearly Salary / CTC (INR) *
                  </label>
                  <input
                    type="number"
                    value={currentSalary ? Math.round(currentSalary * 12) : ''}
                    onChange={handleSalaryChange}
                    className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-primary transition-colors text-left"
                    placeholder="Enter Yearly CTC / Salary"
                    min={0}
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5 text-left">
                    Updating this value will calculate the new monthly salary for this employee upon save.
                  </p>
                </div>

                {/* Live LOP calculation panel */}
                {selectedEmployeeId && lopDetails.lopDays > 0 && (
                  <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between border-b border-destructive/10 pb-1.5">
                      <span className="text-xs font-bold text-destructive flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5" />
                        Loss of Pay (LOP) Breakdown
                      </span>
                      <span className="text-sm font-black text-destructive">
                        -{formatCurrency(lopDetails.lopAmount)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-left">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Daily Rate (excl. Holidays)</span>
                        <span className="text-xs font-bold text-foreground font-mono">
                          {formatCurrency(lopDetails.dailyRate)}/day
                        </span>
                        <span className="text-[9px] text-muted-foreground block">
                          ({formatCurrency(currentSalary)} / {lopDetails.workingDays} working days, excl. {lopDetails.holidayCount} holidays)
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Total LOP Days</span>
                        <span className="text-xs font-bold text-foreground font-mono">
                          {lopDetails.lopDays.toFixed(2)} Days
                        </span>
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground/80 leading-normal pt-1.5 border-t border-destructive/10 grid grid-cols-2 gap-x-2 gap-y-1">
                      {lopDetails.excessLeaves > 0 && (
                        <span>• Excess Leaves: {lopDetails.excessLeaves} days (taken {lopDetails.totalLeavesTaken}, limit {orgSettings?.monthlyLeaveLimit ?? 2})</span>
                      )}
                      {lopDetails.excessPermissions > 0 && (
                        <span>• Excess Permissions: {lopDetails.excessPermissions} hrs ({lopDetails.permissionLopDays.toFixed(2)} LOP days)</span>
                      )}
                      {lopDetails.excessWfh > 0 && (
                        <span>• Excess WFH: {lopDetails.excessWfh} days</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-primary mb-1 text-left">Basic Salary (% of CTC)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={formData.basicSalaryPercent}
                        onChange={handleNumberChange('basicSalaryPercent')}
                        className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                        min={0} max={100} step={1}
                      />
                      <span className="text-sm text-muted-foreground font-medium">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-primary mb-1 text-left">HRA (% of CTC)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={formData.hraPercent}
                        onChange={handleNumberChange('hraPercent')}
                        className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                        min={0} max={100} step={1}
                      />
                      <span className="text-sm text-muted-foreground font-medium">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-primary mb-1 text-left">Internet Allowance (% of CTC)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={formData.conveyanceMonthly}
                        onChange={handleNumberChange('conveyanceMonthly')}
                        className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                        min={0} max={100} step={1}
                      />
                      <span className="text-sm text-muted-foreground font-medium">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-primary mb-1 text-left">Performance Incentive (% of CTC)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={formData.performanceIncentiveMonthly}
                        onChange={handleNumberChange('performanceIncentiveMonthly')}
                        className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                        min={0} max={100} step={1}
                      />
                      <span className="text-sm text-muted-foreground font-medium">%</span>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-primary mb-1 text-left">City Allowance (% of CTC)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={formData.otherAllowancesMonthly}
                        onChange={handleNumberChange('otherAllowancesMonthly')}
                        className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                        min={0} max={100} step={1}
                      />
                      <span className="text-sm text-muted-foreground font-medium">%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN — Preview */}
            <div className="space-y-6">
              {/* Preview */}
              <div className="rounded-xl border border-primary/30 p-5 space-y-4 bg-primary/5">
                <div>
                  <h4 className="text-sm font-bold text-foreground tracking-tight">
                    {targetEmployee ? `Preview for ${targetEmployee.fullName}` : 'Live Preview'}
                  </h4>
                  {targetEmployee && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Live preview using their base salary of {formatCurrency(targetEmployee.salary)}/month ({formatCurrency(targetEmployee.salary * 12)} annual CTC).
                    </p>
                  )}
                </div>

                {/* Preview Table */}
                <div className="overflow-x-auto rounded-xl border border-border bg-card">
                  <table className="w-full text-sm text-left text-muted-foreground border-collapse">
                    <thead className="text-xs uppercase bg-muted/40 text-foreground border-b border-border font-bold">
                      <tr>
                        <th className="px-4 py-3 text-left">Description</th>
                        <th className="px-4 py-3 text-right">Yearly</th>
                        <th className="px-4 py-3 text-right">Monthly</th>
                        <th className="px-4 py-3 text-right">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 text-foreground">
                      {/* Basic */}
                      <tr className="hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-3 font-semibold text-left">Basic</td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(preview.basic * 12)}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(preview.basic)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-primary">
                          {preview.ctcMonthly > 0 ? `${Math.round((preview.basic / preview.ctcMonthly) * 100)}%` : '0%'}
                        </td>
                      </tr>
                      {/* HRA */}
                      <tr className="hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-3 font-semibold text-left">House Rent Allowance</td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(preview.hra * 12)}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(preview.hra)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-primary">
                          {preview.ctcMonthly > 0 ? `${Math.round((preview.hra / preview.ctcMonthly) * 100)}%` : '0%'}
                        </td>
                      </tr>
                      {/* Conveyance / Internet Allowance */}
                      {preview.conveyance > 0 && (
                        <tr className="hover:bg-muted/10 transition-colors">
                          <td className="px-4 py-3 font-semibold text-left">Internet Allowance</td>
                          <td className="px-4 py-3 text-right font-mono">{formatCurrency(preview.conveyance * 12)}</td>
                          <td className="px-4 py-3 text-right font-mono">{formatCurrency(preview.conveyance)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-primary">
                            {preview.ctcMonthly > 0 ? `${Math.round((preview.conveyance / preview.ctcMonthly) * 100)}%` : '0%'}
                          </td>
                        </tr>
                      )}
                      {/* Performance Incentive */}
                      {preview.performance > 0 && (
                        <tr className="hover:bg-muted/10 transition-colors">
                          <td className="px-4 py-3 font-semibold text-left">Performance Incentive</td>
                          <td className="px-4 py-3 text-right font-mono">{formatCurrency(preview.performance * 12)}</td>
                          <td className="px-4 py-3 text-right font-mono">{formatCurrency(preview.performance)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-primary">
                            {preview.ctcMonthly > 0 ? `${Math.round((preview.performance / preview.ctcMonthly) * 100)}%` : '0%'}
                          </td>
                        </tr>
                      )}
                      {/* Other Allowances / City Allowance */}
                      {preview.otherAllowances > 0 && (
                        <tr className="hover:bg-muted/10 transition-colors">
                          <td className="px-4 py-3 font-semibold text-left">City Allowance</td>
                          <td className="px-4 py-3 text-right font-mono">{formatCurrency(preview.otherAllowances * 12)}</td>
                          <td className="px-4 py-3 text-right font-mono">{formatCurrency(preview.otherAllowances)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-primary">
                            {preview.otherAllowances > 0 && preview.ctcMonthly > 0 ? `${Math.round((preview.otherAllowances / preview.ctcMonthly) * 100)}%` : '0%'}
                          </td>
                        </tr>
                      )}
                      {/* Special Allowance */}
                      {preview.specialAllowance > 0 && (
                        <tr className="hover:bg-muted/10 transition-colors">
                          <td className="px-4 py-3 font-semibold text-left">Special Allowance</td>
                          <td className="px-4 py-3 text-right font-mono">{formatCurrency(preview.specialAllowance * 12)}</td>
                          <td className="px-4 py-3 text-right font-mono">{formatCurrency(preview.specialAllowance)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-primary">
                            {preview.ctcMonthly > 0 ? `${Math.round((preview.specialAllowance / preview.ctcMonthly) * 100)}%` : '0%'}
                          </td>
                        </tr>
                      )}
                      {/* LOP Deduction */}
                      {preview.lopDeduction > 0 && (
                        <tr className="hover:bg-muted/10 transition-colors text-destructive">
                          <td className="px-4 py-3 font-semibold text-left">Loss of Pay (LOP) Deduction</td>
                          <td className="px-4 py-3 text-right font-mono">-{formatCurrency(preview.lopDeduction * 12)}</td>
                          <td className="px-4 py-3 text-right font-mono">-{formatCurrency(preview.lopDeduction)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-destructive">
                            {preview.ctcMonthly > 0 ? `-${Math.round((preview.lopDeduction / preview.ctcMonthly) * 100)}%` : '0%'}
                          </td>
                        </tr>
                      )}
                      {/* Net Pay */}
                      <tr className="bg-primary/10 text-primary font-black border-t border-border">
                        <td className="px-4 py-3 text-left">Net Pay</td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(preview.netPay * 12)}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(preview.netPay)}</td>
                        <td className="px-4 py-3 text-right font-semibold"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-end pt-2 border-t border-border">
            <Button
              onClick={handleSubmit}
              disabled={!selectedEmployeeId}
              isLoading={saveMutation.isPending}
              className="bg-primary text-white font-bold tracking-wider shadow-lg shadow-primary/20 px-8 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4 mr-2" />
              Save &amp; Apply
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
