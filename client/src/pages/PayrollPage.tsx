import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { payrollApi } from '../api_service/payrollApi';
import { employeeApi } from '../api_service/employeeApi';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
import { TableWrapper } from '../Components/WrapperComponents/TableWrapper';
import { PayrollSlipModal } from '../Components/SpecifiedComponents/PayrollSlipModal';
import type { Payroll, Employee } from '../types';
import { formatCurrency } from '../utils/formatters';
import { CreditCard, Eye, CheckCircle2, RefreshCw } from 'lucide-react';

export const PayrollPage: React.FC = () => {
  const { role } = useAuthStore();
  const { addToast } = useNotificationStore();
  const queryClient = useQueryClient();

  const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [showModal, setShowModal] = useState(false);

  const { data: payrolls, isLoading: payLoading } = useQuery({
    queryKey: ['payrolls'],
    queryFn: payrollApi.getAll,
  });

  const { data: employees, isLoading: empLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: employeeApi.getAll,
  });

  const generateMutation = useMutation({
    mutationFn: () => payrollApi.generateMonthlyPayroll('2026-05'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrolls'] });
      addToast('Payroll Generated', 'Monthly salary calculations updated successfully.', 'success');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Payroll['paidStatus'] }) =>
      payrollApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrolls'] });
      addToast('Status Updated', 'Payroll disbursement status updated.', 'success');
    },
  });

  const handleViewPayslip = (payroll: Payroll) => {
    const emp = employees?.find((e) => e._id === (typeof payroll.employeeId === 'object' ? payroll.employeeId._id : payroll.employeeId));
    if (emp) {
      setSelectedPayroll(payroll);
      setSelectedEmp(emp);
      setShowModal(true);
    }
  };

  const columns = [
    {
      header: 'Employee',
      accessor: (row: Payroll) => {
        const emp = employees?.find((e) => e._id === (typeof row.employeeId === 'object' ? row.employeeId._id : row.employeeId));
        return (
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-foreground">{emp?.fullName || 'Logapriyan M'}</span>
            <span className="text-[10px] text-muted-foreground font-mono">({emp?.employeeCode || 'DEV-001'})</span>
          </div>
        );
      },
    },
    { header: 'Pay Period', accessor: 'month', className: 'font-mono text-xs' },
    { header: 'Base Salary', accessor: (row: Payroll) => <span className="font-mono text-xs">{formatCurrency(row.baseSalary)}</span> },
    { header: 'Bonus / Incentives', accessor: (row: Payroll) => <span className="font-mono text-xs text-primary">+{formatCurrency(row.bonus)}</span> },
    { header: 'Deductions', accessor: (row: Payroll) => <span className="font-mono text-xs text-muted-foreground">-{formatCurrency(row.deductions)}</span> },
    { header: 'Net Final Salary', accessor: (row: Payroll) => <span className="font-mono font-extrabold text-xs text-primary">{formatCurrency(row.finalSalary)}</span> },
    {
      header: 'Status',
      accessor: (row: Payroll) => (
        <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${
          row.paidStatus === 'PAID'
            ? 'bg-primary/10 text-primary border-primary/20'
            : row.paidStatus === 'PROCESSING'
            ? 'bg-foreground/10 text-foreground border-border'
            : 'bg-muted text-muted-foreground border-border'
        }`}>
          {row.paidStatus}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: (row: Payroll) => (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => handleViewPayslip(row)}>
            <Eye className="w-4 h-4 mr-1" /> Payslip
          </Button>

          {(role === 'ADMIN' || role === 'HR') && row.paidStatus !== 'PAID' && (
            <Button
              size="sm"
              onClick={() => updateStatusMutation.mutate({ id: row._id, status: 'PAID' })}
              isLoading={updateStatusMutation.isPending}
            >
              <CheckCircle2 className="w-4 h-4 mr-1" /> Mark Paid
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (payLoading || empLoading) {
    return (
      <Card className="animate-pulse h-96 bg-muted/20">
        <div />
      </Card>
    );
  }

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-primary" />
            Payroll & Compensation Management
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Automated monthly salary calculation, bonus disbursements, deductions, and payslip generation
          </p>
        </div>

        {(role === 'ADMIN' || role === 'HR') && (
          <Button
            onClick={() => generateMutation.mutate()}
            isLoading={generateMutation.isPending}
            className="bg-primary text-white font-bold tracking-wider shadow-lg shadow-primary/20"
          >
            <RefreshCw className="w-4 h-4 mr-2 animate-spin-slow" />
            GENERATE MONTHLY PAYROLL
          </Button>
        )}
      </div>

      <Card className="border-l-4 border-l-primary shadow-md">
        <TableWrapper
          columns={columns}
          data={payrolls || []}
          searchKey="month"
          searchPlaceholder="Search payroll by month (e.g. 2026-05)..."
        />
      </Card>

      {/* Payslip Modal */}
      <PayrollSlipModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        payroll={selectedPayroll}
        employee={selectedEmp}
      />
    </div>
  );
};
