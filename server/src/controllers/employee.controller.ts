import { Response } from 'express';
import mongoose from 'mongoose';
import { EmployeeService } from '../services/employee.service.js';
import { AuthRequest } from '../types/index.js';

export const getNextEmployeeCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(400).json({ message: 'Organization context is missing.' });
      return;
    }

    const isIntern = req.query.isIntern === 'true';
    const departmentId = req.query.departmentId as string || undefined;
    const designationId = req.query.designationId as string || undefined;

    const nextCode = await EmployeeService.generateEmployeeCode(
      orgId,
      departmentId,
      designationId,
      isIntern
    );
    res.status(200).json({ nextCode });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getEmployees = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(400).json({ message: 'Organization context is missing.' });
      return;
    }

    const { search, department, designation, departmentId, designationId, branchId, isActive, page, limit, sortBy, sortOrder, isLoginApproved } = req.query;
    const result = await EmployeeService.getEmployees(orgId, {
      search: search as string,
      department: department as string,
      designation: designation as string,
      departmentId: departmentId as string,
      designationId: designationId as string,
      branchId: branchId as string,
      isActive: isActive as string,
      page: page as string,
      limit: limit as string,
      sortBy: sortBy as string,
      sortOrder: sortOrder as any,
      isLoginApproved: isLoginApproved as string,
    });

    if ((res as any).jsonSanitized) {
      (res as any).jsonSanitized(result);
    } else {
      res.status(200).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getEmployeeById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { organizationId, employeeId, role } = req.user || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid employee ID format.' });
      return;
    }

    if (!organizationId) {
      res.status(400).json({ message: 'Organization context is missing.' });
      return;
    }

    // Standard employee can only fetch their own profile details
    if (role === 'EMPLOYEE' && employeeId !== id) {
      res.status(403).json({ message: 'Forbidden. You can only view your own profile.' });
      return;
    }

    const employee = await EmployeeService.getEmployeeById(id, organizationId);

    // If standard employee is viewing their own profile, clear restricted fields to display all profile info
    if (role === 'EMPLOYEE' && employeeId === id) {
      (req as any).restrictedFields = [];
    }

    if ((res as any).jsonSanitized) {
      (res as any).jsonSanitized({ employee });
    } else {
      res.status(200).json({ employee });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createEmployee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { password, candidateId, leadId, ...employeeData } = req.body;
    const orgId = req.user?.organizationId;
    const emailForAudit = req.user?.email || 'System';

    if (!orgId) {
      res.status(400).json({ message: 'Organization context is missing.' });
      return;
    }

    const { employee, generatedPassword } = await EmployeeService.createEmployee(
      employeeData,
      password,
      orgId,
      emailForAudit,
      candidateId,
      leadId
    );

    // Dynamic Welcoming & Account Provisioning Branded PDF Delivery
    try {
      const { generateOfferLetterPdf } = await import('../services/offerLetterPdf.service.js');
      const { sendEmail } = await import('../services/email.service.js');
      const { logger } = await import('../utils/logger.js');

      const bodyText = `We are pleased to confirm that you have successfully completed your screening and interview rounds and have been formally hired as a ${employee.designation} at ES EthicSecur SofTec Pvt Ltd.

Your system account has been successfully provisioned. You can now log in to the employee dashboard to mark your attendance daily, view assignments, manage projects, and view upcoming meetings.

Your Login Credentials:
- Work Email: ${employee.email}
- Employee Access Code: ${employee.employeeCode}
- Temporary Access Password: ${generatedPassword}

Corporate Guidelines & Security Policies:
1. Professional Conduct: All employees and interns must maintain high standards of discipline, punctuality, and respect towards all team members.
2. Attendance: Daily login and logout on the portal is mandatory. Late checkins and leaves must be requested in advance via the system dashboard.
3. Non-Disclosure & Security: All codebases, client specifications, credentials, and system logic are strictly confidential and must not be shared or leaked under any circumstances.
4. System Access: Your temporary password must be changed immediately upon your first successful login.

We welcome you to our professional family and wish you great success in your journey with ES EthicSecur SofTec Pvt Ltd!`;

      const pdfBuffer = await generateOfferLetterPdf({
        date: new Date().toISOString().split('T')[0],
        candidateName: employee.fullName,
        address: employee.address || 'Salem, Tamil Nadu',
        appliedRole: employee.designation,
        duration: 'Indefinite',
        startDate: new Date(employee.joiningDate).toISOString().split('T')[0],
        stipendDetails: employee.salary ? `${employee.salary} INR/Month` : 'TBD',
        technologies: 'General Web & Security Technologies',
        bodyText,
        pdfTitle: 'Employment Confirmation & Onboarding Letter',
        pdfSubject: 'Subject: Account Provisioning & System Access Confirmation',
        candidateEmail: employee.email
      });

      // Branded Email Construction
      const emailSubject = `Welcome to ES EthicSecur SofTec - Account Provisioned: ${employee.fullName}`;
      const emailBody = `Dear ${employee.fullName},\n\nWelcome to the team! We are pleased to inform you that your corporate account has been provisioned successfully.\n\nAttached is your branded Onboarding & Policy Letter in PDF format. It contains your temporary system login credentials, guidelines, and corporate safety policies.\n\nYour Temporary Credentials:\n- Email: ${employee.email}\n- Password: ${generatedPassword}\n\nPlease change your password immediately upon your first successful login.\n\nBest regards,\nHR Department\nES EthicSecur SofTec Pvt Ltd`;

      const formattedHtmlParagraphs = emailBody.split('\n\n').map((p: string) => `<p style="font-size: 14px; margin-bottom: 12px; white-space: pre-line;">${p.trim()}</p>`).join('');
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e1e1e1; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <div style="background: linear-gradient(135deg, #1f618d, #2980b9); padding: 24px; text-align: center; color: white;">
            <h2 style="margin: 0; font-size: 22px;">Welcome to ES EthicSecur SofTec</h2>
            <p style="margin: 4px 0 0; font-size: 14px; opacity: 0.9;">System Account Provisioned Successfully</p>
          </div>
          <div style="padding: 24px; background-color: #ffffff; text-align: left;">
            ${formattedHtmlParagraphs}
            
            <div style="background-color: #f9f9f9; border-left: 4px solid #2980b9; padding: 16px; margin: 20px 0; border-radius: 4px;">
              <table style="width: 100%; font-size: 13.5px; border-collapse: collapse;">
                <tr>
                  <td style="padding: 4px 0; color: #666; font-weight: bold; width: 130px;">Work Email:</td>
                  <td style="padding: 4px 0; color: #333;">${employee.email}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #666; font-weight: bold;">Employee Code:</td>
                  <td style="padding: 4px 0; color: #333;">${employee.employeeCode}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #666; font-weight: bold;">Temporary Password:</td>
                  <td style="padding: 4px 0; color: #333; font-family: monospace; font-weight: bold;">${generatedPassword}</td>
                </tr>
              </table>
            </div>
            
            <p style="font-size: 14.5px; margin-top: 15px;">Please find the official onboarding confirmation letter and company guidelines attached as a PDF file.</p>
          </div>
          <div style="background-color: #f5f5f5; padding: 16px; text-align: center; border-top: 1px solid #e1e1e1; font-size: 12px; color: #777;">
            <p style="margin: 0;">This email is sent on behalf of ES EthicSecur SofTec Pvt Ltd.</p>
          </div>
        </div>
      `;

      await sendEmail({
        to: employee.email,
        subject: emailSubject,
        text: emailBody,
        html: emailHtml,
        attachments: [
          {
            filename: `Welcome_Letter_${employee.fullName.replace(/\s+/g, '_')}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      });
      logger.info(`[EmployeeController] Successfully generated and sent welcome PDF and access credentials to ${employee.email}`);
    } catch (mailErr: any) {
      console.error('[EmployeeController] Failed to send welcome email', mailErr);
    }

    res.status(201).json({ employee, generatedPassword });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const updateEmployee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const orgId = req.user?.organizationId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid employee ID format.' });
      return;
    }
    const emailForAudit = req.user?.email || 'System';

    if (!orgId) {
      res.status(400).json({ message: 'Organization context is missing.' });
      return;
    }

    const employee = await EmployeeService.updateEmployee(id, req.body, orgId, emailForAudit, req.user?.role);

    res.status(200).json({ employee });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteEmployee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const orgId = req.user?.organizationId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid employee ID format.' });
      return;
    }
    const emailForAudit = req.user?.email || 'System';

    if (!orgId) {
      res.status(400).json({ message: 'Organization context is missing.' });
      return;
    }

    await EmployeeService.deleteEmployee(id, orgId, emailForAudit);

    res.status(200).json({ message: 'Employee record soft-deleted and user account revoked successfully' });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const syncMicrosoftEmployees = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(400).json({ message: 'Organization context is missing.' });
      return;
    }

    const emailForAudit = req.user?.email || 'System';
    const result = await EmployeeService.syncMicrosoftEmployees(orgId, emailForAudit);
    
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
