import mongoose from 'mongoose';
import { Employee } from '../models/Employee.js';
import { Project } from '../models/Project.js';
import { User } from '../models/User.js';

/**
 * Resolves all employee IDs that report to or are managed by the given manager user ID.
 * Reports includes direct reports (employee.primaryManagerId = manager's employeeId)
 * and project members (employee belongs to projects where project.allocatedManagerId = managerUserId).
 */
export const getManagerTeamEmployeeIds = async (managerUserId: string, organizationId: any): Promise<string[]> => {
  const employeeIds: string[] = [];
  
  const orgId = new mongoose.Types.ObjectId(organizationId.toString());

  // 1. Get Manager's Employee profile to find direct reports
  const managerUser = await User.findOne({ _id: managerUserId, organizationId: orgId });
  if (managerUser && managerUser.employeeId) {
    const directReports = await Employee.find({
      organizationId: orgId,
      primaryManagerId: managerUser.employeeId,
    }).select('_id');
    directReports.forEach(emp => {
      employeeIds.push(emp._id.toString());
    });
  }

  // 2. Get all projects where the manager is allocated
  const projects = await Project.find({
    organizationId: orgId,
    allocatedManagerId: new mongoose.Types.ObjectId(managerUserId),
  }).select('teamMemberIds');
  
  projects.forEach(proj => {
    if (proj.teamMemberIds && Array.isArray(proj.teamMemberIds)) {
      proj.teamMemberIds.forEach(id => {
        const idStr = id.toString();
        if (!employeeIds.includes(idStr)) {
          employeeIds.push(idStr);
        }
      });
    }
  });

  return employeeIds;
};
