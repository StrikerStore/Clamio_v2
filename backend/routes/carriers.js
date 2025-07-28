const express = require('express');
const router = express.Router();
const carrierService = require('../services/carrierService');
const { authenticateBasicAuth } = require('../middleware/auth');

/**
 * @route   GET /api/carriers
 * @desc    Get all carriers from Excel file
 * @access  Private
 */
router.get('/', authenticateBasicAuth, async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const XLSX = require('xlsx');
    
    const carrierExcelPath = path.join(__dirname, '../data/logistic_carrier.xlsx');
    
    if (!fs.existsSync(carrierExcelPath)) {
      return res.status(404).json({
        success: false,
        message: 'Carrier data file not found. Please fetch carriers first.'
      });
    }

    const workbook = XLSX.readFile(carrierExcelPath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const carriers = XLSX.utils.sheet_to_json(worksheet);

    res.json({
      success: true,
      count: carriers.length,
      data: carriers
    });

  } catch (error) {
    console.error('Error reading carrier data:', error);
    res.status(500).json({
      success: false,
      message: 'Error reading carrier data',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/carriers/fetch
 * @desc    Fetch carriers from Shipway API and save to Excel
 * @access  Private (Admin/Superadmin only)
 */
router.post('/fetch', authenticateBasicAuth, async (req, res) => {
  try {
    // Check if user has admin privileges
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const result = await carrierService.fetchAndSaveCarriers();

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        count: result.count
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch carriers',
        error: result.error
      });
    }

  } catch (error) {
    console.error('Error fetching carriers:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching carriers',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/carriers/test-connection
 * @desc    Test connection to Shipway Carrier API
 * @access  Private
 */
router.get('/test-connection', authenticateBasicAuth, async (req, res) => {
  try {
    const result = await carrierService.testConnection();
    
    res.json({
      success: result.success,
      message: result.message || result.error
    });

  } catch (error) {
    console.error('Error testing carrier API connection:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing connection',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/carriers/:id
 * @desc    Get carrier by ID from Excel file
 * @access  Private
 */
router.get('/:id', authenticateBasicAuth, async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const XLSX = require('xlsx');
    
    const carrierExcelPath = path.join(__dirname, '../data/logistic_carrier.xlsx');
    
    if (!fs.existsSync(carrierExcelPath)) {
      return res.status(404).json({
        success: false,
        message: 'Carrier data file not found'
      });
    }

    const workbook = XLSX.readFile(carrierExcelPath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const carriers = XLSX.utils.sheet_to_json(worksheet);

    const carrier = carriers.find(c => 
      c.carrier_id == req.params.id || 
      c.carrier_code === req.params.id
    );

    if (!carrier) {
      return res.status(404).json({
        success: false,
        message: 'Carrier not found'
      });
    }

    res.json({
      success: true,
      data: carrier
    });

  } catch (error) {
    console.error('Error reading carrier data:', error);
    res.status(500).json({
      success: false,
      message: 'Error reading carrier data',
      error: error.message
    });
  }
});

module.exports = router; 