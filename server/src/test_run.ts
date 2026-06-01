import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import { Department } from './models/Department.js';
import { Designation } from './models/Designation.js';
import { Employee } from './models/Employee.js';
import { EmployeeService } from './services/employee.service.js';

dotenv.config();

const run = async () => {
  await connectDB();
  console.log('--- Current Departments ---');
  const depts = await Department.find();
  for (const d of depts) {
    console.log(`ID: ${d._id} | Name: ${d.name} | Code: ${d.code}`);
  }

  console.log('--- Current Designations ---');
  const desigs = await Designation.find();
  for (const d of desigs) {
    console.log(`ID: ${d._id} | Name: ${d.name} | Code: ${d.code} | DeptId: ${d.departmentId}`);
  }

  if (depts.length > 0 && desigs.length > 0) {
    const orgId = depts[0].organizationId;
    console.log(`Using Org ID: ${orgId}`);

    // Let's generate a code for the first department/designation
    const code = await EmployeeService.generateEmployeeCode(orgId, depts[0]._id.toString(), desigs[0]._id.toString(), false);
    console.log(`Generated code for normal employee: ${code}`);

    const codeIntern = await EmployeeService.generateEmployeeCode(orgId, depts[0]._id.toString(), desigs[0]._id.toString(), true);
    console.log(`Generated code for intern: ${codeIntern}`);
  }
  process.exit(0);
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
