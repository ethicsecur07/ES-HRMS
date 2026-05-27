import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index.js';
import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';

export const attendanceAccessControl = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { organizationId, id: userId, role, email } = req.user || {};
    if (!organizationId) {
      res.status(401).json({ message: 'Unauthorized. Organization context is missing.' });
      return;
    }

    let filter: any = {};

    if (role === 'EMPLOYEE') {
      const user = await User.findOne({ _id: userId, organizationId });
      let employeeId = user?.employeeId;
      if (!employeeId && email) {
        const emp = await Employee.findOne({ email, organizationId });
        employeeId = emp?._id;
      }

      if (!employeeId) {
        (req as any).attendanceFilter = { employeeId: new User()._id }; // Mock filter that matches nothing
        return next();
      }

      filter.employeeId = employeeId;
    } else if (role === 'MANAGER') {
      const { getManagerTeamEmployeeIds } = await import('../utils/getManagerTeamEmployeeIds.js');
      const teamEmployeeIds = await getManagerTeamEmployeeIds(userId!, organizationId);
      
      // Include the manager's own employee ID
      const user = await User.findOne({ _id: userId, organizationId });
      if (user && user.employeeId) {
        teamEmployeeIds.push(user.employeeId.toString());
      } else if (email) {
        const emp = await Employee.findOne({ email, organizationId });
        if (emp) teamEmployeeIds.push(emp._id.toString());
      }

      filter.employeeId = { $in: teamEmployeeIds };
    } else if (role === 'ADMIN' || role === 'HR') {
      // Full organization access
    }

    (req as any).attendanceFilter = filter;
    next();
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
