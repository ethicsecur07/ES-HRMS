"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Approval_js_1 = require("../models/Approval.js");
const Employee_js_1 = require("../models/Employee.js");
const User_js_1 = require("../models/User.js");
const Leave_js_1 = require("../models/Leave.js");
const auditLog_service_js_1 = require("./auditLog.service.js");
const socketHandler_js_1 = require("../sockets/socketHandler.js");
class WorkflowService {
    /**
     * Checks if an employee is on approved leave today.
     */
    static async isEmployeeOnLeave(employeeId, orgId) {
        const todayStr = new Date().toISOString().split('T')[0];
        const activeLeave = await Leave_js_1.Leave.findOne({
            organizationId: orgId,
            employeeId,
            status: 'APPROVED',
            startDate: { $lte: todayStr },
            endDate: { $gte: todayStr }
        });
        return !!activeLeave;
    }
    /**
     * Evaluates if a manager is available to approve.
     */
    static async isManagerAvailable(managerEmployeeId, orgId) {
        if (!managerEmployeeId)
            return false;
        // 1. Check if employee is active
        const emp = await Employee_js_1.Employee.findOne({ _id: managerEmployeeId, organizationId: orgId });
        if (!emp || !emp.isActive)
            return false;
        // 2. Check if manager is on leave today
        const onLeave = await this.isEmployeeOnLeave(managerEmployeeId, orgId);
        if (onLeave)
            return false;
        // 3. Check if they have an active login
        const user = await User_js_1.User.findOne({ employeeId: managerEmployeeId, organizationId: orgId });
        if (!user || !user.isActive || user.isBlocked)
            return false;
        return true;
    }
    /**
     * Evaluates if HR is available to approve. Returns active HR user IDs.
     */
    static async getAvailableHRs(orgId) {
        const hrUsers = await User_js_1.User.find({
            organizationId: orgId,
            role: 'HR',
            isActive: true,
            isBlocked: false
        });
        const availableHrUserIds = [];
        for (const hr of hrUsers) {
            if (hr.employeeId) {
                const onLeave = await this.isEmployeeOnLeave(hr.employeeId, orgId);
                if (!onLeave) {
                    availableHrUserIds.push(hr._id.toString());
                }
            }
            else {
                // No employee profile linked, assume available
                availableHrUserIds.push(hr._id.toString());
            }
        }
        return availableHrUserIds;
    }
    /**
     * Initiates the dynamic approval workflow chain for a request.
     */
    static async initiateApproval(orgId, refModel, refId, employeeId) {
        const workflowChain = [];
        const organizationId = new mongoose_1.default.Types.ObjectId(orgId.toString());
        // 1. Resolve manager step
        const employee = await Employee_js_1.Employee.findOne({ _id: employeeId, organizationId });
        let managerAvailable = false;
        let managerUserId = undefined;
        if (employee && employee.primaryManagerId) {
            const isAvailable = await this.isManagerAvailable(employee.primaryManagerId, organizationId);
            if (isAvailable) {
                const mUser = await User_js_1.User.findOne({ employeeId: employee.primaryManagerId, organizationId });
                if (mUser) {
                    managerAvailable = true;
                    managerUserId = mUser._id;
                    workflowChain.push({
                        roleCode: 'MANAGER',
                        status: 'PENDING',
                        actionById: managerUserId
                    });
                }
            }
        }
        // 2. Resolve HR step
        let hrAvailable = false;
        const availableHRs = await this.getAvailableHRs(organizationId);
        if (availableHRs.length > 0) {
            hrAvailable = true;
            workflowChain.push({
                roleCode: 'HR',
                status: managerAvailable ? 'PENDING' : 'PENDING' // Keep pending, we resolve step status sequentially
            });
        }
        // 3. Admin Fallback (Always append or use if neither is available)
        if (!managerAvailable && !hrAvailable) {
            workflowChain.push({
                roleCode: 'ADMIN',
                status: 'PENDING'
            });
        }
        else {
            // Admin is appended as final fallback step
            workflowChain.push({
                roleCode: 'ADMIN',
                status: 'PENDING'
            });
        }
        // Create the approval record
        const approval = new Approval_js_1.Approval({
            organizationId,
            refModel,
            refId,
            workflowChain,
            currentStepIndex: 0,
            finalStatus: 'PENDING'
        });
        await approval.save();
        // Log & notify initial step
        const firstStep = workflowChain[0];
        await (0, auditLog_service_js_1.createAuditLog)('WORKFLOW_INITIATE', 'System', 'WORKFLOW', approval.id, `Initiated approval workflow for ${refModel}. Current step: ${firstStep.roleCode}`, organizationId);
        // Emit live WebSocket notification to the pending role
        const io = (0, socketHandler_js_1.getIO)();
        if (io) {
            io.to(`org_${orgId}_role_${firstStep.roleCode}`).emit('receive_notification', {
                title: `Pending ${refModel} Request`,
                message: `A new ${refModel} request requires your approval.`,
                type: 'WORKFLOW',
                organizationId: orgId.toString()
            });
        }
        return approval;
    }
    /**
     * Processes a workflow step approval or rejection.
     */
    static async processStep(approvalId, userId, userRole, userEmail, action, comments) {
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        try {
            const approval = await Approval_js_1.Approval.findById(approvalId).session(session);
            if (!approval) {
                throw new Error('Approval workflow not found.');
            }
            if (approval.finalStatus !== 'PENDING') {
                throw new Error(`Workflow is already closed with status: ${approval.finalStatus}`);
            }
            const currentStep = approval.workflowChain[approval.currentStepIndex];
            // Validate that the user is allowed to act on this step
            // For Admin fallback or override, ADMIN can act on any step
            const isAuthorized = userRole === 'ADMIN' ||
                currentStep.roleCode === userRole ||
                (currentStep.roleCode === 'MANAGER' && currentStep.actionById?.toString() === userId);
            if (!isAuthorized) {
                throw new Error(`Not authorized to act on this step. Required: ${currentStep.roleCode}`);
            }
            // Perform update on the current step
            currentStep.status = action;
            currentStep.actionById = new mongoose_1.default.Types.ObjectId(userId);
            currentStep.actionDate = new Date();
            currentStep.comments = comments;
            const io = (0, socketHandler_js_1.getIO)();
            if (action === 'REJECTED') {
                approval.finalStatus = 'REJECTED';
                // Reject the underlying model document
                const refModel = mongoose_1.default.model(approval.refModel);
                await refModel.findOneAndUpdate({ _id: approval.refId, organizationId: approval.organizationId }, { status: 'REJECTED', rejectionReason: comments || 'Rejected by workflow' }).session(session);
                await (0, auditLog_service_js_1.createAuditLog)('WORKFLOW_REJECTED', userEmail, 'WORKFLOW', approval.id, `Workflow rejected by ${userRole}. comments: ${comments || 'none'}`, approval.organizationId);
            }
            else {
                // Step approved. Check if there are further steps in the chain
                const nextStepIndex = approval.currentStepIndex + 1;
                const hasNextStep = nextStepIndex < approval.workflowChain.length;
                // If next step is ADMIN fallback and we are already ADMIN, or HR approved and next is ADMIN fallback, we can complete
                const shouldAutoComplete = !hasNextStep ||
                    (hasNextStep && approval.workflowChain[nextStepIndex].roleCode === 'ADMIN' && (userRole === 'ADMIN' || userRole === 'HR'));
                if (shouldAutoComplete) {
                    approval.finalStatus = 'APPROVED';
                    // Complete/approve the underlying document
                    const refModel = mongoose_1.default.model(approval.refModel);
                    const doc = await refModel.findOne({ _id: approval.refId, organizationId: approval.organizationId }).session(session);
                    if (doc) {
                        doc.status = 'APPROVED';
                        await doc.save({ session });
                        // Restore balance or execute business logic if necessary (e.g. Leave balance already deducted, but for WFH or Permission we log it)
                        if (approval.refModel === 'Leave') {
                            const { LeaveBalanceService } = await import('../domains/leave-engine/services/LeaveBalanceService.js');
                            if (doc.leaveType !== 'WFH' && doc.leaveType !== 'Unpaid Leave') {
                                const balanceResult = await LeaveBalanceService.deductBalance(approval.organizationId.toString(), doc.employeeId.toString(), doc.leaveType, doc.totalDays, session);
                                if (!balanceResult) {
                                    throw new Error(`Insufficient leave balance to approve this request.`);
                                }
                            }
                        }
                    }
                    await (0, auditLog_service_js_1.createAuditLog)('WORKFLOW_APPROVED', userEmail, 'WORKFLOW', approval.id, `Workflow fully approved.`, approval.organizationId);
                }
                else {
                    // Advance to the next step
                    approval.currentStepIndex = nextStepIndex;
                    const nextStep = approval.workflowChain[nextStepIndex];
                    nextStep.status = 'PENDING';
                    await (0, auditLog_service_js_1.createAuditLog)('WORKFLOW_STEP_APPROVE', userEmail, 'WORKFLOW', approval.id, `Workflow step approved by ${userRole}. Advancing to ${nextStep.roleCode}`, approval.organizationId);
                    if (io) {
                        io.to(`org_${approval.organizationId}_role_${nextStep.roleCode}`).emit('receive_notification', {
                            title: `Pending Approval Step`,
                            message: `A ${approval.refModel} request has advanced and requires your review.`,
                            type: 'WORKFLOW',
                            organizationId: approval.organizationId.toString()
                        });
                    }
                }
            }
            await approval.save({ session });
            await session.commitTransaction();
            session.endSession();
            return approval;
        }
        catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    }
}
exports.WorkflowService = WorkflowService;
