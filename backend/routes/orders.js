const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const { authenticateBasicAuth, requireAdminOrSuperadmin } = require('../middleware/auth');
const carrierServiceabilityService = require('../services/carrierServiceabilityService');

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
router.post('/claim', async (req, res) => {
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
    
    // Automatically assign priority carrier for claimed order
    try {
      console.log('🚚 ASSIGNING PRIORITY CARRIER...');
      const carrierResult = await carrierServiceabilityService.assignPriorityCarrierToOrderInMemory(order);
      order.priority_carrier = carrierResult.data.carrier_id;
      console.log(`✅ Carrier assigned: ${carrierResult.data.carrier_id} (${carrierResult.data.carrier_name})`);
    } catch (carrierError) {
      console.log(`⚠️ Carrier assignment failed: ${carrierError.message}`);
      order.priority_carrier = ''; // Leave empty if assignment fails
    }
    
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
router.post('/bulk-claim', async (req, res) => {
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
    for (const unique_id of unique_ids) {
      const orderIdx = orders.findIndex(o => String(o.unique_id) === String(unique_id));
      
      if (orderIdx === -1) {
        console.log('❌ ORDER NOT FOUND:', unique_id);
        failedClaims.push({ unique_id, reason: 'Order not found' });
        continue;
      }
      
      const order = orders[orderIdx];
      
      if (order.status !== 'unclaimed') {
        console.log('❌ ORDER NOT UNCLAIMED:', unique_id, 'Status:', order.status);
        failedClaims.push({ unique_id, reason: 'Order is not unclaimed' });
        continue;
      }
      
      // Update order
      console.log('🔄 CLAIMING ORDER:', unique_id);
      order.status = 'claimed';
      order.claimed_by = warehouseId;
      order.claimed_at = now;
      order.last_claimed_by = warehouseId;
      order.last_claimed_at = now;
      
      // Automatically assign priority carrier for claimed order
      try {
        console.log(`🚚 ASSIGNING PRIORITY CARRIER for order ${order.order_id}...`);
        const carrierResult = await carrierServiceabilityService.assignPriorityCarrierToOrderInMemory(order);
        order.priority_carrier = carrierResult.data.carrier_id;
        console.log(`✅ Carrier assigned: ${carrierResult.data.carrier_id} (${carrierResult.data.carrier_name})`);
      } catch (carrierError) {
        console.log(`⚠️ Carrier assignment failed for order ${order.order_id}: ${carrierError.message}`);
        order.priority_carrier = ''; // Leave empty if assignment fails
      }
      
      successfulClaims.push({ unique_id, order_id: order.order_id });
    }
    
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

/**
 * @route   GET /api/orders/grouped
 * @desc    Get vendor's claimed orders grouped by order_id
 * @access  Vendor (token required)
 */
router.get('/grouped', (req, res) => {
  const token = req.headers['authorization'];
  
  console.log('🔵 GROUPED ORDERS REQUEST START');
  console.log('  - token received:', token ? 'YES' : 'NO');
  
  if (!token) {
    console.log('❌ GROUPED ORDERS FAILED: Missing token');
    return res.status(400).json({ success: false, message: 'Authorization token required' });
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
    
    if (!fs.existsSync(ordersPath)) {
      return res.status(200).json({ success: true, data: { groupedOrders: [] } });
    }
    
    const ordersWb = XLSX.readFile(ordersPath);
    const ordersWs = ordersWb.Sheets[ordersWb.SheetNames[0]];
    const orders = XLSX.utils.sheet_to_json(ordersWs, { defval: '' });
    
    console.log('📦 Orders loaded:', orders.length);
    
    // Filter orders claimed by this vendor
    const vendorOrders = orders.filter(order => 
      order.claimed_by === warehouseId && 
      (order.status === 'claimed' || order.status === 'ready_for_handover')
    );
    
    console.log('🏪 Vendor orders found:', vendorOrders.length);
    
    // Group orders by order_id
    const groupedOrders = {};
    
    vendorOrders.forEach(order => {
      const orderId = order.order_id;
      
      if (!groupedOrders[orderId]) {
        groupedOrders[orderId] = {
          order_id: orderId,
          original_order_id: orderId.includes('_') ? orderId.split('_')[0] : orderId, // Extract original order ID
          status: order.status,
          order_date: order.order_date || order.created_at,
          customer_name: order.customer_name || order.customer,
          claimed_at: order.claimed_at,
          total_value: 0,
          total_products: 0,
          products: []
        };
      }
      
      // Add product to the group
      groupedOrders[orderId].products.push({
        unique_id: order.unique_id,
        product_name: order.product_name || order.product,
        product_code: order.product_code,
        value: order.value || order.price || 0,
        image: order.image || order.product_image,
        quantity: order.quantity || 1
      });
      
      // Update totals
      const productValue = parseFloat(order.value || order.price || 0);
      groupedOrders[orderId].total_value += productValue;
      groupedOrders[orderId].total_products += 1;
    });
    
    // Convert to array and sort by order_date
    const groupedOrdersArray = Object.values(groupedOrders).sort((a, b) => {
      const dateA = new Date(a.order_date || 0);
      const dateB = new Date(b.order_date || 0);
      return dateB - dateA; // Most recent first
    });
    
    console.log('📊 Grouped orders created:', groupedOrdersArray.length);
    console.log('🟢 GROUPED ORDERS SUCCESS');
    
    return res.json({ 
      success: true, 
      data: { 
        groupedOrders: groupedOrdersArray,
        totalOrders: groupedOrdersArray.length,
        totalProducts: vendorOrders.length
      }
    });
    
  } catch (error) {
    console.log('💥 GROUPED ORDERS ERROR:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error: ' + error.message });
  }
});

/**
 * @route   GET /api/orders/admin/all
 * @desc    Get all orders with vendor information for admin panel
 * @access  Admin/Superadmin only
 */
router.get('/admin/all', authenticateBasicAuth, requireAdminOrSuperadmin, (req, res) => {
  console.log('🔵 ADMIN ORDERS REQUEST START');
  
  try {
    // Load orders.xlsx
    const ordersPath = path.join(__dirname, '../data/orders.xlsx');
    console.log('📂 Loading orders from:', ordersPath);
    
    if (!fs.existsSync(ordersPath)) {
      return res.status(200).json({ success: true, data: { orders: [] } });
    }
    
    const ordersWb = XLSX.readFile(ordersPath);
    const ordersWs = ordersWb.Sheets[ordersWb.SheetNames[0]];
    const orders = XLSX.utils.sheet_to_json(ordersWs, { defval: '' });
    
    console.log('📦 Orders loaded:', orders.length);
    
    // Load users.xlsx to get vendor information
    const usersPath = path.join(__dirname, '../data/users.xlsx');
    console.log('📂 Loading users from:', usersPath);
    
    let vendors = [];
    if (fs.existsSync(usersPath)) {
      const usersWb = XLSX.readFile(usersPath);
      const usersWs = usersWb.Sheets[usersWb.SheetNames[0]];
      const users = XLSX.utils.sheet_to_json(usersWs, { defval: '' });
      vendors = users.filter(user => user.role === 'vendor');
      console.log('👥 Vendors loaded:', vendors.length);
    }
    
    // Create vendor lookup map
    const vendorMap = {};
    vendors.forEach(vendor => {
      vendorMap[vendor.warehouseId] = {
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        status: vendor.status || 'inactive',
      };
    });
    
    // Process orders and add vendor information
    const rowsNeedingFix = [];
    const processedOrders = orders.map((order, idx) => {
      const vendorInfo = order.claimed_by ? vendorMap[order.claimed_by] : null;
      const vendorIsActive = vendorInfo && String(vendorInfo.status).toLowerCase() === 'active';
      let status = order.status || 'unclaimed';
      let vendorName = vendorInfo ? vendorInfo.name : (order.claimed_by ? order.claimed_by : 'Unclaimed');

      // If order is claimed but vendor is missing or inactive, treat as unclaimed and queue a fix
      if ((order.claimed_by && !vendorIsActive) && status !== 'unclaimed') {
        status = 'unclaimed';
        vendorName = 'Unclaimed';
        rowsNeedingFix.push(idx);
      }

      return {
        unique_id: order.unique_id,
        order_id: order.order_id,
        customer_name: order.customer_name || order.customer || 'N/A',
        vendor_name: vendorName,
        product_name: order.product_name || order.product || 'N/A',
        status,
        value: order.value || order.price || order.selling_price || '0',
        priority: order.priority || 'medium',
        created_at: order.created_at || order.order_date || 'N/A',
        claimed_at: order.claimed_at || null,
        claimed_by: order.claimed_by || null,
        image: order.product_image || order.image || '/placeholder.svg'
      };
    });

    // Persist fixes back to Excel if necessary
    if (rowsNeedingFix.length > 0) {
      const header = XLSX.utils.sheet_to_json(ordersWs, { header: 1 })[0];
      rowsNeedingFix.forEach((idx) => {
        const o = orders[idx];
        o.status = 'unclaimed';
        o.claimed_by = '';
        o.claimed_at = '';
        const rowNum = idx + 2; // account for header
        header.forEach((col, i) => {
          ordersWs[XLSX.utils.encode_cell({ r: rowNum - 1, c: i })] = {
            t: 's',
            v: o[col] || ''
          };
        });
      });
      XLSX.writeFile(ordersWb, ordersPath);
      console.log(`🧹 Cleaned ${rowsNeedingFix.length} orders claimed by missing/inactive vendors`);
    }
    
    console.log('🟢 ADMIN ORDERS SUCCESS');
    console.log('  - Processed orders:', processedOrders.length);
    
    return res.status(200).json({ 
      success: true, 
      data: { 
        orders: processedOrders,
        totalOrders: processedOrders.length,
        claimedOrders: processedOrders.filter(o => o.status === 'claimed').length,
        unclaimedOrders: processedOrders.filter(o => o.status === 'unclaimed').length
      } 
    });
    
  } catch (error) {
    console.log('💥 ADMIN ORDERS ERROR:', error.message);
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
router.post('/admin/assign', authenticateBasicAuth, requireAdminOrSuperadmin, (req, res) => {
  const { unique_id, vendor_warehouse_id } = req.body;
  
  console.log('🔵 ADMIN ASSIGN ORDER REQUEST START');
  console.log('  - unique_id:', unique_id);
  console.log('  - vendor_warehouse_id:', vendor_warehouse_id);
  
  if (!unique_id || !vendor_warehouse_id) {
    return res.status(400).json({ 
      success: false, 
      message: 'unique_id and vendor_warehouse_id are required' 
    });
  }

  try {
    // Load users.xlsx to verify vendor exists
    const usersPath = path.join(__dirname, '../data/users.xlsx');
    const usersWb = XLSX.readFile(usersPath);
    const usersWs = usersWb.Sheets[usersWb.SheetNames[0]];
    const users = XLSX.utils.sheet_to_json(usersWs, { defval: '' });
    
    const vendor = users.find(u => u.warehouseId === vendor_warehouse_id && u.role === 'vendor');
    if (!vendor) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vendor not found or invalid warehouse ID' 
      });
    }
    
    console.log('✅ VENDOR FOUND:', vendor.name);

    // Load orders.xlsx
    const ordersPath = path.join(__dirname, '../data/orders.xlsx');
    const ordersWb = XLSX.readFile(ordersPath);
    const ordersWs = ordersWb.Sheets[ordersWb.SheetNames[0]];
    const orders = XLSX.utils.sheet_to_json(ordersWs, { defval: '' });
    
    const orderIdx = orders.findIndex(o => String(o.unique_id) === String(unique_id));
    
    if (orderIdx === -1) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }
    
    const order = orders[orderIdx];
    console.log('✅ ORDER FOUND:', order.order_id);
    
    // Update order assignment
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    order.status = 'claimed';
    order.claimed_by = vendor_warehouse_id;
    order.claimed_at = now;
    order.last_claimed_by = vendor_warehouse_id;
    order.last_claimed_at = now;
    
    // Write back to Excel
    const header = XLSX.utils.sheet_to_json(ordersWs, { header: 1 })[0];
    const rowNum = orderIdx + 2;
    
    header.forEach((col, i) => {
      ordersWs[XLSX.utils.encode_cell({ r: rowNum - 1, c: i })] = { 
        t: 's', 
        v: order[col] || '' 
      };
    });
    
    XLSX.writeFile(ordersWb, ordersPath);
    
    console.log('✅ ORDER ASSIGNED SUCCESSFULLY');
    console.log(`  - Order ${order.order_id} assigned to ${vendor.name} (${vendor_warehouse_id})`);
    
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
    console.error('💥 ADMIN ASSIGN ERROR:', error.message);
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
router.post('/admin/bulk-assign', authenticateBasicAuth, requireAdminOrSuperadmin, (req, res) => {
  const { unique_ids, vendor_warehouse_id } = req.body || {};

  console.log('🔵 ADMIN BULK ASSIGN REQUEST START');
  console.log('  - unique_ids count:', Array.isArray(unique_ids) ? unique_ids.length : 0);
  console.log('  - vendor_warehouse_id:', vendor_warehouse_id);

  if (!Array.isArray(unique_ids) || unique_ids.length === 0 || !vendor_warehouse_id) {
    return res.status(400).json({ success: false, message: 'unique_ids (array) and vendor_warehouse_id are required' });
  }

  try {
    // Load users.xlsx to verify vendor exists
    const usersPath = path.join(__dirname, '../data/users.xlsx');
    const usersWb = XLSX.readFile(usersPath);
    const usersWs = usersWb.Sheets[usersWb.SheetNames[0]];
    const users = XLSX.utils.sheet_to_json(usersWs, { defval: '' });
    const vendor = users.find(u => u.warehouseId === vendor_warehouse_id && u.role === 'vendor');
    if (!vendor) {
      return res.status(400).json({ success: false, message: 'Vendor not found or invalid warehouse ID' });
    }

    // Load orders.xlsx
    const ordersPath = path.join(__dirname, '../data/orders.xlsx');
    const ordersWb = XLSX.readFile(ordersPath);
    const ordersWs = ordersWb.Sheets[ordersWb.SheetNames[0]];
    const orders = XLSX.utils.sheet_to_json(ordersWs, { defval: '' });

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    let updatedCount = 0;
    unique_ids.forEach((uid) => {
      const idx = orders.findIndex(o => String(o.unique_id) === String(uid));
      if (idx !== -1) {
        const order = orders[idx];
        order.status = 'claimed';
        order.claimed_by = vendor_warehouse_id;
        order.claimed_at = now;
        order.last_claimed_by = vendor_warehouse_id;
        order.last_claimed_at = now;

        const header = XLSX.utils.sheet_to_json(ordersWs, { header: 1 })[0];
        const rowNum = idx + 2;
        header.forEach((col, i) => {
          ordersWs[XLSX.utils.encode_cell({ r: rowNum - 1, c: i })] = {
            t: 's',
            v: order[col] || ''
          };
        });
        updatedCount += 1;
      }
    });

    XLSX.writeFile(ordersWb, ordersPath);

    return res.json({
      success: true,
      message: `Assigned ${updatedCount} orders to ${vendor.name}`,
      data: { updated: updatedCount, vendor_warehouse_id }
    });
  } catch (error) {
    console.error('💥 ADMIN BULK ASSIGN ERROR:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error: ' + error.message });
  }
});

/**
 * @route   POST /api/orders/admin/bulk-unassign
 * @desc    Admin unassigns multiple orders
 * @access  Admin/Superadmin only
 */
router.post('/admin/bulk-unassign', authenticateBasicAuth, requireAdminOrSuperadmin, (req, res) => {
  const { unique_ids } = req.body || {};

  console.log('🔵 ADMIN BULK UNASSIGN REQUEST START');
  console.log('  - unique_ids count:', Array.isArray(unique_ids) ? unique_ids.length : 0);

  if (!Array.isArray(unique_ids) || unique_ids.length === 0) {
    return res.status(400).json({ success: false, message: 'unique_ids (array) is required' });
  }

  try {
    const ordersPath = path.join(__dirname, '../data/orders.xlsx');
    const ordersWb = XLSX.readFile(ordersPath);
    const ordersWs = ordersWb.Sheets[ordersWb.SheetNames[0]];
    const orders = XLSX.utils.sheet_to_json(ordersWs, { defval: '' });

    let updatedCount = 0;
    unique_ids.forEach((uid) => {
      const idx = orders.findIndex(o => String(o.unique_id) === String(uid));
      if (idx !== -1) {
        const order = orders[idx];
        if (order.status !== 'unclaimed') {
          order.status = 'unclaimed';
          order.claimed_by = '';
          order.claimed_at = '';
          const header = XLSX.utils.sheet_to_json(ordersWs, { header: 1 })[0];
          const rowNum = idx + 2;
          header.forEach((col, i) => {
            ordersWs[XLSX.utils.encode_cell({ r: rowNum - 1, c: i })] = {
              t: 's',
              v: order[col] || ''
            };
          });
          updatedCount += 1;
        }
      }
    });

    XLSX.writeFile(ordersWb, ordersPath);

    return res.json({ success: true, message: `Unassigned ${updatedCount} orders`, data: { updated: updatedCount } });
  } catch (error) {
    console.error('💥 ADMIN BULK UNASSIGN ERROR:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error: ' + error.message });
  }
});

/**
 * @route   POST /api/orders/admin/unassign
 * @desc    Admin unassigns an order from a vendor
 * @access  Admin/Superadmin only
 */
router.post('/admin/unassign', authenticateBasicAuth, requireAdminOrSuperadmin, (req, res) => {
  const { unique_id } = req.body;
  
  console.log('🔵 ADMIN UNASSIGN ORDER REQUEST START');
  console.log('  - unique_id:', unique_id);
  
  if (!unique_id) {
    return res.status(400).json({ 
      success: false, 
      message: 'unique_id is required' 
    });
  }

  try {
    // Load orders.xlsx
    const ordersPath = path.join(__dirname, '../data/orders.xlsx');
    const ordersWb = XLSX.readFile(ordersPath);
    const ordersWs = ordersWb.Sheets[ordersWb.SheetNames[0]];
    const orders = XLSX.utils.sheet_to_json(ordersWs, { defval: '' });
    
    const orderIdx = orders.findIndex(o => String(o.unique_id) === String(unique_id));
    
    if (orderIdx === -1) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }
    
    const order = orders[orderIdx];
    console.log('✅ ORDER FOUND:', order.order_id);
    
    if (order.status === 'unclaimed') {
      return res.status(400).json({ 
        success: false, 
        message: 'Order is already unclaimed' 
      });
    }
    
    const previousVendor = order.claimed_by;
    
    // Update order to unclaimed
    order.status = 'unclaimed';
    order.claimed_by = '';
    order.claimed_at = '';
    // Keep last_claimed_by and last_claimed_at for history
    
    // Write back to Excel
    const header = XLSX.utils.sheet_to_json(ordersWs, { header: 1 })[0];
    const rowNum = orderIdx + 2;
    
    header.forEach((col, i) => {
      ordersWs[XLSX.utils.encode_cell({ r: rowNum - 1, c: i })] = { 
        t: 's', 
        v: order[col] || '' 
      };
    });
    
    XLSX.writeFile(ordersWb, ordersPath);
    
    console.log('✅ ORDER UNASSIGNED SUCCESSFULLY');
    console.log(`  - Order ${order.order_id} unassigned from ${previousVendor}`);
    
    return res.json({ 
      success: true, 
      message: `Order ${order.order_id} unassigned successfully`,
      data: {
        order_id: order.order_id,
        previous_vendor: previousVendor,
        unassigned_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
      }
    });
    
  } catch (error) {
    console.error('💥 ADMIN UNASSIGN ERROR:', error.message);
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
router.get('/admin/vendors', authenticateBasicAuth, requireAdminOrSuperadmin, (req, res) => {
  console.log('🔵 ADMIN GET VENDORS REQUEST START');
  
  try {
    // Load users.xlsx to get all vendors
    const usersPath = path.join(__dirname, '../data/users.xlsx');
    
    if (!fs.existsSync(usersPath)) {
      return res.status(200).json({ success: true, data: { vendors: [] } });
    }
    
    const usersWb = XLSX.readFile(usersPath);
    const usersWs = usersWb.Sheets[usersWb.SheetNames[0]];
    const users = XLSX.utils.sheet_to_json(usersWs, { defval: '' });
    
    // Filter active vendors
    const vendors = users
      .filter(user => user.role === 'vendor' && user.status === 'active')
      .map(vendor => ({
        warehouse_id: vendor.warehouseId,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone
      }));
    
    console.log('✅ VENDORS LOADED:', vendors.length);
    
    return res.status(200).json({ 
      success: true, 
      data: { vendors }
    });
    
  } catch (error) {
    console.log('💥 ADMIN GET VENDORS ERROR:', error.message);
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
  console.log('🔵 PRIORITY CARRIER ASSIGNMENT REQUEST START');
  
  try {
    console.log('📡 Starting priority carrier assignment process for claimed orders...');
    
    // Start the assignment process
    const result = await carrierServiceabilityService.assignPriorityCarriersToOrders();
    
    console.log('✅ PRIORITY CARRIER ASSIGNMENT COMPLETED');
    console.log('📊 Results:', result);
    
    return res.status(200).json({
      success: true,
      message: 'Priority carriers assigned successfully to claimed orders',
      data: result
    });
    
  } catch (error) {
    console.error('💥 PRIORITY CARRIER ASSIGNMENT ERROR:', error.message);
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
  
  console.log('🔵 SINGLE ORDER PRIORITY CARRIER ASSIGNMENT REQUEST START');
  console.log('  - Order ID:', orderId);
  
  try {
    console.log('📡 Starting priority carrier assignment for single order...');
    
    // Start the assignment process for single order
    const result = await carrierServiceabilityService.assignPriorityCarrierToOrder(orderId);
    
    console.log('✅ SINGLE ORDER PRIORITY CARRIER ASSIGNMENT COMPLETED');
    console.log('📊 Results:', result);
    
    return res.status(200).json({
      success: true,
      message: 'Priority carrier assigned successfully to order',
      data: result
    });
    
  } catch (error) {
    console.error('💥 SINGLE ORDER PRIORITY CARRIER ASSIGNMENT ERROR:', error.message);
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
  console.log('🔵 PRIORITY CARRIER STATS REQUEST START');
  
  try {
    const stats = carrierServiceabilityService.getAssignmentStatistics();
    
    console.log('✅ PRIORITY CARRIER STATS RETRIEVED');
    
    return res.status(200).json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('💥 PRIORITY CARRIER STATS ERROR:', error.message);
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
  const { order_id } = req.body;
  const token = req.headers['authorization'];
  
  console.log('🔵 DOWNLOAD LABEL REQUEST START');
  console.log('  - order_id:', order_id);
  console.log('  - token received:', token ? 'YES' : 'NO');
  
  if (!order_id || !token) {
    console.log('❌ DOWNLOAD LABEL FAILED: Missing required fields');
    return res.status(400).json({ success: false, message: 'order_id and Authorization token required' });
  }

  try {
    // Load users.xlsx to get vendor info
    const usersPath = path.join(__dirname, '../data/users.xlsx');
    const usersWb = XLSX.readFile(usersPath);
    const usersWs = usersWb.Sheets[usersWb.SheetNames[0]];
    const users = XLSX.utils.sheet_to_json(usersWs, { defval: '' });
    
    console.log('🔍 DOWNLOAD LABEL DEBUG:');
    console.log('  - Token received:', token ? token.substring(0, 20) + '...' : 'null');
    console.log('  - Users loaded:', users.length);
    console.log('  - Available tokens:', users.map(u => ({ 
      email: u.email, 
      token: u.token ? u.token.substring(0, 20) + '...' : 'null',
      active: u.active_session,
      role: u.role
    })));
    
    const vendor = users.find(u => u.token === token && u.active_session === 'TRUE');
    
    if (!vendor) {
      console.log('❌ VENDOR NOT FOUND OR INACTIVE');
      console.log('  - Token comparison failed');
      console.log('  - Available tokens:', users.map(u => ({ 
        token: u.token ? u.token.substring(0, 20) + '...' : 'null',
        active: u.active_session,
        role: u.role
      })));
      return res.status(401).json({ success: false, message: 'Invalid or inactive vendor token' });
    }

    console.log('✅ VENDOR FOUND:');
    console.log('  - Email:', vendor.email);
    console.log('  - Warehouse ID:', vendor.warehouseId);
    console.log('  - Role:', vendor.role);
    console.log('  - Active session:', vendor.active_session);

    // Load orders.xlsx
    const ordersPath = path.join(__dirname, '../data/orders.xlsx');
    const ordersWb = XLSX.readFile(ordersPath);
    const ordersWs = ordersWb.Sheets[ordersWb.SheetNames[0]];
    const orders = XLSX.utils.sheet_to_json(ordersWs, { defval: '' });

    // Check if this is already a clone order
    const isCloneOrder = order_id.includes('_');
    console.log('🔍 Order ID Analysis:');
    console.log('  - Order ID requested:', order_id);
    console.log('  - Is clone order:', isCloneOrder);
    
    // Get all products for this order_id
    const orderProducts = orders.filter(order => order.order_id === order_id);
    const claimedProducts = orderProducts.filter(order => 
      order.claimed_by === vendor.warehouseId && order.status === 'claimed'
    );

    console.log('📊 Order Analysis:');
    console.log('  - Vendor warehouse ID:', vendor.warehouseId);
    console.log('  - Total products in order:', orderProducts.length);
    console.log('  - Products claimed by vendor:', claimedProducts.length);
    
    // Debug: Show all products for this order
    console.log('🔍 All products for order:', order_id);
    orderProducts.forEach((product, index) => {
      console.log(`  ${index + 1}. Product: ${product.product_name}`);
      console.log(`     - Status: ${product.status}`);
      console.log(`     - Claimed by: ${product.claimed_by}`);
      console.log(`     - Vendor warehouse ID: ${vendor.warehouseId}`);
      console.log(`     - Match: ${product.claimed_by === vendor.warehouseId && product.status === 'claimed' ? 'YES' : 'NO'}`);
    });

    // Check condition
    if (isCloneOrder) {
      // Condition 3: Already a clone order - direct download
      console.log('✅ CONDITION 3: Already a clone order - direct download');
      
      if (claimedProducts.length === 0) {
        console.log('❌ No products claimed by this vendor for clone order:', order_id);
        return res.status(400).json({ 
          success: false, 
          message: 'No products claimed by this vendor for this clone order' 
        });
      }
      
      const labelResponse = await generateLabelForOrder(order_id, claimedProducts, vendor);
      return res.json(labelResponse);
      
    } else if (orderProducts.length === claimedProducts.length) {
      // Condition 1: Direct download - all products claimed by vendor
      console.log('✅ CONDITION 1: Direct download - all products claimed by vendor');
      
      const labelResponse = await generateLabelForOrder(order_id, claimedProducts, vendor);
      return res.json(labelResponse);
      
    } else if (claimedProducts.length > 0) {
      // Condition 2: Clone required - some products claimed by vendor
      console.log('🔄 CONDITION 2: Clone required - some products claimed by vendor');
      
      const cloneResponse = await handleOrderCloning(order_id, claimedProducts, orderProducts, vendor);
      return res.json(cloneResponse);
      
    } else {
      // No products claimed by this vendor
      console.log('❌ No products claimed by this vendor for order:', order_id);
      return res.status(400).json({ 
        success: false, 
        message: 'No products claimed by this vendor for this order' 
      });
    }

  } catch (error) {
    console.error('❌ DOWNLOAD LABEL ERROR:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to download label', 
      error: error.message 
    });
  }
});

/**
 * Generate label for an order (Condition 1: Direct download)
 */
async function generateLabelForOrder(orderId, products, vendor) {
  try {
    console.log('🔄 Generating label for order:', orderId);
    
    // Extract original order ID if this is a clone
    const originalOrderId = orderId.includes('_') ? orderId.split('_')[0] : orderId;
    console.log('  - Original order ID for contact info:', originalOrderId);
    
    // Load raw shipway orders for contact info
    const rawOrdersPath = path.join(__dirname, '../data/raw_shipway_orders.json');
    const rawOrdersData = JSON.parse(fs.readFileSync(rawOrdersPath, 'utf8'));
    const originalOrder = rawOrdersData.message.find(order => order.order_id === originalOrderId);
    
    if (!originalOrder) {
      throw new Error(`Original order not found in raw_shipway_orders.json for order ID: ${originalOrderId}`);
    }

    // Prepare request body for PUSH Order with Label Generation API
    const requestBody = prepareShipwayRequestBody(orderId, products, originalOrder, vendor, true); // true for label generation
    
    // Call Shipway API
    const response = await callShipwayPushOrderAPI(requestBody, true); // true for label generation
    
    console.log('✅ Label generated successfully');
    return {
      success: true,
      message: 'Label generated successfully',
      data: {
        shipping_url: response.awb_response.shipping_url,
        awb: response.awb_response.AWB,
        order_id: orderId
      }
    };
    
  } catch (error) {
    console.error('❌ Label generation failed:', error);
    throw error;
  }
}

/**
 * Handle order cloning (Condition 2: Clone required)
 */
async function handleOrderCloning(originalOrderId, claimedProducts, allOrderProducts, vendor) {
  try {
    console.log('🔄 Starting order cloning process');
    
    // Update orders.xlsx - change order_id for claimed products
    const ordersPath = path.join(__dirname, '../data/orders.xlsx');
    const ordersWb = XLSX.readFile(ordersPath);
    const ordersWs = ordersWb.Sheets[ordersWb.SheetNames[0]];
    const orders = XLSX.utils.sheet_to_json(ordersWs, { defval: '' });
    
    // Generate new clone order ID with simple increment
    let cloneOrderId = `${originalOrderId}_1`;
    let counter = 1;
    
    // Check if this clone already exists and increment counter
    while (orders.some(order => order.order_id === cloneOrderId)) {
      counter++;
      cloneOrderId = `${originalOrderId}_${counter}`;
    }
    
    console.log('  - Clone order ID:', cloneOrderId);
    
    // Load raw shipway orders for contact info
    const rawOrdersPath = path.join(__dirname, '../data/raw_shipway_orders.json');
    const rawOrdersData = JSON.parse(fs.readFileSync(rawOrdersPath, 'utf8'));
    const originalOrder = rawOrdersData.message.find(order => order.order_id === originalOrderId);
    
    if (!originalOrder) {
      throw new Error('Original order not found in raw_shipway_orders.json');
    }
    
    // Step 1: Create clone order with label generation FIRST
    console.log('🔄 Step 1: Creating clone order with label generation');
    const cloneRequestBody = prepareShipwayRequestBody(cloneOrderId, claimedProducts, originalOrder, vendor, true); // true for label generation
    const cloneResponse = await callShipwayPushOrderAPI(cloneRequestBody, true); // true for label generation
    
    // Verify clone was created successfully
    if (!cloneResponse.success) {
      throw new Error(`Failed to create clone order: ${cloneResponse.message || 'Unknown error'}`);
    }
    
    console.log('✅ Clone order created successfully in Shipway');
    console.log('  - Clone Order ID:', cloneOrderId);
    console.log('  - Shipway Response:', cloneResponse.message);
    
    // Step 2: Update original order (remove claimed products) ONLY AFTER clone is confirmed
    console.log('🔄 Step 2: Updating original order (removing claimed products) - AFTER clone confirmation');
    const remainingProducts = allOrderProducts.filter(order => 
      !(order.claimed_by === vendor.warehouseId && order.status === 'claimed')
    );
    
    if (remainingProducts.length > 0) {
      console.log('  - Updating original order with remaining products:', remainingProducts.length);
      const originalRequestBody = prepareShipwayRequestBody(originalOrderId, remainingProducts, originalOrder, vendor, false); // false for no label generation
      const originalResponse = await callShipwayPushOrderAPI(originalRequestBody, false); // false for no label generation
      
      if (!originalResponse.success) {
        console.log('⚠️ Warning: Failed to update original order, but clone was created successfully');
        console.log('  - Original order update error:', originalResponse.message);
      } else {
        console.log('✅ Original order updated successfully in Shipway');
      }
    } else {
      console.log('⚠️ No remaining products in original order - all products claimed');
      console.log('  - Original order will be empty after clone creation');
    }
    
    // Step 3: Sync data with Shipway
    console.log('🔄 Step 3: Syncing data with Shipway');
    await syncOrdersFromShipway();
    
    // Step 4: Update local database AFTER successful Shipway operations
    console.log('🔄 Step 4: Updating local database with clone order ID');
    const updatedOrders = orders.map(order => {
      if (order.order_id === originalOrderId && 
          order.claimed_by === vendor.warehouseId && 
          order.status === 'claimed') {
        return { ...order, order_id: cloneOrderId };
      }
      return order;
    });
    
    // Write updated orders back to Excel
    const updatedWs = XLSX.utils.json_to_sheet(updatedOrders);
    ordersWb.Sheets[ordersWb.SheetNames[0]] = updatedWs;
    XLSX.writeFile(ordersWb, ordersPath);
    console.log('✅ Updated orders.xlsx with clone order ID');
    
    console.log('✅ Order cloning completed successfully');
    return {
      success: true,
      message: 'Order cloned and label generated successfully',
      data: {
        shipping_url: cloneResponse.awb_response.shipping_url,
        awb: cloneResponse.awb_response.AWB,
        original_order_id: originalOrderId,
        clone_order_id: cloneOrderId
      }
    };
    
  } catch (error) {
    console.error('❌ Order cloning failed:', error);
    throw error;
  }
}

/**
 * Prepare request body for Shipway API
 */
function prepareShipwayRequestBody(orderId, products, originalOrder, vendor, generateLabel = false) {
  // Get payment type from the first product (all products in an order should have same payment_type)
  const paymentType = products[0]?.payment_type || 'P';
  console.log('🔍 Payment type from orders.xlsx:', paymentType);
  
  const orderTotal = products.reduce((sum, product) => {
    if (paymentType === 'C') {
      return sum + (parseFloat(product.collectable_amount) || 0);
    } else {
      return sum + (parseFloat(product.order_total_split) || 0);
    }
  }, 0);
  
  // Calculate order weight
  const orderWeight = 350 * products.length;
  
  // Prepare products array
  const shipwayProducts = products.map(product => ({
    product: product.product_name,
    price: product.selling_price,
    product_code: product.product_code,
    product_quantity: "1",
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
    store_code: "1",
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
    billing_phone: `+91${originalOrder.b_phone}`,
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
    shipping_phone: `+91${originalOrder.s_phone}`,
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
    console.log('🔄 Adding label generation parameters (carrier_id, warehouse_id, return_warehouse_id)');
    baseRequestBody.carrier_id = parseInt(products[0].priority_carrier) || 80165;
    baseRequestBody.warehouse_id = vendor.warehouseId;
    baseRequestBody.return_warehouse_id = '67311'; // Try 67311 first, fallback to vendor's warehouse if needed
    baseRequestBody.generate_label = true;
  } else {
    console.log('🔄 Using PUSH Order API (no carrier/warehouse parameters)');
  }
  
  return baseRequestBody;
}

/**
 * Call Shipway PUSH Order API
 */
async function callShipwayPushOrderAPI(requestBody, generateLabel = false) {
  try {
    console.log('🔄 Calling Shipway PUSH Order API');
    console.log('  - Generate label:', generateLabel);
    console.log('  - Order ID:', requestBody.order_id);
    console.log('  - API Type:', generateLabel ? 'PUSH Order with Label Generation' : 'PUSH Order (Edit Only)');
    
    // Get basic auth credentials from environment
    const username = process.env.SHIPWAY_USERNAME;
    const password = process.env.SHIPWAY_PASSWORD;
    const basicAuthHeader = process.env.SHIPWAY_BASIC_AUTH_HEADER;
    
    console.log('🔍 Debug: Environment variables check');
    console.log('  - SHIPWAY_USERNAME:', username ? 'SET' : 'NOT SET');
    console.log('  - SHIPWAY_PASSWORD:', password ? 'SET' : 'NOT SET');
    console.log('  - SHIPWAY_BASIC_AUTH_HEADER:', basicAuthHeader ? 'SET' : 'NOT SET');
    
    let authHeader;
    if (basicAuthHeader) {
      authHeader = basicAuthHeader;
      console.log('✅ Using SHIPWAY_BASIC_AUTH_HEADER');
    } else if (username && password) {
      authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
      console.log('✅ Using SHIPWAY_USERNAME and SHIPWAY_PASSWORD');
    } else {
      console.log('❌ No Shipway credentials found');
      throw new Error('Shipway credentials not configured');
    }
    
    // For original order editing (no label generation), remove generate_label parameter
    let apiRequestBody = { ...requestBody };
    if (!generateLabel) {
      console.log('🔄 Removing generate_label parameter for order edit');
      delete apiRequestBody.generate_label;
    }
    
    const response = await fetch('https://app.shipway.com/api/v2orders', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(apiRequestBody)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Shipway API error: ${data.message || response.statusText}`);
    }
    
    console.log('✅ Shipway API call successful');
    return data;
    
  } catch (error) {
    console.error('❌ Shipway API call failed:', error);
    throw error;
  }
}

/**
 * Sync orders from Shipway
 */
async function syncOrdersFromShipway() {
  try {
    console.log('🔄 Syncing orders from Shipway');
    
    // Import the shipway service (it's already an instance)
    const shipwayService = require('../services/shipwayService');
    
    // Call the sync method
    await shipwayService.syncOrdersToExcel();
    
    console.log('✅ Orders synced successfully');
    
  } catch (error) {
    console.error('❌ Order sync failed:', error);
    throw error;
  }
}

/**
 * @route   POST /api/orders/bulk-download-labels
 * @desc    Download labels for multiple orders and merge into single PDF
 * @access  Vendor (token required)
 */
router.post('/bulk-download-labels', async (req, res) => {
  const { order_ids } = req.body;
  const token = req.headers['authorization'];
  
  console.log('🔵 BULK DOWNLOAD LABELS REQUEST START');
  console.log('  - order_ids:', order_ids);
  console.log('  - token received:', token ? 'YES' : 'NO');
  
  if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0 || !token) {
    console.log('❌ BULK DOWNLOAD LABELS FAILED: Missing required fields');
    return res.status(400).json({ 
      success: false, 
      message: 'order_ids array and Authorization token required' 
    });
  }

  try {
    // Load users.xlsx to get vendor info
    const usersPath = path.join(__dirname, '../data/users.xlsx');
    const usersWb = XLSX.readFile(usersPath);
    const usersWs = usersWb.Sheets[usersWb.SheetNames[0]];
    const users = XLSX.utils.sheet_to_json(usersWs, { defval: '' });
    
    const vendor = users.find(u => u.token === token && u.active_session === 'TRUE');
    
    if (!vendor) {
      console.log('❌ VENDOR NOT FOUND OR INACTIVE');
      return res.status(401).json({ success: false, message: 'Invalid or inactive vendor token' });
    }

    console.log('✅ VENDOR FOUND:');
    console.log('  - Email:', vendor.email);
    console.log('  - Warehouse ID:', vendor.warehouseId);

    // Load orders.xlsx
    const ordersPath = path.join(__dirname, '../data/orders.xlsx');
    const ordersWb = XLSX.readFile(ordersPath);
    const ordersWs = ordersWb.Sheets[ordersWb.SheetNames[0]];
    const orders = XLSX.utils.sheet_to_json(ordersWs, { defval: '' });

    const results = [];
    const errors = [];

    // Process each order ID
    for (const orderId of order_ids) {
      try {
        console.log(`🔄 Processing order: ${orderId}`);
        
        // Check if this is already a clone order
        const isCloneOrder = orderId.includes('_');
        
        // Get all products for this order_id
        const orderProducts = orders.filter(order => order.order_id === orderId);
        const claimedProducts = orderProducts.filter(order => 
          order.claimed_by === vendor.warehouseId && order.status === 'claimed'
        );

        if (claimedProducts.length === 0) {
          errors.push({
            order_id: orderId,
            error: 'No products claimed by this vendor for this order'
          });
          continue;
        }

        let labelResponse;
        if (isCloneOrder) {
          // Already a clone order - direct download
          labelResponse = await generateLabelForOrder(orderId, claimedProducts, vendor);
        } else if (orderProducts.length === claimedProducts.length) {
          // Direct download - all products claimed by vendor
          labelResponse = await generateLabelForOrder(orderId, claimedProducts, vendor);
        } else if (claimedProducts.length > 0) {
          // Clone required - some products claimed by vendor
          labelResponse = await handleOrderCloning(orderId, claimedProducts, orderProducts, vendor);
        } else {
          errors.push({
            order_id: orderId,
            error: 'No products claimed by this vendor for this order'
          });
          continue;
        }

        if (labelResponse.success) {
          results.push({
            order_id: orderId,
            shipping_url: labelResponse.data.shipping_url,
            awb: labelResponse.data.awb
          });
        } else {
          errors.push({
            order_id: orderId,
            error: labelResponse.message || 'Label generation failed'
          });
        }

      } catch (error) {
        console.error(`❌ Error processing order ${orderId}:`, error);
        errors.push({
          order_id: orderId,
          error: error.message
        });
      }
    }

    console.log('📊 BULK DOWNLOAD LABELS COMPLETE:');
    console.log('  - Successful:', results.length);
    console.log('  - Failed:', errors.length);

    if (results.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No labels could be generated for any of the selected orders',
        data: { errors }
      });
    }

    // Generate combined PDF
    try {
      const combinedPdfBuffer = await generateCombinedLabelsPDF(results);
      
      // Set response headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="bulk-labels-${Date.now()}.pdf"`);
      res.setHeader('Content-Length', combinedPdfBuffer.length);
      
      // Send the PDF buffer
      res.send(combinedPdfBuffer);
      
    } catch (pdfError) {
      console.error('❌ PDF generation failed:', pdfError);
      
      // Fallback: return individual label URLs
      return res.json({
        success: true,
        message: 'Labels generated but PDF combination failed. Returning individual URLs.',
        data: {
          labels: results,
          errors,
          total_successful: results.length,
          total_failed: errors.length
        }
      });
    }

  } catch (error) {
    console.error('❌ BULK DOWNLOAD LABELS ERROR:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to process bulk label download', 
      error: error.message 
    });
  }
});

/**
 * Generate combined PDF from multiple label URLs
 */
async function generateCombinedLabelsPDF(labels) {
  try {
    console.log('🔄 Generating combined PDF for', labels.length, 'labels');
    
    // Import PDF-lib for PDF manipulation
    const { PDFDocument } = require('pdf-lib');
    
    // Create a new PDF document
    const mergedPdf = await PDFDocument.create();
    
    // Process each label
    for (const label of labels) {
      try {
        console.log(`  - Processing label for order ${label.order_id}`);
        
        // Fetch the PDF from the shipping URL
        const response = await fetch(label.shipping_url);
        if (!response.ok) {
          console.log(`    ⚠️ Failed to fetch label for order ${label.order_id}:`, response.status);
          continue;
        }
        
        const pdfBuffer = await response.arrayBuffer();
        
        // Load the PDF
        const pdf = await PDFDocument.load(pdfBuffer);
        
        // Copy all pages from this PDF to the merged PDF
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(page => mergedPdf.addPage(page));
        
        console.log(`    ✅ Added label for order ${label.order_id}`);
        
      } catch (labelError) {
        console.log(`    ❌ Error processing label for order ${label.order_id}:`, labelError.message);
      }
    }
    
    // Save the merged PDF
    const mergedPdfBytes = await mergedPdf.save();
    console.log('✅ Combined PDF generated successfully');
    
    return Buffer.from(mergedPdfBytes);
    
  } catch (error) {
    console.error('❌ Combined PDF generation failed:', error);
    throw error;
  }
}

/**
 * @route   POST /api/orders/refresh
 * @desc    Refresh orders by syncing from Shipway API
 * @access  Vendor (token required)
 */
router.post('/refresh', async (req, res) => {
  const token = req.headers['authorization'];
  
  console.log('🔵 REFRESH ORDERS REQUEST START');
  console.log('  - token received:', token ? 'YES' : 'NO');
  
  if (!token) {
    console.log('❌ REFRESH ORDERS FAILED: Missing token');
    return res.status(400).json({ success: false, message: 'Authorization token required' });
  }

  try {
    // Load users.xlsx to get vendor info
    const usersPath = path.join(__dirname, '../data/users.xlsx');
    const usersWb = XLSX.readFile(usersPath);
    const usersWs = usersWb.Sheets[usersWb.SheetNames[0]];
    const users = XLSX.utils.sheet_to_json(usersWs, { defval: '' });
    
    const vendor = users.find(u => u.token === token && u.active_session === 'TRUE');
    
    if (!vendor) {
      console.log('❌ VENDOR NOT FOUND OR INACTIVE');
      return res.status(401).json({ success: false, message: 'Invalid or inactive vendor token' });
    }

    console.log('✅ VENDOR FOUND:');
    console.log('  - Email:', vendor.email);
    console.log('  - Warehouse ID:', vendor.warehouseId);

    // Import shipwayService
    const shipwayService = require('../services/shipwayService');
    
    console.log('🔄 Starting orders sync from Shipway...');
    const result = await shipwayService.syncOrdersToExcel();
    
    console.log('✅ Orders synced successfully');
    console.log('  - Result:', result);
    
    return res.json({
      success: true,
      message: 'Orders refreshed successfully from Shipway',
      data: {
        sync_result: result,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ REFRESH ORDERS ERROR:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to refresh orders', 
      error: error.message 
    });
  }
});

module.exports = router; 