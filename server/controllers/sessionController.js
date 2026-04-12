import sessionService from '../services/sessionService.js';
import logger from '../utils/logger.js';

class SessionController {
  /**
   * Get Session Info
   */
  async getSessionInfo(req, res) {
    try {
      const sessionId = req.params.id;
      const userId = req.userId; // Optional, from middleware
      
      const session = await sessionService.getSession(sessionId, userId);
      
      // In a real refactor, we might want to standardize the response format
      // For now keeping it compatible with frontend expectations if possible, or defining new API contract
      // Frontend expects: { step, collectedData, totalSteps, fields }
      // We might need to import constants for TOTAL_STEPS etc. or move them to config.
      
      res.json({
        step: session.step,
        collectedData: session.collected_data || {},
        // totalSteps: ... // Need to bring in business constants
      });
    } catch (error) {
      logger.error('Controller: Get session error', error);
      if (error.message === 'SESSION_NOT_FOUND') return res.status(404).json({ error: '会话不存在' });
      if (error.message === 'FORBIDDEN') return res.status(403).json({ error: '无权访问' });
      res.status(500).json({ error: '获取会话失败' });
    }
  }

  /**
   * Update a specific field in the session
   */
  async updateField(req, res) {
    try {
      const sessionId = req.params.id;
      const userId = req.userId;
      const { key, value } = req.body;

      const result = await sessionService.updateField(sessionId, userId, key, value);
      res.json({ success: true, collectedData: result });
    } catch (error) {
      logger.error('Controller: Update field error', error);
      if (error.message === 'SESSION_NOT_FOUND') return res.status(404).json({ error: '会话不存在' });
      if (error.message === 'FORBIDDEN') return res.status(403).json({ error: '无权访问' });
      if (error.message === 'INVALID_FIELD_KEY') return res.status(400).json({ error: '字段名无效' });
      res.status(500).json({ error: '更新失败' });
    }
  }

  /**
   * Get all sessions for the current user
   */
  async getUserSessions(req, res) {
    try {
      const userId = req.userId;
      const sessions = await sessionService.getUserSessions(userId);
      res.json({ sessions });
    } catch (error) {
      logger.error('Controller: Get user sessions error', error);
      res.status(500).json({ error: '获取历史记录失败' });
    }
  }
}

export default new SessionController();
