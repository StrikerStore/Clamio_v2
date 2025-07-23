const axios = require('axios');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

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

      // Check if warehouse was found
      if (data.error || data.message === 'Warehouse not found') {
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
      const data = shipwayData.message ? shipwayData.message : shipwayData;
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
   * Fetch all orders with status 'O' from Shipway, update orders.xlsx, and remove missing orders/products.
   * Each product in an order gets its own row. Creates the Excel file if it doesn't exist.
   * Logs all API activity.
   */
  async syncOrdersToExcel() {
    const ordersExcelPath = path.join(__dirname, '../data/orders.xlsx');
    const url = `${this.baseURL}/getorders`;
    const params = { status: 'O' };
    let shipwayOrders = [];
    try {
      this.logApiActivity({ type: 'shipway-request', url, params, headers: { Authorization: '***' } });
      const response = await axios.get(url, {
        params,
        headers: {
          'Authorization': this.basicAuthHeader,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      });
      this.logApiActivity({ type: 'shipway-response', status: response.status, dataType: typeof response.data, dataKeys: response.data && typeof response.data === 'object' ? Object.keys(response.data) : undefined });
      // Accept array, or object with 'orders' array, or single order object, or 'message' array
      if (response.status !== 200 || !response.data) {
        throw new Error('Invalid response from Shipway API');
      }
      if (Array.isArray(response.data)) {
        shipwayOrders = response.data;
      } else if (Array.isArray(response.data.orders)) {
        shipwayOrders = response.data.orders;
      } else if (typeof response.data === 'object' && Array.isArray(response.data.message) && response.data.success === 1) {
        shipwayOrders = response.data.message;
      } else if (typeof response.data === 'object' && response.data.order_id) {
        shipwayOrders = [response.data];
      } else {
        this.logApiActivity({ type: 'shipway-unexpected-format', data: response.data });
        throw new Error('Unexpected Shipway API response format');
      }
    } catch (error) {
      this.logApiActivity({ type: 'shipway-error', error: error.message, stack: error.stack });
      throw new Error('Failed to fetch orders from Shipway API: ' + error.message);
    }

    // Flatten Shipway orders to one row per product
    const flatOrders = [];
    let uniqueIdCounter = 1;
    for (const order of shipwayOrders) {
      if (!Array.isArray(order.products)) continue;
      for (const product of order.products) {
        flatOrders.push({
          unique_id: uniqueIdCounter++,
          order_id: order.order_id,
          order_date: order.order_date,
          product_name: product.product,
          product_code: product.product_code,
        });
      }
    }

    // Read existing Excel data (if file exists)
    let existingRows = [];
    if (fs.existsSync(ordersExcelPath)) {
      try {
        const workbook = XLSX.readFile(ordersExcelPath);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        existingRows = XLSX.utils.sheet_to_json(worksheet);
      } catch (e) {
        this.logApiActivity({ type: 'excel-read-error', error: e.message });
      }
    }

    // Compare and update Excel only if changed
    const existingKeySet = new Set(existingRows.map(r => `${r.order_id}|${r.product_code}`));
    const newKeySet = new Set(flatOrders.map(r => `${r.order_id}|${r.product_code}`));
    let changed = false;
    // Add new rows
    for (const row of flatOrders) {
      if (!existingKeySet.has(`${row.order_id}|${row.product_code}`)) {
        changed = true;
        break;
      }
    }
    // Remove missing rows
    if (!changed) {
      for (const row of existingRows) {
        if (!newKeySet.has(`${row.order_id}|${row.product_code}`)) {
          changed = true;
          break;
        }
      }
    }
    if (changed || !fs.existsSync(ordersExcelPath)) {
      // Write new Excel file
      const worksheet = XLSX.utils.json_to_sheet(flatOrders);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');
      XLSX.writeFile(workbook, ordersExcelPath);
      this.logApiActivity({ type: 'excel-write', rows: flatOrders.length });
    } else {
      this.logApiActivity({ type: 'excel-no-change', rows: flatOrders.length });
    }
    return { success: true, count: flatOrders.length };
  }

  logApiActivity(activity) {
    const logPath = path.join(__dirname, '../logs/api.log');
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${JSON.stringify(activity)}\n`;
    fs.appendFile(logPath, logEntry, err => {
      if (err) console.error('Failed to write API log:', err);
    });
  }
}

module.exports = new ShipwayService(); 