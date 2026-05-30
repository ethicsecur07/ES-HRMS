"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const MONGODB_URI = 'mongodb+srv://logapriyanvky_db_user:JOezGJTTfPWNp82A@es-hrms.xsowliv.mongodb.net/?appName=ES-HRMS';
async function run() {
    console.log('Connecting to database...');
    await mongoose_1.default.connect(MONGODB_URI);
    console.log('Connected!');
    const db = mongoose_1.default.connection.db;
    if (!db) {
        throw new Error('Database connection failed');
    }
    const cycleStart = '2026-05-10';
    const cycleEnd = '2026-06-09';
    const todayStr = '2026-05-30';
    // Let's get both employees
    const employees = await db.collection('employees').find().toArray();
    console.log('\n--- ALL EMPLOYEES ---');
    for (const emp of employees) {
        console.log(`ID: ${emp._id}, Name: ${emp.firstName} ${emp.lastName}, Email: ${emp.email}`);
    }
    console.log('\n--- ATTENDANCE RECORDS FOR CURRENT CYCLE (2026-05-10 - 2026-06-09) ---');
    const cycleAttendances = await db.collection('attendances').find({
        date: { $gte: cycleStart, $lte: cycleEnd }
    }).toArray();
    for (const att of cycleAttendances) {
        const emp = employees.find(e => e._id.toString() === att.employeeId.toString());
        console.log(`Date: ${att.date}, Login: ${att.loginTime}, Employee: ${emp ? emp.firstName : 'Unknown'} (${att.employeeId}), IsLate: ${att.isLate}, Status: ${att.status}`);
    }
    console.log('\n--- LEAVE RECORDS FOR CURRENT CYCLE ---');
    const leaves = await db.collection('leaves').find({
        startDate: { $gte: cycleStart },
        endDate: { $lte: cycleEnd }
    }).toArray();
    for (const l of leaves) {
        const emp = employees.find(e => e._id.toString() === l.employeeId.toString());
        console.log(`StartDate: ${l.startDate}, EndDate: ${l.endDate}, Employee: ${emp ? emp.firstName : 'Unknown'}, Reason: ${l.reason}, Status: ${l.status}`);
    }
    await mongoose_1.default.disconnect();
}
run().catch(err => {
    console.error(err);
    process.exit(1);
});
