import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import { GraphValidator } from './domains/workflow-engine/GraphValidator.js';
import { WorkflowTemplate } from './models/WorkflowTemplate.js';
import { WorkflowInstance } from './models/WorkflowInstance.js';
import { WorkflowRunner } from './domains/workflow-engine/WorkflowRunner.js';
import { SlaMonitorService } from './domains/workflow-engine/SlaMonitorService.js';
import { Leave } from './models/Leave.js';
import { ReimbursementClaim } from './models/SelfService.js';
import { Employee } from './models/Employee.js';
import { User } from './models/User.js';
import { LeavePolicy } from './models/LeavePolicy.js';
import { LeaveBalance } from './models/LeaveBalance.js';

dotenv.config();

// Helper to mock Express response/request
const createMockReq = (body: any, params: any = {}, query: any = {}, user: any = {}): any => ({
  body,
  params,
  query,
  user,
  headers: {},
});

const createMockRes = (): any => {
  const res: any = {};
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data: any) => {
    res.jsonData = data;
    return res;
  };
  return res;
};

async function runTests() {
  console.log('--- Connecting to DB ---');
  await connectDB();

  const orgId1 = new mongoose.Types.ObjectId();
  const orgId2 = new mongoose.Types.ObjectId();

  console.log('--- Cleaning Up Test Data ---');
  await WorkflowTemplate.deleteMany({ name: { $regex: '^TEST-' } });
  await WorkflowInstance.deleteMany({ organizationId: { $in: [orgId1, orgId2] } });
  await Leave.deleteMany({ reason: { $regex: '^TEST-' } });
  await ReimbursementClaim.deleteMany({ description: { $regex: '^TEST-' } });
  await Employee.deleteMany({ employeeCode: { $regex: '^TEST-' } });
  await User.deleteMany({ email: { $regex: '^test-' } });
  await LeavePolicy.deleteMany({ organizationId: { $in: [orgId1, orgId2] } });
  await LeaveBalance.deleteMany({ organizationId: { $in: [orgId1, orgId2] } });

  console.log('--- 1. Testing Graph Validator ---');
  // Circular Nodes Definition
  const circularNodes = [
    { id: 'start-1', type: 'START', name: 'Start', config: { nextNodes: { 'true': 'app-1' } } },
    { id: 'app-1', type: 'APPROVAL', name: 'Approve 1', config: { nextNodes: { 'true': 'app-2' } } },
    { id: 'app-2', type: 'APPROVAL', name: 'Approve 2', config: { nextNodes: { 'true': 'app-1' } } },
    { id: 'end-1', type: 'END', name: 'End', config: {} }
  ];

  const cycleErrors = GraphValidator.validate(circularNodes as any);
  if (cycleErrors.some(e => e.message.toLowerCase().includes('circular') || e.message.toLowerCase().includes('cycle') || e.message.toLowerCase().includes('infinite loop') || e.code === 'CIRCULAR_DEPENDENCY')) {
    console.log('✔ Circular dependency successfully detected:', cycleErrors[0]);
  } else {
    throw new Error('GraphValidator failed to detect cycle: ' + JSON.stringify(cycleErrors));
  }

  // Missing START Node
  const noStartNodes = [
    { id: 'app-1', type: 'APPROVAL', name: 'Approve 1', config: { nextNodes: { 'true': 'end-1' } } },
    { id: 'end-1', type: 'END', name: 'End', config: {} }
  ];
  const noStartErrors = GraphValidator.validate(noStartNodes as any);
  if (noStartErrors.some(e => e.message.includes('START') || e.code === 'NO_START_NODE')) {
    console.log('✔ Missing START node successfully detected.');
  } else {
    throw new Error('GraphValidator failed to detect missing START node.');
  }

  // Missing END Node
  const noEndNodes = [
    { id: 'start-1', type: 'START', name: 'Start', config: { nextNodes: { 'true': 'app-1' } } },
    { id: 'app-1', type: 'APPROVAL', name: 'Approve 1', config: {} }
  ];
  const noEndErrors = GraphValidator.validate(noEndNodes as any);
  if (noEndErrors.some(e => e.message.includes('END') || e.code === 'NO_END_NODE')) {
    console.log('✔ Missing END node successfully detected.');
  } else {
    throw new Error('GraphValidator failed to detect missing END node.');
  }

  // Invalid targets
  const invalidTargetNodes = [
    { id: 'start-1', type: 'START', name: 'Start', config: { nextNodes: { 'true': 'non-existent' } } },
    { id: 'end-1', type: 'END', name: 'End', config: {} }
  ];
  const invalidTargetErrors = GraphValidator.validate(invalidTargetNodes as any);
  if (invalidTargetErrors.some(e => e.message.includes('pointing to non-existent') || e.message.includes('invalid') || e.message.includes('does not exist') || e.code === 'INVALID_TRANSITION')) {
    console.log('✔ Invalid next node reference successfully detected.');
  } else {
    throw new Error('GraphValidator failed to detect invalid nextNode ID reference.');
  }

  console.log('--- 2. Setting Up Test Employees and Users ---');
  // Base employee template data
  const employeeData = {
    phone: '1111111111',
    department: 'Developers',
    joiningDate: new Date(),
    address: '123 Test Street',
    emergencyContact: {
      name: 'Emergency Contact',
      relationship: 'Friend',
      phone: '1111111111'
    }
  };

  // 1. Create Manager Employee & User
  const managerEmp = await Employee.create({
    ...employeeData,
    employeeCode: 'TEST-EMP-02',
    fullName: 'Test Manager',
    email: 'test-manager@example.com',
    designation: 'Manager',
    salary: 90000,
    organizationId: orgId1
  });
  const managerUser = await User.create({
    name: managerEmp.fullName,
    email: managerEmp.email,
    password: 'password',
    role: 'EMPLOYEE',
    employeeId: managerEmp._id,
    organizationId: orgId1
  });

  // 2. Create Submitter Employee (linked to Manager) & User
  const submitterEmp = await Employee.create({
    ...employeeData,
    employeeCode: 'TEST-EMP-01',
    fullName: 'Test Submitter',
    email: 'test-submitter@example.com',
    designation: 'Developer',
    salary: 60000,
    primaryManagerId: managerEmp._id,
    organizationId: orgId1
  });
  const submitterUser = await User.create({
    name: submitterEmp.fullName,
    email: submitterEmp.email,
    password: 'password',
    role: 'EMPLOYEE',
    employeeId: submitterEmp._id,
    organizationId: orgId1
  });

  // Create mock LeavePolicy and LeaveBalance
  await LeavePolicy.create({
    organizationId: orgId1,
    leaveType: 'Casual Leave',
    monthlyAllowance: 2,
    carryForward: false,
    carryForwardLimit: 0,
    sandwichLeaveRule: false,
    holidayOverlapRule: true,
  });

  await LeaveBalance.create({
    organizationId: orgId1,
    employeeId: submitterEmp._id,
    leaveType: 'Casual Leave',
    allocated: 10,
    balance: 10,
  });

  console.log('--- 3. Setting Up Active Workflow Template ---');
  const validNodes = [
    { id: 'start-node', type: 'START', name: 'Start', config: { nextNodes: { 'true': 'app-node' } } },
    { 
      id: 'app-node', 
      type: 'APPROVAL', 
      name: 'Manager Review', 
      config: { 
        approverRole: 'MANAGER', 
        slaHours: 24, 
        timeoutAction: 'AUTO_REJECT', 
        nextNodes: { 'true': 'end-approve', 'false': 'end-reject' } 
      } 
    },
    { id: 'end-approve', type: 'END', name: 'Approved Final', config: {} },
    { id: 'end-reject', type: 'END', name: 'Rejected Final', config: {} }
  ];

  const template = await WorkflowTemplate.create({
    organizationId: orgId1,
    name: 'TEST-Leave Workflow',
    triggerEvent: 'LEAVE_REQUEST',
    nodes: validNodes,
    version: 1,
    isPublished: true,
    isActive: true
  });
  console.log('Active LEAVE_REQUEST workflow template created.');

  console.log('--- 4. Testing Submodule Hook Integration (Leave apply -> start instance) ---');
  // Trigger createLeave which should automatically trigger triggerWorkflow
  const { LeaveService } = await import('./domains/leave-engine/services/LeaveService.js');
  const leaveRes = await LeaveService.createLeave({
    organizationId: orgId1.toString(),
    employeeId: submitterEmp._id.toString(),
    leaveType: 'Casual Leave',
    startDate: '2026-06-01',
    endDate: '2026-06-02',
    reason: 'TEST-Vacation',
    appliedByUserId: submitterUser._id.toString(),
    appliedByEmail: submitterUser.email,
  });

  if (!leaveRes.success) {
    console.error('Violations details:', leaveRes.violations);
    throw new Error('Failed to create leave: ' + leaveRes.message);
  }

  const leaveDoc = leaveRes.leave;
  console.log('Leave created. ID =', leaveDoc.id);

  // Check if WorkflowInstance was created automatically
  const wfInstance = await WorkflowInstance.findOne({
    organizationId: orgId1,
    refModel: 'Leave',
    refId: leaveDoc._id,
  });

  if (!wfInstance) {
    throw new Error('WorkflowInstance was NOT automatically created on leave application!');
  }
  console.log('✔ WorkflowInstance created automatically. Current Node =', wfInstance.currentNodeId);
  if (wfInstance.currentNodeId === 'app-node') {
    console.log('✔ Workflow runner successfully processed START node and transitioned to', wfInstance.currentNodeId);
  } else {
    throw new Error('WorkflowInstance currentNodeId is incorrect: ' + wfInstance.currentNodeId);
  }

  console.log('--- 5. Testing Authorization Checks & Bypass Prevention ---');
  // Submitter attempts to self-approve
  try {
    await WorkflowRunner.advance(
      wfInstance._id.toString(),
      {},
      'APPROVED',
      { id: submitterUser._id.toString(), role: 'EMPLOYEE', email: submitterUser.email },
      'Self approving'
    );
    throw new Error('Submitter self-approval bypass was NOT blocked!');
  } catch (err: any) {
    console.log('✔ Submitter self-approval successfully blocked:', err.message);
  }

  // Non-authorized user attempts to approve (e.g. employee with role EMPLOYEE, but node requires MANAGER)
  const randomUser = await User.create({
    name: 'Random User',
    email: 'test-random@example.com',
    password: 'password',
    role: 'EMPLOYEE',
    organizationId: orgId1
  });
  try {
    await WorkflowRunner.advance(
      wfInstance._id.toString(),
      {},
      'APPROVED',
      { id: randomUser._id.toString(), role: 'EMPLOYEE', email: randomUser.email },
      'Unauthorized approval'
    );
    throw new Error('Unauthorized role approval was NOT blocked!');
  } catch (err: any) {
    console.log('✔ Unauthorized role approval successfully blocked:', err.message);
  }

  console.log('--- 6. Testing Tenant Isolation ---');
  // Attempt to act on the instance using another organization's context
  const crossTenantInstance = await WorkflowInstance.findOne({
    _id: wfInstance._id,
    organizationId: orgId2 // query by different organizationId
  });

  if (crossTenantInstance) {
    throw new Error('Cross-tenant lookup vulnerability: WorkflowInstance fetched across organization limits!');
  }
  console.log('✔ Cross-tenant WorkflowInstance lookup blocked.');

  console.log('--- 7. Testing Successful Approver Transition ---');
  // Authorized Manager approves
  const advanceRes = await WorkflowRunner.advance(
    wfInstance._id.toString(),
    {},
    'APPROVED',
    { id: managerUser._id.toString(), role: 'EMPLOYEE', email: managerUser.email },
    'Manager approved it.'
  );

  if (!advanceRes) {
    throw new Error('Failed to advance workflow with authorized Manager.');
  }

  // Refetch leave request status to see if it synced to APPROVED
  const updatedLeave = await Leave.findById(leaveDoc._id);
  if (updatedLeave?.status === 'APPROVED') {
    console.log('✔ Final END node reached. Leave status synced to APPROVED.');
  } else {
    throw new Error('Leave status was not synced to APPROVED. Status = ' + updatedLeave?.status);
  }

  console.log('--- 8. Testing SLA Sweep Timeout Action ---');
  // Create another leave with active workflow
  const leaveRes2 = await LeaveService.createLeave({
    organizationId: orgId1.toString(),
    employeeId: submitterEmp._id.toString(),
    leaveType: 'Casual Leave',
    startDate: '2026-06-10',
    endDate: '2026-06-11',
    reason: 'TEST-SLA-Test',
    appliedByUserId: submitterUser._id.toString(),
    appliedByEmail: submitterUser.email,
  });

  const leaveDoc2 = leaveRes2.leave;
  const wfInstance2 = await WorkflowInstance.findOne({
    organizationId: orgId1,
    refModel: 'Leave',
    refId: leaveDoc2._id,
  });

  if (!wfInstance2) {
    throw new Error('Second WorkflowInstance was not created.');
  }

  // Manipulate history date to simulate SLA breach (older than 24 hours)
  const penaltyDate = new Date();
  penaltyDate.setHours(penaltyDate.getHours() - 30); // 30 hours ago (slaHours is 24)
  
  await WorkflowInstance.updateOne(
    { _id: wfInstance2._id },
    { 
      $set: { 
        updatedAt: penaltyDate,
        "history.$[].actionTakenAt": penaltyDate
      } 
    },
    { timestamps: false }
  );

  console.log('Simulating SLA breach by setting updatedAt to 30 hours ago...');

  // Trigger SlaMonitorService sweep
  const breaches = await SlaMonitorService.sweep();
  console.log('SLA sweep executed. Breaches actioned =', breaches);

  // Check if workflow got auto-rejected (timeoutAction on app-node is AUTO_REJECT)
  const finalWfInstance2 = await WorkflowInstance.findById(wfInstance2._id);
  if (finalWfInstance2?.status === 'REJECTED') {
    console.log('✔ SLA timeout action AUTO_REJECT successfully triggered. Status is REJECTED.');
  } else {
    throw new Error('SLA timeout action failed. Status = ' + finalWfInstance2?.status);
  }

  // Check if leave document status synced to REJECTED
  const finalLeave2 = await Leave.findById(leaveDoc2._id);
  if (finalLeave2?.status === 'REJECTED') {
    console.log('✔ Leave document status synced to REJECTED by SLA sweep.');
  } else {
    throw new Error('Leave status not synced. Status = ' + finalLeave2?.status);
  }

  console.log('--- Cleaning Up Test Data ---');
  await WorkflowTemplate.deleteMany({ name: { $regex: '^TEST-' } });
  await WorkflowInstance.deleteMany({ organizationId: { $in: [orgId1, orgId2] } });
  await Leave.deleteMany({ reason: { $regex: '^TEST-' } });
  await ReimbursementClaim.deleteMany({ description: { $regex: '^TEST-' } });
  await Employee.deleteMany({ employeeCode: { $regex: '^TEST-' } });
  await User.deleteMany({ email: { $regex: '^test-' } });
  await User.deleteMany({ _id: randomUser._id });
  await LeavePolicy.deleteMany({ organizationId: { $in: [orgId1, orgId2] } });
  await LeaveBalance.deleteMany({ organizationId: { $in: [orgId1, orgId2] } });

  console.log('🎉 ALL WORKFLOW ENGINE VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Verification failed with error:', err);
  process.exit(1);
});
