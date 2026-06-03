import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { meetingApi } from '../api_service/meetingApi';
import { useNotificationStore } from '../store/useNotificationStore';
import { usePermission } from '../hooks/usePermission';
import { useAuthStore } from '../store/useAuthStore';
import { ScheduleMeetingModal } from '../Components/SpecifiedComponents/ScheduleMeetingModal';
import { Button } from '../Components/WrapperComponents/Button';
import { CardGridSkeleton } from '../Components/WrapperComponents/Skeleton';
import {
  Video,
  Calendar,
  Clock,
  Users,
  Briefcase,
  ExternalLink,
  Search,
  Plus,
  Copy,
  CheckCircle2,
  XCircle,
  Crown,
  ShieldCheck,
} from 'lucide-react';

type TabFilter = 'ALL' | 'INTERVIEW' | 'CLIENT' | 'TEAM';

const TAB_CONFIG: { id: TabFilter; label: string; icon: React.ReactNode }[] = [
  { id: 'ALL', label: 'All Meetings', icon: <Video className="w-4 h-4" /> },
  { id: 'INTERVIEW', label: 'Interviews', icon: <Briefcase className="w-4 h-4" /> },
  { id: 'CLIENT', label: 'Client', icon: <Users className="w-4 h-4" /> },
  { id: 'TEAM', label: 'Team', icon: <Video className="w-4 h-4" /> },
];

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/20',
  ENDED: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

const TYPE_COLORS: Record<string, string> = {
  INTERVIEW: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  CLIENT: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  TEAM: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

const TYPE_LABELS: Record<string, string> = {
  INTERVIEW: 'Interview',
  CLIENT: 'Client Meeting',
  TEAM: 'Team Meeting',
};

/** Resolve the base URL for secure timed-gate join links. */
const getApiBase = (): string => {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl) return envUrl.replace(/\/api\/?$/, '');
  return `${window.location.protocol}//${window.location.hostname}:5000`;
};

export const MeetingsPage: React.FC = () => {
  const { addToast } = useNotificationStore();
  const { hasPermission } = usePermission();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();

  const isEmployeeOrIntern = currentUser?.role === 'EMPLOYEE' || currentUser?.role === 'INTERN';

  const filteredTabConfig = TAB_CONFIG.filter((tab) => {
    if (tab.id === 'INTERVIEW') {
      return !isEmployeeOrIntern;
    }
    return true;
  });

  const [activeTab, setActiveTab] = useState<TabFilter>('ALL');
  const [search, setSearch] = useState('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const { data: meetingsData, isLoading } = useQuery({
    queryKey: ['meetings', activeTab],
    queryFn: () =>
      meetingApi.getAll({
        meetingType: activeTab === 'ALL' ? undefined : activeTab,
        limit: 100,
      }),
  });

  const cancelMutation = useMutation({
    mutationFn: meetingApi.cancel,
    onSuccess: () => {
      addToast('Meeting Cancelled', 'The meeting has been cancelled and all attendees notified by email.', 'success');
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
    onError: (error: any) => {
      addToast('Cancel Failed', error?.response?.data?.message || 'Could not cancel meeting.', 'error');
    },
  });

  const meetings = meetingsData?.meetings || [];

  const filteredMeetings = meetings.filter((m: any) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      m.title?.toLowerCase().includes(searchLower) ||
      m.attendees?.some((a: any) => a.name?.toLowerCase().includes(searchLower) || a.email?.toLowerCase().includes(searchLower))
    );
  });

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    addToast('Link Copied', 'Secure meeting join link copied to clipboard.', 'success');
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    });
  };

  const getDuration = (start: string, end: string) => {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    const minutes = Math.round(diff / 60000);
    if (minutes < 60) return `${minutes} min`;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  };

  /**
   * Check if the current user is the creator of a meeting.
   * Handles both populated object { _id } and raw ObjectId strings.
   */
  const isCurrentUserCreator = (meeting: any): boolean => {
    if (!currentUser?._id) return false;
    const createdBy = meeting.createdBy;
    if (!createdBy) return false;
    if (typeof createdBy === 'string') return createdBy === currentUser._id;
    if (typeof createdBy === 'object') {
      return (createdBy._id || createdBy.id || createdBy)?.toString() === currentUser._id?.toString();
    }
    return false;
  };

  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'HR';

  if (isLoading) {
    return <CardGridSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Video className="w-6 h-6 text-primary" />
            Teams Meetings
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Schedule and manage Microsoft Teams meetings for interviews, clients, and team collaboration
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search meetings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-background text-foreground border border-border rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <Button onClick={() => setShowScheduleModal(true)} className="shrink-0 flex items-center gap-1.5 shadow-md">
            <Plus className="w-4 h-4" /> Schedule
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {filteredTabConfig.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 whitespace-nowrap border ${
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
                : 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
            {activeTab === tab.id && (
              <span className="bg-primary-foreground/20 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                {filteredMeetings.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Meetings Grid */}
      {filteredMeetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Video className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm font-semibold">No meetings found</p>
          <p className="text-xs mt-1">Schedule your first Teams meeting to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredMeetings.map((meeting: any) => {
            const isCreator = isCurrentUserCreator(meeting);
            const canCancel = isCreator || isAdmin;
            const secureJoinUrl = `${getApiBase()}/api/meetings/join/${meeting._id}`;
            const isEnded = meeting.status === 'COMPLETED' || (meeting.status === 'SCHEDULED' && new Date(meeting.endDateTime) < new Date());
            const displayStatus = meeting.status === 'SCHEDULED' && isEnded ? 'ENDED' : meeting.status;

            return (
              <div
                key={meeting._id}
                className={`bg-card border rounded-2xl p-5 shadow-sm transition-all duration-200 text-left group relative ${
                  isEnded || meeting.status === 'CANCELLED'
                    ? 'border-border/60 opacity-65'
                    : 'border-border hover:shadow-md hover:border-primary/20'
                }`}
              >
                {/* Organizer badge */}
                {isCreator && (
                  <span className="absolute top-3 right-3 flex items-center gap-1 text-[9px] font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                    <Crown className="w-2.5 h-2.5" /> Organizer
                  </span>
                )}

                {/* Card Header */}
                <div className="flex items-start mb-3">
                  <div className="flex-1 min-w-0 pr-16">
                    <h3 className={`text-sm font-bold truncate transition-colors ${
                      isEnded || meeting.status === 'CANCELLED' 
                        ? 'text-muted-foreground' 
                        : 'text-foreground group-hover:text-primary'
                    }`}>
                      {meeting.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${TYPE_COLORS[meeting.meetingType] || ''}`}>
                        {TYPE_LABELS[meeting.meetingType] || meeting.meetingType}
                      </span>
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_COLORS[displayStatus] || ''}`}>
                        {displayStatus === 'SCHEDULED' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 mr-1 animate-pulse" />}
                        {displayStatus}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Date & Duration */}
                <div className="space-y-1.5 mb-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5 text-primary/60" />
                    <span className="font-medium">{formatDateTime(meeting.startDateTime)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3.5 h-3.5 text-primary/60" />
                    <span className="font-medium">
                      Duration: {getDuration(meeting.startDateTime, meeting.endDateTime)}
                    </span>
                  </div>
                </div>

                {/* Attendees */}
                {meeting.attendees?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Attendees ({meeting.attendees.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {meeting.attendees.slice(0, 4).map((att: any, idx: number) => (
                        <span
                          key={idx}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border"
                          title={att.email}
                        >
                          {att.name}
                        </span>
                      ))}
                      {meeting.attendees.length > 4 && (
                        <span className="text-[10px] font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                          +{meeting.attendees.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Linked entity */}
                {meeting.candidateId && (
                  <div className="text-[10px] text-muted-foreground mb-3 font-medium flex items-center gap-1">
                    <Briefcase className="w-3 h-3" />
                    Candidate: {meeting.candidateId.firstName} {meeting.candidateId.lastName}
                  </div>
                )}
                {meeting.projectId && (
                  <div className="text-[10px] text-muted-foreground mb-3 font-medium flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    Project: {meeting.projectId.name}
                  </div>
                )}

                {/* Description */}
                {meeting.description && (
                  <p className="text-xs text-foreground/80 mb-3 line-clamp-3">
                    <strong>Description:</strong> {meeting.description}
                  </p>
                )}

                {/* Notes */}
                {meeting.notes && (
                  <p className="text-xs text-muted-foreground italic mb-4 line-clamp-2">{meeting.notes}</p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-border flex-wrap">
                  {meeting.status === 'SCHEDULED' && !isEnded && (
                    <a
                      href={secureJoinUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg border border-primary/20 transition-all"
                    >
                      <ExternalLink className="w-3 h-3" /> Join Meeting
                    </a>
                  )}
                  <button
                    onClick={() => handleCopyLink(secureJoinUrl)}
                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted px-3 py-1.5 rounded-lg border border-border transition-all"
                    title="Copy secure join link"
                  >
                    <Copy className="w-3 h-3" /> Copy
                  </button>

                  {meeting.status === 'SCHEDULED' && !isEnded && canCancel && (
                    <button
                      onClick={() => {
                        if (confirm('Cancel this meeting? All attendees will be notified by email.')) {
                          cancelMutation.mutate(meeting._id);
                        }
                      }}
                      disabled={cancelMutation.isPending}
                      className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-400 bg-red-500/5 hover:bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/10 transition-all ml-auto disabled:opacity-50"
                      title={isCreator ? 'Cancel Meeting (you organized this)' : 'Cancel Meeting (admin)'}
                    >
                      <XCircle className="w-3 h-3" /> Cancel
                    </button>
                  )}

                  {meeting.status === 'SCHEDULED' && !isEnded && !canCancel && (
                    <span
                      className="flex items-center gap-1 text-xs text-muted-foreground/40 ml-auto font-medium cursor-default"
                      title="Only the meeting organizer or an admin can cancel"
                    >
                      <ShieldCheck className="w-3 h-3" /> Protected
                    </span>
                  )}

                  {isEnded && (
                    <span className={`flex items-center gap-1 text-xs font-semibold ml-auto ${
                      meeting.status === 'COMPLETED' ? 'text-emerald-500' : 'text-zinc-500'
                    }`}>
                      <CheckCircle2 className="w-3.5 h-3.5" /> {meeting.status === 'COMPLETED' ? 'Completed' : 'Ended'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule Meeting Modal */}
      <ScheduleMeetingModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        defaultType="TEAM"
      />
    </div>
  );
};
