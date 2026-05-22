import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectApi } from '../api_service/projectApi';
import { employeeApi } from '../api_service/employeeApi';
import { KanbanBoard } from '../Components/project/KanbanBoard';
import { ArrowLeft, Calendar, Clock, Edit, Trash2, Plus, Settings } from 'lucide-react';
import { Modal } from '../Components/WrapperComponents/Modal';
import { Input, Select, Textarea } from '../Components/WrapperComponents/Input';
import { Button } from '../Components/WrapperComponents/Button';

export const ProjectDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [sprints, setSprints] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  
  // Sprints state
  const [selectedSprintId, setSelectedSprintId] = useState<string>('backlog');
  
  // Modals state
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [isCreateSprintOpen, setIsCreateSprintOpen] = useState(false);
  const [isEditSprintOpen, setIsEditSprintOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Project Form state
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [clientName, setClientName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budget, setBudget] = useState(0);
  const [allocatedManagerId, setAllocatedManagerId] = useState('');
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([]);
  const [projectStatus, setProjectStatus] = useState('PLANNING');

  // Create Sprint Form state
  const [sprintName, setSprintName] = useState('');
  const [sprintGoal, setSprintGoal] = useState('');
  const [sprintStart, setSprintStart] = useState('');
  const [sprintEnd, setSprintEnd] = useState('');
  const [sprintStatus, setSprintStatus] = useState('PLANNING');

  // Edit Sprint Form state (for selected sprint)
  const [editSprintName, setEditSprintName] = useState('');
  const [editSprintGoal, setEditSprintGoal] = useState('');
  const [editSprintStart, setEditSprintStart] = useState('');
  const [editSprintEnd, setEditSprintEnd] = useState('');
  const [editSprintStatus, setEditSprintStatus] = useState<'PLANNING' | 'ACTIVE' | 'COMPLETED'>('PLANNING');

  const fetchProjectDetails = async () => {
    if (id) {
      try {
        const data = await projectApi.getProjectDetails(id);
        setProject(data.project);
        
        // Populate edit form values
        setProjectName(data.project.name);
        setProjectDesc(data.project.description);
        setClientName(data.project.clientName);
        setStartDate(data.project.startDate);
        setEndDate(data.project.endDate);
        setBudget(data.project.budget || 0);
        setAllocatedManagerId(data.project.allocatedManagerId?._id || '');
        setTeamMemberIds(data.project.teamMemberIds?.map((t: any) => t._id) || []);
        setProjectStatus(data.project.status);
      } catch (e) {
        console.error('Failed to fetch project details', e);
      }
    }
  };

  const fetchSprints = async () => {
    if (id) {
      try {
        const data = await projectApi.getSprints(id);
        setSprints(data.sprints || []);
      } catch (e) {
        console.error('Failed to fetch sprints', e);
      }
    }
  };

  useEffect(() => {
    fetchProjectDetails();
    fetchSprints();

    const fetchEmployees = async () => {
      try {
        const data = await employeeApi.getAll();
        setEmployees(data.employees || []);
      } catch (error) {
        console.error('Failed to fetch employees', error);
      }
    };
    fetchEmployees();
  }, [id]);

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
        teamMemberIds,
        status: projectStatus,
      });
      setIsEditProjectOpen(false);
      fetchProjectDetails();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to update project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!id) return;
    if (!window.confirm('Are you sure you want to delete this project? This will remove all associated tasks and sprints.')) {
      return;
    }
    try {
      await projectApi.deleteProject(id);
      navigate('/projects');
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to delete project');
    }
  };

  const handleCreateSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setIsSubmitting(true);
    try {
      await projectApi.createSprint(id, {
        name: sprintName,
        goal: sprintGoal,
        startDate: sprintStart,
        endDate: sprintEnd,
        status: sprintStatus
      });
      setSprintName('');
      setSprintGoal('');
      setSprintStart('');
      setSprintEnd('');
      setSprintStatus('PLANNING');
      setIsCreateSprintOpen(false);
      fetchSprints();
    } catch (err: any) {
      console.error(err);
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
      await projectApi.updateSprint(id, selectedSprintId, {
        name: editSprintName,
        goal: editSprintGoal,
        startDate: editSprintStart,
        endDate: editSprintEnd,
        status: editSprintStatus
      });
      setIsEditSprintOpen(false);
      fetchSprints();
    } catch (err: any) {
      console.error(err);
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

  if (!project) return <div className="p-6 text-slate-400 bg-slate-950 min-h-screen">Loading project details...</div>;

  // Determine assignable members
  const assignableMembers = [...(project.teamMemberIds || [])];
  const managerEmp = employees.find(emp => emp.userId === project.allocatedManagerId?._id);
  if (managerEmp && !assignableMembers.some(emp => emp._id === managerEmp._id)) {
    assignableMembers.push({
      _id: managerEmp._id,
      fullName: `${managerEmp.fullName} (Manager)`,
      email: managerEmp.email,
      profileImage: managerEmp.profileImage
    });
  }

  const selectedSprintObj = sprints.find(s => s._id === selectedSprintId);

  return (
    <div className="flex flex-col h-full bg-slate-950 p-6 text-left">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center">
          <button 
            onClick={() => navigate('/projects')}
            className="mr-4 p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg transition-colors border border-slate-800"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-100">{project.name}</h1>
            <div className="flex flex-wrap items-center text-slate-400 text-sm mt-1 gap-3">
              <span className={`px-2 py-0.5 rounded border text-xs font-semibold ${
                project.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                project.status === 'PLANNING' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                project.status === 'ON_HOLD' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {project.status}
              </span>
              <span className="flex items-center">
                <Calendar className="w-4 h-4 mr-1 text-slate-500" />
                {new Date(project.startDate).toLocaleDateString()} - {new Date(project.endDate).toLocaleDateString()}
              </span>
              <span className="text-slate-500">|</span>
              <span>Client: <strong className="text-slate-300">{project.clientName}</strong></span>
              <span className="text-slate-500">|</span>
              <span>Budget: <strong className="text-indigo-400">${project.budget?.toLocaleString()}</strong></span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsEditProjectOpen(true)}
            className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition-colors text-sm font-medium"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit Project
          </button>
          <button
            onClick={handleDeleteProject}
            className="flex items-center px-3 py-1.5 bg-red-950/20 hover:bg-red-950/40 text-red-400 rounded-lg border border-red-500/20 transition-colors text-sm font-medium"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </button>
        </div>
      </div>

      {/* Toolbar / Sprints Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 bg-slate-900/40 border border-slate-800/80 p-4 rounded-xl">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center">
            <span className="text-sm font-medium text-slate-400 mr-2">Sprint:</span>
            <select
              value={selectedSprintId}
              onChange={(e) => setSelectedSprintId(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
            >
              <option value="backlog">Backlog / All Tasks</option>
              {sprints.map((sprint) => (
                <option key={sprint._id} value={sprint._id}>
                  {sprint.name} ({sprint.status})
                </option>
              ))}
            </select>
          </div>

          {selectedSprintId !== 'backlog' && (
            <button
              onClick={openEditSprintModal}
              className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-300 border border-slate-800 rounded-lg transition-colors"
              title="Edit Sprint Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => setIsCreateSprintOpen(true)}
            className="flex items-center text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-2 rounded-lg border border-indigo-500/10 transition-all"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            New Sprint
          </button>
        </div>

        {/* Sprint Info Banner */}
        {selectedSprintObj ? (
          <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              {new Date(selectedSprintObj.startDate).toLocaleDateString()} - {new Date(selectedSprintObj.endDate).toLocaleDateString()}
            </span>
            {selectedSprintObj.goal && (
              <>
                <span className="text-slate-700">•</span>
                <span className="italic text-slate-300">"{selectedSprintObj.goal}"</span>
              </>
            )}
          </div>
        ) : (
          <div className="text-xs text-slate-500 italic">Showing all board tasks</div>
        )}
      </div>

      {/* Kanban Board Area */}
      <div className="flex-1 bg-slate-900/50 rounded-xl border border-slate-800 p-4 overflow-hidden min-h-[500px]">
        <KanbanBoard 
          projectId={project._id} 
          selectedSprintId={selectedSprintId}
          sprints={sprints}
          teamMembers={assignableMembers}
        />
      </div>

      {/* Edit Project Modal */}
      <Modal isOpen={isEditProjectOpen} onClose={() => setIsEditProjectOpen(false)} title="Edit Project Details" maxWidth="max-w-xl">
        <form onSubmit={handleUpdateProject} className="space-y-4 text-left">
          <Input 
            label="Project Name *"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            required
          />

          <Textarea 
            label="Description *"
            value={projectDesc}
            onChange={(e) => setProjectDesc(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Client Name *"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              required
            />
            <Select 
              label="Status *"
              value={projectStatus}
              onChange={(e) => setProjectStatus(e.target.value)}
              options={[
                { value: 'PLANNING', label: 'Planning' },
                { value: 'ACTIVE', label: 'Active' },
                { value: 'ON_HOLD', label: 'On Hold' },
                { value: 'COMPLETED', label: 'Completed' }
              ]}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Start Date *"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
            <Input 
              label="End Date *"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Budget (USD) *"
              type="number"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              required
            />
            <Select 
              label="Allocated Manager *"
              value={allocatedManagerId}
              onChange={(e) => setAllocatedManagerId(e.target.value)}
              required
            >
              <option value="">Select Manager</option>
              {employees.map((emp) => (
                <option key={emp._id} value={emp.userId || ''} disabled={!emp.userId}>
                  {emp.fullName} {!emp.userId ? '(No User Account)' : ''}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Team Members</label>
            <div className="border border-border rounded-lg bg-background p-3 max-h-36 overflow-y-auto space-y-2">
              {employees.map(emp => (
                <label key={emp._id} className="flex items-center space-x-2 text-sm text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={teamMemberIds.includes(emp._id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setTeamMemberIds([...teamMemberIds, emp._id]);
                      } else {
                        setTeamMemberIds(teamMemberIds.filter(id => id !== emp._id));
                      }
                    }}
                    className="rounded border-border text-primary bg-background focus:ring-ring"
                  />
                  <span>{emp.fullName} ({emp.email})</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
            <Button type="button" variant="outline" onClick={() => setIsEditProjectOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Sprint Modal */}
      <Modal isOpen={isCreateSprintOpen} onClose={() => setIsCreateSprintOpen(false)} title="Create New Sprint">
        <form onSubmit={handleCreateSprint} className="space-y-4 text-left">
          <Input 
            label="Sprint Name *"
            value={sprintName}
            onChange={(e) => setSprintName(e.target.value)}
            placeholder="Sprint 1 - Core Features"
            required
          />

          <Textarea 
            label="Sprint Goal"
            value={sprintGoal}
            onChange={(e) => setSprintGoal(e.target.value)}
            placeholder="Deploy authentication workflows and setup dev database..."
          />

          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Start Date *"
              type="date"
              value={sprintStart}
              onChange={(e) => setSprintStart(e.target.value)}
              required
            />
            <Input 
              label="End Date *"
              type="date"
              value={sprintEnd}
              onChange={(e) => setSprintEnd(e.target.value)}
              required
            />
          </div>

          <Select 
            label="Status *"
            value={sprintStatus}
            onChange={(e) => setSprintStatus(e.target.value)}
            options={[
              { value: 'PLANNING', label: 'Planning' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'COMPLETED', label: 'Completed' }
            ]}
            required
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
            <Button type="button" variant="outline" onClick={() => setIsCreateSprintOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Create Sprint
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Sprint Modal */}
      <Modal isOpen={isEditSprintOpen} onClose={() => setIsEditSprintOpen(false)} title="Edit Sprint Settings">
        <form onSubmit={handleUpdateSprint} className="space-y-4 text-left">
          <Input 
            label="Sprint Name *"
            value={editSprintName}
            onChange={(e) => setEditSprintName(e.target.value)}
            required
          />

          <Textarea 
            label="Sprint Goal"
            value={editSprintGoal}
            onChange={(e) => setEditSprintGoal(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Start Date *"
              type="date"
              value={editSprintStart}
              onChange={(e) => setEditSprintStart(e.target.value)}
              required
            />
            <Input 
              label="End Date *"
              type="date"
              value={editSprintEnd}
              onChange={(e) => setEditSprintEnd(e.target.value)}
              required
            />
          </div>

          <Select 
            label="Status *"
            value={editSprintStatus}
            onChange={(e) => setEditSprintStatus(e.target.value as any)}
            options={[
              { value: 'PLANNING', label: 'Planning' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'COMPLETED', label: 'Completed' }
            ]}
            required
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
            <Button type="button" variant="outline" onClick={() => setIsEditSprintOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Save Sprint Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
