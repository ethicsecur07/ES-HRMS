import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationApi } from '../api_service/organizationApi';
import type { Branch, Division, BusinessUnit, CostCenter } from '../api_service/organizationApi';
import { useNotificationStore } from '../store/useNotificationStore';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
import { Input } from '../Components/WrapperComponents/Input';
import { Modal } from '../Components/WrapperComponents/Modal';
import { 
  MapPin, 
  Layers, 
  Briefcase, 
  DollarSign, 
  PlusCircle, 
  Edit, 
  Trash2
} from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

export const OrganizationPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useNotificationStore();

  // Navigation tabs
  const [entityTab, setEntityTab] = useState<'BRANCH' | 'DIVISION' | 'BUSINESS_UNIT' | 'COST_CENTER'>('BRANCH');

  // Modal states
  const [isEntityModalOpen, setIsEntityModalOpen] = useState(false);
  
  // Editing state
  const [editingEntity, setEditingEntity] = useState<{ id: string; type: typeof entityTab } | null>(null);

  // Form states - Entities
  const [branchName, setBranchName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchTimezone, setBranchTimezone] = useState('GMT+5:30');

  const [divisionName, setDivisionName] = useState('');
  const [divisionCode, setDivisionCode] = useState('');
  const [divisionBranchId, setDivisionBranchId] = useState('');

  const [buName, setBuName] = useState('');
  const [buCode, setBuCode] = useState('');
  const [buDivisionId, setBuDivisionId] = useState('');

  const [ccName, setCcName] = useState('');
  const [ccCode, setCcCode] = useState('');
  const [ccBudget, setCcBudget] = useState(0);

  // Queries
  const { data: orgData, isLoading: isOrgLoading } = useQuery({
    queryKey: ['orgStructure'],
    queryFn: () => organizationApi.getStructure(),
  });

  // Structural Mutations
  const createBranchMutation = useMutation({
    mutationFn: (data: any) => organizationApi.createBranch(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orgStructure'] });
      addToast('Branch Created', 'New corporate branch added.', 'success');
      setIsEntityModalOpen(false);
      resetEntityForm();
    },
    onError: (err: any) => addToast('Error', err.message || 'Action failed.', 'error')
  });

  const updateBranchMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => organizationApi.updateBranch(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orgStructure'] });
      addToast('Branch Updated', 'Branch settings updated.', 'success');
      setIsEntityModalOpen(false);
      resetEntityForm();
    },
    onError: (err: any) => addToast('Error', err.message || 'Action failed.', 'error')
  });

  const deleteBranchMutation = useMutation({
    mutationFn: (id: string) => organizationApi.deleteBranch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orgStructure'] });
      addToast('Branch Deleted', 'Branch removed successfully.', 'info');
    },
    onError: (err: any) => addToast('Error', err.message || 'Delete failed.', 'error')
  });

  const createDivisionMutation = useMutation({
    mutationFn: (data: any) => organizationApi.createDivision(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orgStructure'] });
      addToast('Division Created', 'New corporate division added.', 'success');
      setIsEntityModalOpen(false);
      resetEntityForm();
    },
    onError: (err: any) => addToast('Error', err.message || 'Action failed.', 'error')
  });

  const updateDivisionMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => organizationApi.updateDivision(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orgStructure'] });
      addToast('Division Updated', 'Division parameters updated.', 'success');
      setIsEntityModalOpen(false);
      resetEntityForm();
    },
    onError: (err: any) => addToast('Error', err.message || 'Action failed.', 'error')
  });

  const deleteDivisionMutation = useMutation({
    mutationFn: (id: string) => organizationApi.deleteDivision(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orgStructure'] });
      addToast('Division Deleted', 'Division deleted.', 'info');
    },
    onError: (err: any) => addToast('Error', err.message || 'Action failed.', 'error')
  });

  const createBUMutation = useMutation({
    mutationFn: (data: any) => organizationApi.createBusinessUnit(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orgStructure'] });
      addToast('Business Unit Added', 'Corporate unit established.', 'success');
      setIsEntityModalOpen(false);
      resetEntityForm();
    },
    onError: (err: any) => addToast('Error', err.message || 'Action failed.', 'error')
  });

  const updateBUMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => organizationApi.updateBusinessUnit(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orgStructure'] });
      addToast('Business Unit Updated', 'Unit parameters modified.', 'success');
      setIsEntityModalOpen(false);
      resetEntityForm();
    },
    onError: (err: any) => addToast('Error', err.message || 'Action failed.', 'error')
  });

  const deleteBUMutation = useMutation({
    mutationFn: (id: string) => organizationApi.deleteBusinessUnit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orgStructure'] });
      addToast('Business Unit Deleted', 'Unit removed.', 'info');
    },
    onError: (err: any) => addToast('Error', err.message || 'Action failed.', 'error')
  });

  const createCCMutation = useMutation({
    mutationFn: (data: any) => organizationApi.createCostCenter(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orgStructure'] });
      addToast('Cost Center Logged', 'Cost center initialized.', 'success');
      setIsEntityModalOpen(false);
      resetEntityForm();
    },
    onError: (err: any) => addToast('Error', err.message || 'Action failed.', 'error')
  });

  const updateCCMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => organizationApi.updateCostCenter(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orgStructure'] });
      addToast('Cost Center Updated', 'Cost center parameters updated.', 'success');
      setIsEntityModalOpen(false);
      resetEntityForm();
    },
    onError: (err: any) => addToast('Error', err.message || 'Action failed.', 'error')
  });

  const deleteCCMutation = useMutation({
    mutationFn: (id: string) => organizationApi.deleteCostCenter(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orgStructure'] });
      addToast('Cost Center Deleted', 'Cost center deleted.', 'info');
    },
    onError: (err: any) => addToast('Error', err.message || 'Action failed.', 'error')
  });

  const resetEntityForm = () => {
    setEditingEntity(null);
    setBranchName('');
    setBranchCode('');
    setBranchAddress('');
    setDivisionName('');
    setDivisionCode('');
    setDivisionBranchId('');
    setBuName('');
    setBuCode('');
    setBuDivisionId('');
    setCcName('');
    setCcCode('');
    setCcBudget(0);
  };

  const handleEditEntity = (entity: any, type: typeof entityTab) => {
    setEditingEntity({ id: entity._id, type });
    if (type === 'BRANCH') {
      const b = entity as Branch;
      setBranchName(b.name);
      setBranchCode(b.code);
      setBranchAddress(b.address || '');
      setBranchTimezone(b.timezone || 'GMT+5:30');
    } else if (type === 'DIVISION') {
      const d = entity as Division;
      setDivisionName(d.name);
      setDivisionCode(d.code);
      setDivisionBranchId(typeof d.branchId === 'object' ? d.branchId?._id : d.branchId || '');
    } else if (type === 'BUSINESS_UNIT') {
      const bu = entity as BusinessUnit;
      setBuName(bu.name);
      setBuCode(bu.code);
      setBuDivisionId(typeof bu.divisionId === 'object' ? bu.divisionId?._id : bu.divisionId || '');
    } else if (type === 'COST_CENTER') {
      const cc = entity as CostCenter;
      setCcName(cc.name);
      setCcCode(cc.code);
      setCcBudget(cc.budgetLimit || 0);
    }
    setIsEntityModalOpen(true);
  };

  const handleEntitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (entityTab === 'BRANCH') {
      const payload = { name: branchName, code: branchCode, address: branchAddress, timezone: branchTimezone };
      if (editingEntity) {
        updateBranchMutation.mutate({ id: editingEntity.id, data: payload });
      } else {
        createBranchMutation.mutate(payload);
      }
    } else if (entityTab === 'DIVISION') {
      const payload = { name: divisionName, code: divisionCode, branchId: divisionBranchId };
      if (editingEntity) {
        updateDivisionMutation.mutate({ id: editingEntity.id, data: payload });
      } else {
        createDivisionMutation.mutate(payload);
      }
    } else if (entityTab === 'BUSINESS_UNIT') {
      const payload = { name: buName, code: buCode, divisionId: buDivisionId };
      if (editingEntity) {
        updateBUMutation.mutate({ id: editingEntity.id, data: payload });
      } else {
        createBUMutation.mutate(payload);
      }
    } else if (entityTab === 'COST_CENTER') {
      const payload = { name: ccName, code: ccCode, budgetLimit: ccBudget };
      if (editingEntity) {
        updateCCMutation.mutate({ id: editingEntity.id, data: payload });
      } else {
        createCCMutation.mutate(payload);
      }
    }
  };



  return (
    <div className="space-y-6 text-left animate-in fade-in duration-300">
      
      {/* Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm backdrop-blur-md">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Organization Structure</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure enterprise physical divisions, structural branches, business entities, and cost centers.
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={() => setIsEntityModalOpen(true)} className="bg-primary text-white font-bold tracking-wider shadow-lg shadow-primary/20">
            <PlusCircle className="w-4 h-4 mr-1.5" />
            ADD {entityTab.replace('_', ' ')}
          </Button>
        </div>
      </div>

      {/* ENTITIES SUBVIEW */}
      <div className="space-y-6">
          {/* Sub-tabs for structural categories */}
          <div className="flex bg-muted/60 p-1.5 rounded-xl border border-border max-w-lg gap-1">
            {(['BRANCH', 'DIVISION', 'BUSINESS_UNIT', 'COST_CENTER'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setEntityTab(tab)}
                className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${
                  entityTab === tab 
                    ? 'bg-card text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.replace('_', ' ')}s
              </button>
            ))}
          </div>

          {isOrgLoading ? (
            <Card className="animate-pulse h-48 bg-muted/10 border-border"><div /></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* BRANCH RENDERING */}
              {entityTab === 'BRANCH' && (orgData?.branches?.length === 0 ? (
                <div className="col-span-full py-8 text-center text-xs text-muted-foreground">No branches found. Click 'Add Branch' to begin.</div>
              ) : orgData?.branches?.map(b => (
                <Card key={b._id} className="p-5 border-border bg-card relative hover:border-primary/20 transition-all flex flex-col justify-between h-40">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      <h4 className="font-bold text-sm text-foreground">{b.name}</h4>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded w-max border border-border/50 uppercase">{b.code}</p>
                    {b.address && <p className="text-xs text-muted-foreground line-clamp-1">{b.address}</p>}
                  </div>
                  <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
                    <button onClick={() => handleEditEntity(b, 'BRANCH')} className="text-muted-foreground hover:text-primary p-1 transition-colors"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => { if (window.confirm('Delete Branch?')) deleteBranchMutation.mutate(b._id); }} className="text-muted-foreground hover:text-destructive p-1 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </Card>
              )))}

              {/* DIVISION RENDERING */}
              {entityTab === 'DIVISION' && (orgData?.divisions?.length === 0 ? (
                <div className="col-span-full py-8 text-center text-xs text-muted-foreground">No divisions found.</div>
              ) : orgData?.divisions?.map(d => (
                <Card key={d._id} className="p-5 border-border bg-card hover:border-primary/20 transition-all flex flex-col justify-between h-40">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-500" />
                      <h4 className="font-bold text-sm text-foreground">{d.name}</h4>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      <span className="text-[10px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded border border-border/50 uppercase">{d.code}</span>
                      {d.branchId && (
                        <span className="text-[10px] text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10">
                          Branch: {typeof d.branchId === 'object' ? d.branchId.name : d.branchId}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
                    <button onClick={() => handleEditEntity(d, 'DIVISION')} className="text-muted-foreground hover:text-primary p-1 transition-colors"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => { if (window.confirm('Delete Division?')) deleteDivisionMutation.mutate(d._id); }} className="text-muted-foreground hover:text-destructive p-1 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </Card>
              )))}

              {/* BUSINESS UNIT RENDERING */}
              {entityTab === 'BUSINESS_UNIT' && (orgData?.businessUnits?.length === 0 ? (
                <div className="col-span-full py-8 text-center text-xs text-muted-foreground">No business units found.</div>
              ) : orgData?.businessUnits?.map(bu => (
                <Card key={bu._id} className="p-5 border-border bg-card hover:border-primary/20 transition-all flex flex-col justify-between h-40">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-pink-500" />
                      <h4 className="font-bold text-sm text-foreground">{bu.name}</h4>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      <span className="text-[10px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded border border-border/50 uppercase">{bu.code}</span>
                      {bu.divisionId && (
                        <span className="text-[10px] text-emerald-500 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">
                          Div: {typeof bu.divisionId === 'object' ? bu.divisionId.name : bu.divisionId}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
                    <button onClick={() => handleEditEntity(bu, 'BUSINESS_UNIT')} className="text-muted-foreground hover:text-primary p-1 transition-colors"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => { if (window.confirm('Delete Unit?')) deleteBUMutation.mutate(bu._id); }} className="text-muted-foreground hover:text-destructive p-1 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </Card>
              )))}

              {/* COST CENTER RENDERING */}
              {entityTab === 'COST_CENTER' && (orgData?.costCenters?.length === 0 ? (
                <div className="col-span-full py-8 text-center text-xs text-muted-foreground">No cost centers established.</div>
              ) : orgData?.costCenters?.map(cc => (
                <Card key={cc._id} className="p-5 border-border bg-card hover:border-primary/20 transition-all flex flex-col justify-between h-40">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-amber-500" />
                      <h4 className="font-bold text-sm text-foreground">{cc.name}</h4>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded w-max border border-border/50 uppercase">{cc.code}</p>
                    {cc.budgetLimit && (
                      <p className="text-xs text-muted-foreground">
                        Budget Limit: <strong className="text-primary font-mono">{formatCurrency(cc.budgetLimit)}</strong>
                      </p>
                    )}
                  </div>
                  <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
                    <button onClick={() => handleEditEntity(cc, 'COST_CENTER')} className="text-muted-foreground hover:text-primary p-1 transition-colors"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => { if (window.confirm('Delete Cost Center?')) deleteCCMutation.mutate(cc._id); }} className="text-muted-foreground hover:text-destructive p-1 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </Card>
              )))}

            </div>
          )}
        </div>

      {/* ENTITY CREATE/EDIT MODAL */}
      <Modal isOpen={isEntityModalOpen} onClose={() => setIsEntityModalOpen(false)} title={editingEntity ? `Edit ${entityTab.replace('_', ' ')}` : `Create ${entityTab.replace('_', ' ')}`} maxWidth="max-w-md">
        <form onSubmit={handleEntitySubmit} className="space-y-4 px-4 pb-4">
          
          {entityTab === 'BRANCH' && (
            <div className="space-y-4">
              <Input label="Branch Name *" required value={branchName} onChange={(e) => setBranchName(e.target.value)} placeholder="e.g. HQ Office" />
              <Input label="Branch Code *" required value={branchCode} onChange={(e) => setBranchCode(e.target.value)} placeholder="e.g. HQ-01" />
              <Input label="Address" value={branchAddress} onChange={(e) => setBranchAddress(e.target.value)} placeholder="Physical street location" />
              <Input label="Timezone" value={branchTimezone} onChange={(e) => setBranchTimezone(e.target.value)} placeholder="e.g. GMT+5:30" />
            </div>
          )}

          {entityTab === 'DIVISION' && (
            <div className="space-y-4">
              <Input label="Division Name *" required value={divisionName} onChange={(e) => setDivisionName(e.target.value)} placeholder="e.g. Engineering" />
              <Input label="Division Code *" required value={divisionCode} onChange={(e) => setDivisionCode(e.target.value)} placeholder="e.g. ENG-DIV" />
              
              {/* Branch Link */}
              <div className="flex flex-col">
                <label className="text-xs font-bold text-foreground mb-1">Parent Branch *</label>
                <select
                  required
                  value={divisionBranchId}
                  onChange={(e) => setDivisionBranchId(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-lg bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors disabled:opacity-50"
                >
                  <option value="">-- Choose Branch --</option>
                  {orgData?.branches?.map(b => (
                    <option key={b._id} value={b._id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {entityTab === 'BUSINESS_UNIT' && (
            <div className="space-y-4">
              <Input label="Business Unit Name *" required value={buName} onChange={(e) => setBuName(e.target.value)} placeholder="e.g. SaaS Solutions" />
              <Input label="Business Unit Code *" required value={buCode} onChange={(e) => setBuCode(e.target.value)} placeholder="e.g. BU-SAAS" />
              
              {/* Division Link */}
              <div className="flex flex-col">
                <label className="text-xs font-bold text-foreground mb-1">Parent Division *</label>
                <select
                  required
                  value={buDivisionId}
                  onChange={(e) => setBuDivisionId(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-lg bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors disabled:opacity-50"
                >
                  <option value="">-- Choose Division --</option>
                  {orgData?.divisions?.map(d => (
                    <option key={d._id} value={d._id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {entityTab === 'COST_CENTER' && (
            <div className="space-y-4">
              <Input label="Cost Center Name *" required value={ccName} onChange={(e) => setCcName(e.target.value)} placeholder="e.g. Marketing Global" />
              <Input label="Cost Center Code *" required value={ccCode} onChange={(e) => setCcCode(e.target.value)} placeholder="e.g. CC-MKT" />
              <Input label="Monthly Budget Limit (INR)" type="number" value={ccBudget || ''} onChange={(e) => setCcBudget(Number(e.target.value))} placeholder="e.g. 500000" />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" type="button" onClick={() => setIsEntityModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createBranchMutation.isPending || createDivisionMutation.isPending || createBUMutation.isPending || createCCMutation.isPending}>
              {editingEntity ? 'Save Changes' : 'Create Entity'}
            </Button>
          </div>
        </form>
      </Modal>



    </div>
  );
};
