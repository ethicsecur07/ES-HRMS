import React from 'react';
import { Card } from '../WrapperComponents/Card';
import { FolderOpen, Rocket, UserCheck, CheckCircle2 } from 'lucide-react';

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
  if (loading) {
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
