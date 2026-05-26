"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const db_js_1 = require("./config/db.js");
const Organization_js_1 = require("./models/Organization.js");
dotenv_1.default.config();
const run = async () => {
    await (0, db_js_1.connectDB)();
    const org = await Organization_js_1.Organization.findById('605c72ef1f77bcf86cd79000');
    if (org) {
        console.log('--- ORGANIZATION DETAILS ---');
        console.log('ID:', org._id);
        console.log('Name:', org.name);
        console.log('Slug:', org.slug);
        console.log('isActive:', org.isActive);
    }
    else {
        console.log('Organization not found!');
    }
    const allOrgs = await Organization_js_1.Organization.find({});
    console.log('All Orgs:');
    for (const o of allOrgs) {
        console.log(`  ID: ${o._id}, Name: ${o.name}, Slug: ${o.slug}, Active: ${o.isActive}`);
    }
    process.exit(0);
};
run().catch((err) => {
    console.error(err);
    process.exit(1);
});
