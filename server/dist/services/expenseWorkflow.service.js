"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processExpenseApproval = exports.initiateExpenseWorkflow = void 0;
const Expense_js_1 = require("../models/Expense.js");
const WorkflowTemplate_js_1 = require("../models/WorkflowTemplate.js");
const WorkflowInstance_js_1 = require("../models/WorkflowInstance.js");
const logger_js_1 = require("../utils/logger.js");
const initiateExpenseWorkflow = async (expenseId, organizationId) => {
    try {
        const expense = await Expense_js_1.Expense.findById(expenseId);
        if (!expense)
            throw new Error('Expense not found');
        // Find active template for expense
        const template = await WorkflowTemplate_js_1.WorkflowTemplate.findOne({
            organizationId,
            triggerEvent: 'EXPENSE_CLAIM',
            isActive: true,
            isPublished: true,
        });
        if (!template) {
            // If no workflow defined, auto approve or keep pending based on policy
            // For now, let's just keep it PENDING without a workflow
            logger_js_1.logger.info(`No workflow template found for EXPENSE_CLAIM org: ${organizationId}`);
            return;
        }
        const startNode = template.nodes.find(n => n.type === 'START');
        if (!startNode)
            throw new Error('Invalid workflow template: No START node');
        // For simplicity, we just move to the first node after START
        // This assumes simple linear workflow
        const firstNodeId = startNode.config?.nextNodes?.get?.('true') || startNode.config?.nextNodes?.get?.('default') || startNode.config?.nextNodes?.['true'] || startNode.config?.nextNodes?.['default'];
        const instance = await WorkflowInstance_js_1.WorkflowInstance.create({
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
    }
    catch (error) {
        logger_js_1.logger.error('Failed to initiate expense workflow', { error });
        throw error;
    }
};
exports.initiateExpenseWorkflow = initiateExpenseWorkflow;
const processExpenseApproval = async (instanceId, userId, action, comments) => {
    const instance = await WorkflowInstance_js_1.WorkflowInstance.findById(instanceId).populate('workflowTemplateId');
    if (!instance)
        throw new Error('Workflow instance not found');
    if (instance.status !== 'ACTIVE') {
        throw new Error('Workflow is not active');
    }
    const template = instance.workflowTemplateId;
    const currentNode = template.nodes.find((n) => n.id === instance.currentNodeId);
    if (!currentNode)
        throw new Error('Current node not found in template');
    // Add history log
    instance.history.push({
        nodeId: currentNode.id,
        nodeName: currentNode.name,
        approverUserId: userId,
        status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        comments,
        actionTakenAt: new Date()
    });
    if (action === 'REJECT') {
        instance.status = 'REJECTED';
        const expense = await Expense_js_1.Expense.findById(instance.refId);
        if (expense) {
            expense.status = 'REJECTED';
            await expense.save();
        }
    }
    else {
        // APPROVE
        let nextNodeId = null;
        if (currentNode.config && currentNode.config.nextNodes) {
            // Depending on how Map is returned, it could be a JS Map or object
            if (typeof currentNode.config.nextNodes.get === 'function') {
                nextNodeId = currentNode.config.nextNodes.get('true') || currentNode.config.nextNodes.get('default');
            }
            else {
                nextNodeId = currentNode.config.nextNodes['true'] || currentNode.config.nextNodes['default'];
            }
        }
        if (nextNodeId) {
            const nextNode = template.nodes.find((n) => n.id === nextNodeId);
            if (nextNode && nextNode.type === 'END') {
                instance.status = 'APPROVED';
                instance.currentNodeId = nextNode.id;
                const expense = await Expense_js_1.Expense.findById(instance.refId);
                if (expense) {
                    expense.status = 'APPROVED';
                    await expense.save();
                }
            }
            else {
                instance.currentNodeId = nextNodeId;
            }
        }
        else {
            // No next node, assume END
            instance.status = 'APPROVED';
            const expense = await Expense_js_1.Expense.findById(instance.refId);
            if (expense) {
                expense.status = 'APPROVED';
                await expense.save();
            }
        }
    }
    await instance.save();
};
exports.processExpenseApproval = processExpenseApproval;
