const axios = require('axios');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

/**
 * Pincode Serviceability Service
 * Handles checking carrier serviceability at pincodes and assigning carriers to orders
 */
class PincodeServiceabilityService {
  constructor() {
    this.baseURL = process.env.SHIPWAY_API_BASE_URL || 'https://app.shipway.com/api';
    this.basicAuthHeader = process.env.SHIPWAY_BASIC_AUTH_HEADER;
    this.rawOrdersPath = path.join(__dirname, '../data/raw_shipway_orders.json');
    this.carrierExcelPath = path.join(__dirname, '../data/logistic_carrier.xlsx');
    this.priorityExcelPath = path.join(__dirname, '../data/logistic_priority.xlsx');
    this.postOrdersPath = path.join(__dirname, '../data/post_shipway_orders.json');
  }

  /**
   * Check carrier serviceability at a pincode
   * @param {string} pincode - The pincode to check serviceability for
   * @returns {Array} Array of serviceable carrier IDs
   */
  async checkPincodeServiceability(pincode) {
    try {
      if (!pincode) {
        throw new Error('Pincode is required');
      }

      if (!this.basicAuthHeader) {
        throw new Error('Shipway API configuration error. Please contact administrator.');
      }

      const url = `${this.baseURL}/pincodeserviceable`;
      const params = { pincode };

      this.logApiActivity({
        type: 'pincode-serviceability-request',
        pincode,
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
        timeout: 15000 // 15 second timeout
      });

      this.logApiActivity({
        type: 'pincode-serviceability-response',
        pincode,
        status: response.status,
        dataType: typeof response.data,
        dataKeys: response.data && typeof response.data === 'object' ? Object.keys(response.data) : undefined
      });

      // Check if response is successful
      if (response.status !== 200) {
        throw new Error(`Shipway API returned status ${response.status}`);
      }

      const data = response.data;

      // Handle different response formats
      let serviceableCarriers = [];
      if (Array.isArray(data)) {
        serviceableCarriers = data;
      } else if (data && Array.isArray(data.carriers)) {
        serviceableCarriers = data.carriers;
      } else if (data && Array.isArray(data.message)) {
        serviceableCarriers = data.message;
      } else if (data && typeof data === 'object' && data.carrier_id) {
        serviceableCarriers = [data];
      } else if (data && typeof data === 'object' && Object.keys(data).length === 0) {
        // Empty response means no serviceability
        serviceableCarriers = [];
      } else {
        this.logApiActivity({
          type: 'pincode-serviceability-unexpected-format',
          pincode,
          data: data
        });
        throw new Error('Unexpected pincode serviceability API response format');
      }

      return serviceableCarriers;

    } catch (error) {
      this.logApiActivity({
        type: 'pincode-serviceability-error',
        pincode,
        error: error.message,
        stack: error.stack,
      });
      console.error('Error checking pincode serviceability:', error.message);
      
      // Handle specific error cases
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        throw new Error('Unable to connect to Shipway API. Please check your internet connection.');
      }
      
      if (error.code === 'ETIMEDOUT') {
        throw new Error('Request to Shipway API timed out. Please try again.');
      }

      if (error.response) {
        const status = error.response.status;
        if (status === 401) {
          throw new Error('Invalid Shipway API credentials. Please check your configuration.');
        } else if (status === 404) {
          throw new Error('Pincode serviceability endpoint not found.');
        } else if (status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        } else {
          throw new Error(`Shipway API error: ${error.response.data?.message || `Status ${status}`}`);
        }
      }

      throw new Error('Failed to check pincode serviceability');
    }
  }

  /**
   * Get carrier priorities from logistic_priority.xlsx file
   * @returns {Map} Map of carrier_id to priority (lower number = higher priority)
   */
  getCarrierPriorities() {
    try {
      if (!fs.existsSync(this.priorityExcelPath)) {
        console.log(`⚠️  Priority file not found at: ${this.priorityExcelPath}`);
        console.log('💡 Using carrier Excel file for priorities...');
        return this.getCarrierPrioritiesFromCarrierFile();
      }

      console.log(`📁 Reading priorities from: ${this.priorityExcelPath}`);
      const workbook = XLSX.readFile(this.priorityExcelPath);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const priorities = XLSX.utils.sheet_to_json(worksheet);

      const priorityMap = new Map();
      
      priorities.forEach(priority => {
        const carrierId = priority.carrier_id;
        const priorityValue = priority.priority;
        
        if (carrierId && priorityValue && priorityValue !== '') {
          // Convert priority to number, lower number = higher priority
          const priorityNum = parseInt(priorityValue, 10);
          if (!isNaN(priorityNum)) {
            priorityMap.set(carrierId.toString(), priorityNum);
          }
        }
      });

      console.log(`🏆 Loaded ${priorityMap.size} priorities from logistic_priority.xlsx`);
      return priorityMap;
    } catch (error) {
      console.error('Error reading logistics priority file:', error);
      console.log('💡 Falling back to carrier Excel file...');
      return this.getCarrierPrioritiesFromCarrierFile();
    }
  }

  /**
   * Get carrier priorities from logistic_carrier.xlsx file (fallback)
   * @returns {Map} Map of carrier_id to priority (lower number = higher priority)
   */
  getCarrierPrioritiesFromCarrierFile() {
    try {
      if (!fs.existsSync(this.carrierExcelPath)) {
        throw new Error('Carrier Excel file not found');
      }

      const workbook = XLSX.readFile(this.carrierExcelPath);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const carriers = XLSX.utils.sheet_to_json(worksheet);

      const priorityMap = new Map();
      
      carriers.forEach(carrier => {
        const carrierId = carrier.carrier_id;
        const priority = carrier.priority;
        
        if (carrierId && priority && priority !== '') {
          // Convert priority to number, lower number = higher priority
          const priorityNum = parseInt(priority, 10);
          if (!isNaN(priorityNum)) {
            priorityMap.set(carrierId.toString(), priorityNum);
          }
        }
      });

      console.log(`🏆 Loaded ${priorityMap.size} priorities from logistic_carrier.xlsx`);
      return priorityMap;
    } catch (error) {
      console.error('Error reading carrier priorities:', error);
      return new Map();
    }
  }

  /**
   * Sort serviceable carriers by priority
   * @param {Array} serviceableCarriers - Array of serviceable carrier IDs
   * @param {Map} priorityMap - Map of carrier_id to priority
   * @returns {Array} Sorted array of carrier IDs by priority
   */
  sortCarriersByPriority(serviceableCarriers, priorityMap) {
    try {
      return serviceableCarriers.sort((a, b) => {
        const carrierA = typeof a === 'object' ? a.carrier_id : a;
        const carrierB = typeof b === 'object' ? b.carrier_id : b;
        
        const priorityA = priorityMap.get(carrierA?.toString()) || 999; // Default low priority
        const priorityB = priorityMap.get(carrierB?.toString()) || 999; // Default low priority
        
        return priorityA - priorityB; // Lower number = higher priority
      });
    } catch (error) {
      console.error('Error sorting carriers by priority:', error);
      return serviceableCarriers; // Return unsorted if error
    }
  }

  /**
   * Get highest priority carrier from serviceable carriers
   * @param {Array} serviceableCarriers - Array of serviceable carrier IDs
   * @param {Map} priorityMap - Map of carrier_id to priority
   * @returns {string|null} Highest priority carrier ID or null if no carriers
   */
  getHighestPriorityCarrier(serviceableCarriers, priorityMap) {
    try {
      if (!serviceableCarriers || serviceableCarriers.length === 0) {
        return null;
      }

      const sortedCarriers = this.sortCarriersByPriority(serviceableCarriers, priorityMap);
      const firstCarrier = sortedCarriers[0];
      
      // Extract carrier_id if it's an object
      return typeof firstCarrier === 'object' ? firstCarrier.carrier_id : firstCarrier;
    } catch (error) {
      console.error('Error getting highest priority carrier:', error);
      return null;
    }
  }

  /**
   * Process orders and assign carriers - Simple and direct flow
   * @returns {Object} Result object with success status and count
   */
  async processOrdersAndAssignCarriers() {
    try {
      console.log('🔄 Starting Pincode Serviceability Processing...');
      
      // Step 1: Get all carrier details first
      console.log('📋 Step 1: Getting carrier details...');
      if (!fs.existsSync(this.carrierExcelPath)) {
        throw new Error('Carrier Excel file not found. Please fetch carriers first.');
      }
      console.log('✅ Carrier details loaded');

      // Step 2: Load carrier priorities from logistic_priority.xlsx
      console.log('📋 Step 2: Loading carrier priorities...');
      const priorityMap = this.getCarrierPriorities();
      console.log(`🏆 Loaded ${priorityMap.size} carrier priorities`);

      // Step 3: Read raw orders and extract order_id and s_zipcode
      console.log('📋 Step 3: Reading raw orders...');
      if (!fs.existsSync(this.rawOrdersPath)) {
        throw new Error('Raw orders file not found. Please fetch orders first.');
      }
      
      const rawOrdersData = JSON.parse(fs.readFileSync(this.rawOrdersPath, 'utf8'));
      console.log(`📦 Found ${rawOrdersData.length} orders`);

      // Step 4: Process each order
      console.log('📋 Step 4: Processing orders...');
      const processedOrders = [];
      let processedCount = 0;

      for (const order of rawOrdersData) {
        const orderId = order.order_id;
        const sZipcode = order.s_zipcode;

        if (!orderId || !sZipcode) {
          console.log(`⚠️  Order ${orderId} missing required fields, skipping`);
          processedOrders.push({ ...order, carrier_id: null });
          continue;
        }

        try {
          // Check serviceability for this order's pincode
          const serviceableCarriers = await this.checkPincodeServiceability(sZipcode);
          
          // Assign top priority carrier
          let assignedCarrierId = null;
          if (serviceableCarriers.length > 0) {
            assignedCarrierId = this.getHighestPriorityCarrier(serviceableCarriers, priorityMap);
          }

          // Add carrier_id to order
          const processedOrder = { ...order, carrier_id: assignedCarrierId };
          processedOrders.push(processedOrder);

          console.log(`✅ Order ${orderId} (${sZipcode}) → Carrier ${assignedCarrierId || 'None'}`);
          processedCount++;

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          console.error(`❌ Error processing order ${orderId}:`, error.message);
          processedOrders.push({ ...order, carrier_id: null });
        }
      }

      // Step 5: Save to post_shipway_orders.json
      console.log('📋 Step 5: Saving results...');
      fs.writeFileSync(this.postOrdersPath, JSON.stringify(processedOrders, null, 2));
      console.log(`✅ Saved ${processedOrders.length} orders to ${this.postOrdersPath}`);

      return {
        success: true,
        totalOrders: rawOrdersData.length,
        processedCount,
        outputFile: this.postOrdersPath
      };

    } catch (error) {
      console.error('❌ Error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Log API activity
   * @param {Object} activity - Activity data to log
   */
  logApiActivity(activity) {
    const logPath = path.join(__dirname, '../logs/api.log');
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${JSON.stringify(activity)}\n`;
    fs.appendFile(logPath, logEntry, err => {
      if (err) console.error('Failed to write API log:', err);
    });
  }
}

module.exports = new PincodeServiceabilityService(); 