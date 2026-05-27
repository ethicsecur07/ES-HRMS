"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attendanceAccessControl = void 0;
const User_js_1 = require("../models/User.js");
const Employee_js_1 = require("../models/Employee.js");
const attendanceAccessControl = async (req, res, next) => {
    try {
        const { organizationId, id: userId, role, email } = req.user || {};
        if (!organizationId) {
            res.status(401).json({ message: 'Unauthorized. Organization context is missing.' });
            return;
        }
        let filter = {};
        if (role === 'EMPLOYEE') {
            const user = await User_js_1.User.findOne({ _id: userId, organizationId });
            let employeeId = user?.employeeId;
            if (!employeeId && email) {
                const emp = await Employee_js_1.Employee.findOne({ email, organizationId });
                employeeId = emp?._id;
            }
            if (!employeeId) {
                req.attendanceFilter = { employeeId: new User_js_1.User()._id }; // Mock filter that matches nothing
                return next();
            }
            filter.employeeId = employeeId;
        }
        else if (role === 'MANAGER') {
            const { getManagerTeamEmployeeIds } = await import('../utils/getManagerTeamEmployeeIds.js');
            const teamEmployeeIds = await getManagerTeamEmployeeIds(userId, organizationId);
            // Include the manager's own employee ID
            const user = await User_js_1.User.findOne({ _id: userId, organizationId });
            if (user && user.employeeId) {
                teamEmployeeIds.push(user.employeeId.toString());
            }
            else if (email) {
                const emp = await Employee_js_1.Employee.findOne({ email, organizationId });
                if (emp)
                    teamEmployeeIds.push(emp._id.toString());
            }
            filter.employeeId = { $in: teamEmployeeIds };
        }
        else if (role === 'ADMIN' || role === 'HR') {
            // Full organization access
        }
        req.attendanceFilter = filter;
        next();
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.attendanceAccessControl = attendanceAccessControl;
