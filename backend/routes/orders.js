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
    return res.status(200).json({ success: true, data: { orders: [] } });
  }
  try {
    const workbook = XLSX.readFile(ordersExcelPath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const orders = XLSX.utils.sheet_to_json(worksheet);
    return res.status(200).json({ success: true, data: { orders } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to read orders', error: err.message });
  }
});

/**
 * @route   GET /api/orders/last-updated
 * @desc    Get the last modification time of orders.xlsx
 * @access  Public
 */
router.get('/last-updated', (req, res) => {
  const ordersExcelPath = path.join(__dirname, '../data/orders.xlsx');
  try {
    if (fs.existsSync(ordersExcelPath)) {
      const stats = fs.statSync(ordersExcelPath);
      return res.json({ 
        success: true, 
        data: {
          lastUpdated: stats.mtime.toISOString() 
        }
      });
    } else {
      return res.json({ 
        success: true, 
        data: {
          lastUpdated: null 
        }
      });
    }
  } catch (err) {
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to get last updated time', 
      error: err.message 
    });
  }
});

/**
 * @route   POST /api/orders/claim
 * @desc    Vendor claims an order row by unique_id
 * @access  Vendor (token required)
 */
router.post('/claim', (req, res) => {
  const { unique_id } = req.body;
  const token = req.headers['authorization'];
  
  console.log('🔵 CLAIM REQUEST START');
  console.log('  - unique_id:', unique_id);
  console.log('  - token received:', token ? 'YES' : 'NO');
  console.log('  - token value:', token ? token.substring(0, 8) + '...' : 'null');
  
  if (!unique_id || !token) {
    console.log('❌ CLAIM FAILED: Missing required fields');
    return res.status(400).json({ success: false, message: 'unique_id and Authorization token required' });
  }

  // Load users.xlsx
  const usersPath = path.join(__dirname, '../data/users.xlsx');
  console.log('📂 Loading users from:', usersPath);
  
  try {
    const usersWb = XLSX.readFile(usersPath);
    const usersWs = usersWb.Sheets[usersWb.SheetNames[0]];
    const users = XLSX.utils.sheet_to_json(usersWs, { defval: '' });
    
    console.log('👥 Users loaded:', users.length);
    console.log('🔍 Looking for token match...');
    
    const vendor = users.find(u => u.token === token && u.active_session === 'TRUE');
    
    if (!vendor) {
      console.log('❌ VENDOR NOT FOUND OR INACTIVE');
      console.log('  - Available tokens:', users.map(u => ({ token: u.token?.substring(0, 8) + '...', active: u.active_session, warehouseId: u.warehouseId })));
      return res.status(401).json({ success: false, message: 'Invalid or inactive vendor token' });
    }
    
    console.log('✅ VENDOR FOUND');
    console.log('  - warehouseId:', vendor.warehouseId);
    console.log('  - name:', vendor.name);
    console.log('  - active_session:', vendor.active_session);
    
    const warehouseId = vendor.warehouseId;

    // Load orders.xlsx
    const ordersPath = path.join(__dirname, '../data/orders.xlsx');
    console.log('📂 Loading orders from:', ordersPath);
    
    const ordersWb = XLSX.readFile(ordersPath);
    const ordersWs = ordersWb.Sheets[ordersWb.SheetNames[0]];
    const orders = XLSX.utils.sheet_to_json(ordersWs, { defval: '' });
    
    console.log('📦 Orders loaded:', orders.length);
    console.log('🔍 Looking for unique_id:', unique_id);
    
    const orderIdx = orders.findIndex(o => String(o.unique_id) === String(unique_id));
    
    if (orderIdx === -1) {
      console.log('❌ ORDER NOT FOUND');
      console.log('  - Available unique_ids (first 10):', orders.slice(0, 10).map(o => o.unique_id));
      return res.status(404).json({ success: false, message: 'Order row not found' });
    }
    
    const order = orders[orderIdx];
    console.log('✅ ORDER FOUND');
    console.log('  - order_id:', order.order_id);
    console.log('  - product_name:', order.product_name);
    console.log('  - current status:', order.status);
    console.log('  - current claimed_by:', order.claimed_by);
    
    if (order.status !== 'unclaimed') {
      console.log('❌ ORDER NOT UNCLAIMED');
      console.log('  - Current status:', order.status);
      return res.status(400).json({ success: false, message: 'Order row is not unclaimed' });
    }
    
    // Update order
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    console.log('🔄 UPDATING ORDER');
    console.log('  - Setting status to: claimed');
    console.log('  - Setting claimed_by to:', warehouseId);
    console.log('  - Setting timestamp to:', now);
    
    order.status = 'claimed';
    order.claimed_by = warehouseId;
    order.claimed_at = now;
    order.last_claimed_by = warehouseId;
    order.last_claimed_at = now;
    
    // Write back to worksheet
    console.log('💾 SAVING TO EXCEL');
    const header = XLSX.utils.sheet_to_json(ordersWs, { header: 1 })[0];
    const rowNum = orderIdx + 2; // +2 because sheet_to_json skips header and is 0-indexed
    
    console.log('  - Row number:', rowNum);
    console.log('  - Headers:', header);
    
    header.forEach((col, i) => {
      ordersWs[XLSX.utils.encode_cell({ r: rowNum - 1, c: i })] = { t: 's', v: order[col] || '' };
    });
    
    XLSX.writeFile(ordersWb, ordersPath);
    console.log('✅ EXCEL SAVED SUCCESSFULLY');
    
    console.log('🟢 CLAIM SUCCESS');
    console.log('  - Order claimed by:', warehouseId);
    console.log('  - Updated order:', { unique_id: order.unique_id, status: order.status, claimed_by: order.claimed_by });
    
    return res.json({ success: true, data: order });
    
  } catch (error) {
    console.log('💥 CLAIM ERROR:', error.message);
    console.log('📍 Stack trace:', error.stack);
    return res.status(500).json({ success: false, message: 'Internal server error: ' + error.message });
  }
});

/**
 * @route   POST /api/orders/bulk-claim
 * @desc    Vendor claims multiple orders by unique_ids
 * @access  Vendor (token required)
 */
router.post('/bulk-claim', (req, res) => {
  const { unique_ids } = req.body;
  const token = req.headers['authorization'];
  
  console.log('🔵 BULK CLAIM REQUEST START');
  console.log('  - unique_ids:', unique_ids);
  console.log('  - token received:', token ? 'YES' : 'NO');
  
  if (!unique_ids || !Array.isArray(unique_ids) || unique_ids.length === 0 || !token) {
    console.log('❌ BULK CLAIM FAILED: Missing required fields');
    return res.status(400).json({ 
      success: false, 
      message: 'unique_ids array and Authorization token required' 
    });
  }

  // Load users.xlsx
  const usersPath = path.join(__dirname, '../data/users.xlsx');
  console.log('📂 Loading users from:', usersPath);
  
  try {
    const usersWb = XLSX.readFile(usersPath);
    const usersWs = usersWb.Sheets[usersWb.SheetNames[0]];
    const users = XLSX.utils.sheet_to_json(usersWs, { defval: '' });
    
    const vendor = users.find(u => u.token === token && u.active_session === 'TRUE');
    
    if (!vendor) {
      console.log('❌ VENDOR NOT FOUND OR INACTIVE');
      return res.status(401).json({ success: false, message: 'Invalid or inactive vendor token' });
    }
    
    console.log('✅ VENDOR FOUND');
    console.log('  - warehouseId:', vendor.warehouseId);
    
    const warehouseId = vendor.warehouseId;

    // Load orders.xlsx
    const ordersPath = path.join(__dirname, '../data/orders.xlsx');
    console.log('📂 Loading orders from:', ordersPath);
    
    const ordersWb = XLSX.readFile(ordersPath);
    const ordersWs = ordersWb.Sheets[ordersWb.SheetNames[0]];
    const orders = XLSX.utils.sheet_to_json(ordersWs, { defval: '' });
    
    console.log('📦 Orders loaded:', orders.length);
    console.log('🔍 Processing bulk claim for', unique_ids.length, 'orders');
    
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const successfulClaims = [];
    const failedClaims = [];
    
    // Process each unique_id
    unique_ids.forEach(unique_id => {
      const orderIdx = orders.findIndex(o => String(o.unique_id) === String(unique_id));
      
      if (orderIdx === -1) {
        console.log('❌ ORDER NOT FOUND:', unique_id);
        failedClaims.push({ unique_id, reason: 'Order not found' });
        return;
      }
      
      const order = orders[orderIdx];
      
      if (order.status !== 'unclaimed') {
        console.log('❌ ORDER NOT UNCLAIMED:', unique_id, 'Status:', order.status);
        failedClaims.push({ unique_id, reason: 'Order is not unclaimed' });
        return;
      }
      
      // Update order
      console.log('🔄 CLAIMING ORDER:', unique_id);
      order.status = 'claimed';
      order.claimed_by = warehouseId;
      order.claimed_at = now;
      order.last_claimed_by = warehouseId;
      order.last_claimed_at = now;
      
      successfulClaims.push({ unique_id, order_id: order.order_id });
    });
    
    if (successfulClaims.length > 0) {
      // Write back to worksheet
      console.log('💾 SAVING TO EXCEL');
      const header = XLSX.utils.sheet_to_json(ordersWs, { header: 1 })[0];
      
      orders.forEach((order, idx) => {
        const rowNum = idx + 2; // +2 because sheet_to_json skips header and is 0-indexed
        header.forEach((col, i) => {
          ordersWs[XLSX.utils.encode_cell({ r: rowNum - 1, c: i })] = { t: 's', v: order[col] || '' };
        });
      });
      
      XLSX.writeFile(ordersWb, ordersPath);
      console.log('✅ EXCEL SAVED SUCCESSFULLY');
    }
    
    console.log('🟢 BULK CLAIM COMPLETE');
    console.log('  - Successful claims:', successfulClaims.length);
    console.log('  - Failed claims:', failedClaims.length);
    
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
    console.log('💥 BULK CLAIM ERROR:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error: ' + error.message });
  }
});

module.exports = router; 