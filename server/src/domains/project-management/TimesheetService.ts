import { TimeLog } from '../../models/project-management/TimeLog.js';
import { Project } from '../../models/Project.js';
import { Types } from 'mongoose';

export class TimesheetService {
  /**
   * Aggregates billable hours for a specific project within a given month for invoicing.
   */
  public static async generateInvoicePayload(projectId: Types.ObjectId, yearMonth: string): Promise<any> {
    const project = await Project.findById(projectId);
    if (!project) throw new Error("Project not found");

    // yearMonth = 'YYYY-MM'
    const startDate = `${yearMonth}-01`;
    const endDate = `${yearMonth}-31`; // Simplified, MongoDB string matching works fine up to existing days

    const logs = await TimeLog.find({
      projectId,
      isBillable: true,
      date: { $gte: startDate, $lte: endDate }
    }).populate('employeeId', 'firstName lastName role designation');

    const aggregatedByEmployee: Record<string, { employeeName: string, totalHours: number }> = {};
    let grandTotalHours = 0;

    for (const log of logs) {
      const emp = log.employeeId as any;
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
