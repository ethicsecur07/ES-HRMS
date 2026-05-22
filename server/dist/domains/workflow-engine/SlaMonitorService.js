"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlaMonitorService = void 0;
const WorkflowInstance_js_1 = require("../../models/WorkflowInstance.js");
const WorkflowTemplate_js_1 = require("../../models/WorkflowTemplate.js");
const WorkflowRunner_js_1 = require("./WorkflowRunner.js");
const socketHandler_js_1 = require("../../sockets/socketHandler.js");
const logger_js_1 = require("../../utils/logger.js");
class SlaMonitorService {
    /**
     * Sweeps active instances for SLA breaches and processes timeouts/escalations.
     */
    static async sweep() {
        logger_js_1.logger.info('[SlaMonitorService] Running Workflow SLA Sweep...');
        // Find all active instances
        const activeInstances = await WorkflowInstance_js_1.WorkflowInstance.find({ status: 'ACTIVE' });
        let breachCount = 0;
        for (const instance of activeInstances) {
            try {
                const template = await WorkflowTemplate_js_1.WorkflowTemplate.findById(instance.workflowTemplateId);
                if (!template)
                    continue;
                const currentNode = template.nodes.find(n => n.id === instance.currentNodeId);
                if (currentNode?.type === 'APPROVAL' && currentNode.config?.slaHours) {
                    // Determine the timestamp when the node became active (last history entry or instance creation time)
                    // We parse dates safely using UTC milliseconds
                    const lastActionTime = instance.history.length > 0
                        ? instance.history[instance.history.length - 1].actionTakenAt || instance.updatedAt
                        : instance.createdAt;
                    const lastActionMs = new Date(lastActionTime).getTime();
                    const currentMs = Date.now();
                    const hoursElapsed = (currentMs - lastActionMs) / (1000 * 60 * 60);
                    logger_js_1.logger.info(`[SlaMonitorService Debug] Instance: ${instance._id}, lastActionTime: ${lastActionTime}, updatedAt: ${instance.updatedAt}, hoursElapsed: ${hoursElapsed}, slaHours: ${currentNode.config.slaHours}`);
                    if (hoursElapsed >= currentNode.config.slaHours) {
                        const timeoutAction = currentNode.config.timeoutAction;
                        breachCount++;
                        logger_js_1.logger.info(`[SlaMonitorService] SLA breached for instance ${instance._id} at node ${currentNode.id}. Action: ${timeoutAction}`);
                        // Real-time notification of SLA breach
                        const io = (0, socketHandler_js_1.getIO)();
                        if (io) {
                            const orgRoom = `${instance.organizationId}:WORKFLOW`;
                            io.to(orgRoom).emit('receive_notification', {
                                _id: `sla-breach-${instance._id}-${currentNode.id}`,
                                title: 'SLA Breach Warning',
                                message: `Workflow node "${currentNode.name}" has breached its SLA of ${currentNode.config.slaHours} hours.`,
                                type: 'WORKFLOW',
                                organizationId: instance.organizationId.toString()
                            });
                        }
                        if (timeoutAction === 'AUTO_APPROVE') {
                            // Auto-approve the node as system user
                            const systemUser = { id: '000000000000000000000000', role: 'ADMIN', email: 'system@antigravity.erp' };
                            await WorkflowRunner_js_1.WorkflowRunner.advance(instance._id.toString(), {}, 'APPROVED', systemUser, `SLA Auto-Approve: Node timed out after ${hoursElapsed.toFixed(1)} hours.`);
                        }
                        else if (timeoutAction === 'AUTO_REJECT') {
                            // Auto-reject the node as system user
                            const systemUser = { id: '000000000000000000000000', role: 'ADMIN', email: 'system@antigravity.erp' };
                            await WorkflowRunner_js_1.WorkflowRunner.advance(instance._id.toString(), {}, 'REJECTED', systemUser, `SLA Auto-Reject: Node timed out after ${hoursElapsed.toFixed(1)} hours.`);
                        }
                        else if (timeoutAction === 'ESCALATE') {
                            // Reassign the node's active log to the escalation role
                            const activeLog = instance.history.find(h => h.nodeId === currentNode.id && h.status === 'PENDING');
                            const escalationRole = currentNode.config.escalationRole || 'ADMIN';
                            if (activeLog) {
                                activeLog.comments = `ESCALATED: Reassigned to ${escalationRole} (SLA Breach). Original role: ${activeLog.approverRole}`;
                                activeLog.approverRole = escalationRole;
                                activeLog.actionTakenAt = new Date();
                            }
                            instance.history.push({
                                nodeId: currentNode.id,
                                nodeName: `${currentNode.name} (Escalated)`,
                                approverRole: escalationRole,
                                status: 'PENDING',
                                comments: `Escalated from original role due to SLA timeout.`
                            });
                            await instance.save();
                            logger_js_1.logger.info(`[SlaMonitorService] Reassigned instance ${instance._id} to ${escalationRole}.`);
                        }
                    }
                }
            }
            catch (err) {
                logger_js_1.logger.error(`[SlaMonitorService] SLA sweep failed for instance ${instance._id}`, err);
            }
        }
        logger_js_1.logger.info(`[SlaMonitorService] Workflow SLA Sweep finished. Breached instances: ${breachCount}`);
        return breachCount;
    }
}
exports.SlaMonitorService = SlaMonitorService;
