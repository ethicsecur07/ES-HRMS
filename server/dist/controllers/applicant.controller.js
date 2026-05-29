"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplicantController = void 0;
const applicant_service_js_1 = require("../services/applicant.service.js");
class ApplicantController {
    static async submitApplication(req, res) {
        try {
            const { name, email, mobile, role } = req.body;
            if (!req.file) {
                res.status(400).json({ message: 'Resume is required' });
                return;
            }
            const resumeUrl = await applicant_service_js_1.ApplicantService.uploadResume(req.file);
            const applicant = await applicant_service_js_1.ApplicantService.createApplicant({
                name,
                email,
                mobile,
                role,
                resumeUrl
            });
            res.status(201).json({
                message: 'Application submitted successfully',
                data: applicant
            });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
    static async getAll(req, res) {
        try {
            const applicants = await applicant_service_js_1.ApplicantService.getAllApplicants();
            res.json({ data: applicants });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
    static async getById(req, res) {
        try {
            const applicant = await applicant_service_js_1.ApplicantService.getApplicantById(req.params.id);
            if (!applicant) {
                res.status(404).json({ message: 'Applicant not found' });
                return;
            }
            res.json({ data: applicant });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}
exports.ApplicantController = ApplicantController;
