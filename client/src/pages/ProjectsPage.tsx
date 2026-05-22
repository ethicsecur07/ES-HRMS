import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Briefcase, Calendar, Users, DollarSign } from 'lucide-react';
import { projectApi } from '../api_service/projectApi';
import { employeeApi } from '../api_service/employeeApi';
import { Modal } from '../Components/WrapperComponents/Modal';
import { Input, Select, Textarea } from '../Components/WrapperComponents/Input';
import { Button } from '../Components/WrapperComponents/Button';
import { usePermission } from '../hooks/usePermission';

export const ProjectsPage = () => {
  const { hasPermission } = usePermission();
  const [projects, setProjects] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [clientName, setClientName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budget, setBudget] = useState(0);
  const [allocatedManagerId, setAllocatedManagerId] = useState('');
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([]);
  const [status, setStatus] = useState('PLANNING');

  const fetchProjects = async () => {
    try {
      const data = await projectApi.getProjects();
      setProjects(data.projects || []);
    } catch (error) {
      console.error('Failed to fetch projects', error);
    }
  };

  useEffect(() => {
    fetchProjects();

    const fetchEmployees = async () => {
      try {
        const data = await employeeApi.getAll();
        setEmployees(data.employees || []);
      } catch (error) {
        console.error('Failed to fetch employees', error);
      }
    };
    fetchEmployees();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !description || !clientName || !startDate || !endDate || !allocatedManagerId) {
      alert('Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      await projectApi.createProject({
        name,
        description,
        clientName,
        startDate,
        endDate,
        budget,
        allocatedManagerId,
        teamMemberIds,
        status
      });
      
      // Reset form
      setName('');
      setDescription('');
      setClientName('');
      setStartDate('');
      setEndDate('');
      setBudget(0);
      setAllocatedManagerId('');
      setTeamMemberIds([]);
      setStatus('PLANNING');
      
      setIsOpen(false);
      fetchProjects();
    } catch (error: any) {
      console.error('Failed to create project', error);
      alert(error.response?.data?.message || 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 text-left animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Projects</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage your projects and agile sprints</p>
        </div>
        {hasPermission('PROJECTS', 'create') && (
          <button 
            onClick={() => setIsOpen(true)}
            className="flex items-center px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg shadow-lg shadow-primary/20 transition-all font-medium text-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project: any) => (
          <div 
            key={project._id}
            onClick={() => navigate(`/projects/${project._id}`)}
            className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 cursor-pointer transition-all duration-200 group shadow-sm"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-primary/10 text-primary rounded-lg group-hover:bg-primary/20 transition-colors">
                <Briefcase className="w-6 h-6" />
              </div>
              <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                project.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                project.status === 'PLANNING' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                project.status === 'ON_HOLD' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                'bg-muted text-muted-foreground border-border'
              }`}>
                {project.status}
              </span>
            </div>
            
            <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">{project.name}</h3>
            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{project.description}</p>
            
            <div className="flex items-center gap-4 text-xs text-muted-foreground border-t border-border pt-4 mt-auto">
              <div className="flex items-center">
                <Calendar className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <span>{new Date(project.startDate).toLocaleDateString()}</span>
              </div>
              {project.teamMemberIds?.length > 0 && (
                <div className="flex items-center ml-auto">
                  <Users className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                  <span>{project.teamMemberIds.length} members</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* New Project Modal */}
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Create New Project" maxWidth="max-w-xl">
        <form onSubmit={handleCreateProject} className="space-y-4 text-left">
          <Input 
            label="Project Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="EthicSec Portal Redesign"
            required
          />

          <Textarea 
            label="Description *"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detailed scope and deliverables..."
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Client Name *"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Internal / Client Corp"
              required
            />
            <Select 
              label="Status *"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
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
              placeholder="e.g. 5000"
              icon={<DollarSign className="w-4 h-4" />}
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
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Create Project
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
