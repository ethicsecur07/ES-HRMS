import React, { useEffect, useState, useMemo } from 'react';
import { TableSkeleton } from '../Components/WrapperComponents/Skeleton';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { recruitmentApi } from '../api_service/recruitmentApi';
import { departmentApi } from '../api_service/departmentApi';
import { designationApi } from '../api_service/designationApi';
import { employeeApi } from '../api_service/employeeApi';
import type { Candidate, RecruitmentStage, StageEvaluation } from '../types';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { Button } from '../Components/WrapperComponents/Button';
import { usePermission } from '../hooks/usePermission';
import { Input } from '../Components/WrapperComponents/Input';
import { Modal } from '../Components/WrapperComponents/Modal';
import { OfferLetterModal } from '../Components/SpecifiedComponents/OfferLetterModal';
import { ScheduleMeetingModal } from '../Components/SpecifiedComponents/ScheduleMeetingModal';
import { EvaluationModal } from '../Components/SpecifiedComponents/EvaluationModal';
import { 
  Users, 
  Plus, 
  Search, 
  MoreVertical, 
  Mail, 
  Phone, 
  Briefcase,
  FileText,
  FileCheck,
  Trash2,
  Edit3,
  Star,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  Video
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
  const { token } = useAuthStore();
  const { addToast } = useNotificationStore();
  const { hasPermission } = usePermission();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerCandidate, setOfferCandidate] = useState<Candidate | null>(null);
  
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [evalCandidate, setEvalCandidate] = useState<Candidate | null>(null);
  
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editCandidate, setEditCandidate] = useState<Candidate | null>(null);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [interviewCandidate, setInterviewCandidate] = useState<Candidate | null>(null);

  // Hired Onboarding State
  const [showHiredModal, setShowHiredModal] = useState(false);
  const [hiredCandidate, setHiredCandidate] = useState<Candidate | null>(null);
  const [isOnboardingSubmit, setIsOnboardingSubmit] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [hiredFormData, setHiredFormData] = useState({
    employeeCode: '',
    fullName: '',
    email: '',
    phone: '',
    password: 'EthicSec@2026',
    departmentId: '',
    designationId: '',
    joiningDate: new Date().toISOString().split('T')[0],
    salary: 0,
    address: '2nd Floor, NV Arcade Building, Salem - 636004',
    emergencyName: 'Emergency Contact',
    emergencyRel: 'Guardian',
    emergencyPhone: '+919876543210'
  });

  // Load dynamic Departments & Designations
  const { data: departments = [] } = useQuery({
    queryKey: ['departments_recruitment'],
    queryFn: departmentApi.getAll,
  });

  const { data: designations = [] } = useQuery({
    queryKey: ['designations_recruitment'],
    queryFn: () => designationApi.getAll(),
  });

  // Load employees for lead assignment (TEAM_LEAD + MANAGER + HR roles)
  const { data: allEmployeesData } = useQuery({
    queryKey: ['employees_leads_recruitment'],
    queryFn: () => employeeApi.getAll({ isActive: true, limit: 200 }),
    enabled: showHiredModal,
  });
  const allEmployees = allEmployeesData?.employees || [];

  const leadOptions = useMemo(() => {
    const leads = allEmployees.filter((emp: any) => 
      (emp.role === 'TEAM_LEAD' || emp.role === 'MANAGER' || emp.role === 'HR') && emp.isActive
    );
    return [...leads].sort((a, b) => {
      const aDeptId = typeof a.departmentId === 'object' && a.departmentId !== null ? a.departmentId._id : a.departmentId;
      const bDeptId = typeof b.departmentId === 'object' && b.departmentId !== null ? b.departmentId._id : b.departmentId;
      const aInDept = aDeptId === hiredFormData.departmentId;
      const bInDept = bDeptId === hiredFormData.departmentId;
      if (aInDept && !bInDept) return -1;
      if (!aInDept && bInDept) return 1;
      return a.fullName.localeCompare(b.fullName);
    });
  }, [allEmployees, hiredFormData.departmentId]);

  // Per-column "Show More" expansion state
  const [columnExpanded, setColumnExpanded] = useState<Record<string, boolean>>({});
  const CARDS_PER_COLUMN = 5;

  // Add custom round state
  const [newRoundInput, setNewRoundInput] = useState('');

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    appliedRole: '',
    resumeUrl: '',
    marksheetUrl: ''
  });

  const [editFormData, setEditFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    appliedRole: '',
    resumeUrl: '',
    marksheetUrl: ''
  });

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ['candidates'],
    queryFn: recruitmentApi.getAll
  });

  const { data: templateData } = useQuery({
    queryKey: ['offerTemplate'],
    queryFn: recruitmentApi.getDefaultTemplate
  });

  const globalRoundsNeeded: RecruitmentStage[] = templateData?.template?.roundsNeeded || STAGES;

  const updateTemplateMutation = useMutation({
    mutationFn: recruitmentApi.updateDefaultTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offerTemplate'] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      addToast('Pipeline Updated', 'Global ATS recruitment stages updated successfully.', 'success');
    },
    onError: (error: any) => {
      addToast('Update Failed', error?.response?.data?.message || 'Could not update pipeline settings.', 'error');
    }
  });

  const handleToggleStage = (stage: RecruitmentStage) => {
    let newRounds: RecruitmentStage[];
    if (globalRoundsNeeded.includes(stage)) {
      newRounds = globalRoundsNeeded.filter((r: RecruitmentStage) => r !== stage);
    } else {
      // Re-insert at original position among STAGES
      newRounds = STAGES.filter(r => r === stage || globalRoundsNeeded.includes(r));
    }
    updateTemplateMutation.mutate({ roundsNeeded: newRounds });
  };

  const handleAddCustomRound = () => {
    const trimmed = newRoundInput.trim().toUpperCase().replace(/\s+/g, '_');
    if (!trimmed) return;
    if (globalRoundsNeeded.includes(trimmed as RecruitmentStage)) {
      addToast('Duplicate Round', 'This round already exists in the pipeline.', 'error');
      return;
    }
    // Insert before HIRED
    const hiredIdx = globalRoundsNeeded.indexOf('HIRED' as RecruitmentStage);
    let newRounds: string[];
    if (hiredIdx !== -1) {
      newRounds = [
        ...globalRoundsNeeded.slice(0, hiredIdx),
        trimmed,
        ...globalRoundsNeeded.slice(hiredIdx)
      ];
    } else {
      newRounds = [...globalRoundsNeeded, trimmed];
    }
    updateTemplateMutation.mutate({ roundsNeeded: newRounds as RecruitmentStage[] });
    setNewRoundInput('');
  };

  const createMutation = useMutation({
    mutationFn: recruitmentApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      addToast('Candidate Added', 'New candidate added to the pipeline.', 'success');
      setShowAddModal(false);
      setFormData({ firstName: '', lastName: '', email: '', phone: '', appliedRole: '', resumeUrl: '', marksheetUrl: '' });
    },
    onError: (error: any) => {
      const errMsg = error?.response?.data?.message || error.message || 'Could not add candidate.';
      addToast('Add Candidate Failed', errMsg, 'error');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Candidate> }) => recruitmentApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      addToast('Candidate Updated', 'Candidate details were successfully updated.', 'success');
      setShowEditModal(false);
      setEditCandidate(null);
    },
    onError: (error: any) => {
      addToast('Update Failed', error?.response?.data?.message || 'Could not update candidate.', 'error');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: recruitmentApi.delete,
    onMutate: async (id: string) => {
      // Optimistically remove from cache immediately
      await queryClient.cancelQueries({ queryKey: ['candidates'] });
      const previous = queryClient.getQueryData<Candidate[]>(['candidates']);
      queryClient.setQueryData<Candidate[]>(['candidates'], (old) =>
        old ? old.filter(c => c._id !== id) : []
      );
      return { previous };
    },
    onSuccess: () => {
      addToast('Candidate Removed', 'Candidate was removed from the pipeline.', 'success');
    },
    onError: (error: any, _id, context: any) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(['candidates'], context.previous);
      }
      addToast('Delete Failed', error?.response?.data?.message || 'Could not delete candidate.', 'error');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
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

    if (newStage === 'OFFER') {
      const cand = candidates.find(c => c._id === draggableId);
      if (cand) {
        setOfferCandidate(cand);
        setShowOfferModal(true);
      }
      return;
    }

    if (newStage === 'HIRED') {
      const cand = candidates.find(c => c._id === draggableId);
      if (cand) {
        handleOpenOnboard(cand);
      }
      updateStageMutation.mutate({ id: draggableId, stage: newStage });
      return;
    }
    
    // Optimistic update
    queryClient.setQueryData<Candidate[]>(['candidates'], (old) => {
      if (!old) return [];
      return old.map(c => c._id === draggableId ? { ...c, stage: newStage } : c);
    });

    updateStageMutation.mutate({ id: draggableId, stage: newStage });
  };

  const getDownloadUrl = (candidateId: string) => {
    const envApiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
    let baseUrl = '';
    if (envApiUrl && !envApiUrl.includes('localhost')) {
      baseUrl = envApiUrl;
    } else {
      baseUrl = `${window.location.protocol}//${window.location.hostname}:5000/api`;
    }
    return `${baseUrl.replace(/\/$/, '')}/recruitment/${candidateId}/offer-letter?token=${token}`;
  };

  const filteredCandidates = candidates.filter(c => 
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    c.appliedRole.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  const candidatesByStage = globalRoundsNeeded.reduce((acc: Record<string, Candidate[]>, stage: RecruitmentStage) => {
    acc[stage] = filteredCandidates.filter(c => c.stage === stage);
    return acc;
  }, {} as Record<string, Candidate[]>);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCandidate) return;
    updateMutation.mutate({ id: editCandidate._id, data: editFormData });
  };

  // Onboarding Helpers for Hired Candidates
  const filteredHiredDesignations = useMemo(() => {
    if (!hiredFormData.departmentId) return [];
    return designations.filter((d: any) => {
      const deptId = typeof d.departmentId === 'object' && d.departmentId !== null
        ? d.departmentId._id
        : d.departmentId;
      return deptId === hiredFormData.departmentId && d.isActive;
    });
  }, [hiredFormData.departmentId, designations]);

  const handleOpenOnboard = async (cand: Candidate) => {
    setHiredCandidate(cand);

    // Smart pre-select based on offer letter appliedRole
    let matchedDeptId = '';
    let matchedDesigId = '';

    if (cand.appliedRole) {
      const match = designations.find((d: any) => 
        d.name.toLowerCase().trim() === cand.appliedRole.toLowerCase().trim()
      );
      if (match) {
        matchedDesigId = match._id;
        matchedDeptId = typeof match.departmentId === 'object' && match.departmentId !== null
          ? (match.departmentId as any)._id
          : (match.departmentId as string) || '';
      } else {
        const partialMatch = designations.find((d: any) => 
          d.name.toLowerCase().includes(cand.appliedRole.toLowerCase()) ||
          cand.appliedRole.toLowerCase().includes(d.name.toLowerCase())
        );
        if (partialMatch) {
          matchedDesigId = partialMatch._id;
          matchedDeptId = typeof partialMatch.departmentId === 'object' && partialMatch.departmentId !== null
            ? (partialMatch.departmentId as any)._id
            : (partialMatch.departmentId as string) || '';
        }
      }
    }

    // Intern stipend and code logic: if applied role or matched designation has "intern" keyword, prefix code with INT-
    const matchedDesig = designations.find((d: any) => d._id === matchedDesigId);
    const isIntern = (cand.appliedRole && cand.appliedRole.toLowerCase().includes('intern')) ||
                     (matchedDesig && matchedDesig.name.toLowerCase().includes('intern'));
    
    // Fetch details as per mentioned in offer letter for that candidate alone
    const defaultSalary = cand.offerDetails?.salaryOffered || 0;

    let finalCode = isIntern ? `INT-${Date.now().toString().slice(-4)}` : `EMP-${Date.now().toString().slice(-4)}`;
    try {
      const code = await employeeApi.getNextEmployeeCode(isIntern, matchedDeptId, matchedDesigId);
      if (code) finalCode = code;
    } catch (err) {
      // fallback
    }

    setHiredFormData({
      employeeCode: finalCode,
      fullName: `${cand.firstName} ${cand.lastName}`,
      email: cand.email,
      phone: cand.phone,
      password: 'EthicSec@2026',
      departmentId: matchedDeptId,
      designationId: matchedDesigId,
      joiningDate: new Date().toISOString().split('T')[0],
      salary: defaultSalary,
      address: '2nd Floor, NV Arcade Building, Salem - 636004',
      emergencyName: 'Emergency Contact',
      emergencyRel: 'Guardian',
      emergencyPhone: '+919876543210'
    });
    setSelectedLeadId('');
    setShowHiredModal(true);
  };

  const handleHiredDeptChange = async (deptId: string) => {
    const filtered = designations.filter((d: any) => {
      const dId = typeof d.departmentId === 'object' && d.departmentId !== null ? d.departmentId._id : d.departmentId;
      return dId === deptId && d.isActive;
    });
    const desigId = filtered.length > 0 ? filtered[0]._id : '';
    const desig = designations.find((d: any) => d._id === desigId);
    const isIntern = desig?.name.toLowerCase().includes('intern');

    let nextCode = isIntern ? `INT-${Date.now().toString().slice(-4)}` : `EMP-${Date.now().toString().slice(-4)}`;
    try {
      const code = await employeeApi.getNextEmployeeCode(isIntern, deptId, desigId);
      if (code) nextCode = code;
    } catch (err) {
      // fallback
    }

    setHiredFormData(p => ({
      ...p,
      departmentId: deptId,
      designationId: desigId,
      employeeCode: nextCode,
      salary: hiredCandidate?.offerDetails?.salaryOffered || 0
    }));
  };

  const handleHiredDesignationChange = async (desigId: string) => {
    const desig = designations.find((d: any) => d._id === desigId);
    const isIntern = desig?.name.toLowerCase().includes('intern');

    let nextCode = isIntern ? `INT-${Date.now().toString().slice(-4)}` : `EMP-${Date.now().toString().slice(-4)}`;
    try {
      const code = await employeeApi.getNextEmployeeCode(isIntern, hiredFormData.departmentId, desigId);
      if (code) nextCode = code;
    } catch (err) {
      // fallback
    }

    setHiredFormData(p => ({
      ...p,
      designationId: desigId,
      employeeCode: nextCode,
      salary: hiredCandidate?.offerDetails?.salaryOffered || 0
    }));
  };

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hiredFormData.departmentId || !hiredFormData.designationId) {
      addToast('Selection Missing', 'Please select a valid Department and Designation.', 'error');
      return;
    }

    setIsOnboardingSubmit(true);
    try {
      const targetDept = departments.find((d: any) => d._id === hiredFormData.departmentId);
      const targetDesig = designations.find((d: any) => d._id === hiredFormData.designationId);

      const payload: any = {
        employeeCode: hiredFormData.employeeCode,
        fullName: hiredFormData.fullName,
        email: hiredFormData.email,
        password: hiredFormData.password,
        phone: hiredFormData.phone,
        department: targetDept?.name || 'Developers',
        designation: targetDesig?.name || 'Staff',
        departmentId: hiredFormData.departmentId,
        designationId: hiredFormData.designationId,
        joiningDate: hiredFormData.joiningDate,
        profileImage: hiredCandidate?.resumeUrl || '',
        salary: Number(hiredFormData.salary),
        address: hiredFormData.address,
        emergencyContact: {
          name: hiredFormData.emergencyName,
          relationship: hiredFormData.emergencyRel,
          phone: hiredFormData.emergencyPhone,
        },
        bankDetails: {
          bankName: '',
          accountName: '',
          accountNumber: '',
          ifscCode: '',
          branchName: '',
        },
        taxDetails: {
          panNumber: '',
          taxRegime: '' as "" | "OLD" | "NEW",
        },
        ...(hiredCandidate?._id ? { candidateId: hiredCandidate._id } : {}),
        ...(selectedLeadId ? { leadId: selectedLeadId } : {}),
      };

      const resData = await employeeApi.create(payload);
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      
      const pwd = resData?.generatedPassword || hiredFormData.password;
      addToast(
        'System Account Created', 
        `General employee credentials provisioned! Email: ${payload.email} | Password: ${pwd}`, 
        'success'
      );
      setShowHiredModal(false);
      setHiredCandidate(null);
    } catch (error: any) {
      console.error(error);
      let errMsg = error.response?.data?.message || error.message || 'Failed to onboard candidate.';
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        const details = error.response.data.errors.map((e: any) => `${e.field}: ${e.message}`).join(', ');
        errMsg = `${errMsg} (${details})`;
      }
      addToast('Onboarding Failed', errMsg, 'error');
    } finally {
      setIsOnboardingSubmit(false);
    }
  };

  if (isLoading) {
    return <TableSkeleton />;
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
          {hasPermission('RECRUITMENT', 'create') && (
            <Button onClick={() => setShowAddModal(true)} className="shrink-0 flex items-center gap-1.5 shadow-md">
              <Plus className="w-4 h-4" /> Add Candidate
            </Button>
          )}
        </div>
      </div>

      {/* ATS Pipeline Configuration Panel */}
      <div className="p-5 rounded-2xl bg-card border border-border shadow-sm shrink-0 text-left">
        <div className="flex items-center gap-2 mb-2">
          <ClipboardCheck className="w-5 h-5 text-primary animate-pulse" />
          <h3 className="text-sm font-bold text-foreground">ATS Pipeline Stages Configuration</h3>
          <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-full font-extrabold uppercase tracking-wide">
            Global settings
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Enable or disable specific rounds globally. Candidates will dynamically adapt their progress ratios, metrics, and timeline dots based on these global settings.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {globalRoundsNeeded.map((stg: RecruitmentStage) => {
            if (stg === 'NEW' || stg === 'HIRED') return null;
            const isBuiltin = STAGES.includes(stg as RecruitmentStage);
            const isChecked = true; // Already in active rounds means checked
            return (
              <label 
                key={stg} 
                className="flex items-center gap-2.5 text-xs font-bold text-foreground cursor-pointer select-none group bg-muted/30 hover:bg-muted/70 border border-border/50 hover:border-primary/20 px-4 py-2.5 rounded-xl transition-all duration-200 shadow-sm"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={updateTemplateMutation.isPending}
                  onChange={() => {
                    if (isBuiltin) {
                      handleToggleStage(stg as RecruitmentStage);
                    } else {
                      // Remove custom round
                      updateTemplateMutation.mutate({ roundsNeeded: globalRoundsNeeded.filter((r: RecruitmentStage) => r !== stg) as RecruitmentStage[] });
                    }
                  }}
                  className="w-4 h-4 rounded text-primary focus:ring-primary border-border bg-background cursor-pointer accent-primary"
                />
                <span className="group-hover:text-primary transition-colors">
                  {STAGE_LABELS[stg as RecruitmentStage] || stg.replace(/_/g, ' ')}
                </span>
              </label>
            );
          })}
          {/* Disabled (unchecked) built-in stages */}
          {STAGES.filter(stg => stg !== 'NEW' && stg !== 'HIRED' && !globalRoundsNeeded.includes(stg)).map((stg) => (
            <label 
              key={stg} 
              className="flex items-center gap-2.5 text-xs font-bold text-muted-foreground cursor-pointer select-none group bg-muted/10 hover:bg-muted/30 border border-border/30 hover:border-primary/20 px-4 py-2.5 rounded-xl transition-all duration-200 shadow-sm opacity-50"
            >
              <input
                type="checkbox"
                checked={false}
                disabled={updateTemplateMutation.isPending}
                onChange={() => handleToggleStage(stg)}
                className="w-4 h-4 rounded text-primary focus:ring-primary border-border bg-background cursor-pointer accent-primary"
              />
              <span className="group-hover:text-primary transition-colors">
                {STAGE_LABELS[stg]}
              </span>
            </label>
          ))}
          {/* Add New Custom Round */}
          <div className="flex items-center gap-2 ml-auto">
            <input
              type="text"
              value={newRoundInput}
              onChange={(e) => setNewRoundInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCustomRound()}
              placeholder="New Round Name..."
              className="bg-background text-foreground border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary w-44"
              disabled={updateTemplateMutation.isPending}
            />
            <button
              onClick={handleAddCustomRound}
              disabled={updateTemplateMutation.isPending || !newRoundInput.trim()}
              className="flex items-center gap-1.5 text-xs font-bold text-primary border border-primary/30 bg-primary/10 hover:bg-primary/20 px-3 py-2 rounded-lg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Add Round
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex h-full gap-4 pb-4 min-w-max">
            {globalRoundsNeeded.map((stage: RecruitmentStage) => {
              const stageColor = STAGE_COLORS[stage] || 'border-slate-500/20 bg-slate-500/10 text-slate-500';
              const stageLabel = STAGE_LABELS[stage] || stage.replace(/_/g, ' ');
              const stageCandidates: Candidate[] = candidatesByStage[stage] || [];
              const isExpanded = columnExpanded[stage] || false;
              const visibleCandidates = isExpanded ? stageCandidates : stageCandidates.slice(0, CARDS_PER_COLUMN);
              const hiddenCount = stageCandidates.length - CARDS_PER_COLUMN;

              return (
              <div key={stage} className="flex flex-col w-[300px] h-full shrink-0">
                <div className={`mb-3 py-2 px-3 rounded-lg border flex items-center justify-between ${stageColor}`}>
                  <h3 className="font-bold text-xs uppercase tracking-wider">{stageLabel}</h3>
                  <span className="bg-background/50 px-2 py-0.5 rounded-full text-[10px] font-bold">
                    {stageCandidates.length}
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
                      {visibleCandidates.map((candidate: Candidate, index: number) => (
                        <Draggable key={candidate._id} draggableId={candidate._id} index={index} isDragDisabled={!hasPermission('RECRUITMENT', 'edit')}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`bg-card p-3.5 mb-2.5 rounded-xl border shadow-sm transition-all text-left ${
                                snapshot.isDragging ? 'shadow-lg border-primary ring-1 ring-primary/20 opacity-90' : 'border-border hover:border-primary/30'
                              }`}
                            >
                              <div className="flex justify-between items-start mb-2 text-left">
                                <div>
                                  <h4 className="font-bold text-sm text-foreground">{candidate.firstName} {candidate.lastName}</h4>
                                  <div className="flex items-center gap-1.5 text-xs text-primary font-medium mt-0.5">
                                    <Briefcase className="w-3 h-3" />
                                    {candidate.appliedRole}
                                  </div>
                                </div>
                                <div className="relative">
                                  <button 
                                    onClick={() => setActiveMenuId(activeMenuId === candidate._id ? null : candidate._id)}
                                    className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/80 transition-colors"
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </button>
                                  {activeMenuId === candidate._id && (
                                    <>
                                      <div className="fixed inset-0 z-10" onClick={() => setActiveMenuId(null)} />
                                      <div className="absolute right-0 mt-1.5 w-48 bg-card border border-border rounded-xl shadow-lg py-1.5 z-20 animate-in fade-in slide-in-from-top-1 duration-100 text-left">
                                        {hasPermission('RECRUITMENT', 'edit') && (
                                          <button
                                            onClick={() => {
                                              setActiveMenuId(null);
                                              setEditCandidate(candidate);
                                              setEditFormData({
                                                firstName: candidate.firstName,
                                                lastName: candidate.lastName,
                                                email: candidate.email,
                                                phone: candidate.phone,
                                                appliedRole: candidate.appliedRole,
                                                resumeUrl: candidate.resumeUrl || '',
                                                marksheetUrl: candidate.marksheetUrl || ''
                                              });
                                              setShowEditModal(true);
                                            }}
                                            className="w-full px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted flex items-center gap-2 hover:text-primary transition-colors text-left"
                                          >
                                            <Edit3 className="w-3.5 h-3.5" /> Edit Details
                                          </button>
                                        )}
                                        {hasPermission('RECRUITMENT', 'edit') && (
                                          <button
                                            onClick={() => {
                                              setActiveMenuId(null);
                                              setInterviewCandidate(candidate);
                                              setShowInterviewModal(true);
                                            }}
                                            className="w-full px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted flex items-center gap-2 hover:text-indigo-500 transition-colors text-left"
                                          >
                                            <Video className="w-3.5 h-3.5" /> Schedule Interview
                                          </button>
                                        )}
                                        <button
                                           onClick={() => {
                                             setActiveMenuId(null);
                                             setEvalCandidate(candidate);
                                             setShowEvalModal(true);
                                           }}
                                           className="w-full px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted flex items-center gap-2 hover:text-emerald-500 transition-colors text-left"
                                         >
                                           <ClipboardCheck className="w-3.5 h-3.5" /> Review & Evaluation
                                         </button>
                                         <button
                                           onClick={() => {
                                             setActiveMenuId(null);
                                             setOfferCandidate(candidate);
                                             setShowOfferModal(true);
                                           }}
                                           className="w-full px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted flex items-center gap-2 hover:text-amber-500 transition-colors text-left"
                                         >
                                           <Mail className="w-3.5 h-3.5" /> Send Offer Letter
                                         </button>
                                        {hasPermission('RECRUITMENT', 'delete') && (
                                          <button
                                            onClick={() => {
                                              setActiveMenuId(null);
                                              if (confirm(`Are you sure you want to delete ${candidate.firstName} ${candidate.lastName}?`)) {
                                                deleteMutation.mutate(candidate._id);
                                              }
                                            }}
                                            className="w-full px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-500/10 flex items-center gap-2 border-t border-border mt-1 transition-colors text-left"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" /> Delete Candidate
                                          </button>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
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

                              {/* Evaluations & Step Pipeline Progress */}
                              {(() => {
                                const activeRoundsList = globalRoundsNeeded;
                                const totalCompletedStages = candidate.evaluations?.filter((e: StageEvaluation) => e.completed && activeRoundsList.includes(e.stage)).length || 0;

                                // Calculate average ratings
                                let totalRatingsSum = 0;
                                let ratingsCount = 0;
                                candidate.evaluations?.forEach((e: StageEvaluation) => {
                                  if (e.completed && activeRoundsList.includes(e.stage)) {
                                    if (e.ratingTechnical) { totalRatingsSum += e.ratingTechnical; ratingsCount++; }
                                    if (e.ratingCommunication) { totalRatingsSum += e.ratingCommunication; ratingsCount++; }
                                  }
                                });
                                const averageRating = ratingsCount > 0 ? (totalRatingsSum / ratingsCount).toFixed(1) : null;

                                return (
                                  <div className="mt-3 pt-3 border-t border-border/50 flex flex-col gap-2 text-left">
                                    <div className="flex items-center justify-between text-[11px]">
                                      <span className="text-muted-foreground flex items-center gap-1 font-bold">
                                        <ClipboardCheck className="w-3.5 h-3.5 text-emerald-500" />
                                        {totalCompletedStages} / {activeRoundsList.length} Steps Completed
                                      </span>
                                      {averageRating && (
                                        <span className="flex items-center gap-0.5 font-extrabold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded text-[10px] shadow-sm">
                                          <Star className="w-3 h-3 fill-amber-500 stroke-amber-500" />
                                          {averageRating} Rating
                                        </span>
                                      )}
                                    </div>

                                    {/* Stage progress timeline dots */}
                                    <div className="flex items-center gap-1 mt-0.5">
                                      {globalRoundsNeeded.map((stg: RecruitmentStage) => {
                                        const isStgCompleted = !!candidate.evaluations?.find((e: StageEvaluation) => e.stage === stg && e.completed) || 
                                          (globalRoundsNeeded.indexOf(candidate.stage) > globalRoundsNeeded.indexOf(stg));
                                        const isCurrent = candidate.stage === stg;
                                        const stgLabel = STAGE_LABELS[stg as RecruitmentStage] || stg.replace(/_/g, ' ');
                                        
                                        return (
                                          <div
                                            key={stg}
                                            title={`${stgLabel}: ${isStgCompleted ? 'Completed' : isCurrent ? 'Active' : 'Pending'}`}
                                            className={`h-1.5 rounded-full flex-1 transition-all ${
                                              isStgCompleted
                                                ? 'bg-emerald-500 shadow-sm shadow-emerald-500/10'
                                                : isCurrent
                                                ? 'bg-primary animate-pulse shadow-sm shadow-primary/20'
                                                : 'bg-muted-foreground/20'
                                            }`}
                                          />
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })()}

                              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  {formatDate(candidate.createdAt)}
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {(candidate as any).interviewSchedule?.teamsJoinUrl && (
                                    <a
                                      href={(candidate as any).interviewSchedule.teamsJoinUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex items-center gap-1 text-[10px] font-bold text-indigo-500 hover:underline border border-indigo-500/20 bg-indigo-500/10 px-1.5 py-0.5 rounded cursor-pointer"
                                      title="Join Teams Interview"
                                    >
                                      <Video className="w-3 h-3" /> Join Interview
                                    </a>
                                  )}
                                  {candidate.offerDetails?.offerLetterUrl && (
                                    <a 
                                      href={getDownloadUrl(candidate._id)}
                                      target="_blank" 
                                      rel="noreferrer" 
                                      className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 hover:underline border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 rounded cursor-pointer animate-pulse"
                                      title="View / Download PDF Offer Letter"
                                    >
                                      <FileText className="w-3 h-3" /> Download Offer
                                    </a>
                                  )}
                                  {candidate.stage === 'OFFER' && (
                                    <button 
                                      onClick={() => { setOfferCandidate(candidate); setShowOfferModal(true); }}
                                      className="flex items-center gap-1 text-[10px] font-bold text-amber-500 hover:underline border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 rounded cursor-pointer"
                                      title="Edit & Send Offer Letter"
                                    >
                                      <Mail className="w-3 h-3" /> Offer Letter
                                    </button>
                                  )}
                                  {candidate.stage === 'HIRED' && (
                                    candidate.accountCreated ? (
                                      <button 
                                        onClick={() => handleOpenOnboard(candidate)}
                                        className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:underline border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 rounded cursor-pointer"
                                        title="View Onboarded Account Details"
                                      >
                                        <FileCheck className="w-3 h-3" /> Account Created
                                      </button>
                                    ) : (
                                      <button 
                                        onClick={() => handleOpenOnboard(candidate)}
                                        className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 hover:underline border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 rounded cursor-pointer"
                                        title="Create Employee System Account"
                                      >
                                        <Users className="w-3 h-3" /> Onboard Employee
                                      </button>
                                    )
                                  )}
                                  {candidate.resumeUrl && (
                                    <a href={candidate.resumeUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] font-bold text-primary hover:underline">
                                      <FileText className="w-3 h-3" /> Resume
                                    </a>
                                  )}
                                  {candidate.marksheetUrl && (
                                    <a href={candidate.marksheetUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] font-bold text-indigo-500 hover:underline border border-indigo-500/20 bg-indigo-500/10 px-1.5 py-0.5 rounded cursor-pointer" title="View Candidate Marksheet">
                                      <FileCheck className="w-3 h-3" /> Marksheet
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {/* Show More / Show Less button */}
                      {hiddenCount > 0 && (
                        <button
                          onClick={() => setColumnExpanded(prev => ({ ...prev, [stage]: true }))}
                          className="w-full mt-1 py-2 text-[11px] font-bold text-primary hover:text-primary/80 flex items-center justify-center gap-1 bg-primary/5 hover:bg-primary/10 rounded-lg border border-primary/10 transition-all duration-200"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                          Show {hiddenCount} more
                        </button>
                      )}
                      {isExpanded && stageCandidates.length > CARDS_PER_COLUMN && (
                        <button
                          onClick={() => setColumnExpanded(prev => ({ ...prev, [stage]: false }))}
                          className="w-full mt-1 py-2 text-[11px] font-bold text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 bg-muted/20 hover:bg-muted/40 rounded-lg border border-border/30 transition-all duration-200"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                          Show less
                        </button>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Candidate"
      >
        <form onSubmit={handleSubmit} className="space-y-4 px-2">
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

          <Input
            label="Marksheet URL (Optional)"
            placeholder="https://..."
            value={formData.marksheetUrl}
            onChange={(e) => setFormData(p => ({ ...p, marksheetUrl: e.target.value }))}
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

      <Modal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setEditCandidate(null); }}
        title="Edit Candidate Details"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 px-2">
          <div className="grid grid-cols-2 gap-4 text-left">
            <Input
              label="First Name *"
              value={editFormData.firstName}
              onChange={(e) => setEditFormData(p => ({ ...p, firstName: e.target.value }))}
              required
            />
            <Input
              label="Last Name *"
              value={editFormData.lastName}
              onChange={(e) => setEditFormData(p => ({ ...p, lastName: e.target.value }))}
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-left">
            <Input
              label="Email Address *"
              type="email"
              value={editFormData.email}
              onChange={(e) => setEditFormData(p => ({ ...p, email: e.target.value }))}
              required
            />
            <Input
              label="Phone Number *"
              value={editFormData.phone}
              onChange={(e) => setEditFormData(p => ({ ...p, phone: e.target.value }))}
              required
            />
          </div>

          <Input
            label="Applied Role / Position *"
            placeholder="e.g., Senior Frontend Engineer"
            value={editFormData.appliedRole}
            onChange={(e) => setEditFormData(p => ({ ...p, appliedRole: e.target.value }))}
            required
            className="text-left"
          />

          <Input
            label="Resume Link (Optional)"
            placeholder="https://..."
            value={editFormData.resumeUrl}
            onChange={(e) => setEditFormData(p => ({ ...p, resumeUrl: e.target.value }))}
            className="text-left"
          />

          <Input
            label="Marksheet URL (Optional)"
            placeholder="https://..."
            value={editFormData.marksheetUrl}
            onChange={(e) => setEditFormData(p => ({ ...p, marksheetUrl: e.target.value }))}
            className="text-left"
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" type="button" onClick={() => { setShowEditModal(false); setEditCandidate(null); }}>
              Cancel
            </Button>
            <Button type="submit" isLoading={updateMutation.isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      <OfferLetterModal
        isOpen={showOfferModal}
        onClose={() => { setShowOfferModal(false); setOfferCandidate(null); }}
        candidate={offerCandidate}
      />

      <EvaluationModal
        isOpen={showEvalModal}
        onClose={() => { setShowEvalModal(false); setEvalCandidate(null); }}
        candidate={evalCandidate}
      />

      <ScheduleMeetingModal
        isOpen={showInterviewModal}
        onClose={() => { setShowInterviewModal(false); setInterviewCandidate(null); }}
        defaultType="INTERVIEW"
        candidateId={interviewCandidate?._id}
        candidateName={interviewCandidate ? `${interviewCandidate.firstName} ${interviewCandidate.lastName}` : undefined}
        candidateEmail={interviewCandidate?.email}
        candidateRole={interviewCandidate?.appliedRole}
      />

      <Modal
        isOpen={showHiredModal}
        onClose={() => { setShowHiredModal(false); setHiredCandidate(null); }}
        title={hiredCandidate?.accountCreated ? "Onboarded Employee Account Details" : "Onboard Hired Candidate to Company"}
        maxWidth="max-w-2xl"
      >
        {hiredCandidate?.accountCreated ? (
          <div className="space-y-6 py-4 px-2 text-left">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-5 flex items-start gap-4">
              <div className="w-10 h-10 bg-emerald-500/20 border border-emerald-500/30 rounded-xl flex items-center justify-center text-emerald-600 flex-shrink-0 animate-pulse">
                <FileCheck className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">System Account Already Provisioned</h4>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  This candidate has already been onboarded into the general employee database. Their system credentials and department permissions are active. Duplicate account creation is disabled.
                </p>
              </div>
            </div>

            <div className="border border-border rounded-xl p-5 bg-muted/20 space-y-4 shadow-sm">
              <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Onboarding Details</h5>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-xs">
                <div>
                  <span className="text-muted-foreground block mb-0.5">Candidate Name</span>
                  <span className="font-bold text-foreground text-sm">{hiredCandidate.firstName} {hiredCandidate.lastName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Work Email Address</span>
                  <span className="font-bold text-foreground font-mono text-sm">{hiredCandidate.email}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Applied Role / Position</span>
                  <span className="font-bold text-foreground text-sm">{hiredCandidate.appliedRole}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Phone Number</span>
                  <span className="font-bold text-foreground font-mono text-sm">{hiredCandidate.phone}</span>
                </div>
                {hiredCandidate.assignedLeadId && (
                  <div className="col-span-2 border-t border-border/50 pt-3">
                    <span className="text-muted-foreground block mb-0.5">Assigned Team Lead / Manager</span>
                    <span className="font-bold text-primary flex items-center gap-1.5 text-sm">
                      <Users className="w-4 h-4" />
                      {allEmployees.find(e => e._id === hiredCandidate.assignedLeadId)?.fullName || 'Assigned Lead / Manager'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-border">
              <Button variant="outline" type="button" onClick={() => { setShowHiredModal(false); setHiredCandidate(null); }}>
                Close Details
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleOnboardingSubmit} className="space-y-4 px-2 text-left">
            <p className="text-xs text-muted-foreground">
              Onboard this hired candidate into the general employee database. This will auto-provision their system access credentials for email login, attendance checkins, dashboard analytics, separate projects, and meetings.
            </p>

            <Input
              label="Full Name *"
              value={hiredFormData.fullName}
              onChange={(e) => setHiredFormData(p => ({ ...p, fullName: e.target.value }))}
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Work Email Address *"
                type="email"
                value={hiredFormData.email}
                onChange={(e) => setHiredFormData(p => ({ ...p, email: e.target.value }))}
                required
              />
              <Input
                label="Phone Number *"
                value={hiredFormData.phone}
                onChange={(e) => setHiredFormData(p => ({ ...p, phone: e.target.value }))}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Login Password *"
                type="text"
                value={hiredFormData.password}
                onChange={(e) => setHiredFormData(p => ({ ...p, password: e.target.value }))}
                required
              />
              <Input
                label="Monthly Base Salary (INR) *"
                type="number"
                value={hiredFormData.salary}
                onChange={(e) => setHiredFormData(p => ({ ...p, salary: Number(e.target.value) }))}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Department *</label>
                <select
                  value={hiredFormData.departmentId}
                  onChange={(e) => handleHiredDeptChange(e.target.value)}
                  className="w-full h-10 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary focus:ring-offset-2 transition-colors"
                  required
                >
                  <option value="" disabled>Select Department</option>
                  {departments.map((dept: any) => (
                    <option key={dept._id} value={dept._id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Designation *</label>
                <select
                  value={hiredFormData.designationId}
                  onChange={(e) => handleHiredDesignationChange(e.target.value)}
                  className="w-full h-10 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary focus:ring-offset-2 transition-colors disabled:opacity-50"
                  disabled={!hiredFormData.departmentId}
                  required
                >
                  <option value="" disabled>Select Designation</option>
                  {filteredHiredDesignations.map((desig: any) => (
                    <option key={desig._id} value={desig._id}>
                      {desig.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Assign Team Lead Dropdown */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Assign Team Lead / Manager
              </label>
              <select
                value={selectedLeadId}
                onChange={(e) => setSelectedLeadId(e.target.value)}
                className="w-full h-10 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary focus:ring-offset-2 transition-colors"
              >
                <option value="">Select Team Lead / Manager (Optional)</option>
                {leadOptions.map((emp: any) => {
                  const empDeptName = typeof emp.departmentId === 'object' && emp.departmentId !== null
                    ? emp.departmentId.name
                    : emp.department;
                  const isSameDept = (typeof emp.departmentId === 'object' && emp.departmentId !== null ? emp.departmentId._id : emp.departmentId) === hiredFormData.departmentId;
                  
                  return (
                    <option key={emp._id} value={emp._id}>
                      {emp.fullName} - {emp.role?.replace('_', ' ') || 'Employee'} ({empDeptName}){isSameDept ? ' (Same Department)' : ''}
                    </option>
                  );
                })}
              </select>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Assigning a Team Lead will automatically set them as the primary manager to approve/scoping assignments.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Hire/Joining Date *"
                type="date"
                value={hiredFormData.joiningDate}
                onChange={(e) => setHiredFormData(p => ({ ...p, joiningDate: e.target.value }))}
                required
              />
              <Input
                label="Emergency Contact Name *"
                value={hiredFormData.emergencyName}
                onChange={(e) => setHiredFormData(p => ({ ...p, emergencyName: e.target.value }))}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Emergency Contact Relation *"
                value={hiredFormData.emergencyRel}
                onChange={(e) => setHiredFormData(p => ({ ...p, emergencyRel: e.target.value }))}
                required
              />
              <Input
                label="Emergency Contact Phone *"
                value={hiredFormData.emergencyPhone}
                onChange={(e) => setHiredFormData(p => ({ ...p, emergencyPhone: e.target.value }))}
                required
              />
            </div>

            <Input
              label="Residential Address *"
              value={hiredFormData.address}
              onChange={(e) => setHiredFormData(p => ({ ...p, address: e.target.value }))}
              required
            />

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button variant="outline" type="button" onClick={() => { setShowHiredModal(false); setHiredCandidate(null); }}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isOnboardingSubmit} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shadow-md">
                Create System Account
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
