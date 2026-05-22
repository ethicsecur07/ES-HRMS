"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const Organization_js_1 = require("./models/Organization.js");
const OrganizationAuthConfig_js_1 = require("./models/OrganizationAuthConfig.js");
dotenv_1.default.config();
const check = async () => {
    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://logapriyanvky_db_user:JOezGJTTfPWNp82A@es-hrms.xsowliv.mongodb.net/?appName=ES-HRMS';
    await mongoose_1.default.connect(mongoURI);
    console.log('Connected to DB');
    const orgs = await Organization_js_1.Organization.find().lean();
    console.log('--- ORGANIZATIONS ---');
    console.log(JSON.stringify(orgs, null, 2));
    const authConfigs = await OrganizationAuthConfig_js_1.OrganizationAuthConfig.find().lean();
    console.log('--- AUTH CONFIGS ---');
    console.log(JSON.stringify(authConfigs, null, 2));
    await mongoose_1.default.disconnect();
};
check();
