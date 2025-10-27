/**
 * Auto Manifest Service
 * Handles automatic manifest creation for orders that are handed over but not marked as ready
 */
class AutoManifestService {
  constructor() {
    this.isRunning = false;
  }

  /**
   * Process auto-manifest for orders that need it
   * Called when is_handover becomes 1 but is_manifest is still 0
   */
  async processAutoManifest() {
    if (this.isRunning) {
      console.log('🔄 [Auto-Manifest] Process already running, skipping...');
      return { success: false, message: 'Auto-manifest process already in progress' };
    }

    this.isRunning = true;
    
    try {
      console.log('🚀 [Auto-Manifest] Starting auto-manifest process...');
      
      const database = require('../config/database');
      await database.waitForMySQLInitialization();
      
      if (!database.isMySQLAvailable()) {
        throw new Error('Database connection not available');
      }

      // Get orders that need auto-manifest
      const ordersNeedingManifest = await database.getOrdersNeedingAutoManifest();
      console.log(`📦 [Auto-Manifest] Found ${ordersNeedingManifest.length} orders needing auto-manifest`);
      
      // Log details of orders that need manifesting
      if (ordersNeedingManifest.length > 0) {
        console.log('📋 [Auto-Manifest] Orders needing manifest:');
        ordersNeedingManifest.forEach((order, index) => {
          console.log(`  ${index + 1}. Order ${order.order_id} - ${order.customer_name} - ${order.product_name}`);
          console.log(`     Status: ${order.current_shipment_status}, Handover: ${order.is_handover}, AWB: ${order.awb || 'N/A'}`);
        });
      }

      if (ordersNeedingManifest.length === 0) {
        console.log('✅ [Auto-Manifest] No orders need auto-manifest');
        return {
          success: true,
          message: 'No orders need auto-manifest',
          processed: 0,
          successCount: 0,
          errorCount: 0
        };
      }

      let successCount = 0;
      let errorCount = 0;

      // Process orders in batches using bulk API
      const batchSize = 10; // Increased batch size since we're using bulk API
      for (let i = 0; i < ordersNeedingManifest.length; i += batchSize) {
        const batch = ordersNeedingManifest.slice(i, i + batchSize);
        const orderIds = batch.map(order => order.order_id);
        
        console.log(`🔄 [Auto-Manifest] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(ordersNeedingManifest.length/batchSize)} (${batch.length} orders)`);
        console.log(`📦 [Auto-Manifest] Order IDs in batch: ${orderIds.join(', ')}`);
        
        try {
          // Collect AWB numbers for all orders in batch
          const orderDetails = batch.map(order => ({
            order_id: order.order_id,
            awb: order.awb,
            customer_name: order.customer_name,
            current_shipment_status: order.current_shipment_status
          }));
          
          console.log(`📦 [Auto-Manifest] Batch details:`);
          orderDetails.forEach(order => {
            console.log(`  - Order ${order.order_id}: AWB=${order.awb || 'N/A'}, Customer=${order.customer_name}, Status=${order.current_shipment_status}`);
          });
          
          // Call Shipway Create Manifest API with all orders in batch
          const manifestResponse = await this.callShipwayCreateManifestAPI(orderIds, orderDetails);
          
          if (manifestResponse.success) {
            // Update database for all successful orders
            const database = require('../config/database');
            for (const orderId of orderIds) {
              try {
                await database.updateManifestStatus(orderId, true);
                successCount++;
                console.log(`✅ [Auto-Manifest] Successfully created manifest for order ${orderId}`);
              } catch (dbError) {
                errorCount++;
                console.error(`❌ [Auto-Manifest] Failed to update database for order ${orderId}:`, dbError.message);
              }
            }
          } else {
            // If bulk API fails, try individual orders as fallback
            console.log(`⚠️ [Auto-Manifest] Bulk API failed, trying individual orders...`);
            for (const order of batch) {
              try {
                const individualResult = await this.processSingleOrderManifest(order);
                if (individualResult.success) {
                  successCount++;
                } else {
                  errorCount++;
                }
              } catch (error) {
                errorCount++;
                console.error(`❌ [Auto-Manifest] Failed to process order ${order.order_id}:`, error.message);
              }
            }
          }
        } catch (error) {
          console.error(`❌ [Auto-Manifest] Batch processing failed:`, error.message);
          errorCount += batch.length;
        }

        // Small delay between batches to be respectful to the API
        if (i + batchSize < ordersNeedingManifest.length) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Reduced delay since we're making fewer API calls
        }
      }

      console.log(`✅ [Auto-Manifest] Process completed: ${successCount} success, ${errorCount} errors`);
      
      return {
        success: true,
        message: 'Auto-manifest process completed',
        processed: ordersNeedingManifest.length,
        successCount,
        errorCount,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('💥 [Auto-Manifest] Process failed:', error.message);
      return {
        success: false,
        message: error.message,
        timestamp: new Date().toISOString()
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process manifest for a single order
   * @param {Object} order - Order object with order_id and other details
   */
  async processSingleOrderManifest(order) {
    try {
      console.log(`🔄 [Auto-Manifest] Processing order: ${order.order_id}`);
      
      const database = require('../config/database');
      
      // Call Shipway Create Manifest API
      const manifestResponse = await this.callShipwayCreateManifestAPI([order.order_id]);
      
      if (!manifestResponse.success) {
        throw new Error(`Manifest API failed: ${manifestResponse.message}`);
      }
      
      // Update is_manifest = 1 in database
      await database.updateManifestStatus(order.order_id, true);
      
      console.log(`✅ [Auto-Manifest] Successfully created manifest for order ${order.order_id}`);
      
      return {
        success: true,
        message: 'Manifest created successfully',
        orderId: order.order_id
      };
      
    } catch (error) {
      console.error(`❌ [Auto-Manifest] Failed to process order ${order.order_id}:`, error.message);
      return {
        success: false,
        message: error.message,
        orderId: order.order_id
      };
    }
  }

  /**
   * Call Shipway Create Manifest API (Bulk)
   * @param {Array} orderIds - Array of order IDs to manifest in bulk
   * @param {Array} orderDetails - Array of order details with AWB numbers (optional)
   */
  async callShipwayCreateManifestAPI(orderIds, orderDetails = null) {
    try {
      console.log(`🔄 [Auto-Manifest] Calling Shipway Create Manifest API (Bulk)`);
      console.log(`📦 [Auto-Manifest] Processing ${orderIds.length} orders: ${orderIds.join(', ')}`);
      
      const basicAuthHeader = process.env.SHIPWAY_BASIC_AUTH_HEADER;
      if (!basicAuthHeader) {
        throw new Error('SHIPWAY_BASIC_AUTH_HEADER not found in environment variables');
      }

      const requestBody = {
        order_ids: orderIds
      };

      // If we have order details with AWB numbers, include them in the request
      if (orderDetails && orderDetails.length > 0) {
        const awbNumbers = orderDetails
          .filter(order => order.awb && order.awb.trim() !== '')
          .map(order => order.awb);
        
        if (awbNumbers.length > 0) {
          requestBody.awb_numbers = awbNumbers;
          console.log(`📦 [Auto-Manifest] Including AWB numbers: ${awbNumbers.join(', ')}`);
        }
      }

      console.log('📤 [Auto-Manifest] Bulk Manifest API Request:', requestBody);

      const response = await fetch('https://app.shipway.com/api/Createmanifest/', {
        method: 'POST',
        headers: {
          'Authorization': basicAuthHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        timeout: 30000
      });

      const data = await response.json();

      console.log('📦 [Auto-Manifest] Manifest API Response:', data);

      if (!response.ok || data.success !== 1) {
        throw new Error(`Shipway Create Manifest API error: ${data.message || response.statusText}`);
      }

      console.log(`✅ [Auto-Manifest] Shipway Create Manifest API call successful for ${orderIds.length} orders`);
      
      return {
        success: true,
        data: data,
        message: `Bulk manifest created successfully for ${orderIds.length} orders`,
        orderCount: orderIds.length
      };

    } catch (error) {
      console.error('❌ [Auto-Manifest] Shipway Create Manifest API call failed:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Get auto-manifest process status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new AutoManifestService();
