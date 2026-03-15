require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const shipwayRoutes = require('./routes/shipway');
const ordersRoutes = require('./routes/orders');
const settlementRoutes = require('./routes/settlements');
const notificationRoutes = require('./routes/notifications');
const inventoryRoutes = require('./routes/inventory');
const publicRoutes = require('./routes/public');
const storeRoutes = require('./routes/stores');
const warehouseMappingRoutes = require('./routes/warehouseMapping');
const analyticsRoutes = require('./routes/analytics');
const tasksRoutes = require('./routes/tasks');

// Import database to initialize it
const database = require('./config/database');
const { fetchAndSaveShopifyProducts } = require('./services/shopifyProductFetcher');
const cron = require('node-cron');
const logger = require('./utils/logger');
const { runMultiStoreMigration } = require('./utils/migrationRunner');
const { runCarriersMigration } = require('./scripts/migrate-carriers-table');
const { runConsolidatedMigration } = require('./utils/consolidatedMigrationRunner');

// Import vendor error tracking middleware
const { trackVendorErrors, handleVendorErrors } = require('./middleware/vendorErrorTracking');

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
 * Note: Added explicit OPTIONS handling and preflight caching for better mobile network support
 */

// Define allowed origins
const allowedOrigins = [
  'https://frontend-dev-production-5a8c.up.railway.app',
  'https://clamiofrontend-production.up.railway.app',
  'https://clamio-frontend-nu.vercel.app',
  "https://claimio.in",
  "https://www.claimio.in",
  "https://dev.claimio.in",
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001'
];

// Add environment variable origin if provided
if (process.env.CORS_ORIGIN) {
  allowedOrigins.push(process.env.CORS_ORIGIN);
}

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, PWAs, or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.info('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 204, // Some legacy browsers choke on 200
  maxAge: 86400 // Cache preflight requests for 24 hours
}));

/**
 * Rate Limiting
 */
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for auth endpoints — 5 attempts per 15 minutes
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: { success: false, message: 'Too many login attempts, please try again later.' }, standardHeaders: true, legacyHeaders: false });
app.use('/api/auth/login', authLimiter);

app.use((req, res, next) => {
  // Skip rate limiting for auth routes (already handled above)
  if (req.path.startsWith('/api/auth')) {
    return next();
  }
  // Apply rate limiting for all other routes
  return limiter(req, res, next);
});

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
 * Database Connection Health Middleware
 * Automatically reconnects if connection is lost after idle periods
 */
app.use(async (req, res, next) => {
  // Skip database check for health, test endpoints, and OPTIONS preflight requests
  if (req.path === '/health' || req.path === '/test' || req.method === 'OPTIONS') {
    return next();
  }

  try {
    // Check if database is available
    if (!database.isMySQLAvailable()) {
      logger.info('🔄 Database not available, attempting to initialize...');
      await database.initializeMySQL();
    }

    // Test connection health (detects stale connections)
    const isHealthy = await database.testConnection();
    if (!isHealthy) {
      logger.info('🔄 Database connection unhealthy, attempting to reconnect...');
      const reconnected = await database.reconnect();

      if (!reconnected) {
        // Reconnection failed, return error
        return res.status(503).json({
          success: false,
          message: 'Database temporarily unavailable',
          error: 'Unable to establish database connection. Please try again in a moment.'
        });
      }
    }

    next();
  } catch (error) {
    logger.error('❌ Database connection failed in middleware:', error.message);

    // For API routes, return error
    if (req.path.startsWith('/api/') || req.path.startsWith('/auth') ||
      req.path.startsWith('/users') || req.path.startsWith('/orders') ||
      req.path.startsWith('/settlements') || req.path.startsWith('/shipway')) {
      return res.status(503).json({
        success: false,
        message: 'Database temporarily unavailable',
        error: 'Service temporarily unavailable. Please try again in a moment.'
      });
    }

    // For other routes, continue
    next();
  }
});

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
 * Simple Test Endpoint (no database required)
 */
app.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Simple test endpoint working',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// /env-check endpoint removed — it was an unauthenticated endpoint that exposed DB credentials.

/**
 * Database Connection Test Endpoint
 */
app.get('/db-test', async (req, res) => {
  try {
    const database = require('./config/database');

    // Test connection health
    const isHealthy = await database.testConnection();

    if (isHealthy) {
      // Try a simple query
      const users = await database.getAllUsers();
      res.json({
        success: true,
        message: 'Database connection successful',
        data: {
          connected: true,
          healthy: true,
          userCount: users.length,
          sampleUser: users[0] || null
        }
      });
    } else {
      // Try to reconnect
      logger.info('🔄 Attempting to reconnect to database...');
      const reconnected = await database.reconnect();

      if (reconnected) {
        const users = await database.getAllUsers();
        res.json({
          success: true,
          message: 'Database reconnected successfully',
          data: {
            connected: true,
            healthy: true,
            reconnected: true,
            userCount: users.length,
            sampleUser: users[0] || null
          }
        });
      } else {
        res.json({
          success: false,
          message: 'Database connection failed and reconnection unsuccessful',
          data: {
            connected: false,
            healthy: false,
            reconnected: false
          }
        });
      }
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database connection test failed',
      error: error.message,
      data: {
        connected: false,
        healthy: false
      }
    });
  }
});

/**
 * Vendor Error Tracking Middleware
 */
app.use('/api', trackVendorErrors);

/**
 * API Routes
 */
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/users', userRoutes);
app.use('/api/shipway', shipwayRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin/inventory', inventoryRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/warehouse-mapping', warehouseMappingRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/tasks', tasksRoutes);


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
app.use(handleVendorErrors);

app.use((error, req, res, next) => {
  logger.error('Global error handler:', error);

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
  logger.info('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

/**
 * Unhandled Promise Rejection Handler
 */
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

/**
 * Uncaught Exception Handler
 */
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

/**
 * Start Server
 */
app.listen(PORT, async () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
  logger.info(`📚 API docs: http://localhost:${PORT}/api`);

  // Log database initialization
  logger.info('📁 Database initialized successfully');

  // Run carriers table migration (if enabled)
  // This migrates carriers table structure and fetches carriers from all active stores
  // Set RUN_PROD_MIGRATION=false in .env to disable
  const runProdMigration = process.env.RUN_PROD_MIGRATION !== 'false';
  if (runProdMigration) {
    try {
      logger.info('\n🔄 Running carriers table migration...');
      const migrationSuccess = await runCarriersMigration();
      if (migrationSuccess) {
        logger.info('✅ Carriers migration completed successfully\n');
      } else {
        logger.error('❌ Carriers migration failed, but server will continue\n');
      }
    } catch (error) {
      logger.error('⚠️ Carriers migration error (server will continue):', error.message);
    }
  } else {
    logger.info('⚠️ Carriers migration disabled (RUN_PROD_MIGRATION=false)\n');
  }

  // Run database migrations on startup (if enabled)
  // This is idempotent and safe to run on every server start
  // Set RUN_MIGRATIONS=false in .env to disable automatic migrations
  const runMigrations = process.env.RUN_MIGRATIONS !== 'false';
  if (runMigrations) {
    try {
      await runMultiStoreMigration();
    } catch (error) {
      logger.error('⚠️ Migration warning (server will continue):', error.message);
    }
  } else {
    logger.info('⚠️ Automatic migrations disabled (RUN_MIGRATIONS=false)');
  }

  // Run consolidated migration (one-time, tracks completion)
  // Set RUN_CONSOLIDATED_MIGRATION=false in .env to disable
  // This migration runs once and tracks completion in utility table
  const runConsolidated = process.env.RUN_CONSOLIDATED_MIGRATION !== 'false';
  if (runConsolidated) {
    try {
      await runConsolidatedMigration();
    } catch (error) {
      logger.error('⚠️ Consolidated migration warning (server will continue):', error.message);
    }
  } else {
    logger.info('⚠️ Consolidated migration disabled (RUN_CONSOLIDATED_MIGRATION=false)');
  }

  // Start periodic database health check (every 15 minutes)
  setInterval(async () => {
    try {
      const isHealthy = await database.testConnection();
      if (!isHealthy) {
        logger.info('⚠️ Database connection unhealthy, attempting to reconnect...');
        const reconnected = await database.reconnect();
        if (reconnected) {
          logger.info('✅ Database reconnected successfully via health check');
        } else {
          logger.error('❌ Database reconnection failed via health check');
        }
      } else {
        logger.info('✅ Database health check passed');
      }
    } catch (error) {
      logger.error('❌ Database health check failed:', error.message);
    }
  }, 15 * 60 * 1000); // Every 15 minutes

  // Initialize user sessions (run once on startup)
  const userSessionService = require('./services/userSessionService');
  try {
    await userSessionService.ensureTokensAndSessions();
    logger.info('✅ User sessions initialized');
  } catch (error) {
    logger.error('❌ User session initialization failed:', error.message);
  }

  // NOTE: Default superadmin credentials and API tokens must NOT be logged.
  // Check your .env file or password manager for credentials.

  // Fetch Shopify products on startup (only if store is configured)
  // This will gracefully skip if no stores are configured yet
  (async () => {
    try {
      const shopifyUrl = process.env.SHOPIFY_PRODUCTS_API_URL || 'https://seq5t1-mz.myshopify.com/admin/api/2025-07/graphql.json';
      const shopifyToken = process.env.SHOPIFY_ACCESS_TOKEN;

      if (shopifyUrl && shopifyToken) {
        const result = await fetchAndSaveShopifyProducts(
          shopifyUrl,
          {
            'X-Shopify-Access-Token': shopifyToken,
            'Content-Type': 'application/json',
          }
        );

        if (result && result.skipped) {
          logger.info('ℹ️ [Shopify] Product fetch skipped - no stores configured yet');
        }
      } else {
        logger.info('ℹ️ [Shopify] Shopify credentials not provided in environment, skipping product fetch');
      }
    } catch (error) {
      // Don't crash the server if product fetch fails
      logger.error('⚠️ [Shopify] Product fetch failed (non-fatal):', error.message);
    }
  })();

  // Start Multi-Store sync cron job (every hour)
  const multiStoreSyncService = require('./services/multiStoreSyncService');
  cron.schedule('0 * * * *', async () => {
    try {
      logger.info('\n[Multi-Store Sync] Starting scheduled sync for all active stores...');
      const result = await multiStoreSyncService.syncAllStores();
      logger.info(`[Multi-Store Sync] Completed! ${result.successfulStores}/${result.totalStores} stores synced, ${result.totalOrders} orders.`);
    } catch (err) {
      logger.error('[Multi-Store Sync] Failed:', err.message);
    }
  });

  // Run once immediately on startup
  (async () => {
    try {
      logger.info('\n[Multi-Store Sync] Starting startup sync for all active stores...');
      const result = await multiStoreSyncService.syncAllStores();
      logger.info(`[Multi-Store Sync] Startup sync completed! ${result.successfulStores}/${result.totalStores} stores synced, ${result.totalOrders} orders.`);
    } catch (err) {
      logger.error('[Multi-Store Sync] Startup sync failed:', err.message);
    }
  })();

  // Start Carrier sync cron job (every 6 hours)
  const carrierSyncService = require('./services/carrierSyncService');
  cron.schedule('0 */6 * * *', async () => {
    try {
      await carrierSyncService.startCarrierSync();
      logger.info('[Carrier Sync] Carriers synced to MySQL.');
    } catch (err) {
      logger.error('[Carrier Sync] Failed:', err.message);
    }
  });
  // Run once immediately on startup
  (async () => {
    try {
      await carrierSyncService.startCarrierSync();
      logger.info('[Carrier Sync] Carriers synced to MySQL (startup).');
    } catch (err) {
      logger.error('[Carrier Sync] Startup sync failed:', err.message);
    }
  })();

  // Start Order Tracking cron jobs
  const orderTrackingService = require('./services/orderTrackingService');

  // Active Orders Tracking - every 1 hour
  cron.schedule('0 * * * *', async () => {
    try {
      logger.info('[Order Tracking] Starting active orders sync...');
      await orderTrackingService.syncActiveOrderTracking();
      logger.info('[Order Tracking] Active orders sync completed.');
    } catch (err) {
      logger.error('[Order Tracking] Active orders sync failed:', err.message);
    }
  });

  // Inactive Orders Tracking - daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    try {
      logger.info('[Order Tracking] Starting inactive orders sync...');
      await orderTrackingService.syncInactiveOrderTracking();
      logger.info('[Order Tracking] Inactive orders sync completed.');
    } catch (err) {
      logger.error('[Order Tracking] Inactive orders sync failed:', err.message);
    }
  });

  // Order Tracking Cleanup - weekly on Sunday at 3 AM
  cron.schedule('0 3 * * 0', async () => {
    try {
      logger.info('[Order Tracking] Starting cleanup of old tracking data...');
      await orderTrackingService.cleanupOldTrackingData();
      logger.info('[Order Tracking] Cleanup completed.');
    } catch (err) {
      logger.error('[Order Tracking] Cleanup failed:', err.message);
    }
  });

  // Product Refresh - daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    try {
      logger.info('[Product Sync] Starting daily product refresh from Shopify...');

      // Check if store is active before syncing
      const database = require('./config/database');
      await database.waitForMySQLInitialization();

      const shopifyUrl = process.env.SHOPIFY_PRODUCTS_API_URL || 'https://seq5t1-mz.myshopify.com/admin/api/2025-07/graphql.json';
      const shopifyToken = process.env.SHOPIFY_ACCESS_TOKEN;

      // Get store from database using Shopify credentials
      const store = await database.getStoreByShopifyCredentials(shopifyUrl, shopifyToken);

      if (!store) {
        logger.info('[Product Sync] ⚠️ Store not found in database for configured Shopify credentials');
        logger.info('[Product Sync] Skipping product refresh until store is configured in admin panel');
        return;
      }

      if (store.status !== 'active') {
        logger.info(`[Product Sync] ⚠️ Store "${store.store_name}" (${store.account_code}) is inactive`);
        logger.info('[Product Sync] Skipping product refresh for inactive store');
        return;
      }

      logger.info(`[Product Sync] Store "${store.store_name}" (${store.account_code}) is active, proceeding with sync...`);

      await fetchAndSaveShopifyProducts(
        shopifyUrl,
        {
          'X-Shopify-Access-Token': shopifyToken,
          'Content-Type': 'application/json',
        },
        true // forceNew = true to ensure fresh data
      );
      logger.info('[Product Sync] Daily product refresh completed.');
    } catch (err) {
      logger.error('[Product Sync] Daily product refresh failed:', err.message);
    }
  });

  // Product Monitor - Check for new products every 24 hours (daily at 3 AM)
  const productMonitorService = require('./services/productMonitorService');
  cron.schedule('0 3 * * *', async () => {
    try {
      logger.info('[Product Monitor] Starting daily check for new products...');
      const result = await productMonitorService.checkNewProducts();
      if (result.success) {
        logger.info(`[Product Monitor] Check completed. Found ${result.count} new product(s).`);
      }
    } catch (err) {
      logger.error('[Product Monitor] Daily check failed:', err.message);
    }
  });

  // RTO Tracking Daily Update - Update days_since_initiated and is_focus at 2 AM (runs with other daily crons)
  cron.schedule('0 2 * * *', async () => {
    try {
      logger.info('[RTO Tracking] Starting daily update for RTO records...');
      const result = await database.updateRTODaysAndFocus();
      logger.info(`[RTO Tracking] Daily update completed. Days updated: ${result.daysUpdated}, Focus updated: ${result.focusUpdated}`);
    } catch (err) {
      logger.error('[RTO Tracking] Daily update failed:', err.message);
    }
  });

  // RTO Inventory Processing - Process delivered RTO orders and update inventory at 4 AM daily
  const rtoInventoryService = require('./services/rtoInventoryService');
  cron.schedule('0 4 * * *', async () => {
    try {
      logger.info('[RTO Inventory] Starting daily RTO inventory processing...');
      const result = await rtoInventoryService.processDeliveredRTOOrders();
      if (result.success) {
        logger.info(`[RTO Inventory] Processing completed. Processed: ${result.processedCount}, Errors: ${result.errorCount || 0}`);
      } else {
        logger.info(`[RTO Inventory] Processing skipped: ${result.message}`);
      }
    } catch (err) {
      logger.error('[RTO Inventory] Processing failed:', err.message);
    }
  });

  // RTO Inventory Cleanup - Delete zero-quantity records older than 48 hours at 6 AM daily
  cron.schedule('0 6 * * *', async () => {
    try {
      logger.info('[RTO Inventory Cleanup] Starting cleanup of zero-quantity records...');
      const result = await database.cleanupZeroQuantityRTOInventory();
      logger.info(`[RTO Inventory Cleanup] Completed. Deleted: ${result.deletedCount} records`);
    } catch (err) {
      logger.error('[RTO Inventory Cleanup] Failed:', err.message);
    }
  });

  // Auto-Reversal & Criticality Cron Job - Every day at 2 AM
  const autoReversalService = require('./services/autoReversalService');
  cron.schedule('0 2 * * *', async () => {
    try {
      logger.info('\n[Daily Maintenance] Starting scheduled tasks (Auto-Reversal & Criticality)...');

      // Run Auto-Reversal
      logger.info('[Auto-Reversal] Processing expired claims...');
      const reversalResult = await autoReversalService.executeAutoReversal();
      if (reversalResult.success) {
        logger.info(`[Auto-Reversal] Completed! Auto-reversed: ${reversalResult.data.auto_reversed} order(s).`);
      } else {
        logger.info(`[Auto-Reversal] Failed: ${reversalResult.message}`);
      }

      // Run Criticality Update
      logger.info('[Claims Criticality] Updating is_critical flags (15-day rule)...');
      const criticalityResult = await autoReversalService.updateClaimsCriticality();
      if (criticalityResult.success) {
        logger.info(`[Claims Criticality] Completed! Affected rows: ${criticalityResult.data.affected_rows}.`);
      } else {
        logger.info(`[Claims Criticality] Failed: ${criticalityResult.message}`);
      }

    } catch (err) {
      logger.error('[Daily Maintenance] Scheduled run failed:', err.message);
    }
  });

  // Run one-time migration to update rto_wh from latest activity location
  (async () => {
    try {
      const rtoWarehouseMigration = require('./migrations/updateRtoWarehouse');
      logger.info('[Migration] Running RTO warehouse migration...');
      const result = await rtoWarehouseMigration.run();
      if (result.skipped) {
        logger.info('[Migration] RTO warehouse migration already completed, skipped.');
      } else if (result.success) {
        logger.info(`[Migration] RTO warehouse migration completed. Updated: ${result.updatedCount}/${result.processedCount}`);
      } else {
        logger.info(`[Migration] RTO warehouse migration failed: ${result.message}`);
      }
    } catch (err) {
      logger.error('[Migration] RTO warehouse migration error:', err.message);
    }
  })();

  // Run active orders tracking once immediately on startup, then process RTO inventory
  (async () => {
    try {
      logger.info('[Order Tracking] Running initial active orders sync on startup...');
      await orderTrackingService.syncActiveOrderTracking();
      logger.info('[Order Tracking] Initial active orders sync completed.');

      // Process RTO inventory AFTER order tracking sync completes
      // This ensures we have the latest delivered orders in rto_tracking table
      try {
        logger.info('[RTO Inventory] Running RTO inventory processing after order sync...');
        const result = await rtoInventoryService.processDeliveredRTOOrders();
        if (result.success) {
          logger.info(`[RTO Inventory] Post-sync processing completed. Processed: ${result.processedCount}`);
        } else {
          logger.info(`[RTO Inventory] Post-sync processing: ${result.message}`);
        }
      } catch (rtoErr) {
        logger.error('[RTO Inventory] Post-sync processing failed:', rtoErr.message);
      }

      // Update RTO days_since_initiated and is_focus on startup
      // This ensures data is current immediately after deployment
      try {
        logger.info('[RTO Tracking] Running days_since_initiated and is_focus update on startup...');
        const rtoResult = await database.updateRTODaysAndFocus();
        logger.info(`[RTO Tracking] Startup update completed. Days updated: ${rtoResult.daysUpdated}, Focus updated: ${rtoResult.focusUpdated}`);
      } catch (rtoUpdateErr) {
        logger.error('[RTO Tracking] Startup update failed:', rtoUpdateErr.message);
      }
    } catch (err) {
      logger.error('[Order Tracking] Initial active orders sync failed:', err.message);
    }
  })();
});

module.exports = app; 
