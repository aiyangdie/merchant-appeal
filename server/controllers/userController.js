import userService from '../services/userService.js';
import logger from '../utils/logger.js';

class UserController {
  /**
   * Handle User Registration
   */
  async register(req, res) {
    try {
      const { phone, nickname } = req.body;
      const result = await userService.register(phone, nickname);
      res.json(result);
    } catch (error) {
      logger.error('Controller: Register error', error);
      if (error.message === 'INVALID_PHONE') return res.status(400).json({ error: '请输入有效的手机号' });
      if (error.message === 'INVALID_NICKNAME') return res.status(400).json({ error: '名称格式不正确' });
      res.status(500).json({ error: '注册失败' });
    }
  }

  /**
   * Handle User Login
   */
  async login(req, res) {
    try {
      const { phone } = req.body;
      if (!phone) return res.status(400).json({ error: '请输入手机号' });
      
      const result = await userService.login(phone);
      res.json(result);
    } catch (error) {
      logger.error('Controller: Login error', error);
      if (error.message === 'USER_NOT_FOUND') return res.status(404).json({ error: '该手机号未注册，请先注册' });
      res.status(500).json({ error: '登录失败' });
    }
  }

  /**
   * Get Current User Profile
   */
  async getProfile(req, res) {
    try {
      const userId = req.userId; // From auth middleware
      const user = await userService.getProfile(userId);
      res.json({ user });
    } catch (error) {
      logger.error('Controller: Get profile error', error);
      if (error.message === 'USER_NOT_FOUND') return res.status(404).json({ error: '用户不存在' });
      res.status(500).json({ error: '获取用户信息失败' });
    }
  }
}

export default new UserController();
