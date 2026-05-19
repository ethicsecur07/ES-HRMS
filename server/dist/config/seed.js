"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDatabase = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const User_js_1 = require("../models/User.js");
const Employee_js_1 = require("../models/Employee.js");
const Department_js_1 = require("../models/Department.js");
const Attendance_js_1 = require("../models/Attendance.js");
const Leave_js_1 = require("../models/Leave.js");
const Payroll_js_1 = require("../models/Payroll.js");
const Permission_js_1 = require("../models/Permission.js");
const TaskReport_js_1 = require("../models/TaskReport.js");
const Finance_js_1 = require("../models/Finance.js");
const AuditLog_js_1 = require("../models/AuditLog.js");
const logger_js_1 = require("../utils/logger.js");
const index_js_1 = require("../constants/index.js");
const seedDatabase = async () => {
    try {
        const adminExists = await User_js_1.User.findOne({ email: /official@ethicsecur\.co\.in/i });
        const empExists = await Employee_js_1.Employee.findOne({ email: 'logapriyan@ethicsec.com' });
        if (adminExists && empExists) {
            logger_js_1.logger.info('Database already contains enterprise records with permanent Admin, HR, and Employee. Skipping auto-seed.');
            return;
        }
        logger_js_1.logger.info('🌱 Initializing Database Auto-Seeder: Cleaning all collections and seeding permanent Admin, HR & Employee...');
        // 1. Clean all 10 collections permanently
        await Promise.all([
            User_js_1.User.deleteMany({}),
            Employee_js_1.Employee.deleteMany({}),
            Department_js_1.Department.deleteMany({}),
            Attendance_js_1.Attendance.deleteMany({}),
            Leave_js_1.Leave.deleteMany({}),
            Payroll_js_1.Payroll.deleteMany({}),
            Permission_js_1.Permission.deleteMany({}),
            TaskReport_js_1.TaskReport.deleteMany({}),
            Finance_js_1.Finance.deleteMany({}),
            AuditLog_js_1.AuditLog.deleteMany({}),
        ]);
        logger_js_1.logger.info('🗑️ Successfully deleted all legacy data across all collections.');
        const empId = new mongoose_1.default.Types.ObjectId('605c72ef1f77bcf86cd79001');
        // 2. Seed Permanent Enterprise Employee Record
        const empData = {
            _id: empId,
            employeeCode: 'DEV-001',
            fullName: 'Logapriyan M',
            email: 'logapriyan@ethicsec.com',
            phone: '+91 9876543210',
            department: index_js_1.DEPARTMENTS.DEV,
            designation: 'Full Stack Engineer',
            joiningDate: new Date('2026-01-15'),
            salary: 45000,
            address: 'Chennai, Tamil Nadu',
            emergencyContact: {
                name: 'Ravi M',
                relationship: 'Father',
                phone: '+91 9876543211',
            },
            leaveBalance: 2,
            wfhBalance: 1,
            permissionHoursBalance: 3,
            isActive: true,
        };
        await Employee_js_1.Employee.create(empData);
        logger_js_1.logger.info('✅ Seeded Permanent Enterprise Employee Record (Logapriyan M).');
        // 3. Seed Users (Abishek, Oviya & Logapriyan)
        const usersData = [
            { _id: new mongoose_1.default.Types.ObjectId('605c72ef1f77bcf86cd79101'), name: 'Abishek', email: 'Official@ethicsecur.co.in', password: 'Ethicsecur@2024', role: index_js_1.ROLES.ADMIN, isActive: true },
            { _id: new mongoose_1.default.Types.ObjectId('605c72ef1f77bcf86cd79202'), name: 'Oviya', email: 'oviya@ethicsecur.com', password: 'Ovi@2003', role: index_js_1.ROLES.HR, isActive: true },
            { _id: new mongoose_1.default.Types.ObjectId('605c72ef1f77bcf86cd79303'), name: 'Logapriyan M', email: 'logapriyan@ethicsec.com', password: 'EthicSec@2026', role: index_js_1.ROLES.EMPLOYEE, employeeId: empId, isActive: true },
        ];
        const createdUsers = await User_js_1.User.insertMany(usersData);
        logger_js_1.logger.info(`✅ Seeded ${createdUsers.length} Enterprise Users (Admin, HR & Employee).`);
        logger_js_1.logger.info('🚀 Database Seeding Completed Successfully! Enterprise HRMS is ready with clean state.');
    }
    catch (error) {
        logger_js_1.logger.error('❌ Database Seeding Failed:', { error });
    }
};
exports.seedDatabase = seedDatabase;
