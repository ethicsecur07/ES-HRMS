import { WorkflowTemplate, IWorkflowNode } from '../../models/WorkflowTemplate.js';
import mongoose from 'mongoose';

export class TemplateMarketplace {
  
  public static getMarketplaceTemplates() {
    return [
      {
        code: 'STD_LEAVE',
        name: 'Standard Leave Approval',
        triggerEvent: 'LEAVE_REQUEST',
        nodes: [
          { id: 'start-1', type: 'START', name: 'Submit Leave', config: { nextNodes: { 'true': 'cond-1' } } },
          { 
            id: 'cond-1', 
            type: 'CONDITION', 
            name: 'Leaves > 3 Days?', 
            config: { conditionField: 'leave_days', conditionOperator: 'GT', conditionValue: 3, nextNodes: { 'true': 'app-mgr', 'false': 'end-1' } } 
          },
          { 
            id: 'app-mgr', 
            type: 'APPROVAL', 
            name: 'Manager Approval', 
            config: { approverRole: 'MANAGER', slaHours: 48, timeoutAction: 'ESCALATE', escalationRole: 'HR', nextNodes: { 'true': 'end-1', 'false': 'end-1' } } 
          },
          { id: 'end-1', type: 'END', name: 'Finish', config: {} }
        ]
      },
      {
        code: 'EXPENSE_TIER',
        name: 'Multi-Tier Expense',
        triggerEvent: 'EXPENSE_CLAIM',
        nodes: [
          { id: 'start-1', type: 'START', name: 'Submit Claim', config: { nextNodes: { 'true': 'app-mgr' } } },
          { 
            id: 'app-mgr', 
            type: 'APPROVAL', 
            name: 'L1 Manager', 
            config: { approverRole: 'MANAGER', slaHours: 24, timeoutAction: 'AUTO_APPROVE', nextNodes: { 'true': 'cond-amount', 'false': 'end-reject' } } 
          },
          {
            id: 'cond-amount',
            type: 'CONDITION',
            name: 'Amount > $500?',
            config: { conditionField: 'amount', conditionOperator: 'GT', conditionValue: 500, nextNodes: { 'true': 'app-finance', 'false': 'end-approve' } }
          },
          {
            id: 'app-finance',
            type: 'APPROVAL',
            name: 'Finance Review',
            config: { approverRole: 'FINANCE', slaHours: 72, timeoutAction: 'ESCALATE', escalationRole: 'ADMIN', nextNodes: { 'true': 'end-approve', 'false': 'end-reject' } }
          },
          { id: 'end-approve', type: 'END', name: 'Approved', config: {} },
          { id: 'end-reject', type: 'END', name: 'Rejected', config: {} }
        ]
      }
    ];
  }

  public static async installTemplate(organizationId: string, templateCode: string) {
    const tpl = this.getMarketplaceTemplates().find(t => t.code === templateCode);
    if (!tpl) throw new Error("Template not found in marketplace");

    const newTemplate = new WorkflowTemplate({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      name: tpl.name,
      triggerEvent: tpl.triggerEvent,
      nodes: tpl.nodes,
      isActive: true
    });

    await newTemplate.save();
    return newTemplate;
  }
}
