import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceApi } from '../../api_service/attendanceApi';
import { useAuthStore } from '../../store/useAuthStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { Card } from '../WrapperComponents/Card';
import { Button } from '../WrapperComponents/Button';
import { Input } from '../WrapperComponents/Input';
import { Modal } from '../WrapperComponents/Modal';
import { TaskReportForm } from './TaskReportForm';
import { Wifi, Clock, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

export const AttendanceCheckIn: React.FC = () => {
  const { user } = useAuthStore();
  const { addToast } = useNotificationStore();
  const queryClient = useQueryClient();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [showTaskModal, setShowTaskModal] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: ipData, isLoading: ipLoading } = useQuery({
    queryKey: ['verifyIP'],
    queryFn: attendanceApi.verifyOfficeIP,
  });

  const { data: todayAttendance, isLoading: attLoading } = useQuery({
    queryKey: ['todayAttendance'],
    queryFn: attendanceApi.getToday,
  });

  const myAttendance = todayAttendance?.find(
    (a) =>
      a.employeeId === user?.employeeId ||
      a.employeeId === user?._id ||
      (a.employeeId &&
        typeof a.employeeId === 'object' &&
        (a.employeeId._id === user?.employeeId || a.employeeId._id === user?._id))
  );

  const checkInMutation = useMutation({
    mutationFn: (override?: string) =>
      attendanceApi.checkIn({
        employeeId: user?.employeeId || user?._id || 'emp-dev-001',
        ipAddress: ipData?.currentIP || '192.168.29.50',
        deviceInfo: navigator.userAgent,
        overrideReason: override,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todayAttendance'] });
      addToast('Check-In Successful', 'Your attendance has been recorded for today.', 'success');
      setShowOverrideModal(false);
      setOverrideReason('');
    },
    onError: (error: any) => {
      const msg = error.response?.data?.message || 'Please verify your office IP or apply for WFH override.';
      addToast('Check-In Failed', msg, 'error');
    },
  });

  const handleCheckInClick = () => {
    if (ipData?.isOfficeIP) {
      checkInMutation.mutate(undefined);
    } else {
      setShowOverrideModal(true);
    }
  };

  const handleOverrideSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideReason.trim()) {
      addToast('Error', 'Override reason is mandatory', 'error');
      return;
    }
    checkInMutation.mutate(overrideReason);
  };

  if (ipLoading || attLoading) {
    return (
      <Card className="animate-pulse h-48 bg-muted/20">
        <div />
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden border-l-4 border-primary shadow-xl">
      <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
        <Clock className="w-36 h-36 text-primary" />
      </div>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
        <div className="space-y-3 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-xs font-semibold text-muted-foreground border border-border">
            <Wifi className={`w-3.5 h-3.5 ${ipData?.isOfficeIP ? 'text-primary' : 'text-muted-foreground'}`} />
            <span>IP Status: {ipData?.isOfficeIP ? 'Office Network Verified' : 'Outside Office IP'}</span>
            <span className="text-[10px] font-mono text-muted-foreground/80">({ipData?.currentIP})</span>
          </div>

          <div>
            <h2 className="text-3xl font-extrabold text-foreground tracking-tight">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </h2>
            <p className="text-sm font-medium text-muted-foreground mt-0.5">
              {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-foreground tracking-wide">
              Device: <span className="text-muted-foreground font-normal">{navigator.userAgent.slice(0, 45)}...</span>
            </span>
          </div>
        </div>

        <div className="flex flex-col items-stretch sm:items-end gap-3 w-full sm:w-auto">
          {!myAttendance ? (
            <Button
              size="lg"
              onClick={handleCheckInClick}
              isLoading={checkInMutation.isPending}
              className="w-full sm:w-auto bg-gradient-to-r from-primary to-accent text-white font-bold tracking-wider shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all scale-105 my-2"
            >
              <CheckCircle2 className="w-5 h-5 mr-2" />
              CHECK IN NOW
            </Button>
          ) : !myAttendance.logoutTime ? (
            <div className="flex flex-col items-stretch sm:items-end gap-2 w-full">
              <div className="px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-bold flex items-center gap-2 self-start sm:self-end">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                Checked In at {new Date(myAttendance.loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <Button
                size="lg"
                variant="destructive"
                onClick={() => setShowTaskModal(true)}
                className="w-full sm:w-auto font-bold tracking-wider shadow-lg shadow-destructive/30"
              >
                CHECK OUT & SUBMIT TASK
              </Button>
            </div>
          ) : (
            <div className="px-5 py-3 rounded-xl bg-muted border border-border text-muted-foreground text-sm font-bold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              Checked Out at {new Date(myAttendance.logoutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              <span className="ml-2 px-2 py-0.5 rounded bg-background text-foreground text-xs font-mono">
                {myAttendance.workingHours} hrs
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Override WFH Modal */}
      <Modal
        isOpen={showOverrideModal}
        onClose={() => setShowOverrideModal(false)}
        title="Remote IP Attendance Override"
      >
        <form onSubmit={handleOverrideSubmit} className="space-y-4 text-left">
          <div className="p-4 rounded-xl bg-foreground/10 border border-border flex items-start gap-3 text-foreground text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
            <div>
              <p className="font-bold">Outside Office IP Detected</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                You are logging in from an external IP ({ipData?.currentIP}). Please provide your approved WFH reason or override justification.
              </p>
            </div>
          </div>

          <Input
            label="Override Justification / WFH Approval Ref"
            placeholder="e.g. Approved WFH by HR Sarah / Client visit at location"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            required
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setShowOverrideModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={checkInMutation.isPending}>
              Submit & Check In
            </Button>
          </div>
        </form>
      </Modal>

      {/* Task Report Modal before Checkout */}
      <Modal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        title="Mandatory Daily Task Report"
        maxWidth="max-w-2xl"
      >
        <TaskReportForm
          attendanceId={myAttendance?._id || ''}
          onCompleted={() => {
            setShowTaskModal(false);
            queryClient.invalidateQueries({ queryKey: ['todayAttendance'] });
          }}
        />
      </Modal>
    </Card>
  );
};
