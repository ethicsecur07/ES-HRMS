"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const db_js_1 = require("./config/db.js");
const Department_js_1 = require("./models/Department.js");
const Designation_js_1 = require("./models/Designation.js");
const employee_service_js_1 = require("./services/employee.service.js");
dotenv_1.default.config();
const run = async () => {
    await (0, db_js_1.connectDB)();
    console.log('--- Current Departments ---');
    const depts = await Department_js_1.Department.find();
    for (const d of depts) {
        console.log(`ID: ${d._id} | Name: ${d.name} | Code: ${d.code}`);
    }
    console.log('--- Current Designations ---');
    const desigs = await Designation_js_1.Designation.find();
    for (const d of desigs) {
        console.log(`ID: ${d._id} | Name: ${d.name} | Code: ${d.code} | DeptId: ${d.departmentId}`);
    }
    if (depts.length > 0 && desigs.length > 0) {
        const orgId = depts[0].organizationId;
        console.log(`Using Org ID: ${orgId}`);
        // Let's generate a code for the first department/designation
        const code = await employee_service_js_1.EmployeeService.generateEmployeeCode(orgId, depts[0]._id.toString(), desigs[0]._id.toString(), false);
        console.log(`Generated code for normal employee: ${code}`);
        const codeIntern = await employee_service_js_1.EmployeeService.generateEmployeeCode(orgId, depts[0]._id.toString(), desigs[0]._id.toString(), true);
        console.log(`Generated code for intern: ${codeIntern}`);
    }
    process.exit(0);
};
run().catch(err => {
    console.error(err);
    process.exit(1);
});
