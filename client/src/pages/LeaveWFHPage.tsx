import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { leaveApi } from '../api_service/leaveApi';
import { wfhApi } from '../api_service/wfhApi';
import { permissionApi } from '../api_service/permissionApi';
import { useAuthStore } from '../store/useAuthStore';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
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

  const { data: leaves, isLoading: leavesLoading } = useQuery({ queryKey: ['leaves'], queryFn: leaveApi.getAll });
  const { data: wfh, isLoading: wfhLoading } = useQuery({ queryKey: ['wfh'], queryFn: wfhApi.getAll });
  const { data: perms, isLoading: permsLoading } = useQuery({ queryKey: ['permissions'], queryFn: permissionApi.getAll });

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
    { header: 'Employee', accessor: (row: LeaveRequest) => <span className="font-bold text-xs">{typeof row.employeeId === 'object' ? row.employeeId.fullName : 'Logapriyan M'}</span> },
    { header: 'Type', accessor: 'leaveType', className: 'font-semibold text-xs text-primary' },
    { header: 'Duration', accessor: (row: LeaveRequest) => <span className="font-mono text-xs">{formatDate(row.startDate)} to {formatDate(row.endDate)} ({row.totalDays} days)</span> },
    { header: 'Reason', accessor: 'reason', className: 'text-xs italic' },
    { header: 'Status', accessor: (row: LeaveRequest) => getStatusBadge(row.status) },
  ];

  const wfhColumns = [
    { header: 'Employee', accessor: (row: LeaveRequest) => <span className="font-bold text-xs">{typeof row.employeeId === 'object' ? row.employeeId.fullName : 'Vikram Mehta'}</span> },
    { header: 'Date', accessor: (row: LeaveRequest) => <span className="font-mono text-xs">{formatDate(row.startDate)}</span> },
    { header: 'Reason', accessor: 'reason', className: 'text-xs italic' },
    { header: 'Expected Tasks', accessor: 'expectedTasks', className: 'text-xs font-medium text-muted-foreground' },
    { header: 'Status', accessor: (row: LeaveRequest) => getStatusBadge(row.status) },
  ];

  const permColumns = [
    { header: 'Employee', accessor: (row: PermissionRequest) => <span className="font-bold text-xs">{typeof row.employeeId === 'object' ? row.employeeId.fullName : 'Ravi Kumar'}</span> },
    { header: 'Date', accessor: (row: PermissionRequest) => <span className="font-mono text-xs">{formatDate(row.date)}</span> },
    { header: 'Time Slot', accessor: (row: PermissionRequest) => <span className="font-mono text-xs">{row.startTime} to {row.endTime} ({row.totalHours} hrs)</span> },
    { header: 'Reason', accessor: 'reason', className: 'text-xs italic' },
    { header: 'Status', accessor: (row: PermissionRequest) => getStatusBadge(row.approvalStatus) },
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

      <Card className="border-l-4 border-l-primary shadow-md">
        {activeTab === 'LEAVE' && (
          <TableWrapper columns={leaveColumns} data={leaves || []} searchKey="reason" searchPlaceholder="Search leave requests by reason..." />
        )}
        {activeTab === 'WFH' && (
          <TableWrapper columns={wfhColumns} data={wfh || []} searchKey="expectedTasks" searchPlaceholder="Search WFH by expected tasks..." />
        )}
        {activeTab === 'PERMISSION' && (
          <TableWrapper columns={permColumns} data={perms || []} searchKey="reason" searchPlaceholder="Search permissions by reason..." />
        )}
      </Card>

      {/* Modals */}
      <LeaveApplyModal isOpen={showLeaveModal} onClose={() => setShowLeaveModal(false)} />
      <WFHRequestModal isOpen={showWFHModal} onClose={() => setShowWFHModal(false)} />
      <PermissionRequestModal isOpen={showPermModal} onClose={() => setShowPermModal(false)} />
    </div>
  );
};
