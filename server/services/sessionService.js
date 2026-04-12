import sessionModel from '../models/Session.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

class SessionService {
  /**
   * Create or retrieve a session
   * @param {string|null} sessionId 
   * @param {number|null} userId 
   */
  async getOrCreateSession(sessionId, userId) {
    let session = null;
    let isNew = false;

    if (sessionId) {
      session = await sessionModel.findById(sessionId);
    }

    if (!session) {
      sessionId = uuidv4();
      session = await sessionModel.create(sessionId, userId);
      isNew = true;
    }

    return { session, isNew };
  }

  /**
   * Get session details
   * @param {string} sessionId 
   * @param {number} userId - for authorization check
   */
  async getSession(sessionId, userId) {
    const session = await sessionModel.findById(sessionId);
    if (!session) {
      throw new Error('SESSION_NOT_FOUND');
    }
    
    // Auth check
    if (session.user_id && userId && String(session.user_id) !== String(userId)) {
      throw new Error('FORBIDDEN');
    }

    return session;
  }

  /**
   * Update session field (e.g. user manually editing data)
   * @param {string} sessionId 
   * @param {number} userId 
   * @param {string} key 
   * @param {any} value 
   */
  async updateField(sessionId, userId, key, value) {
    const session = await this.getSession(sessionId, userId);
    
    const collectedData = session.collected_data || {};
    // Simple validation could go here or in a separate logic file
    if (key.length > 50) throw new Error('INVALID_FIELD_KEY');
    
    collectedData[key] = value;
    
    await sessionModel.update(sessionId, { collected_data: collectedData });
    return collectedData;
  }

  /**
   * Get user sessions history
   * @param {number} userId 
   */
  async getUserSessions(userId) {
    return await sessionModel.findByUserId(userId);
  }
}

export default new SessionService();
