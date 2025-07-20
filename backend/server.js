require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const shipwayRoutes = require('./routes/shipway');

// Import database to initialize it
const database = require('./config/database');

const app = express();
const PORT = process.env.PORT || 5000;

/**
 * Security Middleware
 */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

/**
 * CORS Configuration
 */
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

/**
 * Rate Limiting - TEMPORARILY DISABLED
 */
// const limiter = rateLimit({
//   windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
//   max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
//   message: {
//     success: false,
//     message: 'Too many requests from this IP, please try again later.'
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// Rate limiting temporarily disabled for testing
// app.use((req, res, next) => {
//   // Skip rate limiting for auth routes
//   if (req.path.startsWith('/api/auth')) {
//     return next();
//   }
//   // Apply rate limiting for all other routes
//   return limiter(req, res, next);
// });

/**
 * Body Parsing Middleware
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * Logging Middleware
 */
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

/**
 * Health Check Endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

/**
 * API Routes
 */
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/shipway', shipwayRoutes);

/**
 * API Documentation Endpoint
 */
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Clamio API v1.0.0',
    endpoints: {
      auth: {
        'POST /api/auth/login': 'User login with email and password',
        'POST /api/auth/login/phone': 'User login with phone and password',
        'POST /api/auth/logout': 'User logout',
        'GET /api/auth/profile': 'Get current user profile',
        'PUT /api/auth/change-password': 'Change user password',
        'GET /api/auth/verify': 'Verify JWT token',
        'POST /api/auth/refresh': 'Refresh JWT token'
      },
      users: {
        'POST /api/users': 'Create new user (admin/vendor)',
        'GET /api/users': 'Get all users with pagination',
        'GET /api/users/:id': 'Get user by ID',
        'PUT /api/users/:id': 'Update user',
        'DELETE /api/users/:id': 'Delete user',
        'GET /api/users/role/:role': 'Get users by role',
        'GET /api/users/status/:status': 'Get users by status',
        'PATCH /api/users/:id/toggle-status': 'Toggle user status'
      },
      shipway: {
        'GET /api/shipway/warehouse/:warehouseId': 'Get warehouse details',
        'GET /api/shipway/validate/:warehouseId': 'Validate warehouse ID',
        'GET /api/shipway/test-connection': 'Test Shipway API connection',
        'POST /api/shipway/validate-warehouse': 'Validate warehouse for user creation',
        'POST /api/shipway/multiple-warehouses': 'Get multiple warehouses',
        'GET /api/shipway/stats': 'Get warehouse API statistics'
      }
    },
    authentication: 'Bearer token required for protected routes',
    documentation: 'https://github.com/your-repo/api-docs'
  });
});

/**
 * 404 Handler
 */
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

/**
 * Global Error Handler
 */
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);

  // Handle specific error types
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.errors
    });
  }

  if (error.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized access'
    });
  }

  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired'
    });
  }

  // Default error response
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

/**
 * Graceful Shutdown
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

/**
 * Unhandled Promise Rejection Handler
 */
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

/**
 * Uncaught Exception Handler
 */
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

/**
 * Start Server
 */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API docs: http://localhost:${PORT}/api`);
  
  // Log database initialization
  console.log('📁 Database initialized successfully');
  
  // Log default superadmin credentials
  console.log('👤 Default superadmin: superadmin@example.com / password123');
});

module.exports = app; 