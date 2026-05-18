export const ROLES = {
  ADMIN: 'ADMIN',
  HR: 'HR',
  EMPLOYEE: 'EMPLOYEE',
} as const;

export const ATTENDANCE_TYPES = {
  OFFICE: 'OFFICE',
  WFH: 'WFH',
  HALF_DAY: 'HALF_DAY',
  LEAVE: 'LEAVE',
} as const;

export const APPROVAL_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export const LEAVE_TYPES = {
  CASUAL: 'Casual Leave',
  SICK: 'Sick Leave',
  WFH: 'WFH',
  PERMISSION: 'Permission',
} as const;

export const DEPARTMENTS = {
  DEV: 'Developers',
  DES: 'Designers',
  BDE: 'BDE',
  DME: 'DME',
} as const;
