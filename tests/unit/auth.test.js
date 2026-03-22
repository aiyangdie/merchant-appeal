import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import { signToken, requireUser, optionalUser } from '../../server/middleware/auth.js';

describe('Auth Middleware', () => {
  const JWT_SECRET = 'test-jwt-secret-key-for-testing';
  
  beforeEach(() => {
    process.env.JWT_SECRET = JWT_SECRET;
  });

  describe('signToken', () => {
    test('should create a valid JWT token', () => {
      const payload = { userId: 1 };
      const token = signToken(payload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      const decoded = jwt.verify(token, JWT_SECRET);
      expect(decoded.userId).toBe(1);
    });

    test('token should expire in 24 hours', () => {
      const payload = { userId: 1 };
      const token = signToken(payload);
      const decoded = jwt.verify(token, JWT_SECRET);
      
      expect(decoded.exp).toBeDefined();
      const expiresAt = decoded.exp * 1000;
      const now = Date.now();
      const dayInMs = 24 * 60 * 60 * 1000;
      
      expect(expiresAt - now).toBeLessThanOrEqual(dayInMs);
    });
  });

  describe('requireUser', () => {
    let req, res, next;

    beforeEach(() => {
      req = { headers: {} };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
      };
      next = jest.fn();
    });

    test('should return 401 if no authorization header', () => {
      requireUser(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: '请先登录' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 if authorization header does not start with Bearer', () => {
      req.headers.authorization = 'Basic token123';
      
      requireUser(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: '请先登录' });
    });

    test('should return 401 if token is invalid', () => {
      req.headers.authorization = 'Bearer invalid-token';
      
      requireUser(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: '登录已过期，请重新登录' });
    });

    test('should set userId and call next for valid token', () => {
      const token = jwt.sign({ userId: 123 }, JWT_SECRET);
      req.headers.authorization = `Bearer ${token}`;
      
      requireUser(req, res, next);
      
      expect(req.userId).toBe(123);
      expect(next).toHaveBeenCalled();
    });

    test('should return 401 if token has no userId', () => {
      const token = jwt.sign({ role: 'admin' }, JWT_SECRET);
      req.headers.authorization = `Bearer ${token}`;
      
      requireUser(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: '无效的用户凭证' });
    });
  });

  describe('optionalUser', () => {
    let req, res, next;

    beforeEach(() => {
      req = { headers: {} };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
      };
      next = jest.fn();
    });

    test('should call next without userId if no auth header', () => {
      optionalUser(req, res, next);
      
      expect(req.userId).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    test('should set userId for valid token', () => {
      const token = jwt.sign({ userId: 456 }, JWT_SECRET);
      req.headers.authorization = `Bearer ${token}`;
      
      optionalUser(req, res, next);
      
      expect(req.userId).toBe(456);
      expect(next).toHaveBeenCalled();
    });

    test('should ignore invalid token and continue', () => {
      req.headers.authorization = 'Bearer invalid-token';
      
      optionalUser(req, res, next);
      
      expect(req.userId).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });
});
