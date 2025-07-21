const express = require('express');
const router = express.Router();
const shipwayController = require('../controllers/shipwayController');
const { authenticateToken, requireSuperadmin } = require('../middleware/auth');
const { validateWarehouseId } = require('../middleware/validation');

/**
 * Shipway API Routes
 * Handles warehouse validation and data fetching
 */

/**
 * @route   GET /api/shipway/warehouse/:warehouseId
 * @desc    Get warehouse details by warehouse ID
 * @access  Superadmin only
 */
router.get('/warehouse/:warehouseId', 
  authenticateToken, 
  requireSuperadmin, 
  validateWarehouseId, 
  shipwayController.getWarehouseById
);

/**
 * @route   GET /api/shipway/validate/:warehouseId
 * @desc    Validate warehouse ID format
 * @access  Superadmin only
 */
router.get('/validate/:warehouseId', 
  authenticateToken, 
  requireSuperadmin, 
  validateWarehouseId, 
  shipwayController.validateWarehouseId
);

/**
 * @route   GET /api/shipway/test-connection
 * @desc    Test Shipway API connectivity
 * @access  Superadmin only
 */
router.get('/test-connection', 
  authenticateToken, 
  requireSuperadmin, 
  shipwayController.testConnection
);

/**
 * @route   POST /api/shipway/validate-warehouse
 * @desc    Validate warehouse for user creation
 * @access  Superadmin only
 */
router.post('/validate-warehouse', 
  authenticateToken, 
  requireSuperadmin, 
  shipwayController.validateWarehouseForUser
);

/**
 * @route   POST /api/shipway/multiple-warehouses
 * @desc    Get multiple warehouses by IDs
 * @access  Superadmin only
 */
router.post('/multiple-warehouses', 
  authenticateToken, 
  requireSuperadmin, 
  shipwayController.getMultipleWarehouses
);

/**
 * @route   GET /api/shipway/stats
 * @desc    Get warehouse API statistics
 * @access  Superadmin only
 */
router.get('/stats', 
  authenticateToken, 
  requireSuperadmin, 
  shipwayController.getWarehouseStats
);

/**
 * @route   GET /api/shipway/verify-warehouse/:warehouseId
 * @desc    Verify a warehouse by ID and return address, city, pincode
 * @access  Superadmin only
 */
router.get('/verify-warehouse/:warehouseId', authenticateToken, requireSuperadmin, async (req, res) => {
  const { warehouseId } = req.params;
  try {
    const warehouseData = await require('../services/shipwayService').getWarehouseById(warehouseId);
    if (!warehouseData.success) {
      return res.status(404).json({ success: false, message: 'Warehouse not found' });
    }
    const details = require('../services/shipwayService').formatWarehouseData(warehouseData.data);
    res.json({
      success: true,
      data: {
        address: details.address,
        city: details.city,
        pincode: details.pincode,
        state: details.state,
        country: details.country
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router; 