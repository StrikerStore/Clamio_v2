/**
 * Multi-Store Sync Service
 * Handles parallel synchronization of multiple Shipway accounts
 */

const database = require('../config/database');
const ShipwayService = require('./shipwayService');
const ShiprocketService = require('./shiprocketService');
const logger = require('../utils/logger');
const { ShipwayCarrierService } = require('./shipwayCarrierService');

class MultiStoreSyncService {
  
  /**
   * Sync all active stores in parallel
   * @param {number} concurrencyLimit - Max stores to sync at once (optional, for rate limiting)
   * @returns {Object} Sync results summary
   */
  async syncAllStores(concurrencyLimit = null) {
    const startTime = Date.now();
    
    try {
      logger.info('\n🚀 ========================================');
      logger.info('   MULTI-STORE SYNC STARTED');
      logger.info('========================================\n');
      
      // Get all active stores
      const activeStores = await database.getActiveStores();
      
      if (activeStores.length === 0) {
        logger.info('⚠️ No active stores found');
        return { 
          success: true, 
          message: 'No active stores to sync',
          totalStores: 0,
          successfulStores: 0,
          failedStores: 0,
          totalOrders: 0
        };
      }
      
      logger.info(`📦 Active stores found: ${activeStores.length}`);
      activeStores.forEach(store => {
      });
      logger.info('');
      
      let results;
      
      // Choose sync strategy based on store count and concurrency limit
      if (concurrencyLimit && activeStores.length > concurrencyLimit) {
        logger.info(`⚙️ Using batch processing (${concurrencyLimit} stores at a time)\n`);
        results = await this.syncInBatches(activeStores, concurrencyLimit);
      } else {
        logger.info(`⚙️ Using full parallel processing\n`);
        results = await this.syncInParallel(activeStores);
      }
      
      const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      logger.info('\n========================================');
      logger.info('   MULTI-STORE SYNC COMPLETED');
      logger.info(`   Duration: ${totalDuration}s`);
      logger.info(`   ✅ Success: ${results.successful.length}/${results.totalStores}`);
      logger.info(`   ❌ Failed: ${results.failed.length}/${results.totalStores}`);
      logger.info(`   📦 Total Orders: ${results.totalOrders}`);
      logger.info('========================================\n');
      
      if (results.failed.length > 0) {
        logger.info('⚠️ Failed stores:');
        results.failed.forEach(f => {
        });
        logger.info('');
      }
      
      return results;
      
    } catch (error) {
      logger.error('❌ Multi-store sync failed:', error);
      throw error;
    }
  }
  
  /**
   * Sync stores in full parallel (all at once)
   * Uses Promise.allSettled to ensure one failure doesn't stop others
   * @param {Array} stores - Array of store objects
   * @returns {Object} Processed results
   */
  async syncInParallel(stores) {
    // Create sync promises for all stores
    const syncPromises = stores.map(store => this.syncSingleStore(store));
    
    // Execute all in parallel
    const results = await Promise.allSettled(syncPromises);
    
    return this.processResults(results, stores);
  }
  
  /**
   * Sync stores in batches for controlled concurrency
   * @param {Array} stores - Array of store objects
   * @param {number} batchSize - Number of stores to sync concurrently
   * @returns {Object} Processed results
   */
  async syncInBatches(stores, batchSize) {
    const allResults = [];
    
    // Process stores in batches
    for (let i = 0; i < stores.length; i += batchSize) {
      const batch = stores.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(stores.length / batchSize);
      
      logger.info(`\n📦 Batch ${batchNumber}/${totalBatches}:`);
      logger.info(`   Stores: ${batch.map(s => s.store_name).join(', ')}\n`);
      
      // Sync batch in parallel
      const batchPromises = batch.map(store => this.syncSingleStore(store));
      const batchResults = await Promise.allSettled(batchPromises);
      
      allResults.push(...batchResults);
    }
    
    return this.processResults(allResults, stores);
  }
  
  /**
   * Sync a single store (orders + carriers + products)
   * @param {Object} store - Store object from database
   * @returns {Object} Sync result for this store
   */
  async syncSingleStore(store) {
    const startTime = Date.now();
    
    try {
      logger.info(`\n🔄 [${store.account_code}] Starting sync for "${store.store_name}"...`);
      
      let orderCount = 0;
      let carrierCount = 0;
      let productCount = 0;
      
      const shippingPartner = (store.shipping_partner || '').toLowerCase();
      
      // Sync orders based on shipping partner
      try {
        logger.info(`   📦 Syncing orders (${store.shipping_partner})...`);
        
        if (shippingPartner === 'shiprocket') {
          const shiprocketService = new ShiprocketService(store.account_code);
          const orderResult = await shiprocketService.syncOrdersToMySQL();
          orderCount = orderResult.count || 0;
        } else {
          // Default to Shipway
          const shipwayService = new ShipwayService(store.account_code);
          const orderResult = await shipwayService.syncOrdersToMySQL();
          orderCount = orderResult.count || 0;
        }
        
        logger.info(`   ✅ Orders synced: ${orderCount}`);
      } catch (orderError) {
        logger.error(`   ❌ Order sync failed:`, orderError.message);
        throw new Error(`Order sync failed: ${orderError.message}`);
      }
      
      // Sync carriers based on shipping partner
      try {
        logger.info(`   🚚 Syncing carriers (${store.shipping_partner})...`);
        
        if (shippingPartner === 'shiprocket') {
          const shiprocketService = new ShiprocketService(store.account_code);
          const carrierResult = await shiprocketService.syncCarriersToMySQL();
          carrierCount = carrierResult.carrierCount || 0;
        } else {
          const carrierService = new ShipwayCarrierService(store.account_code);
          const carrierResult = await carrierService.syncCarriersToExcel();
          carrierCount = carrierResult.carrierCount || 0;
        }
        
        logger.info(`   ✅ Carriers synced: ${carrierCount}`);
      } catch (carrierError) {
        logger.error(`   ⚠️ Carrier sync failed (non-critical):`, carrierError.message);
        // Don't fail the whole sync if carrier sync fails
      }
      
      // Sync products from Shopify (if configured)
      if (store.shopify_token && store.shopify_store_url) {
        try {
          logger.info(`   🛍️ Syncing products from Shopify...`);
          const ShopifyProductFetcher = require('./shopifyProductFetcher');
          const productFetcher = new ShopifyProductFetcher(store.account_code);
          const productResult = await productFetcher.syncProducts();
          productCount = productResult.productCount || 0;
          logger.info(`   ✅ Products synced: ${productCount}`);
          
          // Update Shopify sync timestamp
          await database.updateStoreShopifySync(store.account_code);
        } catch (productError) {
          logger.error(`   ⚠️ Product sync failed (non-critical):`, productError.message);
          // Don't fail the whole sync if product sync fails
        }
      }
      
      // Update last sync timestamp
      await database.updateStoreLastSync(store.account_code);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info(`✅ [${store.account_code}] Sync completed in ${duration}s`);
      logger.info(`   Orders: ${orderCount} | Carriers: ${carrierCount} | Products: ${productCount}`);
      
      return {
        success: true,
        accountCode: store.account_code,
        storeName: store.store_name,
        orderCount: orderCount,
        carrierCount: carrierCount,
        productCount: productCount,
        duration: duration
      };
      
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.error(`❌ [${store.account_code}] Sync failed after ${duration}s`);
      logger.error(`   Error: ${error.message}`);
      
      return {
        success: false,
        accountCode: store.account_code,
        storeName: store.store_name,
        orderCount: 0,
        error: error.message,
        duration: duration
      };
    }
  }
  
  /**
   * Process Promise.allSettled results
   * @param {Array} results - Results from Promise.allSettled
   * @param {Array} stores - Original store array
   * @returns {Object} Formatted results summary
   */
  processResults(results, stores) {
    const successful = [];
    const failed = [];
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const data = result.value;
        if (data.success) {
          successful.push(data);
        } else {
          failed.push(data);
        }
      } else {
        // Promise was rejected
        failed.push({
          success: false,
          accountCode: stores[index].account_code,
          storeName: stores[index].store_name,
          orderCount: 0,
          error: result.reason?.message || 'Unknown error'
        });
      }
    });
    
    const totalOrders = successful.reduce((sum, s) => sum + s.orderCount, 0);
    
    return {
      success: true,
      totalStores: stores.length,
      successfulStores: successful.length,
      failedStores: failed.length,
      totalOrders: totalOrders,
      successful: successful,
      failed: failed
    };
  }
  
  /**
   * Sync a specific store by account code
   * @param {string} accountCode - The account code to sync
   * @returns {Object} Sync result
   */
  async syncStore(accountCode) {
    try {
      const store = await database.getStoreByAccountCode(accountCode);
      
      if (!store) {
        throw new Error(`Store not found: ${accountCode}`);
      }
      
      if (store.status !== 'active') {
        throw new Error(`Store is not active: ${accountCode}`);
      }
      
      logger.info(`\n🔄 Syncing single store: ${store.store_name} (${accountCode})\n`);
      
      const result = await this.syncSingleStore(store);
      
      return result;
      
    } catch (error) {
      logger.error(`❌ Failed to sync store ${accountCode}:`, error);
      throw error;
    }
  }
}

module.exports = new MultiStoreSyncService();

