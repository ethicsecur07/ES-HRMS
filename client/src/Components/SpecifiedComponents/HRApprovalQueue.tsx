import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveApi } from '../../api_service/leaveApi';
import { wfhApi } from '../../api_service/wfhApi';
import { permissionApi } from '../../api_service/permissionApi';
import { analyticsApi } from '../../api_service/analyticsApi';
import { announcementApi } from '../../api_service/announcementApi';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Card } from '../WrapperComponents/Card';
import { Button } from '../WrapperComponents/Button';
import { formatDate } from '../../utils/formatters';
import { 
  Clock, 
  UserCheck, 
  Bell, 
  Calendar, 
  ClipboardCheck, 
  Briefcase, 
  Plus, 
  Send, 
  Trash2, 
  FileText, 
  AlertCircle, 
  CheckCircle,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Megaphone,
  BookOpen
} from 'lucide-react';

export const HRApprovalQueue: React.FC = () => {
  const { addToast } = useNotificationStore();
  const { user, role } = useAuthStore();
  const queryClient = useQueryClient();
  
  // Dashboard card navigation tabs
  const [activeTab, setActiveTab] = useState<'feed' | 'meetings' | 'actions' | 'work'>('feed');
  
  // Create announcement form slide open state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formType, setFormType] = useState<'ANNOUNCEMENT' | 'POLICY_CHANGE'>('ANNOUNCEMENT');

  // Fetch unified dashboard data
  const { data, isLoading } = useQuery({
    queryKey: ['announcementsAndActions'],
    queryFn: analyticsApi.getAnnouncementsAndActions,
    refetchInterval: 15000, // Auto refresh every 15s to keep dashboard dynamic!
  });

  // Mutations for Approvals
  const leaveMutation = useMutation({
    mutationFn: ({ id, status, rejectionReason }: { id: string; status: 'APPROVED' | 'REJECTED'; rejectionReason?: string }) =>
      leaveApi.updateStatus(id, status, rejectionReason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['announcementsAndActions'] });
      addToast('Leave Request Updated', `Request has been ${variables.status.toLowerCase()}.`, 'success');
    },
  });

  const wfhMutation = useMutation({
    mutationFn: ({ id, status, rejectionReason }: { id: string; status: 'APPROVED' | 'REJECTED'; rejectionReason?: string }) =>
      wfhApi.updateStatus(id, status, rejectionReason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['announcementsAndActions'] });
      addToast('WFH Request Updated', `Request has been ${variables.status.toLowerCase()}.`, 'success');
    },
  });

  const permMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) =>
      permissionApi.updateStatus(id, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['announcementsAndActions'] });
      addToast('Permission Request Updated', `Request has been ${variables.status.toLowerCase()}.`, 'success');
    },
  });

  // Mutation for creating manual announcements
  const createAnnouncementMutation = useMutation({
    mutationFn: announcementApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcementsAndActions'] });
      addToast('Announcement Published', 'Your update has been shared with the organization.', 'success');
      setFormTitle('');
      setFormContent('');
      setShowCreateForm(false);
    },
    onError: (error: any) => {
      addToast('Publish Failed', error.message || 'Unable to publish announcement.', 'error');
    }
  });

  // Mutation for deleting announcements (restricted to ADMIN, HR, MANAGER)
  const deleteAnnouncementMutation = useMutation({
    mutationFn: announcementApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcementsAndActions'] });
      addToast('Announcement Removed', 'The announcement has been deleted.', 'success');
    },
  });

  if (isLoading) {
    return (
      <Card className="animate-pulse h-96 bg-muted/20 border border-border shadow-md rounded-2xl flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Clock className="w-10 h-10 text-muted-foreground animate-spin opacity-40" />
          <p className="text-xs text-muted-foreground">Gathering your workspace feed...</p>
        </div>
      </Card>
    );
  }

  // Aggregate stats/counts for badges
  const announcements = data?.announcements || [];
  const meetingsToday = data?.meetingsToday || [];
  
  // Pending actions (leaves, WFH, permissions) for admin/hr/managers
  const pendingLeaves = data?.pendingLeaves || [];
  const pendingWFH = data?.pendingWFH || [];
  const pendingPermissions = data?.pendingPermissions || [];
  const totalPending = pendingLeaves.length + pendingWFH.length + pendingPermissions.length;

  // Applied request logs for employees
  const myLeaves = data?.myLeaves || [];
  const myWFH = data?.myWFH || [];
  const myPermissions = data?.myPermissions || [];
  const totalMyApplied = myLeaves.length + myWFH.length + myPermissions.length;

  // Employee work info
  const myProjects = data?.myProjects || [];
  const myTasks = data?.myTasks || [];

  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) {
      addToast('Validation Error', 'Title and content are required.', 'error');
      return;
    }
    createAnnouncementMutation.mutate({
      title: formTitle,
      content: formContent,
      type: formType,
    });
  };

  // Helper formats
  const getEmpName = (emp: any) => (emp ? (typeof emp === 'object' ? emp.fullName || 'Employee' : emp) : 'Employee');
  const renderAvatar = (emp: any) => {
    const empObj = typeof emp === 'object' ? emp : null;
    if (empObj?.profileImage) {
      return <img src={empObj.profileImage} alt="" className="w-9 h-9 rounded-full object-cover border border-border flex-shrink-0" />;
    }
    const initials = getEmpName(emp).split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
    return (
      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs border border-primary/20 flex-shrink-0">
        {initials}
      </div>
    );
  };

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

  return (
    <Card className="flex flex-col shadow-md border-l-4 border-l-primary h-full text-left transition-all duration-300">
      
      {/* Header Widget Description */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h3 className="text-lg font-extrabold text-foreground tracking-tight flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            Announcements & Actions
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your unified workspace activity hub
          </p>
        </div>
        
        {/* Pulsing indicator if there are tasks or announcements */}
        {(announcements.length > 0 || meetingsToday.length > 0) && (
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
          </span>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex bg-muted/40 p-1 rounded-xl border border-border/40 gap-1 my-4 text-xs font-bold overflow-x-auto scrollbar-none flex-nowrap w-full">
        <button
          onClick={() => { setActiveTab('feed'); setShowCreateForm(false); }}
          className={`flex-1 flex-shrink-0 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg transition-all min-w-[85px] xs:min-w-[95px] sm:min-w-0 ${
            activeTab === 'feed'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
          }`}
        >
          <Bell className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Feed</span>
          {announcements.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex-shrink-0">
              {announcements.length}
            </span>
          )}
        </button>
        
        <button
          onClick={() => { setActiveTab('meetings'); setShowCreateForm(false); }}
          className={`flex-1 flex-shrink-0 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg transition-all min-w-[85px] xs:min-w-[95px] sm:min-w-0 ${
            activeTab === 'meetings'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Meetings</span>
          {meetingsToday.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 text-[10px] font-bold flex-shrink-0">
              {meetingsToday.length}
            </span>
          )}
        </button>

        <button
          onClick={() => { setActiveTab('actions'); setShowCreateForm(false); }}
          className={`flex-1 flex-shrink-0 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg transition-all min-w-[85px] xs:min-w-[95px] sm:min-w-0 ${
            activeTab === 'actions'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
          }`}
        >
          <ClipboardCheck className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Requests</span>
          {role === 'HR' || role === 'ADMIN' || role === 'MANAGER' ? (
            totalPending > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 text-[10px] font-bold flex-shrink-0">
                {totalPending}
              </span>
            )
          ) : (
            totalMyApplied > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex-shrink-0">
                {totalMyApplied}
              </span>
            )
          )}
        </button>

        <button
          onClick={() => { setActiveTab('work'); setShowCreateForm(false); }}
          className={`flex-1 flex-shrink-0 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg transition-all min-w-[85px] xs:min-w-[95px] sm:min-w-0 ${
            activeTab === 'work'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Work</span>
          {myTasks.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 text-[10px] font-bold flex-shrink-0">
              {myTasks.length}
            </span>
          )}
        </button>
      </div>

      {/* Tabs Contents Container */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-1 scrollbar-none">
        
        {/* ================= TAB 1: FEED ================= */}
        {activeTab === 'feed' && (
          <div className="space-y-4">
            
            {/* Publisher Form Button (restricted to HR, MANAGER, ADMIN) */}
            {(role === 'ADMIN' || role === 'HR' || role === 'MANAGER') && (
              <div className="border-b border-border/50 pb-3 mb-2 flex flex-wrap gap-2 justify-between items-center">
                <span className="text-xs font-semibold text-muted-foreground">Announcements board</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="text-xs flex items-center gap-1 border-primary/20 hover:bg-primary/5 text-primary font-bold py-1 h-8 rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {showCreateForm ? 'Cancel' : 'Publish Announcement'}
                </Button>
              </div>
            )}

            {/* Quick Announcement Post Form */}
            {showCreateForm && (
              <form onSubmit={handleCreateAnnouncement} className="p-4 bg-muted/30 border border-border rounded-xl space-y-3 animate-in slide-in-from-top-2 duration-200">
                <h4 className="text-xs font-bold text-foreground">Post New Announcement</h4>
                <div>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Title (e.g. Office Closed on Holiday)"
                    className="w-full bg-card border border-border rounded-lg p-2 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <textarea
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder="Write details or policy updates here..."
                    rows={3}
                    className="w-full bg-card border border-border rounded-lg p-2 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none resize-none"
                    required
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="radio"
                        checked={formType === 'ANNOUNCEMENT'}
                        onChange={() => setFormType('ANNOUNCEMENT')}
                        className="text-primary focus:ring-0"
                      />
                      General Info
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="radio"
                        checked={formType === 'POLICY_CHANGE'}
                        onChange={() => setFormType('POLICY_CHANGE')}
                        className="text-primary focus:ring-0"
                      />
                      Policy Change
                    </label>
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    className="text-xs flex items-center gap-1 bg-primary text-white font-bold h-8 shadow-sm"
                    isLoading={createAnnouncementMutation.isPending}
                  >
                    <Send className="w-3.5 h-3.5" />
                    Share
                  </Button>
                </div>
              </form>
            )}

            {/* List Announcements */}
            {announcements.length === 0 ? (
              <div className="py-12 text-center bg-muted/10 rounded-xl border border-dashed border-border/80">
                <Megaphone className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-30" />
                <p className="text-xs font-bold text-foreground">All Quiet in the Feed</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">No recent announcements or policy updates.</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {announcements.map((ann: any) => {
                  const isPolicy = ann.type === 'POLICY_CHANGE';
                  return (
                    <div 
                       key={ann._id} 
                      className={`p-4 rounded-xl border transition-all duration-200 relative group ${
                        isPolicy
                          ? 'border-indigo-500/25 bg-indigo-500/5 hover:border-indigo-500/40'
                          : 'border-border/70 bg-card hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex gap-3">
                          {/* Announcement Icon */}
                          <div className={`p-2 rounded-lg mt-0.5 flex-shrink-0 ${
                            isPolicy ? 'bg-indigo-500/10 text-indigo-600' : 'bg-primary/10 text-primary'
                          }`}>
                            {isPolicy ? <BookOpen className="w-4 h-4" /> : <Megaphone className="w-4 h-4" />}
                          </div>
                          
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-foreground leading-tight">{ann.title}</h4>
                              <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                                isPolicy 
                                  ? 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' 
                                  : 'bg-primary/10 text-primary border-primary/20'
                              }`}>
                                {isPolicy ? 'Policy Update' : 'Announcement'}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2 leading-relaxed whitespace-pre-line">{ann.content}</p>
                          </div>
                        </div>

                        {/* Delete action (restricted to ADMIN/HR/MANAGER) */}
                        {(role === 'ADMIN' || role === 'HR' || role === 'MANAGER') && (
                          <button
                            onClick={() => {
                              if (confirm('Delete this announcement?')) {
                                deleteAnnouncementMutation.mutate(ann._id);
                              }
                            }}
                            className="text-muted-foreground hover:text-destructive p-1 rounded-md hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                            title="Delete Announcement"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Publisher footer */}
                      <div className="mt-3.5 pt-2.5 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground font-medium">
                        <span className="truncate max-w-[200px] sm:max-w-none">Shared by <strong className="text-foreground">{ann.createdByName}</strong> ({ann.createdByRole})</span>
                        <span className="font-mono flex-shrink-0">{getTimeAgo(ann.createdAt)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: MEETINGS ================= */}
        {activeTab === 'meetings' && (
          <div className="space-y-4">
            <span className="text-xs font-semibold text-muted-foreground block border-b border-border/50 pb-2 mb-2">Today's schedules</span>
            
            {meetingsToday.length === 0 ? (
              <div className="py-12 text-center bg-muted/10 rounded-xl border border-dashed border-border/80">
                <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-bold text-foreground">Clear Agenda</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">No scheduled meetings for you today.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {meetingsToday.map((meeting: any) => {
                  const startTime = new Date(meeting.startDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const endTime = new Date(meeting.endDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  
                  return (
                    <div key={meeting._id} className="p-4 bg-card border border-border rounded-xl hover:border-emerald-500/35 hover:shadow-sm transition-all duration-200">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            {meeting.meetingType} MEETING
                          </span>
                          <h4 className="text-sm font-extrabold text-foreground mt-2 leading-tight">{meeting.title}</h4>
                          
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground mt-3 font-medium">
                            <span className="flex items-center gap-1 flex-shrink-0">
                              <Clock className="w-3.5 h-3.5 text-primary" />
                              {startTime} – {endTime}
                            </span>
                            <span className="hidden xs:inline text-muted-foreground/60">•</span>
                            <span className="truncate">Organizer: <strong className="text-foreground">{meeting.organizer}</strong></span>
                          </div>
                          
                          {meeting.notes && (
                            <p className="text-xs text-muted-foreground bg-muted/30 p-2 border border-border/50 rounded-lg italic mt-2.5">
                              "{meeting.notes}"
                            </p>
                          )}
                        </div>

                        {/* Teams Quick Join URL */}
                        {meeting.teamsJoinUrl && (
                          <a
                            href={meeting.teamsJoinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full sm:w-auto flex-shrink-0 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-primary rounded-lg shadow-sm shadow-primary/20 hover:bg-primary/95 transition-all text-center"
                          >
                            Join
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: REQUESTS & APPROVALS ================= */}
        {activeTab === 'actions' && (
          <div className="space-y-4">
            
            {/* MANAGER / HR / ADMIN VIEW: Pending Requests Approval Queue */}
            {(role === 'HR' || role === 'ADMIN' || role === 'MANAGER') ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border/50 pb-2 mb-2">
                  <span className="text-xs font-semibold text-muted-foreground">Pending Approval Queue</span>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                    {totalPending} PENDING
                  </span>
                </div>

                {totalPending === 0 ? (
                  <div className="py-12 text-center bg-muted/10 rounded-xl border border-dashed border-border/80">
                    <UserCheck className="w-10 h-10 text-primary mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-bold text-foreground">All Caught Up!</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">No pending leaves, permission, or WFH requests.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* 1. Leaves approvals */}
                    {pendingLeaves.map((item: any) => (
                      <div key={item._id} className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3.5 hover:border-primary/30 transition-all">
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-0.5 rounded-md bg-muted text-foreground font-bold text-[9px] uppercase border border-border tracking-wider">
                            {item.leaveType}
                          </span>
                          <span className="text-[9px] text-muted-foreground font-medium font-mono">{getTimeAgo(item.createdAt || item.appliedAt)}</span>
                        </div>

                        <div className="flex items-center gap-3">
                          {renderAvatar(item.employeeId)}
                          <div>
                            <p className="text-xs font-bold text-foreground">{getEmpName(item.employeeId)}</p>
                            <p className="text-[10px] text-muted-foreground">{item.employeeId?.department || 'Design'}</p>
                          </div>
                        </div>

                        <div className="p-2.5 bg-muted/40 rounded-lg border border-border flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-muted-foreground flex-shrink-0">Duration: {item.totalDays} Day</span>
                          <span className="font-medium text-foreground text-right">{formatDate(item.startDate)} to {formatDate(item.endDate)}</span>
                        </div>

                        {item.reason && (
                          <div className="p-2.5 bg-primary/5 border border-primary/10 rounded-lg text-xs text-foreground italic">
                            "{item.reason}"
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-xs border-border text-foreground hover:bg-muted font-bold h-8 rounded-lg"
                            onClick={() => {
                              const reason = prompt("Please enter a reason for leave rejection:");
                              if (reason === null) return; // cancel action
                              leaveMutation.mutate({ id: item._id, status: 'REJECTED', rejectionReason: reason || 'Not approved by manager' });
                            }}
                            isLoading={leaveMutation.isPending}
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 text-xs bg-primary text-white font-bold shadow-sm hover:shadow hover:bg-primary/95 h-8 rounded-lg"
                            onClick={() => leaveMutation.mutate({ id: item._id, status: 'APPROVED' })}
                            isLoading={leaveMutation.isPending}
                          >
                            Approve
                          </Button>
                        </div>
                      </div>
                    ))}

                    {/* 2. WFH approvals */}
                    {pendingWFH.map((item: any) => (
                      <div key={item._id} className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3.5 hover:border-primary/30 transition-all">
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 font-bold text-[9px] uppercase border border-indigo-500/20 tracking-wider">
                            WFH REQUEST
                          </span>
                          <span className="text-[9px] text-muted-foreground font-medium font-mono">{getTimeAgo(item.createdAt || item.appliedAt)}</span>
                        </div>

                        <div className="flex items-center gap-3">
                          {renderAvatar(item.employeeId)}
                          <div>
                            <p className="text-xs font-bold text-foreground">{getEmpName(item.employeeId)}</p>
                            <p className="text-[10px] text-muted-foreground">{item.employeeId?.department || 'Engineering'}</p>
                          </div>
                        </div>

                        <div className="p-2.5 bg-muted/40 rounded-lg border border-border flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-muted-foreground flex-shrink-0">Date:</span>
                          <span className="font-medium text-foreground text-right">{formatDate(item.startDate)} to {formatDate(item.endDate)} ({item.totalDays} days)</span>
                        </div>

                        <div className="p-2.5 bg-primary/5 border border-primary/10 rounded-lg text-xs text-foreground space-y-1">
                          <p><span className="font-semibold text-muted-foreground">Reason:</span> {item.reason}</p>
                          <p><span className="font-semibold text-muted-foreground">Planned Tasks:</span> {item.expectedTasks}</p>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-xs border-border text-foreground hover:bg-muted font-bold h-8 rounded-lg"
                            onClick={() => {
                              const reason = prompt("Please enter a reason for WFH rejection:");
                              if (reason === null) return; // cancel action
                              wfhMutation.mutate({ id: item._id, status: 'REJECTED', rejectionReason: reason || 'Not approved by manager' });
                            }}
                            isLoading={wfhMutation.isPending}
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 text-xs bg-primary text-white font-bold shadow-sm hover:shadow hover:bg-primary/95 h-8 rounded-lg"
                            onClick={() => wfhMutation.mutate({ id: item._id, status: 'APPROVED' })}
                            isLoading={wfhMutation.isPending}
                          >
                            Approve
                          </Button>
                        </div>
                      </div>
                    ))}

                    {/* 3. Permissions approvals */}
                    {pendingPermissions.map((item: any) => (
                      <div key={item._id} className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3.5 hover:border-primary/30 transition-all">
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 font-bold text-[9px] uppercase border border-amber-500/20 tracking-wider">
                            PERMISSION HOURS
                          </span>
                          <span className="text-[9px] text-muted-foreground font-medium font-mono">{getTimeAgo(item.createdAt)}</span>
                        </div>

                        <div className="flex items-center gap-3">
                          {renderAvatar(item.employeeId)}
                          <div>
                            <p className="text-xs font-bold text-foreground">{getEmpName(item.employeeId)}</p>
                            <p className="text-[10px] text-muted-foreground">{item.employeeId?.department || 'Operations'}</p>
                          </div>
                        </div>

                        <div className="p-2.5 bg-muted/40 rounded-lg border border-border flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-muted-foreground flex-shrink-0">Date: {formatDate(item.date)}</span>
                          <span className="font-medium text-foreground text-right">{item.startTime} to {item.endTime} ({item.totalHours} hrs)</span>
                        </div>

                        {item.reason && (
                          <div className="p-2.5 bg-primary/5 border border-primary/10 rounded-lg text-xs text-foreground italic">
                            "{item.reason}"
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-xs border-border text-foreground hover:bg-muted font-bold h-8 rounded-lg"
                            onClick={() => permMutation.mutate({ id: item._id, status: 'REJECTED' })}
                            isLoading={permMutation.isPending}
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 text-xs bg-primary text-white font-bold shadow-sm hover:shadow hover:bg-primary/95 h-8 rounded-lg"
                            onClick={() => permMutation.mutate({ id: item._id, status: 'APPROVED' })}
                            isLoading={permMutation.isPending}
                          >
                            Approve
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              
              // ================= EMPLOYEE VIEW: Applied Requests Logs =================
              <div className="space-y-4">
                <span className="text-xs font-semibold text-muted-foreground block border-b border-border/50 pb-2 mb-2">My Applied Requests Logs</span>
                
                {totalMyApplied === 0 ? (
                  <div className="py-12 text-center bg-muted/10 rounded-xl border border-dashed border-border/80">
                    <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-30" />
                    <p className="text-xs font-bold text-foreground">No Submissions</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">You haven't submitted any leaves, permissions, or WFH yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    
                    {/* Render Leaves applied */}
                    {myLeaves.map((l: any) => {
                      const statusColor = l.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : l.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20';
                      return (
                        <div key={l._id} className="p-3.5 bg-card border border-border/60 rounded-xl flex flex-col xs:flex-row gap-3 xs:items-center justify-between text-xs hover:border-primary/20 transition-all">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-foreground truncate">{l.leaveType}</span>
                              <span className="text-[9px] text-muted-foreground flex-shrink-0">({l.totalDays} Days)</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5 font-medium">{formatDate(l.startDate)} to {formatDate(l.endDate)}</p>
                            {l.reason && <p className="text-[10px] text-muted-foreground/80 mt-1 italic break-words">"{l.reason}"</p>}
                          </div>
                          
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border flex-shrink-0 w-max ${statusColor}`}>
                            {l.status}
                          </span>
                        </div>
                      );
                    })}

                    {/* Render WFH requests */}
                    {myWFH.map((w: any) => {
                      const statusColor = w.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : w.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20';
                      return (
                        <div key={w._id} className="p-3.5 bg-card border border-border/60 rounded-xl flex flex-col xs:flex-row gap-3 xs:items-center justify-between text-xs hover:border-primary/20 transition-all">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-foreground truncate">WFH Request</span>
                              <span className="text-[9px] text-muted-foreground flex-shrink-0">({w.totalDays} Days)</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5 font-medium">{formatDate(w.startDate)} to {formatDate(w.endDate)}</p>
                            {w.reason && <p className="text-[10px] text-muted-foreground/80 mt-1 italic break-words">"{w.reason}"</p>}
                          </div>

                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border flex-shrink-0 w-max ${statusColor}`}>
                            {w.status}
                          </span>
                        </div>
                      );
                    })}

                    {/* Render Permissions applied */}
                    {myPermissions.map((p: any) => {
                      const statusColor = p.approvalStatus === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : p.approvalStatus === 'REJECTED' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20';
                      return (
                        <div key={p._id} className="p-3.5 bg-card border border-border/60 rounded-xl flex flex-col xs:flex-row gap-3 xs:items-center justify-between text-xs hover:border-primary/20 transition-all">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-foreground truncate">Permission Hours</span>
                              <span className="text-[9px] text-muted-foreground flex-shrink-0">({p.totalHours} hrs)</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5 font-medium">{formatDate(p.date)} ({p.startTime} – {p.endTime})</p>
                            {p.reason && <p className="text-[10px] text-muted-foreground/80 mt-1 italic break-words">"{p.reason}"</p>}
                          </div>

                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border flex-shrink-0 w-max ${statusColor}`}>
                            {p.approvalStatus}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 4: WORK ================= */}
        {activeTab === 'work' && (
          <div className="space-y-5">
            
            {/* Project section */}
            <div>
              <span className="text-xs font-semibold text-muted-foreground block border-b border-border/50 pb-2 mb-2">My Projects</span>
              {myProjects.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-3">No active project assignments found for you.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {myProjects.map((proj: any) => (
                    <div key={proj._id} className="p-3.5 bg-muted/20 border border-border rounded-xl flex flex-col xs:flex-row gap-3 xs:items-center justify-between hover:bg-muted/40 transition-colors">
                      <div className="min-w-0 flex-1">
                        <h5 className="text-xs font-bold text-foreground truncate">{proj.name}</h5>
                        <p className="text-[10px] text-muted-foreground mt-1 font-medium truncate">Client: {proj.clientName}</p>
                      </div>
                      <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex-shrink-0 w-max">
                        {proj.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Task section */}
            <div className="pt-2">
              <span className="text-xs font-semibold text-muted-foreground block border-b border-border/50 pb-2 mb-2">My Pending Tasks</span>
              {myTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-3">No pending tasks assigned to you. Keep it up!</p>
              ) : (
                <div className="space-y-2.5">
                  {myTasks.map((task: any) => {
                    const priorityColor = task.priority === 'CRITICAL' || task.priority === 'HIGH' 
                      ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' 
                      : task.priority === 'MEDIUM'
                      ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
                    return (
                      <div key={task._id} className="p-3.5 bg-card border border-border rounded-xl hover:border-primary/20 hover:shadow-sm transition-all duration-200">
                        <div className="flex flex-col xs:flex-row gap-3 xs:items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h5 className="text-xs font-bold text-foreground line-clamp-1">{task.title}</h5>
                              <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-full border flex-shrink-0 ${priorityColor}`}>
                                {task.priority}
                              </span>
                            </div>
                            
                            <p className="text-[10px] text-muted-foreground mt-1.5 font-medium flex flex-wrap items-center gap-1.5">
                              <span><span className="text-primary font-bold">Project:</span> {task.projectId?.name || 'Assigned'}</span>
                              {task.dueDate && (
                                <>
                                  <span className="hidden xs:inline">•</span>
                                  <span className="text-rose-600 font-bold flex items-center gap-0.5 flex-shrink-0">
                                    Due: {task.dueDate}
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                          
                          <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 flex-shrink-0 w-max">
                            {task.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

      </div>
      
      {/* Widget Footer Links */}
      <div className="pt-4 border-t border-border mt-4 flex flex-wrap gap-3 items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">Automatic system sync active</span>
        <button
          className="font-bold text-primary hover:underline flex items-center gap-0.5 flex-shrink-0"
          onClick={() => window.location.href = '/leave-wfh'}
        >
          View Request History
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </Card>
  );
};
