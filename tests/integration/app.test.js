import request from 'supertest';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

const createTestApp = () => {
  const app = express();
  
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));
  app.use(cors({
    origin: '*',
    credentials: true
  }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/echo', (req, res) => {
    res.json({ received: req.body, query: req.query });
  });

  app.post('/api/echo', (req, res) => {
    res.json({ received: req.body });
  });

  app.use((err, req, res, next) => {
    res.status(500).json({ error: 'Internal Server Error' });
  });

  return app;
};

describe('Express App Configuration', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('Security Headers', () => {
    test('should include helmet security headers', async () => {
      const response = await request(app).get('/api/health');
      
      expect(response.headers['x-dns-prefetch-control']).toBeDefined();
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('CORS', () => {
    test('should allow cross-origin requests', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Origin', 'http://example.com');
      
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('JSON Parsing', () => {
    test('should parse JSON body', async () => {
      const response = await request(app)
        .post('/api/echo')
        .send({ test: 'data' });
      
      expect(response.status).toBe(200);
      expect(response.body.received).toEqual({ test: 'data' });
    });

    test('should reject large payloads over 1MB', async () => {
      const largePayload = { data: 'x'.repeat(2 * 1024 * 1024) };
      
      const response = await request(app)
        .post('/api/echo')
        .send(largePayload);
      
      expect(response.status).toBe(413);
    });
  });

  describe('Health Check', () => {
    test('should return ok status', async () => {
      const response = await request(app).get('/api/health');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
    });
  });
});
