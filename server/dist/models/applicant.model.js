"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplicantModel = void 0;
const mongoose_1 = require("mongoose");
const ApplicantSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    mobile: { type: String, required: true },
    role: { type: String, required: true },
    resumeUrl: { type: String, required: true },
}, { timestamps: true });
exports.ApplicantModel = (0, mongoose_1.model)('Applicant', ApplicantSchema);
