import React, { useState, useMemo } from 'react';
import { TableSkeleton } from '../Components/WrapperComponents/Skeleton';
import { useQuery } from '@tanstack/react-query';
import { attendanceApi } from '../api_service/attendanceApi';
import { employeeApi } from '../api_service/employeeApi';
import { analyticsApi } from '../api_service/analyticsApi';
import { useAuthStore } from '../store/useAuthStore';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
import { Input } from '../Components/WrapperComponents/Input';
import { TableWrapper } from '../Components/WrapperComponents/TableWrapper';
import type { Attendance } from '../types';
import { exportAttendanceExcel } from '../utils/exportUtils';
import { formatDate } from '../utils/formatters';
import { CalendarCheck, Download, Wifi, AlertTriangle, Clock, Users, Laptop, Sun, Info, CalendarRange } from 'lucide-react';
import { holidayCalendarApi } from '../api_service/holidayCalendarApi';

/** Mirrors PayrollPipeline.getCycleDates â€” computes start/end YYYY-MM-DD for the current cycle. */
function getCurrentCycleDates(startDay: number): { startStr: string; endStr: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed
  const day = now.getDate();

  if (startDay <= 1) {
    // Standard calendar month
    const lastDay = new Date(year, month, 0).getDate();
    return {
      startStr: `${year}-${String(month).padStart(2, '0')}-01`,
      endStr:   `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  // Mid-month cycle: e.g. startDay = 26 â†’ cycle runs from 26th of prev month to 25th of current month
  let cycleStartYear: number, cycleStartMonth: number;
  let cycleEndYear: number, cycleEndMonth: number, cycleEndDay: number;

  if (day >= startDay) {
    // We are in the second half: cycle started this month, ends next month on (startDay - 1)
    cycleStartYear  = year;
    cycleStartMonth = month;
    const nextMonthDate = new Date(year, month, 1); // first of next month
    cycleEndYear    = nextMonthDate.getFullYear();
    cycleEndMonth   = nextMonthDate.getMonth() + 1;
    cycleEndDay     = startDay - 1;
  } else {
    // We are in the first half: cycle started last month, ends this month on (startDay - 1)
    const prevMonthDate = new Date(year, month - 2, 1); // first of prev month
    cycleStartYear  = prevMonthDate.getFullYear();
    cycleStartMonth = prevMonthDate.getMonth() + 1;
    cycleEndYear    = year;
    cycleEndMonth   = month;
    cycleEndDay     = startDay - 1;
  }

  // Clamp start day to max days in that month
  const maxDaysStart = new Date(cycleStartYear, cycleStartMonth, 0).getDate();
  const clampedStart = Math.min(startDay, maxDaysStart);
  const maxDaysEnd   = new Date(cycleEndYear, cycleEndMonth, 0).getDate();
  const clampedEnd   = Math.min(cycleEndDay, maxDaysEnd);

  return {
    startStr: `${cycleStartYear}-${String(cycleStartMonth).padStart(2, '0')}-${String(clampedStart).padStart(2, '0')}`,
    endStr:   `${cycleEndYear}-${String(cycleEndMonth).padStart(2, '0')}-${String(clampedEnd).padStart(2, '0')}`,
  };
}

export const AttendancePage: React.FC = () => {
  const { role } = useAuthStore();

  const [nameFilter, setNameFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');



  const { data: attendances, isLoading: attLoading } = useQuery({
    queryKey: ['attendances'],
    queryFn: attendanceApi.getAll,
  });

  const currentYear = new Date().getFullYear();
  const { data: holidays = [] } = useQuery({
    queryKey: ['holidays', currentYear],
    queryFn: () => holidayCalendarApi.getAll(currentYear),
    staleTime: 10 * 60 * 1000,
  });

  // Fetch org settings to read salaryCycleStartDay (attendance cycle = salary cycle)
  const { data: orgSettings } = useQuery({
    queryKey: ['companySettings'],
    queryFn: analyticsApi.getSettings,
    staleTime: 5 * 60 * 1000,
  });

  // Compute current cycle dates once settings load
  const cycleDates = useMemo(() => {
    const startDay = orgSettings?.salaryCycleStartDay ?? 1;
    return getCurrentCycleDates(startDay);
  }, [orgSettings]);

  // Upcoming holidays this month
  const upcomingHolidays = (() => {
    const today = new Date().toISOString().split('T')[0];
    const yearMonth = today.slice(0, 7);
    return holidays
      .filter(h => h.date.startsWith(yearMonth) && h.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 4);
  })();

  const { data: employees, isLoading: empLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeeApi.getAll({ limit: 1000 }).then(res => res.employees),
  });

  const filteredAttendances = useMemo(() => {
    if (!attendances) return [];
    return attendances.filter((att) => {
      const empId = att.employeeId ? (typeof att.employeeId === 'object' ? att.employeeId._id : att.employeeId) : '';
      const emp = employees?.find((e) => e._id === empId);
      const empName = emp?.fullName || 'Logapriyan M';

      const matchName = empName.toLowerCase().includes(nameFilter.toLowerCase());

      // If a specific date filter is set, use it; otherwise filter by current salary/attendance cycle
      let matchDate: boolean;
      if (dateFilter) {
        matchDate = att.date === dateFilter;
      } else {
        matchDate = att.date >= cycleDates.startStr && att.date <= cycleDates.endStr;
      }

      return matchName && matchDate;
    });
  }, [attendances, employees, nameFilter, dateFilter, cycleDates]);

  // Summary stats (Admin/HR today)
  const stats = useMemo(() => {
    if (!filteredAttendances.length) return { present: 0, late: 0, wfh: 0, absent: 0 };
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = filteredAttendances.filter(a => a.date === today);
    return {
      present: todayRecords.filter(a => a.status === 'OFFICE' || a.status === 'WFH').length,
      late: todayRecords.filter(a => a.isLate).length,
      wfh: todayRecords.filter(a => a.status === 'WFH').length,
      absent: todayRecords.filter(a => a.status === 'LEAVE').length,
    };
  }, [filteredAttendances]);

  const columns = [
    {
      header: 'Employee',
      accessor: (row: Attendance) => {
        const emp = employees?.find((e) => e._id === (row.employeeId ? (typeof row.employeeId === 'object' ? row.employeeId._id : row.employeeId) : ''));
        const fullName = emp?.fullName || 'Logapriyan M';
        return (
          <div className="flex items-center gap-3">
            {emp?.profileImage ? (
              <img src={emp.profileImage} alt="" className="w-8 h-8 rounded-full object-cover border border-border flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0 uppercase">
                {fullName.charAt(0)}
              </div>
            )}
            <div>
              <p className="font-bold text-xs text-foreground">{fullName}</p>
              {emp?.employeeCode && !emp.employeeCode.startsWith('TEMP-EMP-') && (
                <p className="text-[10px] text-muted-foreground font-mono">({emp.employeeCode})</p>
              )}
            </div>
          </div>
        );
      },
    },
    { header: 'Date', accessor: (row: Attendance) => <span className="font-mono text-xs">{formatDate(row.date)}</span> },
    {
      header: 'Login Time',
      accessor: (row: Attendance) => <span className="font-mono text-xs">{new Date(row.loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>,
    },
    {
      header: 'Logout Time',
      accessor: (row: Attendance) => (
        <span className="font-mono text-xs">
          {row.status === 'LEAVE' ? '-' : row.logoutTime ? new Date(row.logoutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'In Progress'}
        </span>
      ),
    },
    {
      header: 'Status / Type',
      accessor: (row: Attendance) => (
        <div className="flex items-center gap-1.5">
          <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${
            row.status === 'OFFICE' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-foreground/10 text-foreground border-border'
          }`}>
            {row.status}
          </span>
          {row.isLate && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700">
              LATE
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'IP / Network Info',
      accessor: (row: Attendance) => (
        <div className="text-xs">
          <span className="font-mono text-foreground flex items-center gap-1">
            <Wifi className={`w-3.5 h-3.5 ${row.locationVerified ? 'text-primary' : 'text-muted-foreground'}`} /> {row.ipAddress}
          </span>
          <span className="text-[10px] text-muted-foreground block mt-0.5">{row.deviceInfo}</span>
          {row.overrideReason && <span className="text-[10px] text-primary block italic">Override: {row.overrideReason}</span>}
        </div>
      ),
    },
    {
      header: 'Working Hours',
      accessor: (row: Attendance) => (
        <span className="text-xs font-mono font-bold text-primary">
          {row.status === 'LEAVE' ? '-' : row.workingHours ? `${row.workingHours} hrs` : 'Calculating...'}
        </span>
      ),
    },
  ];

  if (attLoading || empLoading) {
    return <TableSkeleton />;
  }

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-primary" />
            Attendance Management
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitor daily check-ins, IP network compliance, and automatic working hour calculations
          </p>
          {/* Cycle period badge â€” synced with salary cycle */}
          <div className="flex items-center gap-1.5 mt-2">
            <CalendarRange className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary">
              Current Cycle:&nbsp;
            </span>
            <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
              {formatDate(cycleDates.startStr)} - {formatDate(cycleDates.endStr)}
            </span>
            {orgSettings?.salaryCycleStartDay && orgSettings.salaryCycleStartDay > 1 && (
              <span className="text-[10px] text-muted-foreground">
                (starts {orgSettings.salaryCycleStartDay}{['st','nd','rd'][((orgSettings.salaryCycleStartDay % 10) - 1)] || 'th'} of each month)
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <Button
            onClick={() => exportAttendanceExcel(filteredAttendances)}
            className="bg-foreground text-background hover:bg-foreground/90 font-bold tracking-wider shadow-lg flex-shrink-0"
          >
            <Download className="w-4 h-4 mr-2" />
            EXPORT EXCEL
          </Button>
        </div>
      </div>

      {/* â”€â”€ Upcoming Holidays Banner â”€â”€ */}
      {upcomingHolidays.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-emerald-500/8 border border-emerald-200/50 dark:border-emerald-800/40">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Upcoming Holidays
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {upcomingHolidays.map(h => (
              <span
                key={h._id}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                  h.isRestricted
                    ? 'bg-orange-500/10 text-orange-700 border-orange-300 dark:text-orange-400 dark:border-orange-700/50'
                    : 'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700/50'
                }`}
              >
                <Sun className="w-3 h-3" />
                {h.name}
                <span className="font-mono text-[10px] opacity-70">{formatDate(h.date)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Summary Stats (Admin/HR today) */}
      {(role === 'ADMIN' || role === 'HR') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              label: 'Present Today',
              value: stats.present,
              icon: <Users className="w-7 h-7" />,
              borderClass: 'border-l-primary',
              iconClass: 'bg-primary/10 text-primary',
              subText: 'Active check-ins'
            },
            {
              label: 'Late Today',
              value: stats.late,
              icon: <AlertTriangle className="w-7 h-7" />,
              borderClass: 'border-l-amber-500',
              iconClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
              subText: 'Late arrivals today'
            },
            {
              label: 'WFH Today',
              value: stats.wfh,
              icon: <Laptop className="w-7 h-7" />,
              borderClass: 'border-l-purple-500',
              iconClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-500',
              subText: 'Working from home'
            },
            {
              label: 'On Leave',
              value: stats.absent,
              icon: <Clock className="w-7 h-7" />,
              borderClass: 'border-l-rose-500',
              iconClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-500',
              subText: 'Approved leaves today'
            },
          ].map((stat) => (
            <Card key={stat.label} className={`border-l-4 ${stat.borderClass} flex items-center justify-between p-6 hover:shadow-md transition-shadow bg-card`}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  {stat.label}
                </p>
                <h3 className="text-3xl font-extrabold text-foreground">{stat.value}</h3>
                <p className="text-xs text-muted-foreground font-medium mt-2">
                  {stat.subText}
                </p>
              </div>
              <div className={`p-4 rounded-2xl ${stat.iconClass}`}>
                {stat.icon}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="border-l-4 border-l-primary shadow-md p-6 space-y-6">
        {/* Advanced Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-muted/30 p-4 rounded-xl border border-border">
          <div className="flex-1 w-full">
            <Input
              placeholder="Search attendance by employee name..."
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-64 flex gap-2 items-center">
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter('')}
                className="text-xs text-muted-foreground hover:text-foreground underline whitespace-nowrap"
                title="Reset to current cycle"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        <TableWrapper
          columns={columns}
          data={filteredAttendances}
        />
      </Card>

    </div>
  );
};
