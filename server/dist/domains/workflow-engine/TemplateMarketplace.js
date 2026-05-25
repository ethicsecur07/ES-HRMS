"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateMarketplace = void 0;
const WorkflowTemplate_js_1 = require("../../models/WorkflowTemplate.js");
const mongoose_1 = __importDefault(require("mongoose"));
class TemplateMarketplace {
    static getMarketplaceTemplates() {
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
    static async installTemplate(organizationId, templateCode) {
        const tpl = this.getMarketplaceTemplates().find(t => t.code === templateCode);
        if (!tpl)
            throw new Error("Template not found in marketplace");
        // Auto-compute next available version to avoid unique index conflict
        const latestVersion = await WorkflowTemplate_js_1.WorkflowTemplate.findOne({
            organizationId: new mongoose_1.default.Types.ObjectId(organizationId),
            triggerEvent: tpl.triggerEvent,
        }).sort({ version: -1 });
        const nextVersion = latestVersion ? latestVersion.version + 1 : 1;
        const newTemplate = new WorkflowTemplate_js_1.WorkflowTemplate({
            organizationId: new mongoose_1.default.Types.ObjectId(organizationId),
            name: tpl.name,
            triggerEvent: tpl.triggerEvent,
            nodes: tpl.nodes,
            version: nextVersion,
            isPublished: true,
            isActive: true,
        });
        await newTemplate.save();
        return newTemplate;
    }
}
exports.TemplateMarketplace = TemplateMarketplace;
