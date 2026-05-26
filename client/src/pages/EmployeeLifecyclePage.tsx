import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { lifecycleApi } from '../api_service/lifecycleApi';
import type { LifecycleStep } from '../api_service/lifecycleApi';
import { employeeApi } from '../api_service/employeeApi';
import { organizationApi } from '../api_service/organizationApi';
import { useNotificationStore } from '../store/useNotificationStore';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
import { Input, Select, Textarea } from '../Components/WrapperComponents/Input';
import { Modal } from '../Components/WrapperComponents/Modal';
import { 
  UserCheck, 
  UserMinus, 
  TrendingUp, 
  RefreshCw, 
  PlusCircle, 
  Calendar, 
  CheckCircle2, 
  Circle, 
  Info,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

export const EmployeeLifecyclePage: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useNotificationStore();
  
  // UI states
  const [activeTab, setActiveTab] = useState<'ALL' | 'ONBOARDING' | 'PROBATION' | 'MOVEMENT' | 'EXIT'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedTrackerId, setExpandedTrackerId] = useState<string | null>(null);
  
  // Form states for creating tracker
  const [employeeId, setEmployeeId] = useState('');
  const [trackerType, setTrackerType] = useState<'ONBOARDING' | 'PROBATION' | 'PROMOTION' | 'TRANSFER' | 'RESIGNATION' | 'EXIT'>('ONBOARDING');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Details form fields based on type
  const [probationIsConfirmed, setProbationIsConfirmed] = useState(true);
  const [probationComments, setProbationComments] = useState('');
  
  const [promotionRole, setPromotionRole] = useState('');
  const [promotionSalary, setPromotionSalary] = useState(0);
  
  const [transferDept, setTransferDept] = useState('');
  const [transferBranchId, setTransferBranchId] = useState('');
  
  const [resignationLastDay, setResignationLastDay] = useState(new Date().toISOString().split('T')[0]);
  const [resignationNoticeServed, setResignationNoticeServed] = useState(true);
  const [resignationInterview, setResignationInterview] = useState(false);
  const [resignationReason, setResignationReason] = useState('');

  // Step editing states (notes input inside card)
  const [stepNotes, setStepNotes] = useState<Record<string, string>>({});

  // Queries
  const { data: trackers, isLoading: isLifecycleLoading } = useQuery({
    queryKey: ['lifecycleTrackers'],
    queryFn: () => lifecycleApi.getAll(),
  });

  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeeApi.getAll().then(res => res.employees),
  });

  const { data: orgData } = useQuery({
    queryKey: ['orgStructure'],
    queryFn: organizationApi.getStructure,
  });

  // Mutations
  const createTrackerMutation = useMutation({
    mutationFn: (data: any) => lifecycleApi.createTracker(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lifecycleTrackers'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      addToast('Lifecycle Started', 'New employee lifecycle flow initiated successfully.', 'success');
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      addToast('Initiation Failed', err.response?.data?.message || err.message || 'Failed to start flow.', 'error');
    }
  });

  const updateStepMutation = useMutation({
    mutationFn: ({ trackerId, stepId, data }: { trackerId: string; stepId: string; data: any }) => 
      lifecycleApi.updateStep(trackerId, stepId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lifecycleTrackers'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      addToast('Step Updated', 'Checklist task status modified.', 'success');
      
      // If the overall tracker became completed
      if (data.status === 'COMPLETED') {
        addToast('Process Finalized', `Lifecycle transition finished! Employee record synced automatically.`, 'success');
      }
    },
    onError: (err: any) => {
      addToast('Failed to update step', err.response?.data?.message || err.message || 'Error occurred.', 'error');
    }
  });

  const resetForm = () => {
    setEmployeeId('');
    setTrackerType('ONBOARDING');
    setStartDate(new Date().toISOString().split('T')[0]);
    setProbationIsConfirmed(true);
    setProbationComments('');
    setPromotionRole('');
    setPromotionSalary(0);
    setTransferDept('');
    setTransferBranchId('');
    setResignationLastDay(new Date().toISOString().split('T')[0]);
    setResignationNoticeServed(true);
    setResignationInterview(false);
    setResignationReason('');
  };

  const handleCreateTracker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) {
      addToast('Validation Error', 'Please select an employee.', 'error');
      return;
    }

    const payload: any = {
      employeeId,
      type: trackerType,
      startDate,
    };

    if (trackerType === 'PROBATION') {
      payload.probationDetails = {
        isConfirmed: probationIsConfirmed,
        reviewComments: probationComments,
      };
    } else if (trackerType === 'PROMOTION') {
      payload.promotionDetails = {
        newRoleCode: promotionRole,
        newSalary: Number(promotionSalary),
      };
    } else if (trackerType === 'TRANSFER') {
      payload.transferDetails = {
        newDepartment: transferDept,
        newBranchId: transferBranchId,
      };
    } else if (trackerType === 'RESIGNATION' || trackerType === 'EXIT') {
      payload.resignationDetails = {
        lastWorkingDay: resignationLastDay,
        noticeServed: resignationNoticeServed,
        exitInterviewCompleted: resignationInterview,
        reasonForLeaving: resignationReason,
      };
    }

    createTrackerMutation.mutate(payload);
  };

  const handleStepToggle = (trackerId: string, stepId: string, currentStatus: string, notes?: string) => {
    const nextStatus = currentStatus === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    updateStepMutation.mutate({
      trackerId,
      stepId,
      data: {
        status: nextStatus,
        notes: notes || stepNotes[stepId] || '',
      }
    });
  };

  const handleStepSkip = (trackerId: string, stepId: string, notes?: string) => {
    updateStepMutation.mutate({
      trackerId,
      stepId,
      data: {
        status: 'SKIPPED',
        notes: notes || stepNotes[stepId] || 'Skipped by admin.',
      }
    });
  };

  // Filter trackers
  const filteredTrackers = useMemo(() => {
    if (!trackers) return [];
    return trackers.filter(t => {
      if (activeTab === 'ALL') return true;
      if (activeTab === 'ONBOARDING') return t.type === 'ONBOARDING';
      if (activeTab === 'PROBATION') return t.type === 'PROBATION';
      if (activeTab === 'MOVEMENT') return t.type === 'PROMOTION' || t.type === 'TRANSFER';
      if (activeTab === 'EXIT') return t.type === 'RESIGNATION' || t.type === 'EXIT';
      return true;
    });
  }, [trackers, activeTab]);

  const getTrackerIcon = (type: string) => {
    switch (type) {
      case 'ONBOARDING':
        return <UserCheck className="w-5 h-5 text-emerald-500" />;
      case 'PROBATION':
        return <FileText className="w-5 h-5 text-indigo-500" />;
      case 'PROMOTION':
        return <TrendingUp className="w-5 h-5 text-pink-500" />;
      case 'TRANSFER':
        return <RefreshCw className="w-5 h-5 text-sky-500" />;
      case 'RESIGNATION':
      case 'EXIT':
        return <UserMinus className="w-5 h-5 text-rose-500" />;
      default:
        return <Info className="w-5 h-5 text-primary" />;
    }
  };

  const calculateProgress = (steps: LifecycleStep[]) => {
    if (!steps || steps.length === 0) return 0;
    const completed = steps.filter(s => s.status === 'COMPLETED' || s.status === 'SKIPPED').length;
    return Math.round((completed / steps.length) * 100);
  };

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-300">
      
      {/* Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm backdrop-blur-md">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Employee Lifecycle Workflows</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Orchestrate staff journeys—seamlessly coordinating induction checklists, movements, promotions, and final settlements.
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="bg-primary text-white font-bold tracking-wider shadow-lg shadow-primary/20 hover:scale-105 transition-all">
          <PlusCircle className="w-5 h-5 mr-2" />
          TRIGGER PROCESS
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border overflow-x-auto gap-2 scrollbar-none">
        {(['ALL', 'ONBOARDING', 'PROBATION', 'MOVEMENT', 'EXIT'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-3 px-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main Grid */}
      {isLifecycleLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map(n => (
            <Card key={n} className="animate-pulse h-60 bg-muted/10 border-border"><div /></Card>
          ))}
        </div>
      ) : filteredTrackers.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-2 border-border bg-card/50 flex flex-col items-center justify-center">
          <Info className="w-12 h-12 text-muted-foreground opacity-50 mb-3" />
          <p className="font-bold text-foreground">No Lifecycle Workflows Found</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            There are no active or completed lifecycle tracking records for this filter category. Let's trigger a new onboarding or transfer flow!
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredTrackers.map(tracker => {
            const progress = calculateProgress(tracker.steps);
            const isExpanded = expandedTrackerId === tracker._id;
            const empName = tracker.employeeId?.fullName || tracker.employeeId?.firstName ? `${tracker.employeeId.firstName || ''} ${tracker.employeeId.lastName || ''}`.trim() : 'Unknown Employee';
            const empCode = tracker.employeeId?.employeeId || tracker.employeeId?.employeeCode || 'N/A';
            const empRole = tracker.employeeId?.designation || 'N/A';

            return (
              <Card 
                key={tracker._id} 
                className={`transition-all duration-300 border bg-card hover:shadow-md ${
                  tracker.status === 'COMPLETED' 
                    ? 'border-emerald-500/20 shadow-sm' 
                    : 'border-border'
                }`}
              >
                <div className="p-5 space-y-4">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center">
                        {getTrackerIcon(tracker.type)}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-foreground">{empName}</h3>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {empCode && !empCode.startsWith('TEMP-EMP-') ? `${empCode} | ` : ''}
                          {empRole}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                        tracker.status === 'COMPLETED'
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          : tracker.status === 'IN_PROGRESS'
                          ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                          : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                      }`}>
                        {tracker.status}
                      </span>
                      <p className="text-[10px] text-muted-foreground mt-1 flex items-center justify-end gap-1 font-medium">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        {new Date(tracker.startDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Type and Description Summary */}
                  <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 text-xs">
                    <p className="font-bold text-foreground flex items-center gap-1.5 mb-1.5">
                      {getTrackerIcon(tracker.type)}
                      {tracker.type} Flow
                    </p>
                    {/* Render specific details based on type */}
                    {tracker.type === 'PROMOTION' && tracker.promotionDetails && (
                      <div className="font-medium text-muted-foreground grid grid-cols-2 gap-2 mt-1">
                        <span>New Title: <strong className="text-foreground">{tracker.promotionDetails.newRoleCode}</strong></span>
                        <span>New Salary: <strong className="text-primary font-mono">{formatCurrency(tracker.promotionDetails.newSalary)}</strong></span>
                      </div>
                    )}
                    {tracker.type === 'TRANSFER' && tracker.transferDetails && (
                      <div className="font-medium text-muted-foreground grid grid-cols-2 gap-2 mt-1">
                        <span>New Dept: <strong className="text-foreground">{tracker.transferDetails.newDepartment}</strong></span>
                        <span>New Branch ID: <strong className="text-foreground">{tracker.transferDetails.newBranchId}</strong></span>
                      </div>
                    )}
                    {tracker.type === 'PROBATION' && tracker.probationDetails && (
                      <div className="font-medium text-muted-foreground mt-1">
                        <span>Status: <strong className="text-foreground">{tracker.probationDetails.isConfirmed ? 'Confirmed' : 'Extended / Unconfirmed'}</strong></span>
                        {tracker.probationDetails.reviewComments && <p className="mt-1 italic text-[11px]">"{tracker.probationDetails.reviewComments}"</p>}
                      </div>
                    )}
                    {(tracker.type === 'RESIGNATION' || tracker.type === 'EXIT') && tracker.resignationDetails && (
                      <div className="font-medium text-muted-foreground mt-1 space-y-1">
                        <div className="grid grid-cols-2 gap-2">
                          <span>Last Day: <strong className="text-foreground">{new Date(tracker.resignationDetails.lastWorkingDay).toLocaleDateString()}</strong></span>
                          <span>Exit Interview: <strong className="text-foreground">{tracker.resignationDetails.exitInterviewCompleted ? 'Done' : 'Pending'}</strong></span>
                        </div>
                        {tracker.resignationDetails.reasonForLeaving && <p className="italic text-[11px] mt-1">Reason: "{tracker.resignationDetails.reasonForLeaving}"</p>}
                      </div>
                    )}
                  </div>

                  {/* Progress Indicator */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span className="text-muted-foreground">Checklist Tasks</span>
                      <span className="text-primary">{progress}% ({tracker.steps.filter(s => s.status === 'COMPLETED' || s.status === 'SKIPPED').length}/{tracker.steps.length})</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden border border-border/30">
                      <div 
                        className="h-full bg-primary transition-all duration-500 rounded-full" 
                        style={{ width: `${progress}%` }} 
                      />
                    </div>
                  </div>

                  {/* Toggle Steps Drawer */}
                  <button
                    onClick={() => setExpandedTrackerId(isExpanded ? null : tracker._id)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 border border-border rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                  >
                    {isExpanded ? (
                      <>
                        <span>COLLAPSE DETAILED TASKS</span>
                        <ChevronUp className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        <span>EXPAND DETAILED TASKS</span>
                        <ChevronDown className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

                {/* Expanded Checklist Steps Drawer */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/20 p-5 space-y-3.5 animate-in slide-in-from-top-2 duration-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Checklist Progression Step-by-Step</span>
                    <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60">
                      {tracker.steps.map((step) => {
                        const isDone = step.status === 'COMPLETED';
                        const isSkipped = step.status === 'SKIPPED';

                        return (
                          <div 
                            key={step._id} 
                            className={`flex items-start gap-3.5 pl-1.5 transition-all p-3 rounded-xl border relative ${
                              isDone 
                                ? 'bg-emerald-500/[0.03] border-emerald-500/10' 
                                : isSkipped
                                ? 'bg-muted border-border/40 text-muted-foreground'
                                : 'bg-card border-border hover:border-primary/20'
                            }`}
                          >
                            {/* Bullet Connector Dot Overlay */}
                            <div className="absolute left-[-11px] top-4 z-10 w-2.5 h-2.5 rounded-full border-2 border-card bg-primary transition-all shadow-sm" style={{
                              backgroundColor: isDone ? '#10b981' : isSkipped ? '#9ca3af' : 'var(--primary)'
                            }} />

                            {/* Checkbox Trigger */}
                            <button
                              disabled={updateStepMutation.isPending}
                              onClick={() => handleStepToggle(tracker._id, step._id, step.status)}
                              className="mt-0.5 focus:outline-none flex-shrink-0"
                              title={isDone ? 'Mark as Pending' : 'Mark as Completed'}
                            >
                              {isDone ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-500/10" />
                              ) : isSkipped ? (
                                <CheckCircle2 className="w-5 h-5 text-muted-foreground/60" />
                              ) : (
                                <Circle className="w-5 h-5 text-muted-foreground/50 hover:text-primary transition-colors" />
                              )}
                            </button>

                            {/* Step Text Info */}
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <span className={`text-xs font-bold leading-tight block ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                  {step.name}
                                </span>
                                {!isDone && !isSkipped && (
                                  <button
                                    onClick={() => handleStepSkip(tracker._id, step._id)}
                                    className="text-[10px] text-muted-foreground hover:text-primary font-bold tracking-wider"
                                  >
                                    SKIP
                                  </button>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-snug">{step.description}</p>
                              
                              {/* Step notes / comments logger */}
                              {step.notes && (
                                <div className="p-2 rounded bg-muted/60 text-[10px] border border-border/50 text-foreground italic">
                                  <strong>Note:</strong> {step.notes}
                                </div>
                              )}

                              {/* Input box to add notes when pending */}
                              {!isDone && !isSkipped && (
                                <div className="pt-2 flex gap-2">
                                  <input 
                                    type="text" 
                                    placeholder="Add progress note..."
                                    value={stepNotes[step._id] || ''}
                                    onChange={(e) => setStepNotes({ ...stepNotes, [step._id]: e.target.value })}
                                    className="text-[10px] px-2 py-1 flex-1 bg-muted border border-border rounded focus:outline-none focus:border-primary"
                                  />
                                  <button
                                    onClick={() => handleStepToggle(tracker._id, step._id, step.status, stepNotes[step._id])}
                                    className="text-[10px] bg-primary text-white px-2 py-1 rounded font-bold"
                                  >
                                    Save
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Initiation Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Trigger Employee Lifecycle Flow" maxWidth="max-w-xl">
        <form onSubmit={handleCreateTracker} className="space-y-4 px-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Employee Selector */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-foreground mb-1">Select Employee *</label>
              <select
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full h-10 px-3 border border-border rounded-xl bg-card text-xs font-semibold focus:outline-none focus:border-primary"
              >
                <option value="">-- Choose Employee --</option>
                {employees?.map(emp => (
                  <option key={emp._id} value={emp._id}>
                    {emp.fullName} {emp.employeeCode && !emp.employeeCode.startsWith('TEMP-EMP-') ? `(${emp.employeeCode})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Lifecycle Flow Type Selector */}
            <Select
              label="Lifecycle Process Type *"
              value={trackerType}
              onChange={(e: any) => setTrackerType(e.target.value)}
              options={[
                { value: 'ONBOARDING', label: 'Onboarding Induction' },
                { value: 'PROBATION', label: 'Probation Review' },
                { value: 'PROMOTION', label: 'Promotion Review' },
                { value: 'TRANSFER', label: 'Department/Branch Transfer' },
                { value: 'RESIGNATION', label: 'Resignation Notice' },
                { value: 'EXIT', label: 'Exit Settlement' },
              ]}
            />
          </div>

          <Input 
            label="Start Date *" 
            type="date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)} 
          />

          {/* Conditional Sections based on chosen Type */}
          {trackerType === 'PROBATION' && (
            <div className="p-4 rounded-xl bg-muted border border-border space-y-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Probation Review Details</span>
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="probationConfirmed"
                  checked={probationIsConfirmed} 
                  onChange={(e) => setProbationIsConfirmed(e.target.checked)}
                  className="rounded border-border bg-card text-primary focus:ring-primary"
                />
                <label htmlFor="probationConfirmed" className="text-xs font-bold text-foreground">Confirm Employee Employment</label>
              </div>
              <Textarea 
                label="Review Evaluation Comments"
                placeholder="Details of the review, strengths, alignment..."
                value={probationComments}
                onChange={(e) => setProbationComments(e.target.value)}
              />
            </div>
          )}

          {trackerType === 'PROMOTION' && (
            <div className="p-4 rounded-xl bg-muted border border-border space-y-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Promotion Compensation Adjustments</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input 
                  label="New Designation / Role Code *"
                  required
                  placeholder="e.g. Senior Developer"
                  value={promotionRole}
                  onChange={(e) => setPromotionRole(e.target.value)}
                />
                <Input 
                  label="New Monthly Salary (INR) *"
                  type="number"
                  required
                  value={promotionSalary || ''}
                  onChange={(e) => setPromotionSalary(Number(e.target.value))}
                />
              </div>
            </div>
          )}

          {trackerType === 'TRANSFER' && (
            <div className="p-4 rounded-xl bg-muted border border-border space-y-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Movement Coordinates</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select 
                  label="New Department *"
                  required
                  value={transferDept}
                  onChange={(e: any) => setTransferDept(e.target.value)}
                  options={[
                    { value: '', label: '-- Choose Dept --' },
                    { value: 'Developers', label: 'Developers' },
                    { value: 'Designers', label: 'Designers' },
                    { value: 'BDE', label: 'BDE (Business Development)' },
                    { value: 'DME', label: 'DME (Digital Marketing)' },
                    { value: 'Internship', label: 'Internship' },
                  ]}
                />
                
                {/* Branch Selection */}
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-foreground mb-1">New Branch *</label>
                  <select
                    required
                    value={transferBranchId}
                    onChange={(e) => setTransferBranchId(e.target.value)}
                    className="w-full h-10 px-3 border border-border rounded-xl bg-card text-xs font-semibold focus:outline-none focus:border-primary"
                  >
                    <option value="">-- Choose Branch --</option>
                    {orgData?.branches?.map(b => (
                      <option key={b._id} value={b._id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {(trackerType === 'RESIGNATION' || trackerType === 'EXIT') && (
            <div className="p-4 rounded-xl bg-muted border border-border space-y-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Offboarding Timeline & Interview</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input 
                  label="Last Working Day *" 
                  type="date"
                  value={resignationLastDay}
                  onChange={(e) => setResignationLastDay(e.target.value)}
                />
                <div className="flex flex-col justify-center space-y-2 pt-2">
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="noticeServed"
                      checked={resignationNoticeServed} 
                      onChange={(e) => setResignationNoticeServed(e.target.checked)}
                      className="rounded border-border bg-card text-primary focus:ring-primary"
                    />
                    <label htmlFor="noticeServed" className="text-xs font-bold text-foreground">Notice Period Served</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="exitInterview"
                      checked={resignationInterview} 
                      onChange={(e) => setResignationInterview(e.target.checked)}
                      className="rounded border-border bg-card text-primary focus:ring-primary"
                    />
                    <label htmlFor="exitInterview" className="text-xs font-bold text-foreground">Exit Interview Completed</label>
                  </div>
                </div>
              </div>
              <Textarea 
                label="Reason for Leaving / Details"
                placeholder="Reason for resignation, transition plan..."
                value={resignationReason}
                onChange={(e) => setResignationReason(e.target.value)}
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createTrackerMutation.isPending}>
              Trigger Process Flow
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
