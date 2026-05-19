import logger from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  logger.error('Unhandled Error:', err);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    error: message,
    code: err.code || 'INTERNAL_ERROR'
  });
};

export const notFoundHandler = (req, res) => {
  res.status(404).json({ error: 'API Not Found' });
};
