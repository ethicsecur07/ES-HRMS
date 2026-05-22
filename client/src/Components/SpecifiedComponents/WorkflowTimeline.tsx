import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowApi } from '../../api_service/workflowApi';
import { useAuthStore } from '../../store/useAuthStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { Card } from '../WrapperComponents/Card';
import { Button } from '../WrapperComponents/Button';
import { Textarea } from '../WrapperComponents/Input';
import { CheckCircle2, Circle, AlertCircle, Play, Check, X, ShieldAlert, Loader2 } from 'lucide-react';

interface WorkflowTimelineProps {
  instanceId: string;
  onActionComplete?: () => void;
}

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({ instanceId, onActionComplete }) => {
  const { role } = useAuthStore();
  const { addToast } = useNotificationStore();
  const queryClient = useQueryClient();

  const [comments, setComments] = useState('');

  // Fetch Workflow Instance
  const { data: instance, isLoading: isInstLoading } = useQuery({
    queryKey: ['workflowInstance', instanceId],
    queryFn: () => workflowApi.getInstance(instanceId),
    enabled: !!instanceId,
  });

  // Fetch all templates to find matching nodes
  const { data: templates, isLoading: isTemplatesLoading } = useQuery({
    queryKey: ['workflowTemplates'],
    queryFn: workflowApi.getTemplates,
    enabled: !!instance?.workflowTemplateId,
  });

  const matchingTemplate = templates?.find((t) => t._id === instance?.workflowTemplateId);

  const actMutation = useMutation({
    mutationFn: ({ action, comments }: { action: 'APPROVE' | 'REJECT' | 'SKIP'; comments?: string }) =>
      workflowApi.actOnNode(instanceId, action, comments),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workflowInstance', instanceId] });
      addToast('Workflow Processed', `Request successfully ${variables.action.toLowerCase()}ed at the current stage.`, 'success');
      setComments('');
      if (onActionComplete) onActionComplete();
    },
    onError: (error: any) => {
      addToast('Action Failed', error.message || 'Could not process workflow step.', 'error');
    },
  });

  if (isInstLoading || isTemplatesLoading) {
    return (
      <div className="flex items-center justify-center p-8 space-x-2">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider animate-pulse">Loading approval flow...</span>
      </div>
    );
  }

  if (!instance || !matchingTemplate) {
    return (
      <div className="p-6 text-center rounded-2xl border border-dashed border-border bg-muted/20">
        <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
        <p className="text-sm font-semibold text-foreground">Flow Template Mismatch</p>
        <p className="text-xs text-muted-foreground mt-1">This item is not currently linked to an active workflow path.</p>
      </div>
    );
  }

  // Evaluate nodes in sequential order
  const nodes = matchingTemplate.nodes || [];
  const currentNodeIndex = nodes.findIndex((n) => n.id === instance.currentNodeId);

  // Check if current user role matches the required role in active node configuration
  // Usually, node will have config containing { assignedRole: 'HR' } or similar
  const currentNode = nodes[currentNodeIndex];
  const requiredRole = currentNode?.config?.assignedRole || 'HR'; // fallback
  const isActor = role === 'ADMIN' || role === requiredRole;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
      {/* Stepper Steps UI */}
      <div className="md:col-span-2 space-y-6">
        <Card className="p-6 border border-border shadow-md bg-card">
          <h4 className="text-sm font-black text-foreground uppercase tracking-widest border-b border-border pb-3 mb-6">
            Approval Sequence Flow: <span className="text-primary font-mono">{matchingTemplate.name}</span>
          </h4>

          <div className="relative pl-6 space-y-8 border-l border-border ml-3.5">
            {nodes.map((node, index) => {
              const isPast = index < currentNodeIndex;
              const isActive = index === currentNodeIndex && instance.status === 'ACTIVE';

              let circleContent = <Circle className="w-5 h-5 text-muted-foreground bg-card" />;
              let textClass = 'text-muted-foreground font-medium';
              let descText = 'Pending preceding validations';
              let badgeColor = 'bg-muted text-muted-foreground border-border';

              if (isPast) {
                circleContent = (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center border border-primary text-white shadow-sm shadow-primary/20">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                );
                textClass = 'text-foreground font-semibold';
                descText = 'Step validation completed successfully';
                badgeColor = 'bg-primary/10 text-primary border-primary/20';
              } else if (isActive) {
                circleContent = (
                  <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center border border-indigo-600 text-white shadow-md animate-pulse">
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </div>
                );
                textClass = 'text-indigo-600 dark:text-indigo-400 font-extrabold';
                descText = `Currently waiting for action from role: ${node.config?.assignedRole || 'Approver'}`;
                badgeColor = 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
              } else if (instance.status === 'APPROVED' && index === nodes.length - 1) {
                circleContent = (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center border border-primary text-white shadow-sm shadow-primary/20">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                );
                textClass = 'text-primary font-black';
                descText = 'Workflow run successfully completed';
                badgeColor = 'bg-primary/10 text-primary border-primary/20';
              } else if (instance.status === 'REJECTED' && index === currentNodeIndex) {
                circleContent = (
                  <div className="w-5 h-5 rounded-full bg-destructive flex items-center justify-center border border-destructive text-white shadow-sm shadow-destructive/20">
                    <X className="w-3.5 h-3.5" />
                  </div>
                );
                textClass = 'text-destructive font-black';
                descText = 'Step rejected; request workflow terminated';
                badgeColor = 'bg-destructive/10 text-destructive border-destructive/20';
              }

              return (
                <div key={node.id} className="relative transition-all animate-in fade-in duration-300">
                  {/* Left Absolute Dot */}
                  <div className="absolute -left-[35px] top-1 z-10 flex items-center justify-center">
                    {circleContent}
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className={`text-sm ${textClass}`}>{node.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 font-medium leading-relaxed">
                        {descText}
                      </p>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${badgeColor}`}>
                      {node.type}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Control Actions Form Card */}
      <div className="space-y-6">
        {instance.status === 'ACTIVE' && isActor ? (
          <Card className="p-6 border-2 border-indigo-500/20 shadow-xl bg-card space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="border-b border-border pb-3">
              <h4 className="text-sm font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-indigo-500" /> Pending Action Panel
              </h4>
              <p className="text-[10px] text-muted-foreground mt-1">
                You are registered as an authorized reviewer for step: <strong>{currentNode?.label}</strong>. Select your decision state below.
              </p>
            </div>

            <div className="space-y-4">
              <Textarea
                label="Action Audit Comments"
                placeholder="Declare details, caveats, or feedback for this approval/rejection..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
              />

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  className="w-full bg-primary text-white font-black tracking-wider text-xs shadow-md"
                  onClick={() => actMutation.mutate({ action: 'APPROVE', comments })}
                  isLoading={actMutation.isPending && actMutation.variables?.action === 'APPROVE'}
                >
                  APPROVE STEP
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 border-destructive/30 hover:bg-destructive/10 text-destructive font-black tracking-wider text-xs"
                    onClick={() => actMutation.mutate({ action: 'REJECT', comments })}
                    isLoading={actMutation.isPending && actMutation.variables?.action === 'REJECT'}
                  >
                    REJECT REQUEST
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-border hover:bg-muted font-black tracking-wider text-xs text-muted-foreground"
                    onClick={() => actMutation.mutate({ action: 'SKIP', comments })}
                    isLoading={actMutation.isPending && actMutation.variables?.action === 'SKIP'}
                  >
                    SKIP STEP
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-6 border border-border shadow-md bg-card space-y-4 text-center">
            <CheckCircle2 className="w-10 h-10 text-muted-foreground/40 mx-auto opacity-50" />
            <div>
              <p className="text-xs font-bold text-foreground">Action Authorization Closed</p>
              <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                {instance.status !== 'ACTIVE'
                  ? `This workflow run is complete (Status: ${instance.status}).`
                  : `Waiting for ${requiredRole} clearances. You do not currently hold authorization for this step.`}
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
