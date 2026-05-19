import express from 'express';
import appealController from '../controllers/appealController.js';
import { requireUser } from '../middleware/auth.js';

const router = express.Router();

// Generate appeal text (usually triggers AI, but controller handles flow)
router.post('/generate', requireUser, appealController.generate);

// Get appeal text for a session
router.get('/:sessionId', requireUser, appealController.getAppeal);

// Submit feedback or update status
router.post('/feedback', requireUser, appealController.updateStatus);

export default router;
