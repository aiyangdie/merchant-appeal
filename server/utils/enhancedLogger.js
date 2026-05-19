import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, requestId, ...meta }) => {
    const reqId = requestId ? `[${requestId}] ` : '';
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `${timestamp} ${level}: ${reqId}${message} ${metaStr}`;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'merchant-appeal' },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

export const requestLogger = (req, res, next) => {
  const requestId = uuidv4();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  
  const startTime = Date.now();
  
  logger.info(`Incoming request`, {
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info(`Request completed`, {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
  });
  
  next();
};

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class AuthenticationError extends AppError {
  constructor(message = '认证失败') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message = '权限不足') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(message = '资源不存在') {
    super(message, 404, 'NOT_FOUND');
  }
}

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export const errorHandler = (err, req, res, next) => {
  const requestId = req.requestId || 'unknown';
  
  logger.error('Error occurred', {
    requestId,
    error: err.message,
    stack: err.stack,
    code: err.code,
    statusCode: err.statusCode,
    path: req.path,
    method: req.method
  });
  
  const statusCode = err.statusCode || 500;
  const response = {
    success: false,
    error: err.message || '服务器内部错误',
    code: err.code || 'INTERNAL_ERROR',
    requestId
  };
  
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }
  
  res.status(statusCode).json(response);
};

export default logger;
