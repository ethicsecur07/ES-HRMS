import { Router } from 'express';
import { createCandidate, getCandidates, updateCandidateStage, updateCandidate, deleteCandidate } from './recruitment.controller.js';
import { rbacGuard } from '../../middlewares/rbacGuard.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

// Assuming 'RECRUITMENT' module code
router.post('/', authenticate as any, rbacGuard('RECRUITMENT', 'create'), createCandidate);
router.get('/', authenticate as any, rbacGuard('RECRUITMENT', 'view'), getCandidates);
router.put('/:id/stage', authenticate as any, rbacGuard('RECRUITMENT', 'edit'), updateCandidateStage);
router.put('/:id', authenticate as any, rbacGuard('RECRUITMENT', 'edit'), updateCandidate);
router.delete('/:id', authenticate as any, rbacGuard('RECRUITMENT', 'delete'), deleteCandidate);

export default router;
