const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const { authenticateBasicAuth, requireAdminOrSuperadmin, requireAnyUser } = require('../middleware/auth');
const carrierServiceabilityService = require('../services/carrierServiceabilityService');
const taskStore = require('../services/taskStore');
const TransactionManager = require('../utils/transactionManager');
const logger = require('../utils/logger');

// Apply authentication to all order routes
router.use(authenticateBasicAuth);

// ─────────────────────────────────────────────────────────────────────────────
// Stage 5 — Input validation helpers (used across bulk endpoints)
// ─────────────────────────────────────────────────────────────────────────────
const MAX_BATCH_SIZE = 200;

/**
 * Validates a bulk-array input (unique_ids / order_ids).
 * Returns { ok: true, items } on success, or { ok: false, message } on failure.
 */
function validateBulkArray(arr, fieldName = 'ids') {
  if (!arr || !Array.isArray(arr)) {
    return { ok: false, message: `${fieldName} must be an array` };
  }
  if (arr.length === 0) {
    return { ok: false, message: `${fieldName} array must not be empty` };
  }
  if (arr.length > MAX_BATCH_SIZE) {
    return { ok: false, message: `Maximum ${MAX_BATCH_SIZE} items per batch request (got ${arr.length})` };
  }
  const nonStrings = arr.filter(id => typeof id !== 'string' || id.trim() === '');
  if (nonStrings.length > 0) {
    return { ok: false, message: `${fieldName} must be an array of non-empty strings` };
  }
  // Deduplicate silently and return cleaned list
  return { ok: true, items: [...new Set(arr.map(id => id.trim()))] };
}

/**
 * Validates a single ID string.
 */
function validateId(id, fieldName = 'id') {
  if (!id || typeof id !== 'string' || id.trim() === '') {
    return { ok: false, message: `${fieldName} must be a non-empty string` };
  }
  return { ok: true, value: id.trim() };
}

/**
 * Validate and clamp pagination params. Returns { page, limit, offset }.
 */
function validatePagination(query) {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 50));
  return { page, limit, offset: (page - 1) * limit };
}

/**
 * Helper function to create notification when label generation fails
 * @param {string} errorMessage - The error message from Shipway API
 * @param {string} orderId - The order ID that failed
 * @param {Object} vendor - The vendor object with id, name, warehouseId
 * @param {string} errorCategory - The error category (e.g., CRITICAL_AUTH, RETRIABLE_PINCODE)
 * @param {string} errorType - The error type (e.g., CRITICAL, RETRIABLE, UNKNOWN)
 */
async function createLabelGenerationNotification(errorMessage, orderId, vendor, errorCategory = 'UNKNOWN_ERROR', errorType = 'UNKNOWN') {
  try {
    logger.info('📢 Creating notification for label generation error...');

    const database = require('../config/database');
    let notificationData = null;

    // Pattern 1: Insufficient Shipping Balance
    if (errorMessage.toLowerCase().includes('insufficient') && errorMessage.toLowerCase().includes('balance')) {
      logger.info('✅ Detected: Insufficient Shipping Balance error');

      // Extract carrier_id from message (format: "carrier id {carrier_id}")
      const carrierMatch = errorMessage.match(/carrier\s+id\s+(\d+)/i);
      const carrierId = carrierMatch ? carrierMatch[1] : null;

      notificationData = {
        type: 'low_balance',
        severity: 'high',
        title: `Add balance to shipway wallet - Order ${orderId}`,
        message: errorMessage,
        order_id: orderId,
        vendor_id: vendor.id,
        vendor_name: vendor.name,
        vendor_warehouse_id: vendor.warehouseId,
        metadata: JSON.stringify({
          carrier_attempted: carrierId,
          error_category: errorCategory,
          error_type: errorType,
          timestamp: new Date().toISOString()
        }),
        error_details: 'Please add balance to shipway wallet and reassign this order'
      };
    }

    // Pattern 2: Delivery pincode not serviceable
    else if (errorMessage.toLowerCase().includes('pincode') && errorMessage.toLowerCase().includes('serviceable')) {
      logger.info('✅ Detected: Delivery pincode not serviceable error');

      // Extract carrier_id from message (format: "carrier id {carrier_id}")
      const carrierMatch = errorMessage.match(/carrier\s+id\s+(\d+)/i);
      const carrierId = carrierMatch ? carrierMatch[1] : null;

      // Extract pincode from message (format: "({pincode})" at end)
      const pincodeMatch = errorMessage.match(/\((\d{6})\)/);
      const pincode = pincodeMatch ? pincodeMatch[1] : null;

      notificationData = {
        type: 'carrier_unavailable',
        severity: 'high',
        title: `Delivery pincode not serviceable - Order ${orderId}`,
        message: errorMessage,
        order_id: orderId,
        vendor_id: vendor.id,
        vendor_name: vendor.name,
        vendor_warehouse_id: vendor.warehouseId,
        metadata: JSON.stringify({
          carrier_attempted: carrierId,
          pincode: pincode,
          error_category: errorCategory,
          error_type: errorType,
          timestamp: new Date().toISOString()
        }),
        error_details: 'Check the serviceability of carrier manually in shipway and assign to vendor'
      };
    }

    // Pattern 3: Order already exists error
    else if (errorMessage.toLowerCase().includes('order already exists')) {
      logger.info('✅ Detected: Order already exists error');

      notificationData = {
        type: 'shipment_assignment_error',
        severity: 'high',
        title: `Order already exists in Shipway - Order ${orderId}`,
        message: errorMessage,
        order_id: orderId,
        vendor_id: vendor.id,
        vendor_name: vendor.name,
        vendor_warehouse_id: vendor.warehouseId,
        metadata: JSON.stringify({
          error_category: errorCategory,
          error_type: errorType,
          timestamp: new Date().toISOString()
        }),
        error_details: 'Enter a valid store code or check if order was previously created. or check if vendor failure rate is high and vendor is blocked'
      };
    }

    // Pattern 4: No priority carriers assigned
    else if (errorMessage.toLowerCase().includes('no priority carriers') ||
      errorMessage.toLowerCase().includes('priority carriers assigned')) {
      logger.info('✅ Detected: No priority carriers assigned error');

      notificationData = {
        type: 'carrier_unavailable',
        severity: 'critical',
        title: `No priority carriers assigned - Order ${orderId}`,
        message: errorMessage,
        order_id: orderId,
        vendor_id: vendor.id,
        vendor_name: vendor.name,
        vendor_warehouse_id: vendor.warehouseId,
        metadata: JSON.stringify({
          error_category: errorCategory,
          error_type: errorType,
          timestamp: new Date().toISOString()
        }),
        error_details: 'Admin needs to assign priority carriers to this order before label generation'
      };
    }

    // Pattern 5: Generic label download error (catch-all for other errors)
    else if (errorMessage.toLowerCase().includes('label') ||
      errorMessage.toLowerCase().includes('download') ||
      errorMessage.toLowerCase().includes('generation')) {
      logger.info('✅ Detected: Generic label/download error');

      notificationData = {
        type: 'label_download_error',
        severity: 'high',
        title: `Label generation failed - Order ${orderId}`,
        message: errorMessage,
        order_id: orderId,
        vendor_id: vendor.id,
        vendor_name: vendor.name,
        vendor_warehouse_id: vendor.warehouseId,
        metadata: JSON.stringify({
          error_category: errorCategory,
          error_type: errorType,
          timestamp: new Date().toISOString()
        }),
        error_details: 'Label generation failed. Please check the error details and resolve the issue.'
      };
    }

    // If we identified a pattern, create the notification
    if (notificationData) {
      logger.info('📝 Creating notification in database:', notificationData);

      // Insert notification into database
      await database.query(
        `INSERT INTO notifications 
        (type, severity, title, message, order_id, vendor_id, vendor_name, vendor_warehouse_id, metadata, error_details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          notificationData.type,
          notificationData.severity,
          notificationData.title,
          notificationData.message,
          notificationData.order_id,
          notificationData.vendor_id,
          notificationData.vendor_name,
          notificationData.vendor_warehouse_id,
          notificationData.metadata,
          notificationData.error_details
        ]
      );

      logger.info('✅ Notification created successfully');
      return true;
    } else {
      logger.info('⚠️ No matching error pattern found for notification');
      return false;
    }

  } catch (error) {
    logger.error('❌ Failed to create notification:', error);
    // Don't throw error - we don't want notification creation failure to break label generation
    return false;
  }
}

/**
 * @route   GET /api/orders
 * @desc    Get all orders from MySQL database
 * @access  Admin, Superadmin
 */
router.get('/', requireAnyUser, async (req, res) => {
  const { status } = req.query;

  // Vendors are only allowed to see 'unclaimed' orders via this main endpoint
  if (req.user.role === 'vendor' && status !== 'unclaimed') {
    return res.status(403).json({
      success: false,
      message: 'Vendors can only access unclaimed orders via this endpoint. Please use specific vendor endpoints for claimed orders.'
    });
  }

  try {
    const database = require('../config/database');

    // Wait for MySQL initialization
    await database.waitForMySQLInitialization();

    if (!database.isMySQLAvailable()) {
      return res.status(500).json({ success: false, message: 'Database connection not available' });
    }

    // 5.2 — Validated + clamped pagination params (limit max 100)
    const { page, limit, offset } = validatePagination(req.query);
    const status = req.query.status || 'unclaimed';
    const search = req.query.search || '';
    const dateFrom = req.query.dateFrom;
    const dateTo = req.query.dateTo;

    logger.info('📄 Orders pagination params:', { page, limit, status, search, dateFrom, dateTo });

    // Use optimized paginated query with LIMIT/OFFSET in SQL
    // This is MUCH faster than fetching all orders and filtering in JavaScript
    const result = await database.getOrdersPaginated({
      status: status || null,
      search: search || '',
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      limit: limit,
      offset: offset
    });

    const paginatedOrders = result.orders;
    const totalCount = result.totalCount;
    const totalQuantity = result.totalQuantity;
    const hasMore = (offset + paginatedOrders.length) < totalCount;

    logger.info('📊 Orders pagination result:', {
      total: totalCount,
      totalQuantity: totalQuantity,
      page: page,
      limit: limit,
      returned: paginatedOrders.length,
      hasMore: hasMore
    });

    return res.status(200).json({
      success: true,
      data: {
        orders: paginatedOrders,
        pagination: {
          page: page,
          limit: limit,
          total: totalCount,
          totalQuantity: totalQuantity,
          hasMore: hasMore,
          returnedCount: paginatedOrders.length
        }
      }
    });
  } catch (err) {
    logger.error('Error getting orders:', err);
    return res.status(500).json({ success: false, message: 'Failed to read orders' });
  }
});


/**
 * @route   GET /api/orders/last-updated
 * @desc    Get the last modification time from MySQL (returns current time for now)
 * @access  Authenticated
 */
router.get('/last-updated', async (req, res) => {
  try {
    const database = require('../config/database');

    // Wait for MySQL initialization
    await database.waitForMySQLInitialization();

    if (!database.isMySQLAvailable()) {
      return res.status(500).json({ success: false, message: 'Database connection not available' });
    }

    // For MySQL, we'll return current time as last updated
    // In the future, we could add a last_updated column to track this
    return res.json({
      success: true,
      data: {
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (err) {
    logger.error('Error getting last updated time:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get last updated time',
      error: err.message
    });
  }
});

/**
 * @route   GET /api/orders/distinct-statuses
 * @desc    Get all distinct order statuses present in the system
 * @access  Admin, Superadmin
 */
router.get('/distinct-statuses', requireAdminOrSuperadmin, async (req, res) => {
  try {
    const database = require('../config/database');

    // Wait for MySQL initialization
    await database.waitForMySQLInitialization();

    if (!database.isMySQLAvailable()) {
      return res.status(500).json({ success: false, message: 'Database connection not available' });
    }

    const statuses = await database.getDistinctOrderStatuses();

    return res.json({
      success: true,
      data: statuses
    });
  } catch (err) {
    logger.error('Error getting distinct statuses:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get distinct statuses',
      error: err.message
    });
  }
});

/**
 * @route   POST /api/orders/verify-status
 * @desc    Verify order statuses in database (for bulk operations verification)
 * @access  Vendor
 */
router.post('/verify-status', async (req, res) => {
  const { unique_ids } = req.body;
  const vendor = req.user;

  logger.info('🔵 VERIFY STATUS REQUEST START');

  if (!unique_ids || !Array.isArray(unique_ids) || unique_ids.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'unique_ids array is required'
    });
  }

  try {
    const database = require('../config/database');

    await database.waitForMySQLInitialization();

    if (!database.isMySQLAvailable()) {
      return res.status(500).json({ success: false, message: 'Database connection not available' });
    }

    // Additional check for vendor session if needed
    if (vendor.role === 'vendor' && vendor.active_session !== 'TRUE') {
      return res.status(401).json({ success: false, message: 'Inactive vendor session' });
    }

    // Fetch orders from database to verify their status
    const orders = await database.getOrdersByUniqueIds(unique_ids);

    // Create a map of unique_id -> status and full order data
    const statusMap = {};
    orders.forEach(order => {
      statusMap[order.unique_id] = {
        unique_id: order.unique_id,
        order_id: order.order_id,
        status: order.status || 'unknown',
        claimed_by: order.claimed_by || null,
        found: true,
        order: order // Include full order object for UI updates
      };
    });

    // Mark orders that weren't found
    unique_ids.forEach(unique_id => {
      if (!statusMap[unique_id]) {
        statusMap[unique_id] = {
          unique_id: unique_id,
          status: 'not_found',
          found: false
        };
      }
    });

    logger.info('✅ Status verification complete');

    return res.json({
      success: true,
      data: {
        statuses: statusMap,
        verified_count: orders.length,
        requested_count: unique_ids.length
      }
    });

  } catch (error) {
    logger.error('❌ VERIFY STATUS ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify order statuses',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/orders/claim
 * @desc    Vendor claims an order row by unique_id
 * @access  Vendor
 */
router.post('/claim', async (req, res) => {
  const { unique_id } = req.body;
  const vendor = req.user;

  logger.info('🔵 CLAIM REQUEST START');

  // 5.2 — Validate unique_id is a non-empty string
  const idCheck = validateId(unique_id, 'unique_id');
  if (!idCheck.ok) {
    return res.status(400).json({ success: false, message: idCheck.message });
  }

  if (vendor.role !== 'vendor') {
    return res.status(403).json({ success: false, message: 'Only vendors can claim orders' });
  }

  if (vendor.active_session !== 'TRUE') {
    return res.status(401).json({ success: false, message: 'Inactive vendor session' });
  }

  const warehouseId = vendor.warehouseId;
  const database = require('../config/database');

  try {
    // Wait for MySQL initialization
    await database.waitForMySQLInitialization();

    if (!database.isMySQLAvailable()) {
      logger.info('❌ MySQL connection not available');
      return res.status(500).json({ success: false, message: 'Database connection not available' });
    }

    // Get order from MySQL
    logger.info('📂 Loading order from MySQL...');
    logger.info('🔍 Looking for unique_id:', unique_id);

    const order = await database.getOrderByUniqueId(unique_id);

    if (!order) {
      logger.info('❌ ORDER NOT FOUND');
      return res.status(404).json({ success: false, message: 'Order row not found' });
    }

    logger.info('✅ ORDER FOUND');

    if (order.status !== 'unclaimed') {
      logger.info('❌ ORDER NOT UNCLAIMED');
      return res.status(400).json({ success: false, message: 'Order row is not unclaimed' });
    }

    // For Shiprocket orders: Change pickup address to vendor's pickup_location before claiming
    const store = await database.getStoreByAccountCode(order.account_code);
    if (store && store.shipping_partner?.toLowerCase() === 'shiprocket') {
      logger.info('📍 Shiprocket order detected — changing pickup address before claim...');

      if (!order.partner_order_id) {
        logger.info('❌ Cannot change pickup address: partner_order_id is missing for order', order.order_id);
        return res.status(400).json({ success: false, message: 'partner_order_id is missing for this Shiprocket order. Cannot change pickup address.' });
      }

      // Get vendor's pickup_location from wh_mapping
      const whMapping = await database.getWhMappingByClaimioWhIdAndAccountCode(warehouseId, order.account_code);
      if (!whMapping || !whMapping.pickup_location) {
        logger.info('❌ Warehouse mapping or pickup_location not found for vendor', warehouseId, 'and store', order.account_code);
        return res.status(400).json({ success: false, message: `Pickup location not configured for your warehouse (${warehouseId}) and store (${order.account_code}). Please contact admin.` });
      }


      try {
        const ShiprocketService = require('../services/shiprocketService');
        const shiprocketService = new ShiprocketService(order.account_code);
        await shiprocketService.changePickupAddress([parseInt(order.partner_order_id)], whMapping.pickup_location);
        logger.info('✅ Pickup address changed successfully');
      } catch (pickupError) {
        logger.error('❌ Failed to change pickup address:', pickupError.message);
        return res.status(500).json({ success: false, message: `Failed to change pickup address on Shiprocket: ${pickupError.message}` });
      }
    }

    // Assign top 3 priority carriers during claim
    // Pass updatedOrder (not original order) so claimed_by is available for Shiprocket serviceability
    logger.info('🚚 ASSIGNING TOP 3 PRIORITY CARRIERS...');
    let priorityCarrier = '';
    try {
      // Build a temporary order object with claimed_by pre-filled for carrier lookup
      const orderForCarrier = { ...order, claimed_by: warehouseId };
      priorityCarrier = await carrierServiceabilityService.getTop3PriorityCarriers(orderForCarrier);
      logger.info(`✅ Top 3 carriers assigned: ${priorityCarrier}`);
    } catch (carrierError) {
      logger.info(`⚠️ Carrier assignment failed (non-fatal): ${carrierError.message}`);
    }

    // 4.2 — Atomic claim: single conditional UPDATE (no race window)
    // If another vendor claimed between our read above and this write, affectedRows=0 → 409
    logger.info('💾 ATOMIC CLAIM TO MYSQL');
    const claimed = await database.atomicClaimOrder(unique_id, warehouseId, priorityCarrier);

    if (!claimed) {
      logger.info('❌ ORDER ALREADY CLAIMED (concurrent request won)');
      return res.status(409).json({ success: false, message: 'Order already claimed by another vendor' });
    }

    logger.info('✅ MYSQL CLAIM SAVED SUCCESSFULLY');
    logger.info('🟢 CLAIM SUCCESS — Order claimed by:', warehouseId);

    // Return the updated order for UI refresh
    const finalOrder = await database.getOrderByUniqueId(unique_id);
    return res.json({ success: true, data: finalOrder || { ...order, status: 'claimed', claimed_by: warehouseId, priority_carrier: priorityCarrier } });


  } catch (error) {
    logger.error('💥 CLAIM ERROR:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * @route   POST /api/orders/bulk-claim
 * @desc    Vendor claims multiple orders by unique_ids
 * @access  Vendor (token required)
 */
router.post('/bulk-claim', async (req, res) => {
  const { unique_ids } = req.body;
  const token = req.headers['authorization'];

  logger.info('🔵 BULK CLAIM REQUEST START');

  // 5.1 + 5.2 — Batch size limit + type validation
  const arrayCheck = validateBulkArray(unique_ids, 'unique_ids');
  if (!arrayCheck.ok) {
    return res.status(400).json({ success: false, message: arrayCheck.message });
  }
  const sanitizedUniqueIds = arrayCheck.items;

  if (!token) {
    return res.status(400).json({ success: false, message: 'unique_ids array and Authorization token required' });
  }

  // Load users from MySQL
  const database = require('../config/database');
  logger.info('📂 Loading users from MySQL...');

  try {
    // Wait for MySQL initialization
    await database.waitForMySQLInitialization();

    if (!database.isMySQLAvailable()) {
      logger.info('❌ MySQL connection not available');
      return res.status(500).json({ success: false, message: 'Database connection not available' });
    }
    const vendor = req.user;

    if (vendor.role !== 'vendor') {
      return res.status(403).json({ success: false, message: 'Only vendors can claim orders' });
    }

    if (vendor.active_session !== 'TRUE') {
      return res.status(401).json({ success: false, message: 'Inactive vendor session' });
    }

    const warehouseId = vendor.warehouseId;
    logger.info('✅ VENDOR FOUND');

    logger.info('🔍 Processing bulk claim for', unique_ids.length, 'orders');

    const successfulClaims = [];
    const failedClaims = [];

    // OPTIMIZATION 1: Fetch all orders in one database query instead of N individual queries
    logger.info('📦 Fetching all orders in bulk...');
    const allOrders = await database.getOrdersByUniqueIds(sanitizedUniqueIds);
    logger.info(`✅ Fetched ${allOrders.length} orders from database`);

    // Create a map for quick lookup: unique_id -> order
    const ordersMap = new Map();
    allOrders.forEach(order => {
      ordersMap.set(order.unique_id, order);
    });

    // Process orders in parallel with concurrency limit
    const CONCURRENCY_LIMIT = 15;
    logger.info(`⚡ Using parallel processing with concurrency limit of ${CONCURRENCY_LIMIT}`);

    // Helper function to process a single order
    const processSingleOrder = async (unique_id) => {
      try {
        logger.info('🔍 Processing unique_id:', unique_id);

        // Get order from the map (already fetched)
        const order = ordersMap.get(unique_id);

        if (!order) {
          logger.info('❌ ORDER NOT FOUND:', unique_id);
          return { success: false, unique_id, reason: 'Order not found' };
        }

        if (order.status !== 'unclaimed') {
          logger.info('❌ ORDER NOT UNCLAIMED:', unique_id, 'Status:', order.status);
          return { success: false, unique_id, reason: 'Order is not unclaimed' };
        }

        // For Shiprocket orders: Change pickup address to vendor's pickup_location before claiming
        const store = await database.getStoreByAccountCode(order.account_code);
        if (store && store.shipping_partner?.toLowerCase() === 'shiprocket') {
          logger.info(`📍 Shiprocket order ${order.order_id} — changing pickup address before claim...`);

          if (!order.partner_order_id) {
            logger.info(`❌ Cannot change pickup address: partner_order_id is missing for order ${order.order_id}`);
            return { success: false, unique_id, reason: 'partner_order_id is missing for this Shiprocket order' };
          }

          const whMapping = await database.getWhMappingByClaimioWhIdAndAccountCode(warehouseId, order.account_code);
          if (!whMapping || !whMapping.pickup_location) {
            logger.info(`❌ Pickup location not configured for vendor ${warehouseId} and store ${order.account_code}`);
            return { success: false, unique_id, reason: `Pickup location not configured for warehouse ${warehouseId}` };
          }

          try {
            const ShiprocketService = require('../services/shiprocketService');
            const shiprocketService = new ShiprocketService(order.account_code);
            await shiprocketService.changePickupAddress([parseInt(order.partner_order_id)], whMapping.pickup_location);
            logger.info(`✅ Pickup address changed for order ${order.order_id}`);
          } catch (pickupError) {
            logger.error(`❌ Failed to change pickup address for order ${order.order_id}:`, pickupError.message);
            return { success: false, unique_id, reason: `Failed to change pickup address: ${pickupError.message}` };
          }
        }

        // 4.3 — Atomic claim in bulk: single conditional UPDATE (race-safe for parallel execution)
        // carrierService needs claimed_by pre-filled — pass a temporary view without writing
        let priorityCarrier = '';
        try {
          const orderForCarrier = { ...order, claimed_by: warehouseId };
          priorityCarrier = await carrierServiceabilityService.getTop3PriorityCarriers(orderForCarrier);
          logger.info(`✅ Top 3 carriers assigned for ${order.order_id}: ${priorityCarrier}`);
        } catch (carrierError) {
          logger.info(`⚠️ Carrier assignment failed for ${order.order_id} (non-fatal): ${carrierError.message}`);
        }

        logger.info('🔄 ATOMIC CLAIMING ORDER:', unique_id);
        const claimed = await database.atomicClaimOrder(unique_id, warehouseId, priorityCarrier);

        if (claimed) {
          logger.info('✅ ORDER CLAIMED SUCCESSFULLY:', unique_id);
          return { success: true, unique_id, order_id: order.order_id };
        } else {
          logger.info('❌ ORDER ALREADY CLAIMED (concurrent request won):', unique_id);
          return { success: false, unique_id, reason: 'Order already claimed by another vendor' };
        }
      } catch (error) {
        logger.info(`💥 ERROR PROCESSING ORDER ${unique_id}:`, error.message);
        return { success: false, unique_id, reason: error.message };
      }
    };

    // Process orders in batches with concurrency limit
    for (let i = 0; i < sanitizedUniqueIds.length; i += CONCURRENCY_LIMIT) {
      const batch = sanitizedUniqueIds.slice(i, i + CONCURRENCY_LIMIT);
      const batchNumber = Math.floor(i / CONCURRENCY_LIMIT) + 1;
      const totalBatches = Math.ceil(sanitizedUniqueIds.length / CONCURRENCY_LIMIT);

      logger.info(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} orders in parallel)...`);

      // Process all orders in this batch in parallel
      const batchResults = await Promise.all(batch.map(processSingleOrder));

      // Collect results
      batchResults.forEach(result => {
        if (result.success) {
          successfulClaims.push({ unique_id: result.unique_id, order_id: result.order_id });
        } else {
          failedClaims.push({ unique_id: result.unique_id, reason: result.reason });
        }
      });

      logger.info(`✅ Batch ${batchNumber}/${totalBatches} completed - Success: ${batchResults.filter(r => r.success).length}, Failed: ${batchResults.filter(r => !r.success).length}`);
    }

    if (successfulClaims.length > 0) {
      logger.info('✅ MYSQL BULK UPDATE COMPLETED');
    }

    logger.info('🟢 BULK CLAIM COMPLETE');

    return res.json({
      success: true,
      data: {
        successful_claims: successfulClaims,
        failed_claims: failedClaims,
        total_requested: unique_ids.length,
        total_successful: successfulClaims.length,
        total_failed: failedClaims.length
      }
    });

  } catch (error) {
    logger.error('💥 BULK CLAIM ERROR:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * @route   GET /api/orders/my-orders
 * @desc    Get vendor's My Orders (not yet manifested)
 * @access  Vendor (token required)
 */
router.get('/my-orders', async (req, res) => {
  logger.info('\n🔵 MY ORDERS REQUEST START');
  logger.info('================================');
  logger.info('📥 Request Headers:', JSON.stringify(req.headers, null, 2));
  logger.info('📥 Request Method:', req.method);
  logger.info('📥 Request URL:', req.url);
  logger.info('📥 Request IP:', req.ip);

  // Extract pagination parameters
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  logger.info('📄 Pagination params:', { page, limit });

  const vendor = req.user;
  const database = require('../config/database');
  try {
    // Wait for MySQL initialization
    await database.waitForMySQLInitialization();

    if (!database.isMySQLAvailable()) {
      logger.info('❌ MySQL connection not available');
      return res.status(500).json({ success: false, message: 'Database connection not available' });
    }

    if (vendor.active_session !== 'TRUE') {
      return res.status(401).json({ success: false, message: 'Inactive vendor session' });
    }

    const warehouseId = vendor.warehouseId;

    // Get My Orders from MySQL
    logger.info('📂 Loading My Orders from MySQL...');

    const myOrders = await database.getMyOrders(warehouseId);

    logger.info('📦 My Orders loaded:', myOrders.length);

    // Group orders by order_id (exact same logic as original Excel flow)
    const groupedOrders = {};

    myOrders.forEach(order => {
      const orderId = order.order_id;

      if (!groupedOrders[orderId]) {
        groupedOrders[orderId] = {
          order_id: orderId,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          customer_address: order.customer_address,
          order_date: order.order_date,
          total_value: 0,
          total_products: 0,
          total_quantity: 0,
          status: order.status,
          is_handover: order.is_handover, // Add is_handover field
          current_shipment_status: order.current_shipment_status, // Add current_shipment_status field
          products: []
        };
      }

      const productValue = parseFloat(order.product_price) || 0;
      const productQuantity = parseInt(order.quantity) || 1;

      groupedOrders[orderId].products.push({
        unique_id: order.unique_id,
        product_name: order.product_name,
        product_code: order.product_code,
        size: order.size || null,
        product_price: order.product_price,
        quantity: order.quantity,
        product_image: order.product_image,
        status: order.status,
        claimed_at: order.claimed_at,
        label_downloaded: order.label_downloaded,
        awb: order.awb,
        carrier_name: order.carrier_name,
        is_manifest: order.is_manifest,
        current_shipment_status: order.current_shipment_status,
        is_handover: order.is_handover
      });

      groupedOrders[orderId].total_value += productValue;
      groupedOrders[orderId].total_products += 1;
      groupedOrders[orderId].total_quantity += productQuantity;
    });

    const groupedOrdersArray = Object.values(groupedOrders).sort((a, b) => {
      return new Date(b.order_date) - new Date(a.order_date);
    });

    logger.info('📊 Grouped My Orders processed:', groupedOrdersArray.length);

    const totalQuantityAcrossAllOrders = groupedOrdersArray.reduce((sum, order) => {
      return sum + order.total_quantity;
    }, 0);

    logger.info('📊 Total quantity across all My Orders:', totalQuantityAcrossAllOrders);

    if (groupedOrdersArray.length > 0) {
    }

    const totalCount = groupedOrdersArray.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedOrders = groupedOrdersArray.slice(startIndex, endIndex);

    const responseData = {
      success: true,
      message: 'My Orders retrieved successfully',
      data: {
        myOrders: paginatedOrders,
        pagination: {
          current_page: page,
          total_pages: Math.ceil(totalCount / limit),
          total_count: totalCount,
          limit: limit,
          has_next: endIndex < totalCount,
          has_prev: page > 1
        },
        summary: {
          total_orders: totalCount,
          total_products: groupedOrdersArray.reduce((sum, order) => sum + order.total_products, 0),
          total_quantity: totalQuantityAcrossAllOrders,
          total_value: groupedOrdersArray.reduce((sum, order) => sum + order.total_value, 0)
        }
      }
    };

    logger.info('✅ MY ORDERS SUCCESS');

    // Debug: Log each grouped order's total_quantity
    if (responseData.data.myOrders.length > 0) {
      responseData.data.myOrders.forEach((order, index) => {
      });
    }

    return res.json(responseData);

  } catch (error) {
    logger.error('❌ MY ORDERS ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error: ' + error.message
    });
  }
});

/**
 * @route   GET /api/orders/handover
 * @desc    Get vendor's Handover Orders (manifested orders)
 * @access  Vendor (token required)
 */
router.get('/handover', async (req, res) => {
  logger.info('\n🔵 HANDOVER ORDERS REQUEST START');
  logger.info('================================');
  logger.info('📥 Request Headers:', JSON.stringify(req.headers, null, 2));
  logger.info('📥 Request Method:', req.method);
  logger.info('📥 Request URL:', req.url);
  logger.info('📥 Request IP:', req.ip);

  // Extract pagination parameters
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  logger.info('📄 Pagination params:', { page, limit });

  const vendor = req.user;
  const database = require('../config/database');
  try {
    // Wait for MySQL initialization
    await database.waitForMySQLInitialization();

    if (!database.isMySQLAvailable()) {
      logger.info('❌ MySQL connection not available');
      return res.status(500).json({ success: false, message: 'Database connection not available' });
    }

    if (vendor.active_session !== 'TRUE') {
      return res.status(401).json({ success: false, message: 'Inactive vendor session' });
    }

    const warehouseId = vendor.warehouseId;

    // Get Handover Orders from MySQL
    logger.info('📂 Loading Handover Orders from MySQL...');

    const handoverOrders = await database.getHandoverOrders(warehouseId);

    logger.info('📦 Handover Orders loaded:', handoverOrders.length);

    // Get shipping partners for all unique account codes
    const uniqueAccountCodes = [...new Set(handoverOrders.map(o => o.account_code).filter(Boolean))];
    let shippingPartnerMap = {};
    if (uniqueAccountCodes.length > 0) {
      try {
        const stores = await database.getStoresByAccountCodes(uniqueAccountCodes);
        stores.forEach(s => { 
          shippingPartnerMap[s.account_code] = s.shipping_partner || 'shipway'; 
        });
      } catch (err) {
        logger.warn('⚠️ Could not fetch store shipping partners:', err.message);
      }
    }

    // Group orders by order_id (exact same logic as original Excel flow)
    const groupedOrders = {};

    handoverOrders.forEach(order => {
      const orderId = order.order_id;

      if (!groupedOrders[orderId]) {
        groupedOrders[orderId] = {
          order_id: orderId,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          customer_address: order.customer_address,
          order_date: order.order_date,
          total_value: 0,
          total_products: 0,
          total_quantity: 0,
          status: order.status,
          is_handover: order.is_handover, // Add is_handover field
          manifest_id: order.manifest_id, // Add manifest_id field
          current_shipment_status: order.current_shipment_status, // Add current_shipment_status field
          account_code: order.account_code, // Add account_code
          shipping_partner: shippingPartnerMap[order.account_code] || 'shipway', // Add shipping_partner
          products: []
        };
      }

      const productValue = parseFloat(order.product_price) || 0;
      const productQuantity = parseInt(order.quantity) || 1;

      groupedOrders[orderId].products.push({
        unique_id: order.unique_id,
        product_name: order.product_name,
        product_code: order.product_code,
        size: order.size || null,
        product_price: order.product_price,
        quantity: order.quantity,
        product_image: order.product_image,
        status: order.status,
        claimed_at: order.claimed_at,
        label_downloaded: order.label_downloaded,
        awb: order.awb,
        carrier_name: order.carrier_name,
        is_manifest: order.is_manifest,
        current_shipment_status: order.current_shipment_status,
        is_handover: order.is_handover
      });

      groupedOrders[orderId].total_value += productValue;
      groupedOrders[orderId].total_products += 1;
      groupedOrders[orderId].total_quantity += productQuantity;
    });

    const groupedOrdersArray = Object.values(groupedOrders).sort((a, b) => {
      return new Date(b.order_date) - new Date(a.order_date);
    });

    logger.info('📊 Grouped Handover Orders processed:', groupedOrdersArray.length);

    const totalQuantityAcrossAllOrders = groupedOrdersArray.reduce((sum, order) => {
      return sum + order.total_quantity;
    }, 0);

    logger.info('📊 Total quantity across all Handover Orders:', totalQuantityAcrossAllOrders);

    if (groupedOrdersArray.length > 0) {
    }

    const totalCount = groupedOrdersArray.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedOrders = groupedOrdersArray.slice(startIndex, endIndex);

    const responseData = {
      success: true,
      message: 'Handover Orders retrieved successfully',
      data: {
        handoverOrders: paginatedOrders,
        pagination: {
          current_page: page,
          total_pages: Math.ceil(totalCount / limit),
          total_count: totalCount,
          limit: limit,
          has_next: endIndex < totalCount,
          has_prev: page > 1
        },
        summary: {
          total_orders: totalCount,
          total_products: groupedOrdersArray.reduce((sum, order) => sum + order.total_products, 0),
          total_quantity: totalQuantityAcrossAllOrders,
          total_value: groupedOrdersArray.reduce((sum, order) => sum + order.total_value, 0)
        }
      }
    };

    logger.info('✅ HANDOVER ORDERS SUCCESS');

    // Debug: Log each grouped order's total_quantity
    if (responseData.data.handoverOrders.length > 0) {
      responseData.data.handoverOrders.forEach((order, index) => {
      });
    }

    return res.json(responseData);

  } catch (error) {
    logger.error('❌ HANDOVER ORDERS ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error: ' + error.message
    });
  }
});

/**
 * @route   GET /api/orders/order-tracking
 * @desc    Get vendor's Order Tracking Orders (orders in handover for 24+ hours)
 * @access  Vendor (token required)
 */
router.get('/order-tracking', async (req, res) => {
  logger.info('\n🔵 ORDER TRACKING ORDERS REQUEST START');
  logger.info('================================');
  logger.info('📥 Request Headers:', JSON.stringify(req.headers, null, 2));
  logger.info('📥 Request Method:', req.method);
  logger.info('📥 Request URL:', req.url);
  logger.info('📥 Request IP:', req.ip);

  const vendor = req.user;
  const database = require('../config/database');
  try {
    // Wait for MySQL initialization
    await database.waitForMySQLInitialization();

    if (!database.isMySQLAvailable()) {
      logger.info('❌ MySQL connection not available');
      return res.status(500).json({ success: false, message: 'Database connection not available' });
    }

    if (vendor.active_session !== 'TRUE') {
      return res.status(401).json({ success: false, message: 'Inactive vendor session' });
    }

    const warehouseId = vendor.warehouseId;

    // Get Order Tracking Orders from MySQL
    logger.info('📂 Loading Order Tracking Orders from MySQL...');

    const trackingOrders = await database.getOrderTrackingOrders(warehouseId);

    logger.info('📦 Order Tracking Orders loaded:', trackingOrders.length);

    // Group orders by order_id (exact same logic as original Excel flow)
    const groupedOrders = {};

    trackingOrders.forEach(order => {
      const orderId = order.order_id;

      if (!groupedOrders[orderId]) {
        groupedOrders[orderId] = {
          order_id: orderId,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          customer_address: order.customer_address,
          order_date: order.order_date,
          total_value: 0,
          total_products: 0,
          total_quantity: 0,
          status: order.status,
          is_handover: order.is_handover,
          manifest_id: order.manifest_id,
          current_shipment_status: order.current_shipment_status,
          handover_at: order.handover_at,
          products: []
        };
      }

      const productValue = parseFloat(order.product_price) || 0;
      const productQuantity = parseInt(order.quantity) || 1;

      groupedOrders[orderId].products.push({
        unique_id: order.unique_id,
        product_name: order.product_name,
        product_code: order.product_code,
        product_price: order.product_price,
        quantity: order.quantity,
        product_image: order.product_image,
        status: order.status,
        claimed_at: order.claimed_at,
        label_downloaded: order.label_downloaded,
        awb: order.awb,
        carrier_name: order.carrier_name,
        is_manifest: order.is_manifest,
        current_shipment_status: order.current_shipment_status,
        is_handover: order.is_handover,
        handover_at: order.handover_at
      });

      groupedOrders[orderId].total_value += productValue;
      groupedOrders[orderId].total_products += 1;
      groupedOrders[orderId].total_quantity += productQuantity;
    });

    const groupedOrdersArray = Object.values(groupedOrders).sort((a, b) => {
      return new Date(b.order_date) - new Date(a.order_date);
    });

    logger.info('📊 Grouped Order Tracking Orders processed:', groupedOrdersArray.length);

    const totalQuantityAcrossAllOrders = groupedOrdersArray.reduce((sum, order) => {
      return sum + order.total_quantity;
    }, 0);

    logger.info('📊 Total quantity across all Order Tracking Orders:', totalQuantityAcrossAllOrders);

    if (groupedOrdersArray.length > 0) {
    }

    const totalCount = groupedOrdersArray.length;

    // Extract pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    logger.info('📄 Order Tracking pagination params:', { page, limit });

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedOrders = groupedOrdersArray.slice(startIndex, endIndex);
    const hasMore = endIndex < totalCount;

    const responseData = {
      success: true,
      message: 'Order Tracking Orders retrieved successfully',
      data: {
        trackingOrders: paginatedOrders,
        pagination: {
          page: page,
          limit: limit,
          total: totalCount,
          hasMore: hasMore,
          returnedCount: paginatedOrders.length
        },
        summary: {
          total_orders: totalCount,
          total_products: groupedOrdersArray.reduce((sum, order) => sum + order.total_products, 0),
          total_quantity: totalQuantityAcrossAllOrders,
          total_value: groupedOrdersArray.reduce((sum, order) => sum + order.total_value, 0)
        }
      }
    };

    logger.info('✅ ORDER TRACKING ORDERS SUCCESS');

    // Debug: Log each grouped order's total_quantity
    if (paginatedOrders.length > 0) {
      paginatedOrders.forEach((order, index) => {
      });
    }

    return res.json(responseData);

  } catch (error) {
    logger.error('❌ ORDER TRACKING ORDERS ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error: ' + error.message
    });
  }
});

/**
 * @route   GET /api/orders/dashboard-stats
 * @desc    Get pre-calculated dashboard statistics for vendor (all card values)
 * @access  Vendor (token required)
 */
router.get('/dashboard-stats', async (req, res) => {
  logger.info('\n📊 DASHBOARD STATS REQUEST START');
  logger.info('================================');

  const vendor = req.user;
  const database = require('../config/database');
  try {
    // Wait for MySQL initialization
    await database.waitForMySQLInitialization();

    if (!database.isMySQLAvailable()) {
      logger.info('❌ MySQL connection not available');
      return res.status(500).json({ success: false, message: 'Database connection not available' });
    }

    if (vendor.active_session !== 'TRUE') {
      return res.status(401).json({ success: false, message: 'Inactive vendor session' });
    }

    const warehouseId = vendor.warehouseId;

    // Calculate all statistics using SQL aggregations (much faster than JavaScript)
    // Run all 4 queries in parallel using connection pool for maximum performance
    logger.info('📊 Calculating dashboard statistics in parallel...');

    // 1. All Orders (unclaimed) - Total Count and Total Quantity
    // Orders that are unclaimed (must match frontend logic: status = 'unclaimed')
    // Status is computed as: CASE WHEN l.current_shipment_status IS NOT NULL AND != '' THEN l.current_shipment_status ELSE c.status END
    // So for status = 'unclaimed', we need:
    //   - (l.current_shipment_status IS NULL OR l.current_shipment_status = '') AND c.status = 'unclaimed'
    //   - OR l.current_shipment_status = 'unclaimed'
    // Also must match getAllOrders filter: (o.is_in_new_order = 1 OR c.label_downloaded = 1)
    const allOrdersQuery = database.query(`
      SELECT 
        COUNT(DISTINCT o.unique_id) as total_count,
        COALESCE(SUM(o.quantity), 0) as total_quantity
      FROM orders o
      LEFT JOIN claims c ON o.unique_id = c.order_unique_id AND o.account_code = c.account_code
      LEFT JOIN labels l ON o.order_id = l.order_id AND o.account_code = l.account_code
      LEFT JOIN store_info s ON o.account_code = s.account_code
      WHERE (
        (
          (l.current_shipment_status IS NULL OR l.current_shipment_status = '') 
          AND c.status = 'unclaimed'
        )
        OR l.current_shipment_status = 'unclaimed'
      )
      AND (o.is_in_new_order = 1 OR c.label_downloaded = 1)
      AND s.status = 'active'
    `);

    // 2. My Orders - Total Count and Total Quantity
    // Orders claimed by this vendor, status claimed or ready_for_handover, not manifested
    // For Shiprocket orders: must have is_in_new_order = 1
    // For Shipway orders: is_in_new_order = 1 OR label_downloaded = 1 (existing logic)
    const myOrdersQuery = database.query(`
      SELECT 
        COUNT(DISTINCT o.order_id) as total_count,
        COALESCE(SUM(o.quantity), 0) as total_quantity
      FROM orders o
      LEFT JOIN claims c ON o.unique_id = c.order_unique_id AND o.account_code = c.account_code
      LEFT JOIN labels l ON o.order_id = l.order_id AND o.account_code = l.account_code
      LEFT JOIN store_info s ON o.account_code = s.account_code
      WHERE c.claimed_by = ?
        AND (c.status = 'claimed' OR c.status = 'ready_for_handover')
        AND (
          (COALESCE(s.shipping_partner, '') = 'Shiprocket' AND o.is_in_new_order = 1)
          OR 
          (COALESCE(s.shipping_partner, '') != 'Shiprocket' AND (o.is_in_new_order = 1 OR c.label_downloaded = 1))
        )
        AND (l.is_manifest IS NULL OR l.is_manifest = 0)
    `, [warehouseId]);

    // 3. Handover - Total Count and Total Quantity
    // Orders claimed by this vendor, manifested (is_manifest=1), not handed over (is_handover=0 or null)
    const handoverQuery = database.query(`
      SELECT 
        COUNT(DISTINCT o.order_id) as total_count,
        COALESCE(SUM(o.quantity), 0) as total_quantity
      FROM orders o
      LEFT JOIN claims c ON o.unique_id = c.order_unique_id AND o.account_code = c.account_code
      LEFT JOIN labels l ON o.order_id = l.order_id AND o.account_code = l.account_code
      WHERE c.claimed_by = ?
        AND (c.status = 'claimed' OR c.status = 'ready_for_handover')
        AND (o.is_in_new_order = 1 OR c.label_downloaded = 1)
        AND l.is_manifest = 1
        AND (l.is_handover = 0 OR l.is_handover IS NULL)
    `, [warehouseId]);

    // 4. Order Tracking - Total Count and Total Quantity
    // Orders claimed by this vendor, manifested (is_manifest=1), handed over (is_handover=1)
    const orderTrackingQuery = database.query(`
      SELECT 
        COUNT(DISTINCT o.order_id) as total_count,
        COALESCE(SUM(o.quantity), 0) as total_quantity
      FROM orders o
      LEFT JOIN claims c ON o.unique_id = c.order_unique_id AND o.account_code = c.account_code
      LEFT JOIN labels l ON o.order_id = l.order_id AND o.account_code = l.account_code
      WHERE c.claimed_by = ?
        AND (c.status = 'claimed' OR c.status = 'ready_for_handover')
        AND (o.is_in_new_order = 1 OR c.label_downloaded = 1)
        AND l.is_manifest = 1
        AND l.is_handover = 1
    `, [warehouseId]);

    // Execute all 4 queries in parallel using connection pool
    const [allOrdersResult, myOrdersResult, handoverResult, orderTrackingResult] = await Promise.all([
      allOrdersQuery,
      myOrdersQuery,
      handoverQuery,
      orderTrackingQuery
    ]);

    // Extract results
    const allOrdersCount = parseInt(allOrdersResult[0]?.total_count || 0);
    const allOrdersQuantity = parseInt(allOrdersResult[0]?.total_quantity || 0);
    const myOrdersCount = parseInt(myOrdersResult[0]?.total_count || 0);
    const myOrdersQuantity = parseInt(myOrdersResult[0]?.total_quantity || 0);
    const handoverCount = parseInt(handoverResult[0]?.total_count || 0);
    const handoverQuantity = parseInt(handoverResult[0]?.total_quantity || 0);
    const orderTrackingCount = parseInt(orderTrackingResult[0]?.total_count || 0);
    const orderTrackingQuantity = parseInt(orderTrackingResult[0]?.total_quantity || 0);

    logger.info('✅ Dashboard statistics calculated:');

    const responseData = {
      success: true,
      message: 'Dashboard statistics retrieved successfully',
      data: {
        allOrders: {
          totalCount: allOrdersCount,
          totalQuantity: allOrdersQuantity
        },
        myOrders: {
          totalCount: myOrdersCount,
          totalQuantity: myOrdersQuantity
        },
        handover: {
          totalCount: handoverCount,
          totalQuantity: handoverQuantity
        },
        orderTracking: {
          totalCount: orderTrackingCount,
          totalQuantity: orderTrackingQuantity
        },
        lastUpdated: new Date().toISOString()
      }
    };

    return res.json(responseData);

  } catch (error) {
    logger.error('❌ DASHBOARD STATS ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error: ' + error.message
    });
  }
});

/**
 * @route   GET /api/orders/grouped
 * @desc    Get vendor's claimed orders grouped by order_id
 * @access  Vendor (token required)
 */
router.get('/grouped', async (req, res) => {
  logger.info('\n🔵 GROUPED ORDERS REQUEST START');
  logger.info('================================');
  logger.info('📥 Request Headers:', JSON.stringify(req.headers, null, 2));
  logger.info('📥 Request Method:', req.method);
  logger.info('📥 Request URL:', req.url);
  logger.info('📥 Request IP:', req.ip);

  // Extract pagination parameters
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  logger.info('📄 Pagination params:', { page, limit });

  const vendor = req.user;
  const database = require('../config/database');
  try {
    // Wait for MySQL initialization
    await database.waitForMySQLInitialization();

    if (!database.isMySQLAvailable()) {
      logger.info('❌ MySQL connection not available');
      return res.status(500).json({ success: false, message: 'Database connection not available' });
    }

    if (vendor.active_session !== 'TRUE') {
      return res.status(401).json({ success: false, message: 'Inactive vendor session' });
    }

    const warehouseId = vendor.warehouseId;

    // Get individual orders from MySQL (like original Excel flow)
    logger.info('📂 Loading vendor orders from MySQL...');

    const vendorOrders = await database.getGroupedOrders(warehouseId);

    logger.info('📦 Vendor orders loaded:', vendorOrders.length);

    // Fetch shipping_partner for all unique account_codes
    const uniqueAccountCodes = [...new Set(vendorOrders.map(o => o.account_code).filter(Boolean))];
    let shippingPartnerMap = {};
    if (uniqueAccountCodes.length > 0) {
      try {
        const stores = await database.getStoresByAccountCodes(uniqueAccountCodes);
        stores.forEach(s => { shippingPartnerMap[s.account_code] = s.shipping_partner || 'shipway'; });
      } catch (err) {
        logger.warn('⚠️ Could not fetch store shipping partners:', err.message);
      }
    }

    // Group orders by order_id (exact same logic as original Excel flow)
    const groupedOrders = {};

    vendorOrders.forEach(order => {
      const orderId = order.order_id;

      if (!groupedOrders[orderId]) {
        groupedOrders[orderId] = {
          order_id: orderId, // Always use the actual order_id (clone ID if cloned)
          status: order.status,
          order_date: order.order_date || order.created_at,
          customer_name: order.customer_name || order.customer,
          claimed_at: order.claimed_at,
          label_downloaded: order.label_downloaded, // Add label_downloaded field
          is_handover: order.is_handover, // Add is_handover field
          current_shipment_status: order.current_shipment_status, // Add current_shipment_status field
          account_code: order.account_code, // Add account_code for shipping partner detection
          shipping_partner: shippingPartnerMap[order.account_code] || 'shipway', // Add shipping_partner
          total_value: 0,
          total_products: 0,
          total_quantity: 0,
          products: []
        };
      }

      // Add product to the group (exact same structure as original Excel flow)
      groupedOrders[orderId].products.push({
        unique_id: order.unique_id,
        product_name: order.product_name || order.product,
        product_code: order.product_code,
        size: order.size || null,
        value: order.value || order.price || 0,
        image: order.image || order.product_image,
        quantity: order.quantity || 1
      });

      // Update totals
      const productValue = parseFloat(order.value || order.price || 0);
      const productQuantity = parseInt(order.quantity || 1);
      groupedOrders[orderId].total_value += productValue;
      groupedOrders[orderId].total_products += 1;
      groupedOrders[orderId].total_quantity += productQuantity;
    });

    // Convert to array and sort by order_date (exact same logic as original Excel flow)
    const groupedOrdersArray = Object.values(groupedOrders).sort((a, b) => {
      const dateA = new Date(a.order_date || 0);
      const dateB = new Date(b.order_date || 0);
      return dateB - dateA; // Most recent first
    });

    logger.info('📊 Grouped orders processed:', groupedOrdersArray.length);

    // Calculate total quantity across all orders (for tab count)
    const totalQuantityAcrossAllOrders = groupedOrdersArray.reduce((sum, order) => {
      return sum + (order.total_quantity || 0);
    }, 0);

    logger.info('📊 Total quantity across all orders:', totalQuantityAcrossAllOrders);
    logger.info('📊 Sample order data for debugging:');
    if (groupedOrdersArray.length > 0) {
    }

    // Apply pagination
    const totalCount = groupedOrdersArray.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedOrders = groupedOrdersArray.slice(startIndex, endIndex);
    const hasMore = endIndex < totalCount;

    logger.info('📄 Pagination applied:');
    logger.info('🟢 GROUPED ORDERS SUCCESS');

    const responseData = {
      success: true,
      data: {
        groupedOrders: paginatedOrders,
        pagination: {
          page: page,
          limit: limit,
          total: totalCount,
          hasMore: hasMore,
          returnedCount: paginatedOrders.length
        },
        totalOrders: totalCount,
        totalProducts: vendorOrders.length,
        totalQuantity: totalQuantityAcrossAllOrders
      }
    };

    logger.info('\n📤 RESPONSE DATA:');

    // Debug: Log each grouped order's total_quantity
    logger.info('🔍 DEBUG: Individual order quantities:');
    responseData.data.groupedOrders.forEach((order, index) => {
      logger.info(`  Order ${index} (${order.order_id}): total_quantity = ${order.total_quantity}`);
    });


    return res.json(responseData);

  } catch (error) {
    logger.info('\n💥 GROUPED ORDERS ERROR:');

    const errorResponse = { success: false, message: 'Internal server error: ' + error.message };
    logger.info('\n📤 ERROR RESPONSE:');

    return res.status(500).json(errorResponse);
  }
});

/**
 * @route   GET /api/orders/admin/dashboard-stats
 * @desc    Get dashboard statistics for admin panel (with optional filters)
 * @access  Admin/Superadmin only
 */
router.get('/admin/dashboard-stats', requireAdminOrSuperadmin, async (req, res) => {
  logger.info('🔵 ADMIN DASHBOARD STATS REQUEST START');

  try {
    const database = require('../config/database');
    await database.waitForMySQLInitialization();

    if (!database.isMySQLAvailable()) {
      return res.status(500).json({
        success: false,
        message: 'Database connection not available'
      });
    }

    // Get date filter from utility table
    let numberOfDays = 60; // default
    try {
      const daysValue = await database.getUtilityParameter('number_of_day_of_order_include');
      if (daysValue) {
        numberOfDays = parseInt(daysValue, 10);
      }
    } catch (dbError) {
      logger.info(`⚠️ Could not fetch utility parameter, using default: ${numberOfDays} days`);
    }

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - numberOfDays);
    cutoffDate.setHours(0, 0, 0, 0);

    // Extract filter parameters from query
    const search = req.query.search || '';
    const dateFrom = req.query.dateFrom;
    const dateTo = req.query.dateTo;
    // Handle status as array or single value
    let status = req.query.status || 'all';
    if (Array.isArray(status)) {
      status = status.filter(s => s && s !== 'all'); // Remove 'all' and empty values
      status = status.length > 0 ? status : 'all';
    }
    // Handle vendor as array or single value
    let vendor = req.query.vendor;
    if (Array.isArray(vendor)) {
      vendor = vendor.filter(v => v && typeof v === 'string' && v.trim() !== ''); // Remove empty values
      vendor = vendor.length > 0 ? vendor : null;
    } else if (vendor && typeof vendor === 'string' && vendor.trim() === '') {
      vendor = null; // Convert empty string to null
    }
    // Handle store as array or single value
    let store = req.query.store;
    if (Array.isArray(store)) {
      store = store.filter(s => s && typeof s === 'string' && s.trim() !== ''); // Remove empty values
      store = store.length > 0 ? store : null;
    } else if (store && typeof store === 'string' && store.trim() === '') {
      store = null; // Convert empty string to null
    }
    const showInactiveStores = req.query.showInactiveStores === 'true';

    logger.info('📊 Admin Dashboard Stats params:', { search, dateFrom, dateTo, status, vendor, store });

    // Get stats from database
    const stats = await database.getAdminDashboardStats({
      search,
      dateFrom,
      dateTo,
      status,
      vendor,
      store,
      showInactiveStores,
      cutoffDate
    });

    logger.info('✅ ADMIN DASHBOARD STATS SUCCESS');

    return res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('💥 ADMIN DASHBOARD STATS ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch admin dashboard stats',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/orders/admin/all
 * @desc    Get paginated orders with vendor information for admin panel
 * @access  Admin/Superadmin only
 */
router.get('/admin/all', requireAdminOrSuperadmin, async (req, res) => {
  logger.info('🔵 ADMIN ORDERS REQUEST START');

  try {
    const database = require('../config/database');
    await database.waitForMySQLInitialization();

    if (!database.isMySQLAvailable()) {
      return res.status(500).json({
        success: false,
        message: 'Database connection not available'
      });
    }

    // Get date filter from utility table
    let numberOfDays = 60; // default
    try {
      const daysValue = await database.getUtilityParameter('number_of_day_of_order_include');
      if (daysValue) {
        numberOfDays = parseInt(daysValue, 10);
        logger.info(`📅 Using ${numberOfDays} days from utility configuration`);
      }
    } catch (dbError) {
      logger.info(`⚠️ Could not fetch utility parameter, using default: ${numberOfDays} days`);
    }

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - numberOfDays);
    cutoffDate.setHours(0, 0, 0, 0);

    // Extract pagination and filter parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || '';
    const dateFrom = req.query.dateFrom;
    const dateTo = req.query.dateTo;
    // Handle status as array or single value
    let status = req.query.status || 'all';
    if (Array.isArray(status)) {
      status = status.filter(s => s && s !== 'all'); // Remove 'all' and empty values
      status = status.length > 0 ? status : 'all';
    }
    // Handle vendor as array or single value
    let vendor = req.query.vendor;
    if (Array.isArray(vendor)) {
      vendor = vendor.filter(v => v && typeof v === 'string' && v.trim() !== ''); // Remove empty values
      vendor = vendor.length > 0 ? vendor : null;
    } else if (vendor && typeof vendor === 'string' && vendor.trim() === '') {
      vendor = null; // Convert empty string to null
    }
    // Handle store as array or single value
    let store = req.query.store;
    if (Array.isArray(store)) {
      store = store.filter(s => s && typeof s === 'string' && s.trim() !== ''); // Remove empty values
      store = store.length > 0 ? store : null;
    } else if (store && typeof store === 'string' && store.trim() === '') {
      store = null; // Convert empty string to null
    }
    const showInactiveStores = req.query.showInactiveStores === 'true';

    logger.info('📄 Admin Orders pagination params:', { page, limit, search, dateFrom, dateTo, status, vendor, store });

    // Calculate offset
    const offset = (page - 1) * limit;

    // Use paginated query
    const result = await database.getAdminOrdersPaginated({
      search,
      dateFrom,
      dateTo,
      status,
      vendor,
      store,
      showInactiveStores,
      limit,
      offset,
      cutoffDate
    });

    const paginatedOrders = result.orders;
    const totalCount = result.totalCount;
    const totalQuantity = result.totalQuantity;

    // Count unique orders in the paginated result (not rows - one order can have multiple products)
    const uniqueOrdersReturned = new Set(paginatedOrders.map(o => o.unique_id)).size;
    const hasMore = (offset + uniqueOrdersReturned) < totalCount;

    logger.info('📊 Admin Orders pagination result:', {
      total: totalCount,
      totalQuantity: totalQuantity,
      page: page,
      limit: limit,
      returned: paginatedOrders.length,
      uniqueOrdersReturned: uniqueOrdersReturned,
      hasMore: hasMore
    });

    // Process orders (format for frontend)
    const processedOrders = paginatedOrders.map(order => ({
      unique_id: order.unique_id,
      order_id: order.order_id,
      customer_name: order.customer_name_from_info || order.customer_name || order.customer || 'N/A',
      vendor_name: order.vendor_name || (order.claimed_by ? order.claimed_by : 'Unclaimed'),
      product_name: order.product_name || order.product || 'N/A',
      product_code: order.product_code || order.sku || 'N/A',
      size: order.size || null,
      quantity: order.quantity || '1',
      status: order.status || 'unclaimed',
      value: order.value || order.price || order.selling_price || '0',
      priority: order.priority || 'medium',
      created_at: order.created_at || order.order_date || 'N/A',
      claimed_at: order.claimed_at || null,
      claimed_by: order.claimed_by || null,
      image: order.product_image || order.image || '/placeholder.svg',
      store_name: order.store_name || null,
      store_status: order.store_status || 'active',
      account_code: order.account_code || null,
      awb: order.awb || null
    }));

    logger.info('✅ ADMIN ORDERS SUCCESS');

    return res.status(200).json({
      success: true,
      data: {
        orders: processedOrders,
        pagination: {
          page: page,
          limit: limit,
          total: totalCount,
          totalQuantity: totalQuantity,
          hasMore: hasMore,
          returnedCount: processedOrders.length
        }
      }
    });

  } catch (error) {
    logger.error('💥 ADMIN ORDERS ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch orders for admin panel',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/orders/admin/assign
 * @desc    Admin assigns an order to a vendor
 * @access  Admin/Superadmin only
 */
router.post('/admin/assign', authenticateBasicAuth, requireAdminOrSuperadmin, async (req, res) => {
  const { unique_id, vendor_warehouse_id } = req.body;

  logger.info('🔵 ADMIN ASSIGN ORDER REQUEST START');

  if (!unique_id || !vendor_warehouse_id) {
    return res.status(400).json({
      success: false,
      message: 'unique_id and vendor_warehouse_id are required'
    });
  }

  try {
    const database = require('../config/database');

    await database.waitForMySQLInitialization();

    if (!database.isMySQLAvailable()) {
      logger.info('❌ MySQL connection not available');
      return res.status(500).json({ success: false, message: 'Database connection not available' });
    }

    const vendor = await database.getUserByWarehouseId(vendor_warehouse_id);
    if (!vendor || vendor.role !== 'vendor') {
      return res.status(400).json({
        success: false,
        message: 'Vendor not found or invalid warehouse ID'
      });
    }

    logger.info('✅ VENDOR FOUND:', vendor.name);

    // Fetch order to validate existence + derive carrier
    const order = await database.getOrderByUniqueId(unique_id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    logger.info('✅ ORDER FOUND:', order.order_id);

    // Guard: order must be unclaimed before we even look up carriers.
    // This is a fast pre-check — the real race-safe guard is the conditional
    // UPDATE below (affectedRows check).
    if (order.status !== 'unclaimed') {
      logger.info(`❌ Order ${order.order_id} is already claimed by ${order.claimed_by}`);
      return res.status(409).json({
        success: false,
        already_claimed: true,
        message: `Order ${order.order_id} has already been claimed by another vendor`,
        claimed_by: order.claimed_by
      });
    }

    // Check if store is active
    const store = await database.getStoreByAccountCode(order.account_code);
    if (store && store.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Cannot assign order from inactive store. Please activate the store first.'
      });
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // Carrier lookup (non-fatal if it fails)
    logger.info('🚚 ASSIGNING TOP 3 PRIORITY CARRIERS...');
    let priorityCarrier = '';
    try {
      const orderForCarrier = {
        ...order,
        status: 'claimed',
        claimed_by: vendor_warehouse_id,
        claimed_at: now,
        last_claimed_by: vendor_warehouse_id,
        last_claimed_at: now
      };
      priorityCarrier = await carrierServiceabilityService.getTop3PriorityCarriers(orderForCarrier);
      logger.info(`✅ Top 3 carriers assigned: ${priorityCarrier}`);
    } catch (carrierError) {
      logger.info(`⚠️ Carrier assignment failed (non-fatal): ${carrierError.message}`);
    }

    // ── Atomic conditional UPDATE — first-come-first-served ──
    // The WHERE status='unclaimed' guard ensures that if a vendor (or another admin)
    // locked this row between our pre-check and now, affectedRows will be 0 and
    // we return 409 instead of silently overwriting.
    logger.info('💾 ATOMIC CONDITIONAL UPDATE...');
    const [result] = await database.pool.execute(
      `UPDATE claims
       SET status          = 'claimed',
           claimed_by      = ?,
           claimed_at      = ?,
           last_claimed_by = ?,
           last_claimed_at = ?,
           priority_carrier = ?
       WHERE order_unique_id = ?
         AND status = 'unclaimed'`,
      [vendor_warehouse_id, now, vendor_warehouse_id, now, priorityCarrier, unique_id]
    );

    if (result.affectedRows === 0) {
      // Someone else (vendor or admin) locked the row between our pre-check and UPDATE.
      const fresh = await database.getOrderByUniqueId(unique_id);
      logger.info(`❌ Order ${order.order_id} was claimed in the race window by ${fresh?.claimed_by}`);
      return res.status(409).json({
        success: false,
        already_claimed: true,
        message: `Order ${order.order_id} was just claimed by another vendor`,
        claimed_by: fresh?.claimed_by
      });
    }

    logger.info(`✅ ORDER ASSIGNED SUCCESSFULLY — ${order.order_id} → ${vendor.name} (${vendor_warehouse_id})`);

    return res.json({
      success: true,
      message: `Order ${order.order_id} assigned to ${vendor.name}`,
      data: {
        order_id: order.order_id,
        vendor_name: vendor.name,
        vendor_warehouse_id: vendor_warehouse_id,
        assigned_at: now
      }
    });

  } catch (error) {
    logger.error('💥 ADMIN ASSIGN ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error: ' + error.message
    });
  }
});


/**
 * @route   POST /api/orders/admin/bulk-assign
 * @desc    Admin assigns multiple orders to a vendor
 * @access  Admin/Superadmin only
 */
router.post('/admin/bulk-assign', authenticateBasicAuth, requireAdminOrSuperadmin, async (req, res) => {
  const { unique_ids, vendor_warehouse_id } = req.body || {};

  logger.info('🔵 ADMIN BULK ASSIGN REQUEST START');

  // 5.1 + 5.2 — Batch size limit + type validation
  const arrayCheck = validateBulkArray(unique_ids, 'unique_ids');
  if (!arrayCheck.ok) {
    return res.status(400).json({ success: false, message: arrayCheck.message });
  }
  const sanitizedUniqueIds = arrayCheck.items;

  if (!vendor_warehouse_id || typeof vendor_warehouse_id !== 'string' || vendor_warehouse_id.trim() === '') {
    return res.status(400).json({ success: false, message: 'unique_ids (array) and vendor_warehouse_id are required' });
  }

  try {
    const database = require('../config/database');

    await database.waitForMySQLInitialization();

    if (!database.isMySQLAvailable()) {
      return res.status(500).json({ success: false, message: 'Database connection not available' });
    }

    // Verify vendor exists
    const vendor = await database.getUserByWarehouseId(vendor_warehouse_id);
    if (!vendor || vendor.role !== 'vendor') {
      return res.status(400).json({ success: false, message: 'Vendor not found or invalid warehouse ID' });
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // ── Step 1: Fetch ALL orders in one query ──
    logger.info(`📦 Fetching ${sanitizedUniqueIds.length} orders in one query...`);
    const allOrders = await database.getOrdersByUniqueIds(sanitizedUniqueIds);
    const ordersMap = new Map(allOrders.map(o => [o.unique_id, o]));

    // Immediately separate not-found + pre-claimed orders so the frontend gets a clear list
    const notFound = sanitizedUniqueIds.filter(uid => !ordersMap.has(uid));
    const alreadyClaimed = []; // orders not in 'unclaimed' status
    const toAssign = [];       // orders safe to claim

    for (const uid of sanitizedUniqueIds) {
      const order = ordersMap.get(uid);
      if (!order) continue; // already captured in notFound
      if (order.status !== 'unclaimed') {
        alreadyClaimed.push({ unique_id: uid, order_id: order.order_id, claimed_by: order.claimed_by, status: order.status });
      } else {
        toAssign.push(uid);
      }
    }

    if (alreadyClaimed.length > 0) {
      logger.info(`⚠️ ${alreadyClaimed.length} orders are already claimed — skipping them`);
    }

    if (toAssign.length === 0) {
      return res.json({
        success: false,
        already_claimed: true,
        message: 'All selected orders have already been claimed by other vendors',
        data: { updated: 0, vendor_warehouse_id, already_claimed_orders: alreadyClaimed }
      });
    }

    // ── Step 2: Parallel carrier lookups for unclaimed orders only ──
    logger.info(`⚡ Running ${toAssign.length} carrier lookups in parallel...`);
    const carrierResults = await Promise.allSettled(
      toAssign.map(async (uid) => {
        const order = ordersMap.get(uid);
        const orderForCarrier = {
          ...order, status: 'claimed', claimed_by: vendor_warehouse_id,
          claimed_at: now, last_claimed_by: vendor_warehouse_id, last_claimed_at: now
        };
        try {
          const priorityCarrier = await carrierServiceabilityService.getTop3PriorityCarriers(orderForCarrier);
          return { uid, priorityCarrier };
        } catch (err) {
          logger.info(`⚠️ Carrier lookup failed for ${order.order_id} (non-fatal): ${err.message}`);
          return { uid, priorityCarrier: '' };
        }
      })
    );

    const carrierMap = new Map();
    carrierResults.forEach((result, i) => {
      const uid = toAssign[i];
      carrierMap.set(uid, result.status === 'fulfilled' ? result.value.priorityCarrier : '');
    });
    logger.info(`✅ Carrier lookups complete`);

    // ── Step 3: Batch UPDATE with AND status='unclaimed' guard ──
    // First-come-first-served: if a vendor locked any of these rows between
    // pre-check and now, the WHERE clause will skip those rows — affectedRows
    // will be less than toAssign.length, telling us races happened.
    const caseParts = toAssign.map(() => 'WHEN ? THEN ?').join(' ');
    const caseParams = toAssign.flatMap(uid => [uid, carrierMap.get(uid) || '']);
    const inPlaceholders = toAssign.map(() => '?').join(',');

    const txManager = new TransactionManager(database.pool);
    let updatedCount = 0;
    await txManager.runInTransaction(async (conn) => {
      const [result] = await conn.execute(
        `UPDATE claims
         SET status          = 'claimed',
             claimed_by      = ?,
             claimed_at      = ?,
             last_claimed_by = ?,
             last_claimed_at = ?,
             priority_carrier = CASE order_unique_id ${caseParts} ELSE priority_carrier END
         WHERE order_unique_id IN (${inPlaceholders})
           AND status = 'unclaimed'`,
        [vendor_warehouse_id, now, vendor_warehouse_id, now, ...caseParams, ...toAssign]
      );
      updatedCount = result.affectedRows;
    });

    // If affectedRows < toAssign.length, some were claimed in the race window —
    // count them but we already gave the user the pre-check list for the bulk UI.
    const raceConflicts = toAssign.length - updatedCount;
    if (raceConflicts > 0) {
      logger.info(`⚠️ ${raceConflicts} order(s) were claimed in the race window — skipped`);
    }

    const totalBlocked = alreadyClaimed.length + raceConflicts;
    logger.info(`✅ BULK ASSIGN COMPLETE — Updated ${updatedCount} orders for ${vendor.name}, blocked ${totalBlocked}`);

    return res.json({
      success: true,
      message: `Assigned ${updatedCount} order(s) to ${vendor.name}${totalBlocked > 0 ? ` (${totalBlocked} already claimed by another vendor)` : ''}`,
      data: {
        updated: updatedCount,
        vendor_warehouse_id,
        already_claimed_orders: alreadyClaimed.length > 0 ? alreadyClaimed : undefined
      }
    });
  } catch (error) {
    logger.error('💥 ADMIN BULK ASSIGN ERROR:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error: ' + error.message });
  }
});

/**
 * @route   POST /api/orders/admin/bulk-unassign
 * @desc    Admin unassigns multiple orders
 * @access  Admin/Superadmin only
 */
router.post('/admin/bulk-unassign', authenticateBasicAuth, requireAdminOrSuperadmin, async (req, res) => {
  const { unique_ids } = req.body || {};

  logger.info('🔵 ADMIN BULK UNASSIGN REQUEST START');

  // 5.1 + 5.2 — Batch size limit + type validation
  const arrayCheck = validateBulkArray(unique_ids, 'unique_ids');
  if (!arrayCheck.ok) {
    return res.status(400).json({ success: false, message: arrayCheck.message });
  }
  const sanitizedUniqueIds = arrayCheck.items;

  try {
    const database = require('../config/database');

    await database.waitForMySQLInitialization();

    if (!database.isMySQLAvailable()) {
      return res.status(500).json({ success: false, message: 'Database connection not available' });
    }

    let labelCancelledCount = 0;
    const errors = [];
    const successfulUids = []; // collect UIDs that passed all per-order checks
    const ShipwayService = require('../services/shipwayService');

    // ── 7.3 Step 1: Fetch ALL orders in one query instead of N getOrderByUniqueId calls ──
    logger.info(`📦 Fetching ${sanitizedUniqueIds.length} orders in one query...`);
    const allOrders = await database.getOrdersByUniqueIds(sanitizedUniqueIds);
    const ordersMap = new Map(allOrders.map(o => [o.unique_id, o]));
    logger.info(`✅ Fetched ${allOrders.length} orders`);

    // ── 7.3 Step 2: Per-order work (Shipway API + label clearing) ──
    // These cannot be batched: each order may have a different AWB/account_code,
    // and external API calls are inherently sequential per order.
    for (const uid of sanitizedUniqueIds) {
      try {
        const order = ordersMap.get(uid);

        if (!order) {
          errors.push({ unique_id: uid, error: 'Order not found' });
          continue;
        }

        if (order.status === 'unclaimed' || !order.claimed_by || order.claimed_by.trim() === '') {
          errors.push({ unique_id: uid, order_id: order.order_id, error: 'Order is not claimed by any vendor' });
          continue;
        }

        logger.info(`🔄 Processing order ${order.order_id} (claimed by ${order.claimed_by})...`);

        const isLabelDownloaded = order.label_downloaded === 1 || order.label_downloaded === true || order.label_downloaded === '1';
        const accountCode = order.account_code;

        if (isLabelDownloaded) {
          logger.info(`🔄 CASE 2: Label downloaded for order ${order.order_id} — calling Shipway cancel API`);

          if (!accountCode) {
            errors.push({ unique_id: uid, order_id: order.order_id, error: 'Store information not found. Cannot cancel shipment.' });
            continue;
          }

          const label = await database.getLabelByOrderId(order.order_id, accountCode);
          if (!label || !label.awb) {
            errors.push({ unique_id: uid, order_id: order.order_id, error: 'AWB number not found. Cannot cancel shipment.' });
            continue;
          }

          logger.info(`✅ AWB FOUND for order ${order.order_id}:`, label.awb);

          const shipwayService = new ShipwayService(accountCode);
          await shipwayService.initialize();

          try {
            const cancelResult = await shipwayService.cancelShipment([label.awb]);
            logger.info(`✅ SHIPWAY CANCEL SUCCESS for order ${order.order_id}:`, cancelResult);
            labelCancelledCount++;
          } catch (cancelError) {
            logger.error(`❌ SHIPWAY CANCEL FAILED for order ${order.order_id}: ${cancelError.message}`);
            errors.push({ unique_id: uid, order_id: order.order_id, error: `Failed to cancel shipment: ${cancelError.message}` });
            continue;
          }

          // Clear label data per-order (different order_id + account_code per row)
          await database.pool.execute(
            'UPDATE labels SET awb = NULL, label_url = NULL, carrier_id = NULL, carrier_name = NULL, priority_carrier = NULL, is_manifest = 0, manifest_id = NULL, current_shipment_status = NULL WHERE order_id = ? AND account_code = ?',
            [order.order_id, accountCode]
          );
          logger.info(`✅ LABEL DATA CLEARED for order ${order.order_id}`);

        } else {
          logger.info(`🔄 CASE 1: No label for order ${order.order_id} — resetting manifest fields`);
          if (accountCode) {
            await database.pool.execute(
              'UPDATE labels SET is_manifest = 0, manifest_id = NULL, current_shipment_status = NULL WHERE order_id = ? AND account_code = ?',
              [order.order_id, accountCode]
            );
          } else {
            await database.pool.execute(
              'UPDATE labels SET is_manifest = 0, manifest_id = NULL, current_shipment_status = NULL WHERE order_id = ?',
              [order.order_id]
            );
          }
          logger.info(`✅ MANIFEST FIELDS RESET for order ${order.order_id}`);
        }

        // Order passed all checks — mark for batch DB reset below
        successfulUids.push(uid);

      } catch (error) {
        logger.error(`❌ Failed to unassign order ${uid}:`, error.message);
        errors.push({ unique_id: uid, error: error.message });
      }
    }

    // ── 7.3 Step 3: Batch reset claims + orders for all successfully processed orders ──
    // Instead of 2×N individual UPDATE queries, two single batch queries suffice.
    let updatedCount = 0;
    if (successfulUids.length > 0) {
      const placeholders = successfulUids.map(() => '?').join(',');

      const txManager = new TransactionManager(database.pool);
      await txManager.runInTransaction(async (conn) => {
        await conn.execute(
          `UPDATE claims
           SET claimed_by      = NULL,
               claimed_at      = NULL,
               last_claimed_by = NULL,
               last_claimed_at = NULL,
               status          = 'unclaimed',
               label_downloaded = 0,
               priority_carrier = NULL
           WHERE order_unique_id IN (${placeholders})`,
          successfulUids
        );
        await conn.execute(
          `UPDATE orders SET is_in_new_order = 1 WHERE unique_id IN (${placeholders})`,
          successfulUids
        );
      });

      updatedCount = successfulUids.length;
      logger.info(`✅ Batch reset ${updatedCount} claims and orders rows`);
    }

    const message = `Unassigned ${updatedCount} orders${labelCancelledCount > 0 ? ` (${labelCancelledCount} labels cancelled)` : ''}`;

    logger.info('✅ BULK UNASSIGN COMPLETE:');

    return res.json({
      success: true,
      message: message,
      data: {
        updated: updatedCount,
        labels_cancelled: labelCancelledCount,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    logger.error('💥 ADMIN BULK UNASSIGN ERROR:', error.message);
    logger.error('  - Stack:', error.stack);
    return res.status(500).json({ success: false, message: 'Internal server error: ' + error.message });
  }
});

/**
 * @route   POST /api/orders/admin/unassign
 * @desc    Admin unassigns an order from a vendor
 * @access  Admin/Superadmin only
 */
router.post('/admin/unassign', authenticateBasicAuth, requireAdminOrSuperadmin, async (req, res) => {
  const { unique_id } = req.body;

  logger.info('🔵 ADMIN UNASSIGN ORDER REQUEST START');

  if (!unique_id) {
    return res.status(400).json({
      success: false,
      message: 'unique_id is required'
    });
  }

  try {
    // Load database
    const database = require('../config/database');
    await database.waitForMySQLInitialization();

    if (!database.isMySQLAvailable()) {
      logger.info('❌ MySQL connection not available');
      return res.status(500).json({ success: false, message: 'Database connection not available' });
    }

    // Get order from MySQL
    const order = await database.getOrderByUniqueId(unique_id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    logger.info('✅ ORDER FOUND:', order.order_id);

    // Validate order is actually claimed
    if (order.status === 'unclaimed' || !order.claimed_by || order.claimed_by.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Order is not claimed by any vendor'
      });
    }

    const previousVendor = order.claimed_by;

    // Validate vendor exists (for audit trail, but don't fail if vendor was deleted)
    logger.info('🔍 VALIDATING VENDOR BEFORE UNASSIGN:');

    const vendor = await database.getUserByWarehouseId(previousVendor);
    if (!vendor) {
      logger.info(`⚠️ Vendor ${previousVendor} not found - proceeding with unassign anyway (cleanup)`);
    } else {
      logger.info(`✅ Verified vendor: ${vendor.name || 'N/A'} (${vendor.email || 'N/A'})`);
    }

    // Check label_downloaded status (same logic as vendor panel)
    const isLabelDownloaded = order.label_downloaded === 1 || order.label_downloaded === true || order.label_downloaded === '1';

    if (isLabelDownloaded) {
      logger.info('🔄 CASE 2: Label downloaded - cancelling shipment before unclaim');

      // Get account_code from order to use correct store credentials
      const accountCode = order.account_code;
      if (!accountCode) {
        logger.info('❌ ACCOUNT_CODE NOT FOUND for order:', order.order_id);
        return res.status(400).json({
          success: false,
          message: 'Store information not found for this order. Cannot cancel shipment.'
        });
      }

      // Get AWB number from labels table (with account_code filter for store-specific retrieval)
      const label = await database.getLabelByOrderId(order.order_id, accountCode);

      if (!label || !label.awb) {
        logger.info('❌ AWB NOT FOUND for order:', order.order_id);
        return res.status(400).json({
          success: false,
          message: 'AWB number not found for this order. Cannot cancel shipment.'
        });
      }

      logger.info('✅ AWB FOUND:', label.awb);

      // Determine shipping partner for this store
      const storeInfo = await database.getStoreByAccountCode(accountCode);
      const shippingPartner = (storeInfo?.shipping_partner || '').toLowerCase();

      try {
        if (shippingPartner === 'shiprocket') {
          logger.info('🔄 Using Shiprocket cancel API for order:', order.order_id);
          const ShiprocketService = require('../services/shiprocketService');
          const shiprocketService = new ShiprocketService(accountCode);
          const cancelResult = await shiprocketService.cancelShipmentsByAwbs([label.awb]);
          logger.info('✅ SHIPROCKET CANCEL SUCCESS:', cancelResult);
        } else {
          logger.info('🔄 Using Shipway cancel API for order:', order.order_id);
          const ShipwayService = require('../services/shipwayService');
          const shipwayService = new ShipwayService(accountCode);
          await shipwayService.initialize();
          const cancelResult = await shipwayService.cancelShipment([label.awb]);
          logger.info('✅ SHIPWAY CANCEL SUCCESS:', cancelResult);
        }
      } catch (cancelError) {
        logger.error('❌ SHIPMENT CANCEL FAILED:');
        logger.error('  - Error message:', cancelError.message);
        logger.error('  - Account Code:', accountCode);
        logger.error('  - AWB:', label.awb);
        return res.status(500).json({
          success: false,
          message: cancelError.message || 'Failed to cancel shipment. Please try after sometime.',
          error: 'shipment_cancel_failed',
          details: cancelError.message
        });
      }

      // Clear label data after successful cancellation (with account_code filter for store isolation)
      await database.mysqlConnection.execute(
        'UPDATE labels SET awb = NULL, label_url = NULL, carrier_id = NULL, carrier_name = NULL, priority_carrier = NULL, is_manifest = 0, manifest_id = NULL, current_shipment_status = NULL WHERE order_id = ? AND account_code = ?',
        [order.order_id, accountCode]
      );
      logger.info('✅ LABEL DATA CLEARED (including manifest_id)');
    } else {
      logger.info('🔄 CASE 1: No label downloaded - simple reverse');
      // Even without label download, reset manifest fields if they exist (for Handover tab orders)
      // Use account_code filter if available for store isolation
      const accountCode = order.account_code;
      if (accountCode) {
        await database.mysqlConnection.execute(
          'UPDATE labels SET is_manifest = 0, manifest_id = NULL, current_shipment_status = NULL WHERE order_id = ? AND account_code = ?',
          [order.order_id, accountCode]
        );
      } else {
        await database.mysqlConnection.execute(
          'UPDATE labels SET is_manifest = 0, manifest_id = NULL, current_shipment_status = NULL WHERE order_id = ?',
          [order.order_id]
        );
      }
      logger.info('✅ MANIFEST FIELDS RESET (including manifest_id)');
    }

    // Clear claim information (both cases)
    logger.info('🔄 CLEARING CLAIM INFORMATION...');
    await database.mysqlConnection.execute(
      `UPDATE claims SET 
        claimed_by = NULL, 
        claimed_at = NULL, 
        last_claimed_by = NULL, 
        last_claimed_at = NULL, 
        status = 'unclaimed',
        label_downloaded = 0,
        priority_carrier = NULL
      WHERE order_unique_id = ?`,
      [unique_id]
    );

    logger.info('✅ CLAIM DATA CLEARED');

    // Set is_in_new_order = 1 so unclaimed order appears in All Orders tab
    await database.mysqlConnection.execute(
      'UPDATE orders SET is_in_new_order = 1 WHERE unique_id = ?',
      [unique_id]
    );
    logger.info('✅ ORDER SET TO NEW ORDER STATUS');

    // Get updated order for response
    const updatedOrder = await database.getOrderByUniqueId(unique_id);

    if (!updatedOrder) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update order'
      });
    }

    const successMessage = isLabelDownloaded
      ? 'Shipment cancelled and order unassigned successfully'
      : 'Order unassigned successfully';

    logger.info('✅ ORDER UNASSIGNED SUCCESSFULLY');

    return res.json({
      success: true,
      message: successMessage,
      data: {
        order_id: updatedOrder.order_id,
        previous_vendor: previousVendor,
        vendor_name: vendor ? (vendor.name || 'N/A') : null,
        label_cancelled: isLabelDownloaded,
        unassigned_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
      }
    });

  } catch (error) {
    logger.error('💥 ADMIN UNASSIGN ERROR:', error.message);
    logger.error('  - Stack:', error.stack);
    return res.status(500).json({
      success: false,
      message: 'Internal server error: ' + error.message
    });
  }
});

/**
 * @route   GET /api/orders/admin/vendors
 * @desc    Get all active vendors for admin assignment dropdown
 * @access  Admin/Superadmin only
 */
router.get('/admin/vendors', authenticateBasicAuth, requireAdminOrSuperadmin, async (req, res) => {
  logger.info('🔵 ADMIN GET VENDORS REQUEST START');

  try {
    // Load users from MySQL to get all vendors
    const database = require('../config/database');

    // Wait for MySQL initialization
    await database.waitForMySQLInitialization();

    if (!database.isMySQLAvailable()) {
      logger.info('❌ MySQL connection not available');
      return res.status(500).json({ success: false, message: 'Database connection not available' });
    }

    // Get all active vendors
    const allUsers = await database.getAllUsers();
    const vendors = allUsers
      .filter(user => user.role === 'vendor' && user.status === 'active')
      .map(vendor => ({
        warehouse_id: vendor.warehouseId,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone
      }));

    logger.info('✅ VENDORS LOADED:', vendors.length);

    return res.status(200).json({
      success: true,
      data: { vendors }
    });

  } catch (error) {
    logger.info('💥 ADMIN GET VENDORS ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch vendors',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/orders/assign-priority-carriers
 * @desc    Assign priority carriers to all claimed orders based on serviceability
 * @access  Admin/Superadmin only
 */
router.post('/assign-priority-carriers', authenticateBasicAuth, requireAdminOrSuperadmin, async (req, res) => {
  logger.info('🔵 PRIORITY CARRIER ASSIGNMENT REQUEST START');

  try {
    logger.info('📡 Starting priority carrier assignment process for claimed orders...');

    // Start the assignment process
    const result = await carrierServiceabilityService.assignPriorityCarriersToOrders();

    logger.info('✅ PRIORITY CARRIER ASSIGNMENT COMPLETED');
    logger.info('📊 Results:', result);

    return res.status(200).json({
      success: true,
      message: 'Priority carriers assigned successfully to claimed orders',
      data: result
    });

  } catch (error) {
    logger.error('💥 PRIORITY CARRIER ASSIGNMENT ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to assign priority carriers',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/orders/assign-priority-carrier/:orderId
 * @desc    Assign priority carrier to a specific claimed order
 * @access  Admin/Superadmin only
 */
router.post('/assign-priority-carrier/:orderId', authenticateBasicAuth, requireAdminOrSuperadmin, async (req, res) => {
  const { orderId } = req.params;

  logger.info('🔵 SINGLE ORDER PRIORITY CARRIER ASSIGNMENT REQUEST START');

  try {
    logger.info('📡 Starting priority carrier assignment for single order...');

    // Start the assignment process for single order
    const result = await carrierServiceabilityService.assignPriorityCarrierToOrder(orderId);

    logger.info('✅ SINGLE ORDER PRIORITY CARRIER ASSIGNMENT COMPLETED');
    logger.info('📊 Results:', result);

    return res.status(200).json({
      success: true,
      message: 'Priority carrier assigned successfully to order',
      data: result
    });

  } catch (error) {
    logger.error('💥 SINGLE ORDER PRIORITY CARRIER ASSIGNMENT ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to assign priority carrier to order',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/orders/priority-carrier-stats
 * @desc    Get statistics about priority carrier assignments (claimed vs unclaimed orders)
 * @access  Admin/Superadmin only
 */
router.get('/priority-carrier-stats', authenticateBasicAuth, requireAdminOrSuperadmin, (req, res) => {
  logger.info('🔵 PRIORITY CARRIER STATS REQUEST START');

  try {
    const stats = carrierServiceabilityService.getAssignmentStatistics();

    logger.info('✅ PRIORITY CARRIER STATS RETRIEVED');

    return res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('💥 PRIORITY CARRIER STATS ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to get priority carrier statistics',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/orders/download-label
 * @desc    Download label for an order (with clone logic if needed)
 * @access  Vendor (token required)
 */
router.post('/download-label', async (req, res) => {
  const { order_id, format = 'thermal', async: runAsync = false } = req.body;
  const token = req.headers['authorization'];

  logger.info('🔵 DOWNLOAD LABEL REQUEST START');

  if (!order_id || !token) {
    logger.info('❌ DOWNLOAD LABEL FAILED: Missing required fields');
    return res.status(400).json({ success: false, message: 'order_id and Authorization token required' });
  }

  // ── ASYNC MODE: Create task, fire IIFE, return taskId immediately ──────────
  if (runAsync) {
    const task = taskStore.createTask('download-label', (token || '').substring(0, 20));
    const PORT = process.env.PORT || 5000;
    const savedBody = JSON.stringify({ order_id, format, async: false });
    const savedToken = token;
    (async () => {
      try {
        const internalRes = await fetch(`http://localhost:${PORT}/api/orders/download-label`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': savedToken },
          body: savedBody
        });
        const contentType = internalRes.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const result = await internalRes.json();
          if (result.success) {
            taskStore.completeTask(task.id, result);
          } else {
            taskStore.failTask(task.id, result.message || 'Download label failed');
          }
        } else {
          const buffer = await internalRes.buffer();
          taskStore.completeTask(task.id, {
            success: true,
            pdfBase64: buffer.toString('base64'),
            contentType: contentType || 'application/pdf'
          });
        }
      } catch (err) {
        taskStore.failTask(task.id, err.message);
      }
    })();
    return res.json({ success: true, taskId: task.id, async: true });
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Declare vendor outside try block so it's accessible in catch block
  let vendor = null;

  try {
    // Load users from MySQL to get vendor info
    const database = require('../config/database');

    // Wait for MySQL initialization
    await database.waitForMySQLInitialization();

    if (!database.isMySQLAvailable()) {
      logger.info('❌ MySQL connection not available');
      return res.status(500).json({ success: false, message: 'Database connection not available' });
    }

    logger.info('🔍 DOWNLOAD LABEL DEBUG:');

    vendor = req.user || await database.getUserByToken(token);

    if (!vendor || vendor.active_session !== 'TRUE') {
      logger.info('❌ VENDOR NOT FOUND OR INACTIVE ', vendor);
      return res.status(401).json({ success: false, message: 'Invalid or inactive vendor token' });
    }

    logger.info('✅ VENDOR FOUND:');

    // 3.2 — Targeted query: fetch only rows for this order_id (was: getAllOrders() + filter)
    const orderProducts = await database.getOrdersByOrderId(order_id);
    const claimedProducts = orderProducts.filter(order =>
      order.claimed_by === vendor.warehouseId &&
      (order.is_handover !== 1 && order.is_handover !== '1')  // Allow download until handed over
    );

    logger.info('📊 Order Analysis:');

    // Debug: Show all products for this order
    logger.info('🔍 All products for order:', order_id);
    orderProducts.forEach((product, index) => {
      logger.info(`  ${index + 1}. Product: ${product.product_name}`);
    });

    // Check if label already downloaded for this order_id
    logger.info('🔍 Checking if label already downloaded...');
    const orderWithLabel = orderProducts.find(product =>
      product.claimed_by === vendor.warehouseId &&
      product.status === 'claimed' &&
      product.label_downloaded === 1
    );

    if (orderWithLabel && claimedProducts.length > 0) {
      logger.info('✅ LABEL ALREADY DOWNLOADED: Found label_downloaded = 1 in orders table');

      const cachedLabel = await database.getLabelByOrderId(order_id);

      if (cachedLabel) {
        logger.info('✅ CACHED LABEL FOUND: Returning cached label URL');

        return res.json({
          success: true,
          message: 'Label retrieved from cache',
          data: {
            shipping_url: cachedLabel.label_url,
            awb: cachedLabel.awb,
            original_order_id: order_id,
            clone_order_id: order_id,
            cached: true
          }
        });
      } else {
        logger.info('⚠️ label_downloaded = 1 but no cached URL found, regenerating...');
      }
    }

    logger.info('🔍 No downloaded label found, proceeding with label generation...');

    // Debug: Log product counts and details
    logger.info(`📊 Product Analysis for ${order_id}:`);

    // Check shipping partner from store
    const accountCode = claimedProducts[0]?.account_code || orderProducts[0]?.account_code;
    if (!accountCode) {
      throw new Error(`account_code not found for order ${order_id}. Cannot determine shipping partner.`);
    }

    const store = await database.getStoreByAccountCode(accountCode);
    if (!store) {
      throw new Error(`Store not found for account_code: ${accountCode}`);
    }

    const isShiprocket = store.shipping_partner?.toLowerCase() === 'shiprocket';
    logger.info(`📦 Shipping Partner: ${store.shipping_partner} (${isShiprocket ? 'Shiprocket' : 'Shipway'})`);

    // Updated logic: Only 2 conditions (removed underscore check)
    if (orderProducts.length === claimedProducts.length) {
      // Condition 1: Direct download - all products claimed by vendor
      logger.info('✅ CONDITION 1: Direct download - all products claimed by vendor');

      if (isShiprocket) {
        // Shiprocket direct download — AWB assign + label generation
        logger.info('🚀 Shiprocket direct download — assigning AWB + generating label...');
        const labelResponse = await generateLabelForShiprocketOrder(order_id, claimedProducts, vendor, format);

        // 6.4 — Store label + mark products downloaded atomically in one transaction.
        // Without a transaction, a mid-loop failure could store the label but leave
        // some claims.label_downloaded = 0, causing duplicate downloads on retry.
        if (labelResponse.success && labelResponse.data.shipping_url) {
          try {
            const labelDataToStore = {
              order_id: order_id,
              account_code: accountCode,
              label_url: labelResponse.data.shipping_url,
              awb: labelResponse.data.awb,
              carrier_id: labelResponse.data.carrier_id,
              carrier_name: labelResponse.data.carrier_name
            };

            logger.info(`📦 Storing label data for Shiprocket direct download:`, labelDataToStore);
            const txManager = new TransactionManager(database.pool);
            await txManager.runInTransaction(async (conn) => {
              await database.upsertLabel(labelDataToStore, conn);
              // 7.4 — Single batch UPDATE instead of N individual updateOrder calls
              const dlUniqueIds = claimedProducts.map(p => p.unique_id);
              const dlPlaceholders = dlUniqueIds.map(() => '?').join(',');
              await conn.execute(
                `UPDATE claims SET label_downloaded = 1 WHERE order_unique_id IN (${dlPlaceholders})`,
                dlUniqueIds
              );
            });
            logger.info(`✅ Label cached and products marked as downloaded (transactional)`);
          } catch (cacheError) {
            logger.error('⚠️ Failed to cache Shiprocket label (continuing anyway):', cacheError.message);
          }
        }

        return res.json(labelResponse);
      } else {
        // Shipway direct download (existing flow)
      const labelResponse = await generateLabelForOrder(order_id, claimedProducts, vendor, format);

      // 6.4 — Store label + mark products downloaded atomically in one transaction.
      if (labelResponse.success && labelResponse.data.shipping_url) {
        try {
          const labelDataToStore = {
            order_id: order_id,
            account_code: accountCode,
            label_url: labelResponse.data.shipping_url,
            awb: labelResponse.data.awb,
            carrier_id: labelResponse.data.carrier_id,
            carrier_name: labelResponse.data.carrier_name
          };

          logger.info(`📦 Storing label data for Shipway direct download:`, labelDataToStore);
          const txManager = new TransactionManager(database.pool);
          await txManager.runInTransaction(async (conn) => {
            await database.upsertLabel(labelDataToStore, conn);
            // 7.4 — Single batch UPDATE instead of N individual updateOrder calls
            const dlUniqueIds = claimedProducts.map(p => p.unique_id);
            const dlPlaceholders = dlUniqueIds.map(() => '?').join(',');
            await conn.execute(
              `UPDATE claims SET label_downloaded = 1 WHERE order_unique_id IN (${dlPlaceholders})`,
              dlUniqueIds
            );
          });
          logger.info(`✅ Stored label and all products marked as downloaded (transactional) for order ${order_id}`);

        } catch (cacheError) {
          logger.info(`⚠️ Failed to cache label URL: ${cacheError.message}`);
        }
      }

      return res.json(labelResponse);
      }

    } else if (claimedProducts.length > 0) {
      // Condition 2: Clone required - some products claimed by vendor
      logger.info('🔄 CONDITION 2: Clone required - some products claimed by vendor');

      if (isShiprocket) {
        // Shiprocket clone flow
        let cloneResponse;
        try {
          cloneResponse = await handleShiprocketOrderCloning(order_id, claimedProducts, orderProducts, vendor);
        } catch (firstError) {
          // Check if error is due to clone conflict
          if (firstError.message && firstError.message.includes('already exists')) {
            logger.info('⚠️ CLONE CONFLICT DETECTED: Clone order already exists');
            logger.info('🔄 RETRYING: Using suffix _99 to avoid conflict...');

            try {
              cloneResponse = await handleShiprocketOrderCloning(order_id, claimedProducts, orderProducts, vendor, '99');
              logger.info('✅ RETRY SUCCESSFUL: Clone created with _99 suffix');
            } catch (retryError) {
              logger.error('❌ RETRY FAILED: Could not create clone even with _99 suffix');
              throw retryError;
            }
          } else {
            throw firstError;
          }
        }

        return res.json(cloneResponse);
      } else {
        // Shipway clone flow (existing)
      let cloneResponse;
      try {
        // Try normal clone creation first
        cloneResponse = await handleOrderCloning(order_id, claimedProducts, orderProducts, vendor);
      } catch (firstError) {
        // Check if error is due to clone conflict with external orders
        if (firstError.message && firstError.message.includes('not found in Shipway')) {
          logger.info('⚠️ CLONE CONFLICT DETECTED: Clone order already exists in Shipway (created externally)');
          logger.info('🔄 RETRYING: Using suffix _99 to avoid conflict with external clones...');

          try {
            // Retry with _99 suffix to avoid conflicts with external clones (_1, _2, etc.)
            cloneResponse = await handleOrderCloning(order_id, claimedProducts, orderProducts, vendor, '99');
            logger.info('✅ RETRY SUCCESSFUL: Clone created with _99 suffix');
          } catch (retryError) {
            logger.error('❌ RETRY FAILED: Could not create clone even with _99 suffix');
            throw retryError; // Re-throw to be caught by outer catch block
          }
        } else {
          // Not a clone conflict error, re-throw original error
          throw firstError;
        }
      }

      return res.json(cloneResponse);
      }

    } else {
      // No products claimed by this vendor
      logger.info('❌ No products claimed by this vendor for order:', order_id);
      return res.status(400).json({
        success: false,
        message: 'No products claimed by this vendor for this order'
      });
    }

  } catch (error) {
    logger.error('❌ DOWNLOAD LABEL ERROR:', error);

    // Create notification for specific error patterns (only if vendor is defined)
    let notificationCreated = false;
    if (vendor) {
      try {
        notificationCreated = await createLabelGenerationNotification(error.message, order_id, vendor);
        logger.info('✅ Notification created for failed order:', order_id);
      } catch (notificationError) {
        logger.error('⚠️ Failed to create notification (non-blocking):', notificationError.message);
      }
    } else {
      logger.info('⚠️ Skipping notification creation - vendor not authenticated');
    }

    // Return a user-friendly response with warning message
    return res.status(200).json({
      success: false,
      warning: true,
      message: `Order ${order_id} not assigned, please contact admin`,
      userMessage: `Order ${order_id} not assigned, please contact admin`,
      error: error.message,
      notificationCreated: notificationCreated,
      order_id: order_id
    });
  }
});

/**
 * Categorize error to determine if we should try next carrier or stop immediately
 * @param {string} errorMessage - The error message from Shipway API
 * @returns {Object} - { type, category, userMessage, shouldTryNextCarrier }
 */
function categorizeError(errorMessage) {
  const msg = errorMessage.toLowerCase();

  // CRITICAL ERRORS - Stop immediately, don't try other carriers

  // Authentication/Authorization errors
  if (msg.includes('authentication') ||
    msg.includes('unauthorized') ||
    msg.includes('invalid credentials') ||
    msg.includes('invalid token') ||
    msg.includes('access denied')) {
    return {
      type: 'CRITICAL',
      category: 'CRITICAL_AUTH',
      userMessage: 'Authentication failed. Please contact admin to verify Shipway credentials.',
      shouldTryNextCarrier: false
    };
  }

  // Invalid data errors
  if (msg.includes('invalid order data') ||
    msg.includes('customer info not found') ||
    msg.includes('missing required field') ||
    msg.includes('invalid payload')) {
    return {
      type: 'CRITICAL',
      category: 'CRITICAL_DATA',
      userMessage: 'Invalid order data. Please contact admin to verify order information.',
      shouldTryNextCarrier: false
    };
  }

  // Configuration errors
  if (msg.includes('no priority carriers') ||
    msg.includes('priority carriers assigned')) {
    return {
      type: 'CRITICAL',
      category: 'CRITICAL_CONFIG',
      userMessage: 'No priority carriers configured. Please contact admin.',
      shouldTryNextCarrier: false
    };
  }

  // RETRIABLE ERRORS - Continue to next carrier

  // Pincode serviceability
  if (msg.includes('pincode not serviceable') ||
    msg.includes('pincode is not serviceable') ||
    msg.includes('delivery pincode is not serviceable')) {
    return {
      type: 'RETRIABLE',
      category: 'RETRIABLE_PINCODE',
      userMessage: 'Delivery pincode not serviceable by this carrier.',
      shouldTryNextCarrier: true
    };
  }

  // Network/Connection errors
  if (msg.includes('timeout') ||
    msg.includes('network error') ||
    msg.includes('connection refused') ||
    msg.includes('econnrefused') ||
    msg.includes('socket hang up') ||
    msg.includes('connection reset')) {
    return {
      type: 'RETRIABLE',
      category: 'RETRIABLE_NETWORK',
      userMessage: 'Network connection error. Trying next carrier...',
      shouldTryNextCarrier: true
    };
  }

  // Carrier-specific errors
  if (msg.includes('carrier not available') ||
    msg.includes('carrier temporarily unavailable') ||
    msg.includes('weight exceeds limit') ||
    msg.includes('weight limit exceeded') ||
    msg.includes('dimensions exceed') ||
    msg.includes('service not available')) {
    return {
      type: 'RETRIABLE',
      category: 'RETRIABLE_CARRIER',
      userMessage: 'Carrier cannot handle this shipment. Trying next carrier...',
      shouldTryNextCarrier: true
    };
  }

  // Rate limiting/Temporary unavailability
  if (msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('service temporarily unavailable') ||
    msg.includes('server busy') ||
    msg.includes('503') ||
    msg.includes('502')) {
    return {
      type: 'RETRIABLE',
      category: 'RETRIABLE_RATE',
      userMessage: 'Service temporarily unavailable. Trying next carrier...',
      shouldTryNextCarrier: true
    };
  }

  // AWB assignment in progress - retriable error
  if (msg.includes('awb assignment is in progress') ||
    msg.includes('have patience')) {
    return {
      type: 'RETRIABLE',
      category: 'RETRIABLE_AWB_PROGRESS',
      userMessage: 'AWB assignment is in progress. Trying next carrier...',
      shouldTryNextCarrier: true
    };
  }

  // UNKNOWN ERRORS - Default to retriable (safety net)
  // Better to try next carrier than fail prematurely
  return {
    type: 'UNKNOWN',
    category: 'UNKNOWN_ERROR',
    userMessage: 'Unknown error occurred. Trying next carrier...',
    shouldTryNextCarrier: true
  };
}

/**
 * Generate label for an order (Condition 1: Direct download)
 */
async function generateLabelForOrder(orderId, products, vendor, format = 'thermal', dataMaps = null) {
  try {
    logger.info('🔄 Generating label for order:', orderId);

    // Get customer info from database (use pre-fetched data if available)
    const database = require('../config/database');
    const customerInfo = dataMaps?.customerInfoMap?.get(orderId) ||
      await database.getCustomerInfoByOrderId(orderId);

    if (!customerInfo) {
      throw new Error(`Customer info not found for order ID: ${orderId}. Please sync orders from Shipway first.`);
    }

    // Log customer info for debugging (especially phone numbers)

    // Get account_code from order (validate it exists in store_info)
    const accountCode = customerInfo.account_code || products[0]?.account_code;
    if (!accountCode) {
      throw new Error(`account_code not found for order ID: ${orderId}. Cannot generate label without store information.`);
    }

    // Validate account_code exists in store_info (use pre-fetched data if available)
    const store = dataMaps?.storesMap?.get(accountCode) ||
      await database.getStoreByAccountCode(accountCode);
    if (!store) {
      throw new Error(`Store not found for account_code: ${accountCode}. Cannot generate label without valid store information.`);
    }
    if (store.status !== 'active') {
      throw new Error(`Store is not active for account_code: ${accountCode}. Cannot generate label for inactive store.`);
    }


    // Validate and sanitize phone number (required by Shipway API)
    // Use shipping_phone if available, otherwise fallback to billing_phone
    let shippingPhone = customerInfo.shipping_phone || customerInfo.billing_phone || '';

    // Remove any non-digit characters except + (for international numbers)
    shippingPhone = shippingPhone.toString().trim();

    // Validate phone number is not empty
    if (!shippingPhone || shippingPhone === '' || shippingPhone === 'null' || shippingPhone === 'undefined') {
      throw new Error(`Invalid or missing shipping phone number for order ${orderId}. Phone number is required for label generation.`);
    }

    // Log phone number for debugging (mask sensitive digits)
    const maskedPhone = shippingPhone.length > 4
      ? shippingPhone.substring(0, 2) + '****' + shippingPhone.substring(shippingPhone.length - 2)
      : '****';

    // Convert customer_info to originalOrder format expected by prepareShipwayRequestBody
    const originalOrder = {
      order_id: orderId,
      store_code: customerInfo.store_code || '1', // Use dynamic store_code from database
      email: customerInfo.email,
      b_address: customerInfo.billing_address,
      b_address_2: customerInfo.billing_address2,
      b_city: customerInfo.billing_city,
      b_state: customerInfo.billing_state,
      b_country: customerInfo.billing_country,
      b_firstname: customerInfo.billing_firstname,
      b_lastname: customerInfo.billing_lastname,
      b_phone: customerInfo.billing_phone || shippingPhone, // Fallback to shipping phone if billing phone missing
      b_zipcode: customerInfo.billing_zipcode,
      b_latitude: customerInfo.billing_latitude,
      b_longitude: customerInfo.billing_longitude,
      s_address: customerInfo.shipping_address,
      s_address_2: customerInfo.shipping_address2,
      s_city: customerInfo.shipping_city,
      s_state: customerInfo.shipping_state,
      s_country: customerInfo.shipping_country,
      s_firstname: customerInfo.shipping_firstname,
      s_lastname: customerInfo.shipping_lastname,
      s_phone: shippingPhone, // Use validated phone number
      s_zipcode: customerInfo.shipping_zipcode,
      s_latitude: customerInfo.shipping_latitude,
      s_longitude: customerInfo.shipping_longitude
    };

    // STEP 1: Get top 3 priority carriers from the first product
    logger.info(`🚚 RETRIEVING TOP 3 PRIORITY CARRIERS for order ${orderId}...`);
    const firstProduct = products[0];
    const priorityCarrierStr = firstProduct.priority_carrier || '[]';


    let priorityCarriers = [];
    try {
      priorityCarriers = JSON.parse(priorityCarrierStr);
      if (!Array.isArray(priorityCarriers)) {
        priorityCarriers = [];
      }
    } catch (parseError) {
      logger.info(`⚠️ Failed to parse priority_carrier: ${parseError.message}`);
      priorityCarriers = [];
    }


    if (priorityCarriers.length === 0) {
      logger.info(`❌ No priority carriers available for order ${orderId}`);
      throw new Error('No priority carriers assigned to this order. Please contact admin.');
    }

    // Get carrier details from database for name lookup (use pre-fetched data if available)
    const carrierServiceabilityService = require('../services/carrierServiceabilityService');
    const carrierMap = dataMaps?.carrierMap ||
      new Map((await carrierServiceabilityService.readCarriersFromDatabase())
        .map(c => [c.carrier_id, c]));

    // STEP 2: Try each carrier in sequence with smart fallback logic
    logger.info(`\n${'='.repeat(80)}`);
    logger.info(`🚀 LABEL GENERATION STARTED`);
    logger.info(`   Order ID: ${orderId}`);
    logger.info(`   Format: ${format}`);
    logger.info(`   Vendor: ${vendor.name} (ID: ${vendor.id})`);
    logger.info(`   Timestamp: ${new Date().toISOString()}`);
    logger.info(`   Available Carriers: ${priorityCarriers.length}`);
    logger.info(`${'='.repeat(80)}\n`);

    let assignedCarrier = null;
    let response = null;
    let lastError = null;
    const carrierAttempts = []; // Store all carrier attempts for summary

    for (let i = 0; i < priorityCarriers.length; i++) {
      const carrierId = priorityCarriers[i];
      const carrierInfo = carrierMap.get(carrierId);
      const carrierName = carrierInfo ? carrierInfo.carrier_name : `Carrier ${carrierId}`;
      const attemptTimestamp = new Date().toISOString();

      logger.info(`\n🔹 CARRIER ATTEMPT ${i + 1}/${priorityCarriers.length}`);
      logger.info(`   Carrier ID: ${carrierId}`);
      logger.info(`   Carrier Name: ${carrierName}`);
      logger.info(`   Timestamp: ${attemptTimestamp}`);
      logger.info(`   ${'─'.repeat(70)}`);

      try {
        // Create a modified products array with this specific carrier
        const modifiedProducts = products.map(p => ({
          ...p,
          priority_carrier: carrierId
        }));

        // Prepare request body with this carrier (pass dataMaps for warehouse mapping)
        const requestBody = await prepareShipwayRequestBody(orderId, modifiedProducts, originalOrder, vendor, true, accountCode, dataMaps);

        logger.info(`   📡 Calling Shipway API...`);

        // Call Shipway API with account_code for store-specific credentials
        response = await callShipwayPushOrderAPI(requestBody, true, accountCode);

        // If we reach here, API call succeeded
        assignedCarrier = {
          carrier_id: carrierId,
          carrier_name: carrierName
        };

        // Log success
        logger.info(`\n${'='.repeat(80)}`);
        logger.info(`✅ LABEL GENERATION SUCCESSFUL!`);
        logger.info(`   Order ID: ${orderId}`);
        logger.info(`   Carrier: ${carrierName} (ID: ${carrierId})`);
        logger.info(`   AWB: ${response.awb_response?.AWB || response.AWB || 'N/A'}`);
        logger.info(`   Timestamp: ${new Date().toISOString()}`);
        logger.info(`${'='.repeat(80)}\n`);

        break; // Exit loop on success

      } catch (error) {
        lastError = error;
        const errorMessage = error.message || '';
        const errorTimestamp = new Date().toISOString();

        // Categorize the error
        const errorCategory = categorizeError(errorMessage);

        // Store attempt details
        carrierAttempts.push({
          carrier_id: carrierId,
          carrier_name: carrierName,
          error: errorMessage,
          error_type: errorCategory.type,
          error_category: errorCategory.category,
          timestamp: errorTimestamp
        });

        logger.info(`   ❌ ATTEMPT FAILED`);
        logger.info(`   Error Type: ${errorCategory.type}`);
        logger.info(`   Error Category: ${errorCategory.category}`);
        logger.info(`   Error Message: ${errorMessage}`);
        logger.info(`   User Message: ${errorCategory.userMessage}`);
        logger.info(`   Should Try Next: ${errorCategory.shouldTryNextCarrier}`);
        logger.info(`   Timestamp: ${errorTimestamp}`);

        // Check if this is a CRITICAL error - stop immediately
        if (errorCategory.type === 'CRITICAL') {
          logger.info(`\n🛑 CRITICAL ERROR DETECTED - STOPPING ALL ATTEMPTS`);
          logger.info(`   Reason: ${errorCategory.category}`);
          logger.info(`   No further carriers will be tried`);

          // Create notification for admin
          try {
            await createLabelGenerationNotification(
              errorMessage,
              orderId,
              vendor,
              errorCategory.category,
              errorCategory.type
            );
            logger.info(`   ✅ Notification created for admin`);
          } catch (notifError) {
            logger.info(`   ⚠️ Failed to create notification: ${notifError.message}`);
          }

          throw new Error('Unable to perform action. Kindly contact Admin');
        }

        // Check if we should try next carrier (RETRIABLE or UNKNOWN errors)
        if (errorCategory.shouldTryNextCarrier && i < priorityCarriers.length - 1) {
          logger.info(`   ⏭️  Trying next carrier...`);
          continue; // Try next carrier
        } else {
          // Last carrier or non-retriable error
          if (i < priorityCarriers.length - 1) {
            logger.info(`   🛑 Error not retriable, stopping attempts`);
          } else {
            logger.info(`   🛑 All ${priorityCarriers.length} carriers exhausted`);
          }

          // Create error summary
          logger.info(`\n${'='.repeat(80)}`);
          logger.info(`❌ LABEL GENERATION FAILED - ALL CARRIERS EXHAUSTED`);
          logger.info(`   Order ID: ${orderId}`);
          logger.info(`   Total Attempts: ${carrierAttempts.length}`);
          logger.info(`\n   📋 CARRIER ATTEMPT SUMMARY:`);
          carrierAttempts.forEach((attempt, idx) => {
            logger.info(`   ${idx + 1}. ${attempt.carrier_name} (ID: ${attempt.carrier_id})`);
            logger.info(`      Error Type: ${attempt.error_type}`);
            logger.info(`      Error Category: ${attempt.error_category}`);
            logger.info(`      Error: ${attempt.error.substring(0, 100)}${attempt.error.length > 100 ? '...' : ''}`);
          });
          logger.info(`${'='.repeat(80)}\n`);

          // Create notification for admin with summary
          const summarizedError = carrierAttempts.length === 1
            ? errorMessage
            : `All ${carrierAttempts.length} priority carriers failed for order ${orderId}. Last error: ${errorMessage}`;

          try {
            await createLabelGenerationNotification(
              summarizedError,
              orderId,
              vendor,
              errorCategory.category,
              errorCategory.type
            );
            logger.info(`✅ Notification created for admin`);
          } catch (notifError) {
            logger.info(`⚠️ Failed to create notification: ${notifError.message}`);
          }

          throw new Error('Unable to perform action. Kindly contact Admin');
        }
      }
    }

    // If we exhausted all carriers without success
    if (!assignedCarrier || !response) {
      logger.info(`❌ All ${priorityCarriers.length} carriers failed for order ${orderId}`);
      throw new Error('Unable to perform action. Kindly contact Admin');
    }

    logger.info('🔍 Shipway API Response Structure:');

    // Check if response indicates AWB assignment is in progress
    if (response.status === false || response.success === false) {
      const message = response.message || '';
      if (message.toLowerCase().includes('awb assignment is in progress') ||
        message.toLowerCase().includes('have patience')) {
        logger.info('⏳ AWB assignment is in progress - throwing retriable error');
        throw new Error(message);
      }
    }

    // Handle different possible response structures
    let shipping_url, awb;

    if (response.awb_response) {
      shipping_url = response.awb_response.shipping_url;
      awb = response.awb_response.AWB;
    } else if (response.shipping_url) {
      shipping_url = response.shipping_url;
      awb = response.AWB || response.awb;
    } else if (response.data && response.data.awb_response) {
      shipping_url = response.data.awb_response.shipping_url;
      awb = response.data.awb_response.AWB;
    } else if (response.data && response.data.shipping_url) {
      shipping_url = response.data.shipping_url;
      awb = response.data.AWB || response.data.awb;
    } else {
      logger.info('❌ Could not find shipping_url in response structure');

      // If there's a message indicating AWB assignment in progress, throw that instead
      if (response.message && (response.message.toLowerCase().includes('awb assignment is in progress') ||
        response.message.toLowerCase().includes('have patience'))) {
        throw new Error(response.message);
      }

      throw new Error('Invalid response structure from Shipway API - missing shipping_url');
    }

    logger.info('✅ Label generated successfully');

    // Handle different formats
    if (format === 'thermal') {
      // For thermal format, return the original label URL
      return {
        success: true,
        message: 'Label generated successfully',
        data: {
          shipping_url: shipping_url,
          awb: awb,
          order_id: orderId,
          carrier_id: assignedCarrier.carrier_id,
          carrier_name: assignedCarrier.carrier_name
        }
      };
    } else {
      // For A4 and four-in-one formats, generate a PDF with appropriate layout
      logger.info(`🔄 Generating ${format} format PDF...`);

      try {
        const formattedPdfBuffer = await generateFormattedLabelPDF(shipping_url, format);

        // Create a temporary file or return the buffer directly
        // For now, we'll return the buffer and let the frontend handle it
        return {
          success: true,
          message: `${format} format label generated successfully`,
          data: {
            shipping_url: shipping_url, // Keep original for reference
            awb: awb,
            order_id: orderId,
            carrier_id: assignedCarrier.carrier_id,
            carrier_name: assignedCarrier.carrier_name,
            formatted_pdf: formattedPdfBuffer.toString('base64'), // Base64 encoded PDF
            format: format
          }
        };
      } catch (pdfError) {
        logger.error('❌ PDF formatting failed:', pdfError);
        // Fallback to original thermal label
        return {
          success: true,
          message: 'Label generated successfully (fallback to thermal format)',
          data: {
            shipping_url: shipping_url,
            awb: awb,
            order_id: orderId,
            carrier_id: assignedCarrier.carrier_id,
            carrier_name: assignedCarrier.carrier_name
          }
        };
      }
    }

  } catch (error) {
    // Outer catch for unexpected errors that weren't handled by carrier loop
    logger.info(`\n${'='.repeat(80)}`);
    logger.info(`💥💥💥 UNEXPECTED ERROR IN LABEL GENERATION 💥💥💥`);
    logger.info(`   Order ID: ${orderId}`);
    logger.info(`   Vendor: ${vendor ? vendor.name : 'N/A'} (ID: ${vendor ? vendor.id : 'N/A'})`);
    logger.info(`   Error Type: ${error.constructor.name}`);
    logger.info(`   Error Message: ${error.message}`);
    logger.info(`   Timestamp: ${new Date().toISOString()}`);
    logger.info(`${'─'.repeat(80)}`);
    logger.info(`   📋 STACK TRACE:`);
    logger.info(error.stack || '   (No stack trace available)');
    logger.info(`${'='.repeat(80)}\n`);

    // Try to create notification even for unexpected errors
    if (vendor) {
      try {
        await createLabelGenerationNotification(
          `Unexpected error during label generation: ${error.message}`,
          orderId,
          vendor,
          'UNEXPECTED_ERROR',
          'CRITICAL'
        );
        logger.info(`✅ Notification created for unexpected error`);
      } catch (notifError) {
        logger.info(`⚠️ Failed to create notification for unexpected error: ${notifError.message}`);
      }
    }

    throw error;
  }
}

/**
 * Generate formatted label PDF based on format type
 */
async function generateFormattedLabelPDF(shippingUrl, format) {
  try {
    logger.info(`🔄 Generating ${format} format PDF from URL: ${shippingUrl}`);

    // Import PDF-lib for PDF manipulation
    const { PDFDocument } = require('pdf-lib');

    // Fetch the original PDF from the shipping URL
    const response = await fetch(shippingUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch label PDF: ${response.status}`);
    }

    const originalPdfBuffer = await response.arrayBuffer();
    const originalPdf = await PDFDocument.load(originalPdfBuffer);

    // Create a new PDF document
    const formattedPdf = await PDFDocument.create();

    if (format === 'a4') {
      // A4 format: One label per A4 page
      logger.info('📄 Creating A4 format (one label per page)');

      const a4Page = formattedPdf.addPage([595, 842]); // A4 size in points
      const [originalPage] = await formattedPdf.embedPages([originalPdf.getPage(0)]);

      // Center the label on the A4 page
      const labelWidth = 288; // 4x6 label width in points
      const labelHeight = 432; // 4x6 label height in points
      const x = (595 - labelWidth) / 2; // Center horizontally
      const y = (842 - labelHeight) / 2; // Center vertically

      a4Page.drawPage(originalPage, {
        x: x,
        y: y,
        width: labelWidth,
        height: labelHeight
      });

    } else if (format === 'four-in-one') {
      // Four-in-one format: 4 labels per A4 page
      logger.info('📄 Creating four-in-one format (4 labels per A4 page)');

      const a4Page = formattedPdf.addPage([595, 842]); // A4 size in points
      const [originalPage] = await formattedPdf.embedPages([originalPdf.getPage(0)]);

      // Original label dimensions
      const originalLabelWidth = 288; // 4x6 label width in points
      const originalLabelHeight = 432; // 4x6 label height in points

      // Layout parameters
      const horizontalMargin = 8; // Side margins
      const topBottomMargin = 3; // Top and bottom margins (reduced)
      const verticalGap = 12; // Gap between top and bottom rows

      // Calculate available space
      const availableHeight = 842 - (2 * topBottomMargin) - verticalGap;
      const scaledLabelHeight = availableHeight / 2; // Fit 2 rows perfectly
      const scaledLabelWidth = (scaledLabelHeight / originalLabelHeight) * originalLabelWidth;

      // Calculate vertical positions for proper spacing
      const topRowY = 842 - topBottomMargin - scaledLabelHeight;
      const bottomRowY = topBottomMargin;

      // Positions for 4 labels: top-left, top-right, bottom-left, bottom-right
      const positions = [
        [horizontalMargin, topRowY], // top-left
        [595 - scaledLabelWidth - horizontalMargin, topRowY], // top-right
        [horizontalMargin, bottomRowY], // bottom-left
        [595 - scaledLabelWidth - horizontalMargin, bottomRowY] // bottom-right
      ];

      // Draw the same label 4 times
      for (const [x, y] of positions) {
        a4Page.drawPage(originalPage, {
          x: x,
          y: y,
          width: scaledLabelWidth,
          height: scaledLabelHeight
        });
      }
    }

    // Save the formatted PDF
    const formattedPdfBytes = await formattedPdf.save();
    logger.info(`✅ ${format} format PDF generated successfully`);

    return Buffer.from(formattedPdfBytes);

  } catch (error) {
    logger.error(`❌ ${format} format PDF generation failed:`, error);
    throw error;
  }
}

/**
 * Handle order cloning (Condition 2: Clone required) — SHIPWAY
 * Transaction-aware: checks for in-progress transaction and resumes from last successful step.
 */
async function handleOrderCloning(originalOrderId, claimedProducts, allOrderProducts, vendor, forceCloneSuffix = null) {
  const MAX_ATTEMPTS = 5;
  const accountCode = claimedProducts[0]?.account_code;

  logger.info('🚀 Starting Shipway clone process (transaction-aware)...');
  logger.info(`📊 Input Analysis:`);
  if (forceCloneSuffix) {
  }

  // ============================================================================
  // PHASE 1: CHECK FOR EXISTING TRANSACTION (RESUME PATH)
  // ============================================================================
  let tx = null;
  let inputData = null;
  let skipToStep = 0;

  if (!forceCloneSuffix) {
    tx = await findExistingCloneTransaction(originalOrderId, vendor.warehouseId, accountCode);
  }

  if (tx) {
    // RESUME PATH — use the stored clone_order_id
    logger.info(`\n🔄 RESUME PATH: Found existing transaction #${tx.id} (last status: ${tx.status})`);

    inputData = await prepareInputData(originalOrderId, claimedProducts, allOrderProducts, vendor);
    inputData.cloneOrderId = tx.clone_order_id; // CRITICAL: use stored clone ID, don't generate new

    // Determine which step to resume from
    switch (tx.status) {
      case 'initiated':        skipToStep = 1; break; // Restart from create clone
      case 'clone_created':    skipToStep = 3; break; // Skip create+verify, go to update original
      case 'original_updated': skipToStep = 5; break; // Skip to update local DB
      case 'db_updated':       skipToStep = 6; break; // Skip to label generation
      default:                 skipToStep = 1; break; // Fallback
    }
  } else {
    // NEW PATH — generate fresh clone ID and record transaction
    inputData = await prepareInputData(originalOrderId, claimedProducts, allOrderProducts, vendor, forceCloneSuffix);

    tx = await createCloneTransaction({
      original_order_id: originalOrderId,
      clone_order_id: inputData.cloneOrderId,
      account_code: accountCode,
      vendor_warehouse_id: vendor.warehouseId,
      shipping_partner: 'shipway',
      claimed_product_unique_ids: JSON.stringify(claimedProducts.map(p => p.unique_id)),
      claimed_product_codes: JSON.stringify(claimedProducts.map(p => p.product_code))
    });
    skipToStep = 1;
  }

  const cloneOrderId = inputData.cloneOrderId;

  // ============================================================================
  // PHASE 2: EXECUTE STEPS (skipping already-completed ones)
  // ============================================================================
  try {
    // STEP 1: CREATE CLONE ORDER (NO LABEL)
    if (skipToStep <= 1) {
      logger.info('\n🔧 STEP 1: Creating clone order (without label)...');
      await retryOperation((data) => createCloneOrderOnly(data), MAX_ATTEMPTS, 'Create clone order', inputData);
      await updateCloneTransactionStatus(tx.id, 'clone_created');
      logger.info('✅ STEP 1 COMPLETED: Clone order created');
    } else {
      logger.info('\n⏩ STEP 1: SKIPPED (already completed)');
    }

    // STEP 2: VERIFY CLONE CREATION
    if (skipToStep <= 2) {
      logger.info('\n🔍 STEP 2: Verifying clone creation...');
      await retryOperation((data) => verifyCloneExists(data), MAX_ATTEMPTS, 'Verify clone creation', inputData);
      logger.info('✅ STEP 2 COMPLETED: Clone verified');
    } else {
      logger.info('\n⏩ STEP 2: SKIPPED (already completed)');
    }

    // STEP 3: UPDATE ORIGINAL ORDER
    if (skipToStep <= 3) {
      logger.info('\n📝 STEP 3: Updating original order (removing claimed products)...');
      await retryOperation((data) => updateOriginalOrder(data), MAX_ATTEMPTS, 'Update original order', inputData);
      logger.info('✅ STEP 3 COMPLETED: Original order updated');
    } else {
      logger.info('\n⏩ STEP 3: SKIPPED (already completed)');
    }

    // STEP 4: VERIFY ORIGINAL ORDER UPDATE
    if (skipToStep <= 4) {
      logger.info('\n🔍 STEP 4: Verifying original order update...');
      await retryOperation((data) => verifyOriginalOrderUpdate(data), MAX_ATTEMPTS, 'Verify original order update', inputData);
      await updateCloneTransactionStatus(tx.id, 'original_updated');
      logger.info('✅ STEP 4 COMPLETED: Original order update verified');
    } else {
      logger.info('\n⏩ STEP 4: SKIPPED (already completed)');
    }

    // STEP 5: UPDATE LOCAL DATABASE
    if (skipToStep <= 5) {
      logger.info('\n💾 STEP 5: Updating local database after clone creation...');
      await retryOperation((data) => updateLocalDatabaseAfterClone(data), MAX_ATTEMPTS, 'Update local database', inputData);
      await updateCloneTransactionStatus(tx.id, 'db_updated');
      logger.info('✅ STEP 5 COMPLETED: Local database updated');
    } else {
      logger.info('\n⏩ STEP 5: SKIPPED (already completed)');
    }

    // STEP 6: GENERATE LABEL FOR CLONE
    logger.info('\n🏷️ STEP 6: Generating label for clone order...');
    const labelResponse = await retryOperation((data) => generateLabelForClone(data), MAX_ATTEMPTS, 'Generate clone label', inputData);
    logger.info('✅ STEP 6 COMPLETED: Label generated');

    // STEP 7: MARK LABEL AS DOWNLOADED
    logger.info('\n✅ STEP 7: Marking label as downloaded and caching URL...');
    await retryOperation((data) => markLabelAsDownloaded(data, labelResponse), MAX_ATTEMPTS, 'Mark label downloaded', inputData);
    await updateCloneTransactionStatus(tx.id, 'completed', {
      awb_code: labelResponse.data?.awb || null
    });
    logger.info('✅ STEP 7 COMPLETED: Label marked as downloaded');

    // STEP 8: RETURN SUCCESS
    logger.info('\n🎉 Clone process completed successfully!');

    return {
      success: true,
      message: 'Order cloned and label generated successfully',
      data: {
        shipping_url: labelResponse.data.shipping_url,
        awb: labelResponse.data.awb,
        original_order_id: inputData.originalOrderId,
        clone_order_id: cloneOrderId
      }
    };

  } catch (error) {
    // Record error in transaction but preserve last successful status for resume
    await updateCloneTransactionStatus(tx.id, tx.status || 'initiated', { error_message: error.message });
    logger.error(`❌ Shipway clone failed (tx #${tx.id}):`, error.message);
    throw new Error(`Order cloning failed: ${error.message}`);
  }
}

/**
 * Helper Functions for Updated Clone Logic
 */

// Generic retry function with exponential backoff
async function retryOperation(operation, maxAttempts, stepName, inputData) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logger.info(`🔄 ${stepName} - Attempt ${attempt}/${maxAttempts}`);
      logger.info(`🔒 Using consistent input data (captured at: ${inputData.timestamp})`);

      // Pass the same inputData to every attempt
      const result = await operation(inputData);
      logger.info(`✅ ${stepName} - Success on attempt ${attempt}`);
      return result;

    } catch (error) {
      lastError = error;
      logger.info(`❌ ${stepName} - Failed on attempt ${attempt}: ${error.message}`);

      if (attempt === maxAttempts) {
        logger.info(`💥 ${stepName} - All ${maxAttempts} attempts failed with same data`);
        break;
      }

      // Wait before retry (exponential backoff)
      const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // 1s, 2s, 4s, 8s, 10s max
      logger.info(`⏳ ${stepName} - Waiting ${waitTime}ms before retry with SAME data...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  throw lastError;
}

/**
 * ============================================================================
 * CLONE TRANSACTION HELPERS
 * Used by both Shipway and Shiprocket clone flows to track progress and resume.
 * ============================================================================
 */

/**
 * Find an in-progress clone transaction for this order + vendor.
 * Returns the most recent non-completed transaction, or null if none exists.
 */
async function findExistingCloneTransaction(originalOrderId, vendorWarehouseId, accountCode) {
  const database = require('../config/database');
  try {
    const [rows] = await database.mysqlConnection.execute(
      `SELECT * FROM clone_transactions 
       WHERE original_order_id = ? 
         AND vendor_warehouse_id = ? 
         AND account_code = ?
         AND status NOT IN ('completed', 'rolled_back')
       ORDER BY created_at DESC LIMIT 1`,
      [originalOrderId, vendorWarehouseId, accountCode]
    );
    if (rows.length > 0) {
      logger.info(`🔍 Found existing clone transaction #${rows[0].id} (status: ${rows[0].status}, clone_id: ${rows[0].clone_order_id})`);
    }
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    logger.error(`❌ Error finding clone transaction: ${error.message}`);
    return null;
  }
}

/**
 * Record intent to clone before any external API calls are made.
 * This ensures we can always find and resume a clone that started but didn't finish.
 */
async function createCloneTransaction(data) {
  const database = require('../config/database');
  const [result] = await database.mysqlConnection.execute(
    `INSERT INTO clone_transactions 
     (original_order_id, clone_order_id, account_code, vendor_warehouse_id,
      shipping_partner, claimed_product_unique_ids, claimed_product_codes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'initiated')`,
    [data.original_order_id, data.clone_order_id, data.account_code,
     data.vendor_warehouse_id, data.shipping_partner,
     data.claimed_product_unique_ids, data.claimed_product_codes]
  );
  logger.info(`📝 Clone transaction #${result.insertId} created (${data.shipping_partner}: ${data.original_order_id} → ${data.clone_order_id})`);
  return { id: result.insertId, ...data, status: 'initiated' };
}

/**
 * Update clone transaction status after each step completes.
 * Also stores auxiliary data like shipment_id, awb_code, carrier_id as they become available.
 */
async function updateCloneTransactionStatus(txId, status, extras = {}) {
  const database = require('../config/database');
  
  // Build dynamic SET clause for optional fields
  let setClauses = ['status = ?'];
  let params = [status];

  if (extras.error_message !== undefined) {
    setClauses.push('error_message = ?');
    params.push(extras.error_message);
  }
  if (extras.clone_shipment_id !== undefined) {
    setClauses.push('clone_shipment_id = ?');
    params.push(extras.clone_shipment_id);
  }
  if (extras.awb_code !== undefined) {
    setClauses.push('awb_code = ?');
    params.push(extras.awb_code);
  }
  if (extras.assigned_carrier_id !== undefined) {
    setClauses.push('assigned_carrier_id = ?');
    params.push(extras.assigned_carrier_id);
  }
  
  params.push(txId);
  
  await database.mysqlConnection.execute(
    `UPDATE clone_transactions SET ${setClauses.join(', ')} WHERE id = ?`,
    params
  );
  logger.info(`📝 Clone transaction #${txId}: status → '${status}'${extras.clone_shipment_id ? ` (shipment: ${extras.clone_shipment_id})` : ''}${extras.awb_code ? ` (awb: ${extras.awb_code})` : ''}`);
}

/**
 * Handle Shiprocket order cloning (Condition 2: Clone required) — SHIPROCKET
 * Transaction-aware: checks for in-progress transaction and resumes from last successful step.
 * Unlike Shipway, Shiprocket requires separate API calls for AWB assignment and label generation.
 */
async function handleShiprocketOrderCloning(originalOrderId, claimedProducts, allOrderProducts, vendor, forceCloneSuffix = null) {
  const MAX_ATTEMPTS = 5;
  const accountCode = claimedProducts[0]?.account_code;

  logger.info('🚀 Starting Shiprocket clone process (transaction-aware)...');
  logger.info(`📊 Input Analysis:`);
  if (forceCloneSuffix) {
  }

  // ============================================================================
  // PHASE 1: CHECK FOR EXISTING TRANSACTION (RESUME PATH)
  // ============================================================================
  let tx = null;
  let inputData = null;
  let skipToStep = 0;

  if (!forceCloneSuffix) {
    tx = await findExistingCloneTransaction(originalOrderId, vendor.warehouseId, accountCode);
  }

  if (tx) {
    // RESUME PATH — use the stored clone_order_id and any partial data
    logger.info(`\n🔄 RESUME PATH: Found existing SR transaction #${tx.id} (last status: ${tx.status})`);

    inputData = await prepareInputData(originalOrderId, claimedProducts, allOrderProducts, vendor);
    inputData.cloneOrderId = tx.clone_order_id; // CRITICAL: use stored clone ID

    // Restore partial data from transaction
    if (tx.clone_shipment_id) {
      inputData.cloneShipmentIdForShipment = tx.clone_shipment_id;
    }
    if (tx.awb_code) {
      inputData.awbCode = tx.awb_code;
    }
    if (tx.assigned_carrier_id) {
      inputData.assignedCarrierId = tx.assigned_carrier_id;
    }

    // Determine which step to resume from
    switch (tx.status) {
      case 'initiated':        skipToStep = 1; break;
      case 'clone_created':    skipToStep = 2; break;
      case 'awb_assigned':     skipToStep = 3; break;
      case 'original_updated': skipToStep = 4; break;
      case 'db_updated':       skipToStep = 5; break;
      default:                 skipToStep = 1; break;
    }
  } else {
    // NEW PATH
    inputData = await prepareInputData(originalOrderId, claimedProducts, allOrderProducts, vendor, forceCloneSuffix);

    tx = await createCloneTransaction({
      original_order_id: originalOrderId,
      clone_order_id: inputData.cloneOrderId,
      account_code: accountCode,
      vendor_warehouse_id: vendor.warehouseId,
      shipping_partner: 'shiprocket',
      claimed_product_unique_ids: JSON.stringify(claimedProducts.map(p => p.unique_id)),
      claimed_product_codes: JSON.stringify(claimedProducts.map(p => p.product_code))
    });
    skipToStep = 1;
  }

  // Get warehouse mapping for pickup_location
  const database = require('../config/database');
  const whMapping = await database.getWhMappingByClaimioWhIdAndAccountCode(vendor.warehouseId, inputData.accountCode);
  if (!whMapping || !whMapping.pickup_location) {
    throw new Error(`Warehouse mapping not found or pickup_location missing for claimio_wh_id: ${vendor.warehouseId}, account_code: ${inputData.accountCode}`);
  }
  inputData.pickupLocation = whMapping.pickup_location;

  const cloneOrderId = inputData.cloneOrderId;

  // ============================================================================
  // PHASE 2: EXECUTE STEPS
  // ============================================================================
  try {
    // STEP 1: CREATE CLONE ORDER
    if (skipToStep <= 1) {
      logger.info('\n🔧 STEP 1: Creating Shiprocket clone order...');
      await retryOperation((data) => createShiprocketCloneOrderOnly(data), MAX_ATTEMPTS, 'Create SR clone', inputData);
      await updateCloneTransactionStatus(tx.id, 'clone_created', {
        clone_shipment_id: inputData.cloneShipmentIdForShipment || null
      });
      logger.info('✅ STEP 1 COMPLETED: Clone order created');
    } else {
      logger.info('\n⏩ STEP 1: SKIPPED (already completed)');
    }

    // STEP 2: ASSIGN AWB (Shiprocket-specific)
    if (skipToStep <= 2) {
      logger.info('\n🔗 STEP 2: Assigning AWB for Shiprocket clone...');
      await retryOperation((data) => assignAWBForShiprocketClone(data), MAX_ATTEMPTS, 'Assign AWB', inputData);
      await updateCloneTransactionStatus(tx.id, 'awb_assigned', {
        awb_code: inputData.awbCode || null,
        assigned_carrier_id: inputData.assignedCarrierId || null
      });
      logger.info('✅ STEP 2 COMPLETED: AWB assigned');
    } else {
      logger.info('\n⏩ STEP 2: SKIPPED (already completed)');
    }

    // STEP 3: UPDATE ORIGINAL ORDER
    if (skipToStep <= 3) {
      logger.info('\n📝 STEP 3: Updating original Shiprocket order...');
      await retryOperation((data) => updateShiprocketOriginalOrder(data), MAX_ATTEMPTS, 'Update SR original', inputData);
      await updateCloneTransactionStatus(tx.id, 'original_updated');
      logger.info('✅ STEP 3 COMPLETED: Original order updated');
    } else {
      logger.info('\n⏩ STEP 3: SKIPPED (already completed)');
    }

    // STEP 4: UPDATE LOCAL DATABASE
    if (skipToStep <= 4) {
      logger.info('\n💾 STEP 4: Updating local database after clone...');
      await retryOperation((data) => updateLocalDatabaseAfterClone(data), MAX_ATTEMPTS, 'Update local DB', inputData);
      await updateCloneTransactionStatus(tx.id, 'db_updated');
      logger.info('✅ STEP 4 COMPLETED: Local database updated');
    } else {
      logger.info('\n⏩ STEP 4: SKIPPED (already completed)');
    }

    // STEP 5: GENERATE LABEL
    logger.info('\n🏷️ STEP 5: Generating label for Shiprocket clone...');
    const labelResponse = await retryOperation((data) => generateLabelForShiprocketClone(data), MAX_ATTEMPTS, 'Generate SR label', inputData);
    logger.info('✅ STEP 5 COMPLETED: Label generated');

    // STEP 6: MARK LABEL AS DOWNLOADED
    logger.info('\n✅ STEP 6: Marking label as downloaded...');
    await retryOperation((data) => markLabelAsDownloaded(data, labelResponse), MAX_ATTEMPTS, 'Mark downloaded', inputData);
    await updateCloneTransactionStatus(tx.id, 'completed');
    logger.info('✅ STEP 6 COMPLETED: Label marked as downloaded');

    // RETURN SUCCESS
    logger.info('\n🎉 Shiprocket clone process completed successfully!');

    return {
      success: true,
      message: 'Shiprocket clone order created and label generated successfully',
      data: {
        original_order_id: inputData.originalOrderId,
        clone_order_id: cloneOrderId,
        clone_shipment_id: inputData.cloneShipmentIdForShipment || null,
        shipping_url: labelResponse?.data?.shipping_url || null,
        awb: inputData.awbCode || null,
        carrier_id: inputData.assignedCarrierId || null,
        carrier_name: inputData.assignedCarrierName || null
      }
    };

  } catch (error) {
    // Record error but preserve last successful status for resume
    await updateCloneTransactionStatus(tx.id, tx.status || 'initiated', { error_message: error.message });
    logger.error(`❌ Shiprocket clone failed (tx #${tx.id}):`, error.message);
    throw error;
  }
}

// Step 1: Create Shiprocket clone order (NO label generation)
async function createShiprocketCloneOrderOnly(inputData) {
  const { cloneOrderId, claimedProducts, accountCode, pickupLocation, originalOrder } = inputData;

  logger.info(`🔒 Creating Shiprocket clone with consistent data:`);

  if (!accountCode) {
    throw new Error(`account_code not found in inputData for clone order ${cloneOrderId}. Cannot create clone without store information.`);
  }

  if (!pickupLocation) {
    throw new Error(`pickup_location not found in inputData for clone order ${cloneOrderId}. Cannot create clone without pickup location.`);
  }

  // Get customer info from database
  const database = require('../config/database');
  const customerInfo = await database.getCustomerInfoByOrderId(inputData.originalOrderId);
  if (!customerInfo) {
    throw new Error(`Customer info not found for order ID: ${inputData.originalOrderId}`);
  }

  // Initialize Shiprocket service
  const ShiprocketService = require('../services/shiprocketService');
  const shiprocketService = new ShiprocketService(accountCode);
  await shiprocketService.initialize();

  // Prepare request body
  const requestBody = shiprocketService.prepareCreateOrderBody(
    cloneOrderId,
    claimedProducts,
    customerInfo,
    pickupLocation
  );

  logger.info('📤 Shiprocket Create Adhoc Order Request Body:', JSON.stringify(requestBody, null, 2));

  // Call Shiprocket Create Adhoc Order API
  const response = await shiprocketService.createOrder(requestBody);

  if (!response.success) {
    throw new Error(`Failed to create Shiprocket clone order: ${response.message || 'Unknown error'}`);
  }

  // Extract order_id from response (this is Shiprocket's order ID, which maps to 'id' in get order API)
  // This should be stored in orders.partner_order_id in our database
  const shiprocketOrderId = response.data?.order_id;
  if (shiprocketOrderId) {
    inputData.cloneShipmentId = String(shiprocketOrderId);
  } else {
    logger.warn(`⚠️ No order_id returned from Shiprocket for clone order: ${cloneOrderId}`);
  }

  // Extract shipment_id from response (if available)
  // Check both direct shipment_id and shipments array (first shipment)
  let shipmentId = null;
  if (response.data?.shipment_id) {
    shipmentId = String(response.data.shipment_id);
  } else if (response.data?.shipments && Array.isArray(response.data.shipments) && response.data.shipments.length > 0) {
    shipmentId = response.data.shipments[0].id ? String(response.data.shipments[0].id) : null;
  }
  
  if (shipmentId) {
    inputData.cloneShipmentIdForShipment = shipmentId;
  } else {
  }

  logger.info('✅ Shiprocket clone order created successfully');
  return response;
}

// Step 3: Update Shiprocket original order
async function updateShiprocketOriginalOrder(inputData) {
  const { originalOrderId, remainingProducts, accountCode, pickupLocation } = inputData;

  logger.info(`🔒 Updating Shiprocket original with consistent data:`);

  if (remainingProducts.length > 0) {
    if (!accountCode) {
      throw new Error(`account_code not found in inputData for original order ${originalOrderId}. Cannot update order without store information.`);
    }

    if (!pickupLocation) {
      throw new Error(`pickup_location not found in inputData for original order ${originalOrderId}. Cannot update order without pickup location.`);
    }

    // Get customer info
    const database = require('../config/database');
    const customerInfo = await database.getCustomerInfoByOrderId(originalOrderId);
    if (!customerInfo) {
      throw new Error(`Customer info not found for order ID: ${originalOrderId}`);
    }

    // Initialize Shiprocket service
    const ShiprocketService = require('../services/shiprocketService');
    const shiprocketService = new ShiprocketService(accountCode);
    await shiprocketService.initialize();

    // Prepare request body
    const requestBody = shiprocketService.prepareUpdateOrderBody(
      originalOrderId,
      remainingProducts,
      customerInfo,
      pickupLocation
    );

    logger.info('📤 Shiprocket Update Order Request Body:', JSON.stringify(requestBody, null, 2));

    // Call Shiprocket Update Order API
    const response = await shiprocketService.updateOrder(requestBody);

    if (!response.success) {
      throw new Error(`Failed to update Shiprocket original order: ${response.message || 'Unknown error'}`);
    }

    logger.info('✅ Shiprocket original order updated successfully');
    return response;
  } else {
    logger.info('ℹ️ No remaining products - original order will be empty');
    return { success: true, message: 'No remaining products to update' };
  }
}

/**
 * Step 2 (Shiprocket clone): Assign AWB to the clone order
 * Tries each priority carrier in sequence (same fallback pattern as Shipway).
 * Stores assigned carrier_id, carrier_name, and awb_code in inputData for later steps.
 */
async function assignAWBForShiprocketClone(inputData) {
  const { cloneOrderId, accountCode, claimedProducts } = inputData;

  // shipment_id was stored in inputData during Step 1 (createShiprocketCloneOrderOnly)
  const shipmentId = inputData.cloneShipmentIdForShipment;
  if (!shipmentId) {
    throw new Error(`shipment_id not available for clone ${cloneOrderId}. Cannot assign AWB. Please retry — it may be populated on next attempt.`);
  }

  logger.info(`🔗 Assigning AWB for Shiprocket clone...`);

  // Get priority carriers (already assigned during claim)
  const priorityCarrierStr = claimedProducts[0]?.priority_carrier || '[]';
  let priorityCarriers;
  try {
    priorityCarriers = JSON.parse(priorityCarrierStr);
  } catch (e) {
    priorityCarriers = [];
  }
  if (!Array.isArray(priorityCarriers) || priorityCarriers.length === 0) {
    throw new Error(`No priority carriers assigned for clone ${cloneOrderId}. Please contact admin to assign carriers.`);
  }


  // Initialize Shiprocket service
  const ShiprocketService = require('../services/shiprocketService');
  const shiprocketService = new ShiprocketService(accountCode);

  // Try each carrier in sequence (fallback pattern)
  let awbResult = null;
  let lastError = null;

  for (const carrierId of priorityCarriers) {
    try {
      awbResult = await shiprocketService.assignAWB(shipmentId, carrierId);
      if (awbResult.success) {
        inputData.assignedCarrierId = String(carrierId);
        inputData.assignedCarrierName = awbResult.courier_name || '';
        inputData.awbCode = awbResult.awb_code;
        logger.info(`  ✅ AWB assigned: ${awbResult.awb_code} (carrier: ${awbResult.courier_name})`);
        break;
      } else {
        logger.info(`  ❌ Carrier ${carrierId} rejected: ${awbResult.message}`);
        lastError = new Error(awbResult.message || `AWB assign failed for carrier ${carrierId}`);
      }
    } catch (error) {
      logger.info(`  ❌ Carrier ${carrierId} error: ${error.message}`);
      lastError = error;
      continue;
    }
  }

  if (!awbResult?.success) {
    throw lastError || new Error(`All ${priorityCarriers.length} priority carriers failed for AWB assignment on clone ${cloneOrderId}.`);
  }

  return awbResult;
}

/**
 * Step 5 (Shiprocket clone): Generate label using Shiprocket API
 * Requires shipment_id from Step 1.
 */
async function generateLabelForShiprocketClone(inputData) {
  const { cloneOrderId, accountCode } = inputData;
  const shipmentId = inputData.cloneShipmentIdForShipment;

  if (!shipmentId) {
    throw new Error(`shipment_id not available for clone ${cloneOrderId}. Cannot generate label.`);
  }

  logger.info(`🏷️ Generating label for Shiprocket clone...`);

  const ShiprocketService = require('../services/shiprocketService');
  const shiprocketService = new ShiprocketService(accountCode);

  const labelResult = await shiprocketService.generateLabel(
    [parseInt(shipmentId)],
    'thermal' // Default format
  );

  if (!labelResult.success) {
    throw new Error(`Label generation failed for clone ${cloneOrderId}: ${labelResult.message}`);
  }

  logger.info(`  ✅ Label generated: ${labelResult.label_url}`);

  return {
    success: true,
    data: {
      shipping_url: labelResult.label_url,
      awb: inputData.awbCode || null,
      carrier_id: inputData.assignedCarrierId || null,
      carrier_name: inputData.assignedCarrierName || null
    }
  };
}

/**
 * Shiprocket Direct Download (Condition 1): AWB assign + label generation for existing orders
 * Used when ALL products are claimed by one vendor — no cloning needed.
 * The original order already exists in Shiprocket, so we assign AWB + generate label directly.
 */
async function generateLabelForShiprocketOrder(orderId, products, vendor, format = 'thermal') {
  const database = require('../config/database');
  const accountCode = products[0]?.account_code;

  logger.info(`🚀 Shiprocket direct download (Condition 1) for order ${orderId}...`);

  // Get shipment_id from orders table (already stored from sync)
  const shipmentId = products[0]?.shipment_id;
  if (!shipmentId) {
    throw new Error(`shipment_id not found for order ${orderId}. The order may not have been synced yet. Please wait for the next sync cycle.`);
  }

  // Get priority carriers (already assigned during claim)
  const priorityCarrierStr = products[0]?.priority_carrier || '[]';
  let priorityCarriers;
  try {
    priorityCarriers = JSON.parse(priorityCarrierStr);
  } catch (e) {
    priorityCarriers = [];
  }
  if (!Array.isArray(priorityCarriers) || priorityCarriers.length === 0) {
    throw new Error(`No priority carriers assigned for order ${orderId}. Please contact admin.`);
  }


  // Initialize Shiprocket service
  const ShiprocketService = require('../services/shiprocketService');
  const shiprocketService = new ShiprocketService(accountCode);

  // Try each carrier in sequence for AWB assignment
  let awbResult = null;
  let assignedCarrier = null;
  let lastError = null;

  for (const carrierId of priorityCarriers) {
    try {
      awbResult = await shiprocketService.assignAWB(shipmentId, carrierId);
      if (awbResult.success) {
        assignedCarrier = { carrier_id: carrierId, carrier_name: awbResult.courier_name };
        logger.info(`  ✅ AWB assigned: ${awbResult.awb_code} (carrier: ${awbResult.courier_name})`);
        break;
      } else {
        logger.info(`  ❌ Carrier ${carrierId} rejected: ${awbResult.message}`);
        lastError = new Error(awbResult.message || `AWB assign failed for carrier ${carrierId}`);
      }
    } catch (error) {
      logger.info(`  ❌ Carrier ${carrierId} error: ${error.message}`);
      lastError = error;
      continue;
    }
  }

  if (!awbResult?.success) {
    throw lastError || new Error(`All priority carriers failed for AWB assignment on order ${orderId}. Contact admin.`);
  }

  // Generate label
  const labelResult = await shiprocketService.generateLabel([parseInt(shipmentId)], format);
  if (!labelResult.success) {
    throw new Error(`Label generation failed for order ${orderId}: ${labelResult.message}`);
  }

  logger.info(`  ✅ Label generated: ${labelResult.label_url}`);

  return {
    success: true,
    message: 'Label generated successfully (Shiprocket direct download)',
    data: {
      shipping_url: labelResult.label_url,
      awb: awbResult.awb_code,
      order_id: orderId,
      carrier_id: assignedCarrier.carrier_id,
      carrier_name: assignedCarrier.carrier_name
    }
  };
}

// Step 0: Prepare and freeze input data
async function prepareInputData(originalOrderId, claimedProducts, allOrderProducts, vendor, forceCloneSuffix = null) {
  logger.info('📋 Capturing input data for clone process...');

  // Extract account_code from claimed products FIRST (CRITICAL: Must match the store)
  const accountCode = claimedProducts[0]?.account_code;
  if (!accountCode) {
    throw new Error(`account_code not found for order ${originalOrderId}. Cannot create clone without store information.`);
  }


  // Get database reference early (needed for both store lookup and customer info)
  const database = require('../config/database');

  // Detect shipping partner for this store (needed for partner-aware clone ID generation)
  const store = await database.getStoreByAccountCode(accountCode);
  const shippingPartner = (store?.shipping_partner || 'Shipway').toLowerCase();

  // Generate unique clone ID (partner-aware: skips Shipway API check for Shiprocket)
  const cloneOrderId = await generateUniqueCloneId(originalOrderId, forceCloneSuffix, accountCode, shippingPartner);

  // Get customer info from database
  const customerInfo = await database.getCustomerInfoByOrderId(originalOrderId);

  if (!customerInfo) {
    throw new Error(`Customer info not found for order ID: ${originalOrderId}. Please sync orders from Shipway first.`);
  }

  // Validate and sanitize phone number (required by Shipway API)
  // Use shipping_phone if available, otherwise fallback to billing_phone
  let shippingPhone = customerInfo.shipping_phone || customerInfo.billing_phone || '';

  // Remove any non-digit characters except + (for international numbers)
  shippingPhone = shippingPhone.toString().trim();

  // Validate phone number is not empty
  if (!shippingPhone || shippingPhone === '' || shippingPhone === 'null' || shippingPhone === 'undefined') {
    throw new Error(`Invalid or missing shipping phone number for order ${originalOrderId}. Phone number is required for label generation.`);
  }

  // Log phone number for debugging (mask sensitive digits)
  const maskedPhone = shippingPhone.length > 4
    ? shippingPhone.substring(0, 2) + '****' + shippingPhone.substring(shippingPhone.length - 2)
    : '****';

  // Convert customer_info to originalOrder format expected by prepareShipwayRequestBody
  // Get order_date from products (orders table) since customer_info may not have it
  const orderDate = allOrderProducts[0]?.order_date || customerInfo.order_date || null;

  const originalOrder = {
    order_id: originalOrderId,
    store_code: customerInfo.store_code || '1', // Use dynamic store_code from database
    email: customerInfo.email,
    order_date: orderDate, // Get from products table or customer_info
    b_address: customerInfo.billing_address,
    b_address_2: customerInfo.billing_address2,
    b_city: customerInfo.billing_city,
    b_state: customerInfo.billing_state,
    b_country: customerInfo.billing_country,
    b_firstname: customerInfo.billing_firstname,
    b_lastname: customerInfo.billing_lastname,
    b_phone: customerInfo.billing_phone || shippingPhone, // Fallback to shipping phone if billing phone missing
    b_zipcode: customerInfo.billing_zipcode,
    b_latitude: customerInfo.billing_latitude,
    b_longitude: customerInfo.billing_longitude,
    s_address: customerInfo.shipping_address,
    s_address_2: customerInfo.shipping_address2,
    s_city: customerInfo.shipping_city,
    s_state: customerInfo.shipping_state,
    s_country: customerInfo.shipping_country,
    s_firstname: customerInfo.shipping_firstname,
    s_lastname: customerInfo.shipping_lastname,
    s_phone: shippingPhone, // Use validated phone number
    s_zipcode: customerInfo.shipping_zipcode,
    s_latitude: customerInfo.shipping_latitude,
    s_longitude: customerInfo.shipping_longitude
  };

  const inputData = {
    originalOrderId,
    claimedProducts: [...claimedProducts], // Deep copy to prevent mutations
    allOrderProducts: [...allOrderProducts], // Deep copy
    vendor: { ...vendor }, // Copy vendor data
    remainingProducts: allOrderProducts.filter(order =>
      !(order.claimed_by === vendor.warehouseId && order.status === 'claimed')
    ),
    originalOrder: { ...originalOrder }, // Copy original order data
    cloneOrderId,
    accountCode, // CRITICAL: Store account_code for store-specific operations
    timestamp: new Date().toISOString() // Fixed timestamp for consistency
  };

  logger.info('✅ Input data captured and frozen');
  return inputData;
}

// Generate unique clone order ID (partner-aware: skips Shipway API check for Shiprocket orders)
async function generateUniqueCloneId(originalOrderId, forceCloneSuffix = null, accountCode = null, shippingPartner = 'shipway') {
  const database = require('../config/database');

  // If forceCloneSuffix is provided, use it directly (for retry scenarios)
  if (forceCloneSuffix) {
    const forcedCloneOrderId = `${originalOrderId}_${forceCloneSuffix}`;
    return forcedCloneOrderId;
  }

  // 3.4 — Minimal targeted query: only need order_id column for clone conflict checking
  let allOrders;
  try {
    const [rows] = await database.mysqlConnection.execute(
      'SELECT order_id FROM orders'
    );
    allOrders = rows;
  } catch (dbError) {
    logger.info('⚠️ Direct query failed, skipping MySQL clone-ID check');
    allOrders = [];
  }

  let cloneOrderId = `${originalOrderId}_1`;
  let counter = 1;

  // Check if this clone already exists in MySQL (check ALL orders)
  while (allOrders.some(order => order.order_id === cloneOrderId)) {
    counter++;
    cloneOrderId = `${originalOrderId}_${counter}`;
  }

  // Additional check: Verify with Shipway API to ensure no conflicts (ONLY for Shipway orders)
  // For Shiprocket: skip external check — conflict is detected at createOrder time
  if (accountCode && shippingPartner === 'shipway') {
    try {
      const ShipwayService = require('../services/shipwayService');
      const shipwayService = new ShipwayService(accountCode);
      await shipwayService.initialize();
      const shipwayOrders = await shipwayService.fetchOrdersFromShipway();

      while (shipwayOrders.some(order => order.order_id === cloneOrderId)) {
        counter++;
        cloneOrderId = `${originalOrderId}_${counter}`;
      }
    } catch (shipwayError) {
    }
  } else if (shippingPartner === 'shiprocket') {
  } else {
  }

  if (counter > 10) {
  }
  return cloneOrderId;
}

// Step 1: Create clone order (NO label generation)
async function createCloneOrderOnly(inputData) {
  const { cloneOrderId, claimedProducts, originalOrder, vendor, accountCode } = inputData;

  logger.info(`🔒 Creating clone with consistent data:`);

  // CRITICAL: Use account_code from inputData (already validated in prepareInputData)
  if (!accountCode) {
    throw new Error(`account_code not found in inputData for clone order ${cloneOrderId}. Cannot create clone without store information.`);
  }

  const requestBody = await prepareShipwayRequestBody(
    cloneOrderId,
    claimedProducts,
    originalOrder,
    vendor,
    false, // NO label generation
    accountCode
  );

  const response = await callShipwayPushOrderAPI(requestBody, false, accountCode);

  if (!response.success) {
    throw new Error(`Failed to create clone order: ${response.message || 'Unknown error'}`);
  }

  logger.info('✅ Clone order created successfully in Shipway');
  return response;
}

// Step 2: Verify clone exists
async function verifyCloneExists(inputData) {
  const { cloneOrderId, accountCode } = inputData;

  logger.info(`🔒 Verifying clone exists with consistent data:`);

  // CRITICAL: Use account_code to fetch order from the correct store
  if (!accountCode) {
    throw new Error(`account_code not found in inputData. Cannot verify clone without store information.`);
  }

  // Call Shipway API to verify clone order exists (using store-specific credentials)
  const ShipwayService = require('../services/shipwayService');
  const shipwayService = new ShipwayService(accountCode);
  await shipwayService.initialize();
  const shipwayOrders = await shipwayService.fetchOrdersFromShipway();

  const cloneExists = shipwayOrders.some(order => order.order_id === cloneOrderId);

  if (!cloneExists) {
    throw new Error(`Clone order ${cloneOrderId} not found in Shipway for store ${accountCode}`);
  }

  logger.info(`✅ Clone order verified in Shipway (store: ${accountCode})`);
  return { success: true, verified: true };
}

// Step 3: Update original order
async function updateOriginalOrder(inputData) {
  const { originalOrderId, remainingProducts, originalOrder, vendor, accountCode } = inputData;

  logger.info(`🔒 Updating original with consistent data:`);

  if (remainingProducts.length > 0) {
    // CRITICAL: Use account_code from inputData (already validated in prepareInputData)
    // All products in the same order should have the same account_code
    if (!accountCode) {
      throw new Error(`account_code not found in inputData for original order ${originalOrderId}. Cannot update order without store information.`);
    }

    const requestBody = await prepareShipwayRequestBody(
      originalOrderId,
      remainingProducts,
      originalOrder,
      vendor,
      false, // NO label generation
      accountCode
    );

    const response = await callShipwayPushOrderAPI(requestBody, false, accountCode);

    if (!response.success) {
      throw new Error(`Failed to update original order: ${response.message || 'Unknown error'}`);
    }

    logger.info('✅ Original order updated successfully in Shipway');
    return response;
  } else {
    logger.info('ℹ️ No remaining products - original order will be empty');
    return { success: true, message: 'No remaining products to update' };
  }
}

// Step 4: Verify original order update
async function verifyOriginalOrderUpdate(inputData) {
  const { originalOrderId, remainingProducts, accountCode } = inputData;

  logger.info(`🔒 Verifying original order update with consistent data:`);

  // CRITICAL: Use account_code to fetch order from the correct store
  if (!accountCode) {
    throw new Error(`account_code not found in inputData. Cannot verify original order update without store information.`);
  }

  // Call Shipway API to verify original order was updated correctly (using store-specific credentials)
  const ShipwayService = require('../services/shipwayService');
  const shipwayService = new ShipwayService(accountCode);
  await shipwayService.initialize();
  const shipwayOrders = await shipwayService.fetchOrdersFromShipway();

  const originalOrder = shipwayOrders.find(order => order.order_id === originalOrderId);

  if (!originalOrder && remainingProducts.length > 0) {
    throw new Error(`Original order ${originalOrderId} not found in Shipway for store ${accountCode} after update`);
  }

  logger.info(`✅ Original order update verified in Shipway (store: ${accountCode})`);
  return { success: true, verified: true };
}

// Step 5: Update local database after clone creation
async function updateLocalDatabaseAfterClone(inputData) {
  const { claimedProducts, cloneOrderId, originalOrderId } = inputData;
  const database = require('../config/database');

  logger.info(`🔒 Updating local database with consistent data:`);

  // Copy customer info from original order to clone order
  logger.info(`📋 Copying customer info from ${originalOrderId} to ${cloneOrderId}...`);
  try {
    await database.copyCustomerInfo(originalOrderId, cloneOrderId);
    logger.info(`✅ Customer info copied successfully`);
  } catch (error) {
    logger.error(`⚠️ Failed to copy customer info: ${error.message}`);
    throw error;
  }

  // Build update data — include Shiprocket order_id and shipment_id if available (from create/adhoc response)
  // Note: order_id in create response = Shiprocket's order ID (maps to 'id' in get order API)
  // This should be stored in orders.partner_order_id in our database
  // shipment_id from create response should be stored in orders.shipment_id
  const cloneShipmentId = inputData.cloneShipmentId || null;
  const cloneShipmentIdForShipment = inputData.cloneShipmentIdForShipment || null;
  if (cloneShipmentId) {
  }
  if (cloneShipmentIdForShipment) {
  } else {
  }

  for (const product of claimedProducts) {
    const updateData = {
      order_id: cloneOrderId,           // ✅ Update orders & claims tables with clone ID
      clone_status: 'cloned',           // ✅ Mark as cloned
      cloned_order_id: originalOrderId, // ✅ Store original order ID (not clone ID)
      label_downloaded: 0               // ✅ Initially 0 (not downloaded)
    };

    // Add Shiprocket order_id to orders.partner_order_id (order_id from create response = Shiprocket's order ID)
    // Add Shiprocket shipment_id to orders.shipment_id if available from create response
    if (cloneShipmentId) {
      updateData.partner_order_id = cloneShipmentId;
    }
    if (cloneShipmentIdForShipment) {
      updateData.shipment_id = cloneShipmentIdForShipment;
    }

    // Update both orders and claims tables in a single call
    await database.updateOrder(product.unique_id, updateData);

    logger.info(`  ✅ Updated product ${product.unique_id} after clone creation:`);
    if (cloneShipmentId) {
    }
    if (cloneShipmentIdForShipment) {
    } else {
    }
  }

  logger.info('✅ Local database updated after clone creation');
  return { success: true, updatedProducts: claimedProducts.length };
}

// Step 6: Generate label for clone
async function generateLabelForClone(inputData) {
  const { cloneOrderId, claimedProducts, vendor, accountCode } = inputData;

  logger.info(`🔒 Generating label with consistent data:`);

  // Generate label for the clone order
  const labelResponse = await generateLabelForOrder(cloneOrderId, claimedProducts, vendor);

  if (!labelResponse.success) {
    throw new Error(`Failed to generate label for clone: ${labelResponse.message || 'Unknown error'}`);
  }

  logger.info('✅ Label generated successfully for clone order');
  return labelResponse;
}

// Step 7: Mark label as downloaded and store in labels table
async function markLabelAsDownloaded(inputData, labelResponse) {
  const { claimedProducts, cloneOrderId, accountCode } = inputData;
  const database = require('../config/database');

  logger.info(`🔒 Marking label as downloaded and storing in labels table:`);

  // ⚠️ IMPORTANT: Only mark as downloaded and store if we have a valid shipping URL
  if (labelResponse.data.shipping_url) {
    // Update orders table: mark label as downloaded
    for (const product of claimedProducts) {
      await database.updateOrder(product.unique_id, {
        label_downloaded: 1  // ✅ Mark as downloaded only after successful label generation
      });

      logger.info(`  ✅ Marked product ${product.unique_id} label as downloaded`);
    }

    // Store label URL and carrier info in labels table (one entry per order_id, no duplicates)
    // CRITICAL: Use account_code from inputData (already validated in prepareInputData)
    if (!accountCode) {
      throw new Error(`account_code not found in inputData for clone order ${cloneOrderId}. Cannot store label without store information.`);
    }

    const labelDataToStore = {
      order_id: cloneOrderId,
      account_code: accountCode,
      label_url: labelResponse.data.shipping_url,
      awb: labelResponse.data.awb,
      carrier_id: labelResponse.data.carrier_id,
      carrier_name: labelResponse.data.carrier_name
    };

    logger.info(`📦 Storing label data for clone order:`, labelDataToStore);

    await database.upsertLabel(labelDataToStore);

    logger.info(`  ✅ Stored label and carrier info in labels table for order ${cloneOrderId}`);
    logger.info('✅ All product labels marked as downloaded and cached');
  } else {
    logger.info(`  ⚠️ No shipping URL found in label response - NOT marking as downloaded`);
    logger.info(`  ⚠️ Products will remain available for retry on next download attempt`);
  }

  return { success: true, markedProducts: labelResponse.data.shipping_url ? claimedProducts.length : 0 };
}

/**
 * Prepare request body for Shipway API
 * @param {string} orderId - Order ID
 * @param {Array} products - Products array
 * @param {Object} originalOrder - Original order data
 * @param {Object} vendor - Vendor object with warehouseId (claimio_wh_id)
 * @param {boolean} generateLabel - Whether to generate label
 * @param {string} accountCode - Account code (store identifier) - required for label generation
 * @param {Object} dataMaps - Optional pre-fetched data maps (customerInfoMap, storesMap, carrierMap, whMappingsMap)
 */
async function prepareShipwayRequestBody(orderId, products, originalOrder, vendor, generateLabel = false, accountCode = null, dataMaps = null) {
  // Get payment type from the first product (all products in an order should have same payment_type)
  const paymentType = products[0]?.payment_type || 'P';
  logger.info('🔍 Payment type from order data:', paymentType);

  const orderTotal = products.reduce((sum, product) => {
    if (paymentType === 'C') {
      return sum + (parseFloat(product.collectable_amount) || 0);
    } else {
      return sum + (parseFloat(product.order_total_split) || 0);
    }
  }, 0);

  // Calculate order weight
  const totalQuantity = products.reduce((sum, product) => sum + (product.quantity || 1), 0);
  const orderWeight = 200 * totalQuantity;

  // Prepare products array
  const shipwayProducts = products.map(product => ({
    product: product.product_name,
    price: product.selling_price,
    product_code: product.product_code,
    product_quantity: String(product.quantity || 1),
    discount: "0",
    tax_rate: "5",
    tax_title: "IGST"
  }));

  // Prepare order tags
  const orderTags = paymentType === 'C' ? ["PPCOD"] : ["P"];

  // Base request body (common for both APIs)
  const baseRequestBody = {
    order_id: orderId,
    ewaybill: "",
    store_code: originalOrder.store_code || "1", // Use dynamic store_code from order data
    products: shipwayProducts,
    discount: "0",
    shipping: "0",
    order_total: orderTotal.toString(),
    gift_card_amt: "0",
    taxes: "0",
    payment_type: paymentType,
    email: originalOrder.email,
    billing_address: originalOrder.b_address,
    billing_address2: originalOrder.b_address_2 || "",
    billing_city: originalOrder.b_city,
    billing_state: originalOrder.b_state,
    billing_country: originalOrder.b_country,
    billing_firstname: originalOrder.b_firstname,
    billing_lastname: originalOrder.b_lastname,
    billing_phone: originalOrder.b_phone,
    billing_zipcode: originalOrder.b_zipcode,
    billing_latitude: "10",
    billing_longitude: "20",
    shipping_address: originalOrder.s_address,
    shipping_address2: originalOrder.s_address_2 || "",
    shipping_city: originalOrder.s_city,
    shipping_state: originalOrder.s_state,
    shipping_country: originalOrder.s_country,
    shipping_firstname: originalOrder.s_firstname,
    shipping_lastname: originalOrder.s_lastname,
    shipping_phone: originalOrder.s_phone || originalOrder.b_phone || '',
    shipping_zipcode: originalOrder.s_zipcode,
    shipping_latitude: "10",
    shipping_longitude: "20",
    order_weight: orderWeight.toString(),
    box_length: "20",
    box_breadth: "22",
    box_height: "3",
    order_date: originalOrder.order_date,
    order_tags: orderTags
  };

  // Add label generation specific parameters only for new orders
  if (generateLabel) {
    logger.info('🔄 Adding label generation parameters (carrier_id, warehouse_id, return_warehouse_id)');
    baseRequestBody.carrier_id = parseInt(products[0].priority_carrier) || 80165;

    // Get vendor_wh_id and return_warehouse_id from wh_mapping using claimio_wh_id and account_code
    if (!accountCode) {
      throw new Error('account_code is required for label generation. Cannot determine vendor warehouse ID.');
    }

    // Get warehouse mapping (use pre-fetched data if available)
    const database = require('../config/database');
    const whMapping = dataMaps?.whMappingsMap?.get(`${vendor.warehouseId}_${accountCode}`) ||
      await database.getWhMappingByClaimioWhIdAndAccountCode(vendor.warehouseId, accountCode);

    if (!whMapping || !whMapping.vendor_wh_id) {
      throw new Error(`Warehouse mapping not found for vendor (claimio_wh_id: ${vendor.warehouseId}) and store (account_code: ${accountCode}). Please contact admin to set up warehouse mapping.`);
    }

    // Use return_warehouse_id from mapping if available, otherwise fallback to vendor_wh_id (pickup warehouse)
    // Some carriers don't accept different return warehouse, so we use the same pickup warehouse
    const returnWarehouseId = whMapping.return_warehouse_id || whMapping.vendor_wh_id;

    if (!returnWarehouseId) {
      throw new Error(`Return warehouse ID not configured for vendor (claimio_wh_id: ${vendor.warehouseId}) and store (account_code: ${accountCode}). Please contact admin to set up return warehouse ID in warehouse mapping.`);
    }

    if (whMapping.return_warehouse_id) {
    } else {
    }
    baseRequestBody.warehouse_id = whMapping.vendor_wh_id;
    baseRequestBody.return_warehouse_id = returnWarehouseId;
    baseRequestBody.generate_label = true;
  } else {
    logger.info('🔄 Using PUSH Order API (no carrier/warehouse parameters)');
  }

  return baseRequestBody;
}

/**
 * Call Shipway Create Manifest API
 * @param {string|Array} orderIds - Order ID(s) to create manifest for
 * @param {string} accountCode - Account code for the store (REQUIRED)
 */
async function callShipwayCreateManifestAPI(orderIds, accountCode) {
  try {
    if (!accountCode) {
      throw new Error('account_code is required for creating manifest. Cannot proceed without store information.');
    }

    logger.info('🔄 Calling Shipway Create Manifest API');

    // Get store-specific credentials using account_code
    const database = require('../config/database');
    const encryptionService = require('../services/encryptionService');

    logger.info(`🔍 Fetching store credentials for account_code: ${accountCode}`);
    const store = await database.getStoreByAccountCode(accountCode);

    if (!store) {
      throw new Error(`Store not found for account_code: ${accountCode}`);
    }

    if (!store.username || !store.password_encrypted) {
      throw new Error(`Store credentials not configured for account_code: ${accountCode}`);
    }

    // Decrypt password
    const password = encryptionService.decrypt(store.password_encrypted);
    const username = store.username;

    // Generate Basic Auth header from store credentials
    const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
    logger.info(`✅ Using store-specific credentials for ${accountCode} (${store.store_name})`);

    const requestBody = {
      order_ids: Array.isArray(orderIds) ? orderIds : [orderIds]
    };

    logger.info('📤 Request body:', JSON.stringify(requestBody, null, 2));
    logger.info('⏱️ Timeout: 30 seconds');

    // OPTIMIZATION #4: Add 30-second timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    let response;
    try {
      response = await fetch('https://app.shipway.com/api/Createmanifest/', {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal  // Will abort after 30 seconds
      });

      clearTimeout(timeoutId); // Clear timeout if request completes successfully
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        logger.error('❌ Shipway Create Manifest API request timed out after 30 seconds');
        throw new Error('Shipway Create Manifest API request timed out. The request took longer than 30 seconds. Please try again.');
      }
      throw fetchError; // Re-throw other errors
    }

    const data = await response.json();

    logger.info('📥 Response status:', response.status);
    logger.info('📥 Response data:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      throw new Error(`Shipway Create Manifest API error: ${data.message || response.statusText}`);
    }

    // Extract manifest_id from response (Shipway returns it as "manifest_ids")
    // Response can be single ID "4656335" or multiple IDs "4656335,4656336"
    const manifestIds = data.manifest_ids || null;
    // For single payment type, it returns single ID, so we just use it
    const manifestId = manifestIds;

    logger.info('✅ Shipway Create Manifest API call successful');

    return {
      success: true,
      manifest_id: manifestId,
      data: data
    };

  } catch (error) {
    logger.error('❌ Shipway Create Manifest API call failed:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Call Shipway PUSH Order API
 */
async function callShipwayPushOrderAPI(requestBody, generateLabel = false, accountCode = null) {
  try {
    logger.info('🔄 Calling Shipway PUSH Order API');

    // Get store-specific credentials if account_code is provided
    let authHeader;
    const database = require('../config/database');
    const encryptionService = require('../services/encryptionService');

    if (accountCode) {
      logger.info(`🔍 Fetching store credentials for account_code: ${accountCode}`);
      const store = await database.getStoreByAccountCode(accountCode);

      if (!store) {
        throw new Error(`Store not found for account_code: ${accountCode}`);
      }

      if (!store.username || !store.password_encrypted) {
        throw new Error(`Store credentials not configured for account_code: ${accountCode}`);
      }

      // Decrypt password
      const password = encryptionService.decrypt(store.password_encrypted);
      const username = store.username;

      // Generate Basic Auth header from store credentials
      authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
      logger.info(`✅ Using store-specific credentials for ${accountCode} (${store.store_name})`);
    } else {
      // Fallback to environment variables (for backward compatibility)
      const username = process.env.SHIPWAY_USERNAME;
      const password = process.env.SHIPWAY_PASSWORD;
      const basicAuthHeader = process.env.SHIPWAY_BASIC_AUTH_HEADER;

      logger.info('🔍 Debug: Environment variables check');

      if (basicAuthHeader) {
        authHeader = basicAuthHeader;
        logger.info('✅ Using SHIPWAY_BASIC_AUTH_HEADER (fallback)');
      } else if (username && password) {
        authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
        logger.info('✅ Using SHIPWAY_USERNAME and SHIPWAY_PASSWORD (fallback)');
      } else {
        logger.info('❌ No Shipway credentials found');
        throw new Error('Shipway credentials not configured');
      }
    }

    // For original order editing (no label generation), remove generate_label parameter
    let apiRequestBody = { ...requestBody };
    if (!generateLabel) {
      logger.info('🔄 Removing generate_label parameter for order edit');
      delete apiRequestBody.generate_label;
    }

    // Print the request being sent to Shipway
    logger.info('📤 ========== SHIPWAY API REQUEST ==========');
    logger.info('🌐 Endpoint: https://app.shipway.com/api/v2orders');
    logger.info('📝 Method: POST');
    logger.info('📝 Request Body:', JSON.stringify(apiRequestBody, null, 2));
    logger.info('⏱️ Timeout: 30 seconds');
    logger.info('📤 ==========================================');

    // OPTIMIZATION #4: Add 30-second timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    let response;
    try {
      response = await fetch('https://app.shipway.com/api/v2orders', {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(apiRequestBody),
        signal: controller.signal  // Will abort after 30 seconds
      });

      clearTimeout(timeoutId); // Clear timeout if request completes successfully
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        logger.error('❌ Shipway API request timed out after 30 seconds');
        throw new Error('Shipway API request timed out. The request took longer than 30 seconds. Please try again.');
      }
      throw fetchError; // Re-throw other errors
    }

    const data = await response.json();

    // Print the complete Shipway API response
    logger.info('📦 ========== SHIPWAY API RESPONSE ==========');
    logger.info('📊 Response Status:', response.status, response.statusText);
    logger.info('📊 Response OK:', response.ok);
    logger.info('📊 Full Response Data:', JSON.stringify(data, null, 2));
    logger.info('📦 ==========================================');

    // Check if Shipway returned an error
    // Handle both 'success' and 'status' fields (Shipway uses different response formats)
    if (!response.ok || data.success === false || data.status === false) {
      logger.info('❌ Shipway API returned an error');

      const errorMessage = data.message || response.statusText || 'Unknown Shipway API error';

      // Check if this is "AWB assignment in progress" - this is a retriable error
      if (errorMessage.toLowerCase().includes('awb assignment is in progress') ||
        errorMessage.toLowerCase().includes('have patience')) {
        logger.info('⏳ AWB assignment is in progress - this is a retriable error');
        throw new Error(errorMessage); // Will be caught and retried by carrier loop
      }

      throw new Error(errorMessage);
    }

    // If label generation was requested, check if AWB response is successful
    if (generateLabel && data.awb_response) {
      if (data.awb_response.success === false) {
        logger.info('❌ Label generation failed (AWB response unsuccessful)');

        // Extract error message from awb_response
        let errorMessage = 'Label generation failed';
        if (data.awb_response.error) {
          if (Array.isArray(data.awb_response.error)) {
            errorMessage = data.awb_response.error.join(', ');
          } else if (typeof data.awb_response.error === 'string') {
            errorMessage = data.awb_response.error;
          }
        } else if (data.awb_response.message) {
          errorMessage = data.awb_response.message;
        }

        throw new Error(errorMessage);
      }
    }

    logger.info('✅ Shipway API call successful');
    return data;

  } catch (error) {
    logger.error('❌ Shipway API call failed:', error);
    throw error;
  }
}

/**
 * Sync orders from Shipway
 */
async function syncOrdersFromShipway() {
  try {
    logger.info('🔄 Syncing orders from Shipway');

    // Import the shipway service (it's already an instance)
    const shipwayService = require('../services/shipwayService');

    // Call the sync method
    await shipwayService.syncOrdersToMySQL();

    logger.info('✅ Orders synced successfully');

  } catch (error) {
    logger.error('❌ Order sync failed:', error);
    throw error;
  }
}

/**
 * @route   POST /api/orders/bulk-download-labels
 * @desc    Download labels for multiple orders and merge into single PDF
 * @access  Vendor (token required)
 */
router.post('/bulk-download-labels', async (req, res) => {
  const requestStartTime = Date.now();
  const { order_ids, format = 'thermal', generate_only = false, async: runAsync = false } = req.body;
  const token = req.headers['authorization'];

  // Generate unique batch ID for this parallel processing operation
  const batchId = `BATCH_${Date.now()}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

  logger.info(`🔵 [${batchId}] BULK DOWNLOAD LABELS REQUEST: order_ids=${order_ids?.length}, format: ${format}, generate_only: ${generate_only}, runAsync: ${runAsync}`);

  // 5.1 + 5.2 — Batch size limit + type validation
  const arrayCheck = validateBulkArray(order_ids, 'order_ids');
  if (!arrayCheck.ok || !token) {
    return res.status(400).json({
      success: false,
      message: arrayCheck.ok ? 'order_ids array and Authorization token required' : arrayCheck.message
    });
  }
  const sanitizedOrderIds = arrayCheck.items;

  // ── ASYNC MODE ─────────────────────────────────────────────────────────────
  if (runAsync) {
    const task = taskStore.createTask('bulk-download-labels', (token || '').substring(0, 20));
    const PORT = process.env.PORT || 5000;
    const savedBody = JSON.stringify({ order_ids, format, generate_only: true, async: false });
    const savedToken = token;
    (async () => {
      try {
        const internalRes = await fetch(`http://localhost:${PORT}/api/orders/bulk-download-labels`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': savedToken },
          body: savedBody
        });
        const contentType = internalRes.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const result = await internalRes.json();
          if (result.success) {
            taskStore.completeTask(task.id, result);
          } else {
            taskStore.failTask(task.id, result.message || 'Bulk download labels failed');
          }
        } else {
          const buffer = await internalRes.buffer();
          taskStore.completeTask(task.id, {
            success: true,
            pdfBase64: buffer.toString('base64'),
            contentType: contentType || 'application/pdf'
          });
        }
      } catch (err) {
        taskStore.failTask(task.id, err.message);
      }
    })();
    return res.json({ success: true, taskId: task.id, async: true });
  }
  // ─────────────────────────────────────────────────────────────────────────

  try {
    // Load users from MySQL to get vendor info
    const database = require('../config/database');

    // Wait for MySQL initialization
    await database.waitForMySQLInitialization();

    if (!database.isMySQLAvailable()) {
      logger.info(`❌ [${batchId}] MySQL connection not available`);
      return res.status(500).json({ success: false, message: 'Database connection not available' });
    }

    const vendor = req.user || await database.getUserByToken(token);

    if (!vendor || vendor.active_session !== 'TRUE') {
      logger.info(`❌ [${batchId}] VENDOR NOT FOUND OR INACTIVE`, vendor);
      return res.status(401).json({ success: false, message: 'Invalid or inactive vendor token' });
    }

    logger.info(`✅ [${batchId}] VENDOR FOUND:`);

    // OPTIMIZATION #1: Fetch only the orders we need instead of all orders
    // This reduces query time from 1-5 seconds to 0.2-1 second for 100 orders
    logger.info(`📦 [${batchId}] Fetching products for ${order_ids.length} orders...`);
    const orders = await database.getOrdersByOrderIds(order_ids);
    logger.info(`✅ [${batchId}] Fetched ${orders.length} products from ${order_ids.length} orders`);

    // OPTIMIZATION: Bulk fetch all labels upfront to avoid 100 sequential queries
    // This reduces cache check time from 10-50 seconds to 0.1-0.5 seconds
    logger.info(`📦 [${batchId}] Fetching cached labels for ${order_ids.length} orders...`);
    const allLabels = await database.getLabelsByOrderIds(order_ids);
    const labelsMap = new Map(allLabels.map(l => [l.order_id, l]));
    logger.info(`✅ [${batchId}] Found ${allLabels.length} cached labels (out of ${order_ids.length} orders)`);

    // OPTIMIZATION: Pre-fetch all data needed for label generation
    // This reduces queries from 400 (100 orders × 4 queries) to ~3-4 bulk queries
    logger.info(`📦 [${batchId}] Pre-fetching data for label generation...`);

    // 1. Bulk fetch all customer info
    const allCustomerInfo = await database.getCustomerInfoByOrderIds(order_ids);
    const customerInfoMap = new Map(allCustomerInfo.map(c => [c.order_id, c]));
    logger.info(`✅ [${batchId}] Fetched ${allCustomerInfo.length} customer info records`);

    // 2. Extract unique account codes from orders and customer info
    const accountCodesSet = new Set();
    orders.forEach(o => {
      if (o.account_code) accountCodesSet.add(o.account_code);
    });
    allCustomerInfo.forEach(c => {
      if (c.account_code) accountCodesSet.add(c.account_code);
    });
    const uniqueAccountCodes = Array.from(accountCodesSet);
    logger.info(`✅ [${batchId}] Found ${uniqueAccountCodes.length} unique account codes`);

    // 3. Bulk fetch all stores
    const allStores = await database.getStoresByAccountCodes(uniqueAccountCodes);
    const storesMap = new Map(allStores.map(s => [s.account_code, s]));
    logger.info(`✅ [${batchId}] Fetched ${allStores.length} stores`);

    // 4. Read carriers once (cache in memory)
    const carrierServiceabilityService = require('../services/carrierServiceabilityService');
    const allCarriers = await carrierServiceabilityService.readCarriersFromDatabase();
    const carrierMap = new Map(allCarriers.map(c => [c.carrier_id, c]));
    logger.info(`✅ [${batchId}] Loaded ${allCarriers.length} carriers (cached in memory)`);

    // 5. Bulk fetch all warehouse mappings
    const allWhMappings = await database.getWhMappingsByClaimioWhIdAndAccountCodes(
      vendor.warehouseId,
      uniqueAccountCodes
    );
    // Build map: key = "claimioWhId_accountCode", value = mapping object
    const whMappingsMap = new Map(
      allWhMappings.map(m => [`${vendor.warehouseId}_${m.account_code}`, m])
    );
    logger.info(`✅ [${batchId}] Fetched ${allWhMappings.length} warehouse mappings`);

    // Build data maps object for passing to generateLabelForOrder
    const dataMaps = {
      customerInfoMap,
      storesMap,
      carrierMap,
      whMappingsMap
    };

    let results = [];
    const errors = [];

    // ⚡ PARALLEL PROCESSING OPTIMIZATION
    // Process orders in parallel with controlled concurrency (10 at a time)
    // Increased from 6 to 10 for better performance (40% more throughput)
    const CONCURRENCY_LIMIT = 10;

    logger.info(`⚡ [${batchId}] Processing ${order_ids.length} orders with concurrency limit of ${CONCURRENCY_LIMIT}`);

    // Helper function to process a single order
    // For Shipway: generates label fully (returns shipping_url)
    // For Shiprocket: does clone + AWB assign (label generated in bulk later)
    const processSingleOrder = async (orderId) => {
      try {
        logger.info(`🔄 [${batchId}] Processing order: ${orderId}`);

        // Get all products for this order_id
        const orderProducts = orders.filter(order => order.order_id === orderId);
        const claimedProducts = orderProducts.filter(order =>
          order.claimed_by === vendor.warehouseId &&
          (order.is_handover !== 1 && order.is_handover !== '1')  // Allow download until handed over
        );

        if (claimedProducts.length === 0) {
          return {
            success: false,
            order_id: orderId,
            error: 'No products claimed by this vendor for this order'
          };
        }

        const accountCode = claimedProducts[0]?.account_code;
        const store = storesMap.get(accountCode);
        const isShiprocket = store?.shipping_partner?.toLowerCase() === 'shiprocket';

        // ✅ OPTIMIZATION: Check if label already downloaded
        const firstClaimedProduct = claimedProducts[0];
        if (firstClaimedProduct.label_downloaded === 1) {
          logger.info(`⚡ BULK: Label already downloaded for ${orderId}, fetching from cache...`);

          const existingLabel = labelsMap.get(orderId);
          if (existingLabel && existingLabel.label_url) {
            logger.info(`✅ BULK: Found cached label for ${orderId}`);
            return {
              success: true,
              order_id: orderId,
              shipping_url: existingLabel.label_url,
              awb: existingLabel.awb || 'N/A',
              shipping_partner: isShiprocket ? 'shiprocket' : 'shipway',
              already_cached: true
            };
          } else {
            logger.info(`⚠️ BULK: label_downloaded=1 but no cached label found for ${orderId}, generating new one...`);
          }
        }

        // ============================================================
        // SHIPROCKET FLOW: Clone + AWB Assign (label gen happens later in bulk)
        // ============================================================
        if (isShiprocket) {
          logger.info(`🚀 [${batchId}] Shiprocket order detected: ${orderId}`);

          const isPartialClaim = orderProducts.length !== claimedProducts.length && claimedProducts.length > 0;

          // ============================================================
          // PARTIAL CLAIM: Clone path (clone already handled everything)
          // ============================================================
          if (isPartialClaim) {
            logger.info(`🔄 [${batchId}] Clone required for Shiprocket order ${orderId}`);

            let cloneResponse;
            try {
              cloneResponse = await handleShiprocketOrderCloning(orderId, claimedProducts, orderProducts, vendor);
            } catch (firstError) {
              if (firstError.message && firstError.message.includes('already exists')) {
                logger.info(`⚠️ [${batchId}] Clone conflict, retrying with _99 suffix...`);
                try {
                  cloneResponse = await handleShiprocketOrderCloning(orderId, claimedProducts, orderProducts, vendor, '99');
                } catch (retryError) {
                  throw retryError;
                }
              } else {
                throw firstError;
              }
            }

            // Clone process already completed: created clone, assigned AWB, generated label, stored in DB
            // We just need to fetch the label info and return success with clone_order_id
            const cloneOrderId = cloneResponse.data?.clone_order_id;
            if (!cloneOrderId) {
              throw new Error(`Clone order_id not found in clone response for order ${orderId}`);
            }

            logger.info(`✅ [${batchId}] Clone completed successfully. Fetching label for clone order: ${cloneOrderId}`);

            // Fetch label from DB (clone process already stored it)
            const cloneLabel = await database.getLabelByOrderId(cloneOrderId, accountCode);
            
            if (!cloneLabel || !cloneLabel.label_url) {
              // Fallback: use data from clone response if DB lookup fails
              const fallbackUrl = cloneResponse.data?.shipping_url;
              const fallbackAwb = cloneResponse.data?.awb;
              
              if (!fallbackUrl) {
                throw new Error(`Label not found in DB for clone order ${cloneOrderId} and not in clone response`);
              }

              logger.info(`⚠️ [${batchId}] Label not in DB yet, using clone response data for ${cloneOrderId}`);
              
              return {
                success: true,
                order_id: cloneOrderId,
                shipping_url: fallbackUrl,
                awb: fallbackAwb || 'N/A',
                carrier_id: cloneResponse.data?.carrier_id || null,
                carrier_name: cloneResponse.data?.carrier_name || null,
                account_code: accountCode,
                unique_ids: claimedProducts.map(p => p.unique_id),
                shipping_partner: 'shiprocket',
                already_cached: true,
                original_order_id: orderId
              };
            }

            // Label found in DB - return success with clone order_id
            logger.info(`✅ [${batchId}] Found label in DB for clone order ${cloneOrderId}`);
            return {
              success: true,
              order_id: cloneOrderId,
              shipping_url: cloneLabel.label_url,
              awb: cloneLabel.awb || 'N/A',
              carrier_id: cloneLabel.carrier_id || null,
              carrier_name: cloneLabel.carrier_name || null,
              account_code: accountCode,
              unique_ids: claimedProducts.map(p => p.unique_id),
              shipping_partner: 'shiprocket',
              already_cached: true,
              original_order_id: orderId
            };
          }

          // ============================================================
          // FULL CLAIM: Non-clone path (all products claimed)
          // ============================================================
          let shipmentId = firstClaimedProduct.shipment_id;
          
          if (!shipmentId) {
            throw new Error(`shipment_id missing for Shiprocket order ${orderId}`);
          }

          // AWB Assign with carrier fallback (only for full claims, not partial)
          const priorityCarrierStr = firstClaimedProduct?.priority_carrier || '';
          let carrierIds = [];
          try {
            carrierIds = JSON.parse(priorityCarrierStr);
            if (!Array.isArray(carrierIds)) carrierIds = [carrierIds];
          } catch (e) {
            if (priorityCarrierStr) carrierIds = [priorityCarrierStr];
          }

          if (carrierIds.length === 0) {
            throw new Error(`No priority carriers assigned for order ${orderId}`);
          }

          const ShiprocketService = require('../services/shiprocketService');
          const shiprocketService = new ShiprocketService(accountCode);

          let awbResult = null;
          for (let i = 0; i < carrierIds.length; i++) {
            const result = await shiprocketService.assignAWB(shipmentId, carrierIds[i]);
            if (result.success) {
              awbResult = result;
              logger.info(`  ✅ [${batchId}] AWB assigned: ${result.awb_code} (carrier: ${result.courier_name})`);
              break;
            } else {
              logger.info(`  ❌ [${batchId}] Carrier ${carrierIds[i]} failed: ${result.message}`);
            }
          }

          if (!awbResult) {
            throw new Error(`AWB assignment failed with all ${carrierIds.length} carriers for order ${orderId}`);
          }

          // Return Shiprocket result (label will be generated in bulk later)
          return {
            success: true,
            order_id: orderId,
            shipment_id: String(shipmentId),
            awb: awbResult.awb_code,
            courier_company_id: awbResult.courier_company_id,
            courier_name: awbResult.courier_name,
            account_code: accountCode,
            unique_ids: claimedProducts.map(p => p.unique_id),
            shipping_partner: 'shiprocket',
            needs_label_generation: true
          };
        }

        // ============================================================
        // SHIPWAY FLOW: Existing logic (unchanged)
        // ============================================================
        let labelResponse;
        if (orderProducts.length === claimedProducts.length) {
          // Direct download - all products claimed by vendor
          labelResponse = await generateLabelForOrder(orderId, claimedProducts, vendor, format, dataMaps);

          // Store label and carrier info for direct download
          if (labelResponse.success && labelResponse.data.shipping_url) {
            if (!accountCode) {
              throw new Error(`account_code not found for order ${orderId}. Cannot store label without store information.`);
            }

            await database.upsertLabel({
              order_id: orderId,
              account_code: accountCode,
              label_url: labelResponse.data.shipping_url,
              awb: labelResponse.data.awb,
              carrier_id: labelResponse.data.carrier_id,
              carrier_name: labelResponse.data.carrier_name
            });

            // ✅ Mark label as downloaded in claims table for all claimed products
            for (const product of claimedProducts) {
              await database.updateOrder(product.unique_id, {
                label_downloaded: 1
              });
            }
          }
        } else if (claimedProducts.length > 0) {
          // Clone required - some products claimed by vendor
          try {
            labelResponse = await handleOrderCloning(orderId, claimedProducts, orderProducts, vendor);
          } catch (cloneError) {
            if (cloneError.message && cloneError.message.includes('not found in Shipway')) {
              logger.info(`⚠️ [${batchId}] CLONE CONFLICT DETECTED for ${orderId}`);
              logger.info(`🔄 [${batchId}] RETRYING: Using suffix _99...`);
              try {
                labelResponse = await handleOrderCloning(orderId, claimedProducts, orderProducts, vendor, '99');
                logger.info(`✅ [${batchId}] RETRY SUCCESSFUL with _99 suffix`);
              } catch (retryError) {
                logger.error(`❌ [${batchId}] RETRY FAILED for ${orderId}`);
                throw retryError;
              }
            } else {
              throw cloneError;
            }
          }
        } else {
          return {
            success: false,
            order_id: orderId,
            error: 'No products claimed by this vendor for this order'
          };
        }

        if (labelResponse.success) {
          const actualOrderId = labelResponse.data.clone_order_id || orderId;
          return {
            success: true,
            order_id: actualOrderId,
            shipping_url: labelResponse.data.shipping_url,
            awb: labelResponse.data.awb,
            original_order_id: orderId !== actualOrderId ? orderId : undefined,
            clone_order_id: labelResponse.data.clone_order_id,
            shipping_partner: 'shipway'
          };
        } else {
          return {
            success: false,
            order_id: orderId,
            error: labelResponse.message || 'Label generation failed'
          };
        }

      } catch (error) {
        logger.error(`❌ Error processing order ${orderId}:`, error);

        try {
          await createLabelGenerationNotification(error.message, orderId, vendor);
        } catch (notificationError) {
          logger.error(`⚠️ Failed to create notification for ${orderId}:`, notificationError.message);
        }

        return {
          success: false,
          order_id: orderId,
          error: error.message,
          userMessage: `Order ${orderId} not assigned, please contact admin`
        };
      }
    };

    // Process orders in controlled parallel batches
    // NOTE: Shiprocket orders are processed sequentially (AWB assign needs carrier fallback)
    // while Shipway orders can be parallelized
    const shiprocketPending = []; // Shiprocket orders needing bulk label generation
    const processedOrderIds = new Set(); // Track processed order_ids to prevent duplicates

    for (let i = 0; i < order_ids.length; i += CONCURRENCY_LIMIT) {
      const batch = order_ids.slice(i, i + CONCURRENCY_LIMIT);
      logger.info(`⚡ Processing batch ${Math.floor(i / CONCURRENCY_LIMIT) + 1}: ${batch.length} orders (${i + 1}-${i + batch.length} of ${order_ids.length})`);

      const batchResults = await Promise.allSettled(
        batch.map(orderId => processSingleOrder(orderId))
      );

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const orderResult = result.value;
          if (orderResult.success) {
            // Skip if this order_id was already processed (prevent duplicates)
            if (processedOrderIds.has(orderResult.order_id)) {
              logger.info(`⚠️ [${batchId}] Skipping duplicate order_id: ${orderResult.order_id}`);
              return;
            }
            processedOrderIds.add(orderResult.order_id);
            
            if (orderResult.needs_label_generation) {
              // Shiprocket: AWB assigned, needs bulk label generation
              shiprocketPending.push(orderResult);
            } else {
              // Shipway or cached: already has label URL
            results.push({
              order_id: orderResult.order_id,
              shipping_url: orderResult.shipping_url,
              awb: orderResult.awb
            });
            }
          } else {
            errors.push({
              order_id: orderResult.order_id,
              error: orderResult.error,
              userMessage: orderResult.userMessage
            });
          }
        } else {
          const orderId = batch[index];
          errors.push({
            order_id: orderId,
            error: result.reason?.message || 'Unknown error',
            userMessage: `Order ${orderId} not assigned, please contact admin`
          });
        }
      });

      logger.info(`✅ Batch ${Math.floor(i / CONCURRENCY_LIMIT) + 1} complete: ${results.length} shipway done, ${shiprocketPending.length} shiprocket pending, ${errors.length} failed`);
    }

    // ============================================================
    // SHIPROCKET POST-PROCESSING: Bulk label generation
    // ============================================================
    if (shiprocketPending.length > 0) {
      logger.info(`\n🏷️ [${batchId}] SHIPROCKET BULK LABEL GENERATION: ${shiprocketPending.length} orders`);

      // Group by account_code (different stores may need separate API calls)
      const groupedByAccount = {};
      shiprocketPending.forEach(item => {
        if (!groupedByAccount[item.account_code]) {
          groupedByAccount[item.account_code] = [];
        }
        groupedByAccount[item.account_code].push(item);
      });

      for (const [accountCode, shipments] of Object.entries(groupedByAccount)) {
        try {
          const ShiprocketService = require('../services/shiprocketService');
          const shiprocketService = new ShiprocketService(accountCode);

          // Deduplicate shipments by order_id to prevent duplicate labels
          const uniqueShipmentsMap = new Map();
          shipments.forEach(shipment => {
            if (!uniqueShipmentsMap.has(shipment.order_id)) {
              uniqueShipmentsMap.set(shipment.order_id, shipment);
            }
          });
          const uniqueShipments = Array.from(uniqueShipmentsMap.values());
          

          const shipmentIds = uniqueShipments.map(s => s.shipment_id);

          const labelResponse = await shiprocketService.generateLabel(shipmentIds, format);

          if (labelResponse.success) {
            const labelUrl = labelResponse.label_url;
            const notCreated = labelResponse.not_created || [];

            // Update DB and collect results for successful shipments (using unique shipments only)
            for (const shipment of uniqueShipments) {
              const shipmentIdInt = parseInt(shipment.shipment_id);
              if (notCreated.includes(shipmentIdInt)) {
                errors.push({
                  order_id: shipment.order_id,
                  error: 'Shiprocket label generation failed for this shipment',
                  userMessage: `Order ${shipment.order_id} label not created, please contact admin`
                });
                continue;
              }

              try {
                // Store label in labels table
                await database.upsertLabel({
                  order_id: shipment.order_id,
                  account_code: shipment.account_code,
                  label_url: labelUrl,
                  awb: shipment.awb,
                  carrier_id: shipment.courier_company_id,
                  carrier_name: shipment.courier_name
                });

                // Mark label_downloaded = 1
                if (shipment.unique_ids && Array.isArray(shipment.unique_ids)) {
                  for (const uniqueId of shipment.unique_ids) {
                    await database.updateOrder(uniqueId, { label_downloaded: 1 });
                  }
                }

                results.push({
                  order_id: shipment.order_id,
                  shipping_url: labelUrl,
                  awb: shipment.awb
                });

                logger.info(`  ✅ Label stored for ${shipment.order_id}`);
              } catch (dbError) {
                logger.error(`  ⚠️ DB update failed for ${shipment.order_id}:`, dbError.message);
                errors.push({
                  order_id: shipment.order_id,
                  error: `DB update failed: ${dbError.message}`,
                  userMessage: `Order ${shipment.order_id} not assigned, please contact admin`
                });
              }
            }
          } else {
            // All shipments in this account failed label generation
            for (const shipment of shipments) {
              errors.push({
                order_id: shipment.order_id,
                error: `Shiprocket label generation failed: ${labelResponse.message}`,
                userMessage: `Order ${shipment.order_id} not assigned, please contact admin`
              });
            }
          }
        } catch (labelError) {
          logger.error(`❌ Shiprocket label generation failed for account ${accountCode}:`, labelError.message);
          for (const shipment of shipments) {
            errors.push({
              order_id: shipment.order_id,
              error: `Shiprocket label generation failed: ${labelError.message}`,
              userMessage: `Order ${shipment.order_id} not assigned, please contact admin`
            });
          }
        }
      }

      logger.info(`✅ [${batchId}] Shiprocket post-processing complete: ${results.length} total successful, ${errors.length} total failed`);
    }

    const requestEndTime = Date.now();
    const totalDuration = ((requestEndTime - requestStartTime) / 1000).toFixed(2);
    const avgTimePerOrder = order_ids.length > 0 ? (totalDuration / order_ids.length).toFixed(2) : '0.00';

    logger.info('📊 BULK DOWNLOAD LABELS COMPLETE:');

    // Performance breakdown
    if (results.length > 0) {
      const avgTimePerSuccessful = (totalDuration / results.length).toFixed(2);
    }

    if (results.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No labels could be generated for any of the selected orders. Please contact admin.',
        data: {
          errors,
          warnings: errors.map(e => e.userMessage || e.error)
        }
      });
    }

    // This endpoint now only supports generate_only=true (two-step process)
    // Use /bulk-download-labels-merge endpoint to combine PDFs
    if (!generate_only) {
      return res.status(400).json({
        success: false,
        message: 'This endpoint now only supports generate_only=true. Use /bulk-download-labels-merge to combine PDFs.',
        data: {
          hint: 'Set generate_only=true to generate labels, then call /bulk-download-labels-merge to merge them into a PDF'
        }
      });
    }

    // Return JSON response with order_ids (labels already stored in DB)
    // Verify that all successful labels are actually saved in the database
    // This ensures the merge endpoint will find them (handles potential database commit delays)
    // Deduplicate order_ids first to avoid processing duplicates
    let uniqueSuccessfulOrderIds = [...new Set(results.map(r => r.order_id))];
    if (uniqueSuccessfulOrderIds.length > 0) {
      let verifiedLabels = [];
      const verificationRetries = 3;
      const verificationDelay = 300; // 300ms delay

      for (let attempt = 1; attempt <= verificationRetries; attempt++) {
        verifiedLabels = await database.getLabelsByOrderIds(uniqueSuccessfulOrderIds);

        if (verifiedLabels.length === uniqueSuccessfulOrderIds.length) {
          break;
        }

        if (attempt < verificationRetries) {
          await new Promise(resolve => setTimeout(resolve, verificationDelay));
        }
      }

      if (verifiedLabels.length < uniqueSuccessfulOrderIds.length) {
        const missingOrderIds = uniqueSuccessfulOrderIds.filter(id => !verifiedLabels.some(label => label.order_id === id));
        logger.warn(`⚠️ [${batchId}] Only ${verifiedLabels.length}/${uniqueSuccessfulOrderIds.length} labels verified. Missing:`, missingOrderIds);
        // Filter out unverified order_ids from successful list
        const verifiedOrderIds = verifiedLabels.map(label => label.order_id);
        // Deduplicate results and filter by verified order_ids
        const resultsMap = new Map();
        results.forEach(r => {
          if (!resultsMap.has(r.order_id) && verifiedOrderIds.includes(r.order_id)) {
            resultsMap.set(r.order_id, r);
          }
        });
        results = Array.from(resultsMap.values());
      } else {
        // Deduplicate results even if all are verified
        const resultsMap = new Map();
        results.forEach(r => {
          if (!resultsMap.has(r.order_id)) {
            resultsMap.set(r.order_id, r);
          }
        });
        results = Array.from(resultsMap.values());
      }
    } else {
      // Deduplicate results even if no verification needed
      const resultsMap = new Map();
      results.forEach(r => {
        if (!resultsMap.has(r.order_id)) {
          resultsMap.set(r.order_id, r);
        }
      });
      results = Array.from(resultsMap.values());
      // Recalculate unique order_ids after deduplicating results
      uniqueSuccessfulOrderIds = [...new Set(results.map(r => r.order_id))];
    }
    // Deduplicate failed order_ids
    const uniqueFailedOrderIds = [...new Set(errors.map(e => e.order_id))];
    
    return res.json({
      success: true,
      message: 'Labels generated successfully. Ready for merge.',
      data: {
        successful: uniqueSuccessfulOrderIds,
        failed: uniqueFailedOrderIds,
        total_successful: uniqueSuccessfulOrderIds.length,
        total_failed: uniqueFailedOrderIds.length,
        errors: errors.length > 0 ? errors : undefined
      }
    });

    // Note: PDF merging is now handled by the separate /bulk-download-labels-merge endpoint
    // This endpoint only generates labels and stores them in the database (generate_only=true)

  } catch (error) {
    logger.error('❌ BULK DOWNLOAD LABELS ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process bulk label download',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/orders/bulk-download-labels-merge
 * @desc    Merge labels for multiple orders into a single PDF
 * @access  Vendor (token required)
 */
router.post('/bulk-download-labels-merge', async (req, res) => {
  const { order_ids, format = 'thermal', async: runAsync = false } = req.body;
  const token = req.headers['authorization'];

  // 5.1 + 5.2 — Batch size limit + type validation
  const arrayCheck = validateBulkArray(order_ids, 'order_ids');
  if (!arrayCheck.ok || !token) {
    return res.status(400).json({
      success: false,
      message: arrayCheck.ok ? 'order_ids array and Authorization token required' : arrayCheck.message
    });
  }
  const sanitizedOrderIds = arrayCheck.items;

  // ── ASYNC MODE ─────────────────────────────────────────────────────────────
  if (runAsync) {
    const task = taskStore.createTask('bulk-download-merge', (token || '').substring(0, 20));
    const PORT = process.env.PORT || 5000;
    const savedBody = JSON.stringify({ order_ids, format, async: false });
    const savedToken = token;
    (async () => {
      try {
        const internalRes = await fetch(`http://localhost:${PORT}/api/orders/bulk-download-labels-merge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': savedToken },
          body: savedBody
        });
        const contentType = internalRes.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const result = await internalRes.json();
          if (result.success) {
            taskStore.completeTask(task.id, result);
          } else {
            taskStore.failTask(task.id, result.message || 'Bulk merge failed');
          }
        } else {
          const buffer = await internalRes.buffer();
          taskStore.completeTask(task.id, {
            success: true,
            pdfBase64: buffer.toString('base64'),
            contentType: contentType || 'application/pdf'
          });
        }
      } catch (err) {
        taskStore.failTask(task.id, err.message);
      }
    })();
    return res.json({ success: true, taskId: task.id, async: true });
  }
  // ─────────────────────────────────────────────────────────────────────────

  try {
    // Load database
    const database = require('../config/database');

    // Wait for MySQL initialization
    await database.waitForMySQLInitialization();

    if (!database.isMySQLAvailable()) {
      logger.info('❌ MySQL connection not available');
      return res.status(500).json({ success: false, message: 'Database connection not available' });
    }

    // Verify vendor token
    const vendor = req.user || await database.getUserByToken(token);

    if (!vendor || vendor.active_session !== 'TRUE') {
      logger.info('❌ VENDOR NOT FOUND OR INACTIVE');
      return res.status(401).json({ success: false, message: 'Invalid or inactive vendor token' });
    }

    logger.info('✅ VENDOR FOUND:');

    // Deduplicate order_ids before querying database (prevent duplicate labels)
    const uniqueOrderIds = [...new Set(order_ids)];
    if (uniqueOrderIds.length !== order_ids.length) {
      logger.info(`⚠️ Deduplicated order_ids: ${order_ids.length} → ${uniqueOrderIds.length} unique`);
    }

    // Fetch label URLs from database using unique order_ids
    // Add retry mechanism to handle potential database commit delays
    let labels = [];
    const maxRetries = 3;
    const retryDelay = 500; // 500ms delay between retries

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      labels = await database.getLabelsByOrderIds(uniqueOrderIds);

      // If we got all the labels we need, break out of retry loop
      if (labels.length === uniqueOrderIds.length) {
        break;
      }

      // If this is not the last attempt, wait before retrying
      if (attempt < maxRetries && labels.length < uniqueOrderIds.length) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    logger.info(`📦 Fetched ${labels.length}/${uniqueOrderIds.length} labels from database`);

    if (labels.length === 0) {
      logger.error(`❌ No labels found after ${maxRetries} attempts for order_ids:`, uniqueOrderIds);
      return res.status(400).json({
        success: false,
        message: 'No labels found for the specified order_ids. Please generate labels first and wait a moment before merging.'
      });
    }

    // Deduplicate labels by order_id (in case database returns duplicates)
    const uniqueLabelsMap = new Map();
    labels.forEach(label => {
      if (!uniqueLabelsMap.has(label.order_id)) {
        uniqueLabelsMap.set(label.order_id, label);
      }
    });
    const uniqueLabels = Array.from(uniqueLabelsMap.values());
    
    if (uniqueLabels.length !== labels.length) {
      logger.info(`⚠️ Deduplicated labels: ${labels.length} → ${uniqueLabels.length} unique`);
    }

    if (uniqueLabels.length < uniqueOrderIds.length) {
      const missingOrderIds = uniqueOrderIds.filter(id => !uniqueLabels.some(label => label.order_id === id));
      logger.warn(`⚠️ Only found ${uniqueLabels.length}/${uniqueOrderIds.length} labels. Missing order_ids:`, missingOrderIds);
      // Continue with available labels, but log the missing ones
    }

    // Convert to format expected by generateCombinedLabelsPDF (using deduplicated labels)
    const labelData = uniqueLabels.map(label => ({
      order_id: label.order_id,
      shipping_url: label.label_url,
      awb: label.awb || 'N/A'
    }));

    // Merge PDFs using the existing function
    const combinedPdfBuffer = await generateCombinedLabelsPDF(labelData, format);

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');

    // Generate filename with format: {vendor_id}_{vendor_city}_{current_date}
    const currentDate = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // yyyymmdd format
    const vendorId = vendor.warehouseId || 'unknown';
    const vendorCity = (vendor.city || 'unknown').toLowerCase();
    const filename = `${vendorId}_${vendorCity}_${currentDate}.pdf`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', combinedPdfBuffer.length);

    // Send the PDF buffer
    res.send(combinedPdfBuffer);

  } catch (error) {
    logger.error('❌ BULK DOWNLOAD LABELS MERGE ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to merge labels',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/orders/download-pdf
 * @desc    Proxy endpoint to download PDF from Shipway (avoids CORS issues)
 * @access  Vendor (token required)
 */
router.post('/download-pdf', async (req, res) => {
  const { pdfUrl } = req.body;
  const token = req.headers['authorization'];

  logger.info('🔵 DOWNLOAD PDF PROXY REQUEST START');

  if (!pdfUrl || !token) {
    logger.info('❌ DOWNLOAD PDF PROXY FAILED: Missing required fields');
    return res.status(400).json({
      success: false,
      message: 'pdfUrl and Authorization token required'
    });
  }

  try {
    // Load users from MySQL to get vendor info
    const database = require('../config/database');

    // Wait for MySQL initialization
    await database.waitForMySQLInitialization();

    if (!database.isMySQLAvailable()) {
      logger.info('❌ MySQL connection not available');
      return res.status(500).json({ success: false, message: 'Database connection not available' });
    }

    const vendor = req.user || await database.getUserByToken(token);

    if (!vendor || vendor.active_session !== 'TRUE') {
      logger.info('❌ VENDOR NOT FOUND OR INACTIVE ', vendor);
      return res.status(401).json({ success: false, message: 'Invalid or inactive vendor token' });
    }

    logger.info('✅ VENDOR FOUND:');

    // Fetch PDF from Shipway
    logger.info('🔄 Fetching PDF from Shipway...');
    logger.info('⏱️ Timeout: 30 seconds');

    // OPTIMIZATION #4: Add 30-second timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    let response;
    try {
      response = await fetch(pdfUrl, {
        signal: controller.signal  // Will abort after 30 seconds
      });

      clearTimeout(timeoutId); // Clear timeout if request completes successfully
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        logger.error('❌ PDF fetch request timed out after 30 seconds');
        throw new Error('PDF fetch request timed out. The request took longer than 30 seconds. Please try again.');
      }
      throw fetchError; // Re-throw other errors
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
    }

    const pdfBuffer = await response.arrayBuffer();

    // Validate that we received a valid buffer
    if (!pdfBuffer || pdfBuffer.byteLength === 0) {
      throw new Error('Received empty or invalid PDF buffer');
    }

    logger.info('✅ PDF fetched successfully');

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');

    // Generate filename with format: {vendor_id}_{vendor_city}_{current_date}
    const currentDate = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // yyyymmdd format
    const vendorId = vendor.warehouseId || 'unknown';
    const vendorCity = (vendor.city || 'unknown').toLowerCase();
    const filename = `${vendorId}_${vendorCity}_${currentDate}.pdf`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.byteLength);

    // Send the PDF buffer
    res.send(Buffer.from(pdfBuffer));

  } catch (error) {
    logger.error('❌ DOWNLOAD PDF PROXY ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to download PDF',
      error: error.message
    });
  }
});

/**
 * Generate combined PDF from multiple label URLs
 */
async function generateCombinedLabelsPDF(labels, format = 'thermal') {
  try {
    logger.info(`🔄 Generating combined PDF for ${labels.length} labels in ${format} format`);

    // Group labels by shipping_url to avoid downloading the same PDF multiple times
    // This is important for Shiprocket bulk labels where multiple orders share the same URL
    const labelsByUrl = new Map();
    labels.forEach(label => {
      if (!labelsByUrl.has(label.shipping_url)) {
        labelsByUrl.set(label.shipping_url, []);
      }
      labelsByUrl.get(label.shipping_url).push(label);
    });

    const uniqueUrls = Array.from(labelsByUrl.keys());
    logger.info(`📦 Grouped ${labels.length} labels into ${uniqueUrls.length} unique URLs`);
    labelsByUrl.forEach((labelGroup, url) => {
    });

    // Import PDF-lib for PDF manipulation
    const { PDFDocument } = require('pdf-lib');

    // Create a new PDF document
    const mergedPdf = await PDFDocument.create();

    if (format === 'thermal') {
      // ⚡ PARALLEL OPTIMIZATION: Download each unique URL only once
      logger.info(`⚡ Downloading ${uniqueUrls.length} unique PDFs in parallel...`);

      // Download each unique URL only once
      const downloadPromises = uniqueUrls.map(async (url) => {
        try {
          const orderIds = labelsByUrl.get(url).map(l => l.order_id).join(', ');

          const response = await fetch(url);
          if (!response.ok) {
            logger.info(`    ⚠️ Failed to fetch PDF:`, response.status);
            return { url, pdfBuffer: null, error: `HTTP ${response.status}`, orderIds };
          }

          const pdfBuffer = await response.arrayBuffer();
          logger.info(`    ✅ Downloaded PDF (${pdfBuffer.byteLength} bytes) for orders: ${orderIds}`);

          return { url, pdfBuffer, error: null, orderIds };
        } catch (error) {
          const orderIds = labelsByUrl.get(url).map(l => l.order_id).join(', ');
          logger.info(`    ❌ Error downloading PDF for orders ${orderIds}:`, error.message);
          return { url, pdfBuffer: null, error: error.message, orderIds };
        }
      });

      // Wait for all downloads to complete
      const downloadResults = await Promise.allSettled(downloadPromises);
      logger.info(`✅ All unique PDFs downloaded, now merging...`);

      // Merge each unique PDF only once
      for (const result of downloadResults) {
        if (result.status === 'fulfilled' && result.value.pdfBuffer) {
          try {
            const { url, pdfBuffer, orderIds } = result.value;

            // Load the PDF
            const pdf = await PDFDocument.load(pdfBuffer);

            // Copy all pages from this PDF to the merged PDF (only once)
            const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            pages.forEach(page => mergedPdf.addPage(page));

            logger.info(`    ✅ Added PDF (${pages.length} page(s)) for orders: ${orderIds}`);
          } catch (labelError) {
            const orderIds = result.value?.orderIds || 'unknown';
            logger.info(`    ❌ Error processing PDF for orders ${orderIds}:`, labelError.message);
          }
        } else if (result.status === 'fulfilled') {
          const orderIds = result.value?.orderIds || 'unknown';
          logger.info(`    ⚠️ Skipping PDF for orders ${orderIds}: ${result.value?.error}`);
        } else {
          logger.info(`    ❌ Promise rejected:`, result.reason?.message);
        }
      }
    } else {
      // For A4 and four-in-one formats, process labels in batches
      logger.info(`📄 Processing labels in ${format} format batches`);

      // ⚡ PARALLEL OPTIMIZATION: Download each unique URL only once
      logger.info(`⚡ Downloading ${uniqueUrls.length} unique PDFs in parallel for ${format} format...`);

      const downloadPromises = uniqueUrls.map(async (url) => {
        try {
          const orderIds = labelsByUrl.get(url).map(l => l.order_id).join(', ');

          const response = await fetch(url);
          if (!response.ok) {
            logger.info(`    ⚠️ Failed to fetch PDF:`, response.status);
            return { url, pdfBuffer: null, error: `HTTP ${response.status}`, orderIds };
          }

          const pdfBuffer = await response.arrayBuffer();
          logger.info(`    ✅ Downloaded PDF (${pdfBuffer.byteLength} bytes) for orders: ${orderIds}`);

          return { url, pdfBuffer, error: null, orderIds, labels: labelsByUrl.get(url) };
        } catch (error) {
          const orderIds = labelsByUrl.get(url).map(l => l.order_id).join(', ');
          logger.info(`    ❌ Error downloading PDF for orders ${orderIds}:`, error.message);
          return { url, pdfBuffer: null, error: error.message, orderIds, labels: labelsByUrl.get(url) };
        }
      });

      const downloadResults = await Promise.allSettled(downloadPromises);
      logger.info(`✅ All unique PDFs downloaded for ${format} format, now processing...`);

      // Extract successful downloads (each contains labels for that URL)
      const successfulDownloads = downloadResults
        .filter(result => result.status === 'fulfilled' && result.value.pdfBuffer)
        .map(result => result.value);

      if (format === 'a4') {
        // A4 format: One label per A4 page
        // Process each unique PDF and add all its pages
        for (const { url, pdfBuffer, labels: labelGroup, orderIds } of successfulDownloads) {
          try {

            const originalPdf = await PDFDocument.load(pdfBuffer);
            const pageCount = originalPdf.getPageCount();
            
            // Add each page from the PDF (Shiprocket bulk PDFs may have multiple pages)
            for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
              const a4Page = mergedPdf.addPage([595, 842]); // A4 size in points
              const [originalPage] = await mergedPdf.embedPages([originalPdf.getPage(pageIndex)]);

              // Center the label on the A4 page
              const labelWidth = 288; // 4x6 label width in points
              const labelHeight = 432; // 4x6 label height in points
              const x = (595 - labelWidth) / 2; // Center horizontally
              const y = (842 - labelHeight) / 2; // Center vertically

              a4Page.drawPage(originalPage, {
                x: x,
                y: y,
                width: labelWidth,
                height: labelHeight
              });
            }

            logger.info(`    ✅ Added A4 PDF (${pageCount} page(s)) for orders: ${orderIds}`);

          } catch (labelError) {
            logger.info(`    ❌ Error processing A4 PDF for orders ${orderIds}:`, labelError.message);
          }
        }
      } else if (format === 'four-in-one') {
        // Four-in-one format: 4 labels per A4 page
        // Extract all pages from all unique PDFs first
        const allPages = [];
        for (const { url, pdfBuffer, labels: labelGroup, orderIds } of successfulDownloads) {
          try {
            const originalPdf = await PDFDocument.load(pdfBuffer);
            const pageCount = originalPdf.getPageCount();
            
            // Extract all pages from this PDF
            for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
              const [originalPage] = await mergedPdf.embedPages([originalPdf.getPage(pageIndex)]);
              allPages.push(originalPage);
            }
            
          } catch (error) {
            logger.info(`    ❌ Error extracting pages from PDF for orders ${orderIds}:`, error.message);
          }
        }

        // Now arrange pages in four-in-one layout
        const batchSize = 4;
        for (let i = 0; i < allPages.length; i += batchSize) {
          const batch = allPages.slice(i, i + batchSize);

          const a4Page = mergedPdf.addPage([595, 842]); // A4 size in points

          // Original label dimensions
          const originalLabelWidth = 288; // 4x6 label width in points
          const originalLabelHeight = 432; // 4x6 label height in points

          // Layout parameters
          const horizontalMargin = 8; // Side margins
          const topBottomMargin = 3; // Top and bottom margins (reduced)
          const verticalGap = 12; // Gap between top and bottom rows

          // Calculate available space
          const availableHeight = 842 - (2 * topBottomMargin) - verticalGap;
          const scaledLabelHeight = availableHeight / 2; // Fit 2 rows perfectly
          const scaledLabelWidth = (scaledLabelHeight / originalLabelHeight) * originalLabelWidth;

          // Calculate vertical positions for proper spacing
          const topRowY = 842 - topBottomMargin - scaledLabelHeight;
          const bottomRowY = topBottomMargin;

          // Positions for 4 labels: top-left, top-right, bottom-left, bottom-right
          const positions = [
            [horizontalMargin, topRowY], // top-left
            [595 - scaledLabelWidth - horizontalMargin, topRowY], // top-right
            [horizontalMargin, bottomRowY], // bottom-left
            [595 - scaledLabelWidth - horizontalMargin, bottomRowY] // bottom-right
          ];

          // Process each page in the batch
          for (let j = 0; j < batch.length; j++) {
            const originalPage = batch[j];
            const [x, y] = positions[j];

            try {
              a4Page.drawPage(originalPage, {
                x: x,
                y: y,
                width: scaledLabelWidth,
                height: scaledLabelHeight
              });

              logger.info(`    ✅ Added page at position ${j + 1}`);

            } catch (labelError) {
              logger.info(`    ❌ Error processing page at position ${j + 1}:`, labelError.message);
            }
          }
        }
      }
    }

    // Save the merged PDF
    const mergedPdfBytes = await mergedPdf.save();
    logger.info(`✅ Combined PDF generated successfully in ${format} format`);

    return Buffer.from(mergedPdfBytes);

  } catch (error) {
    logger.error('❌ Combined PDF generation failed:', error);
    throw error;
  }
}

/**
 * @route   POST /api/orders/mark-ready
 * @desc    Mark order as ready for handover by calling Shipway manifest API
 * @access  Vendor (token required)
 */
router.post('/mark-ready', async (req, res) => {
  const { order_id } = req.body;
  const token = req.headers['authorization'];

  logger.info('🔵 MARK READY REQUEST START');

  if (!order_id || !token) {
    logger.info('❌ MARK READY FAILED: Missing required fields');
    return res.status(400).json({
      success: false,
      message: 'order_id and Authorization token required'
    });
  }

  try {
    // Load users from MySQL to get vendor info
    const database = require('../config/database');

    // Wait for MySQL initialization
    await database.waitForMySQLInitialization();

    if (!database.isMySQLAvailable()) {
      logger.info('❌ MySQL connection not available');
      return res.status(500).json({ success: false, message: 'Database connection not available' });
    }

    const vendor = req.user || await database.getUserByToken(token);

    if (!vendor || vendor.active_session !== 'TRUE') {
      logger.info('❌ VENDOR NOT FOUND OR INACTIVE ', vendor);
      return res.status(401).json({ success: false, message: 'Invalid or inactive vendor token' });
    }

    logger.info('✅ VENDOR FOUND:');

    // 3.3 — Targeted query: fetch only rows for this order_id (was: getAllOrders() + filter)
    const orderProducts = await database.getOrdersByOrderId(order_id);
    const claimedProducts = orderProducts.filter(order =>
      order.claimed_by === vendor.warehouseId && order.claims_status === 'claimed'
    );

    if (claimedProducts.length === 0) {
      logger.info('❌ No products claimed by this vendor for order:', order_id);
      return res.status(400).json({
        success: false,
        message: 'No products claimed by this vendor for this order'
      });
    }

    // Check if label is downloaded for all claimed products
    const productsWithoutLabel = claimedProducts.filter(product => product.label_downloaded !== 1);
    if (productsWithoutLabel.length > 0) {
      logger.info(`❌ Label not downloaded for order: ${order_id}`);
      return res.status(400).json({
        success: false,
        message: `Label is not yet downloaded for order id - ${order_id}`
      });
    }

    logger.info('✅ Order verification passed');

    // Get account_code from the first claimed product (REQUIRED)
    const accountCode = claimedProducts[0]?.account_code;
    if (!accountCode) {
      logger.info('❌ ACCOUNT_CODE NOT FOUND for order:', order_id);
      return res.status(400).json({
        success: false,
        message: 'Store information not found for this order. Cannot mark as ready.'
      });
    }

    logger.info('✅ Account code found:', accountCode);

    // Call Shipway Create Manifest API with account_code
    logger.info('🔄 Calling Shipway Create Manifest API...');
    const manifestResponse = await callShipwayCreateManifestAPI(order_id, accountCode);

    if (!manifestResponse.success) {
      logger.info('❌ Shipway manifest API failed:', manifestResponse.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to create manifest: ' + manifestResponse.message
      });
    }

    // 6.5 — Wrap upsertLabel (is_manifest=1) + all status updates in one transaction.
    // Without a transaction, a crash after upsertLabel but before all updateOrder
    // calls could leave some products stuck in 'claimed' while the manifest is already set.
    logger.info('🔄 Setting is_manifest = 1, manifest_id, and status = ready_for_handover (transactional)...');
    const labelData = {
      order_id: order_id,
      account_code: accountCode,
      is_manifest: 1,
      manifest_id: manifestResponse.manifest_id
    };

    const txManager = new TransactionManager(database.pool);
    await txManager.runInTransaction(async (conn) => {
      await database.upsertLabel(labelData, conn);
      for (const product of claimedProducts) {
        await database.updateOrder(product.unique_id, { status: 'ready_for_handover' }, conn);
      }
    });

    logger.info(`  ✅ Set is_manifest = 1 for order ${order_id}`);
    logger.info(`  ✅ Set manifest_id = ${manifestResponse.manifest_id} for order ${order_id}`);
    logger.info(`  ✅ All ${claimedProducts.length} products set to ready_for_handover (transactional)`);
    logger.info('🟢 MARK READY SUCCESS');

    return res.json({
      success: true,
      message: 'Order marked as ready for handover successfully',
      data: {
        order_id: order_id,
        status: 'ready_for_handover',
        manifest_created: true,
        is_manifest: 1,
        manifest_id: manifestResponse.manifest_id
      }
    });

  } catch (error) {
    logger.error('❌ MARK READY ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark order as ready',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/orders/bulk-mark-ready
 * @desc    Mark multiple orders as ready for handover by calling Shipway manifest API
 * @access  Vendor (token required)
 */
router.post('/bulk-mark-ready', async (req, res) => {
  const { order_ids } = req.body;
  const token = req.headers['authorization'];

  logger.info('🔵 BULK MARK READY REQUEST START');

  // 5.1 + 5.2 — Batch size limit + type validation
  const arrayCheck = validateBulkArray(order_ids, 'order_ids');
  if (!arrayCheck.ok || !token) {
    logger.info('❌ BULK MARK READY FAILED: Missing or invalid required fields');
    return res.status(400).json({
      success: false,
      message: arrayCheck.ok ? 'order_ids array and Authorization token required' : arrayCheck.message
    });
  }
  const sanitizedOrderIds = arrayCheck.items;

  try {
    // Load users from MySQL to get vendor info
    const database = require('../config/database');

    // Wait for MySQL initialization
    await database.waitForMySQLInitialization();

    if (!database.isMySQLAvailable()) {
      logger.info('❌ MySQL connection not available');
      return res.status(500).json({ success: false, message: 'Database connection not available' });
    }

    const vendor = req.user || await database.getUserByToken(token);

    if (!vendor || vendor.active_session !== 'TRUE') {
      logger.info('❌ VENDOR NOT FOUND OR INACTIVE ', vendor);
      return res.status(401).json({ success: false, message: 'Invalid or inactive vendor token' });
    }

    logger.info('✅ VENDOR FOUND:');

    // OPTIMIZATION: Fetch only selected orders instead of all orders
    // This reduces query time from 5-10 seconds to 0.1-0.5 seconds
    logger.info(`📦 Fetching only selected orders (${order_ids.length} orders)...`);
    const orders = await database.getOrdersByOrderIds(order_ids);
    logger.info(`✅ Fetched ${orders.length} products from ${order_ids.length} orders`);
    const successfulOrders = [];
    const failedOrders = [];
    const validOrderIds = [];
    const manifestIds = []; // Array to store created manifest IDs

    // First, validate all orders
    for (const order_id of order_ids) {
      try {
        logger.info(`🔍 Validating order: ${order_id}`);

        const orderProducts = orders.filter(order => order.order_id === order_id);
        const claimedProducts = orderProducts.filter(order =>
          order.claimed_by === vendor.warehouseId && order.claims_status === 'claimed'
        );

        if (claimedProducts.length === 0) {
          logger.info(`❌ No products claimed by this vendor for order: ${order_id}`);
          failedOrders.push({
            order_id: order_id,
            reason: 'No products claimed by this vendor for this order'
          });
          continue;
        }

        // Check if label is downloaded for all claimed products
        const productsWithoutLabel = claimedProducts.filter(product => product.label_downloaded !== 1);
        if (productsWithoutLabel.length > 0) {
          logger.info(`❌ Label not downloaded for order: ${order_id}`);
          failedOrders.push({
            order_id: order_id,
            reason: `Label is not yet downloaded for order id - ${order_id}`
          });
          continue;
        }

        logger.info(`✅ Order validation passed for ${order_id}`);
        validOrderIds.push(order_id);

      } catch (error) {
        logger.error(`❌ Error validating order ${order_id}:`, error);
        failedOrders.push({
          order_id: order_id,
          reason: error.message
        });
      }
    }

    // If we have valid orders, split by payment_type AND account_code and call manifest API separately
    if (validOrderIds.length > 0) {
      logger.info(`🔄 Processing ${validOrderIds.length} valid orders...`);

      // Step 1: Group orders by payment_type AND account_code (to ensure store isolation)
      // Structure: { 'C-STRI': [order_ids], 'C-JERS': [order_ids], 'P-STRI': [order_ids], 'P-JERS': [order_ids] }
      const orderGroups = {};

      for (const order_id of validOrderIds) {
        const orderProducts = orders.filter(order => order.order_id === order_id);
        const claimedProducts = orderProducts.filter(order =>
          order.claimed_by === vendor.warehouseId && order.claims_status === 'claimed'
        );

        // Get payment_type and account_code from first claimed product
        const paymentType = claimedProducts[0]?.payment_type;
        const accountCode = claimedProducts[0]?.account_code;

        if (!accountCode) {
          logger.error(`❌ ACCOUNT_CODE NOT FOUND for order ${order_id}`);
          failedOrders.push({
            order_id: order_id,
            reason: 'Store information not found for this order'
          });
          continue;
        }

        // Create group key: payment_type-account_code
        const groupKey = `${paymentType}-${accountCode}`;
        if (!orderGroups[groupKey]) {
          orderGroups[groupKey] = {
            paymentType: paymentType,
            accountCode: accountCode,
            orderIds: []
          };
        }
        orderGroups[groupKey].orderIds.push(order_id);
      }

      logger.info(`📊 Orders grouped by payment type and account_code:`);
      for (const [groupKey, group] of Object.entries(orderGroups)) {
      }

      // Step 2: Check shipping partner and route accordingly
      // Separate Shiprocket and Shipway orders
      // OPTIMIZATION: Fetch all stores in parallel instead of sequentially
      const uniqueAccountCodes = [...new Set(Object.values(orderGroups).map(g => g.accountCode))];
      logger.info(`📦 Fetching store info for ${uniqueAccountCodes.length} unique account code(s) in parallel...`);
      const storePromises = uniqueAccountCodes.map(accountCode => 
        database.getStoreByAccountCode(accountCode).then(store => ({ accountCode, store }))
      );
      const storeResults = await Promise.all(storePromises);
      const storeMap = new Map(storeResults.map(({ accountCode, store }) => [accountCode, store]));
      logger.info(`✅ Fetched store info for ${storeMap.size} stores`);

      const shiprocketGroups = [];
      const shipwayGroups = [];

      for (const [groupKey, group] of Object.entries(orderGroups)) {
        const store = storeMap.get(group.accountCode);
        if (store && store.shipping_partner?.toLowerCase() === 'shiprocket') {
          shiprocketGroups.push(group);
        } else {
          shipwayGroups.push(group);
        }
      }

      // Step 3: Process Shipway groups first (they don't need format selection)
      // This allows mixed orders to be handled - Shipway orders are processed immediately
      for (const group of shipwayGroups) {
        const { paymentType, accountCode, orderIds } = group;
        const paymentTypeName = paymentType === 'C' ? 'COD' : 'Prepaid';

        logger.info(`🔄 Calling Shipway Create Manifest API for ${paymentTypeName} orders (${accountCode})...`);
        const manifestResponse = await callShipwayCreateManifestAPI(orderIds, accountCode);

        if (!manifestResponse.success) {
          logger.info(`❌ ${paymentTypeName} manifest creation failed for ${accountCode}:`, manifestResponse.message);
          orderIds.forEach(order_id => {
            failedOrders.push({
              order_id: order_id,
              reason: `Failed to create ${paymentTypeName} manifest for ${accountCode}: ${manifestResponse.message}`
            });
          });
        } else {
          logger.info(`✅ ${paymentTypeName} Manifest created successfully for ${accountCode}`);
          manifestIds.push(manifestResponse.manifest_id);

          // Process each order in this group
          for (const order_id of orderIds) {
            try {
              const orderProducts = orders.filter(order => order.order_id === order_id);
              const claimedProducts = orderProducts.filter(order =>
                order.claimed_by === vendor.warehouseId && order.claims_status === 'claimed'
              );

              // Set is_manifest = 1 and manifest_id in labels table
              logger.info(`🔄 Setting manifest data for ${paymentTypeName} order ${order_id} (${accountCode})...`);
              const labelData = {
                order_id: order_id,
                account_code: accountCode,
                is_manifest: 1,
                manifest_id: manifestResponse.manifest_id
              };

              await database.upsertLabel(labelData);
              logger.info(`  ✅ Set manifest_id = ${manifestResponse.manifest_id} for order ${order_id}`);

              // Update order status to ready_for_handover
              for (const product of claimedProducts) {
                await database.updateOrder(product.unique_id, {
                  status: 'ready_for_handover'
                });
              }

              successfulOrders.push({
                order_id: order_id,
                status: 'ready_for_handover',
                manifest_created: true,
                is_manifest: 1,
                manifest_id: manifestResponse.manifest_id,
                payment_type: paymentTypeName,
                account_code: accountCode
              });

            } catch (error) {
              logger.error(`❌ Error updating ${paymentTypeName} order ${order_id}:`, error);
              failedOrders.push({
                order_id: order_id,
                reason: error.message
              });
            }
          }
        }
      }

      // Step 4: If Shiprocket orders found, return format requirement
      // Shipway orders are already processed above, so we only need format for Shiprocket
      if (shiprocketGroups.length > 0) {
        const shiprocketOrderIds = shiprocketGroups.flatMap(g => g.orderIds);
        logger.info(`🔵 Orders requiring format selection detected: ${shiprocketOrderIds.join(', ')}`);
        logger.info(`   → Shipway orders already processed. Returning response to trigger format popup.`);
        
        // Return response indicating format is needed
        // Include Shipway results if any were processed
        return res.status(200).json({
          success: shipwayGroups.length > 0, // true if Shipway orders were processed
          requires_format: true,
          message: shipwayGroups.length > 0 
            ? `Shipway orders processed. Please select manifest format for remaining orders.`
            : 'Please select manifest format for manifest generation',
          order_ids_requiring_format: shiprocketOrderIds,
          data: {
            // Include Shipway results if processed
            shipway_processed: shipwayGroups.length > 0,
            successful_orders: successfulOrders,
            failed_orders: failedOrders,
            total_requested: order_ids.length,
            total_successful: successfulOrders.length,
            total_failed: failedOrders.length,
            manifest_ids: manifestIds,
            order_ids_requiring_format: shiprocketOrderIds
          }
        });
      }
    }

    logger.info('🟢 BULK MARK READY COMPLETE');

    if (successfulOrders.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No orders could be marked as ready',
        data: {
          successful_orders: successfulOrders,
          failed_orders: failedOrders,
          total_requested: order_ids.length,
          total_successful: successfulOrders.length,
          total_failed: failedOrders.length,
          manifest_ids: manifestIds
        }
      });
    }

    return res.json({
      success: true,
      message: `Successfully marked ${successfulOrders.length} out of ${order_ids.length} orders as ready for handover`,
      data: {
        successful_orders: successfulOrders,
        failed_orders: failedOrders,
        total_requested: order_ids.length,
        total_successful: successfulOrders.length,
        total_failed: failedOrders.length,
        manifest_ids: manifestIds
      }
    });

  } catch (error) {
    logger.error('❌ BULK MARK READY ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark orders as ready',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/orders/shiprocket/start-pickup
 * @desc    Start pickup API calls for Shiprocket orders (async, non-blocking)
 * @access  Vendor (token required)
 */
router.post('/shiprocket/start-pickup', async (req, res) => {
  const { order_ids } = req.body;
  const token = req.headers['authorization'];

  logger.info('🔵 SHIPROCKET START PICKUP REQUEST');

  if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0 || !token) {
    return res.status(400).json({
      success: false,
      message: 'order_ids array and Authorization token required'
    });
  }

  try {
    const database = require('../config/database');
    await database.waitForMySQLInitialization();

    if (!database.isMySQLAvailable()) {
      return res.status(500).json({ success: false, message: 'Database connection not available' });
    }

    const vendor = req.user || await database.getUserByToken(token);
    if (!vendor || vendor.active_session !== 'TRUE') {
      return res.status(401).json({ success: false, message: 'Invalid or inactive vendor token' });
    }

    // 3.4 — Single batch query for all order_ids (race-condition-safe: 1 round-trip vs N parallel)
    // getOrdersByOrderIds uses WHERE order_id IN (...) — no parallel pool pressure
    const orderDetailsFlat = await database.getOrdersByOrderIds(order_ids);
    const orderDetails = [];
    const processedShipmentIds = new Set();

    for (const order_id of order_ids) {
      const orderProducts = orderDetailsFlat.filter(order => order.order_id === order_id);
      const claimedProducts = orderProducts.filter(order =>
        order.claimed_by === vendor.warehouseId && order.claims_status === 'claimed'
      );

      if (claimedProducts.length === 0) continue;

      const productsWithoutLabel = claimedProducts.filter(product => product.label_downloaded !== 1);
      if (productsWithoutLabel.length > 0) continue;

      const accountCode = claimedProducts[0]?.account_code;
      const store = await database.getStoreByAccountCode(accountCode);
      if (!store || store.shipping_partner?.toLowerCase() !== 'shiprocket') continue;

      const shipmentIds = claimedProducts
        .map(p => p.shipment_id)
        .filter(id => id && id !== '' && id !== null);

      if (shipmentIds.length === 0) continue;

      for (const shipmentId of shipmentIds) {
        if (!processedShipmentIds.has(shipmentId)) {
          processedShipmentIds.add(shipmentId);
          orderDetails.push({
            shipmentId,
            accountCode
          });
        }
      }
    }

    if (orderDetails.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid Shiprocket orders found'
      });
    }

    // Start pickup calls in background (fire and forget)
    const ShiprocketService = require('../services/shiprocketService');
    const pickupPromises = [];

    for (const orderDetail of orderDetails) {
      const shiprocketService = new ShiprocketService(orderDetail.accountCode);
      
      const pickupPromise = (async () => {
        let attempt = 1;
        while (attempt <= 3) {
          try {
            const result = await shiprocketService.generatePickup(orderDetail.shipmentId);
            if (result.success) {
              logger.info(`✅ Pickup requested for shipment ${orderDetail.shipmentId} (attempt ${attempt})`);
              return { success: true, shipmentId: orderDetail.shipmentId };
            } else {
              logger.info(`⚠️ Pickup failed for shipment ${orderDetail.shipmentId} (attempt ${attempt}): ${result.message}`);
              shiprocketService.logApiActivity({
                type: 'shiprocket-pickup-failure',
                shipmentId: orderDetail.shipmentId,
                attempt,
                error: result.message
              });
              if (attempt < 3) {
                const delay = attempt === 1 ? 1000 : 2000;
                await new Promise(resolve => setTimeout(resolve, delay));
              }
              attempt++;
            }
          } catch (error) {
            logger.error(`❌ Pickup error for shipment ${orderDetail.shipmentId} (attempt ${attempt}):`, error.message);
            shiprocketService.logApiActivity({
              type: 'shiprocket-pickup-error',
              shipmentId: orderDetail.shipmentId,
              attempt,
              error: error.message
            });
            if (attempt < 3) {
              const delay = attempt === 1 ? 1000 : 2000;
              await new Promise(resolve => setTimeout(resolve, delay));
            }
            attempt++;
          }
        }
        logger.info(`❌ Pickup failed after 3 attempts for shipment ${orderDetail.shipmentId}`);
        return { success: false, shipmentId: orderDetail.shipmentId };
      })();
      
      pickupPromises.push(pickupPromise);
    }

    // Return immediately, continue pickup in background
    res.json({
      success: true,
      message: 'Pickup requests started',
      pickup_in_progress: true,
      shipment_count: orderDetails.length
    });

    // Continue pickup calls in background
    Promise.allSettled(pickupPromises).then(results => {
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failCount = results.length - successCount;
      logger.info(`📊 Pickup API calls completed: ${successCount} success, ${failCount} failed`);
    });

  } catch (error) {
    logger.error('❌ SHIPROCKET START PICKUP ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to start pickup requests',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/orders/shiprocket/generate-manifest
 * @desc    Generate manifest for Shiprocket orders (calls pickup first, then manifest)
 * @access  Vendor (token required)
 * 
 * Flow:
 * 1. Call pickup API for all shipments (with retries: 3 attempts, incremental delays)
 * 2. Wait for all pickup calls to complete
 * 3. Call generate manifest API (bulk)
 * 4. Generate custom manifest IDs (one for Prepaid, one for COD)
 * 5. Update database with manifest_id and is_manifest
 * 6. Return manifest_ids
 */
router.post('/shiprocket/generate-manifest', async (req, res) => {
  const { order_ids, format } = req.body;
  const token = req.headers['authorization'];

  logger.info('🔵 SHIPROCKET MANIFEST REQUEST START');

  if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0 || !token || !format) {
    logger.info('❌ SHIPROCKET MANIFEST FAILED: Missing required fields');
    return res.status(400).json({
      success: false,
      message: 'order_ids array, format, and Authorization token required'
    });
  }

  try {
    const database = require('../config/database');
    await database.waitForMySQLInitialization();

    if (!database.isMySQLAvailable()) {
      logger.info('❌ MySQL connection not available');
      return res.status(500).json({ success: false, message: 'Database connection not available' });
    }

    const vendor = req.user || await database.getUserByToken(token);
    if (!vendor || vendor.active_session !== 'TRUE') {
      logger.info('❌ VENDOR NOT FOUND OR INACTIVE');
      return res.status(401).json({ success: false, message: 'Invalid or inactive vendor token' });
    }

    logger.info('✅ VENDOR FOUND:');

    // OPTIMIZATION: Fetch only selected orders instead of all orders
    // This reduces query time from 5-10 seconds to 0.1-0.5 seconds
    logger.info(`📦 Fetching only selected orders (${order_ids.length} orders)...`);
    const orders = await database.getOrdersByOrderIds(order_ids);
    logger.info(`✅ Fetched ${orders.length} products from ${order_ids.length} orders`);

    // Get orders and validate
    const validOrderIds = [];
    const orderDetails = [];

    for (const order_id of order_ids) {
      const orderProducts = orders.filter(order => order.order_id === order_id);
      const claimedProducts = orderProducts.filter(order =>
        order.claimed_by === vendor.warehouseId && order.claims_status === 'claimed'
      );

      if (claimedProducts.length === 0) {
        logger.info(`❌ No products claimed by this vendor for order: ${order_id}`);
        continue;
      }

      const productsWithoutLabel = claimedProducts.filter(product => product.label_downloaded !== 1);
      if (productsWithoutLabel.length > 0) {
        logger.info(`❌ Label not downloaded for order: ${order_id}`);
        continue;
      }

      // Get shipment_id for each order
      const shipmentIds = claimedProducts
        .map(p => p.shipment_id)
        .filter(id => id && id !== '' && id !== null);

      if (shipmentIds.length === 0) {
        logger.info(`❌ No shipment_id found for order: ${order_id}`);
        continue;
      }

      // Get account_code for later store validation
      const accountCode = claimedProducts[0]?.account_code;

      validOrderIds.push(order_id);
      orderDetails.push({
        order_id: order_id,
        account_code: accountCode,
        shipment_ids: shipmentIds,
        payment_type: claimedProducts[0]?.payment_type,
        claimed_products: claimedProducts
      });
    }

    if (validOrderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid Shiprocket orders found for manifest generation'
      });
    }

    // OPTIMIZATION: Fetch all stores in parallel to check shipping partner
    const uniqueAccountCodes = [...new Set(orderDetails.map(od => od.account_code))];
    logger.info(`📦 Fetching store info for ${uniqueAccountCodes.length} unique account code(s) in parallel...`);
    const storePromises = uniqueAccountCodes.map(accountCode => 
      database.getStoreByAccountCode(accountCode).then(store => ({ accountCode, store }))
    );
    const storeResults = await Promise.all(storePromises);
    const storeMap = new Map(storeResults.map(({ accountCode, store }) => [accountCode, store]));
    logger.info(`✅ Fetched store info for ${storeMap.size} stores`);

    // Filter out non-Shiprocket orders
    const shiprocketOrderDetails = orderDetails.filter(orderDetail => {
      const store = storeMap.get(orderDetail.account_code);
      if (!store || store.shipping_partner?.toLowerCase() !== 'shiprocket') {
        logger.info(`❌ Order ${orderDetail.order_id} is not a Shiprocket order (${orderDetail.account_code})`);
        return false;
      }
      return true;
    });

    if (shiprocketOrderDetails.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid Shiprocket orders found for manifest generation'
      });
    }

    // Step 1: Call pickup API for all shipments (with retries)
    logger.info('📋 Step 1: Calling pickup API for all shipments...');

    // Collect all shipment_ids
    const allShipmentIds = [];
    const shipmentIdToOrderMap = new Map(); // Map shipment_id to order details

    for (const orderDetail of shiprocketOrderDetails) {
      for (const shipmentId of orderDetail.shipment_ids) {
        if (!allShipmentIds.includes(shipmentId)) {
          allShipmentIds.push(shipmentId);
        }
        if (!shipmentIdToOrderMap.has(shipmentId)) {
          shipmentIdToOrderMap.set(shipmentId, []);
        }
        shipmentIdToOrderMap.get(shipmentId).push(orderDetail);
      }
    }

    // Call pickup API for all shipments in parallel (with retries)
    logger.info(`🔄 Calling pickup API for ${allShipmentIds.length} shipments (parallel processing)...`);
    const ShiprocketService = require('../services/shiprocketService');
    const processedShipmentIds = new Set();
    const pickupPromises = [];

    // Create pickup promise for each unique shipment_id
    for (const shipmentId of allShipmentIds) {
      if (processedShipmentIds.has(shipmentId)) {
        continue; // Skip if already processed
      }
      processedShipmentIds.add(shipmentId);

      // Get account_code from first order that uses this shipment_id
      const orderDetail = shipmentIdToOrderMap.get(shipmentId)[0];
      const shiprocketService = new ShiprocketService(orderDetail.account_code);

      // Create pickup promise with retry logic
      const pickupPromise = (async () => {
        let attempt = 1;
        while (attempt <= 3) {
          try {
            const result = await shiprocketService.generatePickup(shipmentId);
            if (result.success) {
              logger.info(`✅ Pickup requested for shipment ${shipmentId} (attempt ${attempt})`);
              return { success: true, shipmentId, attempt };
            } else {
              logger.info(`⚠️ Pickup failed for shipment ${shipmentId} (attempt ${attempt}): ${result.message}`);
              shiprocketService.logApiActivity({
                type: 'shiprocket-pickup-failure',
                shipmentId,
                attempt,
                error: result.message
              });
              if (attempt < 3) {
                const delay = attempt === 1 ? 1000 : 2000; // 1s then 2s
                await new Promise(resolve => setTimeout(resolve, delay));
              }
              attempt++;
            }
          } catch (error) {
            logger.error(`❌ Pickup error for shipment ${shipmentId} (attempt ${attempt}):`, error.message);
            shiprocketService.logApiActivity({
              type: 'shiprocket-pickup-error',
              shipmentId,
              attempt,
              error: error.message
            });
            if (attempt < 3) {
              const delay = attempt === 1 ? 1000 : 2000;
              await new Promise(resolve => setTimeout(resolve, delay));
            }
            attempt++;
          }
        }
        logger.info(`❌ Pickup failed after 3 attempts for shipment ${shipmentId}, continuing anyway`);
        return { success: false, shipmentId, attempt: 3 };
      })();

      pickupPromises.push(pickupPromise);
    }

    // Wait for all pickup calls to complete (parallel processing)
    const pickupResults = await Promise.allSettled(pickupPromises);
    const successfulPickups = pickupResults.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failedPickups = pickupResults.length - successfulPickups;
    logger.info(`📊 Pickup API calls completed: ${successfulPickups} success, ${failedPickups} failed`);

    // Group orders by payment_type and account_code
    const orderGroups = {};
    for (const orderDetail of shiprocketOrderDetails) {
      const groupKey = `${orderDetail.payment_type}-${orderDetail.account_code}`;
      if (!orderGroups[groupKey]) {
        orderGroups[groupKey] = {
          paymentType: orderDetail.payment_type,
          accountCode: orderDetail.account_code,
          orders: []
        };
      }
      orderGroups[groupKey].orders.push(orderDetail);
    }

    // OPTIMIZATION #1: Pre-generate all manifest IDs upfront (in parallel)
    const groupKeys = Object.keys(orderGroups);
    logger.info(`📋 Pre-generating ${groupKeys.length} manifest ID(s) in parallel...`);
    const manifestIdPromises = groupKeys.map(() => database.getNextShiprocketManifestId());
    const preGeneratedManifestIds = await Promise.all(manifestIdPromises);
    logger.info(`✅ Pre-generated manifest IDs: ${preGeneratedManifestIds.join(', ')}`);

    // OPTIMIZATION #2: Process all groups in parallel
    logger.info(`🚀 Processing ${groupKeys.length} manifest group(s) in parallel...`);
    const groupPromises = groupKeys.map(async (groupKey, index) => {
      const group = orderGroups[groupKey];
      const { paymentType, accountCode, orders } = group;
      const paymentTypeName = paymentType === 'C' ? 'COD' : 'Prepaid';
      const manifestId = preGeneratedManifestIds[index];

      // Collect all shipment_ids for this group
      const groupShipmentIds = [];
      const orderIdToShipmentIds = new Map();

      for (const orderDetail of orders) {
        orderIdToShipmentIds.set(orderDetail.order_id, orderDetail.shipment_ids);
        groupShipmentIds.push(...orderDetail.shipment_ids);
      }

      // Remove duplicates
      const uniqueShipmentIds = [...new Set(groupShipmentIds)];

      logger.info(`🔄 [${groupKey}] Generating manifest for ${paymentTypeName} orders (${accountCode})...`);

      try {
        const shiprocketService = new ShiprocketService(accountCode);
        const manifestResponse = await shiprocketService.generateManifest(uniqueShipmentIds);

        if (!manifestResponse.success) {
          // Check if manifest was already generated (Shiprocket returns this error)
          const isAlreadyManifested = manifestResponse.message?.toLowerCase().includes('already') || 
                                      manifestResponse.data?.message?.toLowerCase().includes('already');
          
          if (isAlreadyManifested) {
            // Shiprocket has already manifested these orders on their side
            // We need to mark them as manifested in our database using our pre-generated manifest_id
            logger.info(`✅ [${groupKey}] Manifest already generated by Shiprocket. Marking orders as manifested in our database...`);
            
            // Prepare batch updates with the pre-generated manifest_id
            const labelUpdates = [];
            const orderUpdates = [];
            
            for (const orderDetail of orders) {
              labelUpdates.push({
                order_id: orderDetail.order_id,
                account_code: accountCode,
                is_manifest: 1,
                manifest_id: manifestId
              });
              
              for (const product of orderDetail.claimed_products) {
                orderUpdates.push({
                  unique_id: product.unique_id,
                  updateData: { status: 'ready_for_handover' }
                });
              }
            }
            
            return {
              success: true,
              manifestId: manifestId,
              failedOrders: [],
              labelUpdates: labelUpdates,
              orderUpdates: orderUpdates,
              successfulOrders: orders.map(orderDetail => ({
                order_id: orderDetail.order_id,
                status: 'ready_for_handover',
                manifest_created: true,
                is_manifest: 1,
                manifest_id: manifestId,
                payment_type: paymentTypeName,
                account_code: accountCode
              }))
            };
          } else {
            // Real failure - not "already manifested"
            logger.info(`❌ [${groupKey}] ${paymentTypeName} manifest generation failed: ${manifestResponse.message}`);
            return {
              success: false,
              manifestId: null,
              failedOrders: orders.map(orderDetail => ({
                order_id: orderDetail.order_id,
                reason: `Failed to generate ${paymentTypeName} manifest: ${manifestResponse.message}`
              })),
              labelUpdates: [],
              orderUpdates: []
            };
          }
        }

        logger.info(`✅ [${groupKey}] ${paymentTypeName} Manifest generated successfully`);

        // OPTIMIZATION #3: Prepare batch updates
        const labelUpdates = [];
        const orderUpdates = [];

        for (const orderDetail of orders) {
          labelUpdates.push({
            order_id: orderDetail.order_id,
            account_code: accountCode,
            is_manifest: 1,
            manifest_id: manifestId
          });

          // Collect all unique_ids for order status updates
          for (const product of orderDetail.claimed_products) {
            orderUpdates.push({
              unique_id: product.unique_id,
              updateData: { status: 'ready_for_handover' }
            });
          }
        }

        return {
          success: true,
          manifestId: manifestId,
          failedOrders: [],
          labelUpdates: labelUpdates,
          orderUpdates: orderUpdates,
          successfulOrders: orders.map(orderDetail => ({
            order_id: orderDetail.order_id,
            status: 'ready_for_handover',
            manifest_created: true,
            is_manifest: 1,
            manifest_id: manifestId,
            payment_type: paymentTypeName,
            account_code: accountCode
          }))
        };
      } catch (error) {
        // Check if error is about manifest already generated
        const isAlreadyManifested = error.message?.toLowerCase().includes('already');
        
        if (isAlreadyManifested) {
          // Shiprocket has already manifested these orders on their side
          // We need to mark them as manifested in our database using our pre-generated manifest_id
          logger.info(`✅ [${groupKey}] Manifest already generated by Shiprocket (caught in error). Marking orders as manifested in our database...`);
          
          // Prepare batch updates with the pre-generated manifest_id
          const labelUpdates = [];
          const orderUpdates = [];
          
          for (const orderDetail of orders) {
            labelUpdates.push({
              order_id: orderDetail.order_id,
              account_code: accountCode,
              is_manifest: 1,
              manifest_id: manifestId
            });
            
            for (const product of orderDetail.claimed_products) {
              orderUpdates.push({
                unique_id: product.unique_id,
                updateData: { status: 'ready_for_handover' }
              });
            }
          }
          
          return {
            success: true,
            manifestId: manifestId,
            failedOrders: [],
            labelUpdates: labelUpdates,
            orderUpdates: orderUpdates,
            successfulOrders: orders.map(orderDetail => ({
              order_id: orderDetail.order_id,
              status: 'ready_for_handover',
              manifest_created: true,
              is_manifest: 1,
              manifest_id: manifestId,
              payment_type: paymentTypeName,
              account_code: accountCode
            }))
          };
        } else {
          // Real error - not "already manifested"
          logger.error(`❌ [${groupKey}] Error generating ${paymentTypeName} manifest:`, error);
          return {
            success: false,
            manifestId: null,
            failedOrders: orders.map(orderDetail => ({
              order_id: orderDetail.order_id,
              reason: error.message
            })),
            labelUpdates: [],
            orderUpdates: []
          };
        }
      }
    });

    // Wait for all groups to complete
    const groupResults = await Promise.allSettled(groupPromises);

    // Collect results and prepare batch updates
    const manifestIds = [];
    const successfulOrders = [];
    const failedOrders = [];
    const allLabelUpdates = [];
    const allOrderUpdates = [];

    for (let i = 0; i < groupResults.length; i++) {
      const result = groupResults[i];
      if (result.status === 'fulfilled') {
        const groupResult = result.value;
        if (groupResult.success && groupResult.manifestId) {
          manifestIds.push(groupResult.manifestId);
          successfulOrders.push(...(groupResult.successfulOrders || []));
          allLabelUpdates.push(...groupResult.labelUpdates);
          allOrderUpdates.push(...groupResult.orderUpdates);
        }
        failedOrders.push(...groupResult.failedOrders);
      } else {
        // Handle rejected promise
        const groupKey = groupKeys[i];
        logger.error(`❌ [${groupKey}] Promise rejected:`, result.reason);
        const group = orderGroups[groupKey];
        group.orders.forEach(orderDetail => {
          failedOrders.push({
            order_id: orderDetail.order_id,
            reason: result.reason?.message || 'Unknown error during parallel processing'
          });
        });
      }
    }

    // OPTIMIZATION #3: Batch update database (all labels and orders at once)
    if (allLabelUpdates.length > 0) {
      logger.info(`💾 Batch updating ${allLabelUpdates.length} label(s)...`);
      try {
        await database.batchUpsertLabels(allLabelUpdates);
        logger.info(`✅ Batch label updates completed`);
      } catch (error) {
        logger.error(`❌ Batch label update failed:`, error);
        // Mark affected orders as failed
        allLabelUpdates.forEach(labelUpdate => {
          failedOrders.push({
            order_id: labelUpdate.order_id,
            reason: `Database update failed: ${error.message}`
          });
        });
      }
    }

    if (allOrderUpdates.length > 0) {
      logger.info(`💾 Batch updating ${allOrderUpdates.length} order status(es)...`);
      try {
        await database.bulkUpdateOrders(allOrderUpdates);
        logger.info(`✅ Batch order updates completed`);
      } catch (error) {
        logger.error(`❌ Batch order update failed:`, error);
        // Note: Order status updates are less critical, so we don't mark as failed
      }
    }

    logger.info('🟢 SHIPROCKET MANIFEST COMPLETE');

    if (successfulOrders.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Failed to generate manifest for any orders',
        data: {
          successful_orders: [],
          failed_orders: failedOrders,
          manifest_ids: []
        }
      });
    }

    return res.json({
      success: true,
      message: `Successfully generated manifest for ${successfulOrders.length} out of ${order_ids.length} orders`,
      data: {
        successful_orders: successfulOrders,
        failed_orders: failedOrders,
        total_requested: order_ids.length,
        total_successful: successfulOrders.length,
        total_failed: failedOrders.length,
        manifest_ids: manifestIds
      }
    });

  } catch (error) {
    logger.error('❌ SHIPROCKET MANIFEST ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate manifest',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/orders/admin/refresh
 * @desc    Refresh orders by syncing from Shipway API (Admin)
 * @access  Admin/Superadmin only
 */
router.post('/admin/refresh', authenticateBasicAuth, requireAdminOrSuperadmin, async (req, res) => {
  logger.info('🔵 ADMIN REFRESH ORDERS REQUEST START');
  const { async: runAsync = false } = req.body || {};
  const token = req.headers['authorization'];

  // ── ASYNC MODE ─────────────────────────────────────────────────────────────
  if (runAsync) {
    const task = taskStore.createTask('admin-refresh', (token || '').substring(0, 20));
    (async () => {
      try {
        const database = require('../config/database');
        await database.waitForMySQLInitialization();
        const multiStoreSyncService = require('../services/multiStoreSyncService');
        const result = await multiStoreSyncService.syncAllStores();
        taskStore.completeTask(task.id, {
          success: true,
          message: `Orders refreshed. ${result.successfulStores}/${result.totalStores} stores synced, ${result.totalOrders} orders.`,
          data: { sync_result: result, timestamp: new Date().toISOString() }
        });
      } catch (err) {
        taskStore.failTask(task.id, err.message);
      }
    })();
    return res.json({ success: true, taskId: task.id, async: true });
  }
  // ─────────────────────────────────────────────────────────────────────────

  try {
    // Wait for MySQL initialization
    const database = require('../config/database');
    await database.waitForMySQLInitialization();

    if (!database.isMySQLAvailable()) {
      logger.info('❌ MySQL connection not available');
      return res.status(500).json({ success: false, message: 'Database connection not available' });
    }

    // Use multiStoreSyncService to sync orders for all active stores
    const multiStoreSyncService = require('../services/multiStoreSyncService');

    logger.info('🔄 Starting orders sync from Shipway for all stores...');
    const result = await multiStoreSyncService.syncAllStores();

    logger.info('✅ Orders synced successfully');

    return res.json({
      success: true,
      message: `Orders refreshed successfully from Shipway. ${result.successfulStores}/${result.totalStores} stores synced, ${result.totalOrders} orders processed.`,
      data: {
        sync_result: result,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('❌ ADMIN REFRESH ORDERS ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to refresh orders',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/orders/refresh
 * @desc    Refresh orders by syncing from Shipway API
 * @access  Vendor (token required)
 */
router.post('/refresh', async (req, res) => {
  const { async: runAsync = false } = req.body || {};
  const token = req.headers['authorization'];

  logger.info('🔵 REFRESH ORDERS REQUEST START');

  if (!token) {
    return res.status(400).json({ success: false, message: 'Authorization token required' });
  }

  // ── ASYNC MODE ─────────────────────────────────────────────────────────────
  if (runAsync) {
    const task = taskStore.createTask('refresh', (token || '').substring(0, 20));
    const savedToken = token;
    (async () => {
      try {
        const database = require('../config/database');
        await database.waitForMySQLInitialization();
        const vendor = await database.getUserByToken(savedToken);
        if (!vendor || vendor.active_session !== 'TRUE') {
          taskStore.failTask(task.id, 'Invalid or inactive vendor token');
          return;
        }
        const multiStoreSyncService = require('../services/multiStoreSyncService');
        const result = await multiStoreSyncService.syncAllStores();
        taskStore.completeTask(task.id, {
          success: true,
          message: `Orders refreshed. ${result.successfulStores}/${result.totalStores} stores synced, ${result.totalOrders} orders.`,
          data: { sync_result: result, timestamp: new Date().toISOString() }
        });
      } catch (err) {
        taskStore.failTask(task.id, err.message);
      }
    })();
    return res.json({ success: true, taskId: task.id, async: true });
  }
  // ─────────────────────────────────────────────────────────────────────────

  try {
    // Load users from MySQL to get vendor info
    const database = require('../config/database');

    // Wait for MySQL initialization
    await database.waitForMySQLInitialization();

    if (!database.isMySQLAvailable()) {
      logger.info('❌ MySQL connection not available');
      return res.status(500).json({ success: false, message: 'Database connection not available' });
    }

    const vendor = req.user || await database.getUserByToken(token);

    if (!vendor || vendor.active_session !== 'TRUE') {
      logger.info('❌ VENDOR NOT FOUND OR INACTIVE ', vendor);
      return res.status(401).json({ success: false, message: 'Invalid or inactive vendor token' });
    }

    logger.info('✅ VENDOR FOUND:');

    // Use multiStoreSyncService to sync orders for all active stores
    const multiStoreSyncService = require('../services/multiStoreSyncService');

    logger.info('🔄 Starting orders sync from Shipway for all stores...');
    const result = await multiStoreSyncService.syncAllStores();

    logger.info('✅ Orders synced successfully');

    return res.json({
      success: true,
      message: `Orders refreshed successfully from Shipway. ${result.successfulStores}/${result.totalStores} stores synced, ${result.totalOrders} orders processed.`,
      data: {
        sync_result: result,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('❌ REFRESH ORDERS ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to refresh orders',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/orders/reverse
 * @desc    Reverse an order (unclaim it) - handles both cases with and without label download
 * @access  Vendor (token required)
 */
router.post('/reverse', async (req, res) => {
  const { unique_id } = req.body;
  let token = req.headers['authorization'];

  // Handle case where token might be an object
  if (typeof token === 'object' && token !== null) {

    // Try to extract the actual token string
    if (token.token) {
      token = token.token;
    } else if (token.authorization) {
      token = token.authorization;
    } else if (Object.values(token).length === 1) {
      token = Object.values(token)[0];
    } else {
      token = null;
    }
  }

  logger.info('🔵 REVERSE REQUEST START');

  if (!unique_id) {
    logger.info('❌ REVERSE FAILED: Missing unique_id');
    return res.status(400).json({ success: false, message: 'unique_id is required' });
  }

  if (!token) {
    return res.status(400).json({ success: false, message: 'Authorization token required' });
  }

  try {
    // Load users from MySQL to get vendor info
    const database = require('../config/database');

    // Wait for MySQL initialization
    await database.waitForMySQLInitialization();

    if (!database.isMySQLAvailable()) {
      logger.info('❌ MySQL connection not available');
      return res.status(500).json({ success: false, message: 'Database connection not available' });
    }

    const vendor = req.user || await database.getUserByToken(token);

    if (!vendor || vendor.active_session !== 'TRUE') {
      logger.info('❌ VENDOR NOT FOUND OR INACTIVE ', vendor);
      return res.status(401).json({ success: false, message: 'Invalid or inactive vendor token' });
    }

    logger.info('✅ VENDOR FOUND:');

    // Get the order details
    const order = await database.getOrderByUniqueId(unique_id);

    if (!order) {
      logger.info('❌ ORDER NOT FOUND:', unique_id);
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check if the order is claimed by this vendor
    if (order.claimed_by !== vendor.warehouseId) {
      logger.info('❌ ORDER NOT CLAIMED BY THIS VENDOR');
      return res.status(403).json({ success: false, message: 'You can only reverse orders claimed by you' });
    }

    logger.info('✅ ORDER FOUND AND CLAIMED BY VENDOR');

    // Check label_downloaded status
    const isLabelDownloaded = order.label_downloaded === 1 || order.label_downloaded === true || order.label_downloaded === '1';

    if (isLabelDownloaded) {
      logger.info('🔄 CASE 2: Label downloaded - cancelling shipment before reverse');

      // Get account_code from order to use correct store credentials
      const accountCode = order.account_code;
      if (!accountCode) {
        logger.info('❌ ACCOUNT_CODE NOT FOUND for order:', order.order_id);
        return res.status(400).json({
          success: false,
          message: 'Store information not found for this order. Cannot cancel shipment.'
        });
      }

      // Get AWB number from labels table (with account_code filter for store-specific retrieval)
      const label = await database.getLabelByOrderId(order.order_id, accountCode);

      if (!label || !label.awb) {
        logger.info('❌ AWB NOT FOUND for order:', order.order_id);
        return res.status(400).json({
          success: false,
          message: 'AWB number not found for this order. Cannot cancel shipment.'
        });
      }

      // Validate AWB is not empty or null
      const awbValue = String(label.awb || '').trim();
      if (!awbValue || awbValue === '') {
        logger.info('❌ AWB IS EMPTY OR NULL for order:', order.order_id);
        return res.status(400).json({
          success: false,
          message: 'AWB number is empty or invalid. Cannot cancel shipment.'
        });
      }

      logger.info('✅ AWB FOUND:', awbValue);

      // Determine shipping partner for this store
      const storeInfo = await database.getStoreByAccountCode(accountCode);
      const shippingPartner = (storeInfo?.shipping_partner || '').toLowerCase();

      try {
        if (shippingPartner === 'shiprocket') {
          logger.info('🔄 Using Shiprocket cancel API for order:', order.order_id);
          const ShiprocketService = require('../services/shiprocketService');
          const shiprocketService = new ShiprocketService(accountCode);
          const cancelResult = await shiprocketService.cancelShipmentsByAwbs([awbValue]);
          logger.info('✅ SHIPROCKET CANCEL SUCCESS:', JSON.stringify(cancelResult, null, 2));
        } else {
          logger.info('🔄 Using Shipway cancel API for order:', order.order_id);
          const ShipwayService = require('../services/shipwayService');
          const shipwayService = new ShipwayService(accountCode);
          await shipwayService.initialize();
          const cancelResult = await shipwayService.cancelShipment([awbValue]);
          logger.info('✅ SHIPWAY CANCEL SUCCESS:', cancelResult);
        }
      } catch (cancelError) {
        logger.error('❌ SHIPMENT CANCEL FAILED:');
        logger.error('  - Error message:', cancelError.message);
        logger.error('  - Error stack:', cancelError.stack);
        logger.error('  - Account Code:', accountCode);
        logger.error('  - AWB:', awbValue);
        logger.error('  - Shipping Partner:', shippingPartner);
        return res.status(500).json({
          success: false,
          message: cancelError.message || 'Failed to cancel shipment. Please try after sometime.',
          error: 'shipment_cancel_failed',
          details: cancelError.message
        });
      }

      // Clear label data after successful cancellation (with account_code filter for store isolation)
      await database.mysqlConnection.execute(
        'UPDATE labels SET awb = NULL, label_url = NULL, carrier_id = NULL, carrier_name = NULL, priority_carrier = NULL, is_manifest = 0, manifest_id = NULL, current_shipment_status = NULL WHERE order_id = ? AND account_code = ?',
        [order.order_id, accountCode]
      );
      logger.info('✅ LABEL DATA CLEARED (including manifest_id)');
    } else {
      logger.info('🔄 CASE 1: No label downloaded - simple reverse');
      // Even without label download, reset manifest fields if they exist (for Handover tab orders)
      // Use account_code filter if available for store isolation
      const accountCode = order.account_code;
      if (accountCode) {
        await database.mysqlConnection.execute(
          'UPDATE labels SET is_manifest = 0, manifest_id = NULL, current_shipment_status = NULL WHERE order_id = ? AND account_code = ?',
          [order.order_id, accountCode]
        );
      } else {
        await database.mysqlConnection.execute(
          'UPDATE labels SET is_manifest = 0, manifest_id = NULL, current_shipment_status = NULL WHERE order_id = ?',
          [order.order_id]
        );
      }
      logger.info('✅ MANIFEST FIELDS RESET (including manifest_id)');
    }

    // 4.4 — Atomic unclaim: WHERE claimed_by=? prevents overwriting a concurrent re-claim
    const unclaimed = await database.atomicUnclaimOrder(unique_id, vendor.warehouseId);
    if (!unclaimed) {
      logger.info('⚠️ atomicUnclaimOrder: affectedRows=0 — row concurrently modified');
      return res.status(409).json({ success: false, message: 'Order state changed concurrently — please refresh and try again' });
    }

    logger.info('✅ CLAIM DATA CLEARED');

    // Set is_in_new_order = 1 so unclaimed order appears in All Orders tab
    await database.mysqlConnection.execute(
      'UPDATE orders SET is_in_new_order = 1 WHERE unique_id = ?',
      [unique_id]
    );
    logger.info('✅ ORDER SET TO NEW ORDER STATUS');

    // Get updated order for response
    const updatedOrder = await database.getOrderByUniqueId(unique_id);

    const successMessage = isLabelDownloaded
      ? 'Shipment cancelled and order reversed successfully'
      : 'Order reversed successfully';

    logger.info('✅ REVERSE SUCCESS:', successMessage);

    return res.json({
      success: true,
      message: successMessage,
      data: {
        unique_id: unique_id,
        order_id: order.order_id,
        status: 'unclaimed',
        label_downloaded: false,
        reversed_at: new Date().toISOString(),
        case: isLabelDownloaded ? 'with_label_cancellation' : 'simple_reverse'
      }
    });

  } catch (error) {
    logger.error('❌ REVERSE ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reverse order',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/orders/reverse-grouped
 * @desc    Reverse a grouped order (multiple products with same order_id) - handles both cases with and without label download
 * @access  Vendor (token required)
 */
router.post('/reverse-grouped', async (req, res) => {
  const { order_id, unique_ids } = req.body;
  let token = req.headers['authorization'];

  // Handle case where token might be an object
  if (typeof token === 'object' && token !== null) {

    // Try to extract the actual token string
    if (token.token) {
      token = token.token;
    } else if (token.authorization) {
      token = token.authorization;
    } else if (Object.values(token).length === 1) {
      token = Object.values(token)[0];
    } else {
      token = null;
    }
  }

  logger.info('🔵 REVERSE GROUPED REQUEST START');

  if (!order_id) {
    logger.info('❌ REVERSE GROUPED FAILED: Missing order_id');
    return res.status(400).json({ success: false, message: 'order_id is required' });
  }

  // 5.1 + 5.2 — Batch size limit + type validation
  const arrayCheck = validateBulkArray(unique_ids, 'unique_ids');
  if (!arrayCheck.ok) {
    return res.status(400).json({ success: false, message: arrayCheck.message });
  }
  const sanitizedUniqueIds = arrayCheck.items;

  if (!token) {
    return res.status(400).json({ success: false, message: 'Authorization token required' });
  }

  try {
    // Load users from MySQL to get vendor info
    const database = require('../config/database');

    // Wait for MySQL initialization
    await database.waitForMySQLInitialization();

    if (!database.isMySQLAvailable()) {
      logger.info('❌ MySQL connection not available');
      return res.status(500).json({ success: false, message: 'Database connection not available' });
    }

    const vendor = req.user || await database.getUserByToken(token);

    if (!vendor || vendor.active_session !== 'TRUE') {
      logger.info('❌ VENDOR NOT FOUND OR INACTIVE ', vendor);
      return res.status(401).json({ success: false, message: 'Invalid or inactive vendor token' });
    }

    logger.info('✅ VENDOR FOUND:');

    // Verify all unique_ids belong to the same order_id and filter only those claimed by this vendor
    const orderChecks = await Promise.all(
      unique_ids.map(async (unique_id) => {
        const order = await database.getOrderByUniqueId(unique_id);
        if (!order) {
          return { unique_id, error: 'Order not found', valid: false };
        }
        if (order.order_id !== order_id) {
          return { unique_id, error: 'Order ID mismatch', valid: false };
        }
        if (order.claimed_by !== vendor.warehouseId) {
          return { unique_id, error: 'Not claimed by this vendor', valid: false, claimed_by: order.claimed_by };
        }
        return { unique_id, order, valid: true };
      })
    );

    // Separate valid and invalid orders
    const validOrders = orderChecks.filter(check => check.valid);
    const invalidOrders = orderChecks.filter(check => !check.valid);

    // Check if we have any valid orders to process
    if (validOrders.length === 0) {
      logger.info('❌ NO VALID ORDERS FOUND FOR THIS VENDOR');
      return res.status(400).json({
        success: false,
        message: 'No orders found that are claimed by you',
        errors: invalidOrders
      });
    }

    // Log any orders that belong to other vendors (for transparency)
    const otherVendorOrders = invalidOrders.filter(check => check.claimed_by && check.claimed_by !== vendor.warehouseId);
    if (otherVendorOrders.length > 0) {
      logger.info('ℹ️ ORDERS CLAIMED BY OTHER VENDORS (will be skipped):', otherVendorOrders.map(o => ({ unique_id: o.unique_id, claimed_by: o.claimed_by })));
    }

    // Get the first valid order to check label_downloaded status
    const firstValidOrder = validOrders[0]?.order;
    const validUniqueIds = validOrders.map(check => check.unique_id);

    logger.info('✅ VALID ORDERS IDENTIFIED');

    // Check label_downloaded status (all products in the group should have the same status)
    const isLabelDownloaded = firstValidOrder.label_downloaded === 1 || firstValidOrder.label_downloaded === true || firstValidOrder.label_downloaded === '1';

    if (isLabelDownloaded) {
      logger.info('🔄 CASE 2: Label downloaded - cancelling shipment before reverse (grouped)');

      // Get account_code from order to use correct store credentials
      const accountCode = firstValidOrder.account_code;
      if (!accountCode) {
        logger.info('❌ ACCOUNT_CODE NOT FOUND for order:', order_id);
        return res.status(400).json({
          success: false,
          message: 'Store information not found for this order. Cannot cancel shipment.'
        });
      }

      // Get AWB number from labels table (only one AWB for the entire order_id, with account_code filter)
      const label = await database.getLabelByOrderId(order_id, accountCode);

      if (!label || !label.awb) {
        logger.info('❌ AWB NOT FOUND for order:', order_id);
        return res.status(400).json({
          success: false,
          message: 'AWB number not found for this order. Cannot cancel shipment.'
        });
      }

      const awbValue = String(label.awb || '').trim();
      if (!awbValue) {
        logger.info('❌ AWB IS EMPTY OR NULL for order:', order_id);
        return res.status(400).json({
          success: false,
          message: 'AWB number is empty or invalid. Cannot cancel shipment.'
        });
      }

      logger.info('✅ AWB FOUND FOR GROUPED REVERSE:', awbValue);

      // Determine shipping partner for this store
      const storeInfo = await database.getStoreByAccountCode(accountCode);
      const shippingPartner = (storeInfo?.shipping_partner || '').toLowerCase();

      try {
        if (shippingPartner === 'shiprocket') {
          logger.info('🔄 Using Shiprocket cancel API for grouped order:', order_id);
          const ShiprocketService = require('../services/shiprocketService');
          const shiprocketService = new ShiprocketService(accountCode);
          const cancelResult = await shiprocketService.cancelShipmentsByAwbs([awbValue]);
          logger.info('✅ SHIPROCKET CANCEL SUCCESS (grouped):', JSON.stringify(cancelResult, null, 2));
        } else {
          logger.info('🔄 Using Shipway cancel API for grouped order:', order_id);
          const ShipwayService = require('../services/shipwayService');
          const shipwayService = new ShipwayService(accountCode);
          await shipwayService.initialize();
          const cancelResult = await shipwayService.cancelShipment([awbValue]);
          logger.info('✅ SHIPWAY CANCEL SUCCESS (grouped):', cancelResult);
        }
      } catch (cancelError) {
        logger.error('❌ SHIPMENT CANCEL FAILED (grouped):');
        logger.error('  - Error message:', cancelError.message);
        logger.error('  - Error stack:', cancelError.stack);
        logger.error('  - Account Code:', accountCode);
        logger.error('  - AWB:', awbValue);
        logger.error('  - Shipping Partner:', shippingPartner);
        return res.status(500).json({
          success: false,
          message: cancelError.message || 'Failed to cancel shipment. Please try after sometime.',
          error: 'shipment_cancel_failed',
          details: cancelError.message
        });
      }

      // Clear label data after successful cancellation (only once for the entire order, with account_code filter for store isolation)
      await database.mysqlConnection.execute(
        'UPDATE labels SET awb = NULL, label_url = NULL, carrier_id = NULL, carrier_name = NULL, priority_carrier = NULL, is_manifest = 0, manifest_id = NULL, current_shipment_status = NULL WHERE order_id = ? AND account_code = ?',
        [order_id, accountCode]
      );
      logger.info('✅ LABEL DATA CLEARED (including manifest_id) for grouped reverse');
    } else {
      logger.info('🔄 CASE 1: No label downloaded - simple reverse');
      // Even without label download, reset manifest fields if they exist (for Handover tab orders)
      // Use account_code filter if available for store isolation
      const accountCode = firstValidOrder.account_code;
      if (accountCode) {
        await database.mysqlConnection.execute(
          'UPDATE labels SET is_manifest = 0, manifest_id = NULL, current_shipment_status = NULL WHERE order_id = ? AND account_code = ?',
          [order_id, accountCode]
        );
      } else {
        await database.mysqlConnection.execute(
          'UPDATE labels SET is_manifest = 0, manifest_id = NULL, current_shipment_status = NULL WHERE order_id = ?',
          [order_id]
        );
      }
      logger.info('✅ MANIFEST FIELDS RESET (including manifest_id)');
    }

    // Clear claim information for ONLY the vendor's products
    logger.info('🔄 CLEARING CLAIM DATA FOR VENDOR\'S PRODUCTS');
    const clearResults = await Promise.all(
      validUniqueIds.map(async (unique_id) => {
        try {
          await database.mysqlConnection.execute(
            `UPDATE claims SET 
              claimed_by = NULL, 
              claimed_at = NULL, 
              last_claimed_by = NULL, 
              last_claimed_at = NULL, 
              status = 'unclaimed',
              label_downloaded = 0,
              priority_carrier = NULL
            WHERE order_unique_id = ?`,
            [unique_id]
          );
          return { unique_id, success: true };
        } catch (error) {
          logger.info('❌ FAILED TO CLEAR CLAIM DATA FOR:', unique_id, error.message);
          return { unique_id, success: false, error: error.message };
        }
      })
    );

    const failedClears = clearResults.filter(result => !result.success);
    if (failedClears.length > 0) {
      logger.info('⚠️ SOME CLAIM DATA CLEARING FAILED:', failedClears);
    }

    logger.info('✅ CLAIM DATA CLEARED FOR VENDOR\'S PRODUCTS');

    // Set is_in_new_order = 1 for all products in this order so unclaimed orders appear in All Orders tab
    await database.mysqlConnection.execute(
      'UPDATE orders SET is_in_new_order = 1 WHERE order_id = ?',
      [order_id]
    );
    logger.info('✅ ORDERS SET TO NEW ORDER STATUS');

    const successMessage = isLabelDownloaded
      ? `Shipment cancelled and ${validUniqueIds.length} products reversed successfully`
      : `${validUniqueIds.length} products reversed successfully`;

    logger.info('✅ REVERSE GROUPED SUCCESS:', successMessage);

    return res.json({
      success: true,
      message: successMessage,
      data: {
        order_id: order_id,
        unique_ids: validUniqueIds, // Only the vendor's products
        status: 'unclaimed',
        label_downloaded: false,
        reversed_at: new Date().toISOString(),
        case: isLabelDownloaded ? 'with_label_cancellation' : 'simple_reverse',
        products_processed: validUniqueIds.length,
        failed_clears: failedClears.length,
        skipped_products: otherVendorOrders.length, // Products claimed by other vendors
        total_requested: unique_ids.length
      }
    });

  } catch (error) {
    logger.error('❌ REVERSE GROUPED ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reverse grouped order',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/orders/auto-reverse-expired
 * @desc    Automatically reverse orders that have been claimed for 24+ hours without label download
 * @access  Admin/Superadmin only (or can be called by cron job)
 */
router.post('/auto-reverse-expired', authenticateBasicAuth, requireAdminOrSuperadmin, async (req, res) => {
  logger.info('🔄 AUTO-REVERSE EXPIRED ORDERS REQUEST START');

  try {
    const autoReversalService = require('../services/autoReversalService');
    const result = await autoReversalService.executeAutoReversal();

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(500).json(result);
    }

  } catch (error) {
    logger.error('❌ AUTO-REVERSE ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to auto-reverse expired orders',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/orders/auto-reverse-stats
 * @desc    Get auto-reversal service statistics
 * @access  Admin/Superadmin only
 */
router.get('/auto-reverse-stats', authenticateBasicAuth, requireAdminOrSuperadmin, async (req, res) => {
  try {
    const autoReversalService = require('../services/autoReversalService');
    const stats = autoReversalService.getStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('❌ GET AUTO-REVERSE STATS ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get auto-reversal statistics',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/orders/download-manifest-summary
 * @desc    Download manifest summary PDF for given manifest_id(s)
 * @access  Vendor (token required)
 */
router.post('/download-manifest-summary', async (req, res) => {
  const { manifest_ids, format = 'a4', async: runAsync = false } = req.body;
  const token = req.headers['authorization'];

  logger.info('🔵 DOWNLOAD MANIFEST SUMMARY REQUEST START');

  if (!manifest_ids || !token) {
    logger.info('❌ DOWNLOAD MANIFEST SUMMARY FAILED: Missing required fields');
    return res.status(400).json({
      success: false,
      message: 'manifest_ids and Authorization token required'
    });
  }

  // ── ASYNC MODE ─────────────────────────────────────────────────────────────
  if (runAsync) {
    const task = taskStore.createTask('manifest-summary', (token || '').substring(0, 20));
    const PORT = process.env.PORT || 5000;
    const savedBody = JSON.stringify({ manifest_ids, format, async: false });
    const savedToken = token;
    (async () => {
      try {
        const internalRes = await fetch(`http://localhost:${PORT}/api/orders/download-manifest-summary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': savedToken },
          body: savedBody
        });
        const contentType = internalRes.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const result = await internalRes.json();
          if (result.success) {
            taskStore.completeTask(task.id, result);
          } else {
            taskStore.failTask(task.id, result.message || 'Manifest summary failed');
          }
        } else {
          const buffer = await internalRes.buffer();
          taskStore.completeTask(task.id, {
            success: true,
            pdfBase64: buffer.toString('base64'),
            contentType: contentType || 'application/pdf'
          });
        }
      } catch (err) {
        taskStore.failTask(task.id, err.message);
      }
    })();
    return res.json({ success: true, taskId: task.id, async: true });
  }
  // ─────────────────────────────────────────────────────────────────────────

  try {
    // Load database and verify vendor
    const database = require('../config/database');
    await database.waitForMySQLInitialization();

    if (!database.isMySQLAvailable()) {
      logger.info('❌ MySQL connection not available');
      return res.status(500).json({ success: false, message: 'Database connection not available' });
    }

    const vendor = req.user || await database.getUserByToken(token);

    if (!vendor || vendor.active_session !== 'TRUE') {
      logger.info('❌ VENDOR NOT FOUND OR INACTIVE');
      return res.status(401).json({ success: false, message: 'Invalid or inactive vendor token' });
    }

    logger.info('✅ VENDOR FOUND:');

    // Get vendor address
    let vendorAddress = '';
    try {
      logger.info('🔍 Fetching address for warehouseId:', vendor.warehouseId);
      const [addressRows] = await database.mysqlConnection.execute(`
        SELECT address, pincode 
        FROM users 
        WHERE warehouseId = ?
      `, [vendor.warehouseId]);

      logger.info('📋 Address query results:', addressRows);

      if (addressRows.length > 0 && addressRows[0].address) {
        const addr = addressRows[0];
        const parts = [];
        if (addr.address) parts.push(addr.address);
        if (addr.pincode) parts.push(addr.pincode);
        vendorAddress = parts.join(', ');
        logger.info('✅ Vendor address constructed:', vendorAddress);
      } else {
        logger.info('⚠️ No address found or address is null/empty');
        if (addressRows.length > 0) {
        }
      }
    } catch (error) {
      logger.info('❌ Error fetching warehouse address:', error.message);
    }

    // Convert manifest_ids to array if single value
    const manifestIdsArray = Array.isArray(manifest_ids) ? manifest_ids : [manifest_ids];
    logger.info('📋 Processing manifest IDs:', manifestIdsArray);

    // Query database for manifest summary data grouped by account_code
    // Structure: { account_code: { store_name, logo_url, manifests: [...] } }
    const manifestDataByStore = {};

    for (const manifest_id of manifestIdsArray) {
      logger.info(`🔍 Querying data for manifest_id: ${manifest_id}`);

      // Query to get carrier summary for this manifest with account_code
      const [summaryRows] = await database.mysqlConnection.execute(`
        SELECT 
          l.carrier_name,
          o.payment_type,
          l.account_code,
          COUNT(DISTINCT l.order_id) as order_count,
          GROUP_CONCAT(DISTINCT l.order_id ORDER BY l.order_id SEPARATOR ', ') as order_ids
        FROM labels l
        JOIN orders o ON l.order_id = o.order_id AND l.account_code = o.account_code
        WHERE l.manifest_id = ?
        GROUP BY l.carrier_name, o.payment_type, l.account_code
        ORDER BY l.account_code, l.carrier_name, o.payment_type
      `, [manifest_id]);


      // Group by account_code
      for (const row of summaryRows) {
        const accountCode = row.account_code;
        if (!accountCode) {
          logger.info('⚠️ Skipping row with missing account_code');
          continue;
        }

        if (!manifestDataByStore[accountCode]) {
          // Fetch store information
          const store = await database.getStoreByAccountCode(accountCode);
          manifestDataByStore[accountCode] = {
            account_code: accountCode,
            store_name: store?.store_name || accountCode,
            logo_url: store?.logo_url || null,
            manifests: []
          };
        }

        // Find existing manifest entry or create new one
        let manifestEntry = manifestDataByStore[accountCode].manifests.find(m => m.manifest_id === manifest_id);
        if (!manifestEntry) {
          manifestEntry = {
            manifest_id: manifest_id,
            payment_type: row.payment_type,
            summary: []
          };
          manifestDataByStore[accountCode].manifests.push(manifestEntry);
        }

        // Add summary row
        manifestEntry.summary.push({
          carrier_name: row.carrier_name,
          payment_type: row.payment_type,
          order_count: row.order_count,
          order_ids: row.order_ids
        });
      }
    }

    if (Object.keys(manifestDataByStore).length === 0) {
      logger.info('❌ No data found for provided manifest IDs');
      return res.status(404).json({
        success: false,
        message: 'No orders found for the provided manifest IDs'
      });
    }

    logger.info('✅ Manifest data collected, grouped by store:', Object.keys(manifestDataByStore));

    // Fetch store logos
    const storeLogos = {};
    for (const [accountCode, storeData] of Object.entries(manifestDataByStore)) {
      if (storeData.logo_url) {
        try {
          const logoResponse = await fetch(storeData.logo_url);
          if (logoResponse.ok) {
            storeLogos[accountCode] = Buffer.from(await logoResponse.arrayBuffer());
            logger.info(`✅ Logo fetched for ${storeData.store_name}`);
          } else {
            logger.info(`⚠️ Could not fetch logo for ${storeData.store_name}: ${logoResponse.statusText}`);
            storeLogos[accountCode] = null;
          }
        } catch (error) {
          logger.info(`⚠️ Could not fetch logo for ${storeData.store_name}:`, error.message);
          storeLogos[accountCode] = null;
        }
      } else {
        storeLogos[accountCode] = null;
        logger.info(`ℹ️ No logo URL configured for ${storeData.store_name}`);
      }
    }

    // Generate PDF
    const PDFDocument = require('pdfkit');
    const isThermal = format === 'thermal';
    const pageSize = isThermal ? [288, 432] : 'A4';
    const pageMargin = isThermal ? 20 : 50;

    const doc = new PDFDocument({
      size: pageSize,
      // Use a smaller bottom margin for thermal to allow full manual control over paging
      margin: isThermal ? { top: 20, left: 20, right: 20, bottom: 5 } : pageMargin,
      info: {
        Title: 'Manifest Summary Report',
        Author: 'Clamio Vendor System'
      }
    });

    // Set response headers for PDF download
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `manifest-summary-${timestamp}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Pipe PDF to response
    doc.pipe(res);

    const leftMargin = pageMargin;

    // Generate separate PDF section for each store
    const storeKeys = Object.keys(manifestDataByStore);
    for (let storeIndex = 0; storeIndex < storeKeys.length; storeIndex++) {
      const accountCode = storeKeys[storeIndex];
      const storeData = manifestDataByStore[accountCode];
      const storeName = storeData.store_name;
      const logoBuffer = storeLogos[accountCode];

      // Get vendor warehouse ID (vendor_wh_id) for this store
      let vendorWarehouseId = vendor.warehouseId; // Fallback to claimio_wh_id if mapping not found
      try {
        const whMapping = await database.getWhMappingByClaimioWhIdAndAccountCode(vendor.warehouseId, accountCode);
        if (whMapping && whMapping.vendor_wh_id) {
          vendorWarehouseId = whMapping.vendor_wh_id;
          logger.info(`✅ Using vendor_wh_id (${vendorWarehouseId}) for ${storeName} instead of claimio_wh_id (${vendor.warehouseId})`);
        } else {
          logger.info(`⚠️ No warehouse mapping found for ${storeName}, using claimio_wh_id (${vendor.warehouseId})`);
        }
      } catch (error) {
        logger.info(`⚠️ Error fetching warehouse mapping for ${storeName}:`, error.message);
        logger.info(`   Using claimio_wh_id (${vendor.warehouseId}) as fallback`);
      }

      // Add new page for each store (except the first one)
      if (storeIndex > 0 && !isThermal) {
        doc.addPage();
      }

      if (!isThermal) {
        // A4 Layout: Existing logic
        // Top Section: Logo and Store Name (Left aligned)
        const topY = pageMargin;

        // Add logo at top left (if available)
        let logoWidth = 0;
        if (logoBuffer) {
          try {
            logoWidth = 55;
            const logoHeight = 55;
            doc.image(logoBuffer, leftMargin, topY, { width: logoWidth, height: logoHeight, fit: [logoWidth, logoHeight] });
            logger.info(`✅ Logo embedded for ${storeName}`);
          } catch (error) {
            logger.info(`⚠️ Could not embed logo for ${storeName}:`, error.message);
            logoWidth = 0; // Reset if embedding failed
          }
        } else {
          logger.info(`ℹ️ No logo for ${storeName} - keeping logo space blank`);
        }

        // Add store name next to logo (or at left margin if no logo)
        const storeNameX = logoWidth > 0 ? leftMargin + logoWidth + 10 : leftMargin;
        doc.fontSize(20).font('Helvetica-Bold').fillColor('#000000');
        doc.text(storeName, storeNameX, topY + 15);

        doc.y = topY + 50;

        // PDF Header - Underlined
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#000000');
        doc.text('Manifest Summary Report', leftMargin, doc.y, { underline: true });
        doc.y += 20;

        // Header information - Left aligned
        doc.fontSize(9).font('Helvetica');
        doc.text(`Generated On: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, leftMargin, doc.y);
        doc.y += 12;
        doc.text(`Warehouse ID: ${vendorWarehouseId}`, leftMargin, doc.y);
        doc.y += 12;
        if (vendorAddress) {
          doc.text(`Warehouse Address: ${vendorAddress}`, leftMargin, doc.y);
          doc.y += 12;
        }
        doc.y += 15;
      }

      // Helper function to calculate dynamic row height based on text
      function calculateRowHeight(text, maxWidth, fontSize) {
        const avgCharWidth = fontSize * 0.5; // Approximate character width
        const charsPerLine = Math.floor(maxWidth / avgCharWidth);
        const lines = Math.ceil(text.length / charsPerLine);
        const lineHeight = fontSize * 1.5;
        const minHeight = 30;
        return Math.max(minHeight, lines * lineHeight + 10);
      }

      // Calculate store total
      let storeTotal = 0;

      if (isThermal) {
        logger.info(`📄 [THERMAL] Processing store: ${storeName} with ${storeData.manifests.length} manifest(s)`);

        // Add new page for each store (except first store)
        if (storeIndex > 0) {
          doc.addPage({ size: [288, 432], margin: { top: 20, left: 20, right: 20, bottom: 5 } });
        }

        const leftMarginRef = 20;
        let currentY = doc.y;

        // Header: Logo and Store Name
        let logoWidth = 0;
        if (logoBuffer) {
          try {
            logoWidth = 40;
            const logoHeight = 40;
            doc.image(logoBuffer, leftMarginRef, currentY, { width: logoWidth, height: logoHeight, fit: [logoWidth, logoHeight] });
          } catch (error) {
            logger.info(`⚠️ Logo embed fail (Thermal):`, error.message);
            logoWidth = 0;
          }
        }

        const headerTextX = logoWidth > 0 ? leftMarginRef + logoWidth + 8 : leftMarginRef;
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000');
        doc.text(storeName, headerTextX, currentY + 5, { width: 248 - (headerTextX - leftMarginRef), height: 15, ellipsis: true });

        doc.fontSize(8).font('Helvetica').fillColor('#666666');
        doc.text('Manifest Summary Report', headerTextX, doc.y);

        currentY = Math.max(currentY + 45, doc.y + 10);
        doc.y = currentY;

        // Date and WH ID (above address) - formatted as requested
        const currentDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        doc.fontSize(7).font('Helvetica').fillColor('#333333');
        doc.text(`Generated On: ${currentDate} |`, leftMarginRef, currentY, { width: 248 });
        currentY += 10; // Move to next line
        doc.text(`WH ID: ${vendorWarehouseId}`, leftMarginRef, currentY, { width: 248 });
        currentY += 10; // Move to next line

        // Warehouse Address (below date/WH ID)
        if (vendorAddress) {
          doc.fontSize(7).font('Helvetica').fillColor('#333333');
          doc.text(`Address: ${vendorAddress}`, leftMarginRef, currentY, { width: 248 });
          currentY += 10; // Move to next line
        }

        // Add spacing after address before first manifest
        currentY += 15; // Increased spacing for better readability
        doc.y = currentY;

        // Sort manifests: Prepaid first, then COD
        const sortedManifests = [...storeData.manifests].sort((a, b) => {
          if (a.payment_type === 'P' && b.payment_type === 'C') return -1;
          if (a.payment_type === 'C' && b.payment_type === 'P') return 1;
          return 0;
        });

        // Process each manifest (Prepaid first, then COD)
        for (let i = 0; i < sortedManifests.length; i++) {
          const { manifest_id, payment_type, summary } = sortedManifests[i];
          const paymentTypeLabel = payment_type === 'C' ? 'COD' : 'Pre-Paid';

          // Calculate space needed for this table
          const manifestHeaderHeight = 12; // Header text + spacing
          const tableHeaderHeight = 15;
          let tableRowsHeight = 0;

          summary.forEach((row) => {
            const orderIdsText = row.order_ids || '';
            const rowHeight = calculateRowHeight(orderIdsText, 105 - 6, 7);
            tableRowsHeight += rowHeight;
          });

          const footerHeight = 20; // Space for "Total Orders" footer
          const tableTotalHeight = manifestHeaderHeight + tableHeaderHeight + tableRowsHeight + footerHeight;
          const pageHeight = 432;
          const bottomMargin = 5;
          const maxY = pageHeight - bottomMargin;

          // If this is the 2nd manifest and it won't fit, move to next page
          // Check if current position + table height would exceed page limits
          if (i > 0 && (currentY + tableTotalHeight > maxY - 10)) {
            doc.addPage({ size: [288, 432], margin: { top: 20, left: 20, right: 20, bottom: 5 } });
            currentY = 20;
          }

          // Add spacing before each manifest (except first one)
          if (i > 0) {
            currentY += 10;
          }

          // Simplified manifest header - single line with manifest ID
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
          const manifestHeaderText = `${paymentTypeLabel} Manifest (Manifest ID - ${manifest_id})`;
          doc.text(manifestHeaderText, leftMarginRef, currentY, { width: 248 });

          // Move Y position below header for table
          currentY += 12;
          doc.y = currentY;

          // Calculate dynamic column widths based on carrier name lengths
          // First, find the longest carrier name (after removing "Shipway")
          let maxCarrierNameLength = 0;
          summary.forEach((row) => {
            const cleanCarrierName = (row.carrier_name || 'Unknown').replace(/Shipway\s*/gi, '');
            const nameLength = cleanCarrierName.length;
            if (nameLength > maxCarrierNameLength) {
              maxCarrierNameLength = nameLength;
            }
          });

          // Calculate carrier column width dynamically (min 50, max 85) - reduced for more Order IDs space
          // Use character width approximation: ~4.5 points per character at font size 7
          const charWidth = 4.5;
          const carrierTextWidth = maxCarrierNameLength * charWidth;
          const carrierPadding = 8; // Left + right padding (reduced from 10)
          const dynamicCarrierWidth = Math.max(50, Math.min(85, carrierTextWidth + carrierPadding));

          // Adjust other columns to maintain total width of 248
          const fixedWidths = { orders: 25, signature: 45 }; // Reduced signature from 63 to 45
          const remainingWidth = 248 - dynamicCarrierWidth - fixedWidths.orders - fixedWidths.signature;
          const orderIdsWidth = Math.max(80, remainingWidth); // Gets extra width from signature reduction

          // Detailed Table for Thermal with dynamic column widths
          const colWidths = {
            carrier: dynamicCarrierWidth,
            orders: fixedWidths.orders,
            orderIds: orderIdsWidth,
            signature: fixedWidths.signature
          };
          doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000'); // Reduced from 8 to 7

          // Table Headers
          let headerX = leftMarginRef;
          doc.rect(headerX, currentY, colWidths.carrier, 15).stroke();
          doc.text('Carrier', headerX + 3, currentY + 4);
          headerX += colWidths.carrier;

          doc.rect(headerX, currentY, colWidths.orders, 15).stroke();
          doc.text('Qty', headerX + 3, currentY + 4);
          headerX += colWidths.orders;

          doc.rect(headerX, currentY, colWidths.orderIds, 15).stroke();
          doc.text('Order IDs', headerX + 3, currentY + 4);
          headerX += colWidths.orderIds;

          doc.rect(headerX, currentY, colWidths.signature, 15).stroke();
          doc.text('Sign', headerX + 3, currentY + 4);

          currentY += 15;
          let manifestTotal = 0;

          // Table Rows
          doc.font('Helvetica').fontSize(7); // Increased from 6 to 7
          summary.forEach((row, rowIndex) => {
            // Remove "Shipway" prefix but keep full carrier name
            const carrierName = (row.carrier_name || 'Unknown').replace(/Shipway\s*/gi, '');
            const orderIdsText = row.order_ids || '';
            const rowHeight = calculateRowHeight(orderIdsText, colWidths.orderIds - 6, 7); // Updated to match font size 7

            // Check if we need a new page (only if this is the last row of the last manifest)
            // Otherwise, we already checked before starting the table
            const isLastRowOfLastManifest = (i === sortedManifests.length - 1) && (rowIndex === summary.length - 1);
            const overflowThreshold = isLastRowOfLastManifest ? 360 : 380;

            if (currentY + rowHeight > overflowThreshold) {
              doc.addPage({ size: [288, 432], margin: { top: 20, left: 20, right: 20, bottom: 5 } });
              currentY = 20;

              // Redraw headers on new page
              doc.fontSize(7).font('Helvetica-Bold'); // Reduced from 8 to 7
              let hX = leftMarginRef;
              doc.rect(hX, currentY, colWidths.carrier, 15).stroke();
              doc.text('Carrier', hX + 3, currentY + 4);
              hX += colWidths.carrier;
              doc.rect(hX, currentY, colWidths.orders, 15).stroke();
              doc.text('Qty', hX + 3, currentY + 4);
              hX += colWidths.orders;
              doc.rect(hX, currentY, colWidths.orderIds, 15).stroke();
              doc.text('Order IDs', hX + 3, currentY + 4);
              hX += colWidths.orderIds;
              doc.rect(hX, currentY, colWidths.signature, 15).stroke();
              doc.text('Sign', hX + 3, currentY + 4);

              currentY += 15;
              doc.font('Helvetica').fontSize(7); // Increased from 6 to 7
            }

            let cellX = leftMarginRef;
            doc.rect(cellX, currentY, colWidths.carrier, rowHeight).stroke();
            doc.text(carrierName, cellX + 3, currentY + 5);
            cellX += colWidths.carrier;

            doc.rect(cellX, currentY, colWidths.orders, rowHeight).stroke();
            doc.text(row.order_count.toString(), cellX + 3, currentY + 5, { align: 'center', width: colWidths.orders - 6 });
            cellX += colWidths.orders;

            doc.rect(cellX, currentY, colWidths.orderIds, rowHeight).stroke();
            doc.text(orderIdsText, cellX + 3, currentY + 5, { width: colWidths.orderIds - 6 });
            cellX += colWidths.orderIds;

            doc.rect(cellX, currentY, colWidths.signature, rowHeight).stroke();

            currentY += rowHeight;
            manifestTotal += parseInt(row.order_count);
          });

          // Footer for this manifest
          doc.y = currentY + 8;
          doc.fontSize(8).font('Helvetica-Bold').text(`Total ${paymentTypeLabel} Orders: ${manifestTotal}`, { align: 'right' }); // Set to 8pt

          currentY = doc.y + 15; // Space before next manifest
          storeTotal += manifestTotal;
        }

        // Store total footer (only on last page)
        doc.y = currentY + 5;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
        doc.text(`${storeName} Total: ${storeTotal} Orders`, leftMarginRef, doc.y);
        continue;
      }

      // Process each manifest (COD and/or Prepaid) for this store (A4 format)
      for (let i = 0; i < storeData.manifests.length; i++) {
        const { manifest_id, payment_type, summary } = storeData.manifests[i];

        // Determine payment type label and icon
        const paymentTypeLabel = payment_type === 'C' ? 'COD' : 'Pre-Paid';
        const iconLetter = payment_type === 'C' ? 'C' : 'P';

        // Draw C/P icon box on the left (height matches text lines)
        const iconBoxWidth = 42;
        const iconBoxHeight = 35; // Height to match "COD MANIFEST" + "Manifest ID:" combined
        const iconBoxX = leftMargin;
        const iconBoxY = doc.y;

        // Icon box background
        doc.rect(iconBoxX, iconBoxY, iconBoxWidth, iconBoxHeight).stroke('#000000');

        // Icon letter (centered in box)
        doc.fontSize(22).font('Helvetica-Bold').fillColor('#000000');
        const iconText = iconLetter;
        const iconTextWidth = doc.widthOfString(iconText);
        const iconTextHeight = 22; // Approximate font height
        const iconTextX = iconBoxX + (iconBoxWidth - iconTextWidth) / 2;
        const iconTextY = iconBoxY + (iconBoxHeight - iconTextHeight) / 2 + 2;
        doc.text(iconText, iconTextX, iconTextY);

        // Manifest section header box next to icon box
        const manifestHeaderX = iconBoxX + iconBoxWidth;
        const manifestHeaderWidth = 440; // Width of the text box

        // Draw border box around manifest header text
        doc.rect(manifestHeaderX, iconBoxY, manifestHeaderWidth, iconBoxHeight).stroke('#000000');

        // Manifest section header text inside the box
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000');
        doc.text(`${paymentTypeLabel} MANIFEST`, manifestHeaderX + 15, iconBoxY + 5);
        doc.fontSize(9).font('Helvetica');
        doc.text(`Manifest ID: ${manifest_id}`, manifestHeaderX + 15, iconBoxY + 19);

        // Move Y position below the icon box
        doc.y = iconBoxY + iconBoxHeight + 15;

        // Table header
        const tableTop = doc.y;
        const colWidths = { carrier: 100, paymentType: 60, orders: 40, orderIds: 180, pickupDetails: 115 };
        const startX = leftMargin;
        const totalWidth = colWidths.carrier + colWidths.paymentType + colWidths.orders + colWidths.orderIds + colWidths.pickupDetails;

        // Draw table header with borders
        const headerHeight = 25;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');

        // Draw header cells with borders
        let headerX = startX;

        // Carrier column
        doc.rect(headerX, tableTop, colWidths.carrier, headerHeight).stroke();
        doc.text('Carrier', headerX + 5, tableTop + 8, { width: colWidths.carrier - 10, continued: false });
        headerX += colWidths.carrier;

        // Payment column
        doc.rect(headerX, tableTop, colWidths.paymentType, headerHeight).stroke();
        doc.text('Payment', headerX + 5, tableTop + 8, { width: colWidths.paymentType - 10, continued: false });
        headerX += colWidths.paymentType;

        // Count column
        doc.rect(headerX, tableTop, colWidths.orders, headerHeight).stroke();
        doc.text('Count', headerX + 5, tableTop + 8, { width: colWidths.orders - 10, continued: false });
        headerX += colWidths.orders;

        // Order IDs column
        doc.rect(headerX, tableTop, colWidths.orderIds, headerHeight).stroke();
        doc.text('Order IDs', headerX + 5, tableTop + 8, { width: colWidths.orderIds - 10, continued: false });
        headerX += colWidths.orderIds;

        // Signature column
        doc.rect(headerX, tableTop, colWidths.pickupDetails, headerHeight).stroke();
        doc.text('Signature', headerX + 5, tableTop + 8, { width: colWidths.pickupDetails - 10, continued: false });

        // Draw table rows with dynamic height
        let currentY = tableTop + headerHeight;
        doc.fillColor('black').font('Helvetica');
        let manifestTotal = 0;

        summary.forEach((row, index) => {
          const friendlyPaymentType = row.payment_type === 'C' ? 'COD' : 'Prepaid';
          const orderIdsText = row.order_ids || '';

          // Remove "Shipway" from carrier name
          const carrierName = (row.carrier_name || 'Unknown').replace(/Shipway\s*/gi, '');

          // Calculate dynamic row height based on order IDs length
          const rowHeight = calculateRowHeight(orderIdsText, colWidths.orderIds - 10, 8);

          // Draw row cells with borders
          let cellX = startX;

          // Carrier cell
          doc.rect(cellX, currentY, colWidths.carrier, rowHeight).stroke();
          doc.fontSize(8).text(carrierName, cellX + 5, currentY + 8, { width: colWidths.carrier - 10, continued: false });
          cellX += colWidths.carrier;

          // Payment cell
          doc.rect(cellX, currentY, colWidths.paymentType, rowHeight).stroke();
          doc.text(friendlyPaymentType, cellX + 5, currentY + 8, { width: colWidths.paymentType - 10, continued: false });
          cellX += colWidths.paymentType;

          // Count cell
          doc.rect(cellX, currentY, colWidths.orders, rowHeight).stroke();
          doc.text(row.order_count.toString(), cellX + 5, currentY + 8, { width: colWidths.orders - 10, align: 'center', continued: false });
          cellX += colWidths.orders;

          // Order IDs cell (with text wrapping)
          doc.rect(cellX, currentY, colWidths.orderIds, rowHeight).stroke();
          doc.text(orderIdsText, cellX + 5, currentY + 8, { width: colWidths.orderIds - 10, continued: false });
          cellX += colWidths.orderIds;

          // Signature cell (blank for manual signature)
          doc.rect(cellX, currentY, colWidths.pickupDetails, rowHeight).stroke();

          currentY += rowHeight;
          manifestTotal += parseInt(row.order_count);
        });

        // Manifest total row
        const totalRowHeight = 25;
        doc.rect(startX, currentY, totalWidth, totalRowHeight).stroke();
        doc.fillColor('black').font('Helvetica-Bold').fontSize(9);
        doc.text(`Total ${paymentTypeLabel} Orders`, startX + 5, currentY + 8, { continued: true });
        doc.text(` ${manifestTotal}`, { continued: false });

        storeTotal += manifestTotal;

        // Move Y position down after the table
        doc.y = currentY + totalRowHeight + 20;

        // Add spacing between manifests
        if (i < storeData.manifests.length - 1) {
          doc.y += 10;
        }
      }

      // Store total for this store
      doc.y += 10;
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000');
      doc.text(`${storeName} Total: ${storeTotal} Orders`, leftMargin, doc.y);
    }

    // Finalize PDF
    doc.end();

    logger.info('✅ PDF generated and sent successfully');

  } catch (error) {
    logger.error('❌ DOWNLOAD MANIFEST SUMMARY ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate manifest summary',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/orders/rto-inventory/process
 * @desc    Manually trigger RTO inventory processing (process delivered RTO orders)
 * @access  Admin/Superadmin only
 */
router.post('/rto-inventory/process', requireAdminOrSuperadmin, async (req, res) => {
  logger.info('🔵 RTO INVENTORY PROCESS REQUEST START');

  try {
    const rtoInventoryService = require('../services/rtoInventoryService');

    const result = await rtoInventoryService.processDeliveredRTOOrders();

    if (result.success) {
      logger.info('✅ RTO INVENTORY PROCESSING SUCCESS:', result);
      return res.json(result);
    } else {
      logger.info('⚠️ RTO INVENTORY PROCESSING SKIPPED:', result.message);
      return res.json(result);
    }

  } catch (error) {
    logger.error('❌ RTO INVENTORY PROCESS ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process RTO inventory',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/orders/rto-inventory
 * @desc    Get RTO inventory summary
 * @access  Admin/Superadmin only
 */
router.get('/rto-inventory', requireAdminOrSuperadmin, async (req, res) => {
  logger.info('🔵 GET RTO INVENTORY REQUEST');

  try {
    const rtoInventoryService = require('../services/rtoInventoryService');

    const inventory = await rtoInventoryService.getRTOInventory();

    logger.info(`✅ RTO INVENTORY FETCHED: ${inventory.length} records`);

    return res.json({
      success: true,
      data: inventory,
      count: inventory.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ GET RTO INVENTORY ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get RTO inventory',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/orders/rto-inventory/unprocessed
 * @desc    Get unprocessed RTO delivered orders (for monitoring/debugging)
 * @access  Admin/Superadmin only
 */
router.get('/rto-inventory/unprocessed', requireAdminOrSuperadmin, async (req, res) => {
  logger.info('🔵 GET UNPROCESSED RTO ORDERS REQUEST');

  try {
    const rtoInventoryService = require('../services/rtoInventoryService');

    const unprocessedOrders = await rtoInventoryService.getUnprocessedOrders();

    logger.info(`✅ UNPROCESSED RTO ORDERS FETCHED: ${unprocessedOrders.length} records`);

    return res.json({
      success: true,
      data: unprocessedOrders,
      count: unprocessedOrders.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ GET UNPROCESSED RTO ORDERS ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get unprocessed RTO orders',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/orders/rto-inventory/status
 * @desc    Get RTO inventory service status
 * @access  Admin/Superadmin only
 */
router.get('/rto-inventory/status', requireAdminOrSuperadmin, async (req, res) => {
  try {
    const rtoInventoryService = require('../services/rtoInventoryService');
    const status = rtoInventoryService.getStatus();

    return res.json({
      success: true,
      data: status
    });

  } catch (error) {
    logger.error('❌ GET RTO INVENTORY STATUS ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get RTO inventory status',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/orders/message-tracking
 * @desc    Record customer message tracking status
 * @access  Authenticated (requires basic auth)
 */
router.post('/message-tracking', async (req, res) => {
  try {
    const { order_id, account_code, message_status } = req.body;

    // Validation
    if (!order_id || !account_code || !message_status) {
      return res.status(400).json({
        success: false,
        message: 'order_id, account_code, and message_status are required'
      });
    }

    const database = require('../config/database');
    await database.waitForMySQLInitialization();

    if (!database.isMySQLAvailable()) {
      return res.status(500).json({
        success: false,
        message: 'Database connection not available'
      });
    }

    // Insert tracking record
    const result = await database.insertCustomerMessageTracking(
      order_id,
      account_code,
      message_status
    );

    logger.info(`✅ [Message Tracking] Recorded status "${message_status}" for order ${order_id} (${account_code})`);

    return res.json({
      success: true,
      message: 'Message tracking record created',
      data: result
    });

  } catch (error) {
    logger.error('❌ POST MESSAGE TRACKING ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to record message tracking',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/orders/trigger-webhook
 * @desc    Manual trigger for webhook (testing only)
 * @access  Admin/Superadmin only
 */
router.post('/trigger-webhook', requireAdminOrSuperadmin, async (req, res) => {
  try {
    const { order_ids } = req.body;

    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'order_ids array is required'
      });
    }

    const database = require('../config/database');
    await database.waitForMySQLInitialization();

    if (!database.isMySQLAvailable()) {
      return res.status(500).json({
        success: false,
        message: 'Database connection not available'
      });
    }

    // Get order details for the specified order_ids
    const placeholders = order_ids.map(() => '?').join(',');
    const [orders] = await database.mysqlConnection.execute(
      `SELECT l.order_id, l.account_code, l.current_shipment_status
       FROM labels l
       WHERE l.order_id IN (${placeholders})`,
      order_ids
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No orders found'
      });
    }

    // Create mock status changes for testing
    const statusChangedOrders = orders.map(order => ({
      order_id: order.order_id,
      account_code: order.account_code,
      new_status: order.current_shipment_status,
      old_status: 'Testing - Manual Trigger'
    }));

    // Trigger webhook
    const webhookService = require('../services/webhookService');
    const webhookResult = await webhookService.sendStatusUpdateWebhook(statusChangedOrders);

    logger.info(`✅ [Manual Webhook Trigger] Webhook triggered for ${orders.length} orders`);

    return res.json({
      success: true,
      message: 'Webhook triggered successfully',
      data: {
        orders: statusChangedOrders,
        webhookResult: webhookResult
      }
    });

  } catch (error) {
    logger.error('❌ TRIGGER WEBHOOK ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to trigger webhook',
      error: error.message
    });
  }
});

module.exports = router; 