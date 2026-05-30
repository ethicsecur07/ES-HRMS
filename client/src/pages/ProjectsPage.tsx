import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Briefcase, Calendar, Users, DollarSign, IndianRupee, ArrowLeftRight, TrendingUp } from 'lucide-react';
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

  // Budget currency state
  // USD_TO_INR: fixed reference rate (update periodically for accuracy)
  const USD_TO_INR = 83.5;
  const [budgetCurrency, setBudgetCurrency] = useState<'USD' | 'INR'>('USD');
  const [budgetInput, setBudgetInput] = useState('');

  // Derived: always keep `budget` state in USD for the API
  const handleBudgetChange = (raw: string) => {
    setBudgetInput(raw);
    const val = parseFloat(raw) || 0;
    if (budgetCurrency === 'USD') {
      setBudget(val);
    } else {
      // Convert INR → USD before storing
      setBudget(parseFloat((val / USD_TO_INR).toFixed(2)));
    }
  };

  const handleCurrencySwitch = (cur: 'USD' | 'INR') => {
    setBudgetCurrency(cur);
    // Re-express current budget in the new currency
    const current = parseFloat(budgetInput) || 0;
    if (cur === 'INR' && budgetCurrency === 'USD') {
      const inr = current * USD_TO_INR;
      setBudgetInput(inr > 0 ? inr.toFixed(0) : '');
    } else if (cur === 'USD' && budgetCurrency === 'INR') {
      const usd = current / USD_TO_INR;
      setBudgetInput(usd > 0 ? usd.toFixed(2) : '');
    }
  };

  // Live conversion display
  const inputVal = parseFloat(budgetInput) || 0;
  const budgetUSD = budgetCurrency === 'USD' ? inputVal : inputVal / USD_TO_INR;
  const budgetINR = budgetCurrency === 'INR' ? inputVal : inputVal * USD_TO_INR;

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
      setBudgetInput('');
      setBudgetCurrency('USD');
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

          {/* ── Budget with USD / INR Analysis ─────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Budget *</label>

            {/* Currency toggle + input row */}
            <div className="flex gap-2 mb-2">
              {/* Currency pill toggle */}
              <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
                <button
                  type="button"
                  onClick={() => handleCurrencySwitch('USD')}
                  className={`flex items-center gap-1 px-3 py-2 text-xs font-bold transition-all ${
                    budgetCurrency === 'USD'
                      ? 'bg-primary text-primary-foreground shadow-inner'
                      : 'bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <DollarSign className="w-3 h-3" />
                  USD
                </button>
                <div className="w-px bg-border" />
                <button
                  type="button"
                  onClick={() => handleCurrencySwitch('INR')}
                  className={`flex items-center gap-1 px-3 py-2 text-xs font-bold transition-all ${
                    budgetCurrency === 'INR'
                      ? 'bg-primary text-primary-foreground shadow-inner'
                      : 'bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <IndianRupee className="w-3 h-3" />
                  INR
                </button>
              </div>

              {/* Amount input */}
              <div className="relative flex-1">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                  {budgetCurrency === 'USD'
                    ? <DollarSign className="w-4 h-4" />
                    : <IndianRupee className="w-4 h-4" />
                  }
                </div>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={budgetInput}
                  onChange={(e) => handleBudgetChange(e.target.value)}
                  placeholder={budgetCurrency === 'USD' ? 'e.g. 5000' : 'e.g. 415000'}
                  required
                  className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
                />
              </div>
            </div>

            {/* Live analysis panel — shown only when a value is entered */}
            {inputVal > 0 && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2 mt-1">
                {/* Header */}
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary/70">
                  <TrendingUp className="w-3 h-3" />
                  Budget Analysis
                  <span className="ml-auto text-muted-foreground font-normal normal-case tracking-normal">Rate: 1 USD = {USD_TO_INR} INR</span>
                </div>

                {/* Conversion row */}
                <div className="flex items-center justify-between gap-3">
                  {/* USD column */}
                  <div className="flex-1 bg-background rounded-lg border border-border p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground text-[10px] font-semibold uppercase mb-1">
                      <DollarSign className="w-3 h-3" />
                      USD
                    </div>
                    <div className="text-base font-bold text-foreground">
                      ${budgetUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="text-muted-foreground">
                    <ArrowLeftRight className="w-4 h-4" />
                  </div>

                  {/* INR column */}
                  <div className="flex-1 bg-background rounded-lg border border-border p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground text-[10px] font-semibold uppercase mb-1">
                      <IndianRupee className="w-3 h-3" />
                      INR
                    </div>
                    <div className="text-base font-bold text-foreground">
                      ₹{budgetINR.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>

                {/* Breakdown chips */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-background border border-border text-[10px] text-muted-foreground">
                    <DollarSign className="w-2.5 h-2.5" />
                    Monthly: ${(budgetUSD / 12).toLocaleString('en-US', { maximumFractionDigits: 0 })} / mo
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-background border border-border text-[10px] text-muted-foreground">
                    <IndianRupee className="w-2.5 h-2.5" />
                    Monthly: ₹{(budgetINR / 12).toLocaleString('en-IN', { maximumFractionDigits: 0 })} / mo
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-[10px]">
                    ⚠ Reference rate only
                  </span>
                </div>
              </div>
            )}
          </div>

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
