import express from 'express';
import rechargeController from '../controllers/rechargeController.js';
import { requireUser, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// User: Create recharge order
router.post('/recharge', requireUser, rechargeController.createOrder);

// User: Get my recharge history
router.get('/recharge/history', requireUser, rechargeController.getMyOrders);

// Admin: Confirm recharge (Moved to admin routes ideally, but putting here for context)
// router.post('/recharge/:id/confirm', requireAdmin, rechargeController.confirmOrder);

export default router;
