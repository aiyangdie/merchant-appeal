import express from 'express';
import userController from '../controllers/userController.js';
import { requireUser } from '../middleware/auth.js'; // We need to create this middleware
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: '登录尝试过于频繁，请15分钟后再试' }
});

// Public routes
router.post('/register', authLimiter, userController.register);
router.post('/login', authLimiter, userController.login);

// Protected routes
router.get('/profile', requireUser, userController.getProfile);
// router.get('/:id', requireUser, userController.getUserById); // if needed

export default router;
