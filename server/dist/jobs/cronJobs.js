"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initCronJobs = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const Attendance_js_1 = require("../models/Attendance.js");
const Employee_js_1 = require("../models/Employee.js");
const logger_js_1 = require("../utils/logger.js");
const initCronJobs = () => {
    // Auto-checkout active attendances at midnight if employee forgot
    node_cron_1.default.schedule('0 0 * * *', async () => {
        try {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const dateStr = yesterday.toISOString().split('T')[0];
            const unclosed = await Attendance_js_1.Attendance.find({ date: dateStr, logoutTime: { $exists: false } });
            for (const att of unclosed) {
                att.logoutTime = new Date(`${dateStr}T20:00:00.000Z`); // Auto close at 8 PM
                att.workingHours = 9;
                await att.save();
            }
            logger_js_1.logger.info(`Cron: Auto-checked out ${unclosed.length} attendance records for ${dateStr}`);
        }
        catch (error) {
            logger_js_1.logger.error('Cron auto-checkout failed', { error });
        }
    });
    // Monthly leave balance reset on 1st of every month
    node_cron_1.default.schedule('0 0 1 * *', async () => {
        try {
            await Employee_js_1.Employee.updateMany({ isActive: true }, { leaveBalance: 2, wfhBalance: 1, permissionHoursBalance: 3 });
            logger_js_1.logger.info('Cron: Monthly leave, WFH, and permission balances reset successfully');
        }
        catch (error) {
            logger_js_1.logger.error('Cron monthly reset failed', { error });
        }
    });
};
exports.initCronJobs = initCronJobs;
