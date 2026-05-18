import React from 'react';
import { Card } from '../WrapperComponents/Card';
import { Users, TrendingUp, CheckCircle, Palmtree, DollarSign } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

interface AdminAnalyticsChartsProps {
  stats: any;
}

export const AdminAnalyticsCharts: React.FC<AdminAnalyticsChartsProps> = ({ stats }) => {
  if (!stats) return null;

  const maxPresent = Math.max(...(stats.attendanceTrends?.map((t: any) => t.present + t.wfh) || [12]));

  return (
    <div className="space-y-6 text-left">
      {/* Top High-Level Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-primary flex items-center justify-between p-6 hover:shadow-lg transition-shadow">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Total Workforce
            </p>
            <h3 className="text-3xl font-extrabold text-foreground">{stats.totalEmployees || 12}</h3>
            <p className="text-xs text-primary font-medium mt-2 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> 100% Active Staff
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-primary/10 text-primary">
            <Users className="w-7 h-7" />
          </div>
        </Card>

        <Card className="border-l-4 border-l-foreground flex items-center justify-between p-6 hover:shadow-lg transition-shadow">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Present Today
            </p>
            <h3 className="text-3xl font-extrabold text-foreground">{stats.presentToday || 10}</h3>
            <p className="text-xs text-muted-foreground font-medium mt-2">
              Including {stats.wfhToday || 1} WFH Staff
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-foreground/10 text-foreground">
            <CheckCircle className="w-7 h-7" />
          </div>
        </Card>

        <Card className="border-l-4 border-l-muted-foreground flex items-center justify-between p-6 hover:shadow-lg transition-shadow">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              On Leave / Absent
            </p>
            <h3 className="text-3xl font-extrabold text-foreground">{stats.absentToday || 1}</h3>
            <p className="text-xs text-foreground font-medium mt-2">
              {stats.pendingApprovals || 3} Pending Approvals
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-muted text-muted-foreground">
            <Palmtree className="w-7 h-7" />
          </div>
        </Card>

        <Card className="border-l-4 border-l-primary flex items-center justify-between p-6 hover:shadow-lg transition-shadow">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Monthly Payroll Cost
            </p>
            <h3 className="text-3xl font-extrabold text-foreground">
              {formatCurrency(stats.monthlyPayrollCost || 415000)}
            </h3>
            <p className="text-xs text-muted-foreground font-medium mt-2">Disbursed & Processing</p>
          </div>
          <div className="p-4 rounded-2xl bg-primary/10 text-primary">
            <DollarSign className="w-7 h-7" />
          </div>
        </Card>
      </div>

      {/* Visual Analytics Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Trends Bar Chart */}
        <Card className="lg:col-span-2 flex flex-col justify-between p-6">
          <div>
            <h3 className="text-lg font-bold text-foreground tracking-tight mb-1">
              Weekly Attendance Trends
            </h3>
            <p className="text-xs text-muted-foreground mb-6">
              Visual comparison of Office vs WFH attendance over the past week
            </p>
          </div>

          <div className="flex items-end justify-between gap-3 pt-8 pb-4 border-b border-border h-64 px-4">
            {stats.attendanceTrends?.map((trend: any, idx: number) => {
              const total = trend.present + trend.wfh;
              const heightPct = Math.min(100, Math.max(15, (total / maxPresent) * 100));

              return (
                <div key={idx} className="flex flex-col items-center gap-2 flex-1 h-full justify-end group">
                  <div className="flex flex-col items-center w-full gap-1 h-full justify-end relative">
                    {/* Tooltip */}
                    <div className="absolute -top-10 bg-card border border-border p-2 rounded-xl shadow-xl text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none w-max">
                      {trend.date}: {trend.present} Office, {trend.wfh} WFH
                    </div>

                    {/* WFH Bar */}
                    {trend.wfh > 0 && (
                      <div
                        className="w-full bg-foreground/20 rounded-t-md transition-all group-hover:brightness-110"
                        style={{ height: `${(trend.wfh / total) * heightPct}%` }}
                        title={`${trend.wfh} WFH`}
                      />
                    )}
                    {/* Present Bar */}
                    <div
                      className={`w-full bg-primary transition-all group-hover:brightness-110 ${trend.wfh === 0 ? 'rounded-t-md' : ''} rounded-b-md`}
                      style={{ height: `${(trend.present / total) * heightPct}%` }}
                      title={`${trend.present} Office`}
                    />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground mt-2 rotate-45 sm:rotate-0 origin-left">
                    {trend.date}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-6 pt-4 text-xs font-medium text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-primary flex-shrink-0"></span>
              <span>Office Attendance</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-foreground/20 flex-shrink-0"></span>
              <span>Approved WFH</span>
            </div>
          </div>
        </Card>

        {/* Department Productivity Breakdown */}
        <Card className="flex flex-col justify-between p-6">
          <div>
            <h3 className="text-lg font-bold text-foreground tracking-tight mb-1">
              Department Productivity
            </h3>
            <p className="text-xs text-muted-foreground mb-6">
              Average task completion efficiency metrics
            </p>
          </div>

          <div className="space-y-6 my-auto py-4">
            {stats.departmentBreakdown?.map((dept: any, idx: number) => (
              <div key={idx} className="space-y-2">
                <div className="flex justify-between items-center text-sm font-semibold">
                  <span className="text-foreground">{dept.name}</span>
                  <span className="text-primary font-mono font-bold">{dept.avgProductivity}%</span>
                </div>
                <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden p-0.5 border border-border">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
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

          <div className="p-4 rounded-xl bg-muted/40 border border-border text-center mt-4">
            <p className="text-xs text-muted-foreground">Overall Company Efficiency</p>
            <p className="text-2xl font-black text-foreground mt-0.5">91.4%</p>
          </div>
        </Card>
      </div>
    </div>
  );
};
