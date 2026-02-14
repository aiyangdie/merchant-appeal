import express from 'express';
import userRoutes from './userRoutes.js';
import sessionRoutes from './sessionRoutes.js';
import appealRoutes from './appealRoutes.js';
import paymentRoutes from './paymentRoutes.js';
import aiRoutes from './aiRoutes.js';

const router = express.Router();

router.use('/user', userRoutes);
router.use('/sessions', sessionRoutes);
router.use('/appeal', appealRoutes);
router.use('/payment', paymentRoutes);
router.use('/ai', aiRoutes);

export default router;
