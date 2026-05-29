import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceApi } from '../../api_service/attendanceApi';
import { advancedAttendanceApi } from '../../api_service/advancedAttendanceApi';
import { useAuthStore } from '../../store/useAuthStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { Card } from '../WrapperComponents/Card';
import { Button } from '../WrapperComponents/Button';
import { Modal } from '../WrapperComponents/Modal';
import { Input, Textarea } from '../WrapperComponents/Input';
import { TaskReportForm } from './TaskReportForm';
import { permissionApi } from '../../api_service/permissionApi';
import { leaveApi } from '../../api_service/leaveApi';
import { Clock, CheckCircle2, MapPin, Compass, AlertOctagon, Info, Palmtree } from 'lucide-react';

const formatElapsedTime = (ms: number): string => {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((v) => (v < 10 ? '0' + v : v))
    .join(':');
};

export const AttendanceCheckIn: React.FC = () => {
  const { user } = useAuthStore();
  const { addToast } = useNotificationStore();
  const queryClient = useQueryClient();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [activePermBlock, setActivePermBlock] = useState<{ startTime: string; endTime: string } | null>(null);
  const [pendingReportToSubmit, setPendingReportToSubmit] = useState<any>(null);
  const [retroCompletedTasks, setRetroCompletedTasks] = useState('');
  const [retroInProgress, setRetroInProgress] = useState('');
  const [retroPending, setRetroPending] = useState('');
  const [retroTomorrow, setRetroTomorrow] = useState('');
  const [retroBlockers, setRetroBlockers] = useState('');
  const [retroError, setRetroError] = useState('');

  // Advanced Geofencing State
  const [isLocChecking, setIsLocChecking] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideInput, setOverrideInput] = useState('');
  const [locCheckResult, setLocCheckResult] = useState<{
    success: boolean;
    distance: number | null;
    fenceName: string | null;
    reasonNeeded: boolean;
    errorMessage?: string;
  } | null>(null);

  // Query Hooks
  const { data: attendanceSettings } = useQuery({
    queryKey: ['attendanceSettings'],
    queryFn: advancedAttendanceApi.getSettings,
  });

  const { data: myPerms } = useQuery({
    queryKey: ['permissions'],
    queryFn: permissionApi.getAll,
    enabled: !!user,
  });

  const { data: myLeaves } = useQuery({
    queryKey: ['leaves'],
    queryFn: leaveApi.getAll,
    enabled: !!user,
  });

  const { data: pendingReports, refetch: refetchPending } = useQuery({
    queryKey: ['pendingReports'],
    queryFn: attendanceApi.getPendingReports,
    enabled: !!user,
  });

  const { data: todayAttendance, isLoading: attLoading } = useQuery({
    queryKey: ['todayAttendance'],
    queryFn: attendanceApi.getToday,
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (pendingReports && pendingReports.length > 0) {
      setPendingReportToSubmit(pendingReports[0]);
    } else {
      setPendingReportToSubmit(null);
    }
  }, [pendingReports]);

  useEffect(() => {
    if (!myPerms || myPerms.length === 0) {
      setActivePermBlock(null);
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    const currentMinutes = currentHour * 60 + currentMinute;

    const activePerm = myPerms.find((perm) => {
      if (perm.date !== todayStr || perm.approvalStatus === 'REJECTED' || perm.approvalStatus === 'CANCELLED') {
        return false;
      }

      const [startH, startM] = perm.startTime.split(':').map(Number);
      const [endH, endM] = perm.endTime.split(':').map(Number);
      const startMin = startH * 60 + startM;
      const endMin = endH * 60 + endM;

      return currentMinutes >= startMin && currentMinutes <= endMin;
    });

    if (activePerm) {
      setActivePermBlock({ startTime: activePerm.startTime, endTime: activePerm.endTime });
    } else {
      setActivePermBlock(null);
    }
  }, [myPerms, currentTime]);

  const submitRetroMutation = useMutation({
    mutationFn: async () => {
      if (!retroCompletedTasks.trim()) {
        throw new Error('Completed tasks are required.');
      }
      return attendanceApi.submitPendingReport({
        attendanceId: pendingReportToSubmit._id,
        completedTasks: retroCompletedTasks,
        inProgressTasks: retroInProgress,
        pendingTasks: retroPending,
        tomorrowPlan: retroTomorrow,
        blockers: retroBlockers || 'None',
      });
    },
    onSuccess: () => {
      addToast('Tasks Submitted Successfully', 'Your retroactive task report has been archived.', 'success');
      setRetroCompletedTasks('');
      setRetroInProgress('');
      setRetroPending('');
      setRetroTomorrow('');
      setRetroBlockers('');
      setRetroError('');
      refetchPending();
      queryClient.invalidateQueries({ queryKey: ['todayAttendance'] });
    },
    onError: (err: any) => {
      setRetroError(err.message || 'Submission failed. Please try again.');
    },
  });

  const handleRetroSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitRetroMutation.mutate();
  };

  const myAttendance = todayAttendance?.find(
    (a) =>
      a.employeeId === user?.employeeId ||
      a.employeeId === user?._id ||
      (a.employeeId &&
        typeof a.employeeId === 'object' &&
        (a.employeeId._id === user?.employeeId || a.employeeId._id === user?._id))
  );

  const isCheckedIn = myAttendance && !myAttendance.logoutTime;
  const elapsedMs = isCheckedIn ? currentTime.getTime() - new Date(myAttendance.loginTime).getTime() : 0;
  const elapsedStr = formatElapsedTime(elapsedMs);

  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  
  const todayStr = currentTime.toISOString().split('T')[0];
  const hasApprovedPermissionToday = myPerms?.some(
    (perm) => perm.date === todayStr && perm.approvalStatus === 'APPROVED'
  ) || false;

  const isBeforeCheckoutTime = (currentHour < 17 || (currentHour === 17 && currentMinute < 40)) && !hasApprovedPermissionToday;

  const checkInMutation = useMutation({
    mutationFn: (override?: string) =>
      attendanceApi.checkIn({
        employeeId: user?.employeeId || user?._id || 'emp-dev-001',
        deviceInfo: navigator.userAgent,
        overrideReason: override,
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['todayAttendance'] });
      if (data?.warning) {
        addToast('Check-In Warning', data.warning, 'warning');
      } else {
        addToast('Check-In Successful', 'Your attendance has been recorded for today.', 'success');
      }
      setShowOverrideModal(false);
      setLocCheckResult(null);
      setOverrideInput('');
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      const msg = error.response?.data?.message || 'Check-in failed. Please try again.';
      addToast('Check-In Failed', msg, 'error');
    },
  });

  const triggerCheckIn = (overrideReason?: string) => {
    checkInMutation.mutate(overrideReason);
  };

  const handleCheckInClick = () => {
    const activeFences = attendanceSettings?.fences?.filter((f) => f.isActive) || [];

    // If there are no geofences configured on the server, proceed with straight check-in
    if (activeFences.length === 0) {
      triggerCheckIn();
      return;
    }

    // Geolocation Verification
    if (!navigator.geolocation) {
      setLocCheckResult({
        success: false,
        distance: null,
        fenceName: null,
        reasonNeeded: true,
        errorMessage: 'Geolocation is not supported by your browser.',
      });
      setShowOverrideModal(true);
      return;
    }

    setIsLocChecking(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const verification = await advancedAttendanceApi.validateLocation(latitude, longitude);

          if (verification.inRange) {
            // Within Geofence - check in automatically
            addToast('Location Verified', `Successfully matched location within geofence: ${verification.fenceName}`, 'success');
            triggerCheckIn();
          } else {
            // Outside Geofence range
            setLocCheckResult({
              success: false,
              distance: verification.distance,
              fenceName: verification.fenceName,
              reasonNeeded: true,
              errorMessage: `You are outside active geofenced office premises. (Closest fence: ${verification.fenceName || 'N/A'}, Distance: ${verification.distance ? `${verification.distance}m` : 'Unknown'})`,
            });
            setShowOverrideModal(true);
          }
        } catch (err: any) {
          setLocCheckResult({
            success: false,
            distance: null,
            fenceName: null,
            reasonNeeded: true,
            errorMessage: 'Could not validate GPS coordinates with server settings.',
          });
          setShowOverrideModal(true);
        } finally {
          setIsLocChecking(false);
        }
      },
      (error) => {
        let msg = 'GPS Permission denied or location request timed out.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Location access denied. Please enable GPS permissions or state your check-in reason.';
        }
        setLocCheckResult({
          success: false,
          distance: null,
          fenceName: null,
          reasonNeeded: true,
          errorMessage: msg,
        });
        setIsLocChecking(false);
        setShowOverrideModal(true);
      },
      { enableHighAccuracy: true, timeout: 7000 }
    );
  };

  const handleOverrideSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideInput.trim()) {
      addToast('Reason Required', 'You must provide a valid check-in override reason.', 'warning');
      return;
    }
    triggerCheckIn(overrideInput.trim());
  };

  if (attLoading) {
    return (
      <Card className="animate-pulse h-48 bg-muted/20">
        <div />
      </Card>
    );
  }

  const localToday = new Date();
  const year = localToday.getFullYear();
  const month = String(localToday.getMonth() + 1).padStart(2, '0');
  const day = String(localToday.getDate()).padStart(2, '0');
  const localTodayStr = `${year}-${month}-${day}`;

  const myEmpId = user?.employeeId || user?._id;

  const hasApprovedLeaveToday = myLeaves?.some((l) => {
    const lEmpId = typeof l.employeeId === 'object' && l.employeeId !== null ? l.employeeId._id : l.employeeId;
    return (
      lEmpId === myEmpId &&
      l.status === 'APPROVED' &&
      l.leaveType !== 'WFH' &&
      localTodayStr >= l.startDate &&
      localTodayStr <= l.endDate
    );
  }) ?? false;

  if (hasApprovedLeaveToday) {
    return (
      <Card className="relative overflow-hidden border-l-4 border-primary shadow-xl bg-card">
        <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
          <Palmtree className="w-36 h-36 text-primary" />
        </div>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10 p-2">
          <div className="space-y-2 text-left">
            <h3 className="text-xl font-bold text-foreground">You are on Approved Leave Today</h3>
            <p className="text-xs text-muted-foreground">
              Enjoy your time off! The check-in and checkout system is disabled for today as your leave request has been approved.
            </p>
          </div>
          <div className="px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            On Leave Duty-Free
          </div>
        </div>
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
          <div>
            <h2 className="text-3xl font-extrabold text-foreground tracking-tight">
              {isCheckedIn
                ? elapsedStr
                : currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </h2>
            <p className="text-sm font-medium text-muted-foreground mt-0.5">
              {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <div className="flex flex-wrap gap-4 items-center pt-2">
           
            {attendanceSettings?.fences && attendanceSettings.fences.length > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black uppercase tracking-wider text-primary">
                <MapPin className="w-3.5 h-3.5" /> Geofencing Active
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-stretch sm:items-end gap-3 w-full sm:w-auto">
          {!myAttendance ? (
            <Button
              size="lg"
              onClick={handleCheckInClick}
              isLoading={checkInMutation.isPending || isLocChecking}
              disabled={!!activePermBlock}
              className={`w-full sm:w-auto font-bold tracking-wider shadow-lg transition-all scale-105 my-2 ${
                activePermBlock
                  ? 'bg-muted text-muted-foreground border border-border pointer-events-none opacity-60'
                  : 'bg-gradient-to-r from-primary to-accent text-white shadow-primary/30 hover:shadow-xl hover:shadow-primary/40'
              }`}
            >
              {activePermBlock ? (
                <>
                  <Clock className="w-5 h-5 mr-2 text-destructive animate-pulse" />
                  LOCKED (PERMISSION {activePermBlock.startTime}-{activePermBlock.endTime})
                </>
              ) : isLocChecking ? (
                <>
                  <Compass className="w-5 h-5 mr-2 animate-spin" />
                  LOCATING GPS...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  CHECK IN NOW
                </>
              )}
            </Button>
          ) : !myAttendance.logoutTime ? (
            <div className="flex flex-col items-stretch sm:items-end gap-2 w-full">
              <div className="px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-bold flex items-center gap-2 self-start sm:self-end">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                Checked In at {new Date(myAttendance.loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {myAttendance.overrideReason && (
                  <span className="ml-2 italic text-primary/80 font-normal border-l border-primary/30 pl-2">
                    Override: {myAttendance.overrideReason}
                  </span>
                )}
              </div>
              {isBeforeCheckoutTime ? (
                <div className="w-full sm:w-auto flex flex-col items-stretch sm:items-end gap-1">
                  <Button
                    size="lg"
                    disabled
                    className="w-full sm:w-auto font-bold tracking-wider bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-60"
                  >
                    CHECK OUT LOCKED
                  </Button>
                  <p className="text-[10px] font-bold text-destructive animate-pulse text-right">
                    Checkout available after 5:40 PM
                  </p>
                </div>
              ) : (
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={() => setShowTaskModal(true)}
                  className="w-full sm:w-auto font-bold tracking-wider shadow-lg shadow-destructive/30"
                >
                  CHECK OUT & SUBMIT TASK
                </Button>
              )}
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

      {/* Geofence Check Override / Fail Modal */}
      <Modal
        isOpen={showOverrideModal}
        onClose={() => {
          if (!checkInMutation.isPending) {
            setShowOverrideModal(false);
          }
        }}
        title="Check-In Range Security Check"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleOverrideSubmit} className="space-y-4 text-left">
          <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex gap-3 text-yellow-700 dark:text-yellow-400">
            <AlertOctagon className="w-6 h-6 flex-shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold uppercase tracking-wider">Secure Location Clearance Required</p>
              <p className="leading-relaxed font-semibold">
                {locCheckResult?.errorMessage || 'You must declare a check-in override reason to log attendance.'}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-muted border border-border flex gap-2.5 text-xs text-muted-foreground leading-relaxed">
            <Info className="w-4 h-4 text-foreground flex-shrink-0 mt-0.5" />
            <p>
              Your current device coordinate request is outside authorized geofences. Stating a valid business reason (e.g. <strong>"WFH - Client Office"</strong> or <strong>"GPS Signal Lock Issue"</strong>) registers an audit override request to HR logs.
            </p>
          </div>

          <Input
            label="Provide Override Reason *"
            value={overrideInput}
            onChange={(e) => setOverrideInput(e.target.value)}
            placeholder="e.g. Working from remote home branch office today"
            required
            autoFocus
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button
              variant="outline"
              type="button"
              onClick={() => setShowOverrideModal(false)}
              disabled={checkInMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={checkInMutation.isPending}
              className="bg-primary text-white font-bold"
            >
              Confirm Override & Check-In
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

      {/* Retroactive Task Report Modal for Forgotten Checkout */}
      {pendingReportToSubmit && (
        <Modal
          isOpen={true}
          onClose={() => {}}
          preventClose={true}
          title="Forgotten Checkout: Daily Task Report Required"
          maxWidth="max-w-2xl"
        >
          <form onSubmit={handleRetroSubmit} className="space-y-4 text-left p-2">
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-1 leading-relaxed animate-in fade-in duration-300">
              <span className="font-bold uppercase flex items-center gap-1.5">
                <AlertOctagon className="w-4 h-4" /> RETROACTIVE REPORT REQUIRED
              </span>
              <p>
                You forgot to check out on <strong className="font-mono">{pendingReportToSubmit.date}</strong>. The system has automatically resolved your checkout status and calculated exactly <strong>9 working hours</strong> for that date.
              </p>
              <p className="font-semibold mt-1">
                You must submit your tasks and daily report for {pendingReportToSubmit.date} to unlock and use the HRMS application.
              </p>
            </div>

            {retroError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs font-bold text-red-500">
                {retroError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Textarea
                label="Completed Tasks *"
                placeholder="List tasks fully completed on that day..."
                value={retroCompletedTasks}
                onChange={(e) => setRetroCompletedTasks(e.target.value)}
                required
              />

              <Textarea
                label="In Progress Tasks"
                placeholder="Tasks currently in progress..."
                value={retroInProgress}
                onChange={(e) => setRetroInProgress(e.target.value)}
              />

              <Textarea
                label="Pending Tasks"
                placeholder="Tasks yet to be started..."
                value={retroPending}
                onChange={(e) => setRetroPending(e.target.value)}
              />

              <Textarea
                label="Plan for Next Day"
                placeholder="Outline what you planned to work on next..."
                value={retroTomorrow}
                onChange={(e) => setRetroTomorrow(e.target.value)}
              />
            </div>

            <Textarea
              label="Issues / Blockers"
              placeholder="List any blockers or write None..."
              value={retroBlockers}
              onChange={(e) => setRetroBlockers(e.target.value)}
            />

            <div className="flex justify-end pt-4 border-t border-border">
              <Button
                type="submit"
                isLoading={submitRetroMutation.isPending}
                className="w-full sm:w-auto bg-gradient-to-r from-primary to-accent text-white font-bold tracking-wider shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform duration-200"
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                SUBMIT RETROACTIVE REPORT & UNLOCK
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  );
};
