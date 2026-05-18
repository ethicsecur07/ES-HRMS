import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { attendanceApi } from '../api_service/attendanceApi';
import { taskApi } from '../api_service/taskApi';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
import { exportAttendanceExcel, exportProductivityExcel } from '../utils/exportUtils';
import { BarChart3, Download, FileSpreadsheet, CheckCircle2 } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { data: attendances } = useQuery({ queryKey: ['attendances'], queryFn: attendanceApi.getToday });
  const { data: tasks } = useQuery({ queryKey: ['tasks'], queryFn: taskApi.getAllReports });

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Company Reports & Data Exports
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Generate and download high-fidelity spreadsheets for attendance audits and productivity analysis
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-l-4 border-l-foreground flex flex-col justify-between p-6 hover:shadow-lg transition-shadow">
          <div>
            <div className="p-3 bg-foreground/10 text-foreground rounded-xl w-max mb-4">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-foreground tracking-tight mb-1">Attendance & IP Audit Report</h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-6">
              Complete chronological breakdown of employee login/logout times, verified office IP networks, and automatic working hour calculations.
            </p>
          </div>

          <Button
            onClick={() => exportAttendanceExcel(attendances || [])}
            className="w-full bg-foreground text-background hover:bg-foreground/90 font-bold tracking-wider shadow-lg"
          >
            <Download className="w-5 h-5 mr-2" />
            EXPORT ATTENDANCE EXCEL
          </Button>
        </Card>

        <Card className="border-l-4 border-l-primary flex flex-col justify-between p-6 hover:shadow-lg transition-shadow">
          <div>
            <div className="p-3 bg-primary/10 text-primary rounded-xl w-max mb-4">
              <BarChart3 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-foreground tracking-tight mb-1">Productivity & Task Report</h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-6">
              Comprehensive aggregation of daily task submissions, completed deliverables, pending items, and reported blockers across all departments.
            </p>
          </div>

          <Button
            onClick={() => exportProductivityExcel(tasks || [])}
            className="w-full bg-primary text-white font-bold tracking-wider shadow-lg shadow-primary/20"
          >
            <Download className="w-5 h-5 mr-2" />
            EXPORT PRODUCTIVITY EXCEL
          </Button>
        </Card>
      </div>

      <div className="p-6 rounded-2xl bg-muted/40 border border-border flex items-center gap-3 text-xs text-muted-foreground">
        <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
        <span>All exported reports are formatted with native XLSX headers, auto-adjusted column widths, and verified data integrity suitable for corporate audits.</span>
      </div>
    </div>
  );
};
