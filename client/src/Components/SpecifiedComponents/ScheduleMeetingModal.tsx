import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { meetingApi } from '../../api_service/meetingApi';
import { employeeApi } from '../../api_service/employeeApi';
import { useNotificationStore } from '../../store/useNotificationStore';
import type { Employee } from '../../types';
import { Modal } from '../WrapperComponents/Modal';
import { Button } from '../WrapperComponents/Button';
import { Input } from '../WrapperComponents/Input';
import {
  Video,
  Calendar,
  Clock,
  Users,
  X,
  Plus,
  FileText,
  Briefcase,
} from 'lucide-react';

type MeetingType = 'INTERVIEW' | 'CLIENT' | 'TEAM';

interface Attendee {
  name: string;
  email: string;
  role?: string;
}

interface ScheduleMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: MeetingType;
  // Pre-fill for recruitment
  candidateId?: string;
  candidateName?: string;
  candidateEmail?: string;
  candidateRole?: string;
  // Pre-fill for projects
  projectId?: string;
  projectName?: string;
  // Callback on success
  onSuccess?: (data: any) => void;
}

const MEETING_TYPE_OPTIONS: { value: MeetingType; label: string; icon: React.ReactNode; color: string }[] = [
  {
    value: 'INTERVIEW',
    label: 'Hiring Interview',
    icon: <Briefcase className="w-4 h-4" />,
    color: 'border-purple-500/30 bg-purple-500/10 text-purple-500',
  },
  {
    value: 'CLIENT',
    label: 'Client Meeting',
    icon: <Users className="w-4 h-4" />,
    color: 'border-blue-500/30 bg-blue-500/10 text-blue-500',
  },
  {
    value: 'TEAM',
    label: 'Team Meeting',
    icon: <Video className="w-4 h-4" />,
    color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500',
  },
];

export const ScheduleMeetingModal: React.FC<ScheduleMeetingModalProps> = ({
  isOpen,
  onClose,
  defaultType = 'TEAM',
  candidateId,
  candidateName,
  candidateEmail,
  candidateRole,
  projectId,
  projectName,
  onSuccess,
}) => {
  const { addToast } = useNotificationStore();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [meetingType, setMeetingType] = useState<MeetingType>(defaultType);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState('');
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [newAttendeeName, setNewAttendeeName] = useState('');
  const [newAttendeeEmail, setNewAttendeeEmail] = useState('');
  const [interviewer, setInterviewer] = useState('');
  const [interviewerEmail, setInterviewerEmail] = useState('');
  const [successResult, setSuccessResult] = useState<{ joinUrl: string } | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [interviewerSearch, setInterviewerSearch] = useState('');
  const [interviewerDropdownOpen, setInterviewerDropdownOpen] = useState(false);
  const interviewerRef = useRef<HTMLDivElement>(null);

  // Close interviewer dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (interviewerRef.current && !interviewerRef.current.contains(e.target as Node)) {
        setInterviewerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Helper to extract initials safely
  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';
  };

  // Fetch employees for attendee suggestions
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['employees-for-meeting'],
    queryFn: async () => {
      const res = await employeeApi.getAll();
      return res?.employees || [];
    },
    enabled: isOpen,
  });

  // Filter interviewers based on search query
  const filteredInterviewers = employees.filter((emp) => {
    const q = interviewerSearch.toLowerCase();
    return (
      !q ||
      emp.fullName?.toLowerCase().includes(q) ||
      emp.email?.toLowerCase().includes(q) ||
      emp.designation?.toLowerCase().includes(q) ||
      emp.department?.toLowerCase().includes(q)
    );
  });

  // Filter employees for attendee list based on search query
  const filteredEmployeesForAttendees = employees.filter((emp) => {
    const q = employeeSearch.toLowerCase();
    return (
      !q ||
      emp.fullName?.toLowerCase().includes(q) ||
      emp.email?.toLowerCase().includes(q) ||
      emp.designation?.toLowerCase().includes(q) ||
      emp.department?.toLowerCase().includes(q)
    );
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setMeetingType(defaultType);
      setSuccessResult(null);
      setNotes('');
      setAttendees([]);
      setNewAttendeeName('');
      setNewAttendeeEmail('');
      setInterviewer('');
      setInterviewerEmail('');
      setInterviewerSearch('');
      setInterviewerDropdownOpen(false);

      // Set smart defaults based on context
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setStartDate(tomorrow.toISOString().split('T')[0]);
      setStartTime('10:00');
      setDuration(60);

      if (defaultType === 'INTERVIEW' && candidateName) {
        setTitle(`Interview: ${candidateName} — ${candidateRole || 'Position'}`);
        if (candidateEmail) {
          setAttendees([{ name: candidateName, email: candidateEmail, role: 'Candidate' }]);
        }
      } else if (defaultType === 'CLIENT' && projectName) {
        setTitle(`Client Meeting: ${projectName}`);
      } else {
        setTitle('');
      }
    }
  }, [isOpen, defaultType, candidateName, candidateEmail, candidateRole, projectName]);

  // Create general meeting mutation
  const createMeetingMutation = useMutation({
    mutationFn: () => {
      const startDateTime = new Date(`${startDate}T${startTime}:00`).toISOString();
      const endDate = new Date(`${startDate}T${startTime}:00`);
      endDate.setMinutes(endDate.getMinutes() + duration);

      return meetingApi.create({
        title,
        meetingType,
        startDateTime,
        endDateTime: endDate.toISOString(),
        attendees,
        candidateId: candidateId || undefined,
        projectId: projectId || undefined,
        notes: notes || undefined,
      });
    },
    onSuccess: (data) => {
      addToast('Meeting Scheduled', 'Teams meeting has been created successfully.', 'success');
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      setSuccessResult({ joinUrl: data.joinUrl });
      onSuccess?.(data);
    },
    onError: (error: any) => {
      addToast('Meeting Failed', error?.response?.data?.message || error.message || 'Could not create Teams meeting.', 'error');
    },
  });

  // Interview-specific mutation
  const scheduleInterviewMutation = useMutation({
    mutationFn: () => {
      if (!candidateId) throw new Error('No candidate selected');
      const dateTime = new Date(`${startDate}T${startTime}:00`).toISOString();
      return meetingApi.scheduleInterview(candidateId, {
        date: dateTime,
        interviewer,
        interviewerEmail: interviewerEmail || undefined,
        duration,
        notes: notes || undefined,
        attendees: attendees.filter(a => a.role !== 'Candidate'),
      });
    },
    onSuccess: (data) => {
      addToast('Interview Scheduled', 'Teams interview meeting has been created and candidate notified.', 'success');
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      setSuccessResult({ joinUrl: data.joinUrl });
      onSuccess?.(data);
    },
    onError: (error: any) => {
      addToast('Interview Scheduling Failed', error?.response?.data?.message || error.message || 'Could not schedule interview.', 'error');
    },
  });

  const handleAddAttendee = () => {
    if (!newAttendeeEmail.trim()) return;
    const name = newAttendeeName.trim() || newAttendeeEmail.split('@')[0];
    setAttendees((prev) => [...prev, { name, email: newAttendeeEmail.trim() }]);
    setNewAttendeeName('');
    setNewAttendeeEmail('');
  };

  const handleRemoveAttendee = (index: number) => {
    setAttendees((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddEmployeeAsAttendee = (emp: any) => {
    const alreadyAdded = attendees.some((a) => a.email === emp.email);
    if (alreadyAdded) return;
    setAttendees((prev) => [...prev, { name: emp.fullName, email: emp.email, role: 'Employee' }]);
  };

  const handleSelectInterviewer = (emp: any) => {
    setInterviewer(emp.fullName);
    setInterviewerEmail(emp.email);
    setInterviewerSearch('');
    setInterviewerDropdownOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (meetingType === 'INTERVIEW' && candidateId) {
      scheduleInterviewMutation.mutate();
    } else {
      createMeetingMutation.mutate();
    }
  };

  const isLoading = createMeetingMutation.isPending || scheduleInterviewMutation.isPending;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Schedule Teams Meeting" maxWidth="max-w-2xl">
      {successResult ? (
        /* ── Success Screen ── */
        <div className="text-center py-6 space-y-5">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center">
            <Video className="w-8 h-8 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground mb-1">Meeting Scheduled!</h3>
            <p className="text-sm text-muted-foreground">Your Teams meeting has been created successfully.</p>
          </div>

          <div className="bg-muted/30 border border-border rounded-xl p-4 text-left space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Teams Join Link</p>
            <a
              href={successResult.joinUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary font-semibold hover:underline break-all"
            >
              {successResult.joinUrl}
            </a>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(successResult.joinUrl);
                addToast('Copied', 'Teams link copied to clipboard.', 'success');
              }}
            >
              Copy Link
            </Button>
            <a href={successResult.joinUrl} target="_blank" rel="noreferrer">
              <Button>
                <Video className="w-4 h-4 mr-1.5" /> Open in Teams
              </Button>
            </a>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      ) : (
        /* ── Schedule Form ── */
        <form onSubmit={handleSubmit} className="space-y-5 text-left">
          {/* Meeting Type Selector */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Meeting Type
            </label>
            <div className="flex gap-3">
              {MEETING_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMeetingType(opt.value)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 text-sm font-bold transition-all duration-200 ${
                    meetingType === opt.value
                      ? `${opt.color} ring-1 ring-current shadow-sm`
                      : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  {opt.icon}
                  <span className="hidden sm:inline">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <Input
            label="Meeting Title *"
            placeholder="e.g. Sprint Planning or Interview with John"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          {/* Date, Time, Duration */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                <Calendar className="w-3 h-3 inline mr-1" /> Date *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full bg-background text-foreground border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                <Clock className="w-3 h-3 inline mr-1" /> Time *
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="w-full bg-background text-foreground border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                Duration
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full bg-background text-foreground border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
            </div>
          </div>

          {/* Interviewer — searchable employee picker */}
          {meetingType === 'INTERVIEW' && (
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                <Briefcase className="w-3 h-3 inline mr-1" /> Interviewer *
              </label>

              {/* Selected interviewer chip */}
              {interviewer ? (
                <div className="flex items-center gap-3 px-3 py-2.5 bg-primary/10 border border-primary/25 rounded-xl mb-2">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
                    {getInitials(interviewer)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{interviewer}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{interviewerEmail}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setInterviewer(''); setInterviewerEmail(''); setInterviewerDropdownOpen(true); }}
                    className="text-muted-foreground hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-500/10"
                    title="Change interviewer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative" ref={interviewerRef}>
                  <div className="flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-xl mb-1 focus-within:ring-1 focus-within:ring-primary">
                    <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <input
                      type="text"
                      placeholder="Search & select interviewer from employees..."
                      value={interviewerSearch}
                      onChange={(e) => { setInterviewerSearch(e.target.value); setInterviewerDropdownOpen(true); }}
                      onFocus={() => setInterviewerDropdownOpen(true)}
                      className="flex-1 bg-transparent text-foreground text-sm focus:outline-none placeholder:text-muted-foreground"
                    />
                  </div>

                  {/* Employee dropdown */}
                  {interviewerDropdownOpen && (
                    <div className="absolute left-0 right-0 z-50 mt-1 bg-background border border-border rounded-xl shadow-xl max-h-52 overflow-y-auto divide-y divide-border">
                      {filteredInterviewers.map((emp) => (
                        <button
                          key={emp._id}
                          type="button"
                          onClick={() => handleSelectInterviewer(emp)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/60 text-left transition-all"
                        >
                          <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                            {getInitials(emp.fullName)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{emp.fullName}</p>
                            {(emp.designation || emp.department) && (
                              <p className="text-[11px] text-muted-foreground truncate">
                                {[emp.designation, emp.department].filter(Boolean).join(' · ')}
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                            Select
                          </span>
                        </button>
                      ))}
                      {filteredInterviewers.length === 0 && (
                        <div className="py-5 text-center text-xs text-muted-foreground">
                          No employees match "{interviewerSearch}"
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Attendees */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              <Users className="w-3 h-3 inline mr-1" /> Attendees
            </label>

            {/* Current attendees */}
            {attendees.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {attendees.map((att, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold"
                  >
                    {att.name} ({att.email})
                    <button
                      type="button"
                      onClick={() => handleRemoveAttendee(idx)}
                      className="hover:text-red-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Add attendee manually */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Name"
                value={newAttendeeName}
                onChange={(e) => setNewAttendeeName(e.target.value)}
                className="flex-1 bg-background text-foreground border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <input
                type="email"
                placeholder="Email"
                value={newAttendeeEmail}
                onChange={(e) => setNewAttendeeEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAttendee())}
                className="flex-1 bg-background text-foreground border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={handleAddAttendee}
                disabled={!newAttendeeEmail.trim()}
                className="flex items-center gap-1 text-xs font-bold text-primary border border-primary/30 bg-primary/10 hover:bg-primary/20 px-3 py-2 rounded-lg transition-all disabled:opacity-40"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>

            {/* Searchable employee list */}
            {employees.length > 0 && (
              <div className="mt-3 border border-border rounded-xl overflow-hidden">
                <div className="px-3 py-2 bg-muted/30 border-b border-border flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Company Employees ({filteredEmployeesForAttendees.length})
                  </span>
                  <input
                    type="text"
                    placeholder="Search employees..."
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    className="ml-auto w-36 bg-background text-foreground border border-border rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-border">
                  {filteredEmployeesForAttendees.map((emp) => {
                    const isAdded = attendees.some((a) => a.email === emp.email);
                    return (
                      <button
                        key={emp._id}
                        type="button"
                        onClick={() => handleAddEmployeeAsAttendee(emp)}
                        disabled={isAdded}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-all ${
                          isAdded
                            ? 'bg-emerald-500/5 cursor-default'
                            : 'hover:bg-muted/50 cursor-pointer'
                        }`}
                      >
                        {/* Avatar initials */}
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          isAdded ? 'bg-emerald-500/20 text-emerald-500' : 'bg-primary/15 text-primary'
                        }`}>
                          {getInitials(emp.fullName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold truncate ${isAdded ? 'text-emerald-500' : 'text-foreground'}`}>
                            {emp.fullName}
                          </p>
                          {(emp.designation || emp.department) && (
                            <p className="text-[10px] text-muted-foreground truncate">
                              {[emp.designation, emp.department].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                        <span className={`text-[10px] font-bold shrink-0 px-2 py-0.5 rounded-full ${
                          isAdded
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : 'bg-primary/10 text-primary hover:bg-primary/20'
                        }`}>
                          {isAdded ? '✓ Added' : '+ Add'}
                        </span>
                      </button>
                    );
                  })}
                  {filteredEmployeesForAttendees.length === 0 && (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      No employees match "{employeeSearch}"
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              <FileText className="w-3 h-3 inline mr-1" /> Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Meeting agenda, discussion topics, etc."
              rows={3}
              className="w-full bg-background text-foreground border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading} disabled={!title || !startDate}>
              <Video className="w-4 h-4 mr-1.5" /> Schedule Meeting
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
