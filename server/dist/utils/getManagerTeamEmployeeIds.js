"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getManagerTeamEmployeeIds = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Employee_js_1 = require("../models/Employee.js");
const Project_js_1 = require("../models/Project.js");
const User_js_1 = require("../models/User.js");
/**
 * Resolves all employee IDs that report to or are managed by the given manager user ID.
 * Reports includes direct reports (employee.primaryManagerId = manager's employeeId)
 * and project members (employee belongs to projects where project.allocatedManagerId = managerUserId).
 */
const getManagerTeamEmployeeIds = async (managerUserId, organizationId) => {
    const employeeIds = [];
    const orgId = new mongoose_1.default.Types.ObjectId(organizationId.toString());
    // 1. Get Manager's Employee profile to find direct reports
    const managerUser = await User_js_1.User.findOne({ _id: managerUserId, organizationId: orgId });
    if (managerUser && managerUser.employeeId) {
        const directReports = await Employee_js_1.Employee.find({
            organizationId: orgId,
            primaryManagerId: managerUser.employeeId,
        }).select('_id');
        directReports.forEach(emp => {
            employeeIds.push(emp._id.toString());
        });
    }
    // 2. Get all projects where the manager is allocated
    const projects = await Project_js_1.Project.find({
        organizationId: orgId,
        allocatedManagerId: new mongoose_1.default.Types.ObjectId(managerUserId),
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
exports.getManagerTeamEmployeeIds = getManagerTeamEmployeeIds;
