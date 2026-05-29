import { Request, Response } from 'express';
import { ApplicantService } from '../services/applicant.service.js';

export class ApplicantController {
  static async submitApplication(req: Request, res: Response): Promise<void> {
    try {
      const { name, email, mobile, role } = req.body;

      if (!req.file) {
        res.status(400).json({ message: 'Resume is required' });
        return;
      }

      const resumeUrl = await ApplicantService.uploadResume(req.file);

      const applicant = await ApplicantService.createApplicant({
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
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async getAll(req: Request, res: Response): Promise<void> {
    try {
      const applicants = await ApplicantService.getAllApplicants();
      res.json({ data: applicants });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const applicant = await ApplicantService.getApplicantById(req.params.id);

      if (!applicant) {
        res.status(404).json({ message: 'Applicant not found' });
        return;
      }

      res.json({ data: applicant });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
}
