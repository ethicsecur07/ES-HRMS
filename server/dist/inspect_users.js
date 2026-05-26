"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const db_js_1 = require("./config/db.js");
const User_js_1 = require("./models/User.js");
dotenv_1.default.config();
const run = async () => {
    await (0, db_js_1.connectDB)();
    const users = await User_js_1.User.find({});
    console.log('Total Users:', users.length);
    for (const u of users) {
        console.log(`Name: ${u.name}, Email: ${u.email}, Role: ${u.role}, Active: ${u.isActive}`);
    }
    process.exit(0);
};
run().catch((err) => {
    console.error(err);
    process.exit(1);
});
