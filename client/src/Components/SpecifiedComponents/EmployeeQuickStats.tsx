import React from 'react';
import { Card } from '../WrapperComponents/Card';
import { Palmtree, Laptop, Clock } from 'lucide-react';
import type { Employee } from '../../types';

interface EmployeeQuickStatsProps {
  employee: Employee | null;
}

export const EmployeeQuickStats: React.FC<EmployeeQuickStatsProps> = ({ employee }) => {
  if (!employee) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
      <Card className="border-l-4 border-l-primary hover:shadow-lg transition-shadow">
        <div className="flex justify-between items-center mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Casual Leave Balance</span>
          <div className="p-3 bg-primary/10 rounded-xl text-primary">
            <Palmtree className="w-6 h-6" />
          </div>
        </div>
        <h3 className="text-4xl font-extrabold text-foreground">{employee.leaveBalance} <span className="text-sm font-medium text-muted-foreground">/ 2 Days</span></h3>
        <p className="text-xs text-muted-foreground mt-2">Monthly company allowance reset on 1st</p>
      </Card>

      <Card className="border-l-4 border-l-foreground hover:shadow-lg transition-shadow">
        <div className="flex justify-between items-center mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">WFH Balance</span>
          <div className="p-3 bg-foreground/10 rounded-xl text-foreground">
            <Laptop className="w-6 h-6" />
          </div>
        </div>
        <h3 className="text-4xl font-extrabold text-foreground">{employee.wfhBalance} <span className="text-sm font-medium text-muted-foreground">/ 1 Day</span></h3>
        <p className="text-xs text-muted-foreground mt-2">Requires HR approval and task reporting</p>
      </Card>

      <Card className="border-l-4 border-l-muted-foreground hover:shadow-lg transition-shadow">
        <div className="flex justify-between items-center mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Permission Hours</span>
          <div className="p-3 bg-muted rounded-xl text-muted-foreground border border-border">
            <Clock className="w-6 h-6" />
          </div>
        </div>
        <h3 className="text-4xl font-extrabold text-foreground">{employee.permissionHoursBalance} <span className="text-sm font-medium text-muted-foreground">/ 3 Hours</span></h3>
        <p className="text-xs text-muted-foreground mt-2">Available for personal errands & bank work</p>
      </Card>
    </div>
  );
};
