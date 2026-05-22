import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import { analyticsApi } from '../api_service/analyticsApi';
import { employeeApi } from '../api_service/employeeApi';
import { taskApi } from '../api_service/taskApi';
import { AttendanceCheckIn } from '../Components/SpecifiedComponents/AttendanceCheckIn';
import { EmployeeQuickStats } from '../Components/SpecifiedComponents/EmployeeQuickStats';
import { HRApprovalQueue } from '../Components/SpecifiedComponents/HRApprovalQueue';
import { AdminAnalyticsCharts } from '../Components/SpecifiedComponents/AdminAnalyticsCharts';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
import { TableWrapper } from '../Components/WrapperComponents/TableWrapper';
import type { TaskReport } from '../types';
import { PlusCircle } from 'lucide-react';
import { LeaveApplyModal } from '../Components/SpecifiedComponents/LeaveApplyModal';

export const DashboardPage: React.FC = () => {
  const { user, role } = useAuthStore();
  const [showLeaveModal, setShowLeaveModal] = useState(false);

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

  const { data: myTasks } = useQuery({
    queryKey: ['myTasks', user?.employeeId || user?._id],
    queryFn: () => taskApi.getByEmployee(user?.employeeId || user?._id || 'emp-dev-001'),
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
    return (
      <div className="space-y-6 animate-pulse">
        <Card className="h-40 bg-muted/20">
          <div />
        </Card>
        <Card className="h-96 bg-muted/20">
          <div />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 text-left animate-in fade-in duration-300">
      {/* Dynamic Header Banner */}
      {role === 'EMPLOYEE' && (
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-card to-muted border border-border shadow-sm">
          <div>
            <h2 className="text-3xl font-extrabold text-foreground tracking-tight">
              Employee Workspace
            </h2>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              Daily attendance check-in, leave balances, and mandatory task reporting
            </p>
          </div>

          <Button
            onClick={() => setShowLeaveModal(true)}
            className="bg-primary text-white font-bold tracking-wider shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all scale-105"
          >
            <PlusCircle className="w-5 h-5 mr-2" />
            APPLY LEAVE / WFH
          </Button>
        </div>
      )}

      {/* 1. EMPLOYEE DASHBOARD */}
      {role === 'EMPLOYEE' && (
        <div className="space-y-8">
          <AttendanceCheckIn />
          <EmployeeQuickStats employee={myEmployee || null} />

          <Card className="space-y-4 border-l-4 border-l-primary shadow-md">
            <div>
              <h3 className="text-lg font-bold text-foreground tracking-tight">My Daily Task Reports</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Archived daily productivity reports submitted prior to check-out
              </p>
            </div>
            <TableWrapper
              columns={taskColumns}
              data={myTasks || []}
              searchKey="completedTasks"
              searchPlaceholder="Search task history..."
            />
          </Card>
        </div>
      )}

      {/* 2. MANAGER DASHBOARD */}
      {role === 'MANAGER' && (
        <div className="space-y-8">
          <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
            <h3 className="text-xl font-bold">Manager Workspace</h3>
            <p className="text-sm text-muted-foreground">Oversee department performance and team tasks.</p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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

            <div className="space-y-8">
              <HRApprovalQueue />
            </div>
          </div>
        </div>
      )}

      {/* 3. HR DASHBOARD */}
      {role === 'HR' && (
        <div className="space-y-8">
          <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
            <h3 className="text-xl font-bold">HR Workspace</h3>
            <p className="text-sm text-muted-foreground">Manage organization policies, recruitment, and approvals.</p>
          </div>
          <AdminAnalyticsCharts stats={stats} />
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <Card className="space-y-4 border-l-4 border-l-primary shadow-md p-6 bg-card">
                <div>
                  <h3 className="text-lg font-bold text-foreground tracking-tight">Employee Directory Overview</h3>
                </div>
                {/* Simplified view or list */}
                <div className="p-4 text-sm text-muted-foreground">Navigate to the Employees tab for full directory access.</div>
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
          <div className="p-6 rounded-2xl bg-card border border-border shadow-sm flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold">Admin Workspace</h3>
              <p className="text-sm text-muted-foreground">Full organizational overview and system analytics.</p>
            </div>
          </div>
          <AdminAnalyticsCharts stats={stats} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <Card className="space-y-4 border-l-4 border-l-foreground shadow-md p-6 bg-card">
                <div>
                  <h3 className="text-lg font-bold text-foreground tracking-tight">Company Productivity Reports</h3>
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

      {/* Leave Application Modal */}
      <LeaveApplyModal isOpen={showLeaveModal} onClose={() => setShowLeaveModal(false)} />
    </div>
  );
};
