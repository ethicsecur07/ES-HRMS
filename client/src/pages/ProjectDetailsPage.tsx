import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectApi } from '../api_service/projectApi';
import { employeeApi } from '../api_service/employeeApi';
import { KanbanBoard } from '../Components/project/KanbanBoard';
import { ProjectAnalyticsDashboard } from '../Components/project/ProjectAnalyticsDashboard';
import {
  ArrowLeft, Calendar, Clock, Edit, Trash2, Plus, Settings,
  LayoutDashboard, BarChart2, Users, Activity, Eye, Shield,
  Loader2, CheckCircle2, Star
} from 'lucide-react';
import { Modal } from '../Components/WrapperComponents/Modal';
import { Input, Select, Textarea } from '../Components/WrapperComponents/Input';
import { Button } from '../Components/WrapperComponents/Button';
import { usePermission } from '../hooks/usePermission';
import { useAuthStore } from '../store/useAuthStore';

type TabType = 'board' | 'analytics' | 'members' | 'activity';

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  PLANNING: { label: 'Planning', bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-400' },
  ACTIVE: { label: 'Active', bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400' },
  ON_HOLD: { label: 'On Hold', bg: 'bg-orange-500/10 border-orange-500/30', text: 'text-orange-400' },
  COMPLETED: { label: 'Completed', bg: 'bg-indigo-500/10 border-indigo-500/30', text: 'text-indigo-400' },
};

const PRIORITY_CONFIG: Record<string, { text: string }> = {
  CRITICAL: { text: 'text-red-400' },
  HIGH: { text: 'text-orange-400' },
  MEDIUM: { text: 'text-amber-400' },
  LOW: { text: 'text-slate-400' },
};

const PROJECT_TYPE_BADGE: Record<string, string> = {
  'Software Development': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  'UI/UX': 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  'QA': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  'DevOps': 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  'Marketing': 'bg-pink-500/10 text-pink-400 border-pink-500/30',
  'General': 'bg-slate-500/10 text-slate-400 border-slate-500/30',
};

export const ProjectDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const { user } = useAuthStore();
  const userRole = (user as any)?.role || '';
  const isAdmin = userRole === 'ADMIN';
  const canEditProject = ['HR', 'MANAGER'].includes(userRole);

  const [project, setProject] = useState<any>(null);
  const [sprints, setSprints] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [eligibleEmployees, setEligibleEmployees] = useState<any[]>([]);
  const [projectActivity, setProjectActivity] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('board');
  const [selectedSprintId, setSelectedSprintId] = useState<string>('backlog');

  // Modals
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [isCreateSprintOpen, setIsCreateSprintOpen] = useState(false);
  const [isEditSprintOpen, setIsEditSprintOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      // Fallback to all employees
      setEligibleEmployees(employees);
    }
  };

  useEffect(() => {
    fetchProjectDetails();
    fetchSprints();

    const loadEmployees = async () => {
      try {
        const data = await employeeApi.getAll();
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

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const assignableMembers = [...(project.teamMemberIds || [])];
  const selectedSprintObj = sprints.find(s => s._id === selectedSprintId);
  const statConfig = STATUS_CONFIG[project.status] || STATUS_CONFIG.PLANNING;
  const priConfig = PRIORITY_CONFIG[project.priority] || PRIORITY_CONFIG.MEDIUM;
  const typeBadge = PROJECT_TYPE_BADGE[project.projectType] || PROJECT_TYPE_BADGE.General;

  const TABS: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'board', label: 'Board', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart2 className="w-4 h-4" /> },
    { id: 'members', label: 'Members', icon: <Users className="w-4 h-4" /> },
    { id: 'activity', label: 'Activity', icon: <Activity className="w-4 h-4" /> },
  ];

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
    <div className="flex flex-col min-h-screen bg-background text-left">
      {/* Top Header */}
      <div className="bg-card border-b border-white/10 px-6 py-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/projects')}
              className="p-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition-colors border border-white/10"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${statConfig.bg} ${statConfig.text}`}>
                  {statConfig.label}
                </span>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${typeBadge}`}>
                  {project.projectType || 'General'}
                </span>
                <span className={`text-xs font-bold ${priConfig.text}`}>
                  ● {project.priority}
                </span>
                {isAdmin && (
                  <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full border bg-amber-500/10 border-amber-500/30 text-amber-400">
                    <Eye className="w-3 h-3" /> View Only
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-white">{project.name}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-1 font-medium">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(project.startDate).toLocaleDateString()} — {new Date(project.endDate).toLocaleDateString()}
                </span>
                <span>Client: <strong className="text-slate-200">{project.clientName}</strong></span>
                <span>Budget: <strong className="text-primary">${project.budget?.toLocaleString()}</strong></span>
              </div>
            </div>
          </div>

          {/* Action buttons — hidden for Admin */}
          {!isAdmin && (
            <div className="flex items-center gap-2">
              {canEditProject && (
                <button
                  onClick={() => setIsEditProjectOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl border border-white/10 transition-colors text-sm font-semibold"
                >
                  <Edit className="w-4 h-4" /> Edit
                </button>
              )}
              {canEditProject && (
                <button
                  onClick={handleDeleteProject}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl border border-red-500/20 transition-colors text-sm font-semibold"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-card border-b border-white/10 px-6">
        <div className="flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-400 hover:text-white hover:border-white/20'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 p-6 overflow-auto">

        {/* ── BOARD TAB ── */}
        {activeTab === 'board' && (
          <>
            {/* Sprint toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 bg-transparent border border-white/10 p-4 rounded-2xl">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-semibold text-slate-400">Sprint:</span>
                <select
                  value={selectedSprintId}
                  onChange={e => setSelectedSprintId(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white outline-none focus:border-primary/50 cursor-pointer font-medium"
                >
                  <option value="backlog">Backlog / All Tasks</option>
                  {sprints.map(sprint => (
                    <option key={sprint._id} value={sprint._id}>
                      {sprint.name} ({sprint.status})
                    </option>
                  ))}
                </select>

                {selectedSprintId !== 'backlog' && hasPermission('PROJECTS', 'edit') && !isAdmin && (
                  <button
                    onClick={openEditSprintModal}
                    className="p-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 rounded-xl transition-colors"
                    title="Edit Sprint"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                )}

                {hasPermission('PROJECTS', 'edit') && !isAdmin && ['HR', 'MANAGER', 'TEAM_LEAD'].includes(userRole) && (
                  <button
                    onClick={() => setIsCreateSprintOpen(true)}
                    className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-2 rounded-xl border border-primary/30 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> New Sprint
                  </button>
                )}
              </div>

              {selectedSprintObj && (
                <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3 font-medium">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    {new Date(selectedSprintObj.startDate).toLocaleDateString()} — {new Date(selectedSprintObj.endDate).toLocaleDateString()}
                  </span>
                  {selectedSprintObj.goal && (
                    <span className="italic text-muted-foreground">"{selectedSprintObj.goal}"</span>
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

        {/* ── ANALYTICS TAB ── */}
        {activeTab === 'analytics' && <ProjectAnalyticsDashboard projectId={project._id} />}

        {/* ── MEMBERS TAB ── */}
        {activeTab === 'members' && (
          <div className="space-y-6">
            {/* Info banner for non-admins */}
            {!isAdmin && project.projectType && project.projectType !== 'General' && (
              <div className="flex items-center gap-2 px-4 py-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-300 text-xs font-semibold">
                <Shield className="w-4 h-4 flex-shrink-0" />
                This is a <strong>{project.projectType}</strong> project. Only eligible department employees are shown below.
              </div>
            )}

            {/* Team Lead */}
            {project.teamLeadId && (
              <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Star className="w-3.5 h-3.5 text-amber-400" /> Team Lead
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-sm">
                    {(project.teamLeadId?.name || 'T').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{project.teamLeadId?.name || 'Assigned'}</p>
                    <p className="text-xs text-slate-500">{project.teamLeadId?.email}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Team Members */}
            <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Users className="w-3.5 h-3.5" /> Team Members ({project.teamMemberIds?.length || 0})
              </p>
              {project.teamMemberIds?.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No team members assigned yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {project.teamMemberIds?.map((emp: any) => (
                    <div key={emp._id} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                      <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                        {emp.fullName?.charAt(0)?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{emp.fullName}</p>
                        <p className="text-xs text-slate-500 truncate">{emp.department} · {emp.designation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Eligible Employees (for assignment) — only for HR/Manager */}
            {canEditProject && eligibleEmployees.length > 0 && (
              <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Eligible Employees
                </p>
                <p className="text-xs text-slate-500 mb-4">These employees can be assigned to this project based on department mapping.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {eligibleEmployees.slice(0, 12).map((emp: any) => (
                    <div key={emp._id} className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/15 rounded-xl px-3 py-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs flex-shrink-0">
                        {emp.fullName?.charAt(0)?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{emp.fullName}</p>
                        <p className="text-[10px] text-slate-500 truncate">{emp.department}</p>
                      </div>
                    </div>
                  ))}
                  {eligibleEmployees.length > 12 && (
                    <p className="text-xs text-slate-500 col-span-2 text-center py-2">+{eligibleEmployees.length - 12} more eligible employees</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ACTIVITY TAB ── */}
        {activeTab === 'activity' && (
          <div className="space-y-3">
            {projectActivity.length === 0 ? (
              <div className="text-center text-slate-500 py-12 text-sm">No activity recorded for this project yet.</div>
            ) : (
              <div className="relative pl-8">
                <div className="absolute left-3.5 top-0 bottom-0 w-px bg-white/10" />
                {projectActivity.map((a: any) => (
                  <div key={a._id} className="relative mb-4">
                    <div className="absolute -left-5 top-1 w-6 h-6 rounded-full bg-card border border-white/10 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                    <div className="bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-bold text-white">{a.actorName}</p>
                        <p className="text-[10px] text-slate-500">{new Date(a.createdAt).toLocaleString()}</p>
                      </div>
                      <p className="text-xs text-slate-400">
                        {ACTION_LABELS[a.action] || a.action.toLowerCase().replace(/_/g, ' ')}
                        {a.from && a.to && <span className="text-slate-500"> ({a.from} → {a.to})</span>}
                      </p>
                      {a.comment && <p className="text-xs text-slate-500 mt-1 italic">"{a.comment}"</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
            <Input label="Start Date *" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
            <Input label="End Date *" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
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
              {projectType !== 'General' && <span className="text-xs text-amber-400 ml-2">(Only {projectType} dept employees shown)</span>}
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
                  <span>{emp.fullName} <span className="text-slate-400 text-xs">({emp.department})</span></span>
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
    </div>
  );
};
