import React, { useState, useMemo } from 'react';
import { TableSkeleton } from '../Components/WrapperComponents/Skeleton';
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
import { Calendar, Plus, Palmtree, Laptop, Clock, FileText, Info } from 'lucide-react';
import { HolidayEnhancedCalendar } from '../Components/SpecifiedComponents/HolidayEnhancedCalendar';

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
          {/* Only Employees/Interns can cancel their own PENDING leaves */}
          {(role === 'EMPLOYEE' || role === 'INTERN') && row.status === 'PENDING' && (
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
    return <TableSkeleton />;
  }



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

        {(role === 'EMPLOYEE' || role === 'INTERN') && (
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

          {/* Interactive Calendar (Right 2 Columns) — powered by HolidayEnhancedCalendar */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-primary" />
              Interactive Leave, WFH & Holiday Calendar
            </h3>
            <HolidayEnhancedCalendar
              leaves={leaves || []}
              wfh={wfh || []}
              perms={perms || []}
            />
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
              {(role !== 'EMPLOYEE' && role !== 'INTERN') && (
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
            <TableWrapper columns={(role === 'EMPLOYEE' || role === 'INTERN') ? leaveColumns.filter(c => c.header !== 'Employee') : leaveColumns} data={filteredLeaves} />
          )}
          {activeHistoryTab === 'WFH' && (
            <TableWrapper columns={(role === 'EMPLOYEE' || role === 'INTERN') ? wfhColumns.filter(c => c.header !== 'Employee') : wfhColumns} data={filteredWFH} />
          )}
          {activeHistoryTab === 'PERMISSION' && (
            <TableWrapper columns={(role === 'EMPLOYEE' || role === 'INTERN') ? permColumns.filter(c => c.header !== 'Employee') : permColumns} data={filteredPerms} />
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
