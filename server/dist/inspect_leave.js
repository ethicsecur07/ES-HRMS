"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const LeaveService_js_1 = require("./domains/leave-engine/services/LeaveService.js");
const mongoURI = 'mongodb+srv://logapriyanvky_db_user:JOezGJTTfPWNp82A@es-hrms.xsowliv.mongodb.net/?appName=ES-HRMS';
async function main() {
    await mongoose_1.default.connect(mongoURI);
    console.log('Connected to DB');
    const leaveId = '6a196952326f899a2b59ac69';
    const orgId = '605c72ef1f77bcf86cd79000';
    const approverId = '6a19413742dc44db7c864f35';
    const approverEmail = 'abiramip@ethicsecur.co.in';
    try {
        const result = await LeaveService_js_1.LeaveService.approveLeave(leaveId, orgId, approverId, approverEmail);
        console.log('--- APPROVE RESULT ---');
        console.log(result);
    }
    catch (err) {
        console.error('ERROR APPROVING LEAVE:');
        console.error(err);
    }
    await mongoose_1.default.disconnect();
}
main().catch(console.error);
