"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const Organization_js_1 = require("./models/Organization.js");
const MONGODB_URI = 'mongodb+srv://logapriyanvky_db_user:JOezGJTTfPWNp82A@es-hrms.xsowliv.mongodb.net/?appName=ES-HRMS';
async function run() {
    console.log('Connecting to database...');
    await mongoose_1.default.connect(MONGODB_URI);
    console.log('Connected!');
    const org = await Organization_js_1.Organization.findOne({ slug: 'ethicsecur' });
    if (!org) {
        console.log('Organization not found');
        await mongoose_1.default.disconnect();
        return;
    }
    console.log('Initial settings:', JSON.stringify(org.settings, null, 2));
    // Set new visibleDepartments
    if (!org.settings)
        org.settings = {};
    org.settings.visibleDepartments = ['Development', 'Digital Marketing', 'HR'];
    org.markModified('settings');
    console.log('Saving...');
    await org.save();
    console.log('Saved!');
    // Retrieve raw document from MongoDB bypassing Mongoose schema defaults
    const db = mongoose_1.default.connection.db;
    const rawOrg = await db?.collection('organizations').findOne({ slug: 'ethicsecur' });
    console.log('Raw database document settings:', JSON.stringify(rawOrg?.settings, null, 2));
    await mongoose_1.default.disconnect();
}
run().catch(err => {
    console.error(err);
    process.exit(1);
});
