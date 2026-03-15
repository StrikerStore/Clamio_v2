const { ShipwayCarrierService } = require('./shipwayCarrierService');
const ShiprocketService = require('./shiprocketService');
const database = require('../config/database');
const logger = require('../utils/logger');

class CarrierSyncService {
  constructor() {
    this.isRunning = false;
  }

  /**
   * Start the carrier sync process - STORE SPECIFIC
   * Syncs carriers for each active store separately
   * Supports both Shipway and Shiprocket shipping partners
   */
  async startCarrierSync() {
    if (this.isRunning) {
      logger.info('🔄 Carrier sync already running, skipping...');
      return { success: false, message: 'Carrier sync already in progress' };
    }

    this.isRunning = true;
    
    try {
      logger.info('🚀 CARRIER SYNC: Starting store-specific carrier sync...');
      
      // Wait for MySQL initialization
      await database.waitForMySQLInitialization();
      
      // Get all active stores
      const activeStores = await database.getActiveStores();
      
      if (activeStores.length === 0) {
        logger.info('⚠️ CARRIER SYNC: No active stores found');
        return {
          success: true,
          message: 'No active stores to sync',
          carrierCount: 0,
          storeResults: [],
          totalCarriers: 0,
          timestamp: new Date().toISOString()
        };
      }
      
      logger.info(`📦 Found ${activeStores.length} active store(s) to sync`);
      
      // Sync carriers for all stores in PARALLEL for better speed
      const syncPromises = activeStores.map(async (store) => {
        try {
          const shippingPartner = (store.shipping_partner || 'Shipway').toLowerCase();
          logger.info(`\n🔄 [${store.account_code}] Syncing carriers for "${store.store_name}" (${shippingPartner})...`);
          
          let result;
          if (shippingPartner === 'shiprocket') {
            const shiprocketService = new ShiprocketService(store.account_code);
            result = await shiprocketService.syncCarriersToMySQL();
          } else {
            const carrierService = new ShipwayCarrierService(store.account_code);
            result = await carrierService.syncCarriersToMySQL();
          }
          
          const carrierCount = result.carrierCount || result.total || 0;
          
          logger.info(`✅ [${store.account_code}] Carriers synced: ${carrierCount} (${shippingPartner})`);
          
          return {
            accountCode: store.account_code,
            storeName: store.store_name,
            shippingPartner: shippingPartner,
            carrierCount: carrierCount,
            success: true
          };
          
        } catch (storeError) {
          logger.error(`❌ [${store.account_code}] Carrier sync failed:`, storeError.message);
          return {
            accountCode: store.account_code,
            storeName: store.store_name,
            carrierCount: 0,
            success: false,
            error: storeError.message
          };
        }
      });
      
      // Execute all store syncs in parallel
      const storeResults = await Promise.allSettled(syncPromises);
      
      // Process results
      const processedResults = storeResults.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            accountCode: activeStores[index].account_code,
            storeName: activeStores[index].store_name,
            carrierCount: 0,
            success: false,
            error: result.reason?.message || 'Unknown error'
          };
        }
      });
      
      const totalCarriers = processedResults.reduce((sum, r) => sum + (r.carrierCount || 0), 0);
      
      logger.info('\n✅ CARRIER SYNC: Completed');
      
      // Show per-store breakdown
      processedResults.forEach(result => {
        if (result.success) {
        } else {
        }
      });
      
      return {
        success: true,
        message: `Carrier sync completed for ${activeStores.length} store(s)`,
        carrierCount: totalCarriers,
        database: 'MySQL',
        storeResults: processedResults,
        totalCarriers: totalCarriers,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('💥 CARRIER SYNC: Failed:', error.message);
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
   * Get sync status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new CarrierSyncService(); 