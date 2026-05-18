import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveApi } from '../api_service/leaveApi';
import { wfhApi } from '../api_service/wfhApi';
import { permissionApi } from '../api_service/permissionApi';
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
import { Palmtree, Laptop, Clock, PlusCircle } from 'lucide-react';

export const LeaveWFHPage: React.FC = () => {
  const { role } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'LEAVE' | 'WFH' | 'PERMISSION'>('LEAVE');

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showWFHModal, setShowWFHModal] = useState(false);
  const [showPermModal, setShowPermModal] = useState(false);

  // Advanced Filter States
  const [nameFilter, setNameFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const { data: leaves, isLoading: leavesLoading } = useQuery({ queryKey: ['leaves'], queryFn: leaveApi.getAll });
  const { data: wfh, isLoading: wfhLoading } = useQuery({ queryKey: ['wfh'], queryFn: wfhApi.getAll });
  const { data: perms, isLoading: permsLoading } = useQuery({ queryKey: ['permissions'], queryFn: permissionApi.getAll });

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
      const empName = item.employeeId ? (typeof item.employeeId === 'object' ? item.employeeId.fullName || 'Logapriyan M' : item.employeeId) : 'Logapriyan M';
      const matchName = empName.toLowerCase().includes(nameFilter.toLowerCase());
      const matchType = typeFilter === 'All' || item.leaveType === typeFilter;
      const matchStatus = statusFilter === 'All' || item.status === statusFilter;
      return matchName && matchType && matchStatus;
    });
  }, [leaves, nameFilter, typeFilter, statusFilter]);

  const filteredWFH = useMemo(() => {
    if (!wfh) return [];
    return wfh.filter(item => {
      const empName = item.employeeId ? (typeof item.employeeId === 'object' ? item.employeeId.fullName || 'Vikram Mehta' : item.employeeId) : 'Vikram Mehta';
      const matchName = empName.toLowerCase().includes(nameFilter.toLowerCase());
      const matchType = typeFilter === 'All' || typeFilter === 'WFH';
      const matchStatus = statusFilter === 'All' || item.status === statusFilter;
      return matchName && matchType && matchStatus;
    });
  }, [wfh, nameFilter, typeFilter, statusFilter]);

  const filteredPerms = useMemo(() => {
    if (!perms) return [];
    return perms.filter(item => {
      const empName = item.employeeId ? (typeof item.employeeId === 'object' ? item.employeeId.fullName || 'Ravi Kumar' : item.employeeId) : 'Ravi Kumar';
      const matchName = empName.toLowerCase().includes(nameFilter.toLowerCase());
      const matchType = typeFilter === 'All' || typeFilter === 'Permission';
      const matchStatus = statusFilter === 'All' || item.approvalStatus === statusFilter;
      return matchName && matchType && matchStatus;
    });
  }, [perms, nameFilter, typeFilter, statusFilter]);

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
            <img src={empObj?.profileImage || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} alt="" className="w-8 h-8 rounded-full object-cover border border-border flex-shrink-0" />
            <span className="font-bold text-xs">{empObj?.fullName || 'Logapriyan M'}</span>
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
        </span>
      ),
    },
    { header: 'Reason', accessor: 'reason', className: 'text-xs italic' },
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
                    onClick={() => leaveMutation.mutate({ id: row._id, status: 'REJECTED' })}
                    isLoading={leaveMutation.isPending}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => leaveMutation.mutate({ id: row._id, status: 'APPROVED' })}
                    isLoading={leaveMutation.isPending}
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

  const wfhColumns = [
    {
      header: 'Employee',
      accessor: (row: LeaveRequest) => {
        const empObj = typeof row.employeeId === 'object' ? row.employeeId : null;
        return (
          <div className="flex items-center gap-3">
            <img src={empObj?.profileImage || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} alt="" className="w-8 h-8 rounded-full object-cover border border-border flex-shrink-0" />
            <span className="font-bold text-xs">{empObj?.fullName || 'Vikram Mehta'}</span>
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
            <img src={empObj?.profileImage || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} alt="" className="w-8 h-8 rounded-full object-cover border border-border flex-shrink-0" />
            <span className="font-bold text-xs">{empObj?.fullName || 'Ravi Kumar'}</span>
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

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-300">
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
              <PlusCircle className="w-4 h-4 mr-1.5" /> Apply Leave
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

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          onClick={() => setActiveTab('LEAVE')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'LEAVE' ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          <Palmtree className="w-4 h-4" /> Leave Requests
        </button>
        <button
          onClick={() => setActiveTab('WFH')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'WFH' ? 'bg-foreground text-background shadow-md' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          <Laptop className="w-4 h-4" /> WFH Requests
        </button>
        <button
          onClick={() => setActiveTab('PERMISSION')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'PERMISSION' ? 'bg-muted-foreground text-white shadow-md' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          <Clock className="w-4 h-4" /> Permission Hours
        </button>
      </div>

      <Card className="border-l-4 border-l-primary shadow-md p-6 space-y-6">
        {/* Advanced Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-muted/30 p-4 rounded-xl border border-border">
          <div className="flex-1 w-full">
            <Input
              placeholder="Search requests by employee name..."
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-56">
            <Select
              value={typeFilter}
              onChange={(e) => {
                const val = e.target.value;
                setTypeFilter(val);
                if (val === 'WFH') setActiveTab('WFH');
                else if (val === 'Permission') setActiveTab('PERMISSION');
                else if (val === 'Casual Leave' || val === 'Sick Leave') setActiveTab('LEAVE');
              }}
              options={[
                { value: 'All', label: 'All Request Types' },
                { value: 'Casual Leave', label: 'Casual Leave' },
                { value: 'Sick Leave', label: 'Sick Leave' },
                { value: 'WFH', label: 'WFH Request' },
                { value: 'Permission', label: 'Permission Hours' },
              ]}
            />
          </div>
          <div className="w-full sm:w-56">
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

        {activeTab === 'LEAVE' && (
          <TableWrapper columns={leaveColumns} data={filteredLeaves} />
        )}
        {activeTab === 'WFH' && (
          <TableWrapper columns={wfhColumns} data={filteredWFH} />
        )}
        {activeTab === 'PERMISSION' && (
          <TableWrapper columns={permColumns} data={filteredPerms} />
        )}
      </Card>

      {/* Modals */}
      <LeaveApplyModal isOpen={showLeaveModal} onClose={() => setShowLeaveModal(false)} />
      <WFHRequestModal isOpen={showWFHModal} onClose={() => setShowWFHModal(false)} />
      <PermissionRequestModal isOpen={showPermModal} onClose={() => setShowPermModal(false)} />
    </div>
  );
};
