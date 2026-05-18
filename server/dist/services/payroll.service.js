"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateMonthlyPayroll = void 0;
const Employee_js_1 = require("../models/Employee.js");
const Payroll_js_1 = require("../models/Payroll.js");
const logger_js_1 = require("../utils/logger.js");
const calculateMonthlyPayroll = async (month) => {
    try {
        const employees = await Employee_js_1.Employee.find({ isActive: true });
        const generatedPayrolls = [];
        for (const emp of employees) {
            // Basic calculation logic
            const baseSalary = emp.salary;
            const bonus = emp.department === 'BDE' ? 15000 : emp.department === 'DEV' ? 10000 : 5000;
            const deductions = emp.leaveBalance < 0 ? Math.abs(emp.leaveBalance) * (baseSalary / 30) : 0;
            const finalSalary = baseSalary + bonus - deductions;
            const payroll = await Payroll_js_1.Payroll.findOneAndUpdate({ employeeId: emp._id, month }, {
                baseSalary,
                bonus,
                deductions: Math.round(deductions),
                finalSalary: Math.round(finalSalary),
                paidStatus: 'PENDING',
            }, { upsert: true, new: true });
            generatedPayrolls.push(payroll);
        }
        logger_js_1.logger.info(`Monthly payroll generated for ${month}`);
        return generatedPayrolls;
    }
    catch (error) {
        logger_js_1.logger.error('Payroll generation failed', { error });
        throw error;
    }
};
exports.calculateMonthlyPayroll = calculateMonthlyPayroll;
