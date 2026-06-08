import React, { useState, useMemo } from 'react';
import { TableSkeleton } from '../Components/WrapperComponents/Skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { payrollApi } from '../api_service/payrollApi';
import { employeeApi } from '../api_service/employeeApi';
import { analyticsApi } from '../api_service/analyticsApi';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
import { PayrollSlipModal } from '../Components/SpecifiedComponents/PayrollSlipModal';
import { PayrollSetupModal } from '../Components/SpecifiedComponents/PayrollSetupModal';
import type { Payroll, Employee } from '../types';
import { formatCurrency } from '../utils/formatters';
import { exportToExcel } from '../utils/exportUtils';
import {
  CreditCard,
  Eye,
  CheckCircle2,
  Settings2,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CalendarRange,
} from 'lucide-react';
import { formatDate } from '../utils/formatters';

/** Compute current cycle start/end YYYY-MM-DD from the salaryCycleStartDay setting. */
function getCurrentCycleDates(startDay: number): { startStr: string; endStr: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  if (startDay <= 1) {
    const lastDay = new Date(year, month, 0).getDate();
    return {
      startStr: `${year}-${String(month).padStart(2, '0')}-01`,
      endStr:   `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  let csY: number, csM: number, ceY: number, ceM: number, ceD: number;
  if (day >= startDay) {
    csY = year; csM = month;
    const nd = new Date(year, month, 1);
    ceY = nd.getFullYear(); ceM = nd.getMonth() + 1; ceD = startDay - 1;
  } else {
    const pd = new Date(year, month - 2, 1);
    csY = pd.getFullYear(); csM = pd.getMonth() + 1;
    ceY = year; ceM = month; ceD = startDay - 1;
  }
  const mxS = new Date(csY, csM, 0).getDate();
  const mxE = new Date(ceY, ceM, 0).getDate();
  return {
    startStr: `${csY}-${String(csM).padStart(2, '0')}-${String(Math.min(startDay, mxS)).padStart(2, '0')}`,
    endStr:   `${ceY}-${String(ceM).padStart(2, '0')}-${String(Math.min(ceD, mxE)).padStart(2, '0')}`,
  };
}

const MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => ({
  value: String(currentYear - 2 + i),
  label: String(currentYear - 2 + i),
}));

export const PayrollPage: React.FC = () => {
  const { role } = useAuthStore();
  const { addToast } = useNotificationStore();
  const queryClient = useQueryClient();

  // Statements view states
  const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [nameFilter, setNameFilter] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [selectedYear, setSelectedYear] = useState(String(currentYear));

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Queries
  const { data: payrolls, isLoading: payLoading, isError: payError } = useQuery({
    queryKey: ['payrolls'],
    queryFn: payrollApi.getAll,
  });

  const { data: employees, isLoading: empLoading } = useQuery({
    queryKey: ['employees', { limit: 1000 }],
    queryFn: () => employeeApi.getAll({ limit: 1000 }).then(res => res.employees),
  });

  // Fetch org settings to read salaryCycleStartDay
  const { data: orgSettings } = useQuery({
    queryKey: ['companySettings'],
    queryFn: analyticsApi.getSettings,
    staleTime: 5 * 60 * 1000,
  });

  const cycleDates = useMemo(() => {
    const startDay = orgSettings?.salaryCycleStartDay ?? 1;
    return getCurrentCycleDates(startDay);
  }, [orgSettings]);

  // Filters
  const filteredPayrolls = useMemo(() => {
    if (!payrolls) return [];
    return payrolls.filter((item) => {
      const empId = item.employeeId ? (typeof item.employeeId === 'object' ? item.employeeId._id : item.employeeId) : '';
      const emp = employees?.find((e) => e._id === empId);
      if (!emp) return false;
      const empName = emp.fullName;

      const matchName = !nameFilter || empName.toLowerCase().includes(nameFilter.toLowerCase());
      const monthStr = `${selectedYear}-${selectedMonth}`;
      const matchMonth = item.month === monthStr;

      return matchName && matchMonth;
    });
  }, [payrolls, employees, nameFilter, selectedMonth, selectedYear]);

  // Pagination
  const totalRecords = filteredPayrolls.length;
  const totalPages = Math.ceil(totalRecords / rowsPerPage) || 1;
  const paginatedPayrolls = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredPayrolls.slice(start, start + rowsPerPage);
  }, [filteredPayrolls, currentPage, rowsPerPage]);

  // Reset page on filter change
  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  // Mutations
  const generatePayrollMutation = useMutation({
    mutationFn: () => payrollApi.generateMonthlyPayroll(`${selectedYear}-${selectedMonth}`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payrolls'] });
      addToast('Payroll Generated', `Successfully generated payroll for ${data.length} employees.`, 'success');
    },
    onError: (error: any) => {
      addToast('Generation Failed', error?.response?.data?.message || error.message || 'Could not generate payroll.', 'error');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Payroll['paidStatus'] }) =>
      payrollApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrolls'] });
      addToast('Status Updated', 'Payroll disbursement status updated.', 'success');
    },
    onError: (error: any) => {
      addToast(
        'Update Failed',
        error?.response?.data?.message || error.message || 'Could not update payroll status.',
        'error'
      );
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

  const handleExport = () => {
    if (!filteredPayrolls.length) {
      addToast('No Data', 'No payroll records to export.', 'warning');
      return;
    }
    const exportData = filteredPayrolls.map((p) => {
      const empId = p.employeeId ? (typeof p.employeeId === 'object' ? p.employeeId._id : p.employeeId) : '';
      const emp = employees?.find((e) => e._id === empId);
      return {
        'Employee Name': emp?.fullName || 'N/A',
        'CTC (Annual)': p.ctcAnnual || 0,
        'Gross Pay': p.grossPay || 0,
        'Deductions': p.deductions || 0,
        'Net Pay': p.finalSalary || 0,
        'Status': p.paidStatus,
        'Period': p.month,
      };
    });
    exportToExcel(exportData, `Payroll_${selectedYear}-${selectedMonth}`);
    addToast('Exported', 'Payroll data exported to Excel.', 'success');
  };

  if (payLoading || empLoading) {
    return <TableSkeleton />;
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
          {/* Cycle period badge — synced with salary/attendance cycle */}
          <div className="flex items-center gap-1.5 mt-2">
            <CalendarRange className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary">
              Current Cycle:&nbsp;
            </span>
            <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
              {formatDate(cycleDates.startStr)} – {formatDate(cycleDates.endStr)}
            </span>
            {orgSettings?.salaryCycleStartDay && orgSettings.salaryCycleStartDay > 1 && (
              <span className="text-[10px] text-muted-foreground">
                (starts {orgSettings.salaryCycleStartDay}{['st','nd','rd'][((orgSettings.salaryCycleStartDay % 10) - 1)] || 'th'} of each month)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Employee Compensations View */}
     
        <Card className="border-l-4 border-l-primary shadow-md p-6 space-y-5">
          {/* Filter / Action Bar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Search"
                value={nameFilter}
                onChange={(e) => { setNameFilter(e.target.value); handleFilterChange(); }}
                className="flex h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
              />
            </div>

            {/* Month Dropdown */}
            <select
              value={selectedMonth}
              onChange={(e) => { setSelectedMonth(e.target.value); handleFilterChange(); }}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors cursor-pointer"
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>

            {/* Year Dropdown */}
            <select
              value={selectedYear}
              onChange={(e) => { setSelectedYear(e.target.value); handleFilterChange(); }}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors cursor-pointer"
            >
              {YEARS.map((y) => (
                <option key={y.value} value={y.value}>{y.label}</option>
              ))}
            </select>

            {/* Generate Payroll Button (ADMIN/HR only) */}
            {(role === 'ADMIN' || role === 'HR') && (
              <Button
                onClick={() => generatePayrollMutation.mutate()}
                isLoading={generatePayrollMutation.isPending}
                className="bg-primary text-white font-bold tracking-wider shadow-md shadow-primary/20"
              >
                Generate Payroll
              </Button>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Payroll Setup Button (ADMIN/HR only) */}
            {(role === 'ADMIN' || role === 'HR') && (
              <Button
                variant="outline"
                onClick={() => setShowSetupModal(true)}
                className="font-semibold"
              >
                <Settings2 className="w-4 h-4 mr-1.5" />
                Payroll Setup
              </Button>
            )}

            {/* Export Button */}
            <Button
              onClick={handleExport}
              className="bg-primary text-white font-bold shadow-md shadow-primary/20"
            >
              <Download className="w-4 h-4 mr-1.5" />
              Export
            </Button>
          </div>

          {/* Error Banner */}
          {payError && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Failed to load payslip list.</span>
            </div>
          )}

          {/* Payroll Table */}
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                  <th className="p-4">Employee Name</th>
                  <th className="p-4">CTC (Annual)</th>
                  <th className="p-4">Gross Pay</th>
                  <th className="p-4">Deductions</th>
                  <th className="p-4">Net Pay</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {paginatedPayrolls.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No matching records found. Generate payroll to create slips.
                    </td>
                  </tr>
                ) : (
                  paginatedPayrolls.map((payroll) => {
                    const empId = payroll.employeeId ? (typeof payroll.employeeId === 'object' ? payroll.employeeId._id : payroll.employeeId) : '';
                    const emp = employees?.find((e) => e._id === empId);
                    return (
                      <tr key={payroll._id} className="hover:bg-muted/30 transition-colors">
                        {/* Employee Name */}
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-foreground">{emp?.fullName || 'Unknown'}</span>
                            {emp?.employeeCode && !emp.employeeCode.startsWith('TEMP-EMP-') && (
                              <span className="text-[10px] text-muted-foreground font-mono">({emp.employeeCode})</span>
                            )}
                          </div>
                        </td>
                        {/* CTC (Annual) */}
                        <td className="p-4">
                          <span className="font-mono text-xs">{formatCurrency(payroll.ctcAnnual || (emp?.salary ? emp.salary * 12 : 0))}</span>
                        </td>
                        {/* Gross Pay */}
                        <td className="p-4">
                          <span className="font-mono text-xs">{formatCurrency(payroll.grossPay || payroll.baseSalary)}</span>
                        </td>
                        {/* Deductions */}
                        <td className="p-4">
                          <span className="font-mono text-xs text-destructive">-{formatCurrency(payroll.deductions)}</span>
                        </td>
                        {/* Net Pay */}
                        <td className="p-4">
                          <span className="font-mono font-extrabold text-xs text-primary">{formatCurrency(payroll.finalSalary)}</span>
                        </td>
                        {/* Status */}
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${
                            payroll.paidStatus === 'PAID'
                              ? 'bg-primary/10 text-primary border-primary/20'
                              : payroll.paidStatus === 'PROCESSING'
                              ? 'bg-foreground/10 text-foreground border-border'
                              : 'bg-muted text-muted-foreground border-border'
                          }`}>
                            {payroll.paidStatus}
                          </span>
                        </td>
                        {/* Actions */}
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleViewPayslip(payroll)}>
                              <Eye className="w-4 h-4 mr-1" /> Payslip
                            </Button>
                            {(role === 'ADMIN' || role === 'HR') && payroll.paidStatus !== 'PAID' && (
                              <Button
                                size="sm"
                                onClick={() => updateStatusMutation.mutate({ id: payroll._id, status: 'PAID' })}
                                isLoading={updateStatusMutation.isPending}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1" /> Mark Paid
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Showing:</span>
              <select
                value={rowsPerPage}
                onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              >
                {[5, 10, 20, 50].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            <div className="text-xs">
              Showing <span className="font-medium">{totalRecords === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1}</span> to{' '}
              <span className="font-medium">{Math.min(currentPage * rowsPerPage, totalRecords)}</span> out of{' '}
              <span className="font-medium">{totalRecords}</span> records
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </Card>


      {/* Payslip Modal */}
      <PayrollSlipModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        payroll={selectedPayroll}
        employee={selectedEmp}
      />

      {/* Payroll Setup Modal */}
      <PayrollSetupModal
        isOpen={showSetupModal}
        onClose={() => setShowSetupModal(false)}
      />
    </div>
  );
};
