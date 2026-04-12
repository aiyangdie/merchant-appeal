import request from 'supertest';
import express from 'express';
import userRoutes from '../../server/routes/userRoutes.js';
import { signToken } from '../../server/middleware/auth.js';

const app = express();
app.use(express.json());
app.use('/api/user', userRoutes);

describe('User API Endpoints', () => {
  
  describe('POST /api/user/register', () => {
    test('should return 400 if phone is missing', async () => {
      const response = await request(app)
        .post('/api/user/register')
        .send({ nickname: 'Test User' });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should return 400 for invalid phone format', async () => {
      const response = await request(app)
        .post('/api/user/register')
        .send({ phone: '12345', nickname: 'Test' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('手机号');
    });

    test('should return 400 for invalid nickname', async () => {
      const response = await request(app)
        .post('/api/user/register')
        .send({ phone: '13800138000', nickname: 'a' });
      
      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/user/login', () => {
    test('should return 400 if phone is missing', async () => {
      const response = await request(app)
        .post('/api/user/login')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('手机号');
    });

    test('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .post('/api/user/login')
        .send({ phone: '19999999999' });
      
      expect(response.status).toBe(404);
      expect(response.body.error).toContain('未注册');
    });
  });

  describe('GET /api/user/profile', () => {
    test('should return 401 without auth token', async () => {
      const response = await request(app)
        .get('/api/user/profile');
      
      expect(response.status).toBe(401);
      expect(response.body.error).toContain('登录');
    });

    test('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', 'Bearer invalid-token');
      
      expect(response.status).toBe(401);
    });
  });
});
