export type Role = 'ADMIN' | 'HR' | 'EMPLOYEE';
export type AttendanceType = 'OFFICE' | 'WFH' | 'HALF_DAY' | 'LEAVE';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type LeaveType = 'Casual Leave' | 'Sick Leave' | 'WFH' | 'Permission';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: Role;
  employeeId?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface Employee {
  _id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  phone: string;
  department: 'Developers' | 'Designers' | 'BDE' | 'DME';
  designation: string;
  joiningDate: string;
  profileImage?: string;
  salary: number;
  address: string;
  emergencyContact: EmergencyContact;
  leaveBalance: number; // monthly 2
  wfhBalance: number; // monthly 1
  permissionHoursBalance: number; // monthly 3
  isActive: boolean;
  userId?: string;
}

export interface Attendance {
  _id: string;
  employeeId: string | Employee;
  date: string; // YYYY-MM-DD
  loginTime: string;
  logoutTime?: string;
  ipAddress: string;
  deviceInfo: string;
  status: AttendanceType;
  workingHours?: number;
  isLate: boolean;
  taskSubmitted: boolean;
  locationVerified: boolean;
  overrideReason?: string;
}

export interface TaskReport {
  _id: string;
  employeeId: string | Employee;
  date: string;
  inProgressTasks: string;
  completedTasks: string;
  pendingTasks: string;
  blockers: string;
  tomorrowPlan: string;
  submittedAt: string;
}

export interface LeaveRequest {
  _id: string;
  employeeId: string | Employee;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: ApprovalStatus;
  appliedAt: string;
  approvedBy?: string;
  rejectionReason?: string;
  expectedTasks?: string; // For WFH
  permissionStartTime?: string; // For Permission
  permissionEndTime?: string; // For Permission
}

export interface Payroll {
  _id: string;
  employeeId: string | Employee;
  month: string; // YYYY-MM
  baseSalary: number;
  deductions: number;
  bonus: number;
  finalSalary: number;
  paidStatus: 'PAID' | 'PENDING' | 'PROCESSING';
  paymentDate?: string;
  payslipUrl?: string;
}

export interface AuditLog {
  _id: string;
  action: string;
  performedBy: string; // User ID / Name
  module: 'ATTENDANCE' | 'LEAVE' | 'WFH' | 'PAYROLL' | 'EMPLOYEE' | 'AUTH' | 'SETTINGS';
  timestamp: string;
  affectedRecord: string;
  details?: string;
}

export interface NotificationItem {
  _id: string;
  recipientId: string;
  title: string;
  message: string;
  type: 'LEAVE' | 'WFH' | 'ATTENDANCE' | 'PAYROLL' | 'ANNOUNCEMENT';
  read: boolean;
  createdAt: string;
}

export interface PermissionRequest {
  _id: string;
  employeeId: string | Employee;
  date: string;
  startTime: string;
  endTime: string;
  totalHours: number;
  reason: string;
  approvalStatus: ApprovalStatus;
  appliedAt: string;
  approvedBy?: string;
}

export interface CompanySettings {
  _id: string;
  officeWiFiIPs: string[];
  monthlyLeaveLimit: number;
  monthlyWFHLimit: number;
  monthlyPermissionHours: number;
  companyName: string;
  adminEmail: string;
}
