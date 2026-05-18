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
import { logger } from '../utils/logger.js';
import { ROLES, ATTENDANCE_TYPES, APPROVAL_STATUS, LEAVE_TYPES, DEPARTMENTS } from '../constants/index.js';

export const seedDatabase = async (): Promise<void> => {
  try {
    const userCount = await User.countDocuments();
    const employeeCount = await Employee.countDocuments();
    const financeCount = await Finance.countDocuments();

    if (userCount > 0 && employeeCount > 0 && financeCount > 0) {
      logger.info('Database already contains enterprise records. Skipping auto-seed.');
      return;
    }

    logger.info('🌱 Initializing Database Auto-Seeder with Enterprise Production Data...');

    // 1. Clean existing partial collections to avoid unique constraint conflicts
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
    ]);

    // 2. Seed Users
    const usersData = [
      { name: 'Alexander Wright', email: 'admin@ethicsec.com', password: 'EthicSec@2026', role: ROLES.ADMIN, isActive: true },
      { name: 'Sarah Jenkins', email: 'hr@ethicsec.com', password: 'EthicSec@2026', role: ROLES.HR, isActive: true },
      { name: 'Logapriyan M', email: 'logapriyan@ethicsec.com', password: 'EthicSec@2026', role: ROLES.EMPLOYEE, isActive: true },
      { name: 'Vikram Mehta', email: 'vikram@ethicsec.com', password: 'EthicSec@2026', role: ROLES.EMPLOYEE, isActive: true },
      { name: 'Ravi Kumar', email: 'ravi@ethicsec.com', password: 'EthicSec@2026', role: ROLES.EMPLOYEE, isActive: true },
      { name: 'Priya Sharma', email: 'priya@ethicsec.com', password: 'EthicSec@2026', role: ROLES.EMPLOYEE, isActive: true },
      { name: 'Anita Desai', email: 'anita@ethicsec.com', password: 'EthicSec@2026', role: ROLES.EMPLOYEE, isActive: true },
    ];

    const createdUsers = await User.insertMany(usersData);
    logger.info(`✅ Seeded ${createdUsers.length} Enterprise Users.`);

    // Map users for easy reference
    const userMap: Record<string, any> = {};
    createdUsers.forEach((u) => {
      userMap[u.email] = u;
    });

    // 3. Seed Departments
    const deptsData = [
      { name: 'Engineering & Development', code: DEPARTMENTS.DEV, headOfDepartment: 'Alexander Wright', isActive: true },
      { name: 'Product Design & UI/UX', code: DEPARTMENTS.DES, headOfDepartment: 'Sarah Jenkins', isActive: true },
      { name: 'Business Development & Sales', code: DEPARTMENTS.BDE, headOfDepartment: 'Priya Sharma', isActive: true },
      { name: 'Digital Marketing & Growth', code: DEPARTMENTS.DME, headOfDepartment: 'Anita Desai', isActive: true },
    ];

    await Department.insertMany(deptsData);
    logger.info('✅ Seeded Enterprise Departments.');

    // 4. Seed Employees
    const employeesData = [
      {
        _id: userMap['logapriyan@ethicsec.com']._id,
        employeeCode: 'EMP-001',
        fullName: 'Logapriyan M',
        email: 'logapriyan@ethicsec.com',
        phone: '+91 98765 43210',
        department: DEPARTMENTS.DEV,
        designation: 'Senior Full Stack Engineer',
        joiningDate: new Date('2024-01-15'),
        salary: 125000,
        address: 'Tech Park Avenue, Block C, Bengaluru',
        emergencyContact: { name: 'Murugan K', relationship: 'Father', phone: '+91 98765 12345' },
        leaveBalance: 2,
        wfhBalance: 1,
        permissionHoursBalance: 3,
        isActive: true,
      },
      {
        _id: userMap['vikram@ethicsec.com']._id,
        employeeCode: 'EMP-002',
        fullName: 'Vikram Mehta',
        email: 'vikram@ethicsec.com',
        phone: '+91 98765 43211',
        department: DEPARTMENTS.DEV,
        designation: 'Backend Architect & Security Specialist',
        joiningDate: new Date('2024-03-01'),
        salary: 140000,
        address: 'Cyber City, Phase 2, Gurugram',
        emergencyContact: { name: 'Aarti Mehta', relationship: 'Spouse', phone: '+91 98765 12346' },
        leaveBalance: 2,
        wfhBalance: 0,
        permissionHoursBalance: 2,
        isActive: true,
      },
      {
        _id: userMap['ravi@ethicsec.com']._id,
        employeeCode: 'EMP-003',
        fullName: 'Ravi Kumar',
        email: 'ravi@ethicsec.com',
        phone: '+91 98765 43212',
        department: DEPARTMENTS.DES,
        designation: 'Lead UI/UX Designer',
        joiningDate: new Date('2024-06-10'),
        salary: 95000,
        address: 'Jubilee Hills, Road No 10, Hyderabad',
        emergencyContact: { name: 'Sunita Kumar', relationship: 'Mother', phone: '+91 98765 12347' },
        leaveBalance: 1,
        wfhBalance: 1,
        permissionHoursBalance: 0,
        isActive: true,
      },
      {
        _id: userMap['priya@ethicsec.com']._id,
        employeeCode: 'EMP-004',
        fullName: 'Priya Sharma',
        email: 'priya@ethicsec.com',
        phone: '+91 98765 43213',
        department: DEPARTMENTS.BDE,
        designation: 'Enterprise Sales Manager',
        joiningDate: new Date('2025-01-05'),
        salary: 105000,
        address: 'Kalyani Nagar, Pune',
        emergencyContact: { name: 'Rajesh Sharma', relationship: 'Brother', phone: '+91 98765 12348' },
        leaveBalance: 2,
        wfhBalance: 1,
        permissionHoursBalance: 3,
        isActive: true,
      },
      {
        _id: userMap['anita@ethicsec.com']._id,
        employeeCode: 'EMP-005',
        fullName: 'Anita Desai',
        email: 'anita@ethicsec.com',
        phone: '+91 98765 43214',
        department: DEPARTMENTS.DME,
        designation: 'Growth Marketing Lead',
        joiningDate: new Date('2025-02-20'),
        salary: 90000,
        address: 'SG Highway, Ahmedabad',
        emergencyContact: { name: 'Suresh Desai', relationship: 'Father', phone: '+91 98765 12349' },
        leaveBalance: 2,
        wfhBalance: 1,
        permissionHoursBalance: 3,
        isActive: true,
      },
    ];

    const createdEmployees = await Employee.insertMany(employeesData);
    logger.info(`✅ Seeded ${createdEmployees.length} Enterprise Employees.`);

    // 5. Seed Attendance & Task Reports for past 5 days
    const attendanceRecords = [];
    const taskReports = [];
    const today = new Date();

    for (const emp of createdEmployees) {
      for (let i = 1; i <= 5; i++) {
        const dateObj = new Date(today);
        dateObj.setDate(today.getDate() - i);
        const dateStr = dateObj.toISOString().split('T')[0];

        // Decide status
        const isWfh = i === 2 && emp.employeeCode === 'EMP-001';
        const status = isWfh ? ATTENDANCE_TYPES.WFH : ATTENDANCE_TYPES.OFFICE;
        const loginTime = new Date(dateObj.setHours(9, Math.floor(Math.random() * 15), 0));
        const logoutTime = new Date(dateObj.setHours(18, Math.floor(Math.random() * 30), 0));

        const attId = new mongoose.Types.ObjectId();
        attendanceRecords.push({
          _id: attId,
          employeeId: emp._id,
          date: dateStr,
          loginTime,
          logoutTime,
          ipAddress: isWfh ? '122.175.34.89' : '192.168.1.50',
          deviceInfo: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          status,
          workingHours: 9.1,
          isLate: false,
          taskSubmitted: true,
          locationVerified: !isWfh,
          overrideReason: isWfh ? 'Approved WFH by HR Sarah for feature deployment' : undefined,
        });

        taskReports.push({
          employeeId: emp._id,
          date: dateStr,
          inProgressTasks: 'Refactoring attendance IP verification module & optimizing MongoDB aggregation queries.',
          completedTasks: 'Integrated real-time Socket.io notification broadcasts; resolved TypeScript verbatimModuleSyntax errors.',
          pendingTasks: 'E2E testing of payroll disbursement workflows.',
          blockers: 'None. All systems operational.',
          tomorrowPlan: 'Architecting biometric hardware sync endpoints.',
          submittedAt: logoutTime,
        });
      }
    }

    await Attendance.insertMany(attendanceRecords);
    await TaskReport.insertMany(taskReports);
    logger.info('✅ Seeded Attendance & Daily Task Reports.');

    // 6. Seed Leaves, WFH Requests & Permission Hours (Pending Queue items for HR)
    const leavesData = [
      {
        employeeId: userMap['logapriyan@ethicsec.com']._id,
        leaveType: LEAVE_TYPES.CASUAL,
        startDate: '2026-05-25',
        endDate: '2026-05-26',
        totalDays: 2,
        reason: 'Attending family function in hometown.',
        status: APPROVAL_STATUS.PENDING,
      },
      {
        employeeId: userMap['vikram@ethicsec.com']._id,
        leaveType: LEAVE_TYPES.WFH,
        startDate: '2026-05-20',
        endDate: '2026-05-20',
        totalDays: 1,
        reason: 'Dentist appointment in the morning; working remotely for the rest of the day.',
        status: APPROVAL_STATUS.PENDING,
        expectedTasks: 'API gateway rate limiting setup & security audit review.',
      },
    ];

    const permsData = [
      {
        employeeId: userMap['ravi@ethicsec.com']._id,
        date: '2026-05-19',
        startTime: '10:00',
        endTime: '12:00',
        totalHours: 2,
        reason: 'Bank loan document verification & signature.',
        approvalStatus: APPROVAL_STATUS.PENDING,
      },
    ];

    await Leave.insertMany(leavesData);
    await Permission.insertMany(permsData);
    logger.info('✅ Seeded HR Approval Queue Requests (Leave, WFH, Permission).');

    // 7. Seed Payroll for previous month
    const payrollsData = createdEmployees.map((emp) => {
      const baseSalary = emp.salary;
      const bonus = emp.employeeCode === 'EMP-001' ? 12500 : emp.employeeCode === 'EMP-002' ? 15000 : 5000;
      const deductions = 2500; // Professional tax & PF
      const finalSalary = baseSalary + bonus - deductions;

      return {
        employeeId: emp._id,
        month: '2026-04',
        baseSalary,
        bonus,
        deductions,
        finalSalary,
        paidStatus: 'PAID',
        paymentDate: new Date('2026-04-30'),
        payslipUrl: `https://ethicsec-hrms.s3.amazonaws.com/payslips/2026-04/${emp.employeeCode}.pdf`,
      };
    });

    await Payroll.insertMany(payrollsData);
    logger.info('✅ Seeded Monthly Payroll Records.');

    // 8. Seed Finance Budget & Expenses (MD Sir Budget Allocation vs HR Maintenance Expenses)
    const financeRecords = [
      {
        type: 'ALLOCATION',
        amount: 5000,
        categoryOrReason: 'Monthly Office Maintenance Budget',
        description: 'Allocated by MD Sir for May 2026 facilities & infrastructure upkeep.',
        date: '2026-05-01',
        loggedBy: 'Alexander Wright (ADMIN)',
      },
      {
        type: 'EXPENSE',
        amount: 1200,
        categoryOrReason: 'HVAC AC Servicing & High-Speed Fiber Internet Renewal',
        description: 'Scheduled quarterly maintenance of office air conditioning units and 1Gbps leased line renewal.',
        date: '2026-05-10',
        loggedBy: 'Sarah Jenkins (HR)',
      },
      {
        type: 'EXPENSE',
        amount: 450,
        categoryOrReason: 'Pantry Supplies & Premium Coffee Beans',
        description: 'Monthly restocking of employee cafeteria organic coffee and refreshments.',
        date: '2026-05-12',
        loggedBy: 'Sarah Jenkins (HR)',
      },
    ];

    await Finance.insertMany(financeRecords);
    logger.info('✅ Seeded Finance Budget Allocations & Maintenance Expenses.');

    logger.info('🚀 Database Seeding Completed Successfully! Enterprise HRMS is fully populated.');
  } catch (error) {
    logger.error('❌ Database Seeding Failed:', { error });
  }
};
