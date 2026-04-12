import rechargeOrderModel from '../models/RechargeOrder.js';
import logger from '../utils/logger.js';

class RechargeController {
  async createOrder(req, res) {
    try {
      const { amount, paymentMethod, remark } = req.body;
      const userId = req.userId;
      
      if (!amount || amount <= 0) return res.status(400).json({ error: '金额无效' });
      
      const orderId = await rechargeOrderModel.create(userId, amount, paymentMethod, remark);
      res.json({ success: true, orderId });
    } catch (error) {
      logger.error('Create Recharge Order Error', error);
      res.status(500).json({ error: '创建订单失败' });
    }
  }

  async getMyOrders(req, res) {
    try {
      const userId = req.userId;
      const orders = await rechargeOrderModel.findByUserId(userId);
      res.json({ orders });
    } catch (error) {
      logger.error('Get Recharge History Error', error);
      res.status(500).json({ error: '获取记录失败' });
    }
  }
}

export default new RechargeController();
