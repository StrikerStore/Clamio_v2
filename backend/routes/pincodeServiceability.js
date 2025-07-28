const express = require('express');
const router = express.Router();
const pincodeServiceabilityService = require('../services/pincodeServiceabilityService');
const { authenticateBasicAuth } = require('../middleware/auth');

/**
 * @route   GET /api/pincode-serviceability/:pincode
 * @desc    Check carrier serviceability at a specific pincode
 * @access  Private
 */
router.get('/:pincode', authenticateBasicAuth, async (req, res) => {
  try {
    const { pincode } = req.params;
    
    if (!pincode) {
      return res.status(400).json({
        success: false,
        message: 'Pincode is required'
      });
    }

    const serviceableCarriers = await pincodeServiceabilityService.checkPincodeServiceability(pincode);
    
    res.json({
      success: true,
      pincode,
      count: serviceableCarriers.length,
      carriers: serviceableCarriers
    });

  } catch (error) {
    console.error('Error checking pincode serviceability:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking pincode serviceability',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/pincode-serviceability/process-orders
 * @desc    Process all orders and assign carriers based on pincode serviceability
 * @access  Private (Admin/Superadmin only)
 */
router.post('/process-orders', authenticateBasicAuth, async (req, res) => {
  try {
    // Check if user has admin privileges
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const result = await pincodeServiceabilityService.processOrdersAndAssignCarriers();

    if (result.success) {
      res.json({
        success: true,
        message: 'Orders processed successfully',
        totalOrders: result.totalOrders,
        processedCount: result.processedCount,
        errorCount: result.errorCount,
        outputFile: result.outputFile
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to process orders',
        error: result.error
      });
    }

  } catch (error) {
    console.error('Error processing orders:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing orders',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/pincode-serviceability/processed-orders
 * @desc    Get processed orders with assigned carriers
 * @access  Private
 */
router.get('/processed-orders', authenticateBasicAuth, async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const postOrdersPath = path.join(__dirname, '../data/post_shipway_orders.json');
    
    if (!fs.existsSync(postOrdersPath)) {
      return res.status(404).json({
        success: false,
        message: 'Processed orders file not found. Please process orders first.'
      });
    }

    const processedOrders = JSON.parse(fs.readFileSync(postOrdersPath, 'utf8'));

    res.json({
      success: true,
      count: processedOrders.length,
      data: processedOrders
    });

  } catch (error) {
    console.error('Error reading processed orders:', error);
    res.status(500).json({
      success: false,
      message: 'Error reading processed orders',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/pincode-serviceability/carrier-priorities
 * @desc    Get carrier priorities from Excel file
 * @access  Private
 */
router.get('/carrier-priorities', authenticateBasicAuth, async (req, res) => {
  try {
    const priorityMap = pincodeServiceabilityService.getCarrierPriorities();
    
    // Convert Map to object for JSON response
    const priorities = {};
    priorityMap.forEach((priority, carrierId) => {
      priorities[carrierId] = priority;
    });

    res.json({
      success: true,
      count: priorityMap.size,
      priorities
    });

  } catch (error) {
    console.error('Error reading carrier priorities:', error);
    res.status(500).json({
      success: false,
      message: 'Error reading carrier priorities',
      error: error.message
    });
  }
});

module.exports = router; 