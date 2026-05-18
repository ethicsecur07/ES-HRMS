import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';
import { Department } from '../models/Department.js';
import { Attendance } from '../models/Attendance.js';
import { Leave } from '../models/Leave.js';
import { Payroll } from '../models/Payroll.js';
import { Permission } from '../models/Permission.js';
import { TaskReport } from '../models/TaskReport.js';
import { Finance } from '../models/Finance.js';
import { AuditLog } from '../models/AuditLog.js';
import { logger } from '../utils/logger.js';
import { ROLES, DEPARTMENTS } from '../constants/index.js';

export const seedDatabase = async (): Promise<void> => {
  try {
    const adminExists = await User.findOne({ email: /official@ethicsecur\.co\.in/i });
    const empExists = await Employee.findOne({ email: 'logapriyan@ethicsec.com' });

    if (adminExists && empExists) {
      logger.info('Database already contains enterprise records with permanent Admin, HR, and Employee. Skipping auto-seed.');
      return;
    }

    logger.info('🌱 Initializing Database Auto-Seeder: Cleaning all collections and seeding permanent Admin, HR & Employee...');

    // 1. Clean all 10 collections permanently
    await Promise.all([
      User.deleteMany({}),
      Employee.deleteMany({}),
      Department.deleteMany({}),
      Attendance.deleteMany({}),
      Leave.deleteMany({}),
      Payroll.deleteMany({}),
      Permission.deleteMany({}),
      TaskReport.deleteMany({}),
      Finance.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);

    logger.info('🗑️ Successfully deleted all legacy data across all collections.');

    const empId = new mongoose.Types.ObjectId('605c72ef1f77bcf86cd79001');

    // 2. Seed Permanent Enterprise Employee Record
    const empData = {
      _id: empId,
      employeeCode: 'DEV-001',
      fullName: 'Logapriyan M',
      email: 'logapriyan@ethicsec.com',
      phone: '+91 9876543210',
      department: DEPARTMENTS.DEV,
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

    await Employee.create(empData);
    logger.info('✅ Seeded Permanent Enterprise Employee Record (Logapriyan M).');

    // 3. Seed Users (Abishek, Oviya & Logapriyan)
    const usersData = [
      { _id: new mongoose.Types.ObjectId('605c72ef1f77bcf86cd79101'), name: 'Abishek', email: 'Official@ethicsecur.co.in', password: 'Ethicsecur@2024', role: ROLES.ADMIN, isActive: true },
      { _id: new mongoose.Types.ObjectId('605c72ef1f77bcf86cd79202'), name: 'Oviya', email: 'oviya@ethicsecur.com', password: 'Ovi@2003', role: ROLES.HR, isActive: true },
      { _id: new mongoose.Types.ObjectId('605c72ef1f77bcf86cd79303'), name: 'Logapriyan M', email: 'logapriyan@ethicsec.com', password: 'EthicSec@2026', role: ROLES.EMPLOYEE, employeeId: empId, isActive: true },
    ];

    const createdUsers = await User.insertMany(usersData);
    logger.info(`✅ Seeded ${createdUsers.length} Enterprise Users (Admin, HR & Employee).`);

    logger.info('🚀 Database Seeding Completed Successfully! Enterprise HRMS is ready with clean state.');
  } catch (error) {
    logger.error('❌ Database Seeding Failed:', { error });
  }
};
