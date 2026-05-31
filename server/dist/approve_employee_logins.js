"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const User_js_1 = require("./models/User.js");
dotenv_1.default.config();
const approveLogins = async () => {
    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://logapriyanvky_db_user:JOezGJTTfPWNp82A@es-hrms.xsowliv.mongodb.net/?appName=ES-HRMS';
    await mongoose_1.default.connect(mongoURI);
    console.log('Connected to MongoDB Atlas');
    // Find all users with isLoginApproved: false who have EMPLOYEE role
    const result = await User_js_1.User.updateMany({ role: 'EMPLOYEE', isLoginApproved: false }, { $set: { isLoginApproved: true } });
    console.log(`✅ Updated ${result.modifiedCount} employee user account(s) to isLoginApproved: true`);
    // Also list all EMPLOYEE users for verification
    const employees = await User_js_1.User.find({ role: 'EMPLOYEE' }).select('name email isLoginApproved isActive createdAt').lean();
    console.log('\n--- ALL EMPLOYEE USERS ---');
    employees.forEach(u => {
        console.log(`  ${u.isLoginApproved ? '✅' : '❌'} ${u.name} <${u.email}> | approved: ${u.isLoginApproved} | active: ${u.isActive}`);
    });
    await mongoose_1.default.disconnect();
    console.log('\nDone. Disconnected.');
};
approveLogins().catch(console.error);
