import React, { useEffect, useState, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { io } from 'socket.io-client';
import {
  Plus, Calendar, Award, Tag, CheckSquare, RotateCcw,
  Send, Eye, AlertCircle
} from 'lucide-react';
import { projectApi } from '../../api_service/projectApi';
import { useAuthStore } from '../../store/useAuthStore';
import { TaskDetailModal } from './TaskDetailModal';

// ─── Types ───────────────────────────────────────────────────────
interface Task {
  _id: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  assignedTo?: { _id: string; fullName: string; profileImage?: string; email?: string };
  sprintId?: string;
  sprintName?: string;
  storyPoints?: number;
  dueDate?: string;
  tags?: string[];
  checklist?: { label: string; done: boolean }[];
  attachments?: any[];
  reworkCount?: number;
  reworkComments?: any[];
  reviewNotes?: string;
  completionNotes?: string;
  progressSummary?: string;
  submittedAt?: string;
  reviewedAt?: string;
}

interface KanbanBoardProps {
  projectId: string;
  selectedSprintId: string;
  sprints: any[];
  teamMembers: any[];
}

// ─── Column config ────────────────────────────────────────────────
const COLUMN_CONFIG = {
  TODO: {
    label: 'To Do',
    color: 'text-slate-300',
    headerBg: 'bg-slate-500/10 border-slate-500/30',
    dotColor: 'bg-slate-400',
    dropBg: 'bg-slate-500/5',
    addAllowed: ['TEAM_LEAD', 'MANAGER', 'HR'],
  },
  IN_PROGRESS: {
    label: 'In Progress',
    color: 'text-blue-300',
    headerBg: 'bg-blue-500/10 border-blue-500/30',
    dotColor: 'bg-blue-400',
    dropBg: 'bg-blue-500/5',
    addAllowed: [],
  },
  REVIEW: {
    label: 'Review',
    color: 'text-purple-300',
    headerBg: 'bg-purple-500/10 border-purple-500/30',
    dotColor: 'bg-purple-400',
    dropBg: 'bg-purple-500/5',
    addAllowed: [],
  },
  COMPLETED: {
    label: 'Completed',
    color: 'text-emerald-300',
    headerBg: 'bg-emerald-500/10 border-emerald-500/30',
    dotColor: 'bg-emerald-400',
    dropBg: 'bg-emerald-500/5',
    addAllowed: [],
  },
};

const PRIORITY_COLORS = {
  CRITICAL: 'bg-red-500/10 text-red-400 border-red-500/30',
  HIGH: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  MEDIUM: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  LOW: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
};

const PRIORITY_DOT = {
  CRITICAL: 'bg-red-500',
  HIGH: 'bg-orange-500',
  MEDIUM: 'bg-amber-400',
  LOW: 'bg-slate-400',
};

const COLUMNS = ['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'] as const;

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  projectId,
  selectedSprintId,
  sprints,
  teamMembers,
}) => {
  const { user } = useAuthStore();
  const userRole = (user as any)?.role || '';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createColumn, setCreateColumn] = useState<'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED'>('TODO');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);

  // Create task form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [newAssignedTo, setNewAssignedTo] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newSprintId, setNewSprintId] = useState('');
  const [newStoryPoints, setNewStoryPoints] = useState(0);

  const isAdmin = userRole === 'ADMIN';
  const isEmployee = userRole === 'EMPLOYEE';
  const isTeamLead = ['TEAM_LEAD', 'MANAGER', 'HR'].includes(userRole);
  const canCreateTasks = isTeamLead;

  const fetchTasks = useCallback(async () => {
    try {
      const data = await projectApi.getTasks(projectId);
      setTasks(data.tasks || []);
    } catch (error) {
      console.error('Failed to fetch tasks', error);
    }
  }, [projectId]);

  useEffect(() => {
    fetchTasks();

    const envApiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
    const socketUrl = envApiUrl.replace(/\/api$/, '');

    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: { token: localStorage.getItem('token') || '' },
    });

    socket.on('connect', () => {
      socket.emit('join_project_board', projectId);
    });

    socket.on('task_created', (newTask: Task) => {
      setTasks(prev => prev.some(t => t._id === newTask._id) ? prev : [...prev, newTask]);
    });

    socket.on('task_updated', (updatedTask: Task) => {
      setTasks(prev => prev.map(t => t._id === updatedTask._id ? updatedTask : t));
      // Update selectedTask if it's open
      setSelectedTask(prev => prev?._id === updatedTask._id ? updatedTask : prev);
    });

    socket.on('task_deleted', ({ taskId }: { taskId: string }) => {
      setTasks(prev => prev.filter(t => t._id !== taskId));
      setSelectedTask(prev => prev?._id === taskId ? null : prev);
    });

    return () => { socket.disconnect(); };
  }, [projectId, fetchTasks]);

  // Filter tasks by sprint and status
  const getTasksByStatus = (status: string) => {
    return tasks.filter(t => {
      if (t.status !== status) return false;
      if (selectedSprintId === 'backlog') return !t.sprintId;
      return t.sprintId === selectedSprintId;
    });
  };

  // Determine if a user can drag a task
  const canDragTask = (_task: Task): boolean => {
    if (isAdmin) return false;
    if (isTeamLead) return true;
    if (isEmployee) {
      // Employee can only drag their own tasks
      // We check via assignedTo._id vs userId — but userId is the User._id, not Employee._id
      // Best effort: check email or rely on server validation
      return true; // Server enforces the actual restriction
    }
    return false;
  };

  const onDragEnd = async (result: DropResult) => {
    setDragError(null);
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const newStatus = destination.droppableId as Task['status'];

    // Client-side guard: employees cannot drag into REVIEW (must use Submit button)
    if (isEmployee && newStatus === 'REVIEW') {
      setDragError('Use the "Submit for Review" button on the task card to submit your work for review.');
      setTimeout(() => setDragError(null), 4000);
      return;
    }

    // Client-side guard: admin cannot drag
    if (isAdmin) {
      setDragError('Admins have view-only access to the board.');
      setTimeout(() => setDragError(null), 3000);
      return;
    }

    // Optimistic update
    setTasks(prev => prev.map(t => t._id === draggableId ? { ...t, status: newStatus } : t));

    try {
      await projectApi.updateTaskStatus(projectId, draggableId, newStatus);
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to update task status';
      setDragError(msg);
      setTimeout(() => setDragError(null), 5000);
      fetchTasks(); // Revert
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newAssignedTo) {
      alert('Title and Assignee are required.');
      return;
    }
    setIsSubmitting(true);
    try {
      await projectApi.createTask(projectId, {
        title: newTitle,
        description: newDesc,
        status: createColumn,
        priority: newPriority,
        assignedTo: newAssignedTo,
        sprintId: newSprintId || (selectedSprintId === 'backlog' ? '' : selectedSprintId),
        storyPoints: newStoryPoints,
        dueDate: newDueDate,
      });
      setIsCreateModalOpen(false);
      resetCreateForm();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetCreateForm = () => {
    setNewTitle(''); setNewDesc(''); setNewPriority('MEDIUM');
    setNewAssignedTo(''); setNewDueDate(''); setNewSprintId(''); setNewStoryPoints(0);
  };

  const openCreateModal = (col: typeof createColumn) => {
    setCreateColumn(col);
    resetCreateForm();
    setNewSprintId(selectedSprintId === 'backlog' ? '' : selectedSprintId);
    setIsCreateModalOpen(true);
  };

  const handleTaskUpdated = (updatedTask: Task) => {
    setTasks(prev => prev.map(t => t._id === updatedTask._id ? updatedTask : t));
    setSelectedTask(updatedTask);
  };

  const handleTaskDeleted = (taskId: string) => {
    setTasks(prev => prev.filter(t => t._id !== taskId));
    setSelectedTask(null);
  };

  const getChecklistProgress = (task: Task) => {
    if (!task.checklist || task.checklist.length === 0) return null;
    const done = task.checklist.filter(c => c.done).length;
    return { done, total: task.checklist.length, pct: Math.round((done / task.checklist.length) * 100) };
  };

  const isOverdue = (task: Task) => {
    if (!task.dueDate || task.status === 'COMPLETED') return false;
    return new Date(task.dueDate) < new Date();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Role Banner */}
      {isAdmin && (
        <div className="flex items-center gap-2 mb-4 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs font-semibold">
          <Eye className="w-4 h-4" /> You are in view-only mode. Admins cannot create or move tasks.
        </div>
      )}
      {isEmployee && (
        <div className="flex items-center gap-2 mb-4 px-4 py-2.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-300 text-xs font-semibold">
          <AlertCircle className="w-4 h-4" /> You can move your tasks between To Do ↔ In Progress. Use "Submit for Review" to submit completed work.
        </div>
      )}

      {/* Drag error toast */}
      {dragError && (
        <div className="flex items-center gap-2 mb-4 px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs font-semibold animate-in slide-in-from-top duration-200">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {dragError}
        </div>
      )}

      {/* Kanban Columns */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-5 overflow-x-auto pb-4 flex-1">
          {COLUMNS.map(status => {
            const config = COLUMN_CONFIG[status];
            const columnTasks = getTasksByStatus(status);
            const canAdd = canCreateTasks && (config.addAllowed as string[]).includes(userRole);

            return (
              <div
                key={status}
                className="flex flex-col flex-shrink-0 w-[300px] xl:w-[320px]"
              >
                {/* Column Header */}
                <div className={`flex items-center justify-between px-4 py-3 rounded-xl border mb-3 ${config.headerBg}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${config.dotColor}`} />
                    <span className={`text-sm font-bold ${config.color}`}>{config.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                      {columnTasks.length}
                    </span>
                    {canAdd && (
                      <button
                        onClick={() => openCreateModal(status)}
                        className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                        title={`Add task to ${config.label}`}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Droppable Area */}
                <Droppable droppableId={status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 min-h-[300px] rounded-xl transition-all duration-200 p-1.5 ${snapshot.isDraggingOver ? `${config.dropBg} ring-1 ring-inset ring-white/10` : ''
                        }`}
                    >
                      {columnTasks.length === 0 && !snapshot.isDraggingOver && (
                        <div className="flex flex-col items-center justify-center h-32 text-slate-600 text-xs font-medium">
                          <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center mb-2">
                            {status === 'COMPLETED' ? <CheckSquare className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                          </div>
                          No tasks here
                        </div>
                      )}

                      {columnTasks.map((task, index) => {
                        const checklistProg = getChecklistProgress(task);
                        const overdue = isOverdue(task);
                        const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.MEDIUM;
                        const priorityDot = PRIORITY_DOT[task.priority] || PRIORITY_DOT.MEDIUM;

                        return (
                          <Draggable
                            key={task._id}
                            draggableId={task._id}
                            index={index}
                            isDragDisabled={!canDragTask(task) || isAdmin}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                onClick={() => setSelectedTask(task)}
                                className={`mb-2.5 p-4 rounded-2xl border cursor-pointer group transition-all duration-150 ${snapshot.isDragging
                                    ? 'border-primary/60 shadow-2xl shadow-primary/30 scale-[1.02] rotate-1 bg-card/85 backdrop-blur-md'
                                    : 'bg-white/5 backdrop-blur-sm border-white/10 hover:border-white/20 hover:bg-white/10'
                                  } ${overdue ? 'border-red-500/20' : ''}`}
                              >
                                {/* Top row: priority + badges */}
                                <div className="flex items-center justify-between mb-3">
                                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border flex items-center gap-1 ${priorityColor}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${priorityDot}`} />
                                    {task.priority}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    {(task.reworkCount || 0) > 0 && (
                                      <span className="flex items-center gap-0.5 text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full">
                                        <RotateCcw className="w-2.5 h-2.5" />×{task.reworkCount}
                                      </span>
                                    )}
                                    {(task.storyPoints || 0) > 0 && (
                                      <span className="flex items-center gap-0.5 text-[9px] font-bold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full">
                                        <Award className="w-2.5 h-2.5" />{task.storyPoints}
                                      </span>
                                    )}
                                    {(task.attachments?.length || 0) > 0 && (
                                      <span className="text-[9px] text-slate-500 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-full">
                                        📎{task.attachments!.length}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Title */}
                                <h4 className="text-sm font-semibold text-white mb-1.5 leading-snug group-hover:text-primary transition-colors line-clamp-2">
                                  {task.title}
                                </h4>

                                {/* Description preview */}
                                {task.description && (
                                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mb-2">
                                    {task.description}
                                  </p>
                                )}

                                {/* Tags */}
                                {(task.tags?.length || 0) > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-2">
                                    {task.tags!.slice(0, 2).map((tag, i) => (
                                      <span key={i} className="flex items-center gap-0.5 text-[9px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full">
                                        <Tag className="w-2 h-2" />{tag}
                                      </span>
                                    ))}
                                    {task.tags!.length > 2 && (
                                      <span className="text-[9px] text-slate-500">+{task.tags!.length - 2}</span>
                                    )}
                                  </div>
                                )}

                                {/* Checklist progress */}
                                {checklistProg && (
                                  <div className="mb-3">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="flex items-center gap-1 text-[10px] text-slate-500">
                                        <CheckSquare className="w-3 h-3" />
                                        {checklistProg.done}/{checklistProg.total}
                                      </span>
                                      <span className="text-[10px] text-slate-500">{checklistProg.pct}%</span>
                                    </div>
                                    <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-primary rounded-full transition-all"
                                        style={{ width: `${checklistProg.pct}%` }}
                                      />
                                    </div>
                                  </div>
                                )}

                                {/* Employee submit button (only on IN_PROGRESS tasks assigned to current user) */}
                                {isEmployee && task.status === 'IN_PROGRESS' && (
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      setSelectedTask(task);
                                      // The modal will open to the review tab automatically
                                    }}
                                    className="w-full mb-2 flex items-center justify-center gap-1.5 text-[10px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 py-1.5 rounded-lg hover:bg-purple-500/20 transition-colors"
                                  >
                                    <Send className="w-3 h-3" /> Submit for Review
                                  </button>
                                )}

                                {/* Footer: due date + assignee */}
                                <div className="flex items-center justify-between pt-2.5 mt-1 border-t border-white/8">
                                  {task.dueDate ? (
                                    <div className={`flex items-center gap-1 text-[10px] font-medium ${overdue ? 'text-red-400' : 'text-slate-500'}`}>
                                      <Calendar className="w-3 h-3" />
                                      {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                      {overdue && <span className="ml-0.5">⚠</span>}
                                    </div>
                                  ) : <div />}

                                  {task.assignedTo && (
                                    <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2 py-1 rounded-full">
                                      <div className="w-4 h-4 rounded-full bg-primary/30 flex items-center justify-center text-primary text-[8px] font-bold border border-primary/30 uppercase">
                                        {task.assignedTo.fullName?.charAt(0)}
                                      </div>
                                      <span className="text-[10px] text-slate-400 font-medium max-w-[80px] truncate">
                                        {task.assignedTo.fullName?.split(' ')[0]}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          projectId={projectId}
          teamMembers={teamMembers}
          sprints={sprints}
          onClose={() => setSelectedTask(null)}
          onTaskUpdated={handleTaskUpdated}
          onTaskDeleted={handleTaskDeleted}
        />
      )}

      {/* Create Task Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-card border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6">
            <h3 className="text-lg font-bold text-white mb-5">Create Task — {COLUMN_CONFIG[createColumn].label}</h3>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Title *</label>
                <input
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Implement user authentication..."
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary/50 placeholder:text-slate-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Description</label>
                <textarea
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="Add detailed steps or acceptance criteria..."
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary/50 resize-none placeholder:text-slate-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Assignee *</label>
                  <select
                    value={newAssignedTo}
                    onChange={e => setNewAssignedTo(e.target.value)}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-primary/50"
                  >
                    <option value="">Select Assignee</option>
                    {teamMembers.map(m => (
                      <option key={m._id} value={m._id}>{m.fullName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Priority</label>
                  <select
                    value={newPriority}
                    onChange={e => setNewPriority(e.target.value as any)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-primary/50"
                  >
                    {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Due Date</label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={e => setNewDueDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Story Points</label>
                  <input
                    type="number"
                    value={newStoryPoints}
                    onChange={e => setNewStoryPoints(Number(e.target.value))}
                    min={0}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-primary/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Sprint</label>
                <select
                  value={newSprintId}
                  onChange={e => setNewSprintId(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-primary/50"
                >
                  <option value="">Backlog (No Sprint)</option>
                  {sprints.map(s => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => { setIsCreateModalOpen(false); resetCreateForm(); }}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : <Plus className="w-4 h-4" />}
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
