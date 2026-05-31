import React, { useState } from 'react';
import { DashboardSkeleton } from '../Components/WrapperComponents/Skeleton';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import { analyticsApi } from '../api_service/analyticsApi';
import { employeeApi } from '../api_service/employeeApi';
import { taskApi } from '../api_service/taskApi';
import { AttendanceCheckIn } from '../Components/SpecifiedComponents/AttendanceCheckIn';
import { EmployeeQuickStats } from '../Components/SpecifiedComponents/EmployeeQuickStats';
import { HRApprovalQueue } from '../Components/SpecifiedComponents/HRApprovalQueue';
import { AdminAnalyticsCharts } from '../Components/SpecifiedComponents/AdminAnalyticsCharts';
import { FinanceManagementChart } from '../Components/SpecifiedComponents/AdminAnalyticsCharts';
import { HolidayEnhancedCalendar } from '../Components/SpecifiedComponents/HolidayEnhancedCalendar';
import { EmployeeTaskSummary } from '../Components/SpecifiedComponents/EmployeeTaskSummary';
import { Card } from '../Components/WrapperComponents/Card';
import { TableWrapper } from '../Components/WrapperComponents/TableWrapper';
import type { TaskReport } from '../types';
import { LeaveApplyModal } from '../Components/SpecifiedComponents/LeaveApplyModal';
import { leaveApi } from '../api_service/leaveApi';
import { wfhApi } from '../api_service/wfhApi';
import { permissionApi } from '../api_service/permissionApi';
import { projectApi } from '../api_service/projectApi';
import { Users, CalendarCheck, Palmtree, BarChart3, ListTodo, Network } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user, role } = useAuthStore();
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const navigate = useNavigate();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: analyticsApi.getDashboardStats,
  });

  const { data: myEmployee } = useQuery({
    queryKey: ['myEmployee', user?.employeeId],
    queryFn: () => employeeApi.getById(user?.employeeId as string),
    enabled: role === 'EMPLOYEE' && !!user?.employeeId,
    retry: false,
    throwOnError: false,
  });

  const { data: projectStats, isLoading: projectStatsLoading } = useQuery({
    queryKey: ['employeeProjectStats'],
    queryFn: projectApi.getEmployeeQuickStats,
    enabled: role === 'EMPLOYEE',
    retry: false,
    throwOnError: false,
  });

  useQuery({
    queryKey: ['myTasks', user?.employeeId || user?._id],
    queryFn: () => taskApi.getByEmployee(user?.employeeId || user?._id || 'emp-dev-001'),
    enabled: role === 'EMPLOYEE',
  });

  // For calendar: fetch leave/wfh/perms for employee role
  const { data: myLeaves } = useQuery({
    queryKey: ['leaves'],
    queryFn: leaveApi.getAll,
    enabled: role === 'EMPLOYEE',
  });
  const { data: myWfh } = useQuery({
    queryKey: ['wfh'],
    queryFn: wfhApi.getAll,
    enabled: role === 'EMPLOYEE',
  });
  const { data: myPerms } = useQuery({
    queryKey: ['permissions'],
    queryFn: permissionApi.getAll,
    enabled: role === 'EMPLOYEE',
  });

  const { data: allTasks } = useQuery({
    queryKey: ['allTasks'],
    queryFn: taskApi.getAllReports,
    enabled: role === 'HR' || role === 'ADMIN' || role === 'MANAGER',
  });

  const taskColumns = [
    { header: 'Date', accessor: 'date', className: 'font-mono text-xs' },
    { header: 'Completed Tasks', accessor: 'completedTasks', className: 'font-medium text-xs' },
    { header: 'In Progress', accessor: 'inProgressTasks', className: 'text-xs text-muted-foreground' },
    { header: 'Blockers', accessor: 'blockers', className: 'text-xs text-destructive font-semibold' },
    { header: 'Tomorrow Plan', accessor: 'tomorrowPlan', className: 'text-xs italic' },
  ];

  if (statsLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8 text-left animate-in fade-in duration-300">
      
      

      {/* 1. EMPLOYEE DASHBOARD */}
      {role === 'EMPLOYEE' && (
        <div className="space-y-8">
          <AttendanceCheckIn />
          <EmployeeQuickStats stats={projectStats || null} loading={projectStatsLoading} />

          {/* 3-column layout: Tasks/Calendar (2/3 width) and Announcements & Actions (1/3 width) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Calendar + Task Summary */}
            <div className="lg:col-span-2 space-y-6">
              <EmployeeTaskSummary />
              <div className="space-y-2">
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                  My Leave & Holiday Calendar
                </h3>
                <HolidayEnhancedCalendar
                  leaves={myLeaves || []}
                  wfh={myWfh || []}
                  perms={myPerms || []}
                  compact={false}
                />
              </div>
            </div>

            {/* Announcements & Actions Card */}
            <div className="lg:col-span-1">
              <HRApprovalQueue />
            </div>
          </div>
        </div>
      )}

      {/* 2 & 3. MANAGER & HR DASHBOARD */}
      {(role === 'MANAGER' || role === 'HR') && (
        <div className="space-y-8">
         
          <AdminAnalyticsCharts stats={stats} />

          {/* Quick Access Grid */}
          <div>
            <h3 className="text-base font-bold text-foreground mb-3 tracking-tight">Quick Access</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                {
                  label: 'Employees',
                  desc: 'Directory & Profiles',
                  path: '/employees',
                  gradient: 'from-blue-500/20 to-cyan-600/10',
                  border: 'border-blue-500/30',
                  iconBg: 'bg-blue-500/15 text-blue-600',
                  icon: <Users className="w-6 h-6" />,
                },
                {
                  label: 'Attendance',
                  desc: 'Logs & Overtime',
                  path: '/attendance',
                  gradient: 'from-amber-500/20 to-orange-600/10',
                  border: 'border-amber-500/30',
                  iconBg: 'bg-amber-500/15 text-amber-600',
                  icon: <CalendarCheck className="w-6 h-6" />,
                },
                {
                  label: 'Leave & WFH',
                  desc: 'Requests & Status',
                  path: '/leave-wfh',
                  gradient: 'from-emerald-500/20 to-green-600/10',
                  border: 'border-emerald-500/30',
                  iconBg: 'bg-emerald-500/15 text-emerald-600',
                  icon: <Palmtree className="w-6 h-6" />,
                },
                {
                  label: 'Task Reports',
                  desc: 'Submissions',
                  path: '/task-reports',
                  gradient: 'from-violet-500/20 to-purple-600/10',
                  border: 'border-violet-500/30',
                  iconBg: 'bg-violet-500/15 text-violet-600',
                  icon: <BarChart3 className="w-6 h-6" />,
                },
                {
                  label: 'Projects',
                  desc: 'Tasks & Sprints',
                  path: '/projects',
                  gradient: 'from-pink-500/20 to-rose-600/10',
                  border: 'border-pink-500/30',
                  iconBg: 'bg-pink-500/15 text-pink-600',
                  icon: <ListTodo className="w-6 h-6" />,
                },
                {
                  label: 'Organization',
                  desc: 'Structure',
                  path: '/organization',
                  gradient: 'from-cyan-500/20 to-blue-600/10',
                  border: 'border-cyan-500/30',
                  iconBg: 'bg-cyan-500/15 text-cyan-600',
                  icon: <Network className="w-6 h-6" />,
                },
              ].map(({ label, desc, path, gradient, border, iconBg, icon }) => (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={`group relative flex flex-col items-center gap-3 p-5 rounded-2xl border ${border} bg-gradient-to-br ${gradient} hover:scale-105 hover:shadow-lg transition-all duration-200 cursor-pointer text-center w-full`}
                >
                  <div className={`p-3 rounded-xl ${iconBg} group-hover:scale-110 transition-transform duration-200`}>
                    {icon}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{desc}</p>
                  </div>
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </div>
                </button>
              ))}
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <Card className="space-y-4 border-l-4 border-l-primary shadow-md p-6 bg-card">
                <div>
                  <h3 className="text-lg font-bold text-foreground tracking-tight">Team Task Reports</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Daily submissions from your department
                  </p>
                </div>
                <TableWrapper
                  columns={[
                    { header: 'Employee', accessor: (row: TaskReport) => <span className="font-bold text-xs">{row.employeeId ? (typeof row.employeeId === 'object' ? row.employeeId.fullName || 'Unknown' : row.employeeId) : 'Unknown'}</span> },
                    ...taskColumns,
                  ]}
                  data={allTasks || []}
                  searchKey="completedTasks"
                  searchPlaceholder="Filter reports..."
                />
              </Card>
            </div>
            <div className="lg:col-span-1 space-y-8">
              <HRApprovalQueue />
            </div>
          </div>
        </div>
      )}

      {/* 4. ADMIN DASHBOARD */}
      {role === 'ADMIN' && (
        <div className="space-y-8">

          {/* Top metrics + charts (Employee Trends, Payroll Analytics) */}
          <AdminAnalyticsCharts stats={stats} />

          {/* Quick Access Grid */}
          <div>
            <h3 className="text-base font-bold text-foreground mb-3 tracking-tight">Quick Access</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                {
                  label: 'Payroll',
                  desc: 'Salaries & Payslips',
                  path: '/payroll',
                  gradient: 'from-violet-500/20 to-purple-600/10',
                  border: 'border-violet-500/30',
                  iconBg: 'bg-violet-500/15 text-violet-600',
                  icon: (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  ),
                },
                {
                  label: 'Audit Logs',
                  desc: 'Activity History',
                  path: '/audit-logs',
                  gradient: 'from-rose-500/20 to-red-600/10',
                  border: 'border-rose-500/30',
                  iconBg: 'bg-rose-500/15 text-rose-600',
                  icon: (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                  ),
                },
                {
                  label: 'Projects',
                  desc: 'Tasks & Sprints',
                  path: '/projects',
                  gradient: 'from-blue-500/20 to-cyan-600/10',
                  border: 'border-blue-500/30',
                  iconBg: 'bg-blue-500/15 text-blue-600',
                  icon: (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                  ),
                },
                {
                  label: 'Finance',
                  desc: 'Budget & Expenses',
                  path: '/finance',
                  gradient: 'from-emerald-500/20 to-green-600/10',
                  border: 'border-emerald-500/30',
                  iconBg: 'bg-emerald-500/15 text-emerald-600',
                  icon: (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  ),
                },
                {
                  label: 'Organization',
                  desc: 'Structure & Branches',
                  path: '/organization',
                  gradient: 'from-amber-500/20 to-orange-600/10',
                  border: 'border-amber-500/30',
                  iconBg: 'bg-amber-500/15 text-amber-600',
                  icon: (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  ),
                },
              ].map(({ label, desc, path, gradient, border, iconBg, icon }) => (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={`group relative flex flex-col items-center gap-3 p-5 rounded-2xl border ${border} bg-gradient-to-br ${gradient} hover:scale-105 hover:shadow-lg transition-all duration-200 cursor-pointer text-center w-full`}
                >
                  <div className={`p-3 rounded-xl ${iconBg} group-hover:scale-110 transition-transform duration-200`}>
                    {icon}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{desc}</p>
                  </div>
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Middle row: Finance Management (left) + Approval Queue (right) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <FinanceManagementChart stats={stats} />
            <HRApprovalQueue />
          </div>

          {/* Bottom: Full-width Project Productivity Reports */}
          <Card className="space-y-4 border-l-4 border-l-foreground shadow-md p-6 bg-card">
            <div>
              <h3 className="text-lg font-bold text-foreground tracking-tight">Project Productivity Reports</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Real-time task completion across all active projects</p>
            </div>

            {(!stats?.projectProductivity || stats.projectProductivity.length === 0) ? (
              <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
                No projects found
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Project Name</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Managed By</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">In Progress</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Completion</th>
                      <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Team</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {stats.projectProductivity.map((proj: any, idx: number) => {
                      const statusColors: Record<string, string> = {
                        ACTIVE: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
                        PLANNING: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
                        ON_HOLD: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
                        COMPLETED: 'bg-primary/15 text-primary border-primary/30',
                      };
                      const statusColor = statusColors[proj.status] || 'bg-muted text-muted-foreground border-border';
                      return (
                        <tr key={proj.id || idx} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-semibold text-foreground">{proj.projectName}</td>
                          <td className="px-4 py-3 text-muted-foreground">{proj.managedBy}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold border ${statusColor}`}>
                              {proj.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 min-w-[140px]">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-amber-500 transition-all duration-500"
                                  style={{ width: `${proj.inProgressPercent}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold text-amber-600 w-8 text-right">{proj.inProgressPercent}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 min-w-[140px]">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                  style={{ width: `${proj.completionPercent}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold text-emerald-600 w-8 text-right">{proj.completionPercent}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold">
                              {proj.teamSize}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

        </div>
      )}

      {/* Leave Application Modal */}
      <LeaveApplyModal isOpen={showLeaveModal} onClose={() => setShowLeaveModal(false)} />
    </div>
  );
};
