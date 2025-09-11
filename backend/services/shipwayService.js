const axios = require('axios');
const fs = require('fs');
const path = require('path');
const orderEnhancementService = require('./orderEnhancementService');
// const XLSX = require('xlsx'); // Removed - no longer using Excel

/**
 * Shipway API Service
 * Handles all interactions with Shipway API
 */
class ShipwayService {
  constructor() {
    this.baseURL = process.env.SHIPWAY_API_BASE_URL || 'https://app.shipway.com/api';
    // Instead of API key, use Basic Auth header from environment variable
    this.basicAuthHeader = process.env.SHIPWAY_BASIC_AUTH_HEADER;
  }

  /**
   * Get warehouse details by warehouse ID
   * @param {string} warehouseId - The warehouse ID to fetch details for
   * @returns {Object} Warehouse details from Shipway API
   */
  async getWarehouseById(warehouseId) {
    try {
      if (!warehouseId) {
        throw new Error('Warehouse ID is required');
      }

      if (!this.basicAuthHeader) {
        throw new Error('Shipway API configuration error. Please contact administrator.');
      }

      const url = `${this.baseURL}/getwarehouses`;
      const params = { warehouseid: warehouseId };

      this.logApiActivity({
        type: 'shipway-request',
        warehouseId,
        url,
        params,
        headers: { Authorization: '***' },
      });
      const response = await axios.get(url, {
        params,
        headers: {
          'Authorization': this.basicAuthHeader,
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });
      this.logApiActivity({
        type: 'shipway-response',
        warehouseId,
        status: response.status,
        data: response.data,
      });

      // Check if response is successful
      if (response.status !== 200) {
        throw new Error(`Shipway API returned status ${response.status}`);
      }

      const data = response.data;

      // Validate response structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format from Shipway API');
      }

      // Shipway sometimes returns { success: 1, message: 'No warehouse found' }
      // or other non-object message values when not found. Treat those as not found.
      const messageField = data.message;
      const messageIsObject = messageField && typeof messageField === 'object';
      const messageIsNoWarehouse = typeof messageField === 'string' && messageField.toLowerCase().includes('no warehouse');

      if (data.error || !messageIsObject || messageIsNoWarehouse) {
        throw new Error('Warehouse not found or invalid warehouse ID');
      }

      return {
        success: true,
        data: data,
        warehouseId: warehouseId
      };

    } catch (error) {
      this.logApiActivity({
        type: 'shipway-error',
        warehouseId,
        error: error.message,
        stack: error.stack,
      });
      console.error('Error fetching warehouse from Shipway API:', error.message);
      
      // Handle specific error cases
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        throw new Error('Unable to connect to Shipway API. Please check your internet connection.');
      }
      
      if (error.code === 'ETIMEDOUT') {
        throw new Error('Request to Shipway API timed out. Please try again.');
      }

      if (error.response) {
        // API returned an error response
        const status = error.response.status;
        if (status === 401) {
          throw new Error('Invalid Shipway API credentials. Please check your configuration.');
        } else if (status === 404) {
          throw new Error('Warehouse not found with the provided ID.');
        } else if (status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        } else {
          throw new Error(`Shipway API error: ${error.response.data?.message || `Status ${status}`}`);
        }
      }

      // Re-throw the original error if it's already formatted
      if (error.message.includes('Warehouse not found') || 
          error.message.includes('Shipway API')) {
        throw error;
      }

      throw new Error('Failed to fetch warehouse details from Shipway API');
    }
  }

  /**
   * Validate warehouse ID format
   * @param {string} warehouseId - The warehouse ID to validate
   * @returns {boolean} True if valid format, false otherwise
   */
  validateWarehouseId(warehouseId) {
    if (!warehouseId || typeof warehouseId !== 'string') {
      return false;
    }

    // Remove any whitespace
    const cleanId = warehouseId.trim();
    
    // Check if it's a valid number (positive integer)
    const numId = parseInt(cleanId, 10);
    return !isNaN(numId) && numId > 0 && numId.toString() === cleanId;
  }

  /**
   * Extract key warehouse information from Shipway response
   * @param {Object} shipwayData - Raw data from Shipway API
   * @returns {Object} Formatted warehouse information
   */
  formatWarehouseData(shipwayData) {
    try {
      // If the response is wrapped in a 'message' key, use that
      const data = shipwayData && typeof shipwayData === 'object' && shipwayData.message ? shipwayData.message : shipwayData;
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid warehouse data');
      }
      const warehouse = {
        id: data.warehouse_id || data.warehouseid || data.id,
        name: data.title || data.warehousename || data.name,
        address: data.address_1 || data.address || data.warehouseaddress,
        city: data.city,
        state: data.state,
        country: data.country,
        pincode: data.pincode || data.postalcode,
        contactPerson: data.contact_person_name || data.contactperson || data.contact_person,
        phone: data.phone || data.contactphone,
        email: data.email || data.contactemail,
        status: data.status || data.warehousestatus,
        createdAt: data.createddate || data.created_at,
        updatedAt: data.updateddate || data.updated_at
      };
      Object.keys(warehouse).forEach(key => {
        if (warehouse[key] === undefined) {
          delete warehouse[key];
        }
      });
      return warehouse;
    } catch (error) {
      console.error('Error formatting warehouse data:', error);
      throw new Error('Failed to format warehouse data');
    }
  }

  /**
   * Test API connectivity
   * @returns {Object} Connection test result
   */
  async testConnection() {
    try {
      if (!this.basicAuthHeader) {
        return {
          success: false,
          error: 'API credentials not configured'
        };
      }

      // Try to fetch a test warehouse (you might want to use a known test ID)
      const testResult = await this.getWarehouseById('1');
      
      return {
        success: true,
        message: 'Successfully connected to Shipway API'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * @deprecated - Use syncOrdersToMySQL() instead
   * Old Excel-based sync method - kept for reference but not used
   */
  /*
  async syncOrdersToExcel() {
    const ordersExcelPath = path.join(__dirname, '../data/orders.xlsx');
    const rawDataJsonPath = path.join(__dirname, '../data/raw_shipway_orders.json');
    const url = `${this.baseURL}/getorders`;
    const params = { status: 'O' };
    let shipwayOrders = [];
    let rawApiResponse = null;
    
    try {
      // Fetch all orders using Shipway's page-based pagination
      let allOrders = [];
      let page = 1;
      let hasMorePages = true;
      
      console.log('🔄 Starting paginated fetch from Shipway API...');
      
      while (hasMorePages) {
        const currentParams = { 
          status: 'O',
          page: page
        };
        
        this.logApiActivity({ 
          type: 'shipway-request', 
          url, 
          params: currentParams, 
          headers: { Authorization: '***' },
          page: page
        });
        
        console.log(`📄 Fetching page ${page}...`);
        
        const response = await axios.get(url, {
          params: currentParams,
          headers: {
            'Authorization': this.basicAuthHeader,
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        });
        
        if (response.status !== 200 || !response.data) {
          throw new Error('Invalid response from Shipway API');
        }
        
        let currentPageOrders = [];
        if (Array.isArray(response.data)) {
          currentPageOrders = response.data;
        } else if (Array.isArray(response.data.orders)) {
          currentPageOrders = response.data.orders;
        } else if (typeof response.data === 'object' && Array.isArray(response.data.message) && response.data.success === 1) {
          currentPageOrders = response.data.message;
        } else if (typeof response.data === 'object' && response.data.order_id) {
          currentPageOrders = [response.data];
        } else {
          this.logApiActivity({ type: 'shipway-unexpected-format', data: response.data });
          throw new Error('Unexpected Shipway API response format');
        }
        
        console.log(`  ✅ Page ${page}: ${currentPageOrders.length} orders`);
        
        // Add orders from this page to our collection
        allOrders = allOrders.concat(currentPageOrders);
        
        // If we got fewer than 100 orders, we've reached the last page
        if (currentPageOrders.length < 100) {
          hasMorePages = false;
          console.log(`  🏁 Last page reached (${currentPageOrders.length} < 100 orders)`);
        } else {
          console.log(`  ➡️ More pages available (${currentPageOrders.length} = 100 orders)`);
        }
        
        this.logApiActivity({ 
          type: 'shipway-page-fetched', 
          page: page, 
          ordersInPage: currentPageOrders.length, 
          totalOrdersSoFar: allOrders.length 
        });
        
        page++;
        
        // Safety check to prevent infinite loops
        if (page > 20) {
          console.log('⚠️ Safety limit reached (20 pages), stopping pagination');
          this.logApiActivity({ type: 'shipway-pagination-limit-reached', totalOrders: allOrders.length });
          break;
        }
      }
      
      console.log(`🎉 Pagination complete! Total orders fetched: ${allOrders.length}`);
      
      // Filter orders to only include last 40 days
      const fortyDaysAgo = new Date();
      fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);
      
      const filteredOrders = allOrders.filter(order => {
        if (!order.order_date) return false;
        
        const orderDate = new Date(order.order_date);
        const isWithin40Days = orderDate >= fortyDaysAgo;
        
        if (!isWithin40Days) {
          console.log(`  ⏰ Filtering out old order: ${order.order_id} (${order.order_date})`);
        }
        
        return isWithin40Days;
      });
      
      console.log(`📅 Date filter applied: ${filteredOrders.length} orders within last 40 days (filtered out ${allOrders.length - filteredOrders.length} old orders)`);
      
      shipwayOrders = filteredOrders;
      rawApiResponse = { success: 1, message: allOrders }; // Keep all orders in raw JSON
      
      // Store raw API response in JSON file (all orders)
      try {
        fs.writeFileSync(rawDataJsonPath, JSON.stringify(rawApiResponse, null, 2));
        this.logApiActivity({ type: 'raw-data-stored', path: rawDataJsonPath, totalOrders: allOrders.length, filteredOrders: filteredOrders.length });
      } catch (fileError) {
        this.logApiActivity({ type: 'raw-data-store-error', error: fileError.message });
      }
      
      this.logApiActivity({ 
        type: 'shipway-response', 
        status: 200, 
        dataType: typeof rawApiResponse, 
        dataKeys: Object.keys(rawApiResponse),
        totalOrders: allOrders.length,
        filteredOrders: filteredOrders.length
      });
      
    } catch (error) {
      this.logApiActivity({ type: 'shipway-error', error: error.message, stack: error.stack });
      throw new Error('Failed to fetch orders from Shipway API: ' + error.message);
    }

    // Ensure data directory exists
    const dataDir = path.dirname(ordersExcelPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Read existing Excel data (if file exists)
    let existingRows = [];
    let existingClaimData = new Map(); // Map to store claim data by order_id|product_code
    let maxUniqueId = 0;
    
    if (fs.existsSync(ordersExcelPath)) {
      try {
        const workbook = XLSX.readFile(ordersExcelPath);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        existingRows = XLSX.utils.sheet_to_json(worksheet);
        
        // Build map of existing claim data
        existingRows.forEach(row => {
          const key = `${row.order_id}|${row.product_code}`;
          existingClaimData.set(key, {
            unique_id: row.unique_id,
            status: row.status || 'unclaimed',
            claimed_by: row.claimed_by || '',
            claimed_at: row.claimed_at || '',
            last_claimed_by: row.last_claimed_by || '',
            last_claimed_at: row.last_claimed_at || '',
            clone_status: row.clone_status || 'not_cloned',
            cloned_order_id: row.cloned_order_id || '',
            is_cloned_row: row.is_cloned_row || '',
            label_downloaded: row.label_downloaded || '',
            handover_at: row.handover_at || '',
            customer_name: row.customer_name || '',
            product_image: row.product_image || '',
            priority_carrier: row.priority_carrier || '',
            pincode: row.pincode || ''
          });
          
          // Track max unique_id for new rows
          if (row.unique_id && row.unique_id > maxUniqueId) {
            maxUniqueId = row.unique_id;
          }
        });
      } catch (e) {
        this.logApiActivity({ type: 'excel-read-error', error: e.message });
      }
    }

    // Flatten Shipway orders to one row per product, preserving existing claim data
    const flatOrders = [];
    let uniqueIdCounter = maxUniqueId + 1;
    
    for (const order of shipwayOrders) {
      if (!Array.isArray(order.products)) continue;
      
      // Extract order-level financial information and convert to number
      const orderTotal = parseFloat(order.order_total) || 0;
      
      // Determine payment type based on order_tags
      const orderTags = Array.isArray(order.order_tags) ? order.order_tags : [];
      const paymentType = orderTags.includes('PPCOD') ? 'C' : 'P';
      
             // Calculate total prepaid amount for the entire order based on payment type
       const totalPrepaidAmount = paymentType === 'P' 
         ? parseFloat(orderTotal.toFixed(2)) 
         : parseFloat((orderTotal * 0.1).toFixed(2));
      
      // Calculate total selling price for all products in this order for ratio calculation
      const totalSellingPriceInOrder = order.products.reduce((sum, prod) => {
        return sum + (parseFloat(prod.price) || 0);
      }, 0);
      
             // Calculate ratio parts for each product
       let productRatios = [];
       if (totalSellingPriceInOrder > 0) {
         const prices = order.products.map(prod => parseFloat(prod.price) || 0);
         
         // Convert prices to integers to handle decimals (multiply by 100 for 2 decimal places)
         const intPrices = prices.map(price => Math.round(price * 100));
         
         // Find GCD of all prices to get simplest integer ratio
         const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
         const findGCD = (arr) => arr.reduce((acc, val) => gcd(acc, val));
         
         const pricesGCD = findGCD(intPrices.filter(p => p > 0));
         
         if (pricesGCD > 0) {
           productRatios = intPrices.map(price => Math.round(price / pricesGCD));
         } else {
           productRatios = prices.map(() => 1);
         }
       } else {
         productRatios = order.products.map(() => 1); // Equal ratio if no selling prices
       }
       
       // Calculate total of all ratios for this order
       const totalRatios = productRatios.reduce((sum, ratio) => sum + ratio, 0);
      
      for (let i = 0; i < order.products.length; i++) {
        const product = order.products[i];
        const key = `${order.order_id}|${product.product_code}`;
        const existingClaim = existingClaimData.get(key);
        
                          // Get selling price from product data and convert to number
         const sellingPrice = parseFloat(product.price) || 0;
         
         // Get the ratio for this product
         const orderTotalRatio = productRatios[i] || 1;
         
         // Calculate the actual split amount for this product
         const orderTotalSplit = totalRatios > 0 
           ? parseFloat(((orderTotalRatio / totalRatios) * orderTotal).toFixed(2))
           : parseFloat((orderTotal / order.products.length).toFixed(2)); // Equal split if no ratios
         
         // Calculate the prepaid amount split for this product based on ratio
         const prepaidAmount = totalRatios > 0 
           ? parseFloat(((orderTotalRatio / totalRatios) * totalPrepaidAmount).toFixed(2))
           : parseFloat((totalPrepaidAmount / order.products.length).toFixed(2)); // Equal split if no ratios
         
         // Calculate collectable amount: 0 for prepaid, order_total_split - prepaid_amount for COD
         const collectableAmount = paymentType === 'P' 
           ? 0 
           : parseFloat((orderTotalSplit - prepaidAmount).toFixed(2));
         
                                                         const orderRow = {
          unique_id: existingClaim ? existingClaim.unique_id : uniqueIdCounter++,
          order_id: order.order_id,
          order_date: order.order_date,
          product_name: product.product,
          product_code: product.product_code,
          // The 7 additional columns with correct logic
          selling_price: sellingPrice,
          order_total: orderTotal,
          payment_type: paymentType,
          prepaid_amount: prepaidAmount,
          order_total_ratio: orderTotalRatio,
          order_total_split: orderTotalSplit,
          collectable_amount: collectableAmount,
          // Add pincode from s_zipcode, preserve existing if available
          pincode: existingClaim ? existingClaim.pincode : (order.s_zipcode || ''),
         // Preserve existing claim data or use defaults for new orders
         status: existingClaim ? existingClaim.status : 'unclaimed',
         claimed_by: existingClaim ? existingClaim.claimed_by : '',
         claimed_at: existingClaim ? existingClaim.claimed_at : '',
         last_claimed_by: existingClaim ? existingClaim.last_claimed_by : '',
         last_claimed_at: existingClaim ? existingClaim.last_claimed_at : '',
         clone_status: existingClaim ? existingClaim.clone_status : 'not_cloned',
         cloned_order_id: existingClaim ? existingClaim.cloned_order_id : '',
         is_cloned_row: existingClaim ? existingClaim.is_cloned_row : '',
         label_downloaded: existingClaim ? existingClaim.label_downloaded : '',
         handover_at: existingClaim ? existingClaim.handover_at : '',
         // Preserve custom columns or use empty defaults for new orders
         customer_name: existingClaim ? existingClaim.customer_name : '',
         product_image: existingClaim ? existingClaim.product_image : '',
         // Add priority_carrier column (empty for new orders, preserve existing)
         priority_carrier: existingClaim ? existingClaim.priority_carrier : ''
        };
        
        flatOrders.push(orderRow);
      }
    }

    // Compare and update Excel only if changed or file doesn't exist
    const existingKeySet = new Set(existingRows.map(r => `${r.order_id}|${r.product_code}`));
    const newKeySet = new Set(flatOrders.map(r => `${r.order_id}|${r.product_code}`));
    let changed = false;
    
    // Check for new rows
    for (const row of flatOrders) {
      if (!existingKeySet.has(`${row.order_id}|${row.product_code}`)) {
        changed = true;
        break;
      }
    }
    
    // Check for removed rows
    if (!changed) {
      for (const row of existingRows) {
        if (!newKeySet.has(`${row.order_id}|${row.product_code}`)) {
          changed = true;
          break;
        }
      }
    }
    
        // Always create/update Excel file if it doesn't exist or if there are changes
    if (changed || !fs.existsSync(ordersExcelPath)) {
      // Write updated Excel file with preserved claim data and new columns
      const worksheet = XLSX.utils.json_to_sheet(flatOrders);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');
      XLSX.writeFile(workbook, ordersExcelPath);
             this.logApiActivity({ 
        type: 'excel-write-with-new-columns', 
        rows: flatOrders.length, 
        preservedClaims: existingClaimData.size,
        newColumns: ['selling_price', 'order_total', 'payment_type', 'prepaid_amount', 'order_total_ratio', 'order_total_split', 'collectable_amount', 'customer_name', 'product_image', 'priority_carrier', 'pincode']
      });

      // Automatically enhance orders with customer names and product images
      try {
        const enhancementResult = await orderEnhancementService.enhanceOrdersFile();
        this.logApiActivity({ 
          type: 'orders-enhancement', 
          success: enhancementResult.success,
          customerNamesAdded: enhancementResult.customerNamesAdded,
          productImagesAdded: enhancementResult.productImagesAdded,
          message: enhancementResult.message
        });
      } catch (enhancementError) {
        this.logApiActivity({ 
          type: 'orders-enhancement-error', 
          error: enhancementError.message 
        });
      }

      // Automatically sync carriers from Shipway API
      try {
        const shipwayCarrierService = require('./shipwayCarrierService');
        const carrierResult = await shipwayCarrierService.syncCarriersToExcel();
        this.logApiActivity({ 
          type: 'carrier-sync', 
          success: carrierResult.success,
          carrierCount: carrierResult.carrierCount,
          message: carrierResult.message
        });
      } catch (carrierError) {
        this.logApiActivity({ 
          type: 'carrier-sync-error', 
          error: carrierError.message 
        });
      }
    } else {
      this.logApiActivity({ type: 'excel-no-change', rows: flatOrders.length });
    }
    
    return { success: true, count: flatOrders.length, preservedClaims: existingClaimData.size, rawDataStored: rawDataJsonPath };
  }
  */

  /**
   * Sync orders from Shipway API to MySQL database
   * Preserves existing claim data (status, claimed_by, etc.) when syncing new orders.
   * Logs all API activity.
   * Stores raw API response in JSON file for reference.
   */
  async syncOrdersToMySQL() {
    const database = require('../config/database');
    const rawDataJsonPath = path.join(__dirname, '../data/raw_shipway_orders.json');
    const url = `${this.baseURL}/getorders`;
    let shipwayOrders = [];
    let rawApiResponse = null;
    
    try {
      // Fetch all orders using Shipway's page-based pagination
      let allOrders = [];
      let page = 1;
      let hasMorePages = true;
      
      console.log('🔄 Starting paginated fetch from Shipway API...');
      
      while (hasMorePages) {
        const currentParams = { 
          status: 'O',
          page: page
        };
        
        this.logApiActivity({ 
          type: 'shipway-request', 
          url, 
          params: currentParams, 
          headers: { Authorization: '***' },
          page: page
        });
        
        console.log(`📄 Fetching page ${page}...`);
        
        const response = await axios.get(url, {
          params: currentParams,
          headers: {
            'Authorization': this.basicAuthHeader,
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        });
        
        if (response.status !== 200 || !response.data) {
          throw new Error('Invalid response from Shipway API');
        }
        
        let currentPageOrders = [];
        if (Array.isArray(response.data)) {
          currentPageOrders = response.data;
        } else if (Array.isArray(response.data.orders)) {
          currentPageOrders = response.data.orders;
        } else if (typeof response.data === 'object' && Array.isArray(response.data.message) && response.data.success === 1) {
          currentPageOrders = response.data.message;
        } else if (typeof response.data === 'object' && response.data.order_id) {
          currentPageOrders = [response.data];
        } else {
          this.logApiActivity({ type: 'shipway-unexpected-format', data: response.data });
          throw new Error('Unexpected Shipway API response format');
        }
        
        console.log(`  ✅ Page ${page}: ${currentPageOrders.length} orders`);
        
        // Add orders from this page to our collection
        allOrders = allOrders.concat(currentPageOrders);
        
        // If we got fewer than 100 orders, we've reached the last page
        if (currentPageOrders.length < 100) {
          hasMorePages = false;
          console.log(`  🏁 Last page reached (${currentPageOrders.length} < 100 orders)`);
        } else {
          console.log(`  ➡️ More pages available (${currentPageOrders.length} = 100 orders)`);
        }
        
        this.logApiActivity({ 
          type: 'shipway-page-fetched', 
          page: page, 
          ordersInPage: currentPageOrders.length, 
          totalOrdersSoFar: allOrders.length 
        });
        
        page++;
        
        // Safety check to prevent infinite loops
        if (page > 20) {
          console.log('⚠️ Safety limit reached (20 pages), stopping pagination');
          this.logApiActivity({ type: 'shipway-pagination-limit-reached', totalOrders: allOrders.length });
          break;
        }
      }
      
      console.log(`🎉 Pagination complete! Total orders fetched: ${allOrders.length}`);
      
      // Filter orders to only include last 40 days
      const fortyDaysAgo = new Date();
      fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);
      
      const filteredOrders = allOrders.filter(order => {
        if (!order.order_date) return false;
        
        const orderDate = new Date(order.order_date);
        const isWithin40Days = orderDate >= fortyDaysAgo;
        
        if (!isWithin40Days) {
          console.log(`  ⏰ Filtering out old order: ${order.order_id} (${order.order_date})`);
        }
        
        return isWithin40Days;
      });
      
      console.log(`📅 Date filter applied: ${filteredOrders.length} orders within last 40 days (filtered out ${allOrders.length - filteredOrders.length} old orders)`);
      
      shipwayOrders = filteredOrders;
      rawApiResponse = { success: 1, message: allOrders }; // Keep all orders in raw JSON
      
      // Store raw API response in JSON file (all orders)
      try {
        fs.writeFileSync(rawDataJsonPath, JSON.stringify(rawApiResponse, null, 2));
        this.logApiActivity({ type: 'raw-data-stored', path: rawDataJsonPath, totalOrders: allOrders.length, filteredOrders: filteredOrders.length });
      } catch (fileError) {
        this.logApiActivity({ type: 'raw-data-store-error', error: fileError.message });
      }
      
      this.logApiActivity({ 
        type: 'shipway-response', 
        status: 200, 
        dataType: typeof rawApiResponse, 
        dataKeys: Object.keys(rawApiResponse),
        totalOrders: allOrders.length,
        filteredOrders: filteredOrders.length
      });
      
    } catch (error) {
      this.logApiActivity({ type: 'shipway-error', error: error.message, stack: error.stack });
      throw new Error('Failed to fetch orders from Shipway API: ' + error.message);
    }

    // Wait for MySQL initialization
    await database.waitForMySQLInitialization();
    if (!database.isMySQLAvailable()) {
      throw new Error('MySQL connection not available');
    }

    // Get existing orders from MySQL to preserve claim data
    let existingOrders = [];
    let existingClaimData = new Map(); // Map to store claim data by order_id|product_code
    let maxUniqueId = 0;
    
    try {
      existingOrders = await database.getAllOrders();
      
      // Build map of existing claim data
      existingOrders.forEach(row => {
        const key = `${row.order_id}|${row.product_code}`;
        existingClaimData.set(key, {
          unique_id: row.unique_id,
          status: row.status || 'unclaimed',
          claimed_by: row.claimed_by || '',
          claimed_at: row.claimed_at || '',
          last_claimed_by: row.last_claimed_by || '',
          last_claimed_at: row.last_claimed_at || '',
          clone_status: row.clone_status || 'not_cloned',
          cloned_order_id: row.cloned_order_id || '',
          is_cloned_row: row.is_cloned_row || false,
          label_downloaded: row.label_downloaded || false,
          handover_at: row.handover_at || '',
          customer_name: row.customer_name || '',
          product_image: row.product_image || '',
          priority_carrier: row.priority_carrier || '',
          pincode: row.pincode || ''
        });
        
        // Track max unique_id for new rows
        if (row.unique_id && parseInt(row.unique_id) > maxUniqueId) {
          maxUniqueId = parseInt(row.unique_id);
        }
      });
    } catch (e) {
      this.logApiActivity({ type: 'mysql-read-error', error: e.message });
    }

    // Flatten Shipway orders to one row per product, preserving existing claim data
    const flatOrders = [];
    let uniqueIdCounter = maxUniqueId + 1;
    
    for (const order of shipwayOrders) {
      if (!Array.isArray(order.products)) continue;
      
      // Extract order-level financial information and convert to number
      const orderTotal = parseFloat(order.order_total) || 0;
      
      // Determine payment type based on order_tags
      const orderTags = Array.isArray(order.order_tags) ? order.order_tags : [];
      const paymentType = orderTags.includes('PPCOD') ? 'C' : 'P';
      
      // Calculate total prepaid amount for the entire order based on payment type
      const totalPrepaidAmount = paymentType === 'P' 
        ? parseFloat(orderTotal.toFixed(2)) 
        : parseFloat((orderTotal * 0.1).toFixed(2));
      
      // Calculate total selling price for all products in this order for ratio calculation
      const totalSellingPriceInOrder = order.products.reduce((sum, prod) => {
        return sum + (parseFloat(prod.price) || 0);
      }, 0);
      
      // Calculate ratio parts for each product
      let productRatios = [];
      if (totalSellingPriceInOrder > 0) {
        const prices = order.products.map(prod => parseFloat(prod.price) || 0);
        
        // Convert prices to integers to handle decimals (multiply by 100 for 2 decimal places)
        const intPrices = prices.map(price => Math.round(price * 100));
        
        // Find GCD of all prices to get simplest integer ratio
        const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
        const findGCD = (arr) => arr.reduce((acc, val) => gcd(acc, val));
        
        const pricesGCD = findGCD(intPrices.filter(p => p > 0));
        
        if (pricesGCD > 0) {
          productRatios = intPrices.map(price => Math.round(price / pricesGCD));
        } else {
          productRatios = prices.map(() => 1);
        }
      } else {
        productRatios = order.products.map(() => 1); // Equal ratio if no selling prices
      }
      
      // Calculate total of all ratios for this order
      const totalRatios = productRatios.reduce((sum, ratio) => sum + ratio, 0);
      
      for (let i = 0; i < order.products.length; i++) {
        const product = order.products[i];
        const key = `${order.order_id}|${product.product_code}`;
        const existingClaim = existingClaimData.get(key);
        
        // Get selling price from product data and convert to number
        const sellingPrice = parseFloat(product.price) || 0;
        
        // Get the ratio for this product
        const orderTotalRatio = productRatios[i] || 1;
        
        // Calculate the actual split amount for this product
        const orderTotalSplit = totalRatios > 0 
          ? parseFloat(((orderTotalRatio / totalRatios) * orderTotal).toFixed(2))
          : parseFloat((orderTotal / order.products.length).toFixed(2)); // Equal split if no ratios
        
        // Calculate the prepaid amount split for this product based on ratio
        const prepaidAmount = totalRatios > 0 
          ? parseFloat(((orderTotalRatio / totalRatios) * totalPrepaidAmount).toFixed(2))
          : parseFloat((totalPrepaidAmount / order.products.length).toFixed(2)); // Equal split if no ratios
        
        // Calculate collectable amount: 0 for prepaid, order_total_split - prepaid_amount for COD
        const collectableAmount = paymentType === 'P' 
          ? 0 
          : parseFloat((orderTotalSplit - prepaidAmount).toFixed(2));
        
        const orderRow = {
          id: `${order.order_id}_${product.product_code}_${Date.now()}`,
          unique_id: existingClaim ? existingClaim.unique_id : uniqueIdCounter++,
          order_id: order.order_id,
          order_date: order.order_date,
          product_name: product.product,
          product_code: product.product_code,
          // The 7 additional columns with correct logic
          selling_price: sellingPrice,
          order_total: orderTotal,
          payment_type: paymentType,
          prepaid_amount: prepaidAmount,
          order_total_ratio: orderTotalRatio,
          order_total_split: orderTotalSplit,
          collectable_amount: collectableAmount,
          // Add pincode from s_zipcode, preserve existing if available
          pincode: existingClaim ? existingClaim.pincode : (order.s_zipcode || ''),
          // Preserve existing claim data or use defaults for new orders
          status: existingClaim ? existingClaim.status : 'unclaimed',
          claimed_by: existingClaim ? existingClaim.claimed_by : '',
          claimed_at: existingClaim ? existingClaim.claimed_at : '',
          last_claimed_by: existingClaim ? existingClaim.last_claimed_by : '',
          last_claimed_at: existingClaim ? existingClaim.last_claimed_at : '',
          clone_status: existingClaim ? existingClaim.clone_status : 'not_cloned',
          cloned_order_id: existingClaim ? existingClaim.cloned_order_id : '',
          is_cloned_row: existingClaim ? existingClaim.is_cloned_row : false,
          label_downloaded: existingClaim ? existingClaim.label_downloaded : false,
          handover_at: existingClaim ? existingClaim.handover_at : '',
          // Preserve custom columns or use empty defaults for new orders
          customer_name: existingClaim ? existingClaim.customer_name : '',
          product_image: existingClaim ? existingClaim.product_image : '',
          // Add priority_carrier column (empty for new orders, preserve existing)
          priority_carrier: existingClaim ? existingClaim.priority_carrier : ''
        };
        
        flatOrders.push(orderRow);
      }
    }

    // Compare and update MySQL only if changed
    const existingKeySet = new Set(existingOrders.map(r => `${r.order_id}|${r.product_code}`));
    const newKeySet = new Set(flatOrders.map(r => `${r.order_id}|${r.product_code}`));
    let changed = false;
    
    // Check for new rows
    for (const row of flatOrders) {
      if (!existingKeySet.has(`${row.order_id}|${row.product_code}`)) {
        changed = true;
        break;
      }
    }
    
    // Check for removed rows
    if (!changed) {
      for (const row of existingOrders) {
        if (!newKeySet.has(`${row.order_id}|${row.product_code}`)) {
          changed = true;
          break;
        }
      }
    }
    
    // Always update MySQL if there are changes
    if (changed || existingOrders.length === 0) {
      try {
        // Delete existing orders that are no longer in Shipway
        for (const existingOrder of existingOrders) {
          const key = `${existingOrder.order_id}|${existingOrder.product_code}`;
          if (!newKeySet.has(key)) {
            await database.deleteOrder(existingOrder.unique_id);
          }
        }
        
        // Insert or update orders
        for (const orderRow of flatOrders) {
          const key = `${orderRow.order_id}|${orderRow.product_code}`;
          if (existingKeySet.has(key)) {
            // Update existing order (preserve claim data)
            const existingOrder = existingOrders.find(o => `${o.order_id}|${o.product_code}` === key);
            if (existingOrder) {
              await database.updateOrder(existingOrder.unique_id, {
                order_date: orderRow.order_date,
                product_name: orderRow.product_name,
                selling_price: orderRow.selling_price,
                order_total: orderRow.order_total,
                payment_type: orderRow.payment_type,
                prepaid_amount: orderRow.prepaid_amount,
                order_total_ratio: orderRow.order_total_ratio,
                order_total_split: orderRow.order_total_split,
                collectable_amount: orderRow.collectable_amount,
                pincode: orderRow.pincode
              });
            }
          } else {
            // Insert new order
            await database.createOrder(orderRow);
          }
        }
        
        this.logApiActivity({ 
          type: 'mysql-write-with-new-columns', 
          rows: flatOrders.length, 
          preservedClaims: existingClaimData.size,
          newColumns: ['selling_price', 'order_total', 'payment_type', 'prepaid_amount', 'order_total_ratio', 'order_total_split', 'collectable_amount', 'customer_name', 'product_image', 'priority_carrier', 'pincode']
        });

        // Automatically enhance orders with customer names and product images
        try {
          const orderEnhancementService = require('./orderEnhancementService');
          const enhancementResult = await orderEnhancementService.enhanceOrdersMySQL();
          this.logApiActivity({ 
            type: 'orders-enhancement', 
            success: enhancementResult.success,
            customerNamesAdded: enhancementResult.customerNamesAdded,
            productImagesAdded: enhancementResult.productImagesAdded,
            message: enhancementResult.message
          });
        } catch (enhancementError) {
          this.logApiActivity({ 
            type: 'orders-enhancement-error', 
            error: enhancementError.message 
          });
        }

        // Automatically sync carriers from Shipway API
        try {
          const shipwayCarrierService = require('./shipwayCarrierService');
          const carrierResult = await shipwayCarrierService.syncCarriersToDatabase();
          this.logApiActivity({ 
            type: 'carrier-sync', 
            success: carrierResult.success,
            carrierCount: carrierResult.carrierCount,
            message: carrierResult.message
          });
        } catch (carrierError) {
          this.logApiActivity({ 
            type: 'carrier-sync-error', 
            error: carrierError.message 
          });
        }
      } catch (mysqlError) {
        this.logApiActivity({ type: 'mysql-write-error', error: mysqlError.message });
        throw new Error('Failed to update MySQL database: ' + mysqlError.message);
      }
    } else {
      this.logApiActivity({ type: 'mysql-no-change', rows: flatOrders.length });
    }
    
    return { success: true, count: flatOrders.length, preservedClaims: existingClaimData.size, rawDataStored: rawDataJsonPath };
  }

  logApiActivity(activity) {
    const logPath = path.join(__dirname, '../logs/api.log');
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${JSON.stringify(activity)}\n`;
    fs.appendFile(logPath, logEntry, err => {
      if (err) console.error('Failed to write API log:', err);
    });
  }

  /**
   * Fetch orders from Shipway API (for clone ID verification)
   * Uses pagination to get all orders
   * @returns {Promise<Array>} Array of orders from Shipway
   */
  async fetchOrdersFromShipway() {
    const url = `${this.baseURL}/getorders`;
    
    try {
      // Fetch all orders using Shipway's page-based pagination
      let allOrders = [];
      let page = 1;
      let hasMorePages = true;
      
      console.log('🔄 Starting paginated fetch from Shipway API (for clone verification)...');
      
      while (hasMorePages) {
        const currentParams = { 
          status: 'O',
          page: page
        };
        
        this.logApiActivity({ 
          type: 'shipway-fetch-orders', 
          url, 
          params: currentParams,
          page: page
        });
        
        console.log(`📄 Fetching page ${page} for clone verification...`);
        
        const response = await axios.get(url, {
          params: currentParams,
          headers: {
            'Authorization': this.basicAuthHeader,
            'Content-Type': 'application/json',
          },
          timeout: 10000, // Shorter timeout for clone verification
        });
        
        if (response.status !== 200 || !response.data) {
          throw new Error('Invalid response from Shipway API');
        }
        
        let currentPageOrders = [];
        if (Array.isArray(response.data)) {
          currentPageOrders = response.data;
        } else if (Array.isArray(response.data.orders)) {
          currentPageOrders = response.data.orders;
        } else if (typeof response.data === 'object' && Array.isArray(response.data.message) && response.data.success === 1) {
          currentPageOrders = response.data.message;
        } else if (typeof response.data === 'object' && response.data.order_id) {
          currentPageOrders = [response.data];
        } else {
          throw new Error('Unexpected Shipway API response format');
        }
        
        console.log(`  ✅ Page ${page}: ${currentPageOrders.length} orders`);
        
        // Add orders from this page to our collection
        allOrders = allOrders.concat(currentPageOrders);
        
        // If we got fewer than 100 orders, we've reached the last page
        if (currentPageOrders.length < 100) {
          hasMorePages = false;
          console.log(`  🏁 Last page reached (${currentPageOrders.length} < 100 orders)`);
        } else {
          console.log(`  ➡️ More pages available (${currentPageOrders.length} = 100 orders)`);
        }
        
        page++;
        
        // Safety check to prevent infinite loops (lower limit for clone verification)
        if (page > 10) {
          console.log('⚠️ Safety limit reached (10 pages), stopping pagination for clone verification');
          break;
        }
      }
      
      console.log(`🎉 Clone verification pagination complete! Total orders fetched: ${allOrders.length}`);
      
      return allOrders;
    } catch (error) {
      this.logApiActivity({ type: 'shipway-fetch-orders-error', error: error.message });
      throw new Error('Failed to fetch orders from Shipway API: ' + error.message);
    }
  }
}

module.exports = new ShipwayService(); 