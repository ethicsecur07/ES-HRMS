import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveApi } from '../../api_service/leaveApi';
import { wfhApi } from '../../api_service/wfhApi';
import { permissionApi } from '../../api_service/permissionApi';
import { useNotificationStore } from '../../store/useNotificationStore';
import { Card } from '../WrapperComponents/Card';
import { Button } from '../WrapperComponents/Button';
import { formatDate } from '../../utils/formatters';
import { CheckCircle2, XCircle, Clock, Palmtree, Laptop, UserCheck } from 'lucide-react';

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

  return (
    <Card className="space-y-6 text-left border-l-4 border-l-primary shadow-md">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h3 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            HR Approval Queue
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pending leave, WFH, and permission hour requests requiring HR action
          </p>
        </div>
        <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
          {totalPending} Pending
        </span>
      </div>

      {totalPending === 0 ? (
        <div className="p-8 text-center bg-muted/30 rounded-2xl border border-dashed border-border">
          <UserCheck className="w-12 h-12 text-muted-foreground mx-auto mb-2 opacity-50" />
          <p className="text-sm font-semibold text-foreground">All caught up!</p>
          <p className="text-xs text-muted-foreground mt-1">No pending approval requests in the queue.</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
          {/* Leaves */}
          {pendingLeaves.map((item) => (
            <div key={item._id} className="p-4 rounded-xl border border-border bg-card shadow-sm hover:border-primary/40 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Palmtree className="w-3 h-3" /> {item.leaveType}
                  </span>
                  <span className="text-xs font-bold text-foreground">
                    {typeof item.employeeId === 'object' ? item.employeeId.fullName : 'Logapriyan M'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-medium">
                  {formatDate(item.startDate)} to {formatDate(item.endDate)} ({item.totalDays} days)
                </p>
                <p className="text-xs text-foreground italic bg-muted/40 p-2 rounded-lg border border-border mt-2">
                  "{item.reason}"
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => leaveMutation.mutate({ id: item._id, status: 'REJECTED' })}
                  isLoading={leaveMutation.isPending}
                >
                  <XCircle className="w-4 h-4 mr-1" /> Reject
                </Button>
                <Button
                  size="sm"
                  onClick={() => leaveMutation.mutate({ id: item._id, status: 'APPROVED' })}
                  isLoading={leaveMutation.isPending}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                </Button>
              </div>
            </div>
          ))}

          {/* WFH */}
          {pendingWFH.map((item) => (
            <div key={item._id} className="p-4 rounded-xl border border-border bg-card shadow-sm hover:border-primary/40 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-foreground/10 text-foreground text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Laptop className="w-3 h-3" /> WFH Request
                  </span>
                  <span className="text-xs font-bold text-foreground">
                    {typeof item.employeeId === 'object' ? item.employeeId.fullName : 'Vikram Mehta'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-medium">
                  Date: {formatDate(item.startDate)}
                </p>
                <div className="text-xs text-foreground bg-muted/40 p-2.5 rounded-lg border border-border mt-2 space-y-1">
                  <p><span className="font-semibold text-muted-foreground">Reason:</span> {item.reason}</p>
                  <p><span className="font-semibold text-muted-foreground">Expected Tasks:</span> {item.expectedTasks}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => wfhMutation.mutate({ id: item._id, status: 'REJECTED' })}
                  isLoading={wfhMutation.isPending}
                >
                  <XCircle className="w-4 h-4 mr-1" /> Reject
                </Button>
                <Button
                  size="sm"
                  onClick={() => wfhMutation.mutate({ id: item._id, status: 'APPROVED' })}
                  isLoading={wfhMutation.isPending}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                </Button>
              </div>
            </div>
          ))}

          {/* Permissions */}
          {pendingPerms.map((item) => (
            <div key={item._id} className="p-4 rounded-xl border border-border bg-card shadow-sm hover:border-primary/40 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-muted text-muted-foreground border border-border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Permission Hours
                  </span>
                  <span className="text-xs font-bold text-foreground">
                    {typeof item.employeeId === 'object' ? item.employeeId.fullName : 'Ravi Kumar'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-medium">
                  Date: {formatDate(item.date)} | Time: {item.startTime} to {item.endTime} ({item.totalHours} hrs)
                </p>
                <p className="text-xs text-foreground italic bg-muted/40 p-2 rounded-lg border border-border mt-2">
                  "{item.reason}"
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => permMutation.mutate({ id: item._id, status: 'REJECTED' })}
                  isLoading={permMutation.isPending}
                >
                  <XCircle className="w-4 h-4 mr-1" /> Reject
                </Button>
                <Button
                  size="sm"
                  onClick={() => permMutation.mutate({ id: item._id, status: 'APPROVED' })}
                  isLoading={permMutation.isPending}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
