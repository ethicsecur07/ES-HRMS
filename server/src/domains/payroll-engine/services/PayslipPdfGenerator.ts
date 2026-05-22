import PDFDocument from 'pdfkit';
import { IPayslip } from '../../../models/Payslip.js';
import { IEmployee } from '../../../models/Employee.js';
import { IOrganization } from '../../../models/Organization.js';
import { Writable } from 'stream';

export class PayslipPdfGenerator {
  public static generate(
    payslip: IPayslip,
    employee: IEmployee,
    organization: IOrganization,
    stream: Writable
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });

      doc.pipe(stream);

      // --- HEADER & BRANDING ---
      doc.fillColor('#0f172a').fontSize(20).text(organization.name.toUpperCase(), { align: 'left' });
      doc.fillColor('#64748b').fontSize(9).text(organization.settings?.timezone || 'UTC timezone', { align: 'left' });
      doc.moveDown(1);
      
      doc.fillColor('#0f172a').fontSize(14).text('PAYSLIP OF THE MONTH', { align: 'right' });
      doc.fillColor('#0284c7').fontSize(12).text(payslip.month, { align: 'right' });
      doc.moveDown(2);

      // Draw horizontal separator line
      doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1);

      // --- EMPLOYEE INFORMATION SECTION ---
      const startY = doc.y;
      
      // Column 1
      doc.fillColor('#64748b').fontSize(9).text('Employee Code:', 50, startY);
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text(employee.employeeCode, 150, startY);
      
      doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('Employee Name:', 50, startY + 18);
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text(employee.fullName, 150, startY + 18);
      
      doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('Department:', 50, startY + 36);
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text(employee.department, 150, startY + 36);

      // Column 2
      doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('Designation:', 300, startY);
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text(employee.designation, 400, startY);

      doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('Email:', 300, startY + 18);
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text(employee.email, 400, startY + 18);

      doc.moveDown(3);
      doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1.5);

      // --- EARNINGS & DEDUCTIONS DETAILS ---
      const tableStartY = doc.y;

      // Earnings Table Headers
      doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold').text('EARNINGS', 50, tableStartY);
      doc.text('AMOUNT', 220, tableStartY, { align: 'right', width: 60 });

      // Deductions Table Headers
      doc.text('DEDUCTIONS', 300, tableStartY);
      doc.text('AMOUNT', 485, tableStartY, { align: 'right', width: 60 });

      doc.strokeColor('#94a3b8').lineWidth(1.5).moveTo(50, tableStartY + 15).lineTo(545, tableStartY + 15).stroke();

      const itemStartY = tableStartY + 25;
      
      // Earnings items
      const earnings = [
        { label: 'Basic Salary', val: payslip.allowances.basic },
        { label: 'House Rent Allowance (HRA)', val: payslip.allowances.hra },
        { label: 'Conveyance Allowance', val: payslip.allowances.conveyance },
        { label: 'Medical Allowance', val: payslip.allowances.medical },
        { label: 'Overtime / Bonus', val: payslip.allowances.bonus },
      ];

      // Deductions items
      const deductions = [
        { label: 'Professional Tax (PT)', val: payslip.deductions.professionalTax },
        { label: 'Provident Fund (EPF)', val: payslip.deductions.providentFund },
        { label: 'Loss of Pay (LOP)', val: payslip.deductions.leaveDeductions },
        { label: 'Late Penalty Deductions', val: payslip.deductions.latePenalties },
      ];

      let currentEarningY = itemStartY;
      doc.font('Helvetica').fontSize(9);
      for (const earn of earnings) {
        doc.fillColor('#334155').text(earn.label, 50, currentEarningY);
        doc.fillColor('#0f172a').text(earn.val.toLocaleString(), 220, currentEarningY, { align: 'right', width: 60 });
        currentEarningY += 18;
      }

      let currentDeductionY = itemStartY;
      for (const ded of deductions) {
        doc.fillColor('#334155').text(ded.label, 300, currentDeductionY);
        doc.fillColor('#0f172a').text(ded.val.toLocaleString(), 485, currentDeductionY, { align: 'right', width: 60 });
        currentDeductionY += 18;
      }

      // Max Y of the list
      const totalsStartY = Math.max(currentEarningY, currentDeductionY) + 15;
      doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(50, totalsStartY).lineTo(545, totalsStartY).stroke();

      const grossEarnings = Object.values(payslip.allowances).reduce((a, b) => a + b, 0);
      const totalDeds = Object.values(payslip.deductions).reduce((a, b) => a + b, 0);

      // Display Totals
      doc.font('Helvetica-Bold').fontSize(9);
      doc.fillColor('#0f172a').text('Total Earnings:', 50, totalsStartY + 10);
      doc.text(grossEarnings.toLocaleString(), 220, totalsStartY + 10, { align: 'right', width: 60 });

      doc.text('Total Deductions:', 300, totalsStartY + 10);
      doc.text(totalDeds.toLocaleString(), 485, totalsStartY + 10, { align: 'right', width: 60 });

      doc.strokeColor('#94a3b8').lineWidth(1.5).moveTo(50, totalsStartY + 28).lineTo(545, totalsStartY + 28).stroke();
      
      // Net Salary Section
      const netSalaryY = totalsStartY + 40;
      doc.fillColor('#0369a1').fontSize(11).font('Helvetica-Bold').text('Reimbursements Payout:', 50, netSalaryY);
      doc.fillColor('#0f172a').text(payslip.reimbursements.toLocaleString(), 220, netSalaryY, { align: 'right', width: 60 });

      doc.fillColor('#0369a1').fontSize(11).font('Helvetica-Bold').text('NET PAYOUT:', 300, netSalaryY);
      doc.fillColor('#0284c7').fontSize(12).text(payslip.netSalary.toLocaleString(), 460, netSalaryY, { align: 'right', width: 85 });

      doc.moveDown(4);

      // --- VERIFICATION FOOTER ---
      doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1);

      doc.fillColor('#64748b').fontSize(8).text(
        'This is a computer-generated document authorized by the finance department of ' + 
        organization.name + 
        '. No physical signature is required. Generated on ' + 
        new Date(payslip.generatedAt).toLocaleString(), 
        { align: 'center' }
      );

      doc.end();

      // Resolve when stream is finished
      stream.on('finish', () => resolve());
      stream.on('error', (err) => reject(err));
    });
  }
}
