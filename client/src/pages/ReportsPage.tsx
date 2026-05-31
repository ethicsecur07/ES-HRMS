import React, { useState } from 'react';
import { TableSkeleton } from '../Components/WrapperComponents/Skeleton';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../api_service/reportsApi';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
import { exportToCSV, exportToExcel, exportToPDF } from '../utils/exportUtils';
import { BarChart3, Download, FileText, FileSpreadsheet } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

const TABS = ['Attendance', 'Payroll', 'Performance', 'Expenses', 'Leave', 'Projects'] as const;
type TabType = typeof TABS[number];

export const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('Attendance');

  const { data: attendanceData = [], isLoading: attLoading } = useQuery({ queryKey: ['reports', 'attendance'], queryFn: reportsApi.getAttendanceReport });
  const { data: payrollData = [], isLoading: payLoading } = useQuery({ queryKey: ['reports', 'payroll'], queryFn: reportsApi.getPayrollReport });
  const { data: performanceData = [], isLoading: perfLoading } = useQuery({ queryKey: ['reports', 'performance'], queryFn: reportsApi.getPerformanceReport });
  const { data: expenseData = [], isLoading: expLoading } = useQuery({ queryKey: ['reports', 'expenses'], queryFn: reportsApi.getExpenseReport });
  const { data: leaveData = [], isLoading: leaveLoading } = useQuery({ queryKey: ['reports', 'leave'], queryFn: reportsApi.getLeaveReport });
  const { data: projectData = [], isLoading: projLoading } = useQuery({ queryKey: ['reports', 'projects'], queryFn: reportsApi.getProjectReport });

  const isAnyLoading = attLoading || payLoading || perfLoading || expLoading || leaveLoading || projLoading;

  if (isAnyLoading) {
    return <TableSkeleton />;
  }

  const getActiveData = () => {
    switch (activeTab) {
      case 'Attendance': return attendanceData;
      case 'Payroll': return payrollData;
      case 'Performance': return performanceData;
      case 'Expenses': return expenseData;
      case 'Leave': return leaveData;
      case 'Projects': return projectData;
    }
  };

  const handleExport = (format: 'PDF' | 'CSV' | 'EXCEL') => {
    const data = getActiveData();
    const filename = `${activeTab}_Report_${new Date().toISOString().split('T')[0]}`;
    if (format === 'PDF') {
      exportToPDF('report-table', filename);
    } else if (format === 'CSV') {
      exportToCSV(data, filename);
    } else {
      exportToExcel(data, filename);
    }
  };

  const renderTable = () => {
    const data = getActiveData();
    if (!data || data.length === 0) return <div className="p-8 text-center text-muted-foreground">No data available for {activeTab}.</div>;

    const keys = Object.keys(data[0]).filter(k => k !== '_id' && typeof data[0][k] !== 'object');
    
    return (
      <div className="overflow-x-auto" id="report-table">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted text-muted-foreground text-xs uppercase tracking-wider">
              {activeTab === 'Attendance' || activeTab === 'Payroll' || activeTab === 'Projects' ? <th className="p-4 font-bold border-b border-border">ID / Period</th> : null}
              {keys.map(k => <th key={k} className="p-4 font-bold border-b border-border">{k.replace(/([A-Z])/g, ' $1')}</th>)}
            </tr>
          </thead>
          <tbody className="text-sm">
            {data.map((row: any, i: number) => (
              <tr key={i} className="border-b border-border hover:bg-muted/30 transition-colors">
                {activeTab === 'Attendance' || activeTab === 'Payroll' || activeTab === 'Projects' ? <td className="p-4 font-medium">{row._id}</td> : null}
                {keys.map(k => (
                  <td key={k} className="p-4">
                    {typeof row[k] === 'number' && (k.toLowerCase().includes('gross') || k.toLowerCase().includes('net') || k.toLowerCase().includes('amount') || k.toLowerCase().includes('budget'))
                      ? formatCurrency(row[k])
                      : row[k]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Company Reports
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Generate and export aggregated analytics and audits across all domains.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => handleExport('CSV')} className="flex items-center gap-2">
            <FileText className="w-4 h-4" /> CSV
          </Button>
          <Button variant="outline" onClick={() => handleExport('EXCEL')} className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </Button>
          <Button onClick={() => handleExport('PDF')} className="flex items-center gap-2 bg-primary text-primary-foreground">
            <Download className="w-4 h-4" /> PDF Export
          </Button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-border">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-bold tracking-wide whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden bg-card">
        {renderTable()}
      </Card>
    </div>
  );
};
