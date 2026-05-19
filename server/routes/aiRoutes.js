import express from 'express';
import aiController from '../controllers/aiController.js';
import { optionalUser } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: '发送消息过快，请稍后再试' }
});

router.post('/chat', chatLimiter, optionalUser, aiController.chat);

// Other AI routes like /extract or /analyze could go here

export default router;
