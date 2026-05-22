import React, { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { io } from 'socket.io-client';
import { projectApi } from '../../api_service/projectApi';

const COLUMNS = ['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'];

interface Task {
  _id: string;
  title: string;
  description?: string;
  status: string;
  assignedTo?: { fullName: string; profileImage?: string };
}

interface KanbanBoardProps {
  projectId: string;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ projectId }) => {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const data = await projectApi.getTasks(projectId);
        setTasks(data.tasks);
      } catch (error) {
        console.error('Failed to fetch tasks', error);
      }
    };
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
      setTasks(prev => [...prev, newTask]);
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

    const newStatus = destination.droppableId;
    
    // Optimistic UI update
    setTasks(prev => 
      prev.map(t => t._id === draggableId ? { ...t, status: newStatus } : t)
    );

    try {
      await projectApi.updateTaskStatus(projectId, draggableId, newStatus);
    } catch (error) {
      console.error('Failed to update task status', error);
      // Revert on failure
      const data = await projectApi.getTasks(projectId);
      setTasks(data.tasks);
    }
  };

  const getTasksByStatus = (status: string) => {
    return tasks.filter(t => t.status === status);
  };

  return (
    <div className="flex h-full gap-6 overflow-x-auto pb-4">
      <DragDropContext onDragEnd={onDragEnd}>
        {COLUMNS.map((status) => (
          <div key={status} className="flex-1 min-w-[300px] bg-slate-900/50 rounded-xl p-4 border border-slate-800 flex flex-col">
            <h3 className="font-semibold text-slate-300 mb-4 flex items-center justify-between">
              {status.replace('_', ' ')}
              <span className="bg-slate-800 text-slate-400 text-xs py-0.5 px-2 rounded-full">
                {getTasksByStatus(status).length}
              </span>
            </h3>
            
            <Droppable droppableId={status}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex-1 min-h-[200px] transition-colors rounded-lg ${
                    snapshot.isDraggingOver ? 'bg-slate-800/50' : ''
                  }`}
                >
                  {getTasksByStatus(status).map((task, index) => (
                    <Draggable key={task._id} draggableId={task._id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`mb-3 p-4 bg-slate-800 rounded-lg border transition-all ${
                            snapshot.isDragging 
                              ? 'border-indigo-500 shadow-lg shadow-indigo-500/20 rotate-2 scale-105' 
                              : 'border-slate-700 hover:border-slate-600'
                          }`}
                        >
                          <h4 className="text-slate-200 font-medium mb-2">{task.title}</h4>
                          {task.description && (
                            <p className="text-slate-400 text-sm line-clamp-2 mb-3">{task.description}</p>
                          )}
                          <div className="flex items-center justify-between mt-auto">
                            {task.assignedTo && (
                              <div className="flex items-center text-xs text-slate-400">
                                <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 mr-2 border border-indigo-500/30">
                                  {task.assignedTo.fullName.charAt(0)}
                                </div>
                                {task.assignedTo.fullName}
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
        ))}
      </DragDropContext>
    </div>
  );
};
