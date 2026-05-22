import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveApi } from '../api_service/leaveApi';
import { wfhApi } from '../api_service/wfhApi';
import { permissionApi } from '../api_service/permissionApi';
import { employeeApi } from '../api_service/employeeApi';
import { leaveBalanceApi } from '../api_service/leavePolicyApi';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
import { Input, Select } from '../Components/WrapperComponents/Input';
import { TableWrapper } from '../Components/WrapperComponents/TableWrapper';
import { LeaveApplyModal } from '../Components/SpecifiedComponents/LeaveApplyModal';
import { WFHRequestModal } from '../Components/SpecifiedComponents/WFHRequestModal';
import { PermissionRequestModal } from '../Components/SpecifiedComponents/PermissionRequestModal';
import type { LeaveRequest, PermissionRequest } from '../types';
import { formatDate } from '../utils/formatters';
import { Calendar, Plus, Palmtree, Laptop, Clock, FileText, ChevronLeft, ChevronRight, Info } from 'lucide-react';

export const LeaveWFHPage: React.FC = () => {
  const { role, user } = useAuthStore();
  
  // Exactly 2 primary page tabs: 'DASHBOARD' (Calendar & Allowances) and 'HISTORY' (Logs & Filters)
  const [activePageTab, setActivePageTab] = useState<'DASHBOARD' | 'HISTORY'>('DASHBOARD');
  
  // Segmented sub-tab inside the history logs
  const [activeHistoryTab, setActiveHistoryTab] = useState<'LEAVE' | 'WFH' | 'PERMISSION'>('LEAVE');

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showWFHModal, setShowWFHModal] = useState(false);
  const [showPermModal, setShowPermModal] = useState(false);

  // Advanced Filter States
  const [nameFilter, setNameFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Calendar Month & Selected Date
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const { data: leaves, isLoading: leavesLoading } = useQuery({ queryKey: ['leaves'], queryFn: leaveApi.getAll });
  const { data: wfh, isLoading: wfhLoading } = useQuery({ queryKey: ['wfh'], queryFn: wfhApi.getAll });
  const { data: perms, isLoading: permsLoading } = useQuery({ queryKey: ['permissions'], queryFn: permissionApi.getAll });

  const { data: leaveBalances = [] } = useQuery({
    queryKey: ['myLeaveBalances'],
    queryFn: leaveBalanceApi.getMyBalances,
  });

  const { data: employeeProfile } = useQuery({
    queryKey: ['employeeProfile', user?.employeeId],
    queryFn: () => employeeApi.getById(user?.employeeId as string),
    enabled: !!user?.employeeId,
  });

  // Helper to find balance for a type
  const getBalance = (type: string) => leaveBalances.find(b => b.leaveType === type);

  const queryClient = useQueryClient();
  const { addToast } = useNotificationStore();

  const leaveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) =>
      leaveApi.updateStatus(id, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      addToast('Leave Request Updated', `Request has been ${variables.status.toLowerCase()}.`, 'success');
    },
  });

  const cancelLeaveMutation = useMutation({
    mutationFn: (id: string) => leaveApi.cancelLeave(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      queryClient.invalidateQueries({ queryKey: ['myLeaveBalances'] });
      addToast('Leave Cancelled', 'Your leave request has been cancelled.', 'success');
    },
    onError: (err: any) => {
      addToast('Cancel Failed', err.response?.data?.message || 'Could not cancel leave.', 'error');
    },
  });

  const wfhMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) =>
      wfhApi.updateStatus(id, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['wfh'] });
      addToast('WFH Request Updated', `Request has been ${variables.status.toLowerCase()}.`, 'success');
    },
  });

  const permMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) =>
      permissionApi.updateStatus(id, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
      addToast('Permission Request Updated', `Request has been ${variables.status.toLowerCase()}.`, 'success');
    },
  });

  const filteredLeaves = useMemo(() => {
    if (!leaves) return [];
    return leaves.filter(item => {
      const empName = item.employeeId ? (typeof item.employeeId === 'object' ? item.employeeId.fullName || 'Unknown Employee' : item.employeeId) : 'Unknown Employee';
      const matchName = empName.toLowerCase().includes(nameFilter.toLowerCase());
      const matchStatus = statusFilter === 'All' || item.status === statusFilter;
      return matchName && matchStatus;
    });
  }, [leaves, nameFilter, statusFilter]);

  const filteredWFH = useMemo(() => {
    if (!wfh) return [];
    return wfh.filter(item => {
      const empName = item.employeeId ? (typeof item.employeeId === 'object' ? item.employeeId.fullName || 'Unknown Employee' : item.employeeId) : 'Unknown Employee';
      const matchName = empName.toLowerCase().includes(nameFilter.toLowerCase());
      const matchStatus = statusFilter === 'All' || item.status === statusFilter;
      return matchName && matchStatus;
    });
  }, [wfh, nameFilter, statusFilter]);

  const filteredPerms = useMemo(() => {
    if (!perms) return [];
    return perms.filter(item => {
      const empName = item.employeeId ? (typeof item.employeeId === 'object' ? item.employeeId.fullName || 'Unknown Employee' : item.employeeId) : 'Unknown Employee';
      const matchName = empName.toLowerCase().includes(nameFilter.toLowerCase());
      const matchStatus = statusFilter === 'All' || item.approvalStatus === statusFilter;
      return matchName && matchStatus;
    });
  }, [perms, nameFilter, statusFilter]);

  // Calendar Helpers & Cell Generator
  const handlePrevMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
  };

  const calendarCells = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevTotalDays = new Date(year, month, 0).getDate();

    const cells = [];

    // Previous Month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevDay = prevTotalDays - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      cells.push({
        dateStr: `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(prevDay).padStart(2, '0')}`,
        dayNum: prevDay,
        isCurrentMonth: false,
      });
    }

    // Current Month days
    for (let day = 1; day <= totalDays; day++) {
      cells.push({
        dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        dayNum: day,
        isCurrentMonth: true,
      });
    }

    // Next Month padding
    const remainingCells = 42 - cells.length;
    for (let i = 1; i <= remainingCells; i++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      cells.push({
        dateStr: `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
        dayNum: i,
        isCurrentMonth: false,
      });
    }

    return cells;
  }, [calendarDate]);

  const getEventsForDate = (dateStr: string) => {
    const dayLeaves = leaves?.filter(l => dateStr >= l.startDate && dateStr <= l.endDate) || [];
    const dayWfh = wfh?.filter(w => dateStr >= w.startDate && dateStr <= w.endDate) || [];
    const dayPerms = perms?.filter(p => p.date === dateStr) || [];

    return {
      leaves: dayLeaves,
      wfh: dayWfh,
      perms: dayPerms,
      totalCount: dayLeaves.length + dayWfh.length + dayPerms.length,
    };
  };

  const selectedDateEvents = useMemo(() => {
    return getEventsForDate(selectedCalendarDate);
  }, [selectedCalendarDate, leaves, wfh, perms]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <span className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider border border-primary/20">Approved</span>;
      case 'REJECTED':
        return <span className="px-2.5 py-1 rounded-md bg-muted text-muted-foreground text-xs font-bold uppercase tracking-wider border border-border">Rejected</span>;
      default:
        return <span className="px-2.5 py-1 rounded-md bg-foreground/10 text-foreground text-xs font-bold uppercase tracking-wider border border-border">Pending</span>;
    }
  };

  const leaveColumns = [
    {
      header: 'Employee',
      accessor: (row: LeaveRequest) => {
        const empObj = typeof row.employeeId === 'object' ? row.employeeId : null;
        return (
          <div className="flex items-center gap-3">
            {empObj?.profileImage ? (
              <img src={empObj.profileImage} alt="" className="w-8 h-8 rounded-full object-cover border border-border flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0 uppercase">
                {(empObj?.fullName || 'Unknown Employee').charAt(0)}
              </div>
            )}
            <span className="font-bold text-xs">{empObj?.fullName || 'Unknown Employee'}</span>
          </div>
        );
      },
    },
    { header: 'Type', accessor: 'leaveType', className: 'font-semibold text-xs text-primary' },
    {
      header: 'Duration',
      accessor: (row: LeaveRequest) => (
        <span className="font-mono text-xs">
          {row.totalDays === 1 || row.startDate === row.endDate
            ? formatDate(row.startDate)
            : `${formatDate(row.startDate)} to ${formatDate(row.endDate)} (${row.totalDays} days)`}
          {row.isHalfDay && <span className="ml-1 text-[10px] text-amber-600 font-bold">(Half-Day)</span>}
        </span>
      ),
    },
    { header: 'Reason', accessor: 'reason', className: 'text-xs italic' },
    { header: 'Status', accessor: (row: LeaveRequest) => getStatusBadge(row.status) },
    {
      header: 'Actions',
      accessor: (row: LeaveRequest) => (
        <div className="flex items-center gap-2">
          {/* ADMIN/HR approve/reject */}
          {(role === 'ADMIN' || role === 'HR') && row.status === 'PENDING' && (
            <>
              <Button size="sm" variant="destructive"
                onClick={() => leaveMutation.mutate({ id: row._id, status: 'REJECTED' })}
                isLoading={leaveMutation.isPending}
              >
                Reject
              </Button>
              <Button size="sm"
                onClick={() => leaveMutation.mutate({ id: row._id, status: 'APPROVED' })}
                isLoading={leaveMutation.isPending}
              >
                Approve
              </Button>
            </>
          )}
          {/* Employee / Admin can cancel PENDING or APPROVED leaves */}
          {(row.status === 'PENDING' || row.status === 'APPROVED') && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => cancelLeaveMutation.mutate(row._id)}
              isLoading={cancelLeaveMutation.isPending}
              className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-900/20"
            >
              Cancel
            </Button>
          )}
          {row.status === 'REJECTED' || row.status === 'CANCELLED' ? (
            <span className="text-xs text-muted-foreground italic">Closed</span>
          ) : null}
        </div>
      ),
    },
  ];

  const wfhColumns = [
    {
      header: 'Employee',
      accessor: (row: LeaveRequest) => {
        const empObj = typeof row.employeeId === 'object' ? row.employeeId : null;
        return (
          <div className="flex items-center gap-3">
            {empObj?.profileImage ? (
              <img src={empObj.profileImage} alt="" className="w-8 h-8 rounded-full object-cover border border-border flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0 uppercase">
                {(empObj?.fullName || 'Unknown Employee').charAt(0)}
              </div>
            )}
            <span className="font-bold text-xs">{empObj?.fullName || 'Unknown Employee'}</span>
          </div>
        );
      },
    },
    { header: 'Date', accessor: (row: LeaveRequest) => <span className="font-mono text-xs">{formatDate(row.startDate)}</span> },
    { header: 'Reason', accessor: 'reason', className: 'text-xs italic' },
    { header: 'Expected Tasks', accessor: 'expectedTasks', className: 'text-xs font-medium text-muted-foreground' },
    { header: 'Status', accessor: (row: LeaveRequest) => getStatusBadge(row.status) },
    ...(role === 'ADMIN' || role === 'HR'
      ? [
          {
            header: 'Actions',
            accessor: (row: LeaveRequest) =>
              row.status === 'PENDING' ? (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => wfhMutation.mutate({ id: row._id, status: 'REJECTED' })}
                    isLoading={wfhMutation.isPending}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => wfhMutation.mutate({ id: row._id, status: 'APPROVED' })}
                    isLoading={wfhMutation.isPending}
                  >
                    Approve
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground italic">Processed</span>
              ),
          },
        ]
      : []),
  ];

  const permColumns = [
    {
      header: 'Employee',
      accessor: (row: PermissionRequest) => {
        const empObj = typeof row.employeeId === 'object' ? row.employeeId : null;
        return (
          <div className="flex items-center gap-3">
            {empObj?.profileImage ? (
              <img src={empObj.profileImage} alt="" className="w-8 h-8 rounded-full object-cover border border-border flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0 uppercase">
                {(empObj?.fullName || 'Unknown Employee').charAt(0)}
              </div>
            )}
            <span className="font-bold text-xs">{empObj?.fullName || 'Unknown Employee'}</span>
          </div>
        );
      },
    },
    { header: 'Date', accessor: (row: PermissionRequest) => <span className="font-mono text-xs">{formatDate(row.date)}</span> },
    { header: 'Time Slot', accessor: (row: PermissionRequest) => <span className="font-mono text-xs">{row.startTime} to {row.endTime} ({row.totalHours} hrs)</span> },
    { header: 'Reason', accessor: 'reason', className: 'text-xs italic' },
    { header: 'Status', accessor: (row: PermissionRequest) => getStatusBadge(row.approvalStatus) },
    ...(role === 'ADMIN' || role === 'HR'
      ? [
          {
            header: 'Actions',
            accessor: (row: PermissionRequest) =>
              row.approvalStatus === 'PENDING' ? (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => permMutation.mutate({ id: row._id, status: 'REJECTED' })}
                    isLoading={permMutation.isPending}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => permMutation.mutate({ id: row._id, status: 'APPROVED' })}
                    isLoading={permMutation.isPending}
                  >
                    Approve
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground italic">Processed</span>
              ),
          },
        ]
      : []),
  ];

  if (leavesLoading || wfhLoading || permsLoading) {
    return (
      <Card className="animate-pulse h-96 bg-muted/20">
        <div />
      </Card>
    );
  }

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-300">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Palmtree className="w-6 h-6 text-primary" />
            Leave, WFH & Permission Management
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track company absence allowances, remote work productivity plans, and monthly permission limits
          </p>
        </div>

        {role === 'EMPLOYEE' && (
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Button size="sm" onClick={() => setShowLeaveModal(true)} className="bg-primary text-white font-bold tracking-wider shadow-md shadow-primary/20">
              <Plus className="w-4 h-4 mr-1.5" /> Apply Leave
            </Button>
            <Button size="sm" onClick={() => setShowWFHModal(true)} className="bg-foreground text-background hover:bg-foreground/90 font-bold tracking-wider shadow-md">
              <Laptop className="w-4 h-4 mr-1.5" /> Request WFH
            </Button>
            <Button size="sm" onClick={() => setShowPermModal(true)} className="bg-muted-foreground text-white hover:bg-muted-foreground/90 font-bold tracking-wider shadow-md">
              <Clock className="w-4 h-4 mr-1.5" /> Request Permission
            </Button>
          </div>
        )}
      </div>

      {/* Exactly 2 Primary Tabs: Dashboard and Logs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          onClick={() => setActivePageTab('DASHBOARD')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activePageTab === 'DASHBOARD' 
              ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' 
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Calendar className="w-4 h-4" /> Calendar & Balances
        </button>
        <button
          onClick={() => setActivePageTab('HISTORY')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activePageTab === 'HISTORY' 
              ? 'bg-foreground text-background shadow-md' 
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <FileText className="w-4 h-4" /> Request History Logs
        </button>
      </div>

      {/* Render selected primary tab */}
      {activePageTab === 'DASHBOARD' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-250">
          {/* Balances (Left Column) */}
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Info className="w-4 h-4 text-primary" />
              Your Balance Allowances
            </h3>

            {/* Casual Leave Balance */}
            {(() => {
              const b = getBalance('Casual Leave');
              return (
                <Card className="border-l-4 border-l-primary p-5 hover:shadow-md transition-shadow bg-card relative overflow-hidden">
                  <div className="absolute right-3 top-3 opacity-10">
                    <Palmtree className="w-12 h-12 text-primary" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Casual / Sick Leaves</p>
                  <h4 className="text-3xl font-black text-foreground">
                    {b ? b.balance : (employeeProfile?.leaveBalance ?? 0)}{' '}
                    <span className="text-xs font-semibold text-muted-foreground">days left</span>
                  </h4>
                  {b && (
                    <div className="mt-2 flex gap-3 text-[10px] text-muted-foreground">
                      <span>Allocated: <strong>{b.allocated}</strong></span>
                      <span>Used: <strong>{b.used}</strong></span>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-2">Resets monthly ({b?.monthlyAllowance ?? 2} days/month)</p>
                </Card>
              );
            })()}

            {/* WFH Balance */}
            {(() => {
              const b = getBalance('WFH');
              return (
                <Card className="border-l-4 border-l-foreground p-5 hover:shadow-md transition-shadow bg-card relative overflow-hidden">
                  <div className="absolute right-3 top-3 opacity-10">
                    <Laptop className="w-12 h-12 text-foreground" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Work From Home (WFH)</p>
                  <h4 className="text-3xl font-black text-foreground">
                    {b ? b.balance : (employeeProfile?.wfhBalance ?? 0)}{' '}
                    <span className="text-xs font-semibold text-muted-foreground">days left</span>
                  </h4>
                  {b && (
                    <div className="mt-2 flex gap-3 text-[10px] text-muted-foreground">
                      <span>Allocated: <strong>{b.allocated}</strong></span>
                      <span>Used: <strong>{b.used}</strong></span>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-2">Resets monthly ({b?.monthlyAllowance ?? 1} day/month)</p>
                </Card>
              );
            })()}

            {/* Permission Balance */}
            {(() => {
              const b = getBalance('Permission');
              const limit = b?.permissionConversionHours ?? 3;
              const used = b?.used ?? (employeeProfile?.permissionHoursBalance !== undefined ? limit - employeeProfile.permissionHoursBalance : 0);
              const remaining = b ? b.balance : (employeeProfile?.permissionHoursBalance ?? limit);
              const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
              return (
                <Card className="border-l-4 border-l-primary p-5 hover:shadow-md transition-shadow bg-card relative overflow-hidden">
                  <div className="absolute right-3 top-3 opacity-10">
                    <Clock className="w-12 h-12 text-primary" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Permission Hours</p>
                  <h4 className="text-3xl font-black text-foreground">
                    {remaining.toFixed ? remaining.toFixed(1) : remaining}{' '}
                    <span className="text-xs font-semibold text-muted-foreground">hrs left</span>
                  </h4>
                  {/* Progress bar */}
                  <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-rose-500' : pct >= 75 ? 'bg-amber-500' : 'bg-primary'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{pct}% used of {limit} hr monthly limit</p>
                  {pct >= 100 && (
                    <p className="text-[10px] text-rose-600 font-bold mt-1">⚠ Limit reached — next approval may trigger half-day deduction</p>
                  )}
                </Card>
              );
            })()}
          </div>

          {/* Interactive Calendar (Right 2 Columns) */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-primary" />
              Interactive Leave & WFH Calendar
            </h3>

            <Card className="p-6 bg-card shadow-md border border-border space-y-4">
              {/* Calendar Controls */}
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h4 className="font-extrabold text-base text-foreground flex items-center gap-2">
                  {monthNames[calendarDate.getMonth()]} {calendarDate.getFullYear()}
                </h4>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={handlePrevMonth} className="h-8 w-8 p-0">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleNextMonth} className="h-8 w-8 p-0">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Weekdays */}
              <div className="grid grid-cols-7 text-center text-xs font-bold text-muted-foreground border-b border-border pb-2">
                <div>Sun</div>
                <div>Mon</div>
                <div>Tue</div>
                <div>Wed</div>
                <div>Thu</div>
                <div>Fri</div>
                <div>Sat</div>
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {calendarCells.map((cell, idx) => {
                  const cellEvents = getEventsForDate(cell.dateStr);
                  const isSelected = cell.dateStr === selectedCalendarDate;
                  
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedCalendarDate(cell.dateStr)}
                      className={`h-11 sm:h-12 flex flex-col items-center justify-between p-1 rounded-xl transition-all border text-xs relative ${
                        cell.isCurrentMonth 
                          ? 'text-foreground font-semibold bg-background hover:bg-muted/50' 
                          : 'text-muted-foreground/30 bg-muted/10 border-transparent pointer-events-none'
                      } ${
                        isSelected 
                          ? 'border-primary ring-2 ring-primary/20 bg-primary/5' 
                          : 'border-border'
                      }`}
                    >
                      <span className="self-start pl-1 pt-0.5">{cell.dayNum}</span>
                      
                      {/* Event Dots Container */}
                      <div className="flex gap-0.5 mt-auto mb-0.5 pb-0.5">
                        {cellEvents.leaves.length > 0 && (
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" title="Leave Scheduled" />
                        )}
                        {cellEvents.wfh.length > 0 && (
                          <span className="h-1.5 w-1.5 rounded-full bg-foreground border border-border" title="WFH Scheduled" />
                        )}
                        {cellEvents.perms.length > 0 && (
                          <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" title="Permission Scheduled" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Date Event List */}
              <div className="mt-4 p-4 rounded-xl bg-muted/30 border border-border space-y-2.5">
                <h5 className="text-xs font-extrabold text-foreground uppercase tracking-wider flex items-center gap-1.5 border-b border-border/60 pb-1.5">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  Schedule for {formatDate(selectedCalendarDate)}
                </h5>
                
                {selectedDateEvents.totalCount === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-1">No leaves, WFH, or permission slots scheduled on this date.</p>
                ) : (
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {selectedDateEvents.leaves.map((l) => (
                      <div key={l._id} className="flex items-center justify-between bg-card p-2 rounded-lg border border-border text-xs">
                        <div>
                          <span className="font-bold text-primary">{l.leaveType}</span>
                          <span className="text-muted-foreground block text-[10px] mt-0.5">Reason: {l.reason}</span>
                        </div>
                        {getStatusBadge(l.status)}
                      </div>
                    ))}
                    {selectedDateEvents.wfh.map((w) => (
                      <div key={w._id} className="flex items-center justify-between bg-card p-2 rounded-lg border border-border text-xs">
                        <div>
                          <span className="font-bold text-foreground">Work From Home (WFH)</span>
                          <span className="text-muted-foreground block text-[10px] mt-0.5">Tasks: {w.expectedTasks || 'General Work'}</span>
                        </div>
                        {getStatusBadge(w.status)}
                      </div>
                    ))}
                    {selectedDateEvents.perms.map((p) => (
                      <div key={p._id} className="flex items-center justify-between bg-card p-2 rounded-lg border border-border text-xs">
                        <div>
                          <span className="font-bold text-yellow-600 dark:text-yellow-500">Permission Slot</span>
                          <span className="text-muted-foreground block text-[10px] mt-0.5">Time: {p.startTime} to {p.endTime} ({p.totalHours} hrs)</span>
                        </div>
                        {getStatusBadge(p.approvalStatus)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      ) : (
        /* History & Status Logs Tab */
        <Card className="border-l-4 border-l-primary shadow-md p-6 space-y-6 animate-in fade-in duration-250">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
            {/* Segmented sub-tab control */}
            <div className="flex bg-muted p-1 rounded-xl w-fit border border-border">
              <button
                type="button"
                onClick={() => setActiveHistoryTab('LEAVE')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeHistoryTab === 'LEAVE' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Palmtree className="w-3.5 h-3.5" />
                Leaves
              </button>
              <button
                type="button"
                onClick={() => setActiveHistoryTab('WFH')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeHistoryTab === 'WFH' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                WFH Requests
              </button>
              <button
                type="button"
                onClick={() => setActiveHistoryTab('PERMISSION')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeHistoryTab === 'PERMISSION' ? 'bg-background text-yellow-600 dark:text-yellow-500 shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Permissions
              </button>
            </div>

            {/* Simple Search/Filters */}
            <div className="flex items-center gap-3">
              {role !== 'EMPLOYEE' && (
                <div className="w-48 sm:w-64">
                  <Input
                    placeholder="Search name..."
                    value={nameFilter}
                    onChange={(e) => setNameFilter(e.target.value)}
                  />
                </div>
              )}
              <div className="w-40">
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  options={[
                    { value: 'All', label: 'All Statuses' },
                    { value: 'PENDING', label: 'Pending' },
                    { value: 'APPROVED', label: 'Approved' },
                    { value: 'REJECTED', label: 'Rejected' },
                  ]}
                />
              </div>
            </div>
          </div>

          {activeHistoryTab === 'LEAVE' && (
            <TableWrapper columns={role === 'EMPLOYEE' ? leaveColumns.filter(c => c.header !== 'Employee') : leaveColumns} data={filteredLeaves} />
          )}
          {activeHistoryTab === 'WFH' && (
            <TableWrapper columns={role === 'EMPLOYEE' ? wfhColumns.filter(c => c.header !== 'Employee') : wfhColumns} data={filteredWFH} />
          )}
          {activeHistoryTab === 'PERMISSION' && (
            <TableWrapper columns={role === 'EMPLOYEE' ? permColumns.filter(c => c.header !== 'Employee') : permColumns} data={filteredPerms} />
          )}
        </Card>
      )}

      {/* Modals */}
      <LeaveApplyModal isOpen={showLeaveModal} onClose={() => setShowLeaveModal(false)} />
      <WFHRequestModal isOpen={showWFHModal} onClose={() => setShowWFHModal(false)} />
      <PermissionRequestModal isOpen={showPermModal} onClose={() => setShowPermModal(false)} />
    </div>
  );
};
