import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceApi } from '../api_service/attendanceApi';
import { employeeApi } from '../api_service/employeeApi';
import { axiosInstance } from '../api_service/axiosInstance';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
import { Input, Select } from '../Components/WrapperComponents/Input';
import { TableWrapper } from '../Components/WrapperComponents/TableWrapper';
import { Modal } from '../Components/WrapperComponents/Modal';
import type { Attendance } from '../types';
import { exportAttendanceExcel } from '../utils/exportUtils';
import { formatDate } from '../utils/formatters';
import { CalendarCheck, Download, Wifi, Edit, AlertTriangle, Clock, Users, Laptop, Sun, Info } from 'lucide-react';
import { holidayCalendarApi } from '../api_service/holidayCalendarApi';

export const AttendancePage: React.FC = () => {
  const { role } = useAuthStore();
  const { addToast } = useNotificationStore();
  const queryClient = useQueryClient();

  const [nameFilter, setNameFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Editing State
  const [editingAttendance, setEditingAttendance] = useState<Attendance | null>(null);
  const [loginTimeInput, setLoginTimeInput] = useState('');
  const [logoutTimeInput, setLogoutTimeInput] = useState('');
  const [statusInput, setStatusInput] = useState<Attendance['status']>('OFFICE');

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
    queryFn: () => employeeApi.getAll().then(res => res.employees),
  });

  const filteredAttendances = useMemo(() => {
    if (!attendances) return [];
    return attendances.filter((att) => {
      const empId = att.employeeId ? (typeof att.employeeId === 'object' ? att.employeeId._id : att.employeeId) : '';
      const emp = employees?.find((e) => e._id === empId);
      const empName = emp?.fullName || 'Logapriyan M';

      const matchName = empName.toLowerCase().includes(nameFilter.toLowerCase());
      const matchDate = !dateFilter || att.date === dateFilter;

      return matchName && matchDate;
    });
  }, [attendances, employees, nameFilter, dateFilter]);

  const formatDt = (dtStr?: string) => {
    if (!dtStr) return '';
    try {
      const d = new Date(dtStr);
      const tzoffset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - tzoffset).toISOString().slice(0, 16);
    } catch {
      return '';
    }
  };

  const handleEditClick = (row: Attendance) => {
    setEditingAttendance(row);
    setLoginTimeInput(formatDt(row.loginTime));
    setLogoutTimeInput(row.logoutTime ? formatDt(row.logoutTime) : '');
    setStatusInput(row.status);
  };

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; loginTime?: string; logoutTime?: string; status?: string }) =>
      attendanceApi.update(data.id, { loginTime: data.loginTime, logoutTime: data.logoutTime, status: data.status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendances'] });
      addToast('Attendance Updated', 'Timestamps and status updated successfully.', 'success');
      setEditingAttendance(null);
    },
    onError: (err: any) => {
      addToast('Update Failed', err.message || 'Could not update attendance.', 'error');
    },
  });

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAttendance) return;
    updateMutation.mutate({
      id: editingAttendance._id,
      loginTime: loginTimeInput ? new Date(loginTimeInput).toISOString() : undefined,
      logoutTime: logoutTimeInput ? new Date(logoutTimeInput).toISOString() : undefined,
      status: statusInput,
    });
  };

  // Overtime approval mutation (Admin/HR only)
  const approvOvertimeMutation = useMutation({
    mutationFn: async (attendanceId: string) => {
      await axiosInstance.post(`/attendance/overtime/approve/${attendanceId}`, { approved: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendances'] });
      addToast('Overtime Approved', 'Overtime hours approved successfully.', 'success');
    },
    onError: (err: any) => {
      addToast('Error', err.response?.data?.message || 'Could not approve overtime.', 'error');
    },
  });

  // Summary stats (Admin/HR)
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
          {row.logoutTime ? new Date(row.logoutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'In Progress'}
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
          {row.workingHours ? `${row.workingHours} hrs` : 'Calculating...'}
        </span>
      ),
    },
    ...(role === 'ADMIN' || role === 'HR'
      ? [
          {
            header: 'Actions',
            accessor: (row: Attendance) => (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => handleEditClick(row)}>
                  <Edit className="w-4 h-4 mr-1" /> Edit
                </Button>
                {/* Overtime approval for records with pending overtime */}
                {row.overtime && !row.overtime.isApproved && row.workingHours && row.workingHours > 8 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => approvOvertimeMutation.mutate(row._id)}
                    isLoading={approvOvertimeMutation.isPending}
                    className="text-purple-600 border-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                  >
                    ✓ OT
                  </Button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  if (attLoading || empLoading) {
    return (
      <Card className="animate-pulse h-96 bg-muted/20">
        <div />
      </Card>
    );
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

      {/* ── Upcoming Holidays Banner ── */}
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
          <div className="w-full sm:w-64">
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
        </div>

        <TableWrapper
          columns={columns}
          data={filteredAttendances}
        />
      </Card>

      {/* Edit Attendance Modal */}
      <Modal
        isOpen={!!editingAttendance}
        onClose={() => setEditingAttendance(null)}
        title="Edit Attendance Record"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4 text-left">
          <Input
            label="Login Time *"
            type="datetime-local"
            value={loginTimeInput}
            onChange={(e) => setLoginTimeInput(e.target.value)}
            required
          />
          <Input
            label="Logout Time"
            type="datetime-local"
            value={logoutTimeInput}
            onChange={(e) => setLogoutTimeInput(e.target.value)}
          />
          <Select
            label="Attendance Status *"
            value={statusInput}
            onChange={(e) => setStatusInput(e.target.value as any)}
            options={[
              { value: 'OFFICE', label: 'Office' },
              { value: 'WFH', label: 'Work From Home' },
              { value: 'HALF_DAY', label: 'Half Day' },
              { value: 'LEAVE', label: 'On Leave' },
            ]}
          />
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" type="button" onClick={() => setEditingAttendance(null)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={updateMutation.isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
