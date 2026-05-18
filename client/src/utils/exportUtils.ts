import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import type { Payroll, Attendance, TaskReport } from '../types';
import { formatDate, formatCurrency } from './formatters';

export const exportPayslipPDF = (payroll: Payroll, employeeName: string, employeeCode: string) => {
  const doc = new jsPDF();

  doc.setFillColor(170, 59, 255); // Premium accent color
  doc.rect(0, 0, 210, 30, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('ETHICSEC - SALARY PAYSLIP', 15, 20);

  doc.setTextColor(50, 50, 50);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Employee Name: ${employeeName}`, 15, 45);
  doc.text(`Employee Code: ${employeeCode}`, 15, 53);
  doc.text(`Pay Period: ${payroll.month}`, 15, 61);
  doc.text(`Payment Status: ${payroll.paidStatus}`, 15, 69);

  // Line separator
  doc.setDrawColor(200, 200, 200);
  doc.line(15, 75, 195, 75);

  doc.setFont('helvetica', 'bold');
  doc.text('Earnings & Deductions', 15, 85);

  doc.setFont('helvetica', 'normal');
  doc.text('Base Salary:', 15, 95); doc.text(formatCurrency(payroll.baseSalary), 150, 95);
  doc.text('Bonus / Incentives:', 15, 103); doc.text(formatCurrency(payroll.bonus), 150, 103);
  doc.text('Deductions:', 15, 111); doc.text(`- ${formatCurrency(payroll.deductions)}`, 150, 111);

  doc.setDrawColor(170, 59, 255);
  doc.setLineWidth(0.5);
  doc.line(15, 118, 195, 118);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  doc.text('Net Final Salary:', 15, 128); doc.text(formatCurrency(payroll.finalSalary), 150, 128);

  doc.setFontSize(10); doc.setFont('helvetica', 'italic'); doc.setTextColor(120, 120, 120);
  doc.text('This is a computer-generated document. No signature is required.', 15, 150);

  doc.save(`Payslip_${employeeCode}_${payroll.month}.pdf`);
};

export const exportAttendanceExcel = (attendances: Attendance[], employeeName?: string) => {
  const data = attendances.map((a) => ({
    Date: formatDate(a.date),
    'Login Time': a.loginTime ? new Date(a.loginTime).toLocaleTimeString() : 'N/A',
    'Logout Time': a.logoutTime ? new Date(a.logoutTime).toLocaleTimeString() : 'N/A',
    Status: a.status,
    'Working Hours': a.workingHours || 0,
    'IP Address': a.ipAddress,
    'Location Verified': a.locationVerified ? 'Yes' : 'No',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');

  const fileName = employeeName ? `Attendance_${employeeName}.xlsx` : 'Company_Attendance_Report.xlsx';
  XLSX.writeFile(workbook, fileName);
};

export const exportProductivityExcel = (tasks: TaskReport[]) => {
  const data = tasks.map((t) => ({
    Date: formatDate(t.date),
    'In Progress Tasks': t.inProgressTasks,
    'Completed Tasks': t.completedTasks,
    'Pending Tasks': t.pendingTasks,
    Blockers: t.blockers,
    'Tomorrow Plan': t.tomorrowPlan,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Productivity Reports');

  XLSX.writeFile(workbook, 'Employee_Productivity_Report.xlsx');
};
