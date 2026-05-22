import { Router } from 'express';
import { getConversation, sendMessage } from './chat.controller.js';

const router = Router();

router.get('/:otherUserId', getConversation);
router.post('/', sendMessage);

export default router;
