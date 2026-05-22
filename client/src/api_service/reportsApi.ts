import axiosInstance from './axiosInstance';

export const reportsApi = {
  getAttendanceReport: async () => {
    const res = await axiosInstance.get('/reports/attendance');
    return res.data.report;
  },
  getPayrollReport: async () => {
    const res = await axiosInstance.get('/reports/payroll');
    return res.data.report;
  },
  getPerformanceReport: async () => {
    const res = await axiosInstance.get('/reports/performance');
    return res.data.report;
  },
  getExpenseReport: async () => {
    const res = await axiosInstance.get('/reports/expenses');
    return res.data.report;
  },
  getLeaveReport: async () => {
    const res = await axiosInstance.get('/reports/leave');
    return res.data.report;
  },
  getProjectReport: async () => {
    const res = await axiosInstance.get('/reports/projects');
    return res.data.report;
  }
};
