import React, { useState, useEffect } from 'react';
import {
  TrendingUp, Calendar, AlertCircle, Users,
  CheckCircle2, Circle, Loader2, Flag
} from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';
import { projectApi } from '../../api_service/projectApi';

interface ProjectAnalyticsDashboardProps {
  projectId: string;
}

export const ProjectAnalyticsDashboard: React.FC<ProjectAnalyticsDashboardProps> = ({ projectId }) => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [workload, setWorkload] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      setLoading(true);
      setError('');
      try {
        const [analyticsRes, workloadRes] = await Promise.all([
          projectApi.getProjectAnalytics(projectId),
          projectApi.getTeamWorkload(projectId)
        ]);
        setAnalytics(analyticsRes.analytics || null);
        setWorkload(workloadRes.workload || []);
      } catch (err: any) {
        console.error(err);
        setError(err.response?.data?.message || 'Failed to load project analytics.');
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      fetchAnalyticsData();
    }
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-sm font-semibold">Generating real-time analytics report...</p>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center text-red-400 mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-white font-bold text-base mb-1">Analytics Unavailable</h3>
        <p className="text-slate-400 text-sm max-w-md">{error || 'Could not fetch project data.'}</p>
      </div>
    );
  }

  const {
    completionRate,
    totalTasks,
    completedTasks,
    todoTasks,
    inProgressTasks,
    reviewTasks,
    overdueCount,
    overdueTasks,
    sprintProgress
  } = analytics;

  // Task Status distribution for PieChart
  const statusData = [
    { name: 'To Do', value: todoTasks, color: '#64748b' },
    { name: 'In Progress', value: inProgressTasks, color: '#3b82f6' },
    { name: 'In Review', value: reviewTasks, color: '#a855f7' },
    { name: 'Completed', value: completedTasks, color: '#10b981' }
  ].filter(item => item.value > 0);

  // Fallback if no tasks
  const hasTasks = totalTasks > 0;

  // Workload data for BarChart
  const workloadData = workload.map(item => ({
    name: item.employeeName,
    'To Do': item.TODO,
    'In Progress': item.IN_PROGRESS,
    'In Review': item.REVIEW,
    'Completed': item.COMPLETED,
  }));

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* ── METRICS OVERVIEW CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Completion Rate */}
        <div className="bg-[#151821] border border-white/5 rounded-2xl p-5 hover:border-indigo-500/20 transition-all group duration-300">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Completion Rate</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight">{completionRate}%</span>
            <span className="text-xs text-indigo-400 font-bold">tasks done</span>
          </div>
          <div className="w-full h-1.5 bg-white/5 rounded-full mt-4 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-1000 group-hover:brightness-110"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>

        {/* Total Tasks */}
        <div className="bg-[#151821] border border-white/5 rounded-2xl p-5 hover:border-blue-500/20 transition-all group duration-300">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Tasks</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight">{totalTasks}</span>
            <span className="text-xs text-slate-500 font-medium">registered tasks</span>
          </div>
          <div className="flex gap-3 text-[10px] text-slate-400 mt-5 font-semibold">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" /> {inProgressTasks} doing</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#a855f7]" /> {reviewTasks} review</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" /> {completedTasks} done</span>
          </div>
        </div>

        {/* Overdue Alert */}
        <div className="bg-[#151821] border border-white/5 rounded-2xl p-5 hover:border-red-500/20 transition-all group duration-300">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Overdue Tasks</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-colors ${overdueCount > 0 ? 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-extrabold tracking-tight ${overdueCount > 0 ? 'text-red-400' : 'text-white'}`}>{overdueCount}</span>
            <span className="text-xs text-slate-500 font-medium">missed deadline</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-5 leading-normal font-medium">
            {overdueCount > 0 ? 'Requires immediate supervisor / lead attention.' : 'All tasks currently on track.'}
          </p>
        </div>

        {/* Active Sprints */}
        <div className="bg-[#151821] border border-white/5 rounded-2xl p-5 hover:border-purple-500/20 transition-all group duration-300">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sprints</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight">{sprintProgress.length}</span>
            <span className="text-xs text-slate-500 font-medium">sprints logged</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-5 leading-normal font-medium">
            Sprint iteration cycles tracked for this project board.
          </p>
        </div>
      </div>

      {/* ── CHARTS SECTION ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Task Status Distribution (PieChart) */}
        <div className="lg:col-span-1 bg-[#151821] border border-white/5 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white mb-1">Task Status Breakdown</h3>
            <p className="text-xs text-slate-400">Current allocation of tasks per board column</p>
          </div>
          <div className="h-60 mt-4 relative flex items-center justify-center">
            {hasTasks && statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f1117', borderColor: '#1f2937', borderRadius: '12px' }}
                    itemStyle={{ color: '#fff', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                <Circle className="w-8 h-8 text-slate-600" />
                No tasks available to graph.
              </div>
            )}
            {hasTasks && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-extrabold text-white">{totalTasks}</span>
                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Total Tasks</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {statusData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-[#0c0e14] px-3 py-1.5 rounded-xl border border-white/5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[11px] text-slate-300 font-semibold truncate">{item.name} ({item.value})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Team Workload (BarChart) */}
        <div className="lg:col-span-2 bg-[#151821] border border-white/5 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white mb-1">Employee Workload</h3>
            <p className="text-xs text-slate-400">Total active task counts distributed among project members</p>
          </div>
          <div className="h-64 mt-6">
            {workloadData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workloadData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f1117', borderColor: '#1f2937', borderRadius: '12px' }}
                    itemStyle={{ fontSize: '11px' }}
                  />
                  <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                  <Bar dataKey="To Do" stackId="a" fill="#64748b" />
                  <Bar dataKey="In Progress" stackId="a" fill="#3b82f6" />
                  <Bar dataKey="In Review" stackId="a" fill="#a855f7" />
                  <Bar dataKey="Completed" stackId="a" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-500 text-xs gap-2">
                <Users className="w-5 h-5" /> No team member workloads loaded.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── LOWER DETAIL PANEL: SPRINT TRACKING & OVERDUE LIST ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sprint Iteration Progression */}
        <div className="bg-[#151821] border border-white/5 rounded-2xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white mb-1">Sprint Performance</h3>
            <p className="text-xs text-slate-400">Task completion percentage across all sprint cycles</p>
          </div>
          <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
            {sprintProgress.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs">No sprint progress logged yet.</div>
            ) : (
              sprintProgress.map((s: any) => (
                <div key={s._id} className="bg-[#0c0e14] border border-white/5 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xs font-bold text-white mb-0.5">{s.name}</h4>
                      <p className="text-[10px] text-slate-500 font-medium">
                        {new Date(s.startDate).toLocaleDateString()} — {new Date(s.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${s.status === 'ACTIVE' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 animate-pulse' : s.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-500/10 text-slate-400 border-slate-500/30'}`}>
                      {s.status}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                      <span>{s.completedTasks} / {s.totalTasks} tasks complete</span>
                      <span className="text-indigo-400">{s.completionRate}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${s.completionRate}%` }} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Real-time Overdue Tasks List */}
        <div className="bg-[#151821] border border-white/5 rounded-2xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white mb-1">Overdue Action Center</h3>
            <p className="text-xs text-slate-400">Immediate action items that have missed their due date</p>
          </div>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {overdueTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500 text-xs gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500/40" />
                <p className="font-semibold text-slate-400">Excellent! All tasks are current.</p>
                <p className="text-[10px] text-slate-600">Zero tasks require overdue escalation.</p>
              </div>
            ) : (
              overdueTasks.map((t: any) => (
                <div key={t._id} className="flex items-center justify-between bg-[#0c0e14] border border-red-500/10 rounded-xl p-3 hover:border-red-500/20 transition-all">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 flex-shrink-0 mt-0.5">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-200 truncate pr-2">{t.title}</h4>
                      <p className="text-[10px] text-slate-500 font-semibold flex items-center gap-1.5 mt-0.5">
                        <Flag className="w-3 h-3 text-orange-400" /> {t.priority} Priority · Status: {t.status}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-[10px] text-red-400 font-bold bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20 inline-block">
                      Due {new Date(t.dueDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
