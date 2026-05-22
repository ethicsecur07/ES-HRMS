"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const mongoose_1 = __importDefault(require("mongoose"));
const db_js_1 = require("./config/db.js");
const Employee_js_1 = require("./models/Employee.js");
const User_js_1 = require("./models/User.js");
const employee_service_js_1 = require("./services/employee.service.js");
const PasswordService_js_1 = require("./domains/auth-engine/services/PasswordService.js");
const OrganizationStructure_js_1 = require("./models/OrganizationStructure.js");
const organization_controller_js_1 = require("./domains/organization/organization.controller.js");
const leave_controller_js_1 = require("./controllers/leave.controller.js");
const wfh_controller_js_1 = require("./controllers/wfh.controller.js");
dotenv_1.default.config();
const createMockReq = (body, params = {}, query = {}, user = {}) => ({
    body,
    params,
    query,
    user,
    headers: {},
});
const createMockRes = () => {
    const res = {};
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data) => {
        res.jsonData = data;
        return res;
    };
    res.jsonSanitized = (data) => {
        res.jsonData = data;
        return res;
    };
    return res;
};
const runTests = async () => {
    console.log('--- Connecting to DB ---');
    await (0, db_js_1.connectDB)();
    const orgId1 = new mongoose_1.default.Types.ObjectId();
    const orgId2 = new mongoose_1.default.Types.ObjectId();
    console.log('--- 1. Testing Employee Creation & Password Hashing ---');
    await Employee_js_1.Employee.deleteMany({ employeeCode: { $regex: '^VERIFY-' } });
    await User_js_1.User.deleteMany({ email: { $regex: '^emp' } });
    await User_js_1.User.deleteMany({ email: 'test.verification@example.com' });
    await OrganizationStructure_js_1.ReportingHierarchy.deleteMany({});
    const employeeData = {
        employeeCode: 'VERIFY-101',
        fullName: 'Verification Test User',
        email: 'test.verification@example.com',
        phone: '1234567890',
        department: 'Developers',
        designation: 'Software Engineer',
        joiningDate: new Date(),
        salary: 50000,
        address: '123 Test Street, Antigravity City',
        emergencyContact: {
            name: 'Emergency Contact',
            relationship: 'Spouse',
            phone: '0987654321',
        },
    };
    const result = await employee_service_js_1.EmployeeService.createEmployee(employeeData, 'SuperSecurePass123', orgId1, 'admin@test.com');
    console.log('Employee created: ID =', result.employee._id);
    const createdUser = await User_js_1.User.findOne({ email: 'test.verification@example.com', organizationId: orgId1 }).select('+password');
    if (!createdUser) {
        throw new Error('User record was not created!');
    }
    console.log('User created: ID =', createdUser._id);
    const isMatch = await PasswordService_js_1.PasswordService.verifyPassword('SuperSecurePass123', createdUser.password);
    if (!isMatch) {
        throw new Error('Password was not hashed correctly!');
    }
    console.log('✔ Password successfully hashed and verified.');
    try {
        await employee_service_js_1.EmployeeService.createEmployee(employeeData, 'AnotherPass', orgId1, 'admin@test.com');
        throw new Error('Duplicate employee creation was not blocked!');
    }
    catch (error) {
        console.log('✔ Duplicate creation successfully blocked:', error.message);
    }
    console.log('--- 2. Testing Reporting Hierarchy Cycle Detection ---');
    await OrganizationStructure_js_1.ReportingHierarchy.deleteMany({});
    const empA = await employee_service_js_1.EmployeeService.createEmployee({
        ...employeeData,
        employeeCode: 'VERIFY-A',
        email: 'empa@example.com',
    }, 'pass', orgId1, 'admin@test.com');
    const empB = await employee_service_js_1.EmployeeService.createEmployee({
        ...employeeData,
        employeeCode: 'VERIFY-B',
        email: 'empb@example.com',
    }, 'pass', orgId1, 'admin@test.com');
    const empC = await employee_service_js_1.EmployeeService.createEmployee({
        ...employeeData,
        employeeCode: 'VERIFY-C',
        email: 'empc@example.com',
    }, 'pass', orgId1, 'admin@test.com');
    const req1 = createMockReq({
        employeeId: empA.employee._id.toString(),
        primaryManagerId: empB.employee._id.toString(),
    }, {}, {}, { organizationId: orgId1.toString() });
    const res1 = createMockRes();
    await (0, organization_controller_js_1.saveReportingHierarchy)(req1, res1, (err) => { if (err)
        throw err; });
    console.log('Hierarchy A -> B saved.');
    const req2 = createMockReq({
        employeeId: empB.employee._id.toString(),
        primaryManagerId: empC.employee._id.toString(),
    }, {}, {}, { organizationId: orgId1.toString() });
    const res2 = createMockRes();
    await (0, organization_controller_js_1.saveReportingHierarchy)(req2, res2, (err) => { if (err)
        throw err; });
    console.log('Hierarchy B -> C saved.');
    const req3 = createMockReq({
        employeeId: empC.employee._id.toString(),
        primaryManagerId: empA.employee._id.toString(),
    }, {}, {}, { organizationId: orgId1.toString() });
    const res3 = createMockRes();
    await (0, organization_controller_js_1.saveReportingHierarchy)(req3, res3, (err) => { if (err)
        throw err; });
    if (res3.statusCode === 400) {
        console.log('✔ Cycle detection successfully blocked cycle:', res3.jsonData.message);
    }
    else {
        throw new Error('Cycle detection failed to block A -> B -> C -> A circular hierarchy!');
    }
    console.log('--- 3. Testing Tenant Scoping / Cross-Tenant Prevention ---');
    const empTenant2 = await employee_service_js_1.EmployeeService.createEmployee({
        ...employeeData,
        employeeCode: 'VERIFY-T2',
        email: 'empt2@example.com',
    }, 'pass', orgId2, 'admin@test.com');
    const crossTenantReq = createMockReq({
        employeeId: empA.employee._id.toString(),
        primaryManagerId: empTenant2.employee._id.toString(),
    }, {}, {}, { organizationId: orgId1.toString() });
    const crossTenantRes = createMockRes();
    await (0, organization_controller_js_1.saveReportingHierarchy)(crossTenantReq, crossTenantRes, (err) => { if (err)
        throw err; });
    if (crossTenantRes.statusCode === 400) {
        console.log('✔ Cross-tenant hierarchy update successfully blocked:', crossTenantRes.jsonData.message);
    }
    else {
        throw new Error('Allowed cross-tenant hierarchy setup!');
    }
    createdUser.role = 'ADMIN';
    await createdUser.save();
    const leaveReq = createMockReq({
        employeeId: empTenant2.employee._id.toString(),
        leaveType: 'Casual Leave',
        startDate: new Date(),
        endDate: new Date(),
        totalDays: 1,
        reason: 'Vacation',
    }, {}, {}, { id: createdUser._id.toString(), role: 'ADMIN', organizationId: orgId1.toString() });
    const leaveRes = createMockRes();
    await (0, leave_controller_js_1.applyLeave)(leaveReq, leaveRes);
    if (leaveRes.statusCode === 400) {
        console.log('✔ Cross-tenant Leave request successfully blocked:', leaveRes.jsonData.message);
    }
    else {
        throw new Error('Cross-tenant Leave request was allowed!');
    }
    const wfhReq = createMockReq({
        employeeId: empTenant2.employee._id.toString(),
        date: new Date().toISOString().split('T')[0],
        reason: 'Internet issue',
        expectedTasks: 'Code verification',
    }, {}, {}, { id: createdUser._id.toString(), role: 'ADMIN', organizationId: orgId1.toString() });
    const wfhRes = createMockRes();
    await (0, wfh_controller_js_1.applyWFH)(wfhReq, wfhRes);
    if (wfhRes.statusCode === 400) {
        console.log('✔ Cross-tenant WFH request successfully blocked:', wfhRes.jsonData.message);
    }
    else {
        throw new Error('Cross-tenant WFH request was allowed!');
    }
    await Employee_js_1.Employee.deleteMany({ email: { $in: ['test.verification@example.com', 'empa@example.com', 'empb@example.com', 'empc@example.com', 'empt2@example.com'] } });
    await User_js_1.User.deleteMany({ email: { $in: ['test.verification@example.com', 'empa@example.com', 'empb@example.com', 'empc@example.com', 'empt2@example.com'] } });
    await OrganizationStructure_js_1.ReportingHierarchy.deleteMany({});
    console.log('🎉 ALL VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉');
    process.exit(0);
};
runTests().catch((err) => {
    console.error('❌ Verification failed with error:', err);
    process.exit(1);
});
