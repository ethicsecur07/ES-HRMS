export type Role = 'ADMIN' | 'MANAGER' | 'HR' | 'TEAM_LEAD' | 'EMPLOYEE';
export type AttendanceType = 'OFFICE' | 'WFH' | 'HALF_DAY' | 'LEAVE';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type LeaveType = 'Casual Leave' | 'Sick Leave' | 'WFH' | 'Permission';

export interface User {
  _id: string;
  organizationId?: string;
  name: string;
  email: string;
  profileImage?: string;
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

export interface BankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  ifscCode: string;
  branchName: string;
}

export interface TaxDetails {
  panNumber: string;
  taxRegime: 'OLD' | 'NEW' | '';
}

export interface Department {
  _id: string;
  organizationId?: string;
  name: string;
  code: string;
  headOfDepartment?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Designation {
  _id: string;
  organizationId?: string;
  departmentId: string | Department;
  name: string;
  code: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Employee {
  _id: string;
  organizationId?: string;
  employeeCode: string;
  fullName: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  departmentId?: string | Department;
  designationId?: string | Designation;
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
  bankDetails?: BankDetails;
  taxDetails?: TaxDetails;
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
  overtime?: { isApproved: boolean };
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
  isHalfDay?: boolean;
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
  type: 'LEAVE' | 'WFH' | 'ATTENDANCE' | 'PAYROLL' | 'ANNOUNCEMENT' | 'PERMISSION' | 'GENERAL' | 'TASK' | 'APPROVAL' | 'CHAT';
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

export type RecruitmentStage = 'NEW' | 'SCREENING' | 'INTERVIEW' | 'TECHNICAL' | 'HR' | 'OFFER' | 'HIRED';

export interface Candidate {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  resumeUrl?: string;
  appliedRole: string;
  stage: RecruitmentStage;
  interviewSchedule?: {
    date: string;
    interviewer: string;
  };
  offerDetails?: {
    salaryOffered: number;
    offerLetterUrl?: string;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  };
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  _id: string;
  senderId: string;
  receiverId: string;
  content: string;
  read: boolean;
  createdAt: string;
}
