import React from 'react';
import { Card } from '../WrapperComponents/Card';
import { Users, TrendingUp, CheckCircle, DollarSign, Moon, Clock } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

interface AdminAnalyticsChartsProps {
  stats: {
    totalEmployees?: number;
    presentToday?: number;
    wfhToday?: number;
    absentToday?: number;
    pendingApprovals?: number;
    monthlyPayrollCost?: number;
    overallProductivity?: number;
    attendanceTrends?: Array<{ date?: string; day?: string; present: number; wfh: number }>;
    departmentBreakdown?: Array<{ name: string; avgProductivity: number; count: number }>;
  };
}

export const AdminAnalyticsCharts: React.FC<AdminAnalyticsChartsProps> = ({ stats }) => {
  if (!stats) return null;

  const trendsData = stats.attendanceTrends || [];
  const maxPresent = Math.max(...trendsData.map((t: { present: number; wfh: number }) => t.present + t.wfh), 12);

  const deptsData = stats.departmentBreakdown || [];

  return (
    <div className="space-y-6 text-left">
      {/* Top High-Level Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-primary flex items-center justify-between p-6 hover:shadow-lg transition-shadow bg-card">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Total Workforce
            </p>
            <h3 className="text-3xl font-extrabold text-foreground">{stats.totalEmployees ?? 0}</h3>
            <p className="text-xs text-primary font-bold mt-2 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> 100% Active Staff
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-primary/10 text-primary">
            <Users className="w-7 h-7" />
          </div>
        </Card>

        <Card className="border-l-4 border-l-foreground flex items-center justify-between p-6 hover:shadow-lg transition-shadow bg-card">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Present Today
            </p>
            <h3 className="text-3xl font-extrabold text-foreground">{stats.presentToday ?? 0}</h3>
            <p className="text-xs text-muted-foreground font-medium mt-2">
              Including {stats.wfhToday ?? 0} WFH Staff
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-foreground/10 text-foreground">
            <CheckCircle className="w-7 h-7" />
          </div>
        </Card>

        <Card className="border-l-4 border-l-primary flex items-center justify-between p-6 hover:shadow-lg transition-shadow bg-card">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Leave / Absence
            </p>
            <h3 className="text-3xl font-extrabold text-foreground">{stats.absentToday ?? 0}</h3>
            <p className="text-xs text-primary font-bold mt-2 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> {stats.pendingApprovals ?? 0} Pending Request
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-foreground/10 text-foreground">
            <Moon className="w-7 h-7" />
          </div>
        </Card>

        <Card className="border-l-4 border-l-primary flex items-center justify-between p-6 hover:shadow-lg transition-shadow bg-card">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Monthly Payroll Cost
            </p>
            <h3 className="text-3xl font-extrabold text-foreground font-mono">
              {formatCurrency(stats.monthlyPayrollCost ?? 0)}
            </h3>
            <p className="text-xs text-muted-foreground font-medium mt-2">Status: Disbursed & Processing</p>
          </div>
          <div className="p-4 rounded-2xl bg-primary/10 text-primary">
            <DollarSign className="w-7 h-7" />
          </div>
        </Card>
      </div>

      {/* Visual Analytics Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Trends Bar Chart */}
        <Card className="lg:col-span-2 flex flex-col justify-between p-6 bg-card">
          <div className="flex items-start justify-between border-b border-border pb-4">
            <div>
              <h3 className="text-lg font-bold text-foreground tracking-tight mb-0.5">
                Weekly Attendance Trends
              </h3>
              <p className="text-xs text-muted-foreground">
                Comparison of Office vs WFH attendance
              </p>
            </div>
            {/* Top Right Legend */}
            <div className="flex items-center gap-4 text-xs font-bold">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-primary rounded-sm flex-shrink-0"></span>
                <span className="text-foreground">Office</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-muted rounded-sm border border-border flex-shrink-0"></span>
                <span className="text-muted-foreground">WFH</span>
              </div>
            </div>
          </div>

          <div className="flex items-end justify-between gap-6 pt-8 pb-4 h-64 px-4 my-auto">
            {trendsData.map((trend: { date?: string; day?: string; present: number; wfh: number }, idx: number) => {
              const total = trend.present + trend.wfh;
              const heightPct = Math.min(100, Math.max(15, (total / maxPresent) * 100));

              return (
                <div key={idx} className="flex flex-col items-center gap-3 flex-1 h-full justify-end group">
                  <div className="flex flex-col items-center w-full max-w-[40px] gap-0.5 h-full justify-end relative">
                    {/* Tooltip */}
                    <div className="absolute -top-10 bg-card border border-border p-2 rounded-xl shadow-xl text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none w-max">
                      {trend.day || trend.date}: {trend.present} Office, {trend.wfh} WFH
                    </div>

                    {/* WFH Bar (Top, Grey) */}
                    {trend.wfh > 0 && (
                      <div
                        className="w-full bg-muted border border-border/50 rounded-t-md transition-all group-hover:brightness-90"
                        style={{ height: `${(trend.wfh / total) * heightPct}%` }}
                        title={`${trend.wfh} WFH`}
                      />
                    )}
                    {/* Present Bar (Bottom, Orange) */}
                    <div
                      className={`w-full bg-primary transition-all group-hover:brightness-110 ${trend.wfh === 0 ? 'rounded-t-md' : ''} rounded-b-md`}
                      style={{ height: `${(trend.present / total) * heightPct}%` }}
                      title={`${trend.present} Office`}
                    />
                  </div>
                  <span className="text-xs font-bold text-muted-foreground mt-1">
                    {trend.day || trend.date}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Department Productivity Breakdown */}
        <Card className="flex flex-col justify-between p-6 bg-card">
          <div className="flex items-start justify-between border-b border-border pb-4">
            <div>
              <h3 className="text-lg font-bold text-foreground tracking-tight mb-0.5">
                Department Productivity
              </h3>
              <p className="text-xs text-muted-foreground">
                Task completion efficiency metrics
              </p>
            </div>
            <span className="px-3 py-1 bg-muted text-foreground text-xs font-bold rounded-lg border border-border">
              Overall: {stats.overallProductivity ?? 0}%
            </span>
          </div>

          {/* 2x2 Grid of Departments */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-auto py-6">
            {deptsData.map((dept: { name: string; avgProductivity: number; count: number }, idx: number) => (
              <div key={idx} className="space-y-2">
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-foreground">{dept.name}</span>
                  <span className="text-primary font-mono font-extrabold">{dept.avgProductivity}%</span>
                </div>
                <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden p-0.5 border border-border">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${dept.avgProductivity}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-muted-foreground font-medium">
                  <span>{dept.count} Active Staff</span>
                  <span>Target: 90%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
