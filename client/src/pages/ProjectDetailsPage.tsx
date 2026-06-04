
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectApi } from '../api_service/projectApi';
import { employeeApi } from '../api_service/employeeApi';
import { KanbanBoard } from '../Components/project/KanbanBoard';
import { ProjectAnalyticsDashboard } from '../Components/project/ProjectAnalyticsDashboard';
import {
  ArrowLeft, Calendar, Clock, Edit, Trash2, Plus, Settings,
  BarChart2, Users, Activity, Eye, Shield,
  Loader2, CheckCircle2, Star, Paperclip, FileText, Trophy,
  Download, UploadCloud, Info, CheckSquare, Square,
  ListTodo, Video
} from 'lucide-react';
import { Modal } from '../Components/WrapperComponents/Modal';
import { DashboardSkeleton } from '../Components/WrapperComponents/Skeleton';
import { Input, Select, Textarea } from '../Components/WrapperComponents/Input';
import { Button } from '../Components/WrapperComponents/Button';
import { usePermission } from '../hooks/usePermission';
import { useAuthStore } from '../store/useAuthStore';
import { ScheduleMeetingModal } from '../Components/SpecifiedComponents/ScheduleMeetingModal';
import { motion, AnimatePresence } from 'framer-motion';

type TabType = 'overview' | 'milestones' | 'tasks' | 'members' | 'timeline' | 'files' | 'analytics' | 'activity';

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  PLANNING: { label: 'Planning', bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20 dark:border-amber-500/30' },
  ACTIVE: { label: 'Active', bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20 dark:border-emerald-500/30' },
  ON_HOLD: { label: 'On Hold', bg: 'bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-500/20 dark:border-orange-500/30' },
  COMPLETED: { label: 'Completed', bg: 'bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500/20 dark:border-indigo-500/30' },
};

const PRIORITY_CONFIG: Record<string, { text: string; bg: string; border: string }> = {
  CRITICAL: { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  HIGH: { text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  MEDIUM: { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  LOW: { text: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border' },
};

const PROJECT_TYPE_BADGE: Record<string, string> = {
  'Software Development': 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 dark:border-blue-500/30',
  'UI/UX': 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 dark:border-purple-500/30',
  'QA': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/30',
  'DevOps': 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 dark:border-orange-500/30',
  'Marketing': 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20 dark:border-pink-500/30',
  'General': 'bg-muted text-muted-foreground border-border',
};

export const ProjectDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const { user } = useAuthStore();
  const userRole = (user as any)?.role || '';
  const isAdmin = userRole === 'ADMIN';
  const canEditProject = hasPermission('PROJECTS', 'edit');

  const [project, setProject] = useState<any>(null);
  const [sprints, setSprints] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [eligibleEmployees, setEligibleEmployees] = useState<any[]>([]);
  const [projectActivity, setProjectActivity] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedSprintId, setSelectedSprintId] = useState<string>('backlog');

  // Modals
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [isCreateSprintOpen, setIsCreateSprintOpen] = useState(false);
  const [isEditSprintOpen, setIsEditSprintOpen] = useState(false);
  const [isCreateMilestoneOpen, setIsCreateMilestoneOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScheduleMeetingOpen, setIsScheduleMeetingOpen] = useState(false);

  // Edit Project Form
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [clientName, setClientName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budget, setBudget] = useState(0);
  const [allocatedManagerId, setAllocatedManagerId] = useState('');
  const [teamLeadId, setTeamLeadId] = useState('');
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([]);
  const [projectStatus, setProjectStatus] = useState('PLANNING');
  const [projectType, setProjectType] = useState('General');
  const [projectPriority, setProjectPriority] = useState('MEDIUM');
  const [projectCategory, setProjectCategory] = useState<'GENERAL' | 'AMC'>('GENERAL');
  const [amcDuration, setAmcDuration] = useState<string>('');

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    if (projectCategory === 'AMC' && val) {
      const end = new Date(val);
      if (!isNaN(end.getTime())) {
        const amc = new Date(end);
        amc.setFullYear(end.getFullYear() + 1);
        setAmcDuration(amc.toISOString().split('T')[0]);
      }
    }
  };

  const handleCategoryChange = (cat: 'GENERAL' | 'AMC') => {
    setProjectCategory(cat);
    if (cat === 'AMC') {
      if (endDate) {
        const end = new Date(endDate);
        if (!isNaN(end.getTime())) {
          const amc = new Date(end);
          amc.setFullYear(end.getFullYear() + 1);
          setAmcDuration(amc.toISOString().split('T')[0]);
        }
      } else {
        setAmcDuration('');
      }
    }
  };

  // Sprint forms
  const [sprintName, setSprintName] = useState('');
  const [sprintGoal, setSprintGoal] = useState('');
  const [sprintStart, setSprintStart] = useState('');
  const [sprintEnd, setSprintEnd] = useState('');
  const [sprintStatus, setSprintStatus] = useState('PLANNING');
  const [editSprintName, setEditSprintName] = useState('');
  const [editSprintGoal, setEditSprintGoal] = useState('');
  const [editSprintStart, setEditSprintStart] = useState('');
  const [editSprintEnd, setEditSprintEnd] = useState('');
  const [editSprintStatus, setEditSprintStatus] = useState<'PLANNING' | 'ACTIVE' | 'COMPLETED'>('PLANNING');

  // Milestone form
  const [milestoneName, setMilestoneName] = useState('');
  const [milestoneDueDate, setMilestoneDueDate] = useState('');

  // Local uploads state for simulated files
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const fetchProjectDetails = async () => {
    if (!id) return;
    try {
      const data = await projectApi.getProjectDetails(id);
      setProject(data.project);
      setProjectName(data.project.name);
      setProjectDesc(data.project.description);
      setClientName(data.project.clientName);
      setStartDate(data.project.startDate);
      setEndDate(data.project.endDate);
      setBudget(data.project.budget || 0);
      setAllocatedManagerId(data.project.allocatedManagerId?._id || '');
      setTeamLeadId(data.project.teamLeadId?._id || '');
      setTeamMemberIds(data.project.teamMemberIds?.map((t: any) => t._id) || []);
      setProjectStatus(data.project.status);
      setProjectType(data.project.projectType || 'General');
      setProjectPriority(data.project.priority || 'MEDIUM');
      setProjectCategory(data.project.projectCategory || 'GENERAL');
      setAmcDuration(data.project.amcDuration || 0);
    } catch (e) {
      console.error('Failed to fetch project details', e);
    }
  };

  const fetchSprints = async () => {
    if (!id) return;
    try {
      const data = await projectApi.getSprints(id);
      setSprints(data.sprints || []);
    } catch (e) {
      console.error('Failed to fetch sprints', e);
    }
  };

  const fetchTasks = async () => {
    if (!id) return;
    try {
      const data = await projectApi.getTasks(id);
      setTasks(data.tasks || []);
    } catch (e) {
      console.error('Failed to fetch tasks', e);
    }
  };

  const fetchProjectActivity = async () => {
    if (!id) return;
    try {
      const data = await projectApi.getProjectActivity(id);
      setProjectActivity(data.activities || []);
    } catch (e) {
      console.error('Failed to fetch activity', e);
    }
  };

  const fetchEligibleEmployees = async () => {
    if (!id) return;
    try {
      const data = await projectApi.getEligibleEmployees(id);
      setEligibleEmployees(data.eligible || []);
    } catch (e) {
      setEligibleEmployees(employees);
    }
  };

  useEffect(() => {
    fetchProjectDetails();
    fetchSprints();
    fetchTasks();

    const loadEmployees = async () => {
      try {
        const data = await employeeApi.getAll({ limit: 1000 });
        setEmployees(data.employees || []);
      } catch (error) {
        console.error('Failed to fetch employees', error);
      }
    };
    loadEmployees();
  }, [id]);

  useEffect(() => {
    if (activeTab === 'activity') fetchProjectActivity();
    if (activeTab === 'members' && id) fetchEligibleEmployees();
    if (activeTab === 'files') fetchTasks();
  }, [activeTab]);

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setIsSubmitting(true);
    try {
      await projectApi.updateProject(id, {
        name: projectName,
        description: projectDesc,
        clientName,
        startDate,
        endDate,
        budget,
        allocatedManagerId,
        teamLeadId: teamLeadId || undefined,
        teamMemberIds,
        status: projectStatus,
        projectType,
        priority: projectPriority,
        projectCategory,
        amcDuration: projectCategory === 'AMC' ? amcDuration : undefined,
      });
      setIsEditProjectOpen(false);
      fetchProjectDetails();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!id) return;
    if (!window.confirm('Delete this project? All tasks and sprints will be permanently removed.')) return;
    try {
      await projectApi.deleteProject(id);
      navigate('/projects');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete project');
    }
  };

  const handleCreateSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setIsSubmitting(true);
    try {
      await projectApi.createSprint(id, { name: sprintName, goal: sprintGoal, startDate: sprintStart, endDate: sprintEnd, status: sprintStatus });
      setSprintName(''); setSprintGoal(''); setSprintStart(''); setSprintEnd(''); setSprintStatus('PLANNING');
      setIsCreateSprintOpen(false);
      fetchSprints();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create sprint');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || selectedSprintId === 'backlog') return;
    setIsSubmitting(true);
    try {
      await projectApi.updateSprint(id, selectedSprintId, { name: editSprintName, goal: editSprintGoal, startDate: editSprintStart, endDate: editSprintEnd, status: editSprintStatus });
      setIsEditSprintOpen(false);
      fetchSprints();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update sprint');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditSprintModal = () => {
    const activeSprint = sprints.find(s => s._id === selectedSprintId);
    if (activeSprint) {
      setEditSprintName(activeSprint.name);
      setEditSprintGoal(activeSprint.goal || '');
      setEditSprintStart(activeSprint.startDate);
      setEditSprintEnd(activeSprint.endDate);
      setEditSprintStatus(activeSprint.status);
      setIsEditSprintOpen(true);
    }
  };

  // Milestones CRUD
  const handleCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !project) return;
    setIsSubmitting(true);
    try {
      const updatedMilestones = [
        ...(project.milestones || []),
        { name: milestoneName, dueDate: milestoneDueDate, status: 'PENDING' }
      ];
      const data = await projectApi.updateProject(id, { milestones: updatedMilestones });
      setProject(data.project);
      setMilestoneName('');
      setMilestoneDueDate('');
      setIsCreateMilestoneOpen(false);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create milestone');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleMilestone = async (index: number) => {
    if (!id || !project) return;
    try {
      const updatedMilestones = project.milestones.map((m: any, idx: number) => {
        if (idx === index) {
          return { ...m, status: m.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED' };
        }
        return m;
      });
      const data = await projectApi.updateProject(id, { milestones: updatedMilestones });
      setProject(data.project);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update milestone status');
    }
  };

  const handleDeleteMilestone = async (index: number) => {
    if (!id || !project) return;
    if (!window.confirm('Delete this milestone?')) return;
    try {
      const updatedMilestones = project.milestones.filter((_: any, idx: number) => idx !== index);
      const data = await projectApi.updateProject(id, { milestones: updatedMilestones });
      setProject(data.project);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete milestone');
    }
  };

  // Simulated uploader for files tab
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsUploading(true);
      const file = e.target.files[0];
      setTimeout(() => {
        const newFile = {
          filename: file.name,
          url: '#',
          fileType: file.type || 'application/octet-stream',
          uploadedByName: user?.name || 'CurrentUser',
          uploadedAt: new Date().toISOString(),
          isSimulated: true
        };
        setUploadedFiles([newFile, ...uploadedFiles]);
        setIsUploading(false);
      }, 1000);
    }
  };

  if (!project) {
    return <DashboardSkeleton />;
  }

  const assignableMembers = [...(project.teamMemberIds || [])];
  const selectedSprintObj = sprints.find(s => s._id === selectedSprintId);
  const statConfig = STATUS_CONFIG[project.status] || STATUS_CONFIG.PLANNING;
  const priConfig = PRIORITY_CONFIG[project.priority] || PRIORITY_CONFIG.MEDIUM;
  const typeBadge = PROJECT_TYPE_BADGE[project.projectType] || PROJECT_TYPE_BADGE.General;

  const TABS: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Info className="w-4 h-4" /> },
    { id: 'milestones', label: 'Milestones', icon: <Trophy className="w-4 h-4" /> },
    { id: 'tasks', label: 'Tasks', icon: <ListTodo className="w-4 h-4" /> },
    { id: 'members', label: 'Team Members', icon: <Users className="w-4 h-4" /> },
    { id: 'timeline', label: 'Timeline', icon: <Calendar className="w-4 h-4" /> },
    { id: 'files', label: 'Files', icon: <Paperclip className="w-4 h-4" /> },
    { id: 'analytics', label: 'Progress Analytics', icon: <BarChart2 className="w-4 h-4" /> },
    { id: 'activity', label: 'Activity Logs', icon: <Activity className="w-4 h-4" /> },
  ];

  // Compile all attachments from all tasks
  const taskAttachments = tasks.reduce((acc: any[], t: any) => {
    if (t.attachments && t.attachments.length > 0) {
      t.attachments.forEach((att: any) => {
        acc.push({
          ...att,
          taskTitle: t.title,
          taskId: t._id
        });
      });
    }
    return acc;
  }, []);

  const allFiles = [...uploadedFiles, ...taskAttachments];

  // Compile timeline data
  const timelineEvents = [
    ...sprints.map((s: any) => ({
      type: 'sprint',
      name: s.name,
      date: new Date(s.startDate),
      endDate: new Date(s.endDate),
      status: s.status,
      goal: s.goal,
      original: s
    })),
    ...(project.milestones || []).map((m: any) => ({
      type: 'milestone',
      name: m.name,
      date: new Date(m.dueDate),
      status: m.status,
      original: m
    }))
  ].sort((a: any, b: any) => a.date.getTime() - b.date.getTime());

  // Task statistics for overview
  const totalTasksCount = tasks.length;
  const completedTasksCount = tasks.filter(t => t.status === 'COMPLETED').length;
  const completionPercentage = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  const ACTION_LABELS: Record<string, string> = {
    CREATED: 'created task',
    ASSIGNED: 'assigned task',
    STATUS_CHANGED: 'moved task',
    SUBMITTED_FOR_REVIEW: 'submitted for review',
    REVIEW_APPROVED: 'approved task',
    REWORK_REQUESTED: 'requested rework on',
    COMMENTED: 'commented on task',
    UPDATED: 'updated task',
    DEADLINE_UPDATED: 'updated deadline for',
    PRIORITY_CHANGED: 'changed priority of',
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-left font-sans">
      {/* Top Header */}
      <div className="bg-card border-b border-border px-6 py-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/projects')}
              className="p-2.5 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded-xl transition-all border border-border"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className={`text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${statConfig.bg} ${statConfig.text} ${statConfig.border}`}>
                  {statConfig.label}
                </span>
                <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${typeBadge}`}>
                  {project.projectType || 'General'}
                </span>
                <span className={`text-[11px] font-extrabold flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border ${priConfig.bg} ${priConfig.text} ${priConfig.border}`}>
                  ● {project.priority}
                </span>
                {isAdmin && (
                  <span className="flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
                    <Eye className="w-3 h-3" /> View Only
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">{project.name}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1 font-medium">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(project.startDate).toLocaleDateString()} — {new Date(project.endDate).toLocaleDateString()}
                </span>
                <span>Client: <strong className="text-foreground">{project.clientName}</strong></span>
                <span>Budget: <strong className="text-primary">${project.budget?.toLocaleString()}</strong></span>
              </div>
            </div>
          </div>

          {/* Action buttons — hidden for Admin */}
          {!isAdmin && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsScheduleMeetingOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-500/10 dark:bg-indigo-500/20 hover:bg-indigo-500/20 dark:hover:bg-indigo-500/30 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-500/20 dark:border-indigo-500/30 transition-colors text-sm font-semibold"
              >
                <Video className="w-4 h-4" /> Schedule Meeting
              </button>
              {canEditProject && (
                <button
                  onClick={() => setIsEditProjectOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-xl border border-border transition-colors text-sm font-semibold"
                >
                  <Edit className="w-4 h-4" /> Edit Project
                </button>
              )}
              {hasPermission('PROJECTS', 'delete') && (
                <button
                  onClick={handleDeleteProject}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 dark:bg-red-500/20 hover:bg-red-500/20 dark:hover:bg-red-500/30 text-red-600 dark:text-red-400 rounded-xl border border-red-500/20 dark:border-red-500/30 transition-colors text-sm font-semibold"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-card border-b border-border px-6">
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {TABS.map(tab => {
            const isTabActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-4 text-sm font-semibold transition-all whitespace-nowrap ${
                  isTabActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.icon}
                {tab.label}
                {isTabActive && (
                  <motion.div
                    layoutId="activeTabUnderline"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 p-6 overflow-auto bg-muted/20">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {/* ── OVERVIEW TAB ── */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column (Wide) */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Description Card */}
                  <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                    <h2 className="text-lg font-bold text-foreground mb-4">Project Description</h2>
                    <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
                      {project.description || 'No description provided.'}
                    </p>
                  </div>

                  {/* Metadata Grid */}
                  <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                    <h2 className="text-lg font-bold text-foreground mb-4">Project Details</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-muted/50 border border-border rounded-xl p-4 flex flex-col">
                        <span className="text-xs font-semibold text-muted-foreground/80">CLIENT NAME</span>
                        <span className="text-sm font-bold text-foreground mt-1">{project.clientName}</span>
                      </div>
                      <div className="bg-muted/50 border border-border rounded-xl p-4 flex flex-col">
                        <span className="text-xs font-semibold text-muted-foreground/80">PROJECT TYPE</span>
                        <span className="text-sm font-bold text-foreground mt-1">{project.projectType || 'General'}</span>
                      </div>
                      <div className="bg-muted/50 border border-border rounded-xl p-4 flex flex-col">
                        <span className="text-xs font-semibold text-muted-foreground/80">BUDGET ALLOCATION</span>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-sm font-bold text-primary">${project.budget?.toLocaleString()}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            project.budgetStatus === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                            project.budgetStatus === 'REJECTED' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' :
                            'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                          }`}>
                            {project.budgetStatus || 'PENDING'}
                          </span>
                        </div>
                      </div>
                      <div className="bg-muted/50 border border-border rounded-xl p-4 flex flex-col">
                        <span className="text-xs font-semibold text-muted-foreground/80">TIMELINE RANGE</span>
                        <span className="text-sm font-bold text-foreground mt-1">
                          {new Date(project.startDate).toLocaleDateString()} — {new Date(project.endDate).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="bg-muted/50 border border-border rounded-xl p-4 flex flex-col">
                        <span className="text-xs font-semibold text-muted-foreground/80">PROJECT CATEGORY</span>
                        <span className="text-sm font-bold text-foreground mt-1">
                          {project.projectCategory === 'AMC' ? 'AMC Project' : 'General Project'}
                        </span>
                      </div>
                      {project.projectCategory === 'AMC' && (
                        <div className="bg-muted/50 border border-border rounded-xl p-4 flex flex-col">
                          <span className="text-xs font-semibold text-muted-foreground/80">AMC DURATION</span>
                          <span className="text-sm font-bold text-primary mt-1">
                            {project.amcDuration ? new Date(project.amcDuration).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column (Narrow) */}
                <div className="space-y-6">
                  {/* Progress Ring Card */}
                  <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col items-center text-center">
                    <h2 className="text-md font-bold text-muted-foreground mb-6">Task Completion</h2>
                    <div className="relative flex items-center justify-center w-36 h-36 mb-4">
                      {/* SVG Progress Circle */}
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" stroke="currentColor" className="text-muted/30 dark:text-muted/20" strokeWidth="8" fill="transparent" />
                        <motion.circle
                          cx="50"
                          cy="50"
                          r="40"
                          stroke="var(--color-primary, #6366f1)"
                          strokeWidth="8"
                          fill="transparent"
                          strokeDasharray={251.2}
                          initial={{ strokeDashoffset: 251.2 }}
                          animate={{ strokeDashoffset: 251.2 - (251.2 * completionPercentage) / 100 }}
                          transition={{ duration: 1.2, ease: 'easeOut' }}
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <span className="text-3xl font-extrabold text-foreground">{completionPercentage}%</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">{completedTasksCount}/{totalTasksCount} Tasks</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Total sprints currently tracked: <strong>{sprints.length}</strong></p>
                  </div>

                  {/* Team Members Summary Card */}
                  <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                    <h2 className="text-md font-bold text-muted-foreground mb-4">Leadership & Contacts</h2>
                    <div className="space-y-4">
                      {project.allocatedManagerId && (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs">
                            {project.allocatedManagerId.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground/85">PROJECT MANAGER</p>
                            <p className="text-sm font-bold text-foreground">{project.allocatedManagerId.name}</p>
                          </div>
                        </div>
                      )}
                      {project.teamLeadId && (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold text-xs">
                            {project.teamLeadId.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground/85">TEAM LEAD</p>
                            <p className="text-sm font-bold text-foreground">{project.teamLeadId.name}</p>
                          </div>
                        </div>
                      )}
                      <div className="border-t border-border pt-4">
                        <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                          <span>Total Assigned Members:</span>
                          <span className="text-foreground font-bold">{project.teamMemberIds?.length || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── MILESTONES TAB ── */}
            {activeTab === 'milestones' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sprints Section */}
                <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                      <Clock className="w-5 h-5 text-muted-foreground" /> Sprints
                    </h2>
                    {hasPermission('PROJECTS', 'edit') && (
                      <button
                        onClick={() => setIsCreateSprintOpen(true)}
                        className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-xl border border-primary/30 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" /> New Sprint
                      </button>
                    )}
                  </div>
                  {sprints.length === 0 ? (
                    <div className="text-center text-muted-foreground py-12 text-sm">No sprints created for this project.</div>
                  ) : (
                    <div className="space-y-3">
                      {sprints.map((s: any) => (
                        <div key={s._id} className="bg-muted/50 hover:bg-muted border border-border rounded-xl p-4 transition-all flex justify-between items-center">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-foreground">{s.name}</span>
                              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                s.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                                s.status === 'COMPLETED' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20' :
                                'bg-muted text-muted-foreground border border-border'
                              }`}>
                                {s.status}
                              </span>
                            </div>
                            {s.goal && <p className="text-xs text-muted-foreground mt-1 italic">"{s.goal}"</p>}
                            <p className="text-[10px] text-muted-foreground/80 mt-2">
                              {new Date(s.startDate).toLocaleDateString()} — {new Date(s.endDate).toLocaleDateString()}
                            </p>
                          </div>
                          {hasPermission('PROJECTS', 'edit') && (
                            <button
                              onClick={() => {
                                setSelectedSprintId(s._id);
                                openEditSprintModal();
                              }}
                              className="p-1.5 bg-muted hover:bg-muted/80 rounded-lg text-muted-foreground hover:text-foreground transition-colors border border-border"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Project Milestones Section */}
                <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-muted-foreground" /> Milestones Checklist
                    </h2>
                    {hasPermission('PROJECTS', 'edit') && (
                      <button
                        onClick={() => setIsCreateMilestoneOpen(true)}
                        className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-xl border border-primary/30 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" /> New Milestone
                      </button>
                    )}
                  </div>
                  {(!project.milestones || project.milestones.length === 0) ? (
                    <div className="text-center text-muted-foreground py-12 text-sm">No milestones configured for this project.</div>
                  ) : (
                    <div className="space-y-3">
                      {project.milestones.map((m: any, idx: number) => (
                        <div key={idx} className="bg-muted/50 hover:bg-muted border border-border rounded-xl p-4 transition-all flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => !isAdmin && handleToggleMilestone(idx)}
                              disabled={isAdmin}
                              className={`p-1 rounded-lg transition-colors ${isAdmin ? 'cursor-not-allowed' : 'hover:bg-muted'}`}
                            >
                              {m.status === 'COMPLETED' ? (
                                <CheckSquare className="w-5 h-5 text-primary" />
                              ) : (
                                <Square className="w-5 h-5 text-muted-foreground" />
                              )}
                            </button>
                            <div>
                              <span className={`text-sm font-semibold ${m.status === 'COMPLETED' ? 'text-muted-foreground/75 line-through' : 'text-foreground'}`}>
                                {m.name}
                              </span>
                              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> Due Date: {new Date(m.dueDate).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          {hasPermission('PROJECTS', 'edit') && (
                            <button
                              onClick={() => handleDeleteMilestone(idx)}
                              className="p-1.5 bg-red-500/10 dark:bg-red-500/20 hover:bg-red-500/20 border border-red-500/20 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                              title="Delete Milestone"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── TASKS TAB ── */}
            {activeTab === 'tasks' && (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 bg-card border border-border p-4 rounded-2xl">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-semibold text-muted-foreground">Sprint Selection:</span>
                    <select
                      value={selectedSprintId}
                      onChange={e => setSelectedSprintId(e.target.value)}
                      className="bg-background dark:bg-card border border-border rounded-xl px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring cursor-pointer font-medium"
                    >
                      <option value="backlog">Backlog / All Tasks</option>
                      {sprints.map(sprint => (
                        <option key={sprint._id} value={sprint._id}>
                          {sprint.name} ({sprint.status})
                        </option>
                      ))}
                    </select>

                    {selectedSprintId !== 'backlog' && hasPermission('PROJECTS', 'edit') && (
                      <button
                        onClick={openEditSprintModal}
                        className="p-2 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border rounded-xl transition-colors"
                        title="Edit Sprint"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    )}

                    {hasPermission('PROJECTS', 'edit') && (
                      <button
                        onClick={() => setIsCreateSprintOpen(true)}
                        className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-2 rounded-xl border border-primary/30 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" /> New Sprint
                      </button>
                    )}
                  </div>

                  {selectedSprintObj && (
                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-3 font-medium">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground/80" />
                        {new Date(selectedSprintObj.startDate).toLocaleDateString()} — {new Date(selectedSprintObj.endDate).toLocaleDateString()}
                      </span>
                      {selectedSprintObj.goal && (
                        <span className="italic text-muted-foreground/80">"{selectedSprintObj.goal}"</span>
                      )}
                    </div>
                  )}
                </div>

                <KanbanBoard
                  projectId={project._id}
                  selectedSprintId={selectedSprintId}
                  sprints={sprints}
                  teamMembers={assignableMembers}
                />
              </>
            )}

            {/* ── MEMBERS TAB ── */}
            {activeTab === 'members' && (
              <div className="space-y-6">
                {!isAdmin && project.projectType && project.projectType !== 'General' && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/20 dark:border-blue-500/30 rounded-xl text-blue-700 dark:text-blue-300 text-xs font-semibold">
                    <Shield className="w-4 h-4 flex-shrink-0" />
                    This is a <strong>{project.projectType}</strong> project. Only eligible department employees are shown below.
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Allocated Manager & Lead */}
                  <div className="space-y-6">
                    {project.allocatedManagerId && (
                      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                          <Users className="w-3.5 h-3.5" /> Project Manager
                        </p>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-sm">
                            {project.allocatedManagerId.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{project.allocatedManagerId.name}</p>
                            <p className="text-xs text-muted-foreground">{project.allocatedManagerId.email}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {project.teamLeadId && (
                      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                          <Star className="w-3.5 h-3.5 text-amber-500 animate-pulse" /> Team Lead
                        </p>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold text-sm">
                            {project.teamLeadId.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{project.teamLeadId.name}</p>
                            <p className="text-xs text-muted-foreground">{project.teamLeadId.email}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Team Members List */}
                  <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col h-[340px]">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Users className="w-3.5 h-3.5" /> Team Members ({project.teamMemberIds?.length || 0})
                    </p>
                    {project.teamMemberIds?.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-12 flex-1 flex items-center justify-center">No team members assigned yet.</p>
                    ) : (
                      <div className="space-y-2.5 overflow-y-auto flex-1 pr-1">
                        {project.teamMemberIds?.map((emp: any) => (
                          <div key={emp._id} className="flex items-center gap-3 bg-muted/50 rounded-xl px-4 py-3 border border-border">
                            <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                              {emp.fullName?.charAt(0)?.toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{emp.fullName}</p>
                              <p className="text-xs text-muted-foreground truncate">{emp.department} · {emp.designation}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Eligible Employees */}
                {canEditProject && eligibleEmployees.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Eligible Candidates
                    </p>
                    <p className="text-xs text-muted-foreground mb-4 font-medium">These employees fit this project type ({project.projectType || 'General'}) and can be assigned by editing the project.</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {eligibleEmployees.map((emp: any) => (
                        <div key={emp._id} className="flex items-center gap-2.5 bg-emerald-500/5 border border-emerald-500/10 rounded-xl px-3 py-2.5">
                          <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-500 dark:text-emerald-400 font-bold text-xs flex-shrink-0">
                            {emp.fullName?.charAt(0)?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">{emp.fullName}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{emp.department}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── TIMELINE TAB ── */}
            {activeTab === 'timeline' && (
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                <h2 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-muted-foreground" /> Project Timeline
                </h2>
                {timelineEvents.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12 text-sm">No sprints or milestones scheduled for this project.</div>
                ) : (
                  <div className="relative pl-8 space-y-6">
                    <div className="absolute left-3.5 top-0 bottom-0 w-px bg-border" />
                    {timelineEvents.map((event: any, index: number) => {
                      const isSprint = event.type === 'sprint';
                      return (
                        <div key={index} className="relative">
                          {/* Timeline node icon */}
                          <div className={`absolute -left-7 top-1 w-5 h-5 rounded-full border bg-card flex items-center justify-center ${
                            isSprint ? 'border-primary' : 'border-amber-500'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              isSprint ? 'bg-primary' : 'bg-amber-500'
                            }`} />
                          </div>

                          <div className="bg-muted/50 border border-border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  isSprint ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                }`}>
                                  {isSprint ? 'Sprint' : 'Milestone'}
                                </span>
                                <h3 className="text-sm font-bold text-foreground">{event.name}</h3>
                              </div>
                              {event.goal && <p className="text-xs text-muted-foreground mt-1 italic">Goal: "{event.goal}"</p>}
                              <p className="text-[10px] text-muted-foreground/80 mt-2 flex items-center gap-1 font-medium">
                                <Clock className="w-3 h-3" />
                                {isSprint ? (
                                  `${event.date.toLocaleDateString()} — ${event.endDate.toLocaleDateString()}`
                                ) : (
                                  `Due by ${event.date.toLocaleDateString()}`
                                )}
                              </p>
                            </div>
                            <div>
                              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                                event.status === 'COMPLETED' || event.status === 'active' || event.status === 'ACTIVE'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                  : 'bg-muted text-muted-foreground border-border'
                              }`}>
                                {event.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── FILES TAB ── */}
            {activeTab === 'files' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* File Upload Zone */}
                <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
                  <h2 className="text-lg font-bold text-foreground">Upload Project File</h2>
                  <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors flex flex-col items-center justify-center cursor-pointer relative bg-muted/30">
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      disabled={isUploading}
                    />
                    {isUploading ? (
                      <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
                    ) : (
                      <UploadCloud className="w-10 h-10 text-muted-foreground mb-3" />
                    )}
                    <span className="text-sm font-bold text-foreground">Drag & Drop or Click</span>
                    <span className="text-xs text-muted-foreground mt-1">Upload reports, specs, or logs (max 10MB)</span>
                  </div>
                  <div className="flex gap-2 p-3 bg-muted/50 border border-border rounded-xl text-muted-foreground text-xs">
                    <Info className="w-4 h-4 shrink-0 text-muted-foreground/80" />
                    Files uploaded here are stored in simulated local environment. Files uploaded as task attachments are also fetched dynamically.
                  </div>
                </div>

                {/* Files List (2/3 width) */}
                <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col h-[400px]">
                  <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-muted-foreground" /> Files & Attachments ({allFiles.length})
                  </h2>
                  {allFiles.length === 0 ? (
                    <div className="text-center text-muted-foreground py-12 flex-1 flex flex-col items-center justify-center gap-2">
                      <Paperclip className="w-8 h-8 opacity-20" />
                      <p className="text-sm">No files uploaded for this project yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 overflow-y-auto flex-1 pr-1">
                      {allFiles.map((file: any, index: number) => (
                        <div key={index} className="bg-muted/50 hover:bg-muted border border-border rounded-xl p-3.5 transition-all flex justify-between items-center gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2.5 bg-primary/10 rounded-xl text-primary shrink-0 border border-primary/20">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-foreground truncate" title={file.filename}>{file.filename}</p>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                                <span>By: <strong className="text-foreground">{file.uploadedByName}</strong></span>
                                <span>•</span>
                                <span>{new Date(file.uploadedAt).toLocaleDateString()}</span>
                                {file.taskTitle && (
                                  <>
                                    <span>•</span>
                                    <span className="text-primary truncate max-w-[150px]">Task: {file.taskTitle}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <a
                            href={file.url}
                            download
                            className="p-2.5 bg-muted hover:bg-muted/80 border border-border hover:text-foreground text-muted-foreground rounded-xl transition-all"
                            title="Download File"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── PROGRESS ANALYTICS TAB ── */}
            {activeTab === 'analytics' && <ProjectAnalyticsDashboard projectId={project._id} />}

            {/* ── ACTIVITY LOGS TAB ── */}
            {activeTab === 'activity' && (
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                <h2 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-muted-foreground" /> Project Activity Feed
                </h2>
                {projectActivity.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12 text-sm">No activity recorded for this project yet.</div>
                ) : (
                  <div className="relative pl-8 space-y-4">
                    <div className="absolute left-3.5 top-0 bottom-0 w-px bg-border" />
                    {projectActivity.map((a: any) => (
                      <div key={a._id} className="relative">
                        <div className="absolute -left-[25px] top-1.5 w-4 h-4 rounded-full bg-card border border-border flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        </div>
                        <div className="bg-muted/50 hover:bg-muted border border-border rounded-xl p-4 transition-all">
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-xs font-bold text-foreground">{a.actorName}</p>
                            <p className="text-[10px] text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</p>
                          </div>
                          <p className="text-xs text-muted-foreground font-medium">
                            {ACTION_LABELS[a.action] || a.action.toLowerCase().replace(/_/g, ' ')}
                            {a.from && a.to && <span className="text-muted-foreground/80 font-bold"> ({a.from} → {a.to})</span>}
                          </p>
                          {a.comment && <p className="text-xs text-muted-foreground/80 mt-2 italic pl-2.5 border-l border-border">"{a.comment}"</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Modals ── */}

      {/* Edit Project Modal */}
      <Modal isOpen={isEditProjectOpen} onClose={() => setIsEditProjectOpen(false)} title="Edit Project Details" maxWidth="max-w-2xl">
        <form onSubmit={handleUpdateProject} className="space-y-4 text-left">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input label="Project Name *" value={projectName} onChange={e => setProjectName(e.target.value)} required />
            </div>
            <div className="col-span-2">
              <Textarea label="Description *" value={projectDesc} onChange={e => setProjectDesc(e.target.value)} required />
            </div>
            <Input label="Client Name *" value={clientName} onChange={e => setClientName(e.target.value)} required />
            <Select
              label="Project Type *"
              value={projectType}
              onChange={e => setProjectType(e.target.value)}
              options={[
                { value: 'Software Development', label: 'Software Development' },
                { value: 'UI/UX', label: 'UI/UX' },
                { value: 'QA', label: 'QA' },
                { value: 'DevOps', label: 'DevOps' },
                { value: 'Marketing', label: 'Marketing' },
                { value: 'General', label: 'General' },
              ]}
            />
            <Select
              label="Status *"
              value={projectStatus}
              onChange={e => setProjectStatus(e.target.value)}
              options={[
                { value: 'PLANNING', label: 'Planning' },
                { value: 'ACTIVE', label: 'Active' },
                { value: 'ON_HOLD', label: 'On Hold' },
                { value: 'COMPLETED', label: 'Completed' },
              ]}
            />
            <Select
              label="Priority *"
              value={projectPriority}
              onChange={e => setProjectPriority(e.target.value)}
              options={[
                { value: 'LOW', label: 'Low' },
                { value: 'MEDIUM', label: 'Medium' },
                { value: 'HIGH', label: 'High' },
                { value: 'CRITICAL', label: 'Critical' },
              ]}
            />
            <Select 
              label="Project Category *"
              value={projectCategory}
              onChange={(e) => handleCategoryChange(e.target.value as any)}
              options={[
                { value: 'GENERAL', label: 'General Project' },
                { value: 'AMC', label: 'AMC Project' }
              ]}
              required
            />
            {projectCategory === 'AMC' ? (
              <Input 
                label="AMC Duration *"
                type="date"
                value={amcDuration}
                onChange={(e) => setAmcDuration(e.target.value)}
                required
              />
            ) : (
              <div />
            )}
            <Input label="Start Date *" type="date" value={startDate} onChange={e => handleStartDateChange(e.target.value)} required />
            <Input label="End Date *" type="date" value={endDate} onChange={e => handleEndDateChange(e.target.value)} required />
            <Input label="Budget *" type="number" value={budget} onChange={e => setBudget(Number(e.target.value))} required />
            <Select label="Allocated Manager *" value={allocatedManagerId} onChange={e => setAllocatedManagerId(e.target.value)} required>
              <option value="">Select Manager</option>
              {employees.map(emp => (
                <option key={emp._id} value={emp.userId || ''} disabled={!emp.userId}>
                  {emp.fullName} {!emp.userId ? '(No User Account)' : ''}
                </option>
              ))}
            </Select>
          </div>

          {/* Team Members */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Team Members
              {projectType !== 'General' && <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">(Only {projectType} dept employees shown)</span>}
            </label>
            <div className="border border-border rounded-lg bg-background p-3 max-h-40 overflow-y-auto space-y-2">
              {(projectType !== 'General' && eligibleEmployees.length > 0 ? eligibleEmployees : employees).map(emp => (
                <label key={emp._id} className="flex items-center space-x-2 text-sm text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={teamMemberIds.includes(emp._id)}
                    onChange={e => {
                      if (e.target.checked) setTeamMemberIds([...teamMemberIds, emp._id]);
                      else setTeamMemberIds(teamMemberIds.filter(mid => mid !== emp._id));
                    }}
                    className="rounded border-border text-primary bg-background focus:ring-ring"
                  />
                  <span>{emp.fullName} <span className="text-muted-foreground text-xs">({emp.department})</span></span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setIsEditProjectOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting}>Save Changes</Button>
          </div>
        </form>
      </Modal>

      {/* Create Sprint Modal */}
      <Modal isOpen={isCreateSprintOpen} onClose={() => setIsCreateSprintOpen(false)} title="Create New Sprint">
        <form onSubmit={handleCreateSprint} className="space-y-4 text-left">
          <Input label="Sprint Name *" value={sprintName} onChange={e => setSprintName(e.target.value)} placeholder="Sprint 1 - Core Features" required />
          <Textarea label="Sprint Goal" value={sprintGoal} onChange={e => setSprintGoal(e.target.value)} placeholder="Deliver authentication module..." />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Date *" type="date" value={sprintStart} onChange={e => setSprintStart(e.target.value)} required />
            <Input label="End Date *" type="date" value={sprintEnd} onChange={e => setSprintEnd(e.target.value)} required />
          </div>
          <Select label="Status *" value={sprintStatus} onChange={e => setSprintStatus(e.target.value)} options={[{ value: 'PLANNING', label: 'Planning' }, { value: 'ACTIVE', label: 'Active' }, { value: 'COMPLETED', label: 'Completed' }]} />
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setIsCreateSprintOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting}>Create Sprint</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Sprint Modal */}
      <Modal isOpen={isEditSprintOpen} onClose={() => setIsEditSprintOpen(false)} title="Edit Sprint Settings">
        <form onSubmit={handleUpdateSprint} className="space-y-4 text-left">
          <Input label="Sprint Name *" value={editSprintName} onChange={e => setEditSprintName(e.target.value)} required />
          <Textarea label="Sprint Goal" value={editSprintGoal} onChange={e => setEditSprintGoal(e.target.value)} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Date *" type="date" value={editSprintStart} onChange={e => setEditSprintStart(e.target.value)} required />
            <Input label="End Date *" type="date" value={editSprintEnd} onChange={e => setEditSprintEnd(e.target.value)} required />
          </div>
          <Select label="Status *" value={editSprintStatus} onChange={e => setEditSprintStatus(e.target.value as any)} options={[{ value: 'PLANNING', label: 'Planning' }, { value: 'ACTIVE', label: 'Active' }, { value: 'COMPLETED', label: 'Completed' }]} />
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setIsEditSprintOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting}>Save Sprint Changes</Button>
          </div>
        </form>
      </Modal>

      {/* Create Milestone Modal */}
      <Modal isOpen={isCreateMilestoneOpen} onClose={() => setIsCreateMilestoneOpen(false)} title="Create New Milestone">
        <form onSubmit={handleCreateMilestone} className="space-y-4 text-left">
          <Input label="Milestone Name *" value={milestoneName} onChange={e => setMilestoneName(e.target.value)} placeholder="Beta Release / Database Migration" required />
          <Input label="Due Date *" type="date" value={milestoneDueDate} onChange={e => setMilestoneDueDate(e.target.value)} required />
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setIsCreateMilestoneOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting}>Create Milestone</Button>
          </div>
        </form>
      </Modal>

      {/* Schedule Meeting Modal */}
      <ScheduleMeetingModal
        isOpen={isScheduleMeetingOpen}
        onClose={() => setIsScheduleMeetingOpen(false)}
        defaultType="CLIENT"
        projectId={id}
        projectName={project?.name}
      />
    </div>
  );
};
