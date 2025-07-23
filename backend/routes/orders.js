const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

/**
 * @route   GET /api/orders
 * @desc    Get all orders from orders.xlsx (middleware)
 * @access  Public (add auth as needed)
 */
router.get('/', (req, res) => {
  const ordersExcelPath = path.join(__dirname, '../data/orders.xlsx');
  if (!fs.existsSync(ordersExcelPath)) {
    return res.status(200).json({ success: true, orders: [] });
  }
  try {
    const workbook = XLSX.readFile(ordersExcelPath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const orders = XLSX.utils.sheet_to_json(worksheet);
    return res.status(200).json({ success: true, orders });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to read orders', error: err.message });
  }
});

module.exports = router; 