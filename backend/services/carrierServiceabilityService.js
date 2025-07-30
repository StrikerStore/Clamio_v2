require('dotenv').config();
const axios = require('axios');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

class CarrierServiceabilityService {
  constructor() {
    this.serviceabilityApiUrl = 'https://app.shipway.com/api/pincodeserviceable';
    this.ordersExcelPath = path.join(__dirname, '../data/orders.xlsx');
    this.carrierExcelPath = path.join(__dirname, '../data/carrier.xlsx');
    this.basicAuthHeader = process.env.SHIPWAY_BASIC_AUTH_HEADER;
  }

  /**
   * Check serviceability for a specific pincode
   * @param {string} pincode - The pincode to check
   * @returns {Promise<Array>} Array of serviceable carriers
   */
  async checkServiceability(pincode) {
    try {
      console.log(`🔵 CARRIER SERVICEABILITY: Checking serviceability for pincode ${pincode}...`);
      
      if (!this.basicAuthHeader) {
        throw new Error('Shipway API configuration error. SHIPWAY_BASIC_AUTH_HEADER not found in environment variables.');
      }
      
      const response = await axios.get(`${this.serviceabilityApiUrl}?pincode=${pincode}`, {
        timeout: 30000, // 30 seconds timeout
        headers: {
          'Authorization': this.basicAuthHeader,
          'Content-Type': 'application/json',
          'User-Agent': 'Clamio-Carrier-Service/1.0'
        }
      });

      console.log('✅ CARRIER SERVICEABILITY: API response received');
      console.log('  - Status:', response.status);
      console.log('  - Success:', response.data.success);

      if (response.data.success !== 1) {
        throw new Error(`Serviceability check failed: ${response.data.error || 'Unknown error'}`);
      }

      const serviceableCarriers = response.data.message || [];
      console.log(`  - Serviceable carriers found: ${serviceableCarriers.length}`);

      return serviceableCarriers;
    } catch (error) {
      console.error('💥 CARRIER SERVICEABILITY: Error checking serviceability:', error.message);
      
      if (error.response) {
        console.error('  - Response status:', error.response.status);
        console.error('  - Response data:', error.response.data);
        
        if (error.response.status === 401) {
          throw new Error('Authentication failed. Please check your SHIPWAY_BASIC_AUTH_HEADER configuration.');
        } else if (error.response.status === 403) {
          throw new Error('Access forbidden. Please check your API permissions.');
        } else if (error.response.status === 404) {
          throw new Error('Serviceability API endpoint not found. Please verify the API URL.');
        }
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        throw new Error('Unable to connect to Shipway API. Please check your internet connection.');
      } else if (error.code === 'ETIMEDOUT') {
        throw new Error('Request to Shipway API timed out. Please try again.');
      }
      
      throw new Error(`Failed to check serviceability for pincode ${pincode}: ${error.message}`);
    }
  }

  /**
   * Read orders from Excel file
   * @returns {Array} Array of order data
   */
  readOrdersFromExcel() {
    try {
      if (!fs.existsSync(this.ordersExcelPath)) {
        console.log('📝 CARRIER SERVICEABILITY: Orders Excel file does not exist');
        return [];
      }

      const workbook = XLSX.readFile(this.ordersExcelPath);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const orders = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      console.log('✅ CARRIER SERVICEABILITY: Orders loaded from Excel');
      console.log('  - Total orders:', orders.length);

      return orders;
    } catch (error) {
      console.error('💥 CARRIER SERVICEABILITY: Error reading orders from Excel:', error.message);
      throw new Error(`Failed to read orders from Excel: ${error.message}`);
    }
  }

  /**
   * Read carriers from Excel file
   * @returns {Array} Array of carrier data
   */
  readCarriersFromExcel() {
    try {
      if (!fs.existsSync(this.carrierExcelPath)) {
        console.log('📝 CARRIER SERVICEABILITY: Carrier Excel file does not exist');
        return [];
      }

      const workbook = XLSX.readFile(this.carrierExcelPath);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const carriers = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      console.log('✅ CARRIER SERVICEABILITY: Carriers loaded from Excel');
      console.log('  - Total carriers:', carriers.length);

      return carriers;
    } catch (error) {
      console.error('💥 CARRIER SERVICEABILITY: Error reading carriers from Excel:', error.message);
      throw new Error(`Failed to read carriers from Excel: ${error.message}`);
    }
  }

  /**
   * Find the highest priority carrier for a given payment type
   * @param {Array} serviceableCarriers - Array of serviceable carriers from API
   * @param {Array} carrierData - Array of carrier data from Excel
   * @param {string} paymentType - Payment type to match
   * @returns {Object|null} Carrier with highest priority or null if not found
   */
  findHighestPriorityCarrier(serviceableCarriers, carrierData, paymentType) {
    try {
      console.log(`🔍 CARRIER SERVICEABILITY: Finding highest priority carrier for payment type: ${paymentType}`);
      
      // Create a map of carrier data for quick lookup
      const carrierMap = new Map(carrierData.map(carrier => [carrier.carrier_id, carrier]));
      
      // Filter serviceable carriers by payment type
      const matchingCarriers = serviceableCarriers.filter(carrier => 
        carrier.payment_type === paymentType
      );
      
      console.log(`  - Serviceable carriers with payment type ${paymentType}: ${matchingCarriers.length}`);
      
      if (matchingCarriers.length === 0) {
        console.log(`  - No carriers found with payment type ${paymentType}`);
        return null;
      }
      
      // Find carriers that exist in our carrier data
      const validCarriers = matchingCarriers.filter(carrier => 
        carrierMap.has(carrier.carrier_id)
      );
      
      console.log(`  - Valid carriers in our data: ${validCarriers.length}`);
      
      if (validCarriers.length === 0) {
        console.log(`  - No valid carriers found in our data for payment type ${paymentType}`);
        return null;
      }
      
      // Find the carrier with the highest priority (lowest priority number)
      let highestPriorityCarrier = null;
      let highestPriority = -1;
      
      validCarriers.forEach(carrier => {
        const carrierInfo = carrierMap.get(carrier.carrier_id);
        const priority = parseInt(carrierInfo.priority) || 0;
        
        if (highestPriority === -1 || priority < highestPriority) {
          highestPriority = priority;
          highestPriorityCarrier = {
            carrier_id: carrier.carrier_id,
            name: carrier.name,
            payment_type: carrier.payment_type,
            priority: priority
          };
        }
      });
      
      console.log(`  - Selected carrier: ${highestPriorityCarrier.carrier_id} with priority ${highestPriorityCarrier.priority}`);
      
      return highestPriorityCarrier;
    } catch (error) {
      console.error('💥 CARRIER SERVICEABILITY: Error finding highest priority carrier:', error.message);
      throw new Error(`Failed to find highest priority carrier: ${error.message}`);
    }
  }

  /**
   * Save orders back to Excel file with priority_carrier column
   * @param {Array} orders - Array of order data with priority_carrier column
   */
  saveOrdersToExcel(orders) {
    try {
      console.log('🔵 CARRIER SERVICEABILITY: Saving orders to Excel...');
      
      // Create backup if file exists
      if (fs.existsSync(this.ordersExcelPath)) {
        const backupPath = this.ordersExcelPath.replace('.xlsx', '_backup.xlsx');
        fs.copyFileSync(this.ordersExcelPath, backupPath);
        console.log('  - Backup created:', backupPath);
      }

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(orders);

      // Set column widths (adjust as needed)
      const columnWidths = [
        { wch: 15 }, // order_id
        { wch: 20 }, // pincode
        { wch: 15 }, // payment_type
        { wch: 20 }, // priority_carrier
        // Add more column widths as needed
      ];
      worksheet['!cols'] = columnWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');

      // Write to file
      XLSX.writeFile(workbook, this.ordersExcelPath);
      
      console.log('✅ CARRIER SERVICEABILITY: Orders saved to Excel');
      console.log('  - File path:', this.ordersExcelPath);
      console.log('  - Total orders saved:', orders.length);

      return {
        success: true,
        message: `Successfully saved ${orders.length} orders to Excel with priority_carrier column`,
        filePath: this.ordersExcelPath,
        orderCount: orders.length
      };
    } catch (error) {
      console.error('💥 CARRIER SERVICEABILITY: Error saving to Excel:', error.message);
      throw new Error(`Failed to save orders to Excel: ${error.message}`);
    }
  }

  /**
   * Main function to assign priority carriers to all orders
   * @returns {Promise<Object>} Result of the operation
   */
  async assignPriorityCarriersToOrders() {
    try {
      console.log('🔵 CARRIER SERVICEABILITY: Starting priority carrier assignment...');
      
      // Read orders and carriers from Excel
      const orders = this.readOrdersFromExcel();
      const carriers = this.readCarriersFromExcel();
      
      if (orders.length === 0) {
        throw new Error('No orders found in Excel file');
      }
      
      if (carriers.length === 0) {
        throw new Error('No carriers found in Excel file');
      }
      
      console.log(`📊 Processing ${orders.length} orders with ${carriers.length} carriers`);
      
      // Filter only claimed orders
      const claimedOrders = orders.filter(order => 
        order.status === 'claimed' && order.claimed_by && order.claimed_by.trim() !== ''
      );
      
      console.log(`📊 Total orders: ${orders.length}`);
      console.log(`📊 Claimed orders: ${claimedOrders.length}`);
      console.log(`📊 Unclaimed orders: ${orders.length - claimedOrders.length}`);
      
      if (claimedOrders.length === 0) {
        console.log('⚠️ No claimed orders found. No serviceability checks needed.');
        return {
          success: true,
          message: 'No claimed orders found. No carrier assignment needed.',
          filePath: this.ordersExcelPath,
          orderCount: orders.length,
          summary: {
            totalOrders: orders.length,
            assignedCarriers: 0,
            skippedOrders: 0,
            successRate: '0.00%'
          }
        };
      }
      
      // Track unique pincodes from claimed orders only
      const uniquePincodes = new Set();
      const pincodeServiceabilityMap = new Map();
      
      // Collect unique pincodes from claimed orders only
      claimedOrders.forEach(order => {
        if (order.pincode) {
          uniquePincodes.add(order.pincode);
        }
      });
      
      console.log(`📊 Unique pincodes from claimed orders: ${uniquePincodes.size}`);
      console.log(`📊 Pincodes: ${Array.from(uniquePincodes).join(', ')}`);
      
      // Check serviceability for each unique pincode from claimed orders
      for (const pincode of uniquePincodes) {
        try {
          console.log(`\n🔍 Checking serviceability for pincode: ${pincode}`);
          const serviceableCarriers = await this.checkServiceability(pincode);
          pincodeServiceabilityMap.set(pincode, serviceableCarriers);
          
          console.log(`  - Serviceable carriers: ${serviceableCarriers.length}`);
          serviceableCarriers.forEach(carrier => {
            console.log(`    * ${carrier.carrier_id} - ${carrier.name} (${carrier.payment_type})`);
          });
        } catch (error) {
          console.error(`  - Error checking serviceability for pincode ${pincode}:`, error.message);
          // Continue with other pincodes
          pincodeServiceabilityMap.set(pincode, []);
        }
      }
      
      // Process each order and assign priority carrier
      let processedOrders = 0;
      let assignedCarriers = 0;
      let skippedOrders = 0;
      let unclaimedOrders = 0;
      
      const updatedOrders = orders.map(order => {
        try {
          // Check if order is claimed
          const isClaimed = order.status === 'claimed' && order.claimed_by && order.claimed_by.trim() !== '';
          
          if (!isClaimed) {
            // For unclaimed orders, preserve existing priority_carrier or leave empty
            unclaimedOrders++;
            return {
              ...order,
              priority_carrier: order.priority_carrier || ''
            };
          }
          
          // Process only claimed orders
          const pincode = order.pincode;
          const paymentType = order.payment_type;
          
          if (!pincode || !paymentType) {
            console.log(`⚠️ Order ${order.order_id}: Missing pincode or payment_type`);
            skippedOrders++;
            return {
              ...order,
              priority_carrier: ''
            };
          }
          
          const serviceableCarriers = pincodeServiceabilityMap.get(pincode) || [];
          
          if (serviceableCarriers.length === 0) {
            console.log(`⚠️ Order ${order.order_id}: No serviceable carriers for pincode ${pincode}`);
            skippedOrders++;
            return {
              ...order,
              priority_carrier: ''
            };
          }
          
          const selectedCarrier = this.findHighestPriorityCarrier(
            serviceableCarriers, 
            carriers, 
            paymentType
          );
          
          if (selectedCarrier) {
            console.log(`✅ Order ${order.order_id}: Assigned carrier ${selectedCarrier.carrier_id} (priority ${selectedCarrier.priority})`);
            assignedCarriers++;
            return {
              ...order,
              priority_carrier: selectedCarrier.carrier_id
            };
          } else {
            console.log(`⚠️ Order ${order.order_id}: No suitable carrier found for payment type ${paymentType}`);
            skippedOrders++;
            return {
              ...order,
              priority_carrier: ''
            };
          }
        } catch (error) {
          console.error(`💥 Error processing order ${order.order_id}:`, error.message);
          skippedOrders++;
          return {
            ...order,
            priority_carrier: ''
          };
        } finally {
          processedOrders++;
        }
      });
      
      // Save updated orders to Excel
      const result = this.saveOrdersToExcel(updatedOrders);
      
      console.log('\n🎉 CARRIER SERVICEABILITY: Priority carrier assignment completed!');
      console.log(`📊 Summary:`);
      console.log(`  - Total orders: ${processedOrders}`);
      console.log(`  - Claimed orders processed: ${claimedOrders.length}`);
      console.log(`  - Unclaimed orders preserved: ${unclaimedOrders}`);
      console.log(`  - Orders with assigned carriers: ${assignedCarriers}`);
      console.log(`  - Orders skipped: ${skippedOrders}`);
      console.log(`  - Success rate: ${((assignedCarriers / claimedOrders.length) * 100).toFixed(2)}%`);
      
      return {
        ...result,
        summary: {
          totalOrders: processedOrders,
          claimedOrders: claimedOrders.length,
          unclaimedOrders,
          assignedCarriers,
          skippedOrders,
          successRate: ((assignedCarriers / claimedOrders.length) * 100).toFixed(2) + '%'
        }
      };
    } catch (error) {
      console.error('💥 CARRIER SERVICEABILITY: Error assigning priority carriers:', error.message);
      throw error;
    }
  }

  /**
   * Assign priority carrier to a single claimed order
   * @param {string} orderId - The order ID to assign carrier to
   * @returns {Promise<Object>} Result of the assignment
   */
  async assignPriorityCarrierToOrder(orderId) {
    try {
      console.log(`🔵 CARRIER SERVICEABILITY: Assigning priority carrier to order ${orderId}...`);
      
      // Read orders and carriers from Excel
      const orders = this.readOrdersFromExcel();
      const carriers = this.readCarriersFromExcel();
      
      if (orders.length === 0) {
        throw new Error('No orders found in Excel file');
      }
      
      if (carriers.length === 0) {
        throw new Error('No carriers found in Excel file');
      }
      
      // Find the specific order
      const orderIndex = orders.findIndex(order => order.order_id === orderId);
      if (orderIndex === -1) {
        throw new Error(`Order ${orderId} not found`);
      }
      
      const order = orders[orderIndex];
      
      // Check if order is claimed
      if (!(order.status === 'claimed' && order.claimed_by && order.claimed_by.trim() !== '')) {
        throw new Error(`Order ${orderId} is not claimed`);
      }
      
      console.log(`📊 Processing claimed order: ${orderId}`);
      console.log(`  - Pincode: ${order.pincode}`);
      console.log(`  - Payment Type: ${order.payment_type}`);
      console.log(`  - Claimed by: ${order.claimed_by}`);
      
      // Check serviceability for this specific pincode
      const pincode = order.pincode;
      const paymentType = order.payment_type;
      
      if (!pincode || !paymentType) {
        throw new Error(`Order ${orderId}: Missing pincode or payment_type`);
      }
      
      console.log(`🔍 Checking serviceability for pincode: ${pincode}`);
      const serviceableCarriers = await this.checkServiceability(pincode);
      
      if (serviceableCarriers.length === 0) {
        throw new Error(`Order ${orderId}: No serviceable carriers for pincode ${pincode}`);
      }
      
      // Find the highest priority carrier
      const selectedCarrier = this.findHighestPriorityCarrier(
        serviceableCarriers, 
        carriers, 
        paymentType
      );
      
      if (!selectedCarrier) {
        throw new Error(`Order ${orderId}: No suitable carrier found for payment type ${paymentType}`);
      }
      
      // Update the order with the selected carrier
      orders[orderIndex].priority_carrier = selectedCarrier.carrier_id;
      
      // Save updated orders to Excel
      const result = this.saveOrdersToExcel(orders);
      
      console.log(`✅ Order ${orderId}: Assigned carrier ${selectedCarrier.carrier_id} (priority ${selectedCarrier.priority})`);
      
      return {
        success: true,
        message: `Successfully assigned carrier ${selectedCarrier.carrier_id} to order ${orderId}`,
        data: {
          order_id: orderId,
          carrier_id: selectedCarrier.carrier_id,
          carrier_name: selectedCarrier.name,
          priority: selectedCarrier.priority,
          pincode: pincode,
          payment_type: paymentType
        }
      };
      
    } catch (error) {
      console.error('💥 CARRIER SERVICEABILITY: Error assigning priority carrier to order:', error.message);
      throw error;
    }
  }

  /**
   * Assign priority carrier to a single order using in-memory data
   * @param {Object} order - The order object with updated status
   * @returns {Promise<Object>} Result of the assignment
   */
  async assignPriorityCarrierToOrderInMemory(order) {
    try {
      console.log(`🔵 CARRIER SERVICEABILITY: Assigning priority carrier to order ${order.order_id} (in-memory)...`);
      
      // Read carriers from Excel
      const carriers = this.readCarriersFromExcel();
      
      if (carriers.length === 0) {
        throw new Error('No carriers found in Excel file');
      }
      
      // Check if order is claimed
      if (!(order.status === 'claimed' && order.claimed_by && order.claimed_by.trim() !== '')) {
        throw new Error(`Order ${order.order_id} is not claimed`);
      }
      
      console.log(`📊 Processing claimed order: ${order.order_id}`);
      console.log(`  - Pincode: ${order.pincode}`);
      console.log(`  - Payment Type: ${order.payment_type}`);
      console.log(`  - Claimed by: ${order.claimed_by}`);
      
      // Check serviceability for this specific pincode
      const pincode = order.pincode;
      const paymentType = order.payment_type;
      
      if (!pincode || !paymentType) {
        throw new Error(`Order ${order.order_id}: Missing pincode or payment_type`);
      }
      
      console.log(`🔍 Checking serviceability for pincode: ${pincode}`);
      const serviceableCarriers = await this.checkServiceability(pincode);
      
      if (serviceableCarriers.length === 0) {
        throw new Error(`Order ${order.order_id}: No serviceable carriers for pincode ${pincode}`);
      }
      
      // Find the highest priority carrier
      const selectedCarrier = this.findHighestPriorityCarrier(
        serviceableCarriers, 
        carriers, 
        paymentType
      );
      
      if (!selectedCarrier) {
        throw new Error(`Order ${order.order_id}: No suitable carrier found for payment type ${paymentType}`);
      }
      
      console.log(`✅ Order ${order.order_id}: Assigned carrier ${selectedCarrier.carrier_id} (priority ${selectedCarrier.priority})`);
      
      return {
        success: true,
        message: `Successfully assigned carrier ${selectedCarrier.carrier_id} to order ${order.order_id}`,
        data: {
          order_id: order.order_id,
          carrier_id: selectedCarrier.carrier_id,
          carrier_name: selectedCarrier.name,
          priority: selectedCarrier.priority,
          pincode: pincode,
          payment_type: paymentType
        }
      };
      
    } catch (error) {
      console.error('💥 CARRIER SERVICEABILITY: Error assigning priority carrier to order (in-memory):', error.message);
      throw error;
    }
  }

  /**
   * Get statistics about the assignment process
   * @returns {Object} Statistics about orders and carriers
   */
  getAssignmentStatistics() {
    try {
      const orders = this.readOrdersFromExcel();
      const carriers = this.readCarriersFromExcel();
      
      const claimedOrders = orders.filter(order => 
        order.status === 'claimed' && order.claimed_by && order.claimed_by.trim() !== ''
      );
      const unclaimedOrders = orders.filter(order => 
        !(order.status === 'claimed' && order.claimed_by && order.claimed_by.trim() !== '')
      );
      
      const ordersWithCarrier = orders.filter(order => order.priority_carrier && order.priority_carrier.trim() !== '');
      const ordersWithoutCarrier = orders.filter(order => !order.priority_carrier || order.priority_carrier.trim() === '');
      
      const uniquePincodes = new Set(orders.map(order => order.pincode).filter(Boolean));
      const uniquePaymentTypes = new Set(orders.map(order => order.payment_type).filter(Boolean));
      
      const carrierUsage = {};
      ordersWithCarrier.forEach(order => {
        const carrierId = order.priority_carrier;
        carrierUsage[carrierId] = (carrierUsage[carrierId] || 0) + 1;
      });
      
      return {
        success: true,
        orders: {
          total: orders.length,
          claimed: claimedOrders.length,
          unclaimed: unclaimedOrders.length,
          withCarrier: ordersWithCarrier.length,
          withoutCarrier: ordersWithoutCarrier.length,
          successRate: ((ordersWithCarrier.length / orders.length) * 100).toFixed(2) + '%'
        },
        carriers: {
          total: carriers.length,
          used: Object.keys(carrierUsage).length,
          usage: carrierUsage
        },
        pincodes: {
          total: uniquePincodes.size,
          list: Array.from(uniquePincodes)
        },
        paymentTypes: {
          total: uniquePaymentTypes.size,
          list: Array.from(uniquePaymentTypes)
        }
      };
    } catch (error) {
      console.error('Error getting assignment statistics:', error);
      throw error;
    }
  }
}

module.exports = new CarrierServiceabilityService(); 