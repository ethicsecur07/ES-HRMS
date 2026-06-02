import React from 'react';
import { Card } from '../WrapperComponents/Card';
import { FolderOpen, Rocket, UserCheck, CheckCircle2, ClipboardCheck, FileText, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/useAuthStore';
import { taskApi } from '../../api_service/taskApi';

interface EmployeeQuickStatsProps {
  stats: {
    departmentProjectCount: number;
    onboardProjectCount: number;
    assignedProjectCount: number;
    completedProjectCount: number;
  } | null;
  loading?: boolean;
}

export const EmployeeQuickStats: React.FC<EmployeeQuickStatsProps> = ({ stats, loading }) => {
  const { user, role } = useAuthStore();

  // Load intern tasks dynamically if user is an intern
  const { data: myTasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['myTasks', user?.employeeId || user?._id],
    queryFn: () => taskApi.getByEmployee(user?.employeeId || user?._id || ''),
    enabled: role === 'INTERN' && !!(user?.employeeId || user?._id),
  });

  const isIntern = role === 'INTERN';
  const showLoading = loading || (isIntern && tasksLoading);

  if (showLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse border-l-4 border-l-muted-foreground/30 p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="h-4 w-32 bg-muted rounded animate-pulse" />
              <div className="h-10 w-10 bg-muted rounded-xl animate-pulse" />
            </div>
            <div className="h-8 w-16 bg-muted rounded mb-2 animate-pulse" />
            <div className="h-3 w-40 bg-muted rounded animate-pulse" />
          </Card>
        ))}
      </div>
    );
  }

  // 1. Intern specific task counts calculations
  if (isIntern) {
    const reportCount = myTasks?.length || 0;

    const totalCompleted = myTasks?.reduce((sum, t) => {
      if (!t.completedTasks) return sum;
      const items = t.completedTasks.split(/[\n,;•]/).map(x => x.trim()).filter(x => x.length > 0 && x !== '-' && x !== 'none' && x !== 'nil');
      return sum + Math.max(1, items.length);
    }, 0) || 0;

    const totalPending = myTasks?.reduce((sum, t) => {
      const val = t.pendingTasks || t.inProgressTasks || '';
      if (!val) return sum;
      const items = val.split(/[\n,;•]/).map(x => x.trim()).filter(x => x.length > 0 && x !== '-' && x !== 'none' && x !== 'nil');
      return sum + Math.max(1, items.length);
    }, 0) || 0;

    const totalBlockers = myTasks?.filter(t => {
      const b = (t.blockers || '').toLowerCase().trim();
      return b && b !== 'none' && b !== 'nil' && b !== '-' && b !== 'no blockers';
    }).length || 0;

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left animate-in fade-in duration-300">
        {/* 1. Daily Reports */}
        <Card className="border-l-4 border-l-violet-500 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Daily Submissions</span>
            <div className="p-3 bg-violet-500/10 rounded-xl text-violet-500">
              <ClipboardCheck className="w-6 h-6" />
            </div>
          </div>
          <h3 className="text-4xl font-extrabold text-foreground">{reportCount}</h3>
          <p className="text-xs text-muted-foreground mt-2">Total daily report updates submitted</p>
        </Card>

        {/* 2. Tasks Completed */}
        <Card className="border-l-4 border-l-emerald-500 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tasks Completed</span>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
          <h3 className="text-4xl font-extrabold text-foreground">{totalCompleted}</h3>
          <p className="text-xs text-muted-foreground mt-2">Total tasks successfully resolved</p>
        </Card>

        {/* 3. In Progress / Pending Tasks */}
        <Card className="border-l-4 border-l-blue-500 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">In Progress Tasks</span>
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
              <Rocket className="w-6 h-6" />
            </div>
          </div>
          <h3 className="text-4xl font-extrabold text-foreground">{totalPending}</h3>
          <p className="text-xs text-muted-foreground mt-2">Active tasks currently in progress</p>
        </Card>

        {/* 4. Active Blockers */}
        <Card className="border-l-4 border-l-amber-500 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Blockers Reported</span>
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
          <h3 className="text-4xl font-extrabold text-foreground">{totalBlockers}</h3>
          <p className="text-xs text-muted-foreground mt-2">Days with active blockers encountered</p>
        </Card>
      </div>
    );
  }

  // 2. Standard Employee Project Quick Stats
  const departmentProjectCount = stats?.departmentProjectCount ?? 0;
  const onboardProjectCount = stats?.onboardProjectCount ?? 0;
  const assignedProjectCount = stats?.assignedProjectCount ?? 0;
  const completedProjectCount = stats?.completedProjectCount ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
      {/* 1. Department Related Projects */}
      <Card className="border-l-4 border-l-violet-500 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
        <div className="flex justify-between items-center mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Department Projects</span>
          <div className="p-3 bg-violet-500/10 rounded-xl text-violet-500">
            <FolderOpen className="w-6 h-6" />
          </div>
        </div>
        <h3 className="text-4xl font-extrabold text-foreground">{departmentProjectCount}</h3>
        <p className="text-xs text-muted-foreground mt-2">Total projects in your department</p>
      </Card>

      {/* 2. Onboard Projects */}
      <Card className="border-l-4 border-l-blue-500 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
        <div className="flex justify-between items-center mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Onboard Projects</span>
          <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
            <Rocket className="w-6 h-6" />
          </div>
        </div>
        <h3 className="text-4xl font-extrabold text-foreground">{onboardProjectCount}</h3>
        <p className="text-xs text-muted-foreground mt-2">Active & planning dept projects</p>
      </Card>

      {/* 3. Assigned Projects */}
      <Card className="border-l-4 border-l-amber-500 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
        <div className="flex justify-between items-center mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Assigned Projects</span>
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>
        <h3 className="text-4xl font-extrabold text-foreground">{assignedProjectCount}</h3>
        <p className="text-xs text-muted-foreground mt-2">Projects you are allocated to</p>
      </Card>

      {/* 4. Completed Projects */}
      <Card className="border-l-4 border-l-emerald-500 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
        <div className="flex justify-between items-center mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Completed Projects</span>
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
        <h3 className="text-4xl font-extrabold text-foreground">{completedProjectCount}</h3>
        <p className="text-xs text-muted-foreground mt-2">Your successfully closed projects</p>
      </Card>
    </div>
  );
};

export default EmployeeQuickStats;
