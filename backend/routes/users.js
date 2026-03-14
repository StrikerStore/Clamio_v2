const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const database = require('../config/database');

const fs = require('fs');
const path = require('path');
const shipwayService = require('../services/shipwayService');
const { authenticateToken, requireSuperadmin, requireVendor, requireAdminOrSuperadmin } = require('../middleware/auth');
const { 
  validateUserRegistration, 
  validateUserUpdate, 
  validateUserId, 
  validatePagination, 
  validateSearch 
} = require('../middleware/validation');

/**
 * User Management Routes
 * Handles CRUD operations for users (admin/vendor)
 * 
 * PERMISSION STRUCTURE:
 * =====================
 * 
 * SUPERADMIN (Full Master Access):
 * - Can CREATE, UPDATE, DELETE both VENDORS and ADMINS
 * - Uses general routes: POST /users, PUT /users/:id, DELETE /users/:id
 * - Cannot delete other superadmin users (safeguard in controller)
 * 
 * ADMIN (Limited Access - if implemented):
 * - Can CREATE, UPDATE, DELETE VENDORS ONLY (not other admins or superadmins)
 * - Uses vendor-specific routes: POST /users/vendor, PUT /users/vendor/:id, DELETE /users/vendor/:id
 * 
 * VENDOR:
 * - Can only view their own information
 * - Uses: GET /users/vendor/address
 */

// Apply authentication and authorization to all routes
router.use(authenticateToken);

/**
 * @route   GET /api/users/vendor/address
 * @desc    Get the vendor's warehouse address (for vendor panel)
 * @access  Vendor only
 */
router.get('/vendor/address', requireVendor, userController.getVendorAddress);

// Apply superadmin authorization to all other routes
router.post('/vendor', requireAdminOrSuperadmin, (req, res, next) => {
  // Force role to vendor for admin-created users
  req.body.role = 'vendor';
  next();
}, validateUserRegistration, userController.createUser);

/**
 * @route   GET /api/users/vendors-stats
 * @desc    Get lightweight vendor statistics (counts only) for dashboard cards
 * @access  Admin/Superadmin
 */
router.get('/vendors-stats', requireAdminOrSuperadmin, async (req, res) => {
  console.log('📊 GET VENDOR STATS REQUEST START');
  
  try {
    // Get vendor counts from database (optimized - just COUNT queries)
    const stats = await database.getVendorStats();
    
    console.log('✅ VENDOR STATS SUCCESS:', stats);
    return res.json({ 
      success: true, 
      data: stats 
    });
  } catch (err) {
    console.error('❌ VENDOR STATS ERROR:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to get vendor statistics', 
      error: err.message 
    });
  }
});

/**
 * @route   GET /api/users/vendors-report
 * @desc    Get enriched vendor list with stats for admin panel
 * @access  Admin/Superadmin
 */
router.get('/vendors-report', requireAdminOrSuperadmin, async (req, res) => {
  try {
    const users = await database.getAllUsers();
    const vendors = users.filter(u => u.role === 'vendor');

    // 3.8 — Targeted aggregate query per vendor instead of getAllOrders() + JS reduce
    // Returns { claimed_by, total_orders, completed_orders, revenue } per vendor warehouse_id
    let vendorStats = new Map();
    try {
      const [statsRows] = await database.mysqlConnection.execute(
        `SELECT c.claimed_by,
                COUNT(*) as total_orders,
                SUM(CASE WHEN c.status IN ('delivered','ready_for_handover') THEN 1 ELSE 0 END) as completed_orders,
                SUM(COALESCE(o.order_total_split, 0)) as revenue
         FROM claims c
         JOIN orders o ON o.unique_id = c.order_unique_id
         WHERE c.claimed_by IS NOT NULL AND c.claimed_by != ''
         GROUP BY c.claimed_by`
      );
      statsRows.forEach(r => vendorStats.set(String(r.claimed_by), r));
    } catch (error) {
      console.log('Warning: Could not load vendor stats:', error.message);
    }

    const buildVendor = async (v) => {
      // Stats from pre-computed aggregate query
      const warehouseId = v.warehouseId || v.warehouse_id || v.warehouse || v.vendor_warehouse_id || v.warehouseid || '';
      const stats = warehouseId ? vendorStats.get(String(warehouseId)) : null;
      const totalOrders = parseInt(stats?.total_orders || 0);
      const completedOrders = parseInt(stats?.completed_orders || 0);
      const revenue = parseFloat(stats?.revenue || 0);

      // City from Shipway if not stored
      // Note: Warehouse lookup requires account_code for store isolation
      // If account_code is not available, skip warehouse lookup
      let city = v.city || v.vendor_city || '';
      const accountCode = req.query.account_code || req.body.account_code;
      if (!city && warehouseId && accountCode) {
        try {
          const ShipwayService = require('../services/shipwayService');
          const shipwayServiceInstance = new ShipwayService(accountCode);
          await shipwayServiceInstance.initialize();
          const wh = await shipwayServiceInstance.getWarehouseById(String(warehouseId));
          const formatted = shipwayServiceInstance.formatWarehouseData(wh.data || wh);
          city = formatted.city || '';
        } catch (e) {
          console.log(`⚠️ Could not fetch warehouse city for vendor ${v.id} (warehouse: ${warehouseId}, store: ${accountCode}):`, e.message);
          city = '';
        }
      } else if (!city && warehouseId && !accountCode) {
        console.log(`⚠️ Skipping warehouse lookup for vendor ${v.id}: account_code not provided`);
      }

      // Normalize status
      let status = v.status || '';
      if (!status) {
        if (v.active === 'TRUE' || v.active === true) status = 'active';
        else if (v.active === 'FALSE' || v.active === false) status = 'inactive';
        else if (v.active_session === 'TRUE') status = 'active';
      }
      if (!status) status = 'inactive';

      return {
        id: v.id,
        name: v.name,
        email: v.email,
        phone: v.phone || '',
        warehouseId,
        city,
        status,
        totalOrders,
        completedOrders,
        revenue: revenue.toFixed(2),
      };
    };

    const enriched = [];
    for (const v of vendors) {
      // Sequential to avoid hammering Shipway; can be optimized if needed
      /* eslint-disable no-await-in-loop */
      const item = await buildVendor(v);
      enriched.push(item);
      /* eslint-enable no-await-in-loop */
    }

    return res.json({ success: true, data: { vendors: enriched } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to build vendors report', error: err.message });
  }
});

// Admin or Superadmin can update vendor via vendor-specific route
router.put('/vendor/:id', requireAdminOrSuperadmin, validateUserId, async (req, res, next) => {
  try {
    const id = req.params.id;
    const user = await database.getUserById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.role !== 'vendor') {
      return res.status(403).json({ success: false, message: 'Only vendor updates allowed via this endpoint' });
    }
    // Prevent changing role via this endpoint
    if (req.body && req.body.role && req.body.role !== 'vendor') {
      return res.status(400).json({ success: false, message: 'Cannot change role via vendor endpoint' });
    }
    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}, validateUserUpdate, userController.updateUser);

// Admin or Superadmin can delete vendor via vendor-specific route
router.delete('/vendor/:id', requireAdminOrSuperadmin, validateUserId, async (req, res, next) => {
  try {
    const id = req.params.id;
    const user = await database.getUserById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.role !== 'vendor') {
      return res.status(403).json({ success: false, message: 'Only vendor deletion allowed via this endpoint' });
    }
    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}, userController.deleteUser);

// Apply superadmin authorization to the remaining admin-only user routes
router.use(requireSuperadmin);

/**
 * @route   POST /api/users
 * @desc    Create a new user (admin or vendor)
 * @access  Superadmin only
 */
router.post('/', validateUserRegistration, userController.createUser);

/**
 * @route   GET /api/users
 * @desc    Get all users with pagination and filtering
 * @access  Superadmin only
 */
router.get('/', validatePagination, validateSearch, userController.getAllUsers);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Superadmin only
 */
router.get('/:id', validateUserId, userController.getUserById);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user
 * @access  Superadmin only
 */
router.put('/:id', validateUserId, validateUserUpdate, userController.updateUser);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user
 * @access  Superadmin only
 */
router.delete('/:id', validateUserId, userController.deleteUser);

/**
 * @route   GET /api/users/role/:role
 * @desc    Get users by role (admin or vendor)
 * @access  Superadmin only
 */
router.get('/role/:role', userController.getUsersByRole);

/**
 * @route   GET /api/users/status/:status
 * @desc    Get users by status (active or inactive)
 * @access  Superadmin only
 */
router.get('/status/:status', userController.getUsersByStatus);

/**
 * @route   PATCH /api/users/:id/toggle-status
 * @desc    Toggle user status (active/inactive)
 * @access  Superadmin only
 */
router.patch('/:id/toggle-status', validateUserId, userController.toggleUserStatus);

module.exports = router; 