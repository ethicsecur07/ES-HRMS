"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const OrganizationAuthConfig_js_1 = require("./models/OrganizationAuthConfig.js");
dotenv_1.default.config();
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/es-hrms';
async function main() {
    await mongoose_1.default.connect(mongoUri);
    console.log('Connected to MongoDB.');
    const config = await OrganizationAuthConfig_js_1.OrganizationAuthConfig.findOne({ provider: 'MICROSOFT' });
    console.log('Microsoft OAuth Client ID:', config?.clientId || 'NOT_FOUND');
    await mongoose_1.default.disconnect();
}
main().catch(err => {
    console.error(err);
    process.exit(1);
});
