"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Employee_js_1 = require("../models/Employee.js");
const User_js_1 = require("../models/User.js");
const Candidate_js_1 = require("../models/Candidate.js");
const PasswordService_js_1 = require("../domains/auth-engine/services/PasswordService.js");
const auditLog_service_js_1 = require("./auditLog.service.js");
const Department_js_1 = require("../models/Department.js");
const Designation_js_1 = require("../models/Designation.js");
const OrganizationAuthConfig_js_1 = require("../models/OrganizationAuthConfig.js");
const Organization_js_1 = require("../models/Organization.js");
class EmployeeService {
    /**
     * Onboards a new employee, creates their system User account, and hashes their password atomically.
     */
    static async createEmployee(employeeData, password, orgId, emailForAudit, candidateId, leadId) {
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        try {
            if (!employeeData.employeeCode) {
                const isIntern = employeeData.designation?.toLowerCase().includes('intern');
                // Generate code based on department/designation if provided, otherwise fallback to simple prefix
                employeeData.employeeCode = await EmployeeService.generateEmployeeCode(orgId, employeeData.departmentId, employeeData.designationId, isIntern);
            }
            // 1. Pre-flight check for duplicate employeeCode or email within organization
            if (employeeData.employeeCode) {
                const codeExists = await Employee_js_1.Employee.findOne({
                    organizationId: orgId,
                    employeeCode: employeeData.employeeCode,
                }).session(session);
                if (codeExists) {
                    throw new Error(`Employee with code ${employeeData.employeeCode} already exists in this organization.`);
                }
            }
            if (employeeData.email) {
                const normalizedEmail = employeeData.email.toLowerCase().trim();
                const emailExists = await Employee_js_1.Employee.findOne({
                    organizationId: orgId,
                    email: normalizedEmail,
                }).session(session);
                if (emailExists) {
                    throw new Error(`Employee with email ${employeeData.email} already exists in this organization.`);
                }
            }
            // 2. Hash Password for login account
            const defaultPassword = password || 'EthicSec@2026';
            const hashedPassword = await PasswordService_js_1.PasswordService.hashPassword(defaultPassword);
            // Normalize email for consistency
            const normalizedEmail = employeeData.email?.toLowerCase().trim();
            if (normalizedEmail) {
                employeeData.email = normalizedEmail;
            }
            // 3. Create Employee record
            const [employee] = await Employee_js_1.Employee.create([{
                    ...employeeData,
                    isActive: true,
                    organizationId: orgId,
                }], { session });
            const isInternRole = (employee.designation?.toLowerCase().includes('intern') || employee.department?.toLowerCase().includes('intern'));
            await User_js_1.User.findOneAndUpdate({ organizationId: orgId, email: employee.email }, {
                organizationId: orgId,
                name: employee.fullName,
                email: employee.email,
                password: hashedPassword,
                role: isInternRole ? 'INTERN' : 'EMPLOYEE',
                employeeId: employee._id,
                isActive: true,
                isLoginApproved: true,
            }, { upsert: true, session });
            // Apply lead assignment as primaryManagerId if provided
            if (leadId && mongoose_1.default.isValidObjectId(leadId)) {
                employee.primaryManagerId = new mongoose_1.default.Types.ObjectId(leadId);
                await employee.save({ session });
            }
            await (0, auditLog_service_js_1.createAuditLog)('EMPLOYEE_CREATE', emailForAudit, 'EMPLOYEE', employee.employeeCode, `Onboarded employee ${employee.fullName} and provisioned credentials.`, orgId);
            await session.commitTransaction();
            // Mark candidate as accountCreated (outside the transaction, best effort)
            if (candidateId && mongoose_1.default.isValidObjectId(candidateId)) {
                try {
                    await Candidate_js_1.Candidate.findByIdAndUpdate(candidateId, {
                        accountCreated: true,
                        ...(leadId && mongoose_1.default.isValidObjectId(leadId) ? { assignedLeadId: new mongoose_1.default.Types.ObjectId(leadId) } : {})
                    });
                }
                catch (_) {
                    // non-critical, log only
                }
            }
            return { employee, generatedPassword: defaultPassword };
        }
        catch (error) {
            await session.abortTransaction();
            throw error;
        }
        finally {
            session.endSession();
        }
    }
    /**
     * Updates employee record and synchronizes User credentials.
     * Restricts editable fields exclusively to Emergency, Bank, and Tax details.
     */
    static async updateEmployee(id, updateData, orgId, emailForAudit, userRole) {
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        try {
            // 1. Enforce RBAC access (only ADMIN, HR, and MANAGER roles allowed)
            const allowedRoles = ['ADMIN', 'HR', 'MANAGER'];
            if (!userRole || !allowedRoles.includes(userRole)) {
                throw new Error('Forbidden: Only ADMIN, HR, and MANAGER roles are allowed to edit employee details.');
            }
            // 2. Verify employee exists within the organization
            const existingEmployee = await Employee_js_1.Employee.findOne({ _id: id, organizationId: orgId }).session(session);
            if (!existingEmployee) {
                throw new Error('Employee not found or unauthorized.');
            }
            // 3. Construct safe update payload containing ONLY emergency, bank, and tax details
            const safeUpdateData = {};
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
            const employee = await Employee_js_1.Employee.findOneAndUpdate({ _id: id, organizationId: orgId }, safeUpdateData, { new: true, session });
            if (!employee) {
                throw new Error('Employee not found or unauthorized.');
            }
            // 5. Keep corresponding User login details in sync (primarily for active/deactive status)
            const userUpdate = {};
            if (safeUpdateData.isActive !== undefined) {
                userUpdate.isActive = safeUpdateData.isActive;
            }
            if (updateData.isLoginApproved !== undefined) {
                const organization = await Organization_js_1.Organization.findById(orgId).session(session);
                const allowedRolesForLogin = organization?.settings?.loginApprovalRoles || ['ADMIN'];
                if (userRole !== 'ADMIN' && !allowedRolesForLogin.includes(userRole || '')) {
                    throw new Error('Forbidden: You do not have permission to approve/disapprove logins.');
                }
                userUpdate.isLoginApproved = updateData.isLoginApproved === true || updateData.isLoginApproved === 'true';
            }
            if (Object.keys(userUpdate).length > 0) {
                userUpdate.employeeId = employee._id;
                await User_js_1.User.findOneAndUpdate({
                    $or: [
                        { employeeId: employee._id },
                        { email: employee.email.toLowerCase().trim() }
                    ],
                    organizationId: orgId
                }, userUpdate, { session });
            }
            await (0, auditLog_service_js_1.createAuditLog)('EMPLOYEE_UPDATE', emailForAudit, 'EMPLOYEE', employee.employeeCode, `Updated emergency/bank/tax details for ${employee.fullName}`, orgId);
            const user = await User_js_1.User.findOne({
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
        }
        catch (error) {
            await session.abortTransaction();
            throw error;
        }
        finally {
            session.endSession();
        }
    }
    /**
     * Retrieves list of employees with support for search, pagination, and sorting.
     * Restricts employees to only those with approved and active login accounts by default (Payroll, Documents, Projects, Chat, etc.).
     */
    static async getEmployees(orgId, options = {}) {
        const { search, department, designation, departmentId, designationId, branchId, isActive, page, limit, sortBy, sortOrder, isLoginApproved } = options;
        const query = { organizationId: orgId };
        const andConditions = [];
        if (isLoginApproved === 'false' || isLoginApproved === false) {
            // Resolve all revoked or inactive users within this organization
            const revokedUsers = await User_js_1.User.find({
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
        }
        else if (isActive === 'false' || isActive === false) {
            // Admin filter: "Inactive Only" is selected, so we allow showing revoked logins for possible reactivation
        }
        else {
            // Default: Strict filter to ONLY show login-approved and active employees
            const approvedUsers = await User_js_1.User.find({
                organizationId: orgId,
                isLoginApproved: true,
                isActive: true
            }).select('employeeId email');
            const approvedEmployeeIds = approvedUsers.map(u => u.employeeId).filter(Boolean);
            const approvedEmails = approvedUsers.map(u => u.email?.toLowerCase().trim()).filter(Boolean);
            andConditions.push({
                $or: [
                    { _id: { $in: approvedEmployeeIds } },
                    { email: { $in: approvedEmails } }
                ]
            });
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
            const dept = await Department_js_1.Department.findById(departmentId);
            if (dept) {
                andConditions.push({
                    $or: [
                        { departmentId: new mongoose_1.default.Types.ObjectId(departmentId) },
                        { department: dept.name }
                    ]
                });
            }
            else {
                andConditions.push({ departmentId: new mongoose_1.default.Types.ObjectId(departmentId) });
            }
        }
        else if (department && department !== 'All') {
            andConditions.push({ department: department });
        }
        if (designationId && designationId !== 'All') {
            const desig = await Designation_js_1.Designation.findById(designationId);
            if (desig) {
                andConditions.push({
                    $or: [
                        { designationId: new mongoose_1.default.Types.ObjectId(designationId) },
                        { designation: desig.name }
                    ]
                });
            }
            else {
                andConditions.push({ designationId: new mongoose_1.default.Types.ObjectId(designationId) });
            }
        }
        else if (designation) {
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
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 100;
        const skipNum = (pageNum - 1) * limitNum;
        // Sorting
        const sortField = sortBy || 'createdAt';
        const sortDir = sortOrder === 'asc' ? 1 : -1;
        const sortObj = {};
        sortObj[sortField] = sortDir;
        const total = await Employee_js_1.Employee.countDocuments(query);
        const employees = await Employee_js_1.Employee.find(query)
            .select('-salary -emergencyContact')
            .populate('departmentId', 'name code')
            .populate('designationId', 'name code')
            .sort(sortObj)
            .skip(skipNum)
            .limit(limitNum);
        const employeeIds = employees.map(emp => emp._id);
        const employeeEmails = employees.map(emp => emp.email.toLowerCase().trim());
        const users = await User_js_1.User.find({
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
    static async getEmployeeById(id, orgId) {
        const employee = await Employee_js_1.Employee.findOne({ _id: id, organizationId: orgId })
            .populate('departmentId', 'name code')
            .populate('designationId', 'name code');
        if (!employee) {
            throw new Error('Employee not found');
        }
        const user = await User_js_1.User.findOne({
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
    static async deleteEmployee(id, orgId, emailForAudit) {
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        try {
            const employee = await Employee_js_1.Employee.findOne({ _id: id, organizationId: orgId }).session(session);
            if (!employee) {
                throw new Error('Employee not found');
            }
            // 1. Soft-delete the Employee (this updates isDeleted and deletedAt)
            await employee.softDelete();
            // 2. Revoke User login (soft-delete the user if it supports it, otherwise deactivate)
            const user = await User_js_1.User.findOne({ employeeId: employee._id, organizationId: orgId }).session(session);
            if (user) {
                if (typeof user.softDelete === 'function') {
                    await user.softDelete();
                }
                else {
                    user.isActive = false;
                    await user.save({ session });
                }
            }
            await (0, auditLog_service_js_1.createAuditLog)('EMPLOYEE_DELETE', emailForAudit, 'EMPLOYEE', employee.employeeCode, `Soft-deleted record and revoked user account for ${employee.fullName}`, orgId);
            await session.commitTransaction();
            return true;
        }
        catch (error) {
            await session.abortTransaction();
            throw error;
        }
        finally {
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
    static async generateEmployeeCode(orgId, departmentId, designationId, isIntern) {
        // Base prefix handling
        let prefix = isIntern ? 'INT-' : 'EMP-';
        // If a department is provided and it's not an intern, use its code (fallback to generic)
        if (departmentId && !isIntern) {
            const dept = await Department_js_1.Department.findById(departmentId).select('name');
            const deptCode = dept?.name?.replace(/\s+/g, '').toUpperCase().slice(0, 4) || 'DEP';
            prefix = `${deptCode}-`;
            // If a designation is also provided, incorporate its abbreviation
            if (designationId) {
                const desig = await Designation_js_1.Designation.findById(designationId).select('name');
                const desigCode = desig?.name?.replace(/\s+/g, '').toUpperCase().slice(0, 4) || 'DSG';
                prefix = `${deptCode}-${desigCode}-`;
            }
        }
        // Build a regex to find the highest existing numeric suffix for this prefix
        const regex = new RegExp(`^${prefix}(\\d+)$`);
        const latest = await Employee_js_1.Employee.findOne({
            organizationId: orgId,
            employeeCode: { $regex: regex },
            $or: [{ isDeleted: true }, { isDeleted: false }, { isDeleted: { $exists: false } }]
        })
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
    static async syncMicrosoftEmployees(orgId, emailForAudit) {
        // 1. Fetch active Microsoft SSO configuration
        const msalConfig = await OrganizationAuthConfig_js_1.OrganizationAuthConfig.findOne({
            organizationId: orgId,
            provider: 'MICROSOFT',
            isEnabled: true,
        });
        if (!msalConfig) {
            const error = new Error('Microsoft SSO configuration not found or disabled for this organization. Please configure and enable Microsoft SSO in Organization Settings > SSO Configuration first.');
            error.statusCode = 400;
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
                client_id: msalConfig.clientId,
                client_secret: msalConfig.clientSecret,
                scope: 'https://graph.microsoft.com/.default',
            }),
        });
        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            const error = new Error(`Failed to acquire Microsoft Graph token: ${errorText}. Please verify your Client ID, Client Secret, and Tenant ID settings under SSO Configuration.`);
            error.statusCode = 400;
            throw error;
        }
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;
        // 3. Fetch all directory users from Microsoft Graph (paging supported)
        let msUsers = [];
        let nextLink = `https://graph.microsoft.com/v1.0/users?$select=displayName,givenName,surname,mail,userPrincipalName,jobTitle,department,mobilePhone,businessPhones,employeeId,employeeHireDate,streetAddress,city,state,postalCode,country`;
        while (nextLink) {
            const pageResponse = await fetch(nextLink, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!pageResponse.ok) {
                const errorText = await pageResponse.text();
                const error = new Error(`Failed to fetch users page from Microsoft Graph: ${errorText}. Please check that your Azure Active Directory App Registration has been granted 'User.Read.All' or 'Directory.Read.All' Application Permissions, and that Admin Consent has been granted in your Azure portal.`);
                error.statusCode = 400;
                throw error;
            }
            const pageData = await pageResponse.json();
            msUsers = msUsers.concat(pageData.value || []);
            nextLink = pageData['@odata.nextLink'] || null;
        }
        // 4. Filter strictly to @ethicsecur.co.in and @ethicsecur.com accounts
        const filteredUsers = msUsers.filter((user) => {
            const email = (user.mail || user.userPrincipalName || '').toLowerCase().trim();
            return email.endsWith('@ethicsecur.co.in') || email.endsWith('@ethicsecur.com');
        });
        let createdCount = 0;
        let updatedCount = 0;
        const errors = [];
        // Load active departments and designations for relation mappings
        const allDepts = await Department_js_1.Department.find({ organizationId: orgId });
        const allDesigs = await Designation_js_1.Designation.find({ organizationId: orgId });
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
                    dept = await Department_js_1.Department.create({
                        organizationId: orgId,
                        name: msDeptName,
                        code: deptCode,
                        isActive: true
                    });
                    allDepts.push(dept);
                }
                // Resolve or create Designation
                let desig = allDesigs.find(d => d.name && d.name.toLowerCase() === msJobTitle.toLowerCase() &&
                    (d.departmentId?.toString() === dept._id.toString() || !d.departmentId));
                if (!desig) {
                    const desigCode = 'DSG-' + msJobTitle.substring(0, 3).toUpperCase() + Math.floor(100 + Math.random() * 900);
                    desig = await Designation_js_1.Designation.create({
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
                let employee = await Employee_js_1.Employee.findOne({ organizationId: orgId, email });
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
                    }
                    else {
                        employee.employeeCode = `TEMP-EMP-${email}`;
                    }
                    if (msUser.employeeHireDate) {
                        employee.joiningDate = joiningDate;
                    }
                    employee.isActive = true;
                    await employee.save();
                    // Sync User details
                    let user = await User_js_1.User.findOne({
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
                        user.ssoData = ssoData;
                        await user.save();
                    }
                    else {
                        const hashedPassword = await PasswordService_js_1.PasswordService.hashPassword('EthicSec@2026');
                        await User_js_1.User.create({
                            organizationId: orgId,
                            name: fullName,
                            email,
                            password: hashedPassword,
                            role: 'EMPLOYEE',
                            employeeId: employee._id,
                            isActive: true,
                            isLoginApproved: false,
                            ssoData
                        });
                    }
                    updatedCount++;
                }
                else {
                    // Onboard new employee
                    const employeeCode = msUser.employeeId || `TEMP-EMP-${email}`;
                    employee = await Employee_js_1.Employee.create({
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
                    const hashedPassword = await PasswordService_js_1.PasswordService.hashPassword('EthicSec@2026');
                    await User_js_1.User.create({
                        organizationId: orgId,
                        name: fullName,
                        email,
                        password: hashedPassword,
                        role: 'EMPLOYEE',
                        employeeId: employee._id,
                        isActive: true,
                        isLoginApproved: false,
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
            }
            catch (err) {
                console.error(`Directory sync failure for ${email}:`, err);
                errors.push(`${email}: ${err.message}`);
            }
        }
        // 6. Write to Audit Logs
        await (0, auditLog_service_js_1.createAuditLog)('EMPLOYEE_SYNC_MICROSOFT', emailForAudit, 'EMPLOYEE', 'MICROSOFT_SSO', `Synchronized corporate accounts. Fetched: ${msUsers.length} | Sync Scope: ${filteredUsers.length} | Created: ${createdCount} | Updated: ${updatedCount} | Errors: ${errors.length}`, orgId);
        return {
            success: true,
            totalMicrosoftUsers: msUsers.length,
            filteredUsers: filteredUsers.length,
            createdCount,
            updatedCount,
            errors
        };
    }
}
exports.EmployeeService = EmployeeService;
