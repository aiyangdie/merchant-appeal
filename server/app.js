import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './utils/logger.js';
import db from './config/database.js';
import { initSchema } from './config/initDb.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// --- Middlewares ---
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));

// --- Request Logging ---
app.use((req, res, next) => {
  logger.http(`${req.method} ${req.url} - ${req.ip}`);
  next();
});

// --- Routes ---
app.use('/api', routes);

// --- Static Files ---
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res, next) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(distPath, 'index.html'));
  } else {
    next(); // Pass to 404 handler
  }
});

// --- Error Handling ---
app.use(notFoundHandler);
app.use(errorHandler);

// --- Initialization ---
async function startServer() {
  try {
    // 1. Init Database
    await db.init();
    await initSchema();
    
    // 2. Start Listen
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`👉 http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('❌ Server startup failed:', error);
    process.exit(1);
  }
}

import { pathToFileURL } from 'url';

// Only start if run directly (not imported by tests)
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}

export default app;
