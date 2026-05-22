import PDFDocument from 'pdfkit';
import { IPayslip } from '../models/Payslip.js';
import { Employee } from '../models/Employee.js';
import { Organization } from '../models/Organization.js';
import { PassThrough } from 'stream';

export const generatePayslipPdf = async (payslip: IPayslip): Promise<Buffer> => {
  const employee = await Employee.findById(payslip.employeeId);
  const organization = await Organization.findById(payslip.organizationId);

  if (!employee || !organization) {
    throw new Error('Employee or Organization not found');
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];
      const stream = new PassThrough();

      stream.on('data', (chunk) => buffers.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(buffers)));
      stream.on('error', (err) => reject(err));

      doc.pipe(stream);

      // Header
      doc.fontSize(20).text(organization.name, { align: 'center' });
      doc.fontSize(12).text(`Payslip for the month of ${payslip.month}`, { align: 'center' });
      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown();

      // Employee Details
      doc.fontSize(12).font('Helvetica').text(`Employee Name: ${employee.fullName}`);
      doc.text(`Employee Code: ${employee.employeeCode}`);
      doc.moveDown();

      // Earnings & Deductions Tables
      const startY = doc.y;

      // Earnings
      doc.font('Helvetica-Bold').text('Earnings', 50, startY, { underline: true });
      doc.font('Helvetica');
      let currentY = startY + 20;
      const earnings = [
        { label: 'Basic', value: payslip.allowances.basic },
        { label: 'HRA', value: payslip.allowances.hra },
        { label: 'Conveyance', value: payslip.allowances.conveyance },
        { label: 'Medical', value: payslip.allowances.medical },
        { label: 'Bonus', value: payslip.allowances.bonus },
        { label: 'Overtime', value: payslip.allowances.overtime },
      ];
      
      let totalEarnings = 0;
      earnings.forEach(item => {
        if (item.value > 0) {
          doc.text(item.label, 50, currentY);
          doc.text(item.value.toFixed(2), 200, currentY, { align: 'right', width: 100 });
          totalEarnings += item.value;
          currentY += 15;
        }
      });

      // Deductions
      doc.font('Helvetica-Bold').text('Deductions', 350, startY, { underline: true });
      doc.font('Helvetica');
      let currentYRight = startY + 20;
      const deductions = [
        { label: 'Prof. Tax', value: payslip.deductions.professionalTax },
        { label: 'PF', value: payslip.deductions.providentFund },
        { label: 'Leave Ded.', value: payslip.deductions.leaveDeductions },
        { label: 'Late Pen.', value: payslip.deductions.latePenalties },
        { label: 'Tax', value: payslip.deductions.tax },
      ];

      let totalDeductions = 0;
      deductions.forEach(item => {
        if (item.value > 0) {
          doc.text(item.label, 350, currentYRight);
          doc.text(item.value.toFixed(2), 450, currentYRight, { align: 'right', width: 100 });
          totalDeductions += item.value;
          currentYRight += 15;
        }
      });

      const maxEndY = Math.max(currentY, currentYRight) + 20;
      doc.moveTo(50, maxEndY).lineTo(550, maxEndY).stroke();

      // Totals
      doc.font('Helvetica-Bold');
      doc.text('Total Earnings:', 50, maxEndY + 10);
      doc.text(totalEarnings.toFixed(2), 200, maxEndY + 10, { align: 'right', width: 100 });

      doc.text('Total Deductions:', 350, maxEndY + 10);
      doc.text(totalDeductions.toFixed(2), 450, maxEndY + 10, { align: 'right', width: 100 });

      // Reimbursements
      doc.text(`Reimbursements: ${payslip.reimbursements.toFixed(2)}`, 50, maxEndY + 30);

      // Net Salary
      doc.fontSize(14).text(`Net Salary: ${payslip.netSalary.toFixed(2)}`, 50, maxEndY + 50);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};
