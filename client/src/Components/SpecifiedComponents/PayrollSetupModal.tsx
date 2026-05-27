import React, { useState, useMemo, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../WrapperComponents/Modal';
import { Button } from '../WrapperComponents/Button';
import { Input } from '../WrapperComponents/Input';
import { payrollConfigApi } from '../../api_service/payrollConfigApi';
import { employeeApi } from '../../api_service/employeeApi';
import { useNotificationStore } from '../../store/useNotificationStore';
import { formatCurrency } from '../../utils/formatters';
import type { PayrollConfig } from '../../types';
import { Save, Info, Users } from 'lucide-react';

interface PayrollSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SAMPLE_CTC_ANNUAL = 720000; // ₹7,20,000 annual = ₹60,000/month

export const PayrollSetupModal: React.FC<PayrollSetupModalProps> = ({ isOpen, onClose }) => {
  const { addToast } = useNotificationStore();
  const queryClient = useQueryClient();

  // Employee Selection State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  
  // Local state for the preview/editable salary (Monthly CTC)
  const [currentSalary, setCurrentSalary] = useState<number>(60000);

  // Fetch all active employees for dropdown (setting high limit to bypass default pagination)
  const { data: employees } = useQuery({
    queryKey: ['employees', 'all-active-for-payroll-setup'],
    queryFn: () => employeeApi.getAll({ limit: 1000, isActive: true }).then(res => res.employees),
    enabled: isOpen,
  });

  // Form state
  const [formData, setFormData] = useState<PayrollConfig>({
    basicSalaryPercent: 40,
    hraPercent: 40,
    conveyanceMonthly: 1600,
    performanceIncentiveMonthly: 0,
    otherAllowancesMonthly: 0,
    pfEmployeePercent: 12,
    professionalTaxMonthly: 200,
    incomeTaxTdsMonthly: 0,
    pfEmployerPercent: 12,
    gratuityPercent: 4.81,
    esiEmployerPercent: 3.25,
    insuranceMonthly: 0,
    applyEsiOnlyIfGrossBelow21000: true,
  });

  // Fetch existing config (automatically refetches when selectedEmployeeId changes)
  const { data: existingConfig, isLoading } = useQuery({
    queryKey: ['payrollConfig', selectedEmployeeId],
    queryFn: () => payrollConfigApi.get(selectedEmployeeId),
    enabled: isOpen,
  });

  // Find selected employee object
  const targetEmployee = useMemo(() => {
    if (!selectedEmployeeId || !employees) return null;
    return employees.find((e: any) => e._id === selectedEmployeeId);
  }, [selectedEmployeeId, employees]);

  // Sync currentSalary state when employee changes
  useEffect(() => {
    if (selectedEmployeeId === null) {
      setCurrentSalary(60000);
    } else if (targetEmployee) {
      setCurrentSalary(targetEmployee.salary || 0);
    }
  }, [selectedEmployeeId, targetEmployee]);

  const handleSalaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value) || 0;
    setCurrentSalary(val);
  };

  useEffect(() => {
    if (existingConfig) {
      setFormData({
        employeeId: existingConfig.employeeId || null,
        basicSalaryPercent: existingConfig.basicSalaryPercent,
        hraPercent: existingConfig.hraPercent,
        conveyanceMonthly: existingConfig.conveyanceMonthly,
        performanceIncentiveMonthly: existingConfig.performanceIncentiveMonthly,
        otherAllowancesMonthly: existingConfig.otherAllowancesMonthly,
        pfEmployeePercent: existingConfig.pfEmployeePercent,
        professionalTaxMonthly: existingConfig.professionalTaxMonthly,
        incomeTaxTdsMonthly: existingConfig.incomeTaxTdsMonthly,
        pfEmployerPercent: existingConfig.pfEmployerPercent,
        gratuityPercent: existingConfig.gratuityPercent,
        esiEmployerPercent: existingConfig.esiEmployerPercent,
        insuranceMonthly: existingConfig.insuranceMonthly,
        applyEsiOnlyIfGrossBelow21000: existingConfig.applyEsiOnlyIfGrossBelow21000,
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
    if (field.endsWith('Percent') && val > 100) {
      val = 100;
    }
    handleChange(field, val);
  };

  // Live preview calculations
  const preview = useMemo(() => {
    const ctcMonthly = currentSalary;
    const ctcAnnual = ctcMonthly * 12;
    const basic = Math.round(ctcMonthly * formData.basicSalaryPercent / 100);
    const hra = Math.round(basic * formData.hraPercent / 100);
    const conveyance = formData.conveyanceMonthly;
    const performance = formData.performanceIncentiveMonthly;
    const otherAllowances = formData.otherAllowancesMonthly;

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
    const totalDeductions = pfEmployee + professionalTax + tds;

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
      pfEmployer,
      gratuity,
      esiEmployer,
      insurance,
    };
  }, [formData, currentSalary]);

  const handleSubmit = async () => {
    try {
      // 1. If an employee is selected, update their salary in the database first
      if (selectedEmployeeId) {
        await employeeApi.update(selectedEmployeeId, { salary: currentSalary });
        // Invalidate employees query so the new salary is reflected in the list/cache
        queryClient.invalidateQueries({ queryKey: ['employees'] });
      }

      // 2. Save the payroll config
      saveMutation.mutate({
        ...formData,
        employeeId: selectedEmployeeId,
      });
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
                <h4 className="text-sm font-bold text-foreground">Select Target Configuration</h4>
                <p className="text-xs text-muted-foreground">
                  Choose whether to edit the organization-wide defaults or customize the structure for a specific employee.
                </p>
              </div>
            </div>
            <div className="w-full sm:w-80">
              <select
                value={selectedEmployeeId || ''}
                onChange={(e) => setSelectedEmployeeId(e.target.value || null)}
                className="w-full h-10 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors"
              >
                <option value="">Default (Organization-wide)</option>
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
                    {selectedEmployeeId ? 'Monthly Salary / CTC (INR) *' : 'Sample preview CTC / Month (INR)'}
                  </label>
                  <input
                    type="number"
                    value={currentSalary || ''}
                    onChange={handleSalaryChange}
                    className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-primary transition-colors text-left"
                    placeholder="Enter Monthly CTC / Salary"
                    min={0}
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5 text-left">
                    {selectedEmployeeId 
                      ? 'Updating this value will save the new monthly salary for this employee upon save.'
                      : 'Temporary sample value used for the preview panel on the right.'}
                  </p>
                </div>
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
                    <p className="text-[10px] text-primary mt-0.5">Allowed: 35-50</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-primary mb-1 text-left">HRA (% of Basic)</label>
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
                    <p className="text-[10px] text-primary mt-0.5">Allowed: 40-50</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-primary mb-1 text-left">Conveyance (Monthly)</label>
                    <input
                      type="number"
                      value={formData.conveyanceMonthly}
                      onChange={handleNumberChange('conveyanceMonthly')}
                      className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                      min={0} step={100}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-primary mb-1 text-left">Performance Incentive (Monthly)</label>
                    <input
                      type="number"
                      value={formData.performanceIncentiveMonthly}
                      onChange={handleNumberChange('performanceIncentiveMonthly')}
                      className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                      min={0} step={100}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-primary mb-1 text-left">Other Allowances (Monthly)</label>
                    <input
                      type="number"
                      value={formData.otherAllowancesMonthly}
                      onChange={handleNumberChange('otherAllowancesMonthly')}
                      className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                      min={0} step={100}
                    />
                  </div>
                </div>
              </div>

              {/* Employer Contributions */}
              <div className="rounded-xl border border-border p-5 space-y-4 bg-card">
                <h4 className="text-sm font-bold text-foreground tracking-tight border-b border-border pb-2">
                  Employer Contributions
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-primary mb-1 text-left">PF Employer (% of Basic)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={formData.pfEmployerPercent}
                        onChange={handleNumberChange('pfEmployerPercent')}
                        className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                        min={0} max={100} step={0.01}
                      />
                      <span className="text-sm text-muted-foreground font-medium">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-primary mb-1 text-left">Gratuity (% of Basic)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={formData.gratuityPercent}
                        onChange={handleNumberChange('gratuityPercent')}
                        className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                        min={0} max={100} step={0.01}
                      />
                      <span className="text-sm text-muted-foreground font-medium">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-primary mb-1 text-left">ESI Employer (% of Gross)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={formData.esiEmployerPercent}
                        onChange={handleNumberChange('esiEmployerPercent')}
                        className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                        min={0} max={100} step={0.01}
                      />
                      <span className="text-sm text-muted-foreground font-medium">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-primary mb-1 text-left">Insurance (Monthly)</label>
                    <input
                      type="number"
                      value={formData.insuranceMonthly}
                      onChange={handleNumberChange('insuranceMonthly')}
                      className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                      min={0} step={100}
                    />
                  </div>
                </div>

                {/* ESI Toggle */}
                <div className="flex items-center gap-3 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => handleChange('applyEsiOnlyIfGrossBelow21000', !formData.applyEsiOnlyIfGrossBelow21000)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.applyEsiOnlyIfGrossBelow21000 ? 'bg-primary' : 'bg-muted-foreground/30'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                        formData.applyEsiOnlyIfGrossBelow21000 ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className="text-xs font-medium text-foreground flex items-center gap-1">
                    Apply ESI only if Gross &lt; 21,000
                    <Info className="w-3.5 h-3.5 text-muted-foreground" />
                  </span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN — Deductions + Preview */}
            <div className="space-y-6">
              {/* Deductions */}
              <div className="rounded-xl border border-border p-5 space-y-4 bg-card">
                <h4 className="text-sm font-bold text-foreground tracking-tight border-b border-border pb-2">
                  Deductions
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-primary mb-1 text-left">PF Employee (% of Basic)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={formData.pfEmployeePercent}
                        onChange={handleNumberChange('pfEmployeePercent')}
                        className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                        min={0} max={100} step={0.01}
                      />
                      <span className="text-sm text-muted-foreground font-medium">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-primary mb-1 text-left">Professional Tax (Monthly)</label>
                    <input
                      type="number"
                      value={formData.professionalTaxMonthly}
                      onChange={handleNumberChange('professionalTaxMonthly')}
                      className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                      min={0} step={50}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-primary mb-1 text-left">Income Tax (TDS) (Monthly)</label>
                    <input
                      type="number"
                      value={formData.incomeTaxTdsMonthly}
                      onChange={handleNumberChange('incomeTaxTdsMonthly')}
                      className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                      min={0} step={100}
                    />
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="rounded-xl border border-primary/30 p-5 space-y-4 bg-primary/5">
                <div>
                  <h4 className="text-sm font-bold text-foreground tracking-tight">
                    {targetEmployee 
                      ? `Preview for ${targetEmployee.fullName}`
                      : 'Preview (applied to a sample CTC)'}
                  </h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {targetEmployee 
                      ? `This is a live preview using their base salary of ${formatCurrency(targetEmployee.salary)}/month (${formatCurrency(targetEmployee.salary * 12)} annual CTC).`
                      : `This is a quick preview using a sample annual CTC of ${formatCurrency(SAMPLE_CTC_ANNUAL)}.`}
                  </p>
                </div>

                {/* Preview Grid */}
                <div className="space-y-2 text-xs">
                  {/* Earnings */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-foreground font-medium">CTC / Month</span>
                      <span className="font-semibold">{formatCurrency(preview.ctcMonthly)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground font-medium">Gross / Month</span>
                      <span className="font-semibold">{formatCurrency(preview.grossPay)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground font-medium">Basic</span>
                      <span className="font-semibold">{formatCurrency(preview.basic)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground font-medium">HRA</span>
                      <span className="font-semibold">{formatCurrency(preview.hra)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground font-medium">Conveyance</span>
                      <span className="font-semibold">{formatCurrency(preview.conveyance)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground font-medium">Performance</span>
                      <span className="font-semibold">{formatCurrency(preview.performance)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground font-medium">Other Allowance</span>
                      <span className="font-semibold">{formatCurrency(preview.otherAllowances)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground font-medium">Special Allowance</span>
                      <span className="font-semibold">{formatCurrency(preview.specialAllowance)}</span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-border my-2" />

                  {/* Deductions */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-foreground font-medium">PF (Employee)</span>
                      <span className="font-semibold text-destructive">-{formatCurrency(preview.pfEmployee)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground font-medium">Professional Tax</span>
                      <span className="font-semibold text-destructive">-{formatCurrency(preview.professionalTax)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground font-medium">TDS</span>
                      <span className="font-semibold text-destructive">-{formatCurrency(preview.tds)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-primary font-bold">Net Pay</span>
                      <span className="font-bold text-primary">{formatCurrency(preview.netPay)}</span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-border my-2" />

                  {/* Employer Contributions */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-foreground font-medium">PF (Employer)</span>
                      <span className="font-semibold text-orange-500">{formatCurrency(preview.pfEmployer)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground font-medium">Gratuity</span>
                      <span className="font-semibold text-orange-500">{formatCurrency(preview.gratuity)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground font-medium">ESI (Employer)</span>
                      <span className="font-semibold text-orange-500">{formatCurrency(preview.esiEmployer)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground font-medium">Insurance</span>
                      <span className="font-semibold text-orange-500">{formatCurrency(preview.insurance)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-2 border-t border-border">
            <Button
              onClick={handleSubmit}
              isLoading={saveMutation.isPending}
              className="bg-primary text-white font-bold tracking-wider shadow-lg shadow-primary/20 px-8"
            >
              <Save className="w-4 h-4 mr-2" />
              Save & Apply
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
