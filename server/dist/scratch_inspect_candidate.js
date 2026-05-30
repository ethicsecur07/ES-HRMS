"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const Candidate_js_1 = require("./models/Candidate.js");
const applicant_model_js_1 = require("./models/applicant.model.js");
dotenv_1.default.config();
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/es-hrms';
async function main() {
    await mongoose_1.default.connect(mongoUri);
    console.log('Connected to MongoDB.');
    const ids = ['6a1a729a355266c0c48abc85', '6a195d18bd914bb5e99b6062'];
    for (const id of ids) {
        console.log(`\n--- Inspecting ID: ${id} ---`);
        const candidate = await Candidate_js_1.Candidate.findById(id);
        console.log('Candidate in DB:', candidate ? JSON.stringify(candidate, null, 2) : 'NOT FOUND');
        const applicant = await applicant_model_js_1.ApplicantModel.findById(id);
        console.log('Applicant in DB:', applicant ? JSON.stringify(applicant, null, 2) : 'NOT FOUND');
    }
    // List all candidates in DB (first 10)
    const allCandidates = await Candidate_js_1.Candidate.find().limit(10);
    console.log('\nAll Candidates (sample 10):', allCandidates.map(c => ({ id: c._id, name: `${c.firstName} ${c.lastName}`, email: c.email })));
    await mongoose_1.default.disconnect();
}
main().catch(err => {
    console.error(err);
    process.exit(1);
});
