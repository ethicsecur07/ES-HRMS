import { Employee } from '../models/Employee.js';
import { Payroll } from '../models/Payroll.js';
import { logger } from '../utils/logger.js';

export const calculateMonthlyPayroll = async (month: string): Promise<any[]> => {
  try {
    const employees = await Employee.find({ isActive: true });
    const generatedPayrolls = [];

    for (const emp of employees) {
      // Basic calculation logic
      const baseSalary = emp.salary;
      const bonus = emp.department === 'BDE' ? 15000 : emp.department === 'DEV' ? 10000 : 5000;
      const deductions = emp.leaveBalance < 0 ? Math.abs(emp.leaveBalance) * (baseSalary / 30) : 0;
      const finalSalary = baseSalary + bonus - deductions;

      const payroll = await Payroll.findOneAndUpdate(
        { employeeId: emp._id, month },
        {
          baseSalary,
          bonus,
          deductions: Math.round(deductions),
          finalSalary: Math.round(finalSalary),
          paidStatus: 'PENDING',
        },
        { upsert: true, new: true }
      );

      generatedPayrolls.push(payroll);
    }

    logger.info(`Monthly payroll generated for ${month}`);
    return generatedPayrolls;
  } catch (error) {
    logger.error('Payroll generation failed', { error });
    throw error;
  }
};
