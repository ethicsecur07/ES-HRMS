import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GitBranch, PackagePlus, PlayCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { workflowApi, type WorkflowInstance, type WorkflowTemplate } from '../api_service/workflowApi';
import { Button } from '../Components/WrapperComponents/Button';
import { Card } from '../Components/WrapperComponents/Card';
import { Input, Select, Textarea } from '../Components/WrapperComponents/Input';
import { TableWrapper } from '../Components/WrapperComponents/TableWrapper';
import { useNotificationStore } from '../store/useNotificationStore';

const triggerOptions = [
  { value: 'LEAVE_REQUEST', label: 'Leave Request' },
  { value: 'WFH_REQUEST', label: 'WFH Request' },
  { value: 'PERMISSION_REQUEST', label: 'Permission Request' },
  { value: 'EXPENSE_CLAIM', label: 'Expense Claim' },
  { value: 'MANUAL', label: 'Manual' },
];

const buildApprovalTemplate = (approverRole: string) => [
  { id: 'start-1', type: 'START', name: 'Submitted', config: { nextNodes: { true: 'approval-1' } } },
  {
    id: 'approval-1',
    type: 'APPROVAL',
    name: `${approverRole} Approval`,
    config: {
      approverRole,
      slaHours: 48,
      timeoutAction: 'ESCALATE',
      escalationRole: 'HR',
      nextNodes: { true: 'end-approve', false: 'end-reject' },
    },
  },
  { id: 'end-approve', type: 'END', name: 'Approved', config: {} },
  { id: 'end-reject', type: 'END', name: 'Rejected', config: {} },
];

export const WorkflowPage: React.FC = () => {
  const { addToast } = useNotificationStore();
  const queryClient = useQueryClient();
  const [templateName, setTemplateName] = useState('');
  const [triggerEvent, setTriggerEvent] = useState('LEAVE_REQUEST');
  const [approverRole, setApproverRole] = useState('HR');
  const [selectedInstance, setSelectedInstance] = useState<WorkflowInstance | null>(null);
  const [comments, setComments] = useState('');

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['workflowTemplates'],
    queryFn: workflowApi.getTemplates,
  });

  const { data: instancesData, isLoading: instancesLoading } = useQuery({
    queryKey: ['workflowInstances'],
    queryFn: workflowApi.getInstances,
  });

  const { data: marketplace = [] } = useQuery({
    queryKey: ['workflowMarketplace'],
    queryFn: workflowApi.getMarketplace,
  });

  const instances = instancesData?.instances || [];

  const activeTemplates = useMemo(
    () => templates.filter((template) => template.isActive || template.isPublished).length,
    [templates]
  );

  const createTemplateMutation = useMutation({
    mutationFn: () =>
      workflowApi.createTemplate({
        name: templateName.trim(),
        triggerEvent,
        nodes: buildApprovalTemplate(approverRole),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflowTemplates'] });
      setTemplateName('');
      addToast('Workflow Created', 'Approval template draft created successfully.', 'success');
    },
    onError: (error: any) => addToast('Workflow Error', error.response?.data?.message || error.message || 'Template creation failed.', 'error'),
  });

  const publishMutation = useMutation({
    mutationFn: workflowApi.publishTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflowTemplates'] });
      addToast('Workflow Published', 'Template is now active for matching requests.', 'success');
    },
    onError: (error: any) => addToast('Publish Failed', error.response?.data?.message || error.message || 'Template publish failed.', 'error'),
  });

  const installMutation = useMutation({
    mutationFn: workflowApi.installMarketplaceTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflowTemplates'] });
      addToast('Template Installed', 'Marketplace workflow added to your tenant.', 'success');
    },
    onError: (error: any) => addToast('Install Failed', error.response?.data?.message || error.message || 'Marketplace install failed.', 'error'),
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'APPROVE' | 'REJECT' }) =>
      workflowApi.actOnNode(id, action, comments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflowInstances'] });
      setSelectedInstance(null);
      setComments('');
      addToast('Workflow Updated', 'Approval action processed.', 'success');
    },
    onError: (error: any) => addToast('Action Failed', error.response?.data?.message || error.message || 'Could not process workflow action.', 'error'),
  });

  const templateColumns = [
    { header: 'Template', accessor: (row: WorkflowTemplate) => <span className="font-bold text-foreground">{row.name}</span> },
    { header: 'Trigger', accessor: 'triggerEvent', className: 'font-mono text-xs' },
    { header: 'Version', accessor: (row: WorkflowTemplate) => <span className="font-mono text-xs">v{row.version || 1}</span> },
    {
      header: 'State',
      accessor: (row: WorkflowTemplate) => (
        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase border ${row.isPublished ? 'bg-primary/10 text-primary border-primary/20' : 'bg-muted text-muted-foreground border-border'}`}>
          {row.isPublished ? 'Published' : 'Draft'}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: (row: WorkflowTemplate) => (
        <Button size="sm" variant="outline" onClick={() => publishMutation.mutate(row._id)} disabled={row.isPublished}>
          <ShieldCheck className="w-4 h-4 mr-1" /> Publish
        </Button>
      ),
    },
  ];

  const instanceColumns = [
    {
      header: 'Workflow',
      accessor: (row: WorkflowInstance) => {
        const template = typeof row.workflowTemplateId === 'object' ? row.workflowTemplateId.name : row.workflowTemplateId;
        return <span className="font-bold text-foreground">{template}</span>;
      },
    },
    { header: 'Reference', accessor: (row: WorkflowInstance) => <span className="font-mono text-xs">{row.refModel} / {row.refId}</span> },
    {
      header: 'Status',
      accessor: (row: WorkflowInstance) => (
        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase border ${row.status === 'ACTIVE' ? 'bg-foreground/10 text-foreground border-border' : row.status === 'APPROVED' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-destructive/10 text-destructive border-destructive/20'}`}>
          {row.status}
        </span>
      ),
    },
    { header: 'Updated', accessor: (row: WorkflowInstance) => <span className="font-mono text-xs">{new Date(row.updatedAt || row.createdAt).toLocaleString()}</span> },
    {
      header: 'Actions',
      accessor: (row: WorkflowInstance) => (
        <Button size="sm" variant="outline" onClick={() => setSelectedInstance(row)} disabled={row.status !== 'ACTIVE'}>
          <PlayCircle className="w-4 h-4 mr-1" /> Review
        </Button>
      ),
    },
  ];

  const handleCreateTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim()) {
      addToast('Name Required', 'Enter a workflow template name.', 'error');
      return;
    }
    createTemplateMutation.mutate();
  };

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-primary" />
            Workflow Approval Engine
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeTemplates} active templates and {instances.filter((item) => item.status === 'ACTIVE').length} running approvals
          </p>
        </div>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['workflowInstances'] })}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="space-y-5">
          <h3 className="text-lg font-black text-foreground flex items-center gap-2 border-b border-border pb-3">
            <PackagePlus className="w-5 h-5 text-primary" /> New Template
          </h3>
          <form onSubmit={handleCreateTemplate} className="space-y-4">
            <Input label="Template Name *" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
            <Select label="Trigger Event" value={triggerEvent} onChange={(e) => setTriggerEvent(e.target.value)} options={triggerOptions} />
            <Select
              label="Approver Role"
              value={approverRole}
              onChange={(e) => setApproverRole(e.target.value)}
              options={[
                { value: 'MANAGER', label: 'Manager' },
                { value: 'HR', label: 'HR' },
                { value: 'ADMIN', label: 'Admin' },
                { value: 'FINANCE', label: 'Finance' },
              ]}
            />
            <Button type="submit" className="w-full" isLoading={createTemplateMutation.isPending}>
              Create Draft
            </Button>
          </form>

          {marketplace.length > 0 && (
            <div className="pt-4 border-t border-border space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Marketplace</h4>
              {marketplace.map((template) => (
                <div key={template.code || template.name} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/40 border border-border">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{template.name}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{template.triggerEvent}</p>
                  </div>
                  {template.code && (
                    <Button size="sm" variant="outline" onClick={() => installMutation.mutate(template.code as string)} isLoading={installMutation.isPending}>
                      Install
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="xl:col-span-2 space-y-4">
          <h3 className="text-lg font-black text-foreground border-b border-border pb-3">Templates</h3>
          {templatesLoading ? (
            <div className="h-48 rounded-xl bg-muted/30 animate-pulse" />
          ) : (
            <TableWrapper columns={templateColumns} data={templates} rowsPerPage={6} emptyMessage="No workflow templates found." />
          )}
        </Card>
      </div>

      <Card className="space-y-4">
        <h3 className="text-lg font-black text-foreground border-b border-border pb-3">Running Instances</h3>
        {instancesLoading ? (
          <div className="h-48 rounded-xl bg-muted/30 animate-pulse" />
        ) : (
          <TableWrapper columns={instanceColumns} data={instances} rowsPerPage={8} emptyMessage="No workflow instances found." />
        )}
      </Card>

      {selectedInstance && (
        <Card className="fixed bottom-6 right-6 z-50 w-[min(420px,calc(100vw-2rem))] shadow-2xl border-primary/30 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-foreground">Approval Action</h3>
              <p className="text-xs text-muted-foreground font-mono">{selectedInstance.refModel} / {selectedInstance.refId}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSelectedInstance(null)}>Close</Button>
          </div>
          <Textarea label="Comments" value={comments} onChange={(e) => setComments(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => actionMutation.mutate({ id: selectedInstance._id, action: 'REJECT' })} isLoading={actionMutation.isPending}>
              Reject
            </Button>
            <Button onClick={() => actionMutation.mutate({ id: selectedInstance._id, action: 'APPROVE' })} isLoading={actionMutation.isPending}>
              Approve
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
