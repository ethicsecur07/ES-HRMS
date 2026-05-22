import React, { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { recruitmentApi } from '../api_service/recruitmentApi';
import type { Candidate, RecruitmentStage } from '../types';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { Button } from '../Components/WrapperComponents/Button';
import { Input } from '../Components/WrapperComponents/Input';
import { Modal } from '../Components/WrapperComponents/Modal';
import { 
  Users, 
  Plus, 
  Search, 
  MoreVertical, 
  Mail, 
  Phone, 
  Briefcase,
  FileText
} from 'lucide-react';
import { formatDate } from '../utils/formatters';

const STAGES: RecruitmentStage[] = ['NEW', 'SCREENING', 'INTERVIEW', 'TECHNICAL', 'HR', 'OFFER', 'HIRED'];

const STAGE_LABELS: Record<RecruitmentStage, string> = {
  NEW: 'New Applied',
  SCREENING: 'Screening',
  INTERVIEW: 'First Interview',
  TECHNICAL: 'Technical',
  HR: 'HR Round',
  OFFER: 'Offer Extended',
  HIRED: 'Hired'
};

const STAGE_COLORS: Record<RecruitmentStage, string> = {
  NEW: 'border-slate-500/20 bg-slate-500/10 text-slate-500',
  SCREENING: 'border-blue-500/20 bg-blue-500/10 text-blue-500',
  INTERVIEW: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-500',
  TECHNICAL: 'border-purple-500/20 bg-purple-500/10 text-purple-500',
  HR: 'border-pink-500/20 bg-pink-500/10 text-pink-500',
  OFFER: 'border-amber-500/20 bg-amber-500/10 text-amber-500',
  HIRED: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
};

export const RecruitmentPage: React.FC = () => {
  const { role, token } = useAuthStore();
  const { addToast } = useNotificationStore();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    appliedRole: '',
    resumeUrl: ''
  });

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ['candidates'],
    queryFn: recruitmentApi.getAll
  });

  const createMutation = useMutation({
    mutationFn: recruitmentApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      addToast('Candidate Added', 'New candidate added to the pipeline.', 'success');
      setShowAddModal(false);
      setFormData({ firstName: '', lastName: '', email: '', phone: '', appliedRole: '', resumeUrl: '' });
    }
  });

  const updateStageMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: RecruitmentStage }) => recruitmentApi.updateStage(id, stage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
    },
    onError: () => {
      addToast('Update Failed', 'Could not move candidate.', 'error');
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
    }
  });

  useEffect(() => {
    const getSocketUrl = () => {
      const envApiUrl = import.meta.env.VITE_API_URL;
      if (envApiUrl && !envApiUrl.includes('localhost')) {
        return envApiUrl.replace('/api', '');
      }
      return `${window.location.protocol}//${window.location.hostname}:5000`;
    };
    const socketUrl = getSocketUrl();
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: { token }
    });

    socket.on('candidate_created', () => queryClient.invalidateQueries({ queryKey: ['candidates'] }));
    socket.on('candidate_updated', () => queryClient.invalidateQueries({ queryKey: ['candidates'] }));
    socket.on('candidate_deleted', () => queryClient.invalidateQueries({ queryKey: ['candidates'] }));

    return () => {
      socket.disconnect();
    };
  }, [token, queryClient]);

  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const newStage = destination.droppableId as RecruitmentStage;
    
    // Optimistic update
    queryClient.setQueryData<Candidate[]>(['candidates'], (old) => {
      if (!old) return [];
      return old.map(c => c._id === draggableId ? { ...c, stage: newStage } : c);
    });

    updateStageMutation.mutate({ id: draggableId, stage: newStage });
  };

  const filteredCandidates = candidates.filter(c => 
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    c.appliedRole.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  const candidatesByStage = STAGES.reduce((acc, stage) => {
    acc[stage] = filteredCandidates.filter(c => c.stage === stage);
    return acc;
  }, {} as Record<RecruitmentStage, Candidate[]>);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-xs font-semibold uppercase tracking-wider">Loading Pipeline...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Recruitment ATS
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Applicant Tracking System and Candidate Pipeline
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search candidates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-background text-foreground border border-border rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          {(role === 'ADMIN' || role === 'HR') && (
            <Button onClick={() => setShowAddModal(true)} className="shrink-0 flex items-center gap-1.5 shadow-md">
              <Plus className="w-4 h-4" /> Add Candidate
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex h-full gap-4 pb-4 min-w-max">
            {STAGES.map((stage) => (
              <div key={stage} className="flex flex-col w-[300px] h-full shrink-0">
                <div className={`mb-3 py-2 px-3 rounded-lg border flex items-center justify-between ${STAGE_COLORS[stage]}`}>
                  <h3 className="font-bold text-xs uppercase tracking-wider">{STAGE_LABELS[stage]}</h3>
                  <span className="bg-background/50 px-2 py-0.5 rounded-full text-[10px] font-bold">
                    {candidatesByStage[stage]?.length || 0}
                  </span>
                </div>

                <Droppable droppableId={stage}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 rounded-xl p-2 transition-colors overflow-y-auto ${
                        snapshot.isDraggingOver ? 'bg-primary/5 border border-primary/20' : 'bg-muted/30 border border-transparent'
                      }`}
                    >
                      {candidatesByStage[stage]?.map((candidate, index) => (
                        <Draggable key={candidate._id} draggableId={candidate._id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`bg-card p-3.5 mb-2.5 rounded-xl border shadow-sm transition-all text-left ${
                                snapshot.isDragging ? 'shadow-lg border-primary ring-1 ring-primary/20 opacity-90' : 'border-border hover:border-primary/30'
                              }`}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <h4 className="font-bold text-sm text-foreground">{candidate.firstName} {candidate.lastName}</h4>
                                  <div className="flex items-center gap-1.5 text-xs text-primary font-medium mt-0.5">
                                    <Briefcase className="w-3 h-3" />
                                    {candidate.appliedRole}
                                  </div>
                                </div>
                                <button className="text-muted-foreground hover:text-foreground">
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                              </div>
                              
                              <div className="space-y-1 mt-3">
                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                  <Mail className="w-3.5 h-3.5" />
                                  <span className="truncate">{candidate.email}</span>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                  <Phone className="w-3.5 h-3.5" />
                                  <span>{candidate.phone}</span>
                                </div>
                              </div>

                              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  {formatDate(candidate.createdAt)}
                                </div>
                                {candidate.resumeUrl && (
                                  <a href={candidate.resumeUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] font-bold text-primary hover:underline">
                                    <FileText className="w-3 h-3" /> Resume
                                  </a>
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
          </div>
        </DragDropContext>
      </div>

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Candidate"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name *"
              value={formData.firstName}
              onChange={(e) => setFormData(p => ({ ...p, firstName: e.target.value }))}
              required
            />
            <Input
              label="Last Name *"
              value={formData.lastName}
              onChange={(e) => setFormData(p => ({ ...p, lastName: e.target.value }))}
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Email Address *"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
              required
            />
            <Input
              label="Phone Number *"
              value={formData.phone}
              onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
              required
            />
          </div>

          <Input
            label="Applied Role / Position *"
            placeholder="e.g., Senior Frontend Engineer"
            value={formData.appliedRole}
            onChange={(e) => setFormData(p => ({ ...p, appliedRole: e.target.value }))}
            required
          />

          <Input
            label="Resume Link (Optional)"
            placeholder="https://..."
            value={formData.resumeUrl}
            onChange={(e) => setFormData(p => ({ ...p, resumeUrl: e.target.value }))}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" type="button" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              Add Candidate
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
