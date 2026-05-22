import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { payrollApi } from '../api_service/payrollApi';
import { payrollV2Api } from '../api_service/payrollV2Api';
import type { PayrollRun } from '../api_service/payrollV2Api';
import { employeeApi } from '../api_service/employeeApi';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
import { Input, Select } from '../Components/WrapperComponents/Input';
import { TableWrapper } from '../Components/WrapperComponents/TableWrapper';
import { PayrollSlipModal } from '../Components/SpecifiedComponents/PayrollSlipModal';
import type { Payroll, Employee } from '../types';
import { formatCurrency } from '../utils/formatters';
import {
  CreditCard,
  Eye,
  CheckCircle2,
  RefreshCw,
  Settings2,
  RotateCcw,
  FileJson,
  Coins,
  TrendingUp,
  Loader2
} from 'lucide-react';

export const PayrollPage: React.FC = () => {
  const { role } = useAuthStore();
  const { addToast } = useNotificationStore();
  const queryClient = useQueryClient();

  // Tab State
  const [activeTab, setActiveTab] = useState<'statements' | 'processing'>('statements');

  // Statements view states
  const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [nameFilter, setNameFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');

  // Processing view states
  const [runCycleInput, setRunCycleInput] = useState('');
  const [syncPeriodInput, setSyncPeriodInput] = useState('');
  const [erpPlatform, setErpPlatform] = useState<'XERO' | 'QUICKBOOKS' | 'SAGE'>('XERO');

  // Queries
  const { data: payrolls, isLoading: payLoading } = useQuery({
    queryKey: ['payrolls'],
    queryFn: payrollApi.getAll,
  });

  const { data: employees, isLoading: empLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeeApi.getAll().then(res => res.employees),
  });

  const { data: payrollRuns, isLoading: runsLoading, refetch: refetchRuns } = useQuery({
    queryKey: ['payrollRuns'],
    queryFn: payrollV2Api.getRuns,
    enabled: (role === 'ADMIN' || role === 'HR') && activeTab === 'processing',
  });

  // Filters
  const filteredPayrolls = useMemo(() => {
    if (!payrolls) return [];
    return payrolls.filter((item) => {
      const empId = item.employeeId ? (typeof item.employeeId === 'object' ? item.employeeId._id : item.employeeId) : '';
      const emp = employees?.find((e) => e._id === empId);
      const empName = emp?.fullName || 'Logapriyan M';

      const matchName = empName.toLowerCase().includes(nameFilter.toLowerCase());
      const matchMonth = !monthFilter || item.month.includes(monthFilter);

      return matchName && matchMonth;
    });
  }, [payrolls, employees, nameFilter, monthFilter]);

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Payroll['paidStatus'] }) =>
      payrollApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrolls'] });
      addToast('Status Updated', 'Payroll disbursement status updated.', 'success');
    },
  });

  const triggerRunMutation = useMutation({
    mutationFn: payrollV2Api.triggerRun,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payrolls'] });
      refetchRuns();
      addToast('Run Triggered', `Bulk processing started for ${data.run.runCycle}.`, 'success');
      setRunCycleInput('');
    },
    onError: (error: any) => {
      addToast('Pipeline Failed', error.message || 'Could not launch bulk run.', 'error');
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: payrollV2Api.rollbackRun,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payrolls'] });
      refetchRuns();
      addToast('Run Rolled Back', `Successfully rolled back calculations for ${data.run.runCycle}.`, 'warning');
    },
    onError: (error: any) => {
      addToast('Rollback Failed', error.message || 'Could not revert payroll run.', 'error');
    },
  });

  const exportErpMutation = useMutation({
    mutationFn: async () => payrollV2Api.exportJournal(syncPeriodInput, erpPlatform),
    onSuccess: (res) => {
      addToast('ERP Export Completed', `Double entry ledger synced via ${erpPlatform}.`, 'success');
      // Create a blob file of the export data and download it
      const element = document.createElement('a');
      const file = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      element.href = URL.createObjectURL(file);
      element.download = `ES-HRMS-ERP-Journal-${syncPeriodInput}-${erpPlatform}.json`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    },
    onError: (error: any) => {
      addToast('ERP Export Failed', error.message || 'Make sure at least one payroll is in PAID status for this period.', 'error');
    },
  });

  const handleViewPayslip = (payroll: Payroll) => {
    const emp = employees?.find((e) => e._id === (payroll.employeeId ? (typeof payroll.employeeId === 'object' ? payroll.employeeId._id : payroll.employeeId) : ''));
    if (emp) {
      setSelectedPayroll(payroll);
      setSelectedEmp(emp);
      setShowModal(true);
    }
  };

  const handleTriggerRunSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!runCycleInput) return;
    triggerRunMutation.mutate(runCycleInput);
  };

  const handleErpSyncSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!syncPeriodInput) return;
    exportErpMutation.mutate();
  };

  // Columns for Payroll Statements Table
  const statementColumns = [
    {
      header: 'Employee',
      accessor: (row: Payroll) => {
        const emp = employees?.find((e) => e._id === (row.employeeId ? (typeof row.employeeId === 'object' ? row.employeeId._id : row.employeeId) : ''));
        return (
          <div className="flex items-center gap-2 text-left">
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

  // Columns for Payroll Run Logs Table
  const runColumns = [
    {
      header: 'Run Cycle Period',
      accessor: (row: PayrollRun) => <span className="font-mono font-bold text-xs text-foreground">{row.runCycle}</span>,
    },
    {
      header: 'Created At',
      accessor: (row: PayrollRun) => <span className="font-mono text-xs">{new Date(row.createdAt).toLocaleDateString()}</span>,
    },
    {
      header: 'Status',
      accessor: (row: PayrollRun) => {
        if (row.status === 'COMPLETED') {
          return (
            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
              Completed
            </span>
          );
        }
        if (row.status === 'PROCESSING') {
          return (
            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-foreground/10 text-foreground border border-border animate-pulse">
              Processing
            </span>
          );
        }
        if (row.status === 'FAILED') {
          return (
            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-destructive/10 text-destructive border border-destructive/20" title={row.errorLog}>
              Failed
            </span>
          );
        }
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-muted text-muted-foreground border border-border">
            Pending
          </span>
        );
      },
    },
    {
      header: 'Processed Staff',
      accessor: (row: PayrollRun) => <span className="font-mono text-xs">{row.processedEmployeesCount} Employees</span>,
    },
    {
      header: 'Total Payroll Payout',
      accessor: (row: PayrollRun) => <span className="font-mono font-bold text-xs text-primary">{formatCurrency(row.totalPayout)}</span>,
    },
    {
      header: 'Actions',
      accessor: (row: PayrollRun) => (
        <div className="flex justify-end">
          {(row.status === 'COMPLETED' || row.status === 'FAILED') && (
            <Button
              size="sm"
              variant="outline"
              className="border-destructive/30 hover:bg-destructive/10 text-destructive font-semibold"
              onClick={() => {
                if (window.confirm(`Are you absolutely sure you want to rollback all calculated payroll items for period ${row.runCycle}?`)) {
                  rollbackMutation.mutate(row.runCycle);
                }
              }}
              isLoading={rollbackMutation.isPending && rollbackMutation.variables === row.runCycle}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Rollback
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
      {/* Header Banner */}
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
      </div>

      {/* Tabs navigation for HR / Admin */}
      {(role === 'ADMIN' || role === 'HR') && (
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('statements')}
            className={`px-6 py-3 font-bold text-xs uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'statements'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Coins className="w-4 h-4" /> Employee Compensations
          </button>
          <button
            onClick={() => setActiveTab('processing')}
            className={`px-6 py-3 font-bold text-xs uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'processing'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Settings2 className="w-4 h-4" /> Bulk Processing & ERP Sync
          </button>
        </div>
      )}

      {activeTab === 'statements' ? (
        /* STATEMENTS VIEW */
        <Card className="border-l-4 border-l-primary shadow-md p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-muted/30 p-4 rounded-xl border border-border">
            <div className="flex-1 w-full">
              <Input
                placeholder="Search payroll by employee name..."
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-64">
              <Input
                type="month"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
              />
            </div>
          </div>

          <TableWrapper
            columns={statementColumns}
            data={filteredPayrolls}
          />
        </Card>
      ) : (
        /* BULK RUNS & ERP PROCESSING VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Controls Panel */}
          <div className="space-y-8">
            {/* Trigger Form */}
            <Card className="p-6 border-l-4 border-l-primary shadow-lg bg-card space-y-6">
              <h3 className="text-lg font-black text-foreground flex items-center gap-2 border-b border-border pb-3 tracking-tight">
                <TrendingUp className="w-5 h-5 text-primary" /> Trigger Bulk Run
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Initiate calculation algorithms across all active employee contract structures for a target month, computing base allowances, tax brackets, and attendance penalties.
              </p>

              <form onSubmit={handleTriggerRunSubmit} className="space-y-4">
                <Input
                  label="Target Run Cycle Period *"
                  type="month"
                  value={runCycleInput}
                  onChange={(e) => setRunCycleInput(e.target.value)}
                  required
                />
                <Button
                  type="submit"
                  className="w-full bg-primary text-white font-black tracking-wider text-xs"
                  isLoading={triggerRunMutation.isPending}
                >
                  TRIGGER RUN CYCLE
                </Button>
              </form>
            </Card>

            {/* ERP Synchronization */}
            <Card className="p-6 border border-border shadow-md bg-card space-y-6">
              <h3 className="text-lg font-black text-foreground flex items-center gap-2 border-b border-border pb-3 tracking-tight">
                <FileJson className="w-5 h-5 text-primary" /> ERP Ledger Sync
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Export double-entry accounts payable journal ledgers for payroll expenses, grouping credit liability and debit expense components.
              </p>

              <form onSubmit={handleErpSyncSubmit} className="space-y-4">
                <Input
                  label="Target Month Period *"
                  type="month"
                  value={syncPeriodInput}
                  onChange={(e) => setSyncPeriodInput(e.target.value)}
                  required
                />
                <Select
                  label="Target Platform *"
                  value={erpPlatform}
                  onChange={(e) => setErpPlatform(e.target.value as any)}
                  options={[
                    { value: 'XERO', label: 'Xero Accounts' },
                    { value: 'QUICKBOOKS', label: 'QuickBooks Online' },
                    { value: 'SAGE', label: 'Sage Financials' },
                  ]}
                />
                <Button
                  type="submit"
                  className="w-full bg-foreground text-background font-black tracking-wider text-xs shadow-md"
                  isLoading={exportErpMutation.isPending}
                >
                  SYNC & DOWNLOAD JOURNAL
                </Button>
              </form>
            </Card>
          </div>

          {/* Runs Monitor Table */}
          <div className="lg:col-span-2 space-y-8">
            <Card className="p-6 border border-border shadow-md space-y-4 text-left">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-lg font-black text-foreground flex items-center gap-2 tracking-tight">
                  <RefreshCw className="w-5 h-5 text-primary" /> Active Pipeline Logs
                </h3>
                <button
                  onClick={() => refetchRuns()}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1"
                  title="Refresh status logs"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {runsLoading ? (
                <div className="h-60 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              ) : (
                <TableWrapper
                  columns={runColumns}
                  data={payrollRuns || []}
                  rowsPerPage={6}
                />
              )}
            </Card>
          </div>
        </div>
      )}

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
