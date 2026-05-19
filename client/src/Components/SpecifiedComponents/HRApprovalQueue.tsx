import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveApi } from '../../api_service/leaveApi';
import { wfhApi } from '../../api_service/wfhApi';
import { permissionApi } from '../../api_service/permissionApi';
import { useNotificationStore } from '../../store/useNotificationStore';
import { Card } from '../WrapperComponents/Card';
import { Button } from '../WrapperComponents/Button';
import { formatDate } from '../../utils/formatters';
import { Clock, UserCheck } from 'lucide-react';

export const HRApprovalQueue: React.FC = () => {
  const { addToast } = useNotificationStore();
  const queryClient = useQueryClient();

  const { data: leaves, isLoading: leavesLoading } = useQuery({
    queryKey: ['leaves'],
    queryFn: leaveApi.getAll,
  });

  const { data: wfh, isLoading: wfhLoading } = useQuery({
    queryKey: ['wfh'],
    queryFn: wfhApi.getAll,
  });

  const { data: perms, isLoading: permsLoading } = useQuery({
    queryKey: ['permissions'],
    queryFn: permissionApi.getAll,
  });

  const pendingLeaves = leaves?.filter((l) => l.status === 'PENDING') || [];
  const pendingWFH = wfh?.filter((w) => w.status === 'PENDING') || [];
  const pendingPerms = perms?.filter((p) => p.approvalStatus === 'PENDING') || [];

  const totalPending = pendingLeaves.length + pendingWFH.length + pendingPerms.length;

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

  if (leavesLoading || wfhLoading || permsLoading) {
    return (
      <Card className="animate-pulse h-48 bg-muted/20">
        <div />
      </Card>
    );
  }

  const getEmpName = (emp: any) => (emp ? (typeof emp === 'object' ? emp.fullName || 'Unknown Employee' : emp) : 'Unknown Employee');
  const getEmpInitials = (name: string) => name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  const getTimeAgo = (dateStr?: string) => {
    if (!dateStr) return 'Just now';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const renderAvatar = (emp: any) => {
    const empObj = typeof emp === 'object' ? emp : null;
    if (empObj?.profileImage) {
      return <img src={empObj.profileImage} alt="" className="w-10 h-10 rounded-full object-cover border border-border flex-shrink-0" />;
    }
    const empName = getEmpName(emp);
    const initials = getEmpInitials(empName);
    return (
      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm border border-primary/20 flex-shrink-0">
        {initials}
      </div>
    );
  };

  return (
    <Card className="space-y-6 text-left border border-border shadow-md bg-card p-6 flex flex-col justify-between h-full">
      <div>
        <div className="flex items-start justify-between border-b border-border pb-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2 mb-0.5">
              <Clock className="w-5 h-5 text-primary" />
              Approval Queue
            </h3>
            <p className="text-xs text-muted-foreground">
              Pending Leave & WFH requests
            </p>
          </div>
          <span className="px-3 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold border border-primary/20 uppercase tracking-wider">
            {totalPending} PENDING
          </span>
        </div>

        {totalPending === 0 ? (
          <div className="p-8 text-center bg-muted/30 rounded-2xl border border-dashed border-border my-8">
            <UserCheck className="w-12 h-12 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold text-foreground">All caught up!</p>
            <p className="text-xs text-muted-foreground mt-1">No pending approval requests in the queue.</p>
          </div>
        ) : (
          <div className="space-y-6 max-h-[500px] overflow-y-auto pr-1">
            {/* Leaves */}
            {pendingLeaves.map((item) => {
              const empObj = typeof item.employeeId === 'object' ? item.employeeId : null;
              const empName = getEmpName(item.employeeId);
              const empDept = empObj?.department || 'Design Team';
              return (
                <div key={item._id} className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4 hover:border-primary/40 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-md bg-muted text-foreground font-bold text-[10px] uppercase border border-border tracking-wider">
                      {item.leaveType}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium">{getTimeAgo((item as any).createdAt || item.appliedAt)}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    {renderAvatar(item.employeeId)}
                    <div>
                      <p className="text-sm font-bold text-foreground">{empName}</p>
                      <p className="text-xs text-muted-foreground">{empDept}</p>
                    </div>
                  </div>

                  <div className="p-3 bg-muted/40 rounded-xl border border-border flex justify-between items-center text-xs">
                    <span className="font-semibold text-muted-foreground">Duration: {item.totalDays} Day</span>
                    <span className="font-medium text-foreground">{formatDate(item.startDate)} to {formatDate(item.endDate)}</span>
                  </div>

                  <div className="p-3.5 bg-primary/5 border border-primary/10 rounded-xl text-xs text-foreground italic">
                    "{item.reason}"
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-border text-foreground hover:bg-muted font-bold"
                      onClick={() => leaveMutation.mutate({ id: item._id, status: 'REJECTED' })}
                      isLoading={leaveMutation.isPending}
                    >
                      × Reject
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-primary text-white font-bold shadow-md shadow-primary/20 hover:shadow-lg"
                      onClick={() => leaveMutation.mutate({ id: item._id, status: 'APPROVED' })}
                      isLoading={leaveMutation.isPending}
                    >
                      Approve
                    </Button>
                  </div>
                </div>
              );
            })}

            {/* WFH */}
            {pendingWFH.map((item) => {
              const empObj = typeof item.employeeId === 'object' ? item.employeeId : null;
              const empName = getEmpName(item.employeeId);
              const empDept = empObj?.department || 'Development Team';
              return (
                <div key={item._id} className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4 hover:border-primary/40 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-md bg-muted text-foreground font-bold text-[10px] uppercase border border-border tracking-wider">
                      WFH REQUEST
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium">{getTimeAgo((item as any).createdAt || item.appliedAt)}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    {renderAvatar(item.employeeId)}
                    <div>
                      <p className="text-sm font-bold text-foreground">{empName}</p>
                      <p className="text-xs text-muted-foreground">{empDept}</p>
                    </div>
                  </div>

                  <div className="p-3 bg-muted/40 rounded-xl border border-border flex justify-between items-center text-xs">
                    <span className="font-semibold text-muted-foreground">Date</span>
                    <span className="font-medium text-foreground">{formatDate(item.startDate)}</span>
                  </div>

                  <div className="p-3.5 bg-primary/5 border border-primary/10 rounded-xl text-xs text-foreground space-y-1">
                    <p><span className="font-semibold text-muted-foreground">Reason:</span> {item.reason}</p>
                    <p><span className="font-semibold text-muted-foreground">Tasks:</span> {item.expectedTasks}</p>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-border text-foreground hover:bg-muted font-bold"
                      onClick={() => wfhMutation.mutate({ id: item._id, status: 'REJECTED' })}
                      isLoading={wfhMutation.isPending}
                    >
                      × Reject
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-primary text-white font-bold shadow-md shadow-primary/20 hover:shadow-lg"
                      onClick={() => wfhMutation.mutate({ id: item._id, status: 'APPROVED' })}
                      isLoading={wfhMutation.isPending}
                    >
                      Approve
                    </Button>
                  </div>
                </div>
              );
            })}

            {/* Permissions */}
            {pendingPerms.map((item) => {
              const empObj = typeof item.employeeId === 'object' ? item.employeeId : null;
              const empName = getEmpName(item.employeeId);
              const empDept = empObj?.department || 'Operations Team';
              return (
                <div key={item._id} className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4 hover:border-primary/40 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-md bg-muted text-muted-foreground font-bold text-[10px] uppercase border border-border tracking-wider">
                      PERMISSION HOURS
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium">{getTimeAgo((item as any).createdAt || item.appliedAt)}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    {renderAvatar(item.employeeId)}
                    <div>
                      <p className="text-sm font-bold text-foreground">{empName}</p>
                      <p className="text-xs text-muted-foreground">{empDept}</p>
                    </div>
                  </div>

                  <div className="p-3 bg-muted/40 rounded-xl border border-border flex justify-between items-center text-xs">
                    <span className="font-semibold text-muted-foreground">Date: {formatDate(item.date)}</span>
                    <span className="font-medium text-foreground">{item.startTime} to {item.endTime} ({item.totalHours} hrs)</span>
                  </div>

                  <div className="p-3.5 bg-primary/5 border border-primary/10 rounded-xl text-xs text-foreground italic">
                    "{item.reason}"
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-border text-foreground hover:bg-muted font-bold"
                      onClick={() => permMutation.mutate({ id: item._id, status: 'REJECTED' })}
                      isLoading={permMutation.isPending}
                    >
                      × Reject
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-primary text-white font-bold shadow-md shadow-primary/20 hover:shadow-lg"
                      onClick={() => permMutation.mutate({ id: item._id, status: 'APPROVED' })}
                      isLoading={permMutation.isPending}
                    >
                      Approve
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Links */}
      <div className="pt-6 border-t border-border text-center space-y-2 mt-auto">
        <p className="text-xs text-muted-foreground font-medium">No other pending approvals</p>
        <button
          className="text-xs font-bold text-primary hover:underline"
          onClick={() => window.location.href = '/leaves'}
        >
          View Request History
        </button>
      </div>
    </Card>
  );
};
