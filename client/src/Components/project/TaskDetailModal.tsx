import React, { useState, useEffect } from 'react';
import {
  X, Calendar, Tag, Paperclip, MessageSquare, Clock,
  CheckSquare, ChevronRight, Send, Loader2,
  ThumbsUp, RotateCcw, User, Flag, Check, Plus, Trash2
} from 'lucide-react';
import { projectApi } from '../../api_service/projectApi';
import { usePermission } from '../../hooks/usePermission';
import { useAuthStore } from '../../store/useAuthStore';

// ─── Types ───────────────────────────────────────────────────────
interface Task {
  _id: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  assignedTo?: { _id: string; fullName: string; email?: string; profileImage?: string };
  dueDate?: string;
  tags?: string[];
  checklist?: { label: string; done: boolean }[];
  attachments?: { filename: string; url: string; fileType?: string; uploadedByName: string; uploadedAt: string }[];
  storyPoints?: number;
  reworkCount?: number;
  reworkComments?: { comment: string; by: string; byName: string; at: string }[];
  reviewNotes?: string;
  completionNotes?: string;
  progressSummary?: string;
  submittedAt?: string;
  reviewedAt?: string;
  sprintId?: string;
  sprintName?: string;
}

interface TaskDetailModalProps {
  task: Task | null;
  projectId: string;
  teamMembers: any[];
  sprints: any[];
  onClose: () => void;
  onTaskUpdated: (task: Task) => void;
  onTaskDeleted: (taskId: string) => void;
}

type TabType = 'details' | 'checklist' | 'comments' | 'activity' | 'review';

// ─── Priority / Status config ─────────────────────────────────────
const PRIORITY_CONFIG = {
  CRITICAL: { label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', dot: 'bg-red-500' },
  HIGH:     { label: 'High',     color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30', dot: 'bg-orange-500' },
  MEDIUM:   { label: 'Medium',   color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/30',   dot: 'bg-amber-400' },
  LOW:      { label: 'Low',      color: 'text-slate-400',  bg: 'bg-slate-500/10 border-slate-500/30',   dot: 'bg-slate-400' },
};

const STATUS_CONFIG = {
  TODO:        { label: 'To Do',       color: 'text-slate-400',  bg: 'bg-slate-500/10 border-slate-500/30'  },
  IN_PROGRESS: { label: 'In Progress', color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/30'    },
  REVIEW:      { label: 'In Review',   color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30'},
  COMPLETED:   { label: 'Completed',   color: 'text-emerald-400',bg: 'bg-emerald-500/10 border-emerald-500/30'},
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  CREATED:              <Plus className="w-3.5 h-3.5 text-emerald-400" />,
  ASSIGNED:             <User className="w-3.5 h-3.5 text-blue-400" />,
  STATUS_CHANGED:       <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />,
  SUBMITTED_FOR_REVIEW: <Send className="w-3.5 h-3.5 text-purple-400" />,
  REVIEW_APPROVED:      <ThumbsUp className="w-3.5 h-3.5 text-emerald-400" />,
  REWORK_REQUESTED:     <RotateCcw className="w-3.5 h-3.5 text-red-400" />,
  COMMENTED:            <MessageSquare className="w-3.5 h-3.5 text-slate-400" />,
  UPDATED:              <Clock className="w-3.5 h-3.5 text-slate-400" />,
  DEADLINE_UPDATED:     <Calendar className="w-3.5 h-3.5 text-amber-400" />,
  PRIORITY_CHANGED:     <Flag className="w-3.5 h-3.5 text-orange-400" />,
  ATTACHMENT_ADDED:     <Paperclip className="w-3.5 h-3.5 text-slate-400" />,
};

// ─── Main Component ───────────────────────────────────────────────
export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  projectId,
  teamMembers,
  sprints,
  onClose,
  onTaskUpdated,
  onTaskDeleted,
}) => {
  const { hasPermission } = usePermission();
  const { user } = useAuthStore();
  const userRole = (user as any)?.role || '';

  const [activeTab, setActiveTab]     = useState<TabType>('details');
  const [comments,  setComments]      = useState<any[]>([]);
  const [activities,setActivities]    = useState<any[]>([]);
  const [newComment, setNewComment]   = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [isActivityLoading, setIsActivityLoading] = useState(false);
  const [isSaving,   setIsSaving]     = useState(false);

  // Edit fields
  const [editTitle,      setEditTitle]      = useState('');
  const [editDesc,       setEditDesc]       = useState('');
  const [editPriority,   setEditPriority]   = useState('MEDIUM');
  const [editDueDate,    setEditDueDate]    = useState('');
  const [editAssignedTo, setEditAssignedTo] = useState('');
  const [editSprintId,   setEditSprintId]   = useState('');
  const [editTags,       setEditTags]       = useState<string[]>([]);
  const [newTag,         setNewTag]         = useState('');
  const [editChecklist,  setEditChecklist]  = useState<{ label: string; done: boolean }[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');

  // Workflow state
  const [completionNotes,   setCompletionNotes]   = useState('');
  const [progressSummary,   setProgressSummary]   = useState('');
  const [checklistConfirmed,setChecklistConfirmed]= useState(false);
  const [reviewNotes,       setReviewNotes]       = useState('');
  const [reworkComment,     setReworkComment]     = useState('');
  const [isWorkflowSubmitting, setIsWorkflowSubmitting] = useState(false);
  const [workflowError,    setWorkflowError]     = useState('');

  const canEdit   = hasPermission('PROJECTS', 'edit') && userRole !== 'ADMIN';
  const canApprove= hasPermission('PROJECTS', 'approve') && ['TEAM_LEAD', 'MANAGER', 'HR'].includes(userRole);
  const isEmployee= userRole === 'EMPLOYEE';

  // Reset form and preload comments/activities when task changes
  useEffect(() => {
    if (!task) return;
    setEditTitle(task.title);
    setEditDesc(task.description || '');
    setEditPriority(task.priority);
    setEditDueDate(task.dueDate || '');
    setEditAssignedTo(task.assignedTo?._id || '');
    setEditSprintId(task.sprintId || '');
    setEditTags(task.tags || []);
    setEditChecklist(task.checklist ? task.checklist.map(c => ({ ...c })) : []);
    setWorkflowError('');
    setActiveTab('details');

    // Preload comments & activity instantly to keep tab badges updated
    loadComments();
    loadActivity();
  }, [task?._id]);

  // Load comments / activity on tab switch (for manual refresh if tab clicked)
  useEffect(() => {
    if (!task || !projectId) return;
    if (activeTab === 'comments') loadComments();
    if (activeTab === 'activity') loadActivity();
  }, [activeTab]);

  const loadComments = async () => {
    if (!task) return;
    setIsCommentsLoading(true);
    try {
      const data = await projectApi.getTaskComments(projectId, task._id);
      setComments(data.comments || []);
    } catch (e) { console.error(e); }
    finally { setIsCommentsLoading(false); }
  };

  const loadActivity = async () => {
    if (!task) return;
    setIsActivityLoading(true);
    try {
      const data = await projectApi.getTaskActivity(projectId, task._id);
      setActivities(data.activities || []);
    } catch (e) { console.error(e); }
    finally { setIsActivityLoading(false); }
  };

  const handleSaveDetails = async () => {
    if (!task) return;
    setIsSaving(true);
    try {
      const data = await projectApi.updateTask(projectId, task._id, {
        title: editTitle,
        description: editDesc,
        priority: editPriority,
        dueDate: editDueDate,
        assignedTo: editAssignedTo,
        sprintId: editSprintId || 'backlog',
        tags: editTags,
        checklist: editChecklist,
      });
      onTaskUpdated(data.task);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to save task');
    } finally { setIsSaving(false); }
  };



  const handleAddComment = async () => {
    if (!newComment.trim() || !task) return;
    setIsSubmittingComment(true);
    try {
      await projectApi.createComment(projectId, task._id, { content: newComment.trim() });
      setNewComment('');
      loadComments();
    } catch (e) { console.error(e); }
    finally { setIsSubmittingComment(false); }
  };

  const handleDeleteTask = async () => {
    if (!task) return;
    if (!window.confirm('Delete this task? This action cannot be undone.')) return;
    try {
      await projectApi.deleteTask(projectId, task._id);
      onTaskDeleted(task._id);
      onClose();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to delete task');
    }
  };

  const handleSubmitForReview = async () => {
    if (!task) return;
    if (!completionNotes.trim()) { setWorkflowError('Please add completion notes.'); return; }
    if (!checklistConfirmed) { setWorkflowError('Please confirm checklist completion.'); return; }
    setIsWorkflowSubmitting(true);
    setWorkflowError('');
    try {
      const data = await projectApi.submitTaskForReview(projectId, task._id, { completionNotes, progressSummary, checklistConfirmed });
      onTaskUpdated(data.task);
      onClose();
    } catch (e: any) {
      setWorkflowError(e.response?.data?.message || 'Failed to submit for review');
    } finally { setIsWorkflowSubmitting(false); }
  };

  const handleApproveTask = async () => {
    if (!task) return;
    setIsWorkflowSubmitting(true);
    setWorkflowError('');
    try {
      const data = await projectApi.approveTask(projectId, task._id, { reviewNotes });
      onTaskUpdated(data.task);
      onClose();
    } catch (e: any) {
      setWorkflowError(e.response?.data?.message || 'Failed to approve task');
    } finally { setIsWorkflowSubmitting(false); }
  };

  const handleRejectTask = async () => {
    if (!task) return;
    if (!reworkComment.trim()) { setWorkflowError('Rework comment is required.'); return; }
    setIsWorkflowSubmitting(true);
    setWorkflowError('');
    try {
      const data = await projectApi.rejectTask(projectId, task._id, { reworkComment });
      onTaskUpdated(data.task);
      onClose();
    } catch (e: any) {
      setWorkflowError(e.response?.data?.message || 'Failed to reject task');
    } finally { setIsWorkflowSubmitting(false); }
  };

  const completedChecklist = editChecklist.filter(c => c.done).length;
  const checklistProgress  = editChecklist.length > 0
    ? Math.round((completedChecklist / editChecklist.length) * 100) : 0;

  if (!task) return null;

  const priConfig  = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.MEDIUM;
  const statConfig = STATUS_CONFIG[task.status]     ?? STATUS_CONFIG.TODO;

  const showReviewTab =
    (task.status === 'REVIEW' && (isEmployee || canApprove)) ||
    (task.status === 'IN_PROGRESS' && isEmployee);

  const tabs: { id: TabType; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'details',   label: 'Details',   icon: <Flag className="w-3.5 h-3.5" /> },
    { id: 'checklist', label: 'Checklist', icon: <CheckSquare className="w-3.5 h-3.5" />, badge: editChecklist.length },
    { id: 'comments',  label: 'Comments',  icon: <MessageSquare className="w-3.5 h-3.5" />, badge: comments.length },
    { id: 'activity',  label: 'Activity',  icon: <Clock className="w-3.5 h-3.5" /> },
    ...(showReviewTab ? [{ id: 'review' as TabType, label: 'Review', icon: <ThumbsUp className="w-3.5 h-3.5" /> }] : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm">
      {/* Click-away overlay */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer */}
      <div className="relative z-10 flex flex-col bg-[#0f1117]/85 backdrop-blur-xl border-l border-white/10 w-full max-w-2xl h-full shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-white/10">
          <div className="flex-1 pr-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${priConfig.bg} ${priConfig.color}`}>
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${priConfig.dot} mr-1`} />
                {priConfig.label}
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${statConfig.bg} ${statConfig.color}`}>
                {statConfig.label}
              </span>
              {(task.reworkCount ?? 0) > 0 && (
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border bg-red-500/10 border-red-500/30 text-red-400 flex items-center gap-1">
                  <RotateCcw className="w-3 h-3" /> Rework ×{task.reworkCount}
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-white leading-snug">{task.title}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="ml-0.5 bg-white/10 text-slate-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* ── DETAILS ── */}
          {activeTab === 'details' && (
            <div className="space-y-5">
              {/* Task Title Edit */}
              {canEdit && (
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Task Title</p>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className="w-full bg-transparent text-sm text-white font-semibold outline-none border-b border-white/10 focus:border-primary/50 pb-1"
                    placeholder="Task Title"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {/* Assigned To */}
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Assigned To</p>
                  {canEdit ? (
                    <select value={editAssignedTo} onChange={e => setEditAssignedTo(e.target.value)}
                      className="w-full bg-transparent text-sm text-white outline-none">
                      <option value="">Unassigned</option>
                      {teamMembers.map(m => <option key={m._id} value={m._id}>{m.fullName}</option>)}
                    </select>
                  ) : (
                    <p className="text-sm text-white font-medium">{task.assignedTo?.fullName || 'Unassigned'}</p>
                  )}
                </div>

                {/* Due Date */}
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Due Date</p>
                  {canEdit ? (
                    <input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)}
                      className="w-full bg-transparent text-sm text-white outline-none" />
                  ) : (
                    <p className="text-sm text-white font-medium">
                      {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
                    </p>
                  )}
                </div>

                {/* Priority */}
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Priority</p>
                  {canEdit ? (
                    <select value={editPriority} onChange={e => setEditPriority(e.target.value)}
                      className="w-full bg-transparent text-sm text-white outline-none">
                      {['LOW','MEDIUM','HIGH','CRITICAL'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  ) : (
                    <p className={`text-sm font-semibold ${priConfig.color}`}>{task.priority}</p>
                  )}
                </div>

                {/* Sprint */}
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Sprint</p>
                  {canEdit ? (
                    <select value={editSprintId} onChange={e => setEditSprintId(e.target.value)}
                      className="w-full bg-transparent text-sm text-white outline-none">
                      <option value="">Backlog</option>
                      {sprints.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                    </select>
                  ) : (
                    <p className="text-sm text-white font-medium">
                      {sprints.find(s => s._id === task.sprintId)?.name || 'Backlog'}
                    </p>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Description</p>
                {canEdit ? (
                  <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)}
                    className="w-full bg-transparent text-sm text-slate-200 outline-none resize-none min-h-[80px] placeholder:text-slate-600"
                    placeholder="Add a description..." />
                ) : (
                  <p className="text-sm text-slate-300 leading-relaxed">{task.description || 'No description.'}</p>
                )}
              </div>

              {/* Tags */}
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-3">Tags</p>
                <div className="flex flex-wrap gap-2 mb-2">
                  {editTags.map((tag, i) => (
                    <span key={i} className="flex items-center gap-1 bg-primary/10 text-primary border border-primary/30 px-2 py-0.5 rounded-full text-xs font-medium">
                      <Tag className="w-3 h-3" />{tag}
                      {canEdit && (
                        <button onClick={() => setEditTags(editTags.filter((_, idx) => idx !== i))}
                          className="hover:text-red-400 ml-0.5">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                {canEdit && (
                  <input value={newTag} onChange={e => setNewTag(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && newTag.trim()) { setEditTags([...editTags, newTag.trim()]); setNewTag(''); } }}
                    placeholder="Add tag & press Enter"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-primary/50" />
                )}
              </div>

              {/* Rework history */}
              {(task.reworkComments?.length ?? 0) > 0 && (
                <div className="bg-red-500/5 rounded-xl p-4 border border-red-500/20">
                  <p className="text-[10px] uppercase tracking-wider text-red-400 mb-3 flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5" /> Rework History ({task.reworkComments!.length})
                  </p>
                  <div className="space-y-3">
                    {task.reworkComments!.map((rc, i) => (
                      <div key={i} className="bg-white/5 rounded-lg p-3 border border-red-500/10">
                        <p className="text-sm text-slate-200">{rc.comment}</p>
                        <p className="text-[10px] text-slate-500 mt-1">{rc.byName} · {new Date(rc.at).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              {canEdit && (
                <div className="flex justify-between items-center pt-2">
                  <button onClick={handleDeleteTask}
                    className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 px-3 py-2 rounded-lg hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/20">
                    <Trash2 className="w-3.5 h-3.5" /> Delete Task
                  </button>
                  <button onClick={handleSaveDetails} disabled={isSaving}
                    className="flex items-center gap-1.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Save Changes
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── CHECKLIST ── */}
          {activeTab === 'checklist' && (
            <div className="space-y-4">
              {editChecklist.length > 0 && (
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${checklistProgress}%` }} />
                  </div>
                  <span className="text-xs font-bold text-primary min-w-[45px] text-right">
                    {completedChecklist}/{editChecklist.length}
                  </span>
                </div>
              )}
              <div className="space-y-2">
                {editChecklist.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/10 group">
                    <button
                      onClick={async () => {
                        const updated = editChecklist.map((c, idx) => idx === i ? { ...c, done: !c.done } : c);
                        setEditChecklist(updated);
                        // Auto-save checklist
                        try {
                          const data = await projectApi.updateTask(projectId, task!._id, { checklist: updated });
                          onTaskUpdated(data.task);
                        } catch (e) { console.error(e); }
                      }}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${item.done ? 'bg-primary border-primary' : 'border-slate-500 hover:border-primary'}`}>
                      {item.done && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <span className={`flex-1 text-sm ${item.done ? 'line-through text-slate-500' : 'text-slate-200'}`}>{item.label}</span>
                    {canEdit && (
                      <button onClick={async () => {
                        const updated = editChecklist.filter((_, idx) => idx !== i);
                        setEditChecklist(updated);
                        // Auto-save checklist
                        try {
                          const data = await projectApi.updateTask(projectId, task!._id, { checklist: updated });
                          onTaskUpdated(data.task);
                        } catch (e) { console.error(e); }
                      }}
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <input value={newChecklistItem} onChange={e => setNewChecklistItem(e.target.value)}
                    onKeyDown={async e => {
                      if (e.key === 'Enter' && newChecklistItem.trim()) {
                        const updated = [...editChecklist, { label: newChecklistItem.trim(), done: false }];
                        setEditChecklist(updated);
                        setNewChecklistItem('');
                        // Auto-save checklist
                        try {
                          const data = await projectApi.updateTask(projectId, task!._id, { checklist: updated });
                          onTaskUpdated(data.task);
                        } catch (err) { console.error(err); }
                      }
                    }}
                    placeholder="Add checklist item & press Enter..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary/50 placeholder:text-slate-600" />
                  <button
                    onClick={async () => {
                      if (newChecklistItem.trim()) {
                        const updated = [...editChecklist, { label: newChecklistItem.trim(), done: false }];
                        setEditChecklist(updated);
                        setNewChecklistItem('');
                        // Auto-save checklist
                        try {
                          const data = await projectApi.updateTask(projectId, task!._id, { checklist: updated });
                          onTaskUpdated(data.task);
                        } catch (err) { console.error(err); }
                      }
                    }}
                    className="px-3 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-semibold transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── COMMENTS ── */}
          {activeTab === 'comments' && (
            <div className="space-y-4">
              {isCommentsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
              ) : comments.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">No comments yet. Start the conversation.</div>
              ) : (
                <div className="space-y-3">
                  {comments.map((c: any) => (
                    <div key={c._id} className={`rounded-xl p-4 border ${c.isReworkNote ? 'bg-red-500/5 border-red-500/20' : 'bg-white/5 border-white/10'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold border border-primary/30">
                          {c.authorName?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-white">{c.authorName}</p>
                          <p className="text-[10px] text-slate-500">{new Date(c.createdAt).toLocaleString()}</p>
                        </div>
                        {c.isReworkNote && (
                          <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full font-bold">REWORK</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">{c.content}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-3 pt-2 border-t border-white/10">
                <textarea value={newComment} onChange={e => setNewComment(e.target.value)}
                  placeholder="Write a comment..." rows={2}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary/50 resize-none placeholder:text-slate-600" />
                <button onClick={handleAddComment} disabled={isSubmittingComment || !newComment.trim()}
                  className="self-end px-3 py-3 bg-primary hover:bg-primary/90 disabled:opacity-40 text-white rounded-xl transition-colors">
                  {isSubmittingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* ── ACTIVITY ── */}
          {activeTab === 'activity' && (
            <div className="space-y-2">
              {isActivityLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
              ) : activities.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">No activity recorded yet.</div>
              ) : (
                <div className="relative pl-6">
                  <div className="absolute left-2.5 top-0 bottom-0 w-px bg-white/10" />
                  {activities.map((a: any) => (
                    <div key={a._id} className="relative mb-4">
                      <div className="absolute -left-4 top-0.5 w-6 h-6 rounded-full bg-[#0f1117] border border-white/10 flex items-center justify-center">
                        {ACTION_ICONS[a.action] || <Clock className="w-3 h-3 text-slate-500" />}
                      </div>
                      <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-semibold text-white">{a.actorName}</p>
                          <p className="text-[10px] text-slate-500">{new Date(a.createdAt).toLocaleString()}</p>
                        </div>
                        <p className="text-xs text-slate-400">
                          {a.action.replace(/_/g, ' ')}
                          {a.from && a.to && ` · ${a.from} → ${a.to}`}
                        </p>
                        {a.comment && <p className="text-xs text-slate-500 mt-1 italic">"{a.comment}"</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── REVIEW ── */}
          {activeTab === 'review' && (
            <div className="space-y-5">
              {/* Submitted notes (visible to Team Lead) */}
              {task.completionNotes && (
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Employee Completion Notes</p>
                  <p className="text-sm text-slate-200">{task.completionNotes}</p>
                </div>
              )}
              {task.progressSummary && (
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Progress Summary</p>
                  <p className="text-sm text-slate-200">{task.progressSummary}</p>
                </div>
              )}

              {/* Employee: submit for review (only when IN_PROGRESS) */}
              {isEmployee && task.status === 'IN_PROGRESS' && (
                <div className="bg-indigo-500/5 rounded-xl p-5 border border-indigo-500/20 space-y-4">
                  <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                    <Send className="w-4 h-4" /> Submit for Review
                  </h3>
                  <textarea value={completionNotes} onChange={e => setCompletionNotes(e.target.value)}
                    placeholder="What did you complete? Include any notes for the reviewer..." rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500/50 resize-none placeholder:text-slate-600" />
                  <textarea value={progressSummary} onChange={e => setProgressSummary(e.target.value)}
                    placeholder="Optional: Brief progress summary..." rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500/50 resize-none placeholder:text-slate-600" />
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={checklistConfirmed} onChange={e => setChecklistConfirmed(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-500 text-indigo-500 bg-transparent" />
                    <span className="text-sm text-slate-300">I confirm all checklist items are complete</span>
                  </label>
                  {workflowError && (
                    <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">{workflowError}</p>
                  )}
                  <button onClick={handleSubmitForReview} disabled={isWorkflowSubmitting}
                    className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold text-sm py-3 rounded-xl transition-colors disabled:opacity-50">
                    {isWorkflowSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Submit for Review
                  </button>
                </div>
              )}

              {/* Team Lead: approve/reject (only when REVIEW) */}
              {canApprove && task.status === 'REVIEW' && (
                <div className="space-y-4">
                  {/* Approve */}
                  <div className="bg-emerald-500/5 rounded-xl p-5 border border-emerald-500/20 space-y-4">
                    <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                      <ThumbsUp className="w-4 h-4" /> Approve Task
                    </h3>
                    <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)}
                      placeholder="Optional review notes..." rows={2}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50 resize-none placeholder:text-slate-600" />
                    <button onClick={handleApproveTask} disabled={isWorkflowSubmitting}
                      className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm py-3 rounded-xl transition-colors disabled:opacity-50">
                      {isWorkflowSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                      Approve &amp; Mark Completed
                    </button>
                  </div>

                  {/* Reject / Rework */}
                  <div className="bg-red-500/5 rounded-xl p-5 border border-red-500/20 space-y-4">
                    <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
                      <RotateCcw className="w-4 h-4" /> Request Rework
                    </h3>
                    <textarea value={reworkComment} onChange={e => setReworkComment(e.target.value)}
                      placeholder="Describe what needs to be reworked (required)..." rows={3}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-red-500/50 resize-none placeholder:text-slate-600" />
                    {workflowError && (
                      <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">{workflowError}</p>
                    )}
                    <button onClick={handleRejectTask} disabled={isWorkflowSubmitting || !reworkComment.trim()}
                      className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold text-sm py-3 rounded-xl transition-colors disabled:opacity-50">
                      {isWorkflowSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                      Send Back for Rework
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
