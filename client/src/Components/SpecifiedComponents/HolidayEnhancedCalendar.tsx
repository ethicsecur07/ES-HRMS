import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { holidayCalendarApi } from '../../api_service/holidayCalendarApi';
import { analyticsApi } from '../../api_service/analyticsApi';
import { Card } from '../WrapperComponents/Card';
import { Button } from '../WrapperComponents/Button';
import type { LeaveRequest, PermissionRequest } from '../../types';
import { formatDate } from '../../utils/formatters';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Palmtree,
  Laptop,
  Clock,
  Sun,
  Info,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface WFHRequest {
  _id: string;
  employeeId: string | any;
  startDate: string;
  endDate: string;
  reason?: string;
  expectedTasks?: string;
  status: string;
}

interface HolidayEnhancedCalendarProps {
  leaves?: LeaveRequest[];
  wfh?: WFHRequest[];
  perms?: PermissionRequest[];
  onDateSelect?: (dateStr: string) => void;
  compact?: boolean; // if true, hides the detail panel (for dashboard use)
  className?: string;
}

// ─── Month names ───────────────────────────────────────────────────────────────
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ─── Status badge helper ───────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    APPROVED: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400',
    REJECTED:  'bg-rose-500/15 text-rose-700 border-rose-500/30 dark:text-rose-400',
    PENDING:   'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400',
    CANCELLED: 'bg-muted text-muted-foreground border-border',
  };
  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${map[status] ?? map.PENDING}`}>
      {status}
    </span>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
export const HolidayEnhancedCalendar: React.FC<HolidayEnhancedCalendarProps> = ({
  leaves = [],
  wfh = [],
  perms = [],
  onDateSelect,
  compact = false,
  className = '',
}) => {
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const year  = calendarDate.getFullYear();
  const month = calendarDate.getMonth();

  // ── Fetch holidays for current year ────────────────────────────────────────
  const { data: holidays = [] } = useQuery({
    queryKey: ['holidays', year],
    queryFn: () => holidayCalendarApi.getAll(year),
    staleTime: 10 * 60 * 1000,
  });

  // ── Fetch company settings for active workdays ─────────────────────────────
  const { data: settings } = useQuery({
    queryKey: ['companySettings'],
    queryFn: analyticsApi.getSettings,
    staleTime: 10 * 60 * 1000,
  });

  const activeWorkdays = settings?.activeWorkdays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  // ── Build holiday map { dateStr → holiday } ─────────────────────────────────
  const holidayMap = useMemo(() => {
    const map: Record<string, { name: string; isRestricted: boolean }> = {};
    holidays.forEach(h => { map[h.date] = { name: h.name, isRestricted: h.isRestricted }; });
    return map;
  }, [holidays]);

  // ── Build calendar cells ────────────────────────────────────────────────────
  const calendarCells = useMemo(() => {
    const firstDayIndex  = new Date(year, month, 1).getDay();
    const totalDays      = new Date(year, month + 1, 0).getDate();
    const prevTotalDays  = new Date(year, month, 0).getDate();
    const cells: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // prev month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevTotalDays - i;
      const m = month === 0 ? 11 : month - 1;
      const y = month === 0 ? year - 1 : year;
      cells.push({ dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, dayNum: d, isCurrentMonth: false });
    }

    // current month
    for (let day = 1; day <= totalDays; day++) {
      cells.push({
        dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        dayNum: day,
        isCurrentMonth: true,
      });
    }

    // next month padding (fill to 42 cells = 6 rows)
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const m = month === 11 ? 0  : month + 1;
      const y = month === 11 ? year + 1 : year;
      cells.push({ dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`, dayNum: i, isCurrentMonth: false });
    }

    return cells;
  }, [year, month]);

  // ── Events for a given date ─────────────────────────────────────────────────
  const getEventsForDate = (dateStr: string) => {
    const dayLeaves = leaves.filter(l => dateStr >= l.startDate && dateStr <= l.endDate);
    const dayWfh    = wfh.filter(w => dateStr >= w.startDate && dateStr <= w.endDate);
    const dayPerms  = perms.filter(p => p.date === dateStr);
    const holiday   = holidayMap[dateStr];
    return { leaves: dayLeaves, wfh: dayWfh, perms: dayPerms, holiday };
  };

  const selectedEvents = useMemo(() => getEventsForDate(selectedDate), [selectedDate, leaves, wfh, perms, holidayMap]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const todayStr = new Date().toISOString().split('T')[0];

  const handleSelect = (dateStr: string) => {
    setSelectedDate(dateStr);
    onDateSelect?.(dateStr);
  };

  const handlePrev = () => setCalendarDate(new Date(year, month - 1, 1));
  const handleNext = () => setCalendarDate(new Date(year, month + 1, 1));

  // ── Cell background class ───────────────────────────────────────────────────
  const getCellBg = (cell: { dateStr: string; isCurrentMonth: boolean }, colIndex: number) => {
    if (!cell.isCurrentMonth) return 'opacity-20 pointer-events-none';

    const h = holidayMap[cell.dateStr];
    const isWeekend = !activeWorkdays.includes(DAY_LABELS[colIndex]);

    if (h && !h.isRestricted) return 'bg-emerald-500/10 border-emerald-400/30 dark:bg-emerald-900/20';
    if (h &&  h.isRestricted) return 'bg-orange-500/10 border-orange-400/30 dark:bg-orange-900/20';
    if (isWeekend)             return 'bg-muted/40 border-border/50';
    return 'bg-background hover:bg-muted/50 border-border';
  };

  // ── Upcoming holidays this month (for legend section) ──────────────────────
  const upcomingHolidays = useMemo(() => {
    return holidays
      .filter(h => h.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [holidays, year, month]);

  return (
    <div className={`space-y-4 ${className}`}>
      <Card className="p-5 bg-card shadow-md border border-border">
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
          <div>
            <h4 className="font-extrabold text-base text-foreground">
              {MONTH_NAMES[month]} {year}
            </h4>
            {upcomingHolidays.length > 0 && (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                {upcomingHolidays.length} holiday{upcomingHolidays.length > 1 ? 's' : ''} this month
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={handlePrev} className="h-8 w-8 p-0">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCalendarDate(new Date())} className="h-8 px-2 text-xs font-bold">
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={handleNext} className="h-8 w-8 p-0">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* ── Day labels ── */}
        <div className="grid grid-cols-7 text-center mb-1">
          {DAY_LABELS.map((d, i) => (
            <div
              key={d}
              className={`text-[10px] font-bold uppercase tracking-wider py-1 ${
                !activeWorkdays.includes(d) ? 'text-rose-400 dark:text-rose-500' : 'text-muted-foreground'
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* ── Days grid ── */}
        <div className="grid grid-cols-7 gap-1">
          {calendarCells.map((cell, idx) => {
            const colIndex = idx % 7;
            const events   = getEventsForDate(cell.dateStr);
            const isSelected = cell.dateStr === selectedDate;
            const isToday    = cell.dateStr === todayStr;
            const isWeekend  = !activeWorkdays.includes(DAY_LABELS[colIndex]);
            const holiday    = holidayMap[cell.dateStr];

            return (
              <button
                key={idx}
                onClick={() => handleSelect(cell.dateStr)}
                disabled={!cell.isCurrentMonth}
                className={`
                  relative flex flex-col items-center justify-start pt-1 pb-1 px-0.5
                  rounded-xl border transition-all duration-150 text-xs min-h-[48px]
                  ${getCellBg(cell, colIndex)}
                  ${isSelected ? 'ring-2 ring-primary border-primary' : ''}
                  ${isToday && !isSelected ? 'ring-1 ring-primary/50' : ''}
                  ${!cell.isCurrentMonth ? 'opacity-25 cursor-default' : 'cursor-pointer'}
                `}
              >
                {/* Day number */}
                <span className={`
                  text-[11px] font-bold leading-none mb-0.5
                  ${isToday ? 'bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px]' : ''}
                  ${holiday && !isToday ? 'text-emerald-700 dark:text-emerald-400' : ''}
                  ${isWeekend && !holiday && !isToday ? 'text-rose-400 dark:text-rose-500' : ''}
                  ${!holiday && !isWeekend && !isToday ? 'text-foreground' : ''}
                `}>
                  {cell.dayNum}
                </span>

                {/* Event dots */}
                <div className="flex flex-wrap justify-center gap-0.5 mt-auto">
                  {events.leaves.length > 0 && (
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500 flex-shrink-0" title="Leave" />
                  )}
                  {events.wfh.length > 0 && (
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 flex-shrink-0" title="WFH" />
                  )}
                  {events.perms.length > 0 && (
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" title="Permission" />
                  )}
                  {holiday && (
                    <span
                      className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                        holiday.isRestricted ? 'bg-orange-500' : 'bg-emerald-500'
                      }`}
                      title={holiday.name}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Legend ── */}
        <div className="mt-4 pt-3 border-t border-border flex flex-wrap gap-x-4 gap-y-1.5">
          {[
            { color: 'bg-rose-500',   label: 'Leave' },
            { color: 'bg-blue-500',   label: 'WFH' },
            { color: 'bg-amber-500',  label: 'Permission' },
            { color: 'bg-emerald-500',label: 'Public Holiday' },
            { color: 'bg-orange-500', label: 'Restricted Holiday' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
              <span className={`h-2 w-2 rounded-full ${color} flex-shrink-0`} />
              {label}
            </span>
          ))}
        </div>
      </Card>

      {/* ── Selected date detail panel ── */}
      {!compact && (
        <Card className="p-4 bg-muted/30 border border-border space-y-3">
          <h5 className="text-xs font-extrabold text-foreground uppercase tracking-wider flex items-center gap-1.5 border-b border-border/60 pb-2">
            <Calendar className="w-3.5 h-3.5 text-primary" />
            {formatDate(selectedDate)}
            {holidayMap[selectedDate] && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                holidayMap[selectedDate].isRestricted
                  ? 'bg-orange-500/10 text-orange-700 border-orange-300 dark:text-orange-400'
                  : 'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-400'
              }`}>
                {holidayMap[selectedDate].isRestricted ? '🔶' : '🟢'} {holidayMap[selectedDate].name}
              </span>
            )}
          </h5>

          {selectedEvents.leaves.length === 0 && selectedEvents.wfh.length === 0 && selectedEvents.perms.length === 0 && !selectedEvents.holiday ? (
            <p className="text-xs text-muted-foreground italic py-1">No events scheduled on this date.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {/* Holiday banner */}
              {selectedEvents.holiday && (
                <div className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs ${
                  selectedEvents.holiday.isRestricted
                    ? 'bg-orange-500/8 border-orange-300/40 dark:border-orange-700/40'
                    : 'bg-emerald-500/8 border-emerald-300/40 dark:border-emerald-700/40'
                }`}>
                  <Sun className={`w-4 h-4 flex-shrink-0 ${selectedEvents.holiday.isRestricted ? 'text-orange-500' : 'text-emerald-500'}`} />
                  <div>
                    <span className={`font-bold ${selectedEvents.holiday.isRestricted ? 'text-orange-700 dark:text-orange-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                      {selectedEvents.holiday.name}
                    </span>
                    <span className="text-muted-foreground block text-[10px]">
                      {selectedEvents.holiday.isRestricted ? 'Restricted / Optional Holiday' : 'Public Holiday — Office Closed'}
                    </span>
                  </div>
                </div>
              )}

              {/* Leave events */}
              {selectedEvents.leaves.map(l => {
                const empObj = typeof l.employeeId === 'object' ? l.employeeId : null;
                return (
                  <div key={l._id} className="flex items-center justify-between bg-card p-2.5 rounded-lg border border-border text-xs gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Palmtree className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="font-bold text-rose-600 dark:text-rose-400 block truncate">{l.leaveType}</span>
                        {empObj && <span className="text-muted-foreground text-[10px]">{empObj.fullName}</span>}
                        <span className="text-muted-foreground block text-[10px] truncate">{l.reason}</span>
                      </div>
                    </div>
                    <StatusBadge status={l.status} />
                  </div>
                );
              })}

              {/* WFH events */}
              {selectedEvents.wfh.map(w => {
                const empObj = typeof w.employeeId === 'object' ? w.employeeId : null;
                return (
                  <div key={w._id} className="flex items-center justify-between bg-card p-2.5 rounded-lg border border-border text-xs gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Laptop className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="font-bold text-blue-600 dark:text-blue-400 block">Work From Home</span>
                        {empObj && <span className="text-muted-foreground text-[10px]">{empObj.fullName}</span>}
                        <span className="text-muted-foreground block text-[10px] truncate">Tasks: {w.expectedTasks || 'General Work'}</span>
                      </div>
                    </div>
                    <StatusBadge status={w.status} />
                  </div>
                );
              })}

              {/* Permission events */}
              {selectedEvents.perms.map(p => {
                const empObj = typeof p.employeeId === 'object' ? p.employeeId : null;
                return (
                  <div key={p._id} className="flex items-center justify-between bg-card p-2.5 rounded-lg border border-border text-xs gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="font-bold text-amber-600 dark:text-amber-400 block">Permission Slot</span>
                        {empObj && <span className="text-muted-foreground text-[10px]">{empObj.fullName}</span>}
                        <span className="text-muted-foreground block text-[10px]">{p.startTime} → {p.endTime} ({p.totalHours} hrs)</span>
                      </div>
                    </div>
                    <StatusBadge status={p.approvalStatus} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* ── Upcoming holidays list for this month ── */}
      {!compact && upcomingHolidays.length > 0 && (
        <Card className="p-4 border border-emerald-200/50 dark:border-emerald-800/30 bg-emerald-500/5">
          <h5 className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
            <Info className="w-3.5 h-3.5" />
            Holidays in {MONTH_NAMES[month]}
          </h5>
          <div className="space-y-2">
            {upcomingHolidays.map(h => (
              <div key={h._id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full flex-shrink-0 ${h.isRestricted ? 'bg-orange-500' : 'bg-emerald-500'}`} />
                  <span className="font-semibold text-foreground">{h.name}</span>
                </div>
                <span className="font-mono text-muted-foreground text-[10px]">{formatDate(h.date)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
