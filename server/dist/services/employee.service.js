"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Employee_js_1 = require("../models/Employee.js");
const User_js_1 = require("../models/User.js");
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
    static async createEmployee(employeeData, password, orgId, emailForAudit) {
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        try {
            if (!employeeData.employeeCode) {
                employeeData.employeeCode = await EmployeeService.generateNextEmployeeCode(orgId);
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
            // 3. Create Employee record
            const [employee] = await Employee_js_1.Employee.create([{
                    ...employeeData,
                    isActive: true,
                    organizationId: orgId,
                }], { session });
            // 4. Create corresponding login account (User)
            await User_js_1.User.create([{
                    organizationId: orgId,
                    name: employee.fullName,
                    email: employee.email,
                    password: hashedPassword,
                    role: 'EMPLOYEE',
                    employeeId: employee._id,
                    isActive: true,
                    isLoginApproved: false,
                }], { session });
            await (0, auditLog_service_js_1.createAuditLog)('EMPLOYEE_CREATE', emailForAudit, 'EMPLOYEE', employee.employeeCode, `Onboarded employee ${employee.fullName} and provisioned credentials.`, orgId);
            await session.commitTransaction();
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
     */
    static async updateEmployee(id, updateData, orgId, emailForAudit, userRole) {
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        try {
            const { email, employeeCode } = updateData;
            // 1. Scan for duplicates when email or employeeCode is updated
            if (employeeCode) {
                const codeExists = await Employee_js_1.Employee.findOne({
                    organizationId: orgId,
                    employeeCode,
                    _id: { $ne: id },
                }).session(session);
                if (codeExists) {
                    throw new Error(`Employee with code ${employeeCode} already exists.`);
                }
            }
            if (email) {
                const normalizedEmail = email.toLowerCase().trim();
                const emailExists = await Employee_js_1.Employee.findOne({
                    organizationId: orgId,
                    email: normalizedEmail,
                    _id: { $ne: id },
                }).session(session);
                if (emailExists) {
                    throw new Error(`Employee with email ${email} already exists.`);
                }
            }
            // 2. Perform the update
            const employee = await Employee_js_1.Employee.findOneAndUpdate({ _id: id, organizationId: orgId }, updateData, { new: true, session });
            if (!employee) {
                throw new Error('Employee not found or unauthorized.');
            }
            // 3. Keep corresponding User login details in sync
            const userUpdate = {};
            if (updateData.fullName)
                userUpdate.name = updateData.fullName;
            if (updateData.email)
                userUpdate.email = updateData.email.toLowerCase().trim();
            if (updateData.isActive !== undefined)
                userUpdate.isActive = updateData.isActive;
            if (updateData.isLoginApproved !== undefined) {
                const organization = await Organization_js_1.Organization.findById(orgId).session(session);
                const allowedRoles = organization?.settings?.loginApprovalRoles || ['ADMIN'];
                if (userRole !== 'ADMIN' && !allowedRoles.includes(userRole || '')) {
                    throw new Error('Forbidden: You do not have permission to approve/disapprove logins.');
                }
                userUpdate.isLoginApproved = updateData.isLoginApproved === true || updateData.isLoginApproved === 'true';
            }
            if (Object.keys(userUpdate).length > 0) {
                // Automatically link the employeeId if it's missing on the User document
                userUpdate.employeeId = employee._id;
                await User_js_1.User.findOneAndUpdate({
                    $or: [
                        { employeeId: employee._id },
                        { email: employee.email.toLowerCase().trim() }
                    ],
                    organizationId: orgId
                }, userUpdate, { session });
            }
            await (0, auditLog_service_js_1.createAuditLog)('EMPLOYEE_UPDATE', emailForAudit, 'EMPLOYEE', employee.employeeCode, `Updated profile details for ${employee.fullName}`, orgId);
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
     */
    static async getEmployees(orgId, options = {}) {
        const { search, department, designation, departmentId, designationId, branchId, isActive, page, limit, sortBy, sortOrder } = options;
        const query = { organizationId: orgId };
        const andConditions = [];
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
     * Generates the next sequential employee code for an organization.
     */
    static async generateNextEmployeeCode(orgId) {
        const employees = await Employee_js_1.Employee.find({
            organizationId: orgId,
            $or: [{ isDeleted: true }, { isDeleted: false }, { isDeleted: { $exists: false } }]
        }).select('employeeCode');
        let maxNum = 0;
        const prefix = 'EMP-';
        for (const emp of employees) {
            const code = emp.employeeCode;
            if (!code)
                continue;
            // Match a suffix pattern of digits, e.g. EMP-003 -> 3 or EMP-12 -> 12
            const match = code.match(/(\d+)$/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxNum) {
                    maxNum = num;
                }
            }
        }
        const nextNum = maxNum + 1;
        const padded = String(nextNum).padStart(3, '0');
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
