"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const run = async () => {
    try {
        const res = await axios_1.default.get('http://localhost:5000/api/public/organization-config/tech');
        console.log('STATUS:', res.status);
        console.log('DATA:', JSON.stringify(res.data, null, 2));
    }
    catch (err) {
        console.error('ERROR:', err.message);
        if (err.response) {
            console.error('RESPONSE DATA:', err.response.data);
        }
    }
};
run();
