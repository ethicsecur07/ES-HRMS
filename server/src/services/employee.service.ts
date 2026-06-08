import mongoose from 'mongoose';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { Candidate } from '../models/Candidate.js';
import { PasswordService } from '../domains/auth-engine/services/PasswordService.js';
import { createAuditLog } from './auditLog.service.js';
import { Department } from '../models/Department.js';
import { Designation } from '../models/Designation.js';
import { OrganizationAuthConfig } from '../models/OrganizationAuthConfig.js';
import { Organization } from '../models/Organization.js';
import { Payroll } from '../models/Payroll.js';
import { Payslip } from '../models/Payslip.js';

export interface EmployeeQueryOptions {
  search?: string;
  department?: string;
  designation?: string;
  departmentId?: string;
  designationId?: string;
  branchId?: string;
  isActive?: string | boolean;
  isLoginApproved?: string | boolean;
  page?: string | number;
  limit?: string | number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class EmployeeService {
  /**
   * Onboards a new employee, creates their system User account, and hashes their password atomically.
   */
  static async createEmployee(employeeData: any, password: string | undefined, orgId: mongoose.Types.ObjectId | string, emailForAudit: string, candidateId?: string, leadId?: string) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (!employeeData.employeeCode) {
        const isIntern = employeeData.designation?.toLowerCase().includes('intern');
        // Generate code based on department/designation if provided, otherwise fallback to simple prefix
        employeeData.employeeCode = await EmployeeService.generateEmployeeCode(
          orgId,
          employeeData.departmentId,
          employeeData.designationId,
          isIntern
        );
      }

      // 1. Pre-flight check for duplicate employeeCode or email within organization
      if (employeeData.employeeCode) {
        const codeExists = await Employee.findOne({
          organizationId: orgId,
          employeeCode: employeeData.employeeCode,
        }).session(session);
        if (codeExists) {
          throw new Error(`Employee with code ${employeeData.employeeCode} already exists in this organization.`);
        }
      }

      if (employeeData.email) {
        const normalizedEmail = employeeData.email.toLowerCase().trim();
        const emailExists = await Employee.findOne({
          organizationId: orgId,
          email: normalizedEmail,
        }).session(session);
        if (emailExists) {
          throw new Error(`Employee with email ${employeeData.email} already exists in this organization.`);
        }
      }

      // 2. Hash Password for login account
      const defaultPassword = password || 'EthicSec@2026';
      const hashedPassword = await PasswordService.hashPassword(defaultPassword);

      // Normalize email for consistency
      const normalizedEmail = employeeData.email?.toLowerCase().trim();
      if (normalizedEmail) {
        employeeData.email = normalizedEmail;
      }

      const isInternRole = employeeData.isIntern !== undefined
        ? !!employeeData.isIntern
        : !!(employeeData.designation?.toLowerCase().includes('intern') || employeeData.department?.toLowerCase().includes('intern') || employeeData.departmentId === '605c72ef1f77bcf86cd79777'); // Fallback department checks

      let createdAzureUser = null;
      if (employeeData.createAzureAccount && employeeData.azureUserPrincipalName) {
        if (!employeeData.employeeCode) {
          throw new Error('Employee ID is required for Azure AD provisioning.');
        }
        if (!employeeData.phone) {
          throw new Error('Mobile number is required for Azure AD provisioning.');
        }
        if (!employeeData.joiningDate) {
          throw new Error('Hire/joining date is required for Azure AD provisioning.');
        }

        const { MicrosoftGraphService } = await import('./microsoftGraph.service.js');
        createdAzureUser = await MicrosoftGraphService.createUserInAzure(orgId, {
          userPrincipalName: employeeData.azureUserPrincipalName,
          displayName: employeeData.fullName,
          givenName: employeeData.fullName.split(' ')[0] || employeeData.fullName,
          surname: employeeData.fullName.split(' ').slice(1).join(' ') || '',
          jobTitle: employeeData.designation,
          department: employeeData.department,
          tempPassword: employeeData.azureTempPassword,
          employeeId: employeeData.employeeCode,
          employeeHireDate: String(employeeData.joiningDate),
          mobilePhone: employeeData.phone,
        });

        if (createdAzureUser && employeeData.azureLicenses && employeeData.azureLicenses.length > 0) {
          await MicrosoftGraphService.assignLicenses(orgId, createdAzureUser.id, employeeData.azureLicenses);
        }
      }

      // 3. Create Employee record
      const [employee] = await Employee.create([{
        ...employeeData,
        email: createdAzureUser ? createdAzureUser.userPrincipalName.toLowerCase() : employeeData.email,
        isActive: true,
        organizationId: orgId,
        isIntern: isInternRole,
        ...(isInternRole ? {
          internshipDurationMonths: 6,
          internshipUnpaidMonths: 3,
          internshipPaidMonths: 3,
          internshipStatus: 'UNPAID',
          internshipPerformanceApproved: false,
        } : {}),
      }], { session });

      const userUpdate: any = {
        organizationId: orgId,
        name: employee.fullName,
        email: employee.email,
        role: isInternRole ? 'INTERN' : 'EMPLOYEE',
        employeeId: employee._id,
        isActive: true,
        isLoginApproved: true,
      };

      if (createdAzureUser) {
        userUpdate.password = ''; // Clear local password for Microsoft SSO
        userUpdate.ssoData = {
          provider: 'MICROSOFT',
          azureRoles: [],
          jobTitle: employee.designation,
          department: employee.department,
          lastSyncedAt: new Date()
        };
      } else {
        userUpdate.password = hashedPassword;
      }

      await User.findOneAndUpdate(
        { organizationId: orgId, email: employee.email },
        userUpdate,
        { upsert: true, session }
      );

      // Apply lead assignment as primaryManagerId if provided
      if (leadId && mongoose.isValidObjectId(leadId)) {
        (employee as any).primaryManagerId = new mongoose.Types.ObjectId(leadId);
        await employee.save({ session });
      }

      await createAuditLog(
        'EMPLOYEE_CREATE',
        emailForAudit,
        'EMPLOYEE',
        employee.employeeCode,
        `Onboarded employee ${employee.fullName} and provisioned credentials.`,
        orgId
      );

      await session.commitTransaction();

      // Mark candidate as accountCreated (outside the transaction, best effort)
      if (candidateId && mongoose.isValidObjectId(candidateId)) {
        try {
          await Candidate.findByIdAndUpdate(candidateId, {
            accountCreated: true,
            ...(leadId && mongoose.isValidObjectId(leadId) ? { assignedLeadId: new mongoose.Types.ObjectId(leadId) } : {})
          });
        } catch (_) {
          // non-critical, log only
        }
      }

      return { employee, generatedPassword: defaultPassword };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Updates employee record and synchronizes User credentials.
   * Restricts editable fields exclusively to Emergency, Bank, and Tax details.
   */
  static async updateEmployee(id: string, updateData: any, orgId: mongoose.Types.ObjectId | string, emailForAudit: string, userRole?: string) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Enforce RBAC access (only ADMIN, HR, and MANAGER roles allowed)
      const allowedRoles = ['ADMIN', 'HR', 'MANAGER'];
      if (!userRole || !allowedRoles.includes(userRole)) {
        throw new Error('Forbidden: Only ADMIN, HR, and MANAGER roles are allowed to edit employee details.');
      }

      // 2. Verify employee exists within the organization
      const existingEmployee = await Employee.findOne({ _id: id, organizationId: orgId }).session(session);
      if (!existingEmployee) {
        throw new Error('Employee not found or unauthorized.');
      }

      // 3. Construct safe update payload containing ONLY emergency, bank, and tax details
      const safeUpdateData: any = {};

      if (updateData.emergencyContact) {
        safeUpdateData.emergencyContact = {
          name: updateData.emergencyContact.name ?? existingEmployee.emergencyContact?.name,
          relationship: updateData.emergencyContact.relationship ?? existingEmployee.emergencyContact?.relationship,
          phone: updateData.emergencyContact.phone ?? existingEmployee.emergencyContact?.phone,
        };
      }

      if (updateData.bankDetails) {
        safeUpdateData.bankDetails = {
          bankName: updateData.bankDetails.bankName ?? existingEmployee.bankDetails?.bankName,
          accountName: updateData.bankDetails.accountName ?? existingEmployee.bankDetails?.accountName,
          accountNumber: updateData.bankDetails.accountNumber ?? existingEmployee.bankDetails?.accountNumber,
          ifscCode: updateData.bankDetails.ifscCode ?? existingEmployee.bankDetails?.ifscCode,
          branchName: updateData.bankDetails.branchName ?? existingEmployee.bankDetails?.branchName,
        };
      }

      if (updateData.taxDetails) {
        safeUpdateData.taxDetails = {
          panNumber: updateData.taxDetails.panNumber ?? existingEmployee.taxDetails?.panNumber,
          taxRegime: updateData.taxDetails.taxRegime ?? existingEmployee.taxDetails?.taxRegime,
        };
      }

      // Keep support for soft-deactivation flags if passed explicitly
      if (updateData.isActive !== undefined) {
        safeUpdateData.isActive = updateData.isActive === true || updateData.isActive === 'true';
      }

      // 4. Perform the database update
      const employee = await Employee.findOneAndUpdate(
        { _id: id, organizationId: orgId },
        safeUpdateData,
        { new: true, session }
      );
      if (!employee) {
        throw new Error('Employee not found or unauthorized.');
      }

      // 5. Keep corresponding User login details in sync (primarily for active/deactive status)
      const userUpdate: any = {};
      if (safeUpdateData.isActive !== undefined) {
        userUpdate.isActive = safeUpdateData.isActive;
      }

      if (updateData.isLoginApproved !== undefined) {
        const organization = await Organization.findById(orgId).session(session);
        const allowedRolesForLogin = organization?.settings?.loginApprovalRoles || ['ADMIN'];
        if (userRole !== 'ADMIN' && !allowedRolesForLogin.includes(userRole || '')) {
          throw new Error('Forbidden: You do not have permission to approve/disapprove logins.');
        }
        userUpdate.isLoginApproved = updateData.isLoginApproved === true || updateData.isLoginApproved === 'true';
      }

      if (Object.keys(userUpdate).length > 0) {
        userUpdate.employeeId = employee._id;

        await User.findOneAndUpdate(
          {
            $or: [
              { employeeId: employee._id },
              { email: employee.email.toLowerCase().trim() }
            ],
            organizationId: orgId
          },
          userUpdate,
          { session }
        );
      }

      await createAuditLog(
        'EMPLOYEE_UPDATE',
        emailForAudit,
        'EMPLOYEE',
        employee.employeeCode,
        `Updated emergency/bank/tax details for ${employee.fullName}`,
        orgId
      );

      const user = await User.findOne({
        $or: [
          { employeeId: employee._id },
          { email: employee.email.toLowerCase().trim() }
        ],
        organizationId: orgId
      }).session(session).select('_id ssoData isLoginApproved role');

      await session.commitTransaction();

      const empObj = employee.toObject();
      return {
        ...empObj,
        userId: user?._id.toString() || null,
        ssoData: user?.ssoData || null,
        role: user?.role || 'EMPLOYEE',
        isLoginApproved: user?.isLoginApproved !== false,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Retrieves list of employees with support for search, pagination, and sorting.
   * Restricts employees to only those with approved and active login accounts by default (Payroll, Documents, Projects, Chat, etc.).
   */
  static async getEmployees(orgId: mongoose.Types.ObjectId | string, options: EmployeeQueryOptions = {}) {
    const { search, department, designation, departmentId, designationId, branchId, isActive, page, limit, sortBy, sortOrder, isLoginApproved } = options;

    const query: any = { organizationId: orgId };
    const andConditions: any[] = [];

    if (isLoginApproved === 'false' || isLoginApproved === false) {
      // Resolve all revoked or inactive users within this organization
      const revokedUsers = await User.find({
        organizationId: orgId,
        $or: [
          { isLoginApproved: false },
          { isActive: false }
        ]
      }).select('employeeId email');

      const revokedEmployeeIds = revokedUsers.map(u => u.employeeId).filter(Boolean);
      const revokedEmails = revokedUsers.map(u => u.email?.toLowerCase().trim()).filter(Boolean);

      // Explicit filter: Show ONLY revoked/inactive employees
      andConditions.push({
        $or: [
          { _id: { $in: revokedEmployeeIds } },
          { email: { $in: revokedEmails } }
        ]
      });
    } else if (isLoginApproved !== 'all') {
      // Exclude revoked or inactive users by default
      const revokedUsers = await User.find({
        organizationId: orgId,
        $or: [
          { isLoginApproved: false },
          { isActive: false }
        ]
      }).select('employeeId email');

      const revokedEmployeeIds = revokedUsers.map(u => u.employeeId).filter(Boolean);
      const revokedEmails = revokedUsers.map(u => u.email?.toLowerCase().trim()).filter(Boolean);

      if (revokedEmployeeIds.length > 0 || revokedEmails.length > 0) {
        andConditions.push({
          _id: { $nin: revokedEmployeeIds },
          email: { $nin: revokedEmails }
        });
      }
    }

    if (search) {
      const escapedSearch = String(search).replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      andConditions.push({
        $or: [
          { fullName: { $regex: escapedSearch, $options: 'i' } },
          { employeeCode: { $regex: escapedSearch, $options: 'i' } },
          { email: { $regex: escapedSearch, $options: 'i' } },
        ]
      });
    }

    if (departmentId && departmentId !== 'All') {
      const dept = await Department.findById(departmentId);
      if (dept) {
        andConditions.push({
          $or: [
            { departmentId: new mongoose.Types.ObjectId(departmentId) },
            { department: dept.name }
          ]
        });
      } else {
        andConditions.push({ departmentId: new mongoose.Types.ObjectId(departmentId) });
      }
    } else if (department && department !== 'All') {
      andConditions.push({ department: department });
    }

    if (designationId && designationId !== 'All') {
      const desig = await Designation.findById(designationId);
      if (desig) {
        andConditions.push({
          $or: [
            { designationId: new mongoose.Types.ObjectId(designationId) },
            { designation: desig.name }
          ]
        });
      } else {
        andConditions.push({ designationId: new mongoose.Types.ObjectId(designationId) });
      }
    } else if (designation) {
      andConditions.push({ designation: designation });
    }

    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    if (branchId) {
      query.branchId = branchId;
    }
    if (isActive !== undefined && isActive !== '') {
      query.isActive = isActive === 'true' || isActive === true;
    }

    // Pagination
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 1000;
    const skipNum = (pageNum - 1) * limitNum;

    // Sorting
    const sortField = sortBy || 'createdAt';
    const sortDir = sortOrder === 'asc' ? 1 : -1;
    const sortObj: any = {};
    sortObj[sortField] = sortDir;

    const total = await Employee.countDocuments(query);
    const employees = await Employee.find(query)
      .select('-salary -emergencyContact')
      .populate('departmentId', 'name code')
      .populate('designationId', 'name code')
      .sort(sortObj)
      .skip(skipNum)
      .limit(limitNum);

    const employeeIds = employees.map(emp => emp._id);
    const employeeEmails = employees.map(emp => emp.email.toLowerCase().trim());
    const users = await User.find({
      organizationId: orgId,
      $or: [
        { employeeId: { $in: employeeIds } },
        { email: { $in: employeeEmails } }
      ]
    }).select('_id employeeId email ssoData role isLoginApproved');

    const userMap = new Map();
    for (const u of users) {
      if (u.employeeId) {
        userMap.set(u.employeeId.toString(), { userId: u._id.toString(), ssoData: u.ssoData, role: u.role, isLoginApproved: u.isLoginApproved });
      }
      if (u.email) {
        userMap.set(u.email.toLowerCase().trim(), { userId: u._id.toString(), ssoData: u.ssoData, role: u.role, isLoginApproved: u.isLoginApproved });
      }
    }

    const enrichedEmployees = employees.map(emp => {
      const empObj = emp.toObject();
      const userData = userMap.get(emp._id.toString()) || userMap.get(emp.email.toLowerCase().trim()) || null;
      return {
        ...empObj,
        userId: userData?.userId || null,
        ssoData: userData?.ssoData || null,
        role: userData?.role || 'EMPLOYEE',
        isLoginApproved: userData?.isLoginApproved !== false,
      };
    });

    return { employees: enrichedEmployees, total, page: pageNum, limit: limitNum };
  }

  /**
   * Fetches employee details.
   */
  static async getEmployeeById(id: string, orgId: mongoose.Types.ObjectId | string) {
    const employee = await Employee.findOne({ _id: id, organizationId: orgId })
      .populate('departmentId', 'name code')
      .populate('designationId', 'name code');
    if (!employee) {
      throw new Error('Employee not found');
    }
    const user = await User.findOne({
      $or: [
        { employeeId: employee._id },
        { email: { $regex: new RegExp(`^${employee.email}$`, 'i') } }
      ],
      organizationId: orgId
    }).select('_id ssoData isLoginApproved');
    const empObj = employee.toObject();
    return {
      ...empObj,
      userId: user?._id.toString() || null,
      ssoData: user?.ssoData || null,
      isLoginApproved: user?.isLoginApproved !== false,
    };
  }

  /**
   * Soft deletes employee and their corresponding user login mapping.
   */
  static async deleteEmployee(id: string, orgId: mongoose.Types.ObjectId | string, emailForAudit: string) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const employee = await Employee.findOne({ _id: id, organizationId: orgId }).session(session);
      if (!employee) {
        throw new Error('Employee not found');
      }

      // 1. Soft-delete the Employee (this updates isDeleted and deletedAt)
      await (employee as any).softDelete({ session });

      // 1b. Soft-delete their corresponding Payroll records and delete Payslip records
      const payrolls = await Payroll.find({ employeeId: employee._id, organizationId: orgId }).session(session);
      for (const pr of payrolls) {
        if (typeof (pr as any).softDelete === 'function') {
          await (pr as any).softDelete({ session });
        }
      }
      await Payslip.deleteMany({ employeeId: employee._id, organizationId: orgId }).session(session);

      // 2. Revoke User login (soft-delete the user if it supports it, otherwise deactivate)
      const user = await User.findOne({ employeeId: employee._id, organizationId: orgId }).session(session);
      if (user) {
        if (typeof (user as any).softDelete === 'function') {
          await (user as any).softDelete({ session });
        } else {
          user.isActive = false;
          await user.save({ session });
        }
      }

      // 3. Delete from Azure AD if the employee is NOT an intern
      if (!employee.isIntern) {
        try {
          const { MicrosoftGraphService } = await import('./microsoftGraph.service.js');
          await MicrosoftGraphService.deleteUserInAzure(orgId, employee.email);
        } catch (azureError: any) {
          // Log the error but do NOT block database deletion
          console.warn(`[Azure AD] Failed to delete user ${employee.email} from Azure AD:`, azureError.message);
        }
      }

      await createAuditLog(
        'EMPLOYEE_DELETE',
        emailForAudit,
        'EMPLOYEE',
        employee.employeeCode,
        `Soft-deleted record and revoked user account for ${employee.fullName}`,
        orgId
      );

      await session.commitTransaction();
      return true;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Generates a unique employee code based on organization, department, designation, and intern status.
   * Prefix examples:
   *   - Intern: "INT-"
   *   - Department only: "DEP01-"
   *   - Department + Designation: "DEP01-DSG02-"
   *   - Default employee: "EMP-"
   * The numeric suffix is zero‑padded to 4 digits to allow for many employees.
   */
   static async generateEmployeeCode(
     orgId: mongoose.Types.ObjectId | string,
     departmentId?: string,
     designationId?: string,
     isIntern?: boolean
   ): Promise<string> {
     // Base prefix handling
     let prefix = isIntern ? 'INT-' : 'EMP-';
 
     // If a department is provided and it's not an intern, use its code (fallback to generic)
     if (departmentId && !isIntern) {
       const dept = await Department.findById(departmentId).select('name');
        const deptCode = dept?.name?.replace(/\s+/g, '').toUpperCase().slice(0, 4) || 'DEP';
        prefix = `${deptCode}-`;

        // If a designation is also provided, incorporate its abbreviation
        if (designationId) {
          const desig = await Designation.findById(designationId).select('name');
          const desigCode = desig?.name?.replace(/\s+/g, '').toUpperCase().slice(0, 4) || 'DSG';
          prefix = `${deptCode}-${desigCode}-`;
       }
     }
 
     // Build a regex to find the highest existing numeric suffix for this prefix
     const regex = new RegExp(`^${prefix}(\\d+)$`);
     const latest = await Employee.findOne({
       organizationId: orgId,
       employeeCode: { $regex: regex },
       $or: [{ isDeleted: true }, { isDeleted: false }, { isDeleted: { $exists: false } }]
     } as any)
       .select('employeeCode')
       .sort({ employeeCode: -1 })
       .limit(1);
 
     let maxNum = 0;
     if (latest && latest.employeeCode) {
       const match = latest.employeeCode.match(regex);
       if (match) {
         maxNum = parseInt(match[1], 10);
       }
     }
 
     const nextNum = maxNum + 1;
     const padded = String(nextNum).padStart(4, '0'); // 4‑digit padding for scalability
     return `${prefix}${padded}`;
   }

  /**
   * Syncs corporate directory users from Microsoft Graph API who match the @ethicsecur.co.in domain.
   */
  static async syncMicrosoftEmployees(orgId: mongoose.Types.ObjectId | string, emailForAudit: string) {
    // 1. Fetch active Microsoft SSO configuration
    const msalConfig = await OrganizationAuthConfig.findOne({
      organizationId: orgId,
      provider: 'MICROSOFT',
      isEnabled: true,
    });

    if (!msalConfig) {
      const error = new Error('Microsoft SSO configuration not found or disabled for this organization. Please configure and enable Microsoft SSO in Organization Settings > SSO Configuration first.');
      (error as any).statusCode = 400;
      throw error;
    }

    // 2. Exchange credentials for Microsoft Graph Token (Client Credentials Grant)
    const tenantId = msalConfig.tenantId || 'common';
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: msalConfig.clientId!,
        client_secret: msalConfig.clientSecret!,
        scope: 'https://graph.microsoft.com/.default',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      const error = new Error(`Failed to acquire Microsoft Graph token: ${errorText}. Please verify your Client ID, Client Secret, and Tenant ID settings under SSO Configuration.`);
      (error as any).statusCode = 400;
      throw error;
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // 3. Fetch all directory users from Microsoft Graph (paging supported)
    let msUsers: any[] = [];
    let nextLink: string | null = `https://graph.microsoft.com/v1.0/users?$select=displayName,givenName,surname,mail,userPrincipalName,jobTitle,department,mobilePhone,businessPhones,employeeId,employeeHireDate,streetAddress,city,state,postalCode,country`;

    while (nextLink) {
      const pageResponse = await fetch(nextLink, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!pageResponse.ok) {
        const errorText = await pageResponse.text();
        const error = new Error(`Failed to fetch users page from Microsoft Graph: ${errorText}. Please check that your Azure Active Directory App Registration has been granted 'User.Read.All' or 'Directory.Read.All' Application Permissions, and that Admin Consent has been granted in your Azure portal.`);
        (error as any).statusCode = 400;
        throw error;
      }
      const pageData: any = await pageResponse.json();
      msUsers = msUsers.concat(pageData.value || []);
      nextLink = pageData['@odata.nextLink'] || null;
    }

    // 4. Filter strictly to @ethicsecur.co.in and @ethicsecur.com accounts
    const filteredUsers = msUsers.filter((user: any) => {
      const email = (user.mail || user.userPrincipalName || '').toLowerCase().trim();
      return email.endsWith('@ethicsecur.co.in') || email.endsWith('@ethicsecur.com');
    });

    let createdCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    // Load active departments and designations for relation mappings
    const allDepts = await Department.find({ organizationId: orgId });
    const allDesigs = await Designation.find({ organizationId: orgId });

    // 5. Sync users to Employee and User collection
    for (const msUser of filteredUsers) {
      const email = (msUser.mail || msUser.userPrincipalName).toLowerCase().trim();
      const fullName = msUser.displayName || `${msUser.givenName || ''} ${msUser.surname || ''}`.trim() || 'Microsoft User';
      const phone = msUser.mobilePhone || (msUser.businessPhones && msUser.businessPhones[0]) || '9999999999';
      
      const msDeptName = msUser.department || 'Engineering';
      const msJobTitle = msUser.jobTitle || 'Associate';

      try {
        // Resolve or create Department
        let dept = allDepts.find(d => d.name && d.name.toLowerCase() === msDeptName.toLowerCase());
        if (!dept) {
          const deptCode = 'DEP-' + msDeptName.substring(0, 3).toUpperCase() + Math.floor(100 + Math.random() * 900);
          dept = await Department.create({
            organizationId: orgId,
            name: msDeptName,
            code: deptCode,
            isActive: true
          });
          allDepts.push(dept);
        }

        // Resolve or create Designation
        let desig = allDesigs.find(
          d => d.name && d.name.toLowerCase() === msJobTitle.toLowerCase() && 
          (d.departmentId?.toString() === dept!._id.toString() || !d.departmentId)
        );
        if (!desig) {
          const desigCode = 'DSG-' + msJobTitle.substring(0, 3).toUpperCase() + Math.floor(100 + Math.random() * 900);
          desig = await Designation.create({
            organizationId: orgId,
            departmentId: dept._id,
            name: msJobTitle,
            code: desigCode,
            isActive: true
          });
          allDesigs.push(desig);
        }

        // Construct combined address from Microsoft fields
        const addressParts = [
          msUser.streetAddress,
          msUser.city,
          msUser.state,
          msUser.postalCode,
          msUser.country
        ].filter(Boolean);
        const address = addressParts.length > 0 ? addressParts.join(', ') : 'Auto-Provisioned via Microsoft Directory Sync';

        // Parse joining/hire date
        const joiningDate = msUser.employeeHireDate ? new Date(msUser.employeeHireDate) : new Date();

        // Search for existing employee
        let employee = await Employee.findOne({ organizationId: orgId, email });

        if (employee) {
          // Update details
          employee.fullName = fullName;
          employee.phone = phone;
          employee.department = dept.name;
          employee.designation = desig.name;
          employee.departmentId = dept._id;
          employee.designationId = desig._id;
          employee.address = address;
          if (msUser.employeeId) {
            employee.employeeCode = msUser.employeeId;
          } else {
            employee.employeeCode = `TEMP-EMP-${email}`;
          }
          if (msUser.employeeHireDate) {
            employee.joiningDate = joiningDate;
          }
          employee.isActive = true;
          await employee.save();

          // Sync User details
          let user = await User.findOne({
            $or: [
              { employeeId: employee._id },
              { email: email }
            ],
            organizationId: orgId
          });

          const ssoData = {
            provider: 'MICROSOFT',
            azureRoles: msUser.roles || [],
            jobTitle: msJobTitle,
            department: msDeptName,
            lastSyncedAt: new Date()
          };

          if (user) {
            user.name = fullName;
            user.email = email;
            user.employeeId = employee._id; // Ensure linked
            user.isActive = true;
            if (user.isLoginApproved !== false) {
              user.isLoginApproved = true;
            }
            user.ssoData = ssoData;
            await user.save();
          } else {
            const hashedPassword = await PasswordService.hashPassword('EthicSec@2026');
            await User.create({
              organizationId: orgId,
              name: fullName,
              email,
              password: hashedPassword,
              role: 'EMPLOYEE',
              employeeId: employee._id,
              isActive: true,
              isLoginApproved: true,
              ssoData
            });
          }
          updatedCount++;
        } else {
          // Onboard new employee
          const employeeCode = msUser.employeeId || `TEMP-EMP-${email}`;
          employee = await Employee.create({
            organizationId: orgId,
            employeeCode,
            fullName,
            email,
            phone,
            department: dept.name,
            designation: desig.name,
            departmentId: dept._id,
            designationId: desig._id,
            joiningDate,
            salary: 0,
            address,
            emergencyContact: {
              name: 'N/A',
              relationship: 'N/A',
              phone: '9999999999'
            },
            isActive: true
          });

          // Create password-enabled login User
          const hashedPassword = await PasswordService.hashPassword('EthicSec@2026');
          await User.create({
            organizationId: orgId,
            name: fullName,
            email,
            password: hashedPassword,
            role: 'EMPLOYEE',
            employeeId: employee._id,
            isActive: true,
            isLoginApproved: true,
            ssoData: {
              provider: 'MICROSOFT',
              azureRoles: msUser.roles || [],
              jobTitle: msJobTitle,
              department: msDeptName,
              lastSyncedAt: new Date()
            }
          });

          createdCount++;
        }
      } catch (err: any) {
        console.error(`Directory sync failure for ${email}:`, err);
        errors.push(`${email}: ${err.message}`);
      }
    }

    // 6. Write to Audit Logs
    await createAuditLog(
      'EMPLOYEE_SYNC_MICROSOFT',
      emailForAudit,
      'EMPLOYEE',
      'MICROSOFT_SSO',
      `Synchronized corporate accounts. Fetched: ${msUsers.length} | Sync Scope: ${filteredUsers.length} | Created: ${createdCount} | Updated: ${updatedCount} | Errors: ${errors.length}`,
      orgId
    );

    return {
      success: true,
      totalMicrosoftUsers: msUsers.length,
      filteredUsers: filteredUsers.length,
      createdCount,
      updatedCount,
      errors
    };
  }

  /**
   * Approves paid internship phase for an intern based on performance.
   */
  static async approveInternPerformance(
    id: string,
    rating: number,
    notes: string,
    orgId: mongoose.Types.ObjectId | string,
    emailForAudit: string
  ) {
    const employee = await Employee.findOne({ _id: id, organizationId: orgId });
    if (!employee) {
      throw new Error('Intern not found or unauthorized.');
    }
    if (!employee.isIntern) {
      throw new Error('This employee is not registered as an Intern.');
    }

    employee.internshipPerformanceApproved = true;
    employee.internshipPerformanceRating = rating;
    employee.internshipPerformanceReviewNotes = notes;
    employee.internshipStatus = 'PAID';
    await employee.save();

    await createAuditLog(
      'INTERN_PERFORMANCE_APPROVED',
      emailForAudit,
      'EMPLOYEE',
      employee.employeeCode,
      `Approved paid phase for intern ${employee.fullName}. Rating: ${rating}/5`,
      orgId
    );

    return employee;
  }

  /**
   * Converts an intern to a Full-Time employee and provisions an Azure AD account.
   */
  static async convertToFullTime(
    id: string,
    convertData: {
      userPrincipalName: string;
      displayName: string;
      givenName: string;
      surname: string;
      jobTitle?: string;
      department?: string;
      tempPassword?: string;
      selectedLicenses?: string[];
      salary?: number;
      departmentId?: string;
      designationId?: string;
      employeeId: string;
      employeeHireDate: string;
      mobilePhone: string;
    },
    orgId: mongoose.Types.ObjectId | string,
    emailForAudit: string
  ) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Verify employee exists and is an intern
      const employee = await Employee.findOne({ _id: id, organizationId: orgId }).session(session);
      if (!employee) {
        throw new Error('Employee not found or unauthorized.');
      }
      if (!employee.isIntern) {
        throw new Error('This employee is already a full-time employee.');
      }

      if (!convertData.employeeId) {
        throw new Error('Employee ID is required for Azure AD provisioning.');
      }
      if (!convertData.employeeHireDate) {
        throw new Error('Employee Hire/Joining Date is required for Azure AD provisioning.');
      }
      if (!convertData.mobilePhone) {
        throw new Error('Mobile Number is required for Azure AD provisioning.');
      }

      // 2. Create the user in Azure AD
      const { MicrosoftGraphService } = await import('./microsoftGraph.service.js');
      const azureUser = await MicrosoftGraphService.createUserInAzure(orgId, {
        userPrincipalName: convertData.userPrincipalName,
        displayName: convertData.displayName || employee.fullName,
        givenName: convertData.givenName || employee.fullName.split(' ')[0],
        surname: convertData.surname || employee.fullName.split(' ').slice(1).join(' '),
        jobTitle: convertData.jobTitle || employee.designation,
        department: convertData.department || employee.department,
        tempPassword: convertData.tempPassword,
        employeeId: convertData.employeeId,
        employeeHireDate: convertData.employeeHireDate,
        mobilePhone: convertData.mobilePhone,
      });

      // 3. Assign licenses in Azure AD
      if (convertData.selectedLicenses && convertData.selectedLicenses.length > 0) {
        await MicrosoftGraphService.assignLicenses(orgId, azureUser.id, convertData.selectedLicenses);
      }

      // 4. Update local Employee record
      employee.isIntern = false;
      const originalEmail = employee.email;
      employee.email = azureUser.userPrincipalName.toLowerCase();
      employee.internshipStatus = 'COMPLETED';
      employee.fullName = convertData.displayName.trim();
      employee.employeeCode = convertData.employeeId.trim();
      employee.joiningDate = new Date(convertData.employeeHireDate);
      employee.phone = convertData.mobilePhone.trim();

      if (convertData.salary !== undefined) {
        employee.salary = convertData.salary;
      }
      if (convertData.departmentId) {
        employee.departmentId = new mongoose.Types.ObjectId(convertData.departmentId);
        const dept = await Department.findById(convertData.departmentId).session(session);
        if (dept) employee.department = dept.name;
      }
      if (convertData.designationId) {
        employee.designationId = new mongoose.Types.ObjectId(convertData.designationId);
        const desig = await Designation.findById(convertData.designationId).session(session);
        if (desig) employee.designation = desig.name;
      }

      await employee.save({ session });

      // 5. Update User record (map to Azure SSO)
      const ssoData = {
        provider: 'MICROSOFT',
        azureRoles: [],
        jobTitle: employee.designation,
        department: employee.department,
        lastSyncedAt: new Date(),
      };

      await User.findOneAndUpdate(
        {
          $or: [
            { employeeId: employee._id },
            { email: originalEmail.toLowerCase().trim() },
          ],
          organizationId: orgId,
        },
        {
          email: employee.email,
          name: employee.fullName,
          role: 'EMPLOYEE',
          employeeId: employee._id,
          isActive: true,
          isLoginApproved: true,
          password: '', // Disable local password sign in
          ssoData: ssoData,
        },
        { upsert: true, session }
      );

      // 6. Write Audit Log
      await createAuditLog(
        'INTERN_CONVERT_FULLTIME',
        emailForAudit,
        'EMPLOYEE',
        employee.employeeCode,
        `Converted intern ${employee.fullName} to full-time employee and provisioned Azure AD account ${azureUser.userPrincipalName}`,
        orgId
      );

      await session.commitTransaction();
      return employee;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}

