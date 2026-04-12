import appealModel from '../models/Appeal.js';
import appealService from '../services/appealService.js';
import logger from '../utils/logger.js';

class AppealController {
  async generate(req, res) {
    try {
      const { sessionId } = req.body;
      const userId = req.userId;
      
      const result = await appealService.generateAppeal(sessionId, userId);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Generate Appeal Error', error);
      res.status(500).json({ error: '生成失败' });
    }
  }

  async getAppeal(req, res) {
    try {
      const { sessionId } = req.params;
      const appeal = await appealModel.findBySessionId(sessionId);
      if (!appeal) return res.status(404).json({ error: '尚未生成申诉文案' });
      
      // Auth check could be added here if needed, but session ID is usually UUID
      res.json(appeal);
    } catch (error) {
      logger.error('Get Appeal Error', error);
      res.status(500).json({ error: '获取失败' });
    }
  }

  async updateStatus(req, res) {
    try {
      const { sessionId, status, feedback, rejectionReason } = req.body;
      const userId = req.userId;
      
      await appealModel.updateStatus(sessionId, userId, { status, feedback, rejectionReason });
      res.json({ success: true });
    } catch (error) {
      logger.error('Update Appeal Status Error', error);
      res.status(500).json({ error: '更新失败' });
    }
  }
}

export default new AppealController();
