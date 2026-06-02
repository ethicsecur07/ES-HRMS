import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { taskApi } from '../../api_service/taskApi';
import { useAuthStore } from '../../store/useAuthStore';
import { Card } from '../WrapperComponents/Card';
import { Button } from '../WrapperComponents/Button';
import { formatDate } from '../../utils/formatters';
import type { TaskReport } from '../../types';
import {
  CheckCircle2,
  Loader2,
  Clock,
  AlertCircle,
  ChevronUp,
  CalendarDays,
  ArrowRight,
  ClipboardList,
  TrendingUp,
} from 'lucide-react';
import { IoIosArrowDropdown } from 'react-icons/io';

// ─── Stat Card ─────────────────────────────────────────────────────────────────
const StatPill: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
  bg: string;
}> = ({ icon, label, value, color, bg }) => (
  <div className={`flex items-center gap-3 p-4 rounded-2xl border ${bg} flex-1 min-w-0`}>
    <div className={`p-2.5 rounded-xl ${color} flex-shrink-0`}>{icon}</div>
    <div className="min-w-0">
      <p className="text-2xl font-black text-foreground leading-none">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5 truncate">{label}</p>
    </div>
  </div>
);

// ─── Expandable Report Row ─────────────────────────────────────────────────────
const ReportRow: React.FC<{ report: TaskReport }> = ({ report }) => {
  const [expanded, setExpanded] = useState(false);

  const hasBlockers = report.blockers && report.blockers.toLowerCase() !== 'none';

  return (
    <div className="border border-border rounded-xl overflow-hidden transition-all duration-200 hover:border-primary/30">
      {/* Summary row */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-4 p-3 text-left hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <CalendarDays className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <span className="font-mono text-[11px] font-bold text-muted-foreground flex-shrink-0">
            {formatDate(report.date)}
          </span>
          <span className="text-xs text-foreground font-medium truncate">
            {report.completedTasks || '—'}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasBlockers && (
            <span className="px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-bold border border-rose-200 dark:border-rose-800">
              Blocker
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <IoIosArrowDropdown className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border bg-muted/20 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs animate-in fade-in duration-150">
          {[
            { label: 'Completed Tasks', value: report.completedTasks, icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> },
            { label: 'In Progress',     value: report.inProgressTasks || 'None', icon: <Loader2 className="w-3.5 h-3.5 text-blue-500" /> },
            { label: 'Pending Tasks',   value: report.pendingTasks || 'None',    icon: <Clock className="w-3.5 h-3.5 text-amber-500" /> },
            { label: "Tomorrow's Plan", value: report.tomorrowPlan || 'None',    icon: <TrendingUp className="w-3.5 h-3.5 text-primary" /> },
          ].map(({ label, value, icon }) => (
            <div key={label} className="space-y-1">
              <span className="flex items-center gap-1 font-bold uppercase tracking-wider text-[10px] text-muted-foreground">
                {icon} {label}
              </span>
              <div className="p-2.5 rounded-lg bg-background border border-border text-foreground leading-relaxed whitespace-pre-wrap min-h-[40px]">
                {value}
              </div>
            </div>
          ))}

          {hasBlockers && (
            <div className="sm:col-span-2 space-y-1">
              <span className="flex items-center gap-1 font-bold uppercase tracking-wider text-[10px] text-rose-600 dark:text-rose-400">
                <AlertCircle className="w-3.5 h-3.5" /> Issues / Blockers
              </span>
              <div className="p-2.5 rounded-lg bg-rose-500/5 border border-rose-200 dark:border-rose-800 text-foreground leading-relaxed whitespace-pre-wrap font-semibold">
                {report.blockers}
              </div>
            </div>
          )}

          <div className="sm:col-span-2 text-[10px] text-muted-foreground text-right font-mono">
            Submitted at {new Date(report.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
export const EmployeeTaskSummary: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['myTasks', user?.employeeId || user?._id],
    queryFn: () => taskApi.getByEmployee(user?.employeeId || user?._id || ''),
    enabled: !!(user?.employeeId || user?._id),
  });

  // ── Sort descending by date ────────────────────────────────────────────────
  const sortedReports = useMemo(
    () => [...reports].sort((a, b) => b.date.localeCompare(a.date)),
    [reports]
  );

  const latest = sortedReports[0];

  // ── Count tasks across all reports (simple heuristic: if field is not empty/none it counts) ──
  const stats = useMemo(() => {
    const countNonEmpty = (field: string) =>
      field && field.toLowerCase() !== 'none' && field.trim() !== '' ? 1 : 0;

    let completed = 0, inProgress = 0, pending = 0;
    sortedReports.forEach(r => {
      completed  += countNonEmpty(r.completedTasks);
      inProgress += countNonEmpty(r.inProgressTasks);
      pending    += countNonEmpty(r.pendingTasks);
    });

    return {
      completed,
      inProgress,
      pending,
      total: sortedReports.length,
    };
  }, [sortedReports]);

  if (isLoading) {
    return (
      <Card className="animate-pulse h-48 bg-muted/20 border-l-4 border-l-primary">
        <div />
      </Card>
    );
  }

  return (
    <Card className="border-l-4 border-l-primary shadow-md space-y-5 h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            My Work Summary
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {stats.total > 0
              ? `${stats.total} task report${stats.total > 1 ? 's' : ''} submitted — latest on ${formatDate(latest?.date)}`
              : 'No task reports submitted yet'}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate('/task-reports')}
          className="flex-shrink-0 text-xs font-bold"
        >
          View All <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
      {/* Latest report quick view */}
      {latest && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> Latest Report — {formatDate(latest.date)}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {[
              { label: 'Completed', value: latest.completedTasks, color: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'In Progress', value: latest.inProgressTasks || 'None', color: 'text-blue-600 dark:text-blue-400' },
              { label: 'Pending', value: latest.pendingTasks || 'None', color: 'text-amber-600 dark:text-amber-400' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <p className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${color}`}>{label}</p>
                <p className="text-foreground font-medium leading-snug line-clamp-2">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Report history list */}
      {sortedReports.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1.5">
            All Reports ({sortedReports.length})
          </p>
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {sortedReports.map(report => (
              <ReportRow key={report._id} report={report} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
          <ClipboardList className="w-10 h-10 opacity-20" />
          <p className="text-sm font-semibold">No task reports yet</p>
          <p className="text-xs">Submit your daily report at check-out to see history here.</p>
        </div>
      )}
    </Card>
  );
};
