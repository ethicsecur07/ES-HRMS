"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const MONGODB_URI = process.env.MONGODB_URI;
async function run() {
    if (!MONGODB_URI) {
        console.error('MONGODB_URI not found in .env');
        return;
    }
    await mongoose_1.default.connect(MONGODB_URI);
    const orgId = '6a1ed6b76cd721e1f9d4e96c';
    const role75Perms = await mongoose_1.default.connection.db.collection('permissions')
        .find({ organizationId: new mongoose_1.default.Types.ObjectId(orgId), roleId: new mongoose_1.default.Types.ObjectId('6a1ed7bc9f5409377f6bed75') })
        .toArray();
    const role76Perms = await mongoose_1.default.connection.db.collection('permissions')
        .find({ organizationId: new mongoose_1.default.Types.ObjectId(orgId), roleId: new mongoose_1.default.Types.ObjectId('6a1ed7bc9f5409377f6bed76') })
        .toArray();
    console.log(`=== ROLE ...75 PERMISSIONS (Count: ${role75Perms.length}) ===`);
    for (const p of role75Perms.slice(0, 5)) {
        console.log(`Module: ${p.module}, Actions: ${JSON.stringify(p.actions)}`);
    }
    console.log(`=== ROLE ...76 PERMISSIONS (Count: ${role76Perms.length}) ===`);
    for (const p of role76Perms.slice(0, 5)) {
        console.log(`Module: ${p.module}, Actions: ${JSON.stringify(p.actions)}`);
    }
    await mongoose_1.default.disconnect();
}
run().catch(console.error);
