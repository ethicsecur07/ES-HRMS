import { Router } from 'express';
import { createCandidate, getCandidates, updateCandidateStage, updateCandidate, deleteCandidate, sendCandidateOffer, getOfferTemplate, updateOfferTemplate, getCandidateOfferLetter } from './recruitment.controller.js';
import { rbacGuard } from '../../middlewares/rbacGuard.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

// Assuming 'RECRUITMENT' module code
router.post('/', authenticate as any, rbacGuard('RECRUITMENT', 'create'), createCandidate);
router.get('/', authenticate as any, rbacGuard('RECRUITMENT', 'view'), getCandidates);
router.get('/templates/default', authenticate as any, rbacGuard('RECRUITMENT', 'view'), getOfferTemplate as any);
router.put('/templates/default', authenticate as any, rbacGuard('RECRUITMENT', 'edit'), updateOfferTemplate as any);
router.put('/:id/stage', authenticate as any, rbacGuard('RECRUITMENT', 'edit'), updateCandidateStage);
router.put('/:id', authenticate as any, rbacGuard('RECRUITMENT', 'edit'), updateCandidate);
router.delete('/:id', authenticate as any, rbacGuard('RECRUITMENT', 'delete'), deleteCandidate);
router.post('/:id/send-offer', authenticate as any, rbacGuard('RECRUITMENT', 'edit'), sendCandidateOffer as any);
router.get('/:id/offer-letter', authenticate as any, rbacGuard('RECRUITMENT', 'view'), getCandidateOfferLetter as any);

export default router;
