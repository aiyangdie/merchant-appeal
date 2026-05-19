import userModel from '../models/User.js';
import logger from '../utils/logger.js';
import jwt from 'jsonwebtoken';

class UserService {
  /**
   * Register a new user
   * @param {string} phone 
   * @param {string} nickname 
   */
  async register(phone, nickname) {
    // Input validation
    if (!phone || phone.length < 2 || phone.length > 20) {
      throw new Error('INVALID_PHONE');
    }
    
    // Chinese character validation for nickname could be moved to utils/validation.js
    // For now keeping simple logic here
    if (nickname && nickname.length > 20) {
      throw new Error('INVALID_NICKNAME');
    }

    try {
      const { user, isNew } = await userModel.create(phone, nickname);
      
      // If new user, give initial balance (if configured)
      // This logic should ideally check system config, but for MVP refactor we might hardcode or fetch config
      if (isNew) {
        // TODO: Fetch new_user_balance from SystemConfigModel
        const initialBalance = 1.00; 
        if (initialBalance > 0) {
          await userModel.updateBalance(user.id, initialBalance);
          user.balance = (parseFloat(user.balance) + initialBalance).toFixed(2);
        }
      }
      
      const token = this._generateToken(user.id);
      return { user, token, isNew };
    } catch (error) {
      logger.error('Service: Error registering user', error);
      throw error;
    }
  }

  /**
   * Login user
   * @param {string} phone 
   */
  async login(phone) {
    const user = await userModel.findByPhone(phone);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }
    
    const token = this._generateToken(user.id);
    return { user, token };
  }

  /**
   * Get user profile
   * @param {number} userId 
   */
  async getProfile(userId) {
    const user = await userModel.findById(userId);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }
    return user;
  }

  /**
   * Generate JWT Token
   * @private
   */
  _generateToken(userId) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not configured');
    return jwt.sign({ userId, role: 'user' }, secret, { expiresIn: '24h' });
  }
}

export default new UserService();
