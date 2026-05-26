import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { taskApi } from '../api_service/taskApi';
import { employeeApi } from '../api_service/employeeApi';
import { useAuthStore } from '../store/useAuthStore';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
import { Input } from '../Components/WrapperComponents/Input';
import { TableWrapper } from '../Components/WrapperComponents/TableWrapper';
import { Modal } from '../Components/WrapperComponents/Modal';
import { formatDate } from '../utils/formatters';
import { BarChart3, Search, Eye, Calendar, AlertCircle } from 'lucide-react';
import type { TaskReport } from '../types';

export const TaskReportsPage: React.FC = () => {
  const { role } = useAuthStore();
  const [nameFilter, setNameFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedReport, setSelectedReport] = useState<TaskReport | null>(null);

  const { data: reports, isLoading: reportsLoading } = useQuery({
    queryKey: ['taskReports'],
    queryFn: taskApi.getAllReports,
  });

  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeeApi.getAll().then(res => res.employees),
    enabled: role === 'ADMIN' || role === 'HR',
  });

  const filteredReports = useMemo(() => {
    if (!reports) return [];
    return reports.filter((rep) => {
      const emp = typeof rep.employeeId === 'object' ? rep.employeeId : employees?.find((e) => e._id === rep.employeeId);
      const empName = emp?.fullName || 'Unknown Employee';

      const matchName = empName.toLowerCase().includes(nameFilter.toLowerCase());
      const matchDate = !dateFilter || rep.date === dateFilter;

      return matchName && matchDate;
    });
  }, [reports, employees, nameFilter, dateFilter]);

  const columns = [
    {
      header: 'Employee',
      accessor: (row: TaskReport) => {
        const emp = typeof row.employeeId === 'object' ? row.employeeId : employees?.find((e) => e._id === row.employeeId);
        const fullName = emp?.fullName || 'Unknown Employee';
        return (
          <div className="flex items-center gap-3">
            {emp?.profileImage ? (
              <img src={emp.profileImage} alt="" className="w-8 h-8 rounded-full object-cover border border-border flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0 uppercase">
                {fullName.charAt(0)}
              </div>
            )}
            <div>
              <p className="font-bold text-xs text-foreground">{fullName}</p>
              {emp?.employeeCode && !emp.employeeCode.startsWith('TEMP-EMP-') && (
                <p className="text-[10px] text-muted-foreground font-mono">({emp.employeeCode})</p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Date',
      accessor: (row: TaskReport) => (
        <span className="font-mono text-xs text-foreground font-semibold">
          {formatDate(row.date)}
        </span>
      ),
    },
    {
      header: 'Completed Tasks',
      accessor: (row: TaskReport) => (
        <span className="text-xs text-foreground block max-w-[150px] truncate font-medium" title={row.completedTasks}>
          {row.completedTasks}
        </span>
      ),
    },
    {
      header: 'In Progress',
      accessor: (row: TaskReport) => (
        <span className="text-xs text-foreground block max-w-[150px] truncate font-medium" title={row.inProgressTasks}>
          {row.inProgressTasks || 'None'}
        </span>
      ),
    },
    {
      header: 'Pending Tasks',
      accessor: (row: TaskReport) => (
        <span className="text-xs text-foreground block max-w-[150px] truncate font-medium" title={row.pendingTasks}>
          {row.pendingTasks || 'None'}
        </span>
      ),
    },
    {
      header: 'Blockers',
      accessor: (row: TaskReport) => {
        const isNone = (row.blockers || '').toLowerCase() === 'none';
        return (
          <span className={`text-xs px-2 py-0.5 rounded-full border w-max font-semibold block max-w-[120px] truncate ${
            isNone 
              ? 'bg-muted text-muted-foreground border-border' 
              : 'bg-primary/10 text-primary border-primary/20'
          }`} title={row.blockers}>
            {row.blockers || 'None'}
          </span>
        );
      },
    },
    {
      header: 'Tomorrow Plan',
      accessor: (row: TaskReport) => (
        <span className="text-xs text-foreground block max-w-[150px] truncate font-medium" title={row.tomorrowPlan}>
          {row.tomorrowPlan || 'None'}
        </span>
      ),
    },
    {
      header: 'Submitted At',
      accessor: (row: TaskReport) => (
        <span className="font-mono text-[11px] text-muted-foreground">
          {new Date(row.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: (row: TaskReport) => (
        <Button size="sm" variant="outline" onClick={() => setSelectedReport(row)}>
          <Eye className="w-4 h-4 mr-1" /> View
        </Button>
      ),
    },
  ];

  if (reportsLoading) {
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
            <BarChart3 className="w-6 h-6 text-primary" />
            Task & Daily Reports
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {role === 'EMPLOYEE' 
              ? 'Browse and search through your archived daily work summaries' 
              : 'Monitor employee check-out task logs, completed deliverables, and reported development blockers'}
          </p>
        </div>
      </div>

      <Card className="border-l-4 border-l-primary shadow-md p-6 space-y-6">
        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-muted/30 p-4 rounded-xl border border-border">
          {(role === 'ADMIN' || role === 'HR') && (
            <div className="flex-1 w-full">
              <Input
                placeholder="Search reports by employee name..."
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                icon={<Search className="w-4 h-4 text-muted-foreground" />}
              />
            </div>
          )}
          <div className={`${role === 'EMPLOYEE' ? 'flex-1' : 'w-full sm:w-64'}`}>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              icon={<Calendar className="w-4 h-4 text-muted-foreground" />}
            />
          </div>
        </div>

        <TableWrapper
          columns={role === 'EMPLOYEE' ? columns.filter(col => col.header !== 'Employee') : columns}
          data={filteredReports}
        />
      </Card>

      {/* Task Report Details Modal */}
      <Modal
        isOpen={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        title="Daily Task Report Details"
        maxWidth="max-w-2xl"
      >
        {selectedReport && (
          <div className="space-y-6 text-left py-2">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-primary" />
                <div>
                  <h4 className="text-sm font-bold text-foreground">Date of Work</h4>
                  <p className="text-xs text-muted-foreground font-mono">{formatDate(selectedReport.date)}</p>
                </div>
              </div>
              <div className="text-right">
                <h4 className="text-sm font-bold text-foreground">Submitted At</h4>
                <p className="text-xs text-muted-foreground font-mono">
                  {new Date(selectedReport.submittedAt).toLocaleDateString()} {new Date(selectedReport.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-primary uppercase tracking-wider block">Completed Tasks</span>
                <div className="p-3.5 rounded-xl bg-muted/65 border border-border text-sm text-foreground whitespace-pre-wrap leading-relaxed min-h-[80px]">
                  {selectedReport.completedTasks || 'None'}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-primary uppercase tracking-wider block">In Progress Tasks</span>
                <div className="p-3.5 rounded-xl bg-muted/65 border border-border text-sm text-foreground whitespace-pre-wrap leading-relaxed min-h-[80px]">
                  {selectedReport.inProgressTasks || 'None'}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-primary uppercase tracking-wider block">Pending Tasks</span>
                <div className="p-3.5 rounded-xl bg-muted/65 border border-border text-sm text-foreground whitespace-pre-wrap leading-relaxed min-h-[80px]">
                  {selectedReport.pendingTasks || 'None'}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-primary uppercase tracking-wider block">Plan for Tomorrow</span>
                <div className="p-3.5 rounded-xl bg-muted/65 border border-border text-sm text-foreground whitespace-pre-wrap leading-relaxed min-h-[80px]">
                  {selectedReport.tomorrowPlan || 'None'}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                Issues / Blockers
              </span>
              <div className={`p-4 rounded-xl border text-sm leading-relaxed whitespace-pre-wrap ${
                (selectedReport.blockers || '').toLowerCase() === 'none'
                  ? 'bg-muted/40 border-border text-muted-foreground'
                  : 'bg-primary/5 border-primary/20 text-foreground font-semibold'
              }`}>
                {selectedReport.blockers || 'None'}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-border">
              <Button onClick={() => setSelectedReport(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
