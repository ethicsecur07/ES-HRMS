import { Router } from 'express';
import { ApplicantController } from '../controllers/applicant.controller.js';
import { upload } from '../middleware/upload.middleware.js';

const router = Router();

router.post(
  '/apply',
  upload.single('resume'),
  ApplicantController.submitApplication
);

router.get('/', ApplicantController.getAll);
router.get('/:id', ApplicantController.getById);

export default router;
