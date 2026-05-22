"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimesheetService = void 0;
const TimeLog_js_1 = require("../../models/project-management/TimeLog.js");
const Project_js_1 = require("../../models/Project.js");
class TimesheetService {
    /**
     * Aggregates billable hours for a specific project within a given month for invoicing.
     */
    static async generateInvoicePayload(projectId, yearMonth) {
        const project = await Project_js_1.Project.findById(projectId);
        if (!project)
            throw new Error("Project not found");
        // yearMonth = 'YYYY-MM'
        const startDate = `${yearMonth}-01`;
        const endDate = `${yearMonth}-31`; // Simplified, MongoDB string matching works fine up to existing days
        const logs = await TimeLog_js_1.TimeLog.find({
            projectId,
            isBillable: true,
            date: { $gte: startDate, $lte: endDate }
        }).populate('employeeId', 'firstName lastName role designation');
        const aggregatedByEmployee = {};
        let grandTotalHours = 0;
        for (const log of logs) {
            const emp = log.employeeId;
            const empName = `${emp.firstName} ${emp.lastName}`;
            if (!aggregatedByEmployee[empName]) {
                aggregatedByEmployee[empName] = { employeeName: empName, totalHours: 0 };
            }
            aggregatedByEmployee[empName].totalHours += log.hoursLogged;
            grandTotalHours += log.hoursLogged;
        }
        return {
            projectId: project._id,
            projectName: project.name,
            clientName: project.clientName,
            billingCycle: yearMonth,
            totalBillableHours: grandTotalHours,
            breakdown: Object.values(aggregatedByEmployee)
        };
    }
}
exports.TimesheetService = TimesheetService;
