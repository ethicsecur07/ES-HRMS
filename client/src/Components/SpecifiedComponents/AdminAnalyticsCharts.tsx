import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '../../utils/formatters';
import { employeeApi } from '../../api_service/employeeApi';
import { analyticsApi } from '../../api_service/analyticsApi';
import { Card } from '../WrapperComponents/Card';
import { Users, TrendingUp, IndianRupee, FolderKanban, Building2 } from 'lucide-react';

import {
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, LabelList,
} from 'recharts';

interface AdminAnalyticsChartsProps {
  stats: any;
}

// ── Department Label Resolution ───────────────────────────────────────────────
// Uses case-insensitive keyword matching so minor casing/spacing differences
// in the DB don't break the mapping.
const resolveDeptLabel = (rawName: string): string => {
  const n = rawName.trim().toLowerCase();

  // Development group: contains 'mern', 'development', or 'developer' (excluding business development)
  if ((n.includes('mern') || n.includes('development') || n.includes('developer')) && !n.includes('business')) return 'Development';

  // Digital Marketing group: 'digital marketing' OR standalone 'marketing'
  if (n.includes('digital') || n === 'marketing') return 'Digital Marketing';

  // BA group: 'bis-tec' (without 'h') or 'business analysis'
  if ((n.includes('bis') && n.includes('tec') && !n.includes('tech')) || n.includes('business analysis')) return 'BA';

  // BDA group: 'bis-tech' (with 'h') or 'business data'
  if ((n.includes('bis') && n.includes('tech')) || n.includes('business data')) return 'BDA';

  // Return original (trimmed) for anything else
  return rawName.trim();
};

// Vibrant palette per display label
const DEPT_COLOR_MAP: Record<string, string> = {
  'Development':       '#6366f1',
  'Digital Marketing': '#ec4899',
  'BA':                '#f59e0b',
  'BDA':               '#10b981',
  'HR':                '#8b5cf6',
};

const PRESET_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#06b6d4', '#3b82f6', '#f43f5e', '#a855f7', '#14b8a6'];

const getDeptColor = (label: string, index: number) => {
  const resolved = resolveDeptLabel(label);
  if (DEPT_COLOR_MAP[resolved]) return DEPT_COLOR_MAP[resolved];
  if (DEPT_COLOR_MAP[label]) return DEPT_COLOR_MAP[label];
  return PRESET_COLORS[index % PRESET_COLORS.length];
};



// ── Custom Bar Label ─────────────────────────────────────────────────────────
const CustomBarLabel = (props: any) => {
  const { x, y, width, value } = props;
  if (!value) return null;
  return (
    <text
      x={x + width / 2}
      y={y - 6}
      fill="#e2e8f0"
      fontSize={12}
      fontWeight={700}
      textAnchor="middle"
    >
      {value}
    </text>
  );
};

// ── Custom Tooltip ────────────────────────────────────────────────────────────
const CustomDeptTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const color = payload[0]?.fill || '#6366f1';
  return (
    <div
      style={{
        background: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        borderRadius: 10,
        padding: '10px 16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}
    >
      <p style={{ color, fontWeight: 800, fontSize: 13, marginBottom: 4 }}>{payload[0]?.payload?.name}</p>
      <p style={{ color: '#e2e8f0', fontSize: 12 }}>
        👥 <strong>{payload[0]?.value}</strong> employees
      </p>
    </div>
  );
};

// ── Custom Attendance Tooltip ───────────────────────────────────────────
const CustomAttendanceTooltip = ({ active, payload, totalEmployees }: any) => {
  if (!active || !payload?.length) return null;
  
  const divisor = totalEmployees && totalEmployees > 0 ? totalEmployees : 1;
  
  return (
    <div
      style={{
        background: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        borderRadius: 10,
        padding: '10px 16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}
      className="space-y-1.5 text-xs text-left"
    >
      <p className="font-bold text-foreground text-sm border-b border-border pb-1.5 mb-1.5">
        {payload[0]?.payload?.dateStr || payload[0]?.payload?.date} Attendance
      </p>
      {payload.slice().reverse().map((entry: any) => {
        const val = entry.value || 0;
        const pct = divisor > 0 ? Math.round((val / divisor) * 100) : 0;
        return (
          <div key={entry.name} className="flex items-center justify-between gap-4 font-semibold">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: entry.color || entry.fill }} />
              <span className="text-muted-foreground">{entry.name}</span>
            </div>
            <span className="text-foreground">
              {val} <span className="text-[10px] text-muted-foreground font-medium">({pct}%)</span>
            </span>
          </div>
        );
      })}
      <div className="border-t border-border/60 pt-1.5 mt-1.5 flex items-center justify-between font-bold text-muted-foreground">
        <span>Total Employees</span>
        <span className="text-foreground">{divisor}</span>
      </div>
    </div>
  );
};

export const AdminAnalyticsCharts: React.FC<AdminAnalyticsChartsProps> = ({ stats }) => {
  const [timeframe, setTimeframe] = useState<'today' | 'week'>('week');

  // ── Fetch all active employees to compute department breakdown ──────────────
  // We fetch directly from the employees API (same source as Employee Directory)
  // because the analytics aggregate is unreliable. limit=500 covers any real org.
  const { data: empData, isLoading: empLoading } = useQuery({
    queryKey: ['employees-dept-trends'],
    queryFn: () => employeeApi.getAll({ isActive: true, limit: 500 }),
    staleTime: 1000 * 60 * 5, // cache 5 minutes
  });

  if (!stats) return null;



  // ── Derive project stats from projectProductivity (always correct) ──────────
  // The countDocuments backend calls can fail due to orgId type mismatch,
  // but projectProductivity always returns the real project list.
  const projectList: any[] = Array.isArray(stats.projectProductivity)
    ? stats.projectProductivity
    : [];

  const derivedTotalProjects    = projectList.length;
  const derivedActiveProjects   = projectList.filter(
    (p) => p.status === 'ACTIVE' || p.status === 'IN_PROGRESS'
  ).length;

  // Prefer backend value if > 0, otherwise use derived value
  const totalProjects     = (stats.totalProjects    > 0) ? stats.totalProjects    : derivedTotalProjects;
  const activeProjects    = (stats.activeProjects   > 0) ? stats.activeProjects   : derivedActiveProjects;

  // ── Build department chart data from live employees list ───────────────────
  // Get the employees array — handle both wrapped { employees: [] } and raw []
  const allEmployees: any[] = Array.isArray(empData)
    ? empData
    : (empData as any)?.employees ?? [];

  const mergedDeptMap: Record<string, number> = {};
  allEmployees.forEach((emp) => {
    if (!emp.department) return;
    const label = resolveDeptLabel(emp.department);
    mergedDeptMap[label] = (mergedDeptMap[label] || 0) + 1;
  });

  const { data: orgSettings } = useQuery({
    queryKey: ['companySettings'],
    queryFn: analyticsApi.getSettings,
  });

  const PREFERRED_ORDER = orgSettings?.visibleDepartments || ['Development', 'Digital Marketing', 'HR', 'BA', 'BDA'];

  const departmentTrendData = PREFERRED_ORDER
    .map((label, index) => {
      const resolvedTarget = resolveDeptLabel(label);
      let employeeCount = 0;
      
      Object.keys(mergedDeptMap).forEach(key => {
        if (resolveDeptLabel(key) === resolvedTarget || key === label) {
          employeeCount += mergedDeptMap[key];
        }
      });

      return {
        name: label,
        employeeCount,
        fill: getDeptColor(label, index),
      };
    });

  const totalDeptEmployees = departmentTrendData.reduce((s, d) => s + d.employeeCount, 0);

  const rawTrends = stats.attendanceTrends || [];
  const attendanceChartData = timeframe === 'today'
    ? rawTrends.filter((item: any) => {
        const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'short' });
        return item.date === todayStr;
      })
    : rawTrends;

  return (
    <div className="space-y-6 text-left">
      {/* ── Top Metric Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {/* Total Employees */}
        <Card className="border-l-4 border-l-primary flex items-center justify-between p-6 hover:shadow-md transition-shadow bg-card">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Total Employees</p>
            <h3 className="text-3xl font-extrabold text-foreground">{totalDeptEmployees}</h3>
            <p className="text-xs text-primary font-bold mt-2 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Active Staff
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-primary/10 text-primary"><Users className="w-7 h-7" /></div>
        </Card>

        {/* Total Projects */}
        <Card className="border-l-4 border-l-indigo-500 flex items-center justify-between p-6 hover:shadow-md transition-shadow bg-card">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Total Projects</p>
            <h3 className="text-3xl font-extrabold text-foreground">{totalProjects}</h3>
            <p className="text-xs text-indigo-500 font-bold mt-2 flex items-center gap-1">
              <FolderKanban className="w-3.5 h-3.5" /> All Projects
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-indigo-500/10 text-indigo-500"><FolderKanban className="w-7 h-7" /></div>
        </Card>

        {/* Active Projects */}
        <Card className="border-l-4 border-l-emerald-500 flex items-center justify-between p-6 hover:shadow-md transition-shadow bg-card">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Active Projects</p>
            <h3 className="text-3xl font-extrabold text-foreground">{activeProjects}</h3>
            <p className="text-xs text-emerald-500 font-bold mt-2 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Active Projects
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-500"><FolderKanban className="w-7 h-7" /></div>
        </Card>

       

        {/* Monthly Payroll Cost */}
        <Card className="border-l-4 border-l-primary flex items-center justify-between p-6 hover:shadow-md transition-shadow bg-card">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Monthly Payroll Cost</p>
            <h3 className="text-3xl font-extrabold text-foreground font-mono">{formatCurrency(stats.monthlyPayrollCost ?? 0)}</h3>
            <p className="text-xs text-muted-foreground font-medium mt-2">Status: Disbursed</p>
          </div>
          <div className="p-4 rounded-2xl bg-primary/10 text-primary"><IndianRupee className="w-7 h-7" /></div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Department Employee Trends ────────────────────────────────── */}
        <Card className="flex flex-col p-6 bg-card">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="text-lg font-bold text-foreground tracking-tight mb-0.5 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                Department Employee Trends
              </h3>
              <p className="text-xs text-muted-foreground">Active employee count per department</p>
            </div>
            <div className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-bold rounded-xl border border-primary/20 shrink-0">
              {totalDeptEmployees} Total
            </div>
          </div>

          {/* Bar Chart */}
          {empLoading ? (
            <div className="h-56 w-full flex flex-col gap-3 justify-end px-2">
              {[60, 80, 45, 70].map((h, i) => (
                <div key={i} className="flex items-end gap-4">
                  <div
                    className="rounded-t-lg animate-pulse"
                    style={{ height: `${h}%`, flex: 1, background: 'rgba(255,255,255,0.07)' }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={departmentTrendData}
                  margin={{ top: 28, right: 10, left: -25, bottom: 5 }}
                  barCategoryGap="30%"
                >
                  <defs>
                    {departmentTrendData.map((d, i) => (
                      <linearGradient key={d.name} id={`grad-dept-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={d.fill} stopOpacity={1} />
                        <stop offset="100%" stopColor={d.fill} stopOpacity={0.35} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip content={<CustomDeptTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="employeeCount" name="Employees" radius={[8, 8, 0, 0]} maxBarSize={56}>
                    {departmentTrendData.map((_entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={`url(#grad-dept-${index})`}
                        stroke={departmentTrendData[index].fill}
                        strokeWidth={1}
                      />
                    ))}
                    <LabelList content={<CustomBarLabel />} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

        </Card>

        {/* ── Attendance Overview ─────────────────────────────────────────── */}
        <Card className="flex flex-col justify-between p-6 bg-card border border-border shadow-md">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-lg font-bold text-foreground tracking-tight mb-0.5">
                Attendance Overview
              </h3>
              <p className="text-xs text-muted-foreground">Weekly distribution of leaves, WFH, and present employees</p>
            </div>
            <select
              className="px-3 py-1.5 bg-muted text-foreground text-xs font-semibold rounded-xl border border-border hover:border-primary transition-all cursor-pointer outline-none shadow-sm"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as any)}
            >
              <option value="week">Today</option>
              <option value="today">Today Only</option>
            </select>
          </div>

          {/* Bar Chart */}
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={attendanceChartData}
                margin={{ top: 10, right: 5, left: -25, bottom: 5 }}
                barSize={12}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(val) => {
                    const tot = totalDeptEmployees || 1;
                    return `${Math.round((val / tot) * 100)}%`;
                  }}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, totalDeptEmployees || 1]}
                />
                <RechartsTooltip
                  content={<CustomAttendanceTooltip totalEmployees={totalDeptEmployees} />}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                {/* 3nd present (bottom) */}
                <Bar
                  dataKey="present"
                  name="Present"
                  stackId="a"
                  fill="#6366f1"
                  radius={[0, 0, 10, 10]}
                />
                {/* 2nd wfh (center) */}
                <Bar
                  dataKey="wfh"
                  name="WFH"
                  stackId="a"
                  fill="#ff9f43"
                  radius={[0, 0, 0, 0]}
                />
                {/* 1st leave (top) */}
                <Bar
                  dataKey="leave"
                  name="Leave"
                  stackId="a"
                  fill="#f43f5e"
                  radius={[10, 10, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
};

// --- Standalone Finance Management Chart ---
interface FinanceManagementChartProps {
  stats: any;
}

export const FinanceManagementChart: React.FC<FinanceManagementChartProps> = ({ stats }) => {
  const [selectedMonth, setSelectedMonth] = useState(stats?.financeData?.[0]?.month || '');
  if (!stats?.financeData?.length) {
    return (
      <Card className="flex flex-col justify-between p-6 bg-card h-full">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-foreground tracking-tight mb-0.5">Finance Management</h3>
          <p className="text-xs text-muted-foreground">Allocated budget per month</p>
        </div>
        <div className="flex h-64 items-center justify-center text-muted-foreground text-sm">
          No finance data available
        </div>
      </Card>
    );
  }

  const COLORS = ['hsl(var(--primary))', '#6366f1', '#10b981', '#f59e0b'];
  const currentAllocations = stats.financeData.find((d: any) => d.month === selectedMonth)?.allocations || [];

  return (
    <Card className="flex flex-col justify-between p-6 bg-card h-full">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground tracking-tight mb-0.5">Finance Management</h3>
          <p className="text-xs text-muted-foreground">Allocated budget per month</p>
        </div>
        <select
          className="px-2 py-1 bg-muted text-foreground text-xs font-medium rounded-lg border border-border"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        >
          {stats.financeData.map((d: any) => (
            <option key={d.month} value={d.month}>{d.month}</option>
          ))}
        </select>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={currentAllocations}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={85}
              label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
            >
              {currentAllocations.map((_: any, index: number) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <RechartsTooltip
              formatter={(val: any) => formatCurrency(Number(val))}
              contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};
