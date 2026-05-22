import React, { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { io } from 'socket.io-client';
import { Plus, Trash2, Calendar, Award } from 'lucide-react';
import { projectApi } from '../../api_service/projectApi';
import { Modal } from '../WrapperComponents/Modal';
import { Input, Select, Textarea } from '../WrapperComponents/Input';
import { Button } from '../WrapperComponents/Button';
import { usePermission } from '../../hooks/usePermission';

const COLUMNS = ['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'];

interface Task {
  _id: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  assignedTo?: { _id: string; fullName: string; profileImage?: string };
  sprintId?: string;
  sprintName?: string;
  storyPoints?: number;
  dueDate?: string;
}

interface KanbanBoardProps {
  projectId: string;
  selectedSprintId: string;
  sprints: any[];
  teamMembers: any[];
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ 
  projectId, 
  selectedSprintId, 
  sprints,
  teamMembers 
}) => {
  const { hasPermission } = usePermission();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null); // null means "Create mode"

  // Task Form State
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskStatus, setTaskStatus] = useState<'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED'>('TODO');
  const [taskPriority, setTaskPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [assignedToId, setAssignedToId] = useState('');
  const [taskSprintId, setTaskSprintId] = useState('');
  const [storyPoints, setStoryPoints] = useState(0);
  const [dueDate, setDueDate] = useState('');

  const fetchTasks = async () => {
    try {
      // Fetch all tasks for the project; we filter by sprint on the client
      const data = await projectApi.getTasks(projectId);
      setTasks(data.tasks || []);
    } catch (error) {
      console.error('Failed to fetch tasks', error);
    }
  };

  useEffect(() => {
    fetchTasks();

    const envApiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
    const socketUrl = envApiUrl.replace(/\/api$/, '');
    
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: {
        token: localStorage.getItem('token') || ''
      }
    });

    newSocket.on('connect', () => {
      newSocket.emit('join_project_board', projectId);
    });

    newSocket.on('task_created', (newTask: Task) => {
      setTasks(prev => {
        if (prev.some(t => t._id === newTask._id)) return prev;
        return [...prev, newTask];
      });
    });

    newSocket.on('task_updated', (updatedTask: Task) => {
      setTasks(prev => prev.map(t => t._id === updatedTask._id ? updatedTask : t));
    });

    newSocket.on('task_deleted', ({ taskId }) => {
      setTasks(prev => prev.filter(t => t._id !== taskId));
    });

    return () => {
      newSocket.disconnect();
    };
  }, [projectId]);

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const newStatus = destination.droppableId as any;
    
    // Optimistic UI update
    setTasks(prev => 
      prev.map(t => t._id === draggableId ? { ...t, status: newStatus } : t)
    );

    try {
      await projectApi.updateTaskStatus(projectId, draggableId, newStatus);
    } catch (error) {
      console.error('Failed to update task status', error);
      // Revert on failure
      fetchTasks();
    }
  };

  // Filter tasks based on selected sprint
  const getTasksByStatus = (status: string) => {
    return tasks.filter(t => {
      if (t.status !== status) return false;
      if (selectedSprintId === 'backlog') {
        return !t.sprintId; // Show backlog tasks (no sprint assigned)
      }
      return t.sprintId === selectedSprintId;
    });
  };

  const handleOpenCreateModal = (columnStatus: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED') => {
    setActiveTask(null);
    setTaskTitle('');
    setTaskDesc('');
    setTaskStatus(columnStatus);
    setTaskPriority('MEDIUM');
    setAssignedToId('');
    setTaskSprintId(selectedSprintId === 'backlog' ? '' : selectedSprintId);
    setStoryPoints(0);
    setDueDate('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (task: Task) => {
    setActiveTask(task);
    setTaskTitle(task.title);
    setTaskDesc(task.description || '');
    setTaskStatus(task.status);
    setTaskPriority(task.priority);
    setAssignedToId(task.assignedTo?._id || '');
    setTaskSprintId(task.sprintId || '');
    setStoryPoints(task.storyPoints || 0);
    setDueDate(task.dueDate || '');
    setIsModalOpen(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle || !assignedToId) {
      alert('Task Title and Assignee are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: taskTitle,
        description: taskDesc,
        status: taskStatus,
        priority: taskPriority,
        assignedTo: assignedToId,
        sprintId: taskSprintId || 'backlog', // Backend controller will sanitize empty values
        storyPoints,
        dueDate
      };

      if (activeTask) {
        // Edit mode
        await projectApi.updateTask(projectId, activeTask._id, payload);
      } else {
        // Create mode
        await projectApi.createTask(projectId, payload);
      }
      setIsModalOpen(false);
      fetchTasks();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to save task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!activeTask) return;
    if (!window.confirm('Are you sure you want to delete this task?')) return;

    setIsSubmitting(true);
    try {
      await projectApi.deleteTask(projectId, activeTask._id);
      setIsModalOpen(false);
      fetchTasks();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to delete task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'bg-red-500/10 text-red-500 border border-red-500/20';
      case 'HIGH': return 'bg-orange-500/10 text-orange-500 border border-orange-500/20';
      case 'MEDIUM': return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
      case 'LOW': return 'bg-muted text-muted-foreground border border-border';
      default: return 'bg-muted text-muted-foreground border border-border';
    }
  };

  return (
    <div className="flex h-full gap-6 overflow-x-auto pb-4 text-left">
      <DragDropContext onDragEnd={onDragEnd}>
        {COLUMNS.map((status) => {
          const filteredTasks = getTasksByStatus(status);
          return (
            <div key={status} className="flex-1 min-w-[300px] max-w-[380px] bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col h-full max-h-[80vh]">
              <h3 className="font-semibold text-foreground mb-4 flex items-center justify-between">
                <span>{status.replace('_', ' ')}</span>
                <div className="flex items-center gap-2">
                  <span className="bg-muted text-muted-foreground text-xs py-0.5 px-2 rounded-full font-bold">
                    {filteredTasks.length}
                  </span>
                  {hasPermission('PROJECTS', 'edit') && (
                    <button 
                      onClick={() => handleOpenCreateModal(status as any)}
                      className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </h3>
              
              <Droppable droppableId={status}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 min-h-[200px] overflow-y-auto pr-1 transition-colors rounded-lg ${
                      snapshot.isDraggingOver ? 'bg-muted/50' : ''
                    }`}
                  >
                    {filteredTasks.map((task, index) => (
                      <Draggable key={task._id} draggableId={task._id} index={index} isDragDisabled={!hasPermission('PROJECTS', 'edit')}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onClick={() => handleOpenEditModal(task)}
                            className={`mb-3 p-4  border transition-all cursor-pointer bg-[#F75F0A] rounded-xl group ${
                              snapshot.isDragging 
                                ? 'border-primary shadow-xl shadow-primary/20 rotate-1 scale-[1.02]' 
                                : 'border-border hover:border-muted-foreground/30 hover:bg-muted/10'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2 mb-2">
                              <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wider ${getPriorityColor(task.priority)}`}>
                                {task.priority}
                              </span>
                              {task.storyPoints !== undefined && task.storyPoints > 0 && (
                                <span className="flex items-center text-[10px] text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                                  <Award className="w-3 h-3 mr-0.5" />
                                  {task.storyPoints} pts
                                </span>
                              )}
                            </div>
                            
                            <h4 className="text-foreground font-medium text-sm mb-2 group-hover:text-primary transition-colors line-clamp-2">{task.title}</h4>
                            
                            {task.description && (
                              <p className="text-muted-foreground text-xs line-clamp-2 mb-3 leading-relaxed">{task.description}</p>
                            )}
                            
                            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                              {task.dueDate && (
                                <div className="flex items-center text-[10px] text-muted-foreground">
                                  <Calendar className="w-3.5 h-3.5 mr-1" />
                                  {new Date(task.dueDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                                </div>
                              )}
                              {task.assignedTo && (
                                <div className="flex items-center text-[10px] text-muted-foreground ml-auto gap-1.5 bg-background px-2 py-1 rounded-full border border-border">
                                  <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[8px] font-bold border border-primary/30 uppercase">
                                    {task.assignedTo.fullName.charAt(0)}
                                  </div>
                                  <span className="font-medium">{task.assignedTo.fullName}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </DragDropContext>

      {/* Task Creation & Edit Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={activeTask ? 'Edit Task Details' : 'Create New Task'}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSaveTask} className="space-y-4 text-left">
          <Input 
            label="Task Title *"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder="Implement user login form"
            required
            disabled={!hasPermission('PROJECTS', 'edit')}
          />

          <Textarea 
            label="Description"
            value={taskDesc}
            onChange={(e) => setTaskDesc(e.target.value)}
            placeholder="Add detailed steps or acceptance criteria..."
            disabled={!hasPermission('PROJECTS', 'edit')}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select 
              label="Assigned To *"
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              required
              disabled={!hasPermission('PROJECTS', 'edit')}
            >
              <option value="">Select Assignee</option>
              {teamMembers.map((member) => (
                <option key={member._id} value={member._id}>
                  {member.fullName}
                </option>
              ))}
            </Select>
            <Select 
              label="Priority *"
              value={taskPriority}
              onChange={(e) => setTaskPriority(e.target.value as any)}
              options={[
                { value: 'LOW', label: 'Low' },
                { value: 'MEDIUM', label: 'Medium' },
                { value: 'HIGH', label: 'High' },
                { value: 'CRITICAL', label: 'Critical' }
              ]}
              required
              disabled={!hasPermission('PROJECTS', 'edit')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select 
              label="Status *"
              value={taskStatus}
              onChange={(e) => setTaskStatus(e.target.value as any)}
              options={[
                { value: 'TODO', label: 'To Do' },
                { value: 'IN_PROGRESS', label: 'In Progress' },
                { value: 'REVIEW', label: 'Review' },
                { value: 'COMPLETED', label: 'Completed' }
              ]}
              required
              disabled={!hasPermission('PROJECTS', 'edit')}
            />
            <Select 
              label="Sprint"
              value={taskSprintId}
              onChange={(e) => setTaskSprintId(e.target.value)}
              disabled={!hasPermission('PROJECTS', 'edit')}
            >
              <option value="backlog">Backlog (No Sprint)</option>
              {sprints.map((sprint) => (
                <option key={sprint._id} value={sprint._id}>
                  {sprint.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Story Points"
              type="number"
              value={storyPoints}
              onChange={(e) => setStoryPoints(Number(e.target.value))}
              placeholder="e.g. 3"
              disabled={!hasPermission('PROJECTS', 'edit')}
            />
            <Input 
              label="Due Date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={!hasPermission('PROJECTS', 'edit')}
            />
          </div>

          <div className="flex justify-between gap-3 pt-4 border-t border-border mt-6">
            {activeTask && hasPermission('PROJECTS', 'edit') ? (
              <button
                type="button"
                onClick={handleDeleteTask}
                className="flex items-center text-red-500 hover:text-red-400 px-3 py-2 rounded-lg hover:bg-red-500/10 transition-colors mr-auto font-medium text-sm border border-transparent hover:border-red-500/10"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Task
              </button>
            ) : (
              <div />
            )}
            
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              {hasPermission('PROJECTS', 'edit') && (
                <Button type="submit" isLoading={isSubmitting}>
                  {activeTask ? 'Save Task' : 'Create Task'}
                </Button>
              )}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
