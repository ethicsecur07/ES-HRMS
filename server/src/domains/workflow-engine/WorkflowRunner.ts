import mongoose from 'mongoose';
import { WorkflowInstance, IApprovalLog } from '../../models/WorkflowInstance.js';
import { WorkflowTemplate } from '../../models/WorkflowTemplate.js';
import { ConditionEvaluator } from './ConditionEvaluator.js';
import { User } from '../../models/User.js';
import { Employee } from '../../models/Employee.js';
import { Leave } from '../../models/Leave.js';
import { WFHRequest } from '../../models/WFHRequest.js';
import { ReimbursementClaim, TaxDeclaration, AttendanceCorrectionRequest } from '../../models/SelfService.js';
import { LeaveBalanceService } from '../leave-engine/services/LeaveBalanceService.js';
import { getIO } from '../../sockets/socketHandler.js';
import { logger } from '../../utils/logger.js';

export class WorkflowRunner {

  /**
   * Programmatically trigger a workflow for a specific triggerEvent.
   * If an active template is found, it instantiates the workflow run and returns the workflow instance.
   * Otherwise returns null.
   */
  public static async triggerWorkflow(
    organizationId: string,
    triggerEvent: string,
    refModel: string,
    refId: string,
    session?: mongoose.ClientSession
  ): Promise<any> {
    const template = await WorkflowTemplate.findOne({
      organizationId,
      triggerEvent,
      isActive: true
    }).session(session || null);

    if (!template) {
      return null;
    }

    const startNode = template.nodes.find(n => n.type === 'START');
    if (!startNode) {
      throw new Error(`Workflow template for ${triggerEvent} does not have a START node.`);
    }

    // Create workflow instance
    const [instance] = await WorkflowInstance.create([
      {
        organizationId,
        workflowTemplateId: template._id,
        refModel,
        refId,
        currentNodeId: startNode.id,
        status: 'ACTIVE',
        history: [{
          nodeId: startNode.id,
          nodeName: startNode.name,
          status: 'APPROVED',
          actionTakenAt: new Date(),
          comments: 'Workflow initialized'
        }]
      }
    ], { session });

    // Advance runner to handle transitions and conditions
    await this.advance(instance.id, {}, undefined, undefined, undefined, session);

    return instance;
  }

  /**
   * Helper to build workflow context dynamically from reference documents.
   */
  public static async buildContext(instance: any, session?: mongoose.ClientSession): Promise<Record<string, any>> {
    const context: Record<string, any> = {};

    let refDoc: any = null;
    let employeeId: string | null = null;
    let submitterUserId: string | null = null;

    try {
      const RefModel = mongoose.model(instance.refModel);
      refDoc = await RefModel.findOne({ _id: instance.refId, organizationId: instance.organizationId }).session(session || null);
    } catch (err: any) {
      logger.error(`[WorkflowRunner] Failed to fetch refDoc: ${instance.refModel} / ${instance.refId}`, err);
    }

    if (!refDoc) {
      return context;
    }

    // Capture basic request data
    context.amount = refDoc.amount || 0;
    context.leave_days = refDoc.totalDays || 0;
    context.leaveType = refDoc.leaveType || '';
    context.category = refDoc.category || '';
    context.status = refDoc.status || 'PENDING';

    // Resolve employeeId & submitterUserId
    if (refDoc.employeeId) {
      employeeId = refDoc.employeeId.toString();
    }
    if (refDoc.submittedBy) {
      submitterUserId = refDoc.submittedBy.toString();
    }

    // Look up Employee
    let employeeDoc: any = null;
    if (employeeId) {
      employeeDoc = await Employee.findOne({ _id: employeeId, organizationId: instance.organizationId }).session(session || null);
    } else if (submitterUserId) {
      const user = await User.findOne({ _id: submitterUserId, organizationId: instance.organizationId }).session(session || null);
      if (user) {
        employeeDoc = await Employee.findOne({ email: user.email, organizationId: instance.organizationId }).session(session || null);
      }
    }

    if (employeeDoc) {
      context.department = employeeDoc.department;
      context.designation = employeeDoc.designation;
      context.salary = employeeDoc.salary;
      context.employee = {
        id: employeeDoc._id.toString(),
        fullName: employeeDoc.fullName,
        email: employeeDoc.email,
        department: employeeDoc.department,
        designation: employeeDoc.designation,
        salary: employeeDoc.salary
      };
    }

    // Look up Submitter User details
    let submitterUser: any = null;
    if (submitterUserId) {
      submitterUser = await User.findOne({ _id: submitterUserId, organizationId: instance.organizationId }).session(session || null);
    } else if (employeeDoc) {
      submitterUser = await User.findOne({ email: employeeDoc.email, organizationId: instance.organizationId }).session(session || null);
    }

    if (submitterUser) {
      context.role = submitterUser.role;
      context.user = {
        id: submitterUser._id.toString(),
        name: submitterUser.name,
        email: submitterUser.email,
        role: submitterUser.role
      };
    }

    return context;
  }

  /**
   * Sync reference document status and execute module-specific side-effects.
   */
  public static async syncReferenceDocument(
    instance: any, 
    status: 'APPROVED' | 'REJECTED', 
    actingUserId?: string,
    session?: mongoose.ClientSession
  ) {
    const RefModel = mongoose.model(instance.refModel);
    const refDoc = await RefModel.findOne({ _id: instance.refId, organizationId: instance.organizationId }).session(session || null);
    if (!refDoc) {
      logger.warn(`[WorkflowRunner] Reference doc not found for syncing: ${instance.refModel} (${instance.refId})`);
      return;
    }

    refDoc.status = status;
    if (actingUserId) {
      refDoc.approvedBy = new mongoose.Types.ObjectId(actingUserId);
    }

    if (status === 'APPROVED') {
      if (instance.refModel === 'Leave') {
        // Leave balance deductions (only for paid leaves, i.e., not WFH/Unpaid Leave)
        if (refDoc.leaveType !== 'WFH' && refDoc.leaveType !== 'Unpaid Leave') {
          const deducted = await LeaveBalanceService.deductBalance(
            instance.organizationId.toString(),
            refDoc.employeeId.toString(),
            refDoc.leaveType,
            refDoc.totalDays,
            session
          );
          if (!deducted) {
            throw new Error(`Insufficient leave balance to complete approval for '${refDoc.leaveType}' (${refDoc.totalDays} days).`);
          }
        } else if (refDoc.leaveType === 'WFH') {
          // WFH balance deductions if stored in the Leave model
          await LeaveBalanceService.deductBalance(
            instance.organizationId.toString(),
            refDoc.employeeId.toString(),
            'WFH',
            refDoc.totalDays,
            session
          );
        }
      } else if (instance.refModel === 'WFHRequest') {
        // WFH balance deductions
        await LeaveBalanceService.deductBalance(
          instance.organizationId.toString(),
          refDoc.employeeId.toString(),
          'WFH',
          refDoc.totalDays,
          session
        );
      } else if (instance.refModel === 'AttendanceCorrectionRequest') {
        // Apply correction to Attendance record
        const { Attendance } = await import('../../models/Attendance.js');
        await Attendance.findOneAndUpdate(
          {
            organizationId: instance.organizationId,
            employeeId: refDoc.employeeId,
            date: refDoc.attendanceDate
          },
          {
            loginTime: refDoc.requestedLoginTime,
            logoutTime: refDoc.requestedLogoutTime,
            status: 'OFFICE'
          },
          { session, upsert: true }
        );
      }
    }

    await refDoc.save({ session });
    logger.info(`[WorkflowRunner] Synced ${instance.refModel} (${instance.refId}) status to ${status}.`);
  }

  /**
   * Advances a workflow instance based on context and user actions.
   */
  public static async advance(
    instanceId: string, 
    contextOverride: Record<string, any>, 
    userAction?: 'APPROVED' | 'REJECTED',
    actingUser?: { id: string; role: string; email: string },
    comments?: string,
    session?: mongoose.ClientSession
  ) {
    // Acquire a state lock on the instance to prevent concurrent race conditions
    const instance = await WorkflowInstance.findOneAndUpdate(
      { _id: instanceId, status: 'ACTIVE' },
      { $set: { updatedAt: new Date() } },
      { session, new: true }
    );

    if (!instance) {
      logger.warn(`[WorkflowRunner] Workflow instance ${instanceId} is not active or does not exist.`);
      return null;
    }

    const template = await WorkflowTemplate.findById(instance.workflowTemplateId).session(session || null);
    if (!template) {
      throw new Error(`WorkflowTemplate not found: ${instance.workflowTemplateId}`);
    }

    // Retrieve or build full context
    const baseContext = await this.buildContext(instance, session);
    const context = { ...baseContext, ...contextOverride };

    let currentNode = template.nodes.find(n => n.id === instance.currentNodeId);
    let jumps = 0;

    while (currentNode && jumps < 50) {
      if (currentNode.type === 'END') {
        // Enforce dynamic outcome resolution based on END node naming/metadata
        const isRejection = currentNode.name.toLowerCase().includes('reject') || 
                            currentNode.config?.conditionValue === 'REJECTED';
        const finalStatus = isRejection ? 'REJECTED' : 'APPROVED';

        instance.status = finalStatus;
        instance.currentNodeId = currentNode.id;

        // Sync and save history log
        instance.history.push({
          nodeId: currentNode.id,
          nodeName: currentNode.name,
          status: isRejection ? 'REJECTED' : 'APPROVED',
          actionTakenAt: new Date(),
          comments: comments || `Workflow finished at ${currentNode.name}`
        });

        const lastApprover = instance.history
          .slice()
          .reverse()
          .find(h => h.status === 'APPROVED' || h.status === 'REJECTED')?.approverUserId?.toString();

        await this.syncReferenceDocument(instance, finalStatus, lastApprover, session);
        break;
      }

      if (currentNode.type === 'START') {
        const nextNodesObj = currentNode.config?.nextNodes;
        const nextNodeId = nextNodesObj instanceof Map 
          ? nextNodesObj.get('true')
          : nextNodesObj?.['true'];
        currentNode = template.nodes.find(n => n.id === nextNodeId);
        if (currentNode) instance.currentNodeId = currentNode.id;
        jumps++;
        continue;
      }

      if (currentNode.type === 'APPROVAL') {
        if (!userAction) {
          // Check if history already has a pending entry for this node, if not push it
          const alreadyPending = instance.history.some(h => h.nodeId === currentNode!.id && h.status === 'PENDING');
          if (!alreadyPending) {
            instance.history.push({
              nodeId: currentNode.id,
              nodeName: currentNode.name,
              approverRole: currentNode.config?.approverRole,
              status: 'PENDING',
            });
            await instance.save({ session });
          }
          break; // Wait for human interaction
        } else {
          // A user took action: validate authorization
          const { approverRole, approverUserId } = currentNode.config || {};
          
          if (!actingUser) {
            throw new Error('Authorization required: acting user details must be provided.');
          }

          // Enforce Ownership validation (prevent owner/creator from self-approving)
          const submitterId = context.user?.id || context.employee?.id;
          if (submitterId && submitterId === actingUser.id && actingUser.role !== 'ADMIN') {
            throw new Error('Approval bypass blocked: Submitter cannot approve their own request.');
          }

          // Enforce role-based/user-specific approval permissions
          let authorized = false;
          if (actingUser.role === 'ADMIN') {
            authorized = true; // Admin override
          } else if (approverUserId && approverUserId === actingUser.id) {
            authorized = true;
          } else if (approverRole && approverRole.toUpperCase() === actingUser.role.toUpperCase()) {
            authorized = true;
          } else if (approverRole && approverRole.toUpperCase() === 'MANAGER') {
            // Check if actingUser is the submitter's manager
            const submitterEmpId = context.employee?.id;
            if (submitterEmpId) {
              const submitterEmpDoc = await Employee.findById(submitterEmpId).session(session || null);
              if (submitterEmpDoc && submitterEmpDoc.primaryManagerId) {
                const actingUserDoc = await User.findById(actingUser.id).session(session || null);
                let actingEmployeeId = actingUserDoc?.employeeId;
                if (!actingEmployeeId && actingUser.email) {
                  const actingEmpDoc = await Employee.findOne({ email: actingUser.email, organizationId: instance.organizationId }).session(session || null);
                  actingEmployeeId = actingEmpDoc?._id;
                }
                if (actingEmployeeId && actingEmployeeId.toString() === submitterEmpDoc.primaryManagerId.toString()) {
                  authorized = true;
                }
              }
            }
          }

          if (!authorized) {
            throw new Error(`Unauthorized: This node requires action by ${approverRole || approverUserId}.`);
          }

          // Complete the active approval step in history
          const activeLog = instance.history.find(h => h.nodeId === currentNode!.id && h.status === 'PENDING');
          if (activeLog) {
            activeLog.status = userAction;
            activeLog.approverUserId = new mongoose.Types.ObjectId(actingUser.id);
            activeLog.approverRole = actingUser.role;
            activeLog.actionTakenAt = new Date();
            activeLog.comments = comments || `Actioned by ${actingUser.email}`;
          } else {
            instance.history.push({
              nodeId: currentNode.id,
              nodeName: currentNode.name,
              approverUserId: new mongoose.Types.ObjectId(actingUser.id),
              approverRole: actingUser.role,
              status: userAction,
              actionTakenAt: new Date(),
              comments: comments || `Actioned by ${actingUser.email}`
            });
          }

          // Transition to next node
          const outcomeKey = userAction === 'APPROVED' ? 'true' : 'false';
          const nextNodesObj = currentNode.config?.nextNodes;
          const nextNodeId = nextNodesObj instanceof Map
            ? nextNodesObj.get(outcomeKey)
            : nextNodesObj?.[outcomeKey];
          if (userAction === 'REJECTED' && !nextNodeId) {
            // Default rejection end behavior
            instance.status = 'REJECTED';
            await this.syncReferenceDocument(instance, 'REJECTED', actingUser.id, session);
            break;
          }

          currentNode = template.nodes.find(n => n.id === nextNodeId);
          userAction = undefined; // Consumed
          if (currentNode) instance.currentNodeId = currentNode.id;
          jumps++;
          continue;
        }
      }

      if (currentNode.type === 'CONDITION') {
        const { conditionField, conditionOperator, conditionValue, nextNodes } = currentNode.config || {};
        
        let result = false;
        if (conditionField && conditionOperator) {
          result = ConditionEvaluator.evaluate(context, conditionField, conditionOperator, conditionValue);
        }

        const nextNodeId = nextNodes instanceof Map 
          ? nextNodes.get(result ? 'true' : 'false')
          : nextNodes?.[result ? 'true' : 'false'];

        currentNode = template.nodes.find(n => n.id === nextNodeId);
        if (currentNode) instance.currentNodeId = currentNode.id;
        jumps++;
        continue;
      }

      if (currentNode.type === 'NOTIFICATION') {
        // Trigger socket notification event in real-time
        const io = getIO();
        if (io) {
          const orgRoom = `${instance.organizationId}:WORKFLOW`;
          io.to(orgRoom).emit('receive_notification', {
            _id: `workflow-notif-${instance._id}-${currentNode.id}`,
            title: `Workflow Node: ${currentNode.name}`,
            message: `Instance status is currently: ${instance.status}`,
            type: 'WORKFLOW',
            organizationId: instance.organizationId.toString()
          });
        }

        const nextNodeId = currentNode.config?.nextNodes instanceof Map
          ? (currentNode.config.nextNodes as Map<string, string>).get('true')
          : currentNode.config?.nextNodes?.['true'];

        currentNode = template.nodes.find(n => n.id === nextNodeId);
        if (currentNode) instance.currentNodeId = currentNode.id;
        jumps++;
        continue;
      }

      jumps++;
    }

    await instance.save({ session });
    return instance;
  }
}
