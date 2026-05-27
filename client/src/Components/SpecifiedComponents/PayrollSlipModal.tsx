import React from 'react';
import { Modal } from '../WrapperComponents/Modal';
import { Button } from '../WrapperComponents/Button';
import type { Payroll, Employee } from '../../types';
import { exportPayslipPDF } from '../../utils/exportUtils';
import { formatCurrency } from '../../utils/formatters';
import { Download, CheckCircle2, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../../api_service/analyticsApi';

interface PayrollSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  payroll: Payroll | null;
  employee: Employee | null;
}

export const PayrollSlipModal: React.FC<PayrollSlipModalProps> = ({
  isOpen,
  onClose,
  payroll,
  employee,
}) => {
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: analyticsApi.getSettings,
  });

  const startDay = settings?.payrollCycleStartDay || 1;

  const cyclePeriodStr = React.useMemo(() => {
    if (!payroll?.month) return 'N/A';
    const [year, month] = payroll.month.split('-');
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);

    if (startDay <= 1) {
      const lastDay = new Date(yearNum, monthNum, 0).getDate();
      return `01/${month}/${year} to ${lastDay < 10 ? '0' + lastDay : lastDay}/${month}/${year}`;
    } else {
      const prevDate = new Date(yearNum, monthNum - 2, 1);
      const prevYear = prevDate.getFullYear();
      const prevMonth = prevDate.getMonth() + 1;
      const prevMonthStr = prevMonth < 10 ? `0${prevMonth}` : `${prevMonth}`;
      const startDayStr = startDay < 10 ? `0${startDay}` : `${startDay}`;

      const endDayVal = startDay - 1;
      const endDayStr = endDayVal < 10 ? `0${endDayVal}` : `${endDayVal}`;
      return `${startDayStr}/${prevMonthStr}/${prevYear} to ${endDayStr}/${month}/${year}`;
    }
  }, [payroll?.month, startDay]);

  if (!payroll || !employee) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Salary Payslip Details" maxWidth="max-w-2xl">
      <div className="space-y-6 text-left">
        {/* Header Banner */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-primary to-accent text-white flex items-center justify-between shadow-lg shadow-primary/20">
          <div>
            <h3 className="text-2xl font-black tracking-wider">ETHICSEC</h3>
            <p className="text-xs text-primary-foreground/80 font-medium tracking-widest uppercase mt-0.5">
              Enterprise Payslip Document
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/20 backdrop-blur-md uppercase tracking-wider">
              {payroll.paidStatus}
            </span>
            <p className="text-sm font-bold mt-1.5">{payroll.month}</p>
          </div>
        </div>

        {/* Employee Info */}
        <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-muted/40 border border-border text-sm">
          <div>
            <span className="text-xs text-muted-foreground block font-medium">Employee Name</span>
            <span className="font-bold text-foreground">{employee.fullName}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block font-medium">Employee Code</span>
            <span className="font-bold text-foreground">
              {employee.employeeCode && !employee.employeeCode.startsWith('TEMP-EMP-') ? employee.employeeCode : ''}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block font-medium">Department</span>
            <span className="font-semibold text-foreground">{employee.department}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block font-medium">Designation</span>
            <span className="font-semibold text-foreground">{employee.designation}</span>
          </div>
          <div className="col-span-2 border-t border-border/40 pt-2.5 mt-0.5">
            <span className="text-xs text-muted-foreground block font-medium">Salary Cycle Period</span>
            <span className="font-bold text-primary font-mono">{cyclePeriodStr}</span>
          </div>
        </div>

        {/* Earnings & Deductions Table */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="bg-muted px-4 py-2.5 border-b border-border text-xs font-bold uppercase tracking-wider text-muted-foreground flex justify-between">
            <span>Salary Component</span>
            <span>Amount</span>
          </div>

          <div className="divide-y divide-border text-sm">
            <div className="px-4 py-3 flex justify-between items-center">
              <span className="font-medium text-foreground">Base Salary</span>
              <span className="font-semibold">{formatCurrency(payroll.baseSalary)}</span>
            </div>
            <div className="px-4 py-3 flex justify-between items-center">
              <span className="font-medium text-foreground">Bonus / Incentives</span>
              <span className="font-semibold text-primary">+{formatCurrency(payroll.bonus)}</span>
            </div>
            <div className="px-4 py-3 flex justify-between items-center">
              <span className="font-medium text-foreground">Deductions (Leaves / Advances)</span>
              <span className="font-semibold text-muted-foreground">-{formatCurrency(payroll.deductions)}</span>
            </div>
            <div className="px-4 py-4 bg-primary/5 flex justify-between items-center border-t-2 border-primary">
              <span className="font-bold text-base text-primary">Net Final Salary</span>
              <span className="font-extrabold text-lg text-primary">{formatCurrency(payroll.finalSalary)}</span>
            </div>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-3">
            {payroll.paidStatus === 'PAID' ? (
              <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0" />
            ) : (
              <Clock className="w-6 h-6 text-muted-foreground flex-shrink-0" />
            )}
            <div>
              <p className="text-sm font-bold text-foreground">
                {payroll.paidStatus === 'PAID' ? 'Salary Disbursed' : 'Payment Pending / Processing'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {payroll.paidStatus === 'PAID'
                  ? `Credited to salary account on ${payroll.paymentDate || payroll.month}`
                  : 'Will be credited as per company payroll cycle.'}
              </p>
            </div>
          </div>

          <Button
            onClick={() => exportPayslipPDF(payroll, employee.fullName, employee.employeeCode?.startsWith('TEMP-EMP-') ? '' : employee.employeeCode)}
            className="bg-primary text-white font-bold tracking-wider shadow-md shadow-primary/20"
          >
            <Download className="w-4 h-4 mr-2" />
            DOWNLOAD PDF
          </Button>
        </div>
      </div>
    </Modal>
  );
};
