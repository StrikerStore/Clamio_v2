const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { authenticateBasicAuth, requireAdminOrSuperadmin } = require('../middleware/auth');

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
        phone: vendor.phone
      };
    });
    
    // Process orders and add vendor information
    const processedOrders = orders.map(order => {
      const vendorInfo = order.claimed_by ? vendorMap[order.claimed_by] : null;
      
      return {
        unique_id: order.unique_id,
        order_id: order.order_id,
        customer_name: order.customer_name || order.customer || 'N/A',
        vendor_name: vendorInfo ? vendorInfo.name : (order.claimed_by ? order.claimed_by : 'Unclaimed'),
        product_name: order.product_name || order.product || 'N/A',
        status: order.status || 'unclaimed',
        value: order.value || order.price || order.selling_price || '0',
        priority: order.priority || 'medium',
        created_at: order.created_at || order.order_date || 'N/A',
        claimed_at: order.claimed_at || null,
        claimed_by: order.claimed_by || null,
        image: order.product_image || order.image || '/placeholder.svg'
      };
    });
    
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

module.exports = router; 