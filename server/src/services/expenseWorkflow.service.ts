import { Expense } from '../models/Expense.js';
import { WorkflowTemplate } from '../models/WorkflowTemplate.js';
import { WorkflowInstance } from '../models/WorkflowInstance.js';
import { logger } from '../utils/logger.js';

export const initiateExpenseWorkflow = async (expenseId: string, organizationId: string): Promise<void> => {
  try {
    const expense = await Expense.findById(expenseId);
    if (!expense) throw new Error('Expense not found');

    // Find active template for expense
    const template = await WorkflowTemplate.findOne({
      organizationId,
      triggerEvent: 'EXPENSE_CLAIM',
      isActive: true,
      isPublished: true,
    });

    if (!template) {
      // If no workflow defined, auto approve or keep pending based on policy
      // For now, let's just keep it PENDING without a workflow
      logger.info(`No workflow template found for EXPENSE_CLAIM org: ${organizationId}`);
      return;
    }

    const startNode = template.nodes.find(n => n.type === 'START');
    if (!startNode) throw new Error('Invalid workflow template: No START node');

    // For simplicity, we just move to the first node after START
    // This assumes simple linear workflow
    const firstNodeId = (startNode.config?.nextNodes as any)?.get?.('true') || (startNode.config?.nextNodes as any)?.get?.('default') || (startNode.config?.nextNodes as any)?.['true'] || (startNode.config?.nextNodes as any)?.['default'];
    
    const instance = await WorkflowInstance.create({
      organizationId,
      workflowTemplateId: template._id,
      refModel: 'Expense',
      refId: expense._id,
      currentNodeId: firstNodeId || startNode.id,
      status: 'ACTIVE',
      history: [{
        nodeId: startNode.id,
        nodeName: startNode.name,
        status: 'APPROVED',
        comments: 'Workflow initiated',
        actionTakenAt: new Date()
      }]
    });

    expense.workflowInstanceId = instance._id;
    await expense.save();

  } catch (error) {
    logger.error('Failed to initiate expense workflow', { error });
    throw error;
  }
};

export const processExpenseApproval = async (
  instanceId: string, 
  userId: string, 
  action: 'APPROVE' | 'REJECT', 
  comments?: string
): Promise<void> => {
  const instance = await WorkflowInstance.findById(instanceId).populate('workflowTemplateId');
  if (!instance) throw new Error('Workflow instance not found');

  if (instance.status !== 'ACTIVE') {
    throw new Error('Workflow is not active');
  }

  const template: any = instance.workflowTemplateId;
  const currentNode = template.nodes.find((n: any) => n.id === instance.currentNodeId);

  if (!currentNode) throw new Error('Current node not found in template');

  // Add history log
  instance.history.push({
    nodeId: currentNode.id,
    nodeName: currentNode.name,
    approverUserId: userId as any,
    status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
    comments,
    actionTakenAt: new Date()
  });

  if (action === 'REJECT') {
    instance.status = 'REJECTED';
    const expense = await Expense.findById(instance.refId);
    if (expense) {
      expense.status = 'REJECTED';
      await expense.save();
    }
  } else {
    // APPROVE
    let nextNodeId = null;
    if (currentNode.config && currentNode.config.nextNodes) {
      // Depending on how Map is returned, it could be a JS Map or object
      if (typeof currentNode.config.nextNodes.get === 'function') {
        nextNodeId = currentNode.config.nextNodes.get('true') || currentNode.config.nextNodes.get('default');
      } else {
        nextNodeId = currentNode.config.nextNodes['true'] || currentNode.config.nextNodes['default'];
      }
    }
    
    if (nextNodeId) {
      const nextNode = template.nodes.find((n: any) => n.id === nextNodeId);
      if (nextNode && nextNode.type === 'END') {
        instance.status = 'APPROVED';
        instance.currentNodeId = nextNode.id;
        
        const expense = await Expense.findById(instance.refId);
        if (expense) {
          expense.status = 'APPROVED';
          await expense.save();
        }
      } else {
        instance.currentNodeId = nextNodeId;
      }
    } else {
      // No next node, assume END
      instance.status = 'APPROVED';
      const expense = await Expense.findById(instance.refId);
      if (expense) {
        expense.status = 'APPROVED';
        await expense.save();
      }
    }
  }

  await instance.save();
};
