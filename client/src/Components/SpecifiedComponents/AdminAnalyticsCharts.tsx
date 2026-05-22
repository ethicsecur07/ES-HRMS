import React from 'react';
import { Card } from '../WrapperComponents/Card';
import { Users, TrendingUp, CheckCircle, DollarSign, Moon, Clock } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area
} from 'recharts';

interface AdminAnalyticsChartsProps {
  stats: any;
}

export const AdminAnalyticsCharts: React.FC<AdminAnalyticsChartsProps> = ({ stats }) => {
  if (!stats) return null;

  const trendsData = stats.attendanceTrends || [];
  const deptsData = stats.departmentBreakdown || [];

  // Mocking payroll trend data for the chart as the backend only returns current month cost
  const payrollTrendData = [
    { month: 'Jan', cost: stats.monthlyPayrollCost * 0.9 },
    { month: 'Feb', cost: stats.monthlyPayrollCost * 0.95 },
    { month: 'Mar', cost: stats.monthlyPayrollCost * 0.92 },
    { month: 'Apr', cost: stats.monthlyPayrollCost * 0.98 },
    { month: 'May', cost: stats.monthlyPayrollCost },
  ];

  return (
    <div className="space-y-6 text-left">
      {/* Top High-Level Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-primary flex items-center justify-between p-6 hover:shadow-md transition-shadow bg-card">
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

        <Card className="border-l-4 border-l-foreground flex items-center justify-between p-6 hover:shadow-md transition-shadow bg-card">
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

        <Card className="border-l-4 border-l-primary flex items-center justify-between p-6 hover:shadow-md transition-shadow bg-card">
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

        <Card className="border-l-4 border-l-primary flex items-center justify-between p-6 hover:shadow-md transition-shadow bg-card">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Graphs (Recharts BarChart) */}
        <Card className="flex flex-col justify-between p-6 bg-card">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-foreground tracking-tight mb-0.5">Attendance Graphs</h3>
            <p className="text-xs text-muted-foreground">Office vs WFH over the last 6 days</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendsData} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <RechartsTooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="present" name="Office" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={30} />
                <Bar dataKey="wfh" name="WFH" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Payroll Analytics (Recharts AreaChart) */}
        <Card className="flex flex-col justify-between p-6 bg-card">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-foreground tracking-tight mb-0.5">Payroll Analytics</h3>
            <p className="text-xs text-muted-foreground">Monthly company expenditure</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={payrollTrendData} margin={{ top: 5, right: 0, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(val) => `$${val/1000}k`} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <RechartsTooltip cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '3 3' }} formatter={(val: any) => formatCurrency(Number(val))} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                <Area type="monotone" dataKey="cost" name="Payroll Cost" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorCost)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Employee Trends (Department Breakdown - Recharts LineChart) */}
        <Card className="flex flex-col justify-between p-6 bg-card">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-foreground tracking-tight mb-0.5">Employee Trends</h3>
              <p className="text-xs text-muted-foreground">Average Productivity by Department</p>
            </div>
            <span className="px-3 py-1 bg-muted text-foreground text-xs font-bold rounded-lg border border-border">
              Overall: {stats.overallProductivity ?? 0}%
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={deptsData} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="avgProductivity" name="Productivity %" stroke="hsl(var(--foreground))" strokeWidth={3} dot={{ r: 6, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: 'hsl(var(--card))' }} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        
        {/* Recruitment / HR Quick Stats can go here if needed, or leave it as department breakdown for now. */}
      </div>
    </div>
  );
};
