import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceApi } from '../../api_service/attendanceApi';
import { advancedAttendanceApi } from '../../api_service/advancedAttendanceApi';
import { useAuthStore } from '../../store/useAuthStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { Card } from '../WrapperComponents/Card';
import { Button } from '../WrapperComponents/Button';
import { Modal } from '../WrapperComponents/Modal';
import { Input } from '../WrapperComponents/Input';
import { TaskReportForm } from './TaskReportForm';
import { Clock, CheckCircle2, ShieldCheck, MapPin, Compass, AlertOctagon, Info } from 'lucide-react';

export const AttendanceCheckIn: React.FC = () => {
  const { user } = useAuthStore();
  const { addToast } = useNotificationStore();
  const queryClient = useQueryClient();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [showTaskModal, setShowTaskModal] = useState(false);

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

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch settings to check if geofences exist
  const { data: attendanceSettings } = useQuery({
    queryKey: ['attendanceSettings'],
    queryFn: advancedAttendanceApi.getSettings,
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
        deviceInfo: navigator.userAgent,
        overrideReason: override,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todayAttendance'] });
      addToast('Check-In Successful', 'Your attendance has been recorded for today.', 'success');
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

  return (
    <Card className="relative overflow-hidden border-l-4 border-primary shadow-xl">
      <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
        <Clock className="w-36 h-36 text-primary" />
      </div>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
        <div className="space-y-3 text-left">
          <div>
            <h2 className="text-3xl font-extrabold text-foreground tracking-tight">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </h2>
            <p className="text-sm font-medium text-muted-foreground mt-0.5">
              {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <div className="flex flex-wrap gap-4 items-center pt-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-foreground tracking-wide">
                Device: <span className="text-muted-foreground font-normal">{navigator.userAgent.slice(0, 40)}...</span>
              </span>
            </div>
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
              className="w-full sm:w-auto bg-gradient-to-r from-primary to-accent text-white font-bold tracking-wider shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all scale-105 my-2"
            >
              {isLocChecking ? (
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
    </Card>
  );
};
