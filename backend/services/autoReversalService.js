/**
 * Auto-Reversal Service
 * 
 * This service handles the automatic reversal of orders that have been claimed
 * for more than 24 hours without label download.
 */

const database = require('../config/database');
const logger = require('../utils/logger');

class AutoReversalService {
  constructor() {
    this.isRunning = false;
    this.lastRun = null;
    this.totalReversed = 0;
    this.totalRuns = 0;
  }

  /**
   * Execute auto-reversal for expired orders
   * @returns {Promise<Object>} Result of the auto-reversal operation
   */
  async executeAutoReversal() {
    if (this.isRunning) {
      logger.info('🔄 Auto-reversal already running, skipping...');
      return { success: false, message: 'Auto-reversal already in progress' };
    }

    this.isRunning = true;
    const startTime = new Date();
    logger.info(`[${startTime.toISOString()}] 🔄 Starting auto-reversal process...`);

    try {
      // Wait for database initialization
      await database.waitForMySQLInitialization();
      
      if (!database.isMySQLAvailable()) {
        throw new Error('Database connection not available');
      }

      // Find orders that meet the auto-reversal criteria
      const expiredOrdersQuery = `
        SELECT order_unique_id, order_id, claimed_by, claimed_at, last_claimed_by, last_claimed_at
        FROM claims 
        WHERE status = 'claimed' 
          AND label_downloaded = 0 
          AND claimed_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `;

      const [expiredOrders] = await database.mysqlConnection.execute(expiredOrdersQuery);
      
      logger.info(`🔍 Found ${expiredOrders.length} orders eligible for auto-reversal`);

      if (expiredOrders.length === 0) {
        this.isRunning = false;
        this.lastRun = new Date();
        this.totalRuns++;
        
        return {
          success: true,
          message: 'No orders found for auto-reversal',
          data: {
            total_checked: 0,
            auto_reversed: 0,
            details: [],
            execution_time_ms: Date.now() - startTime.getTime()
          }
        };
      }

      // Log details of orders to be auto-reversed
      const details = expiredOrders.map(order => ({
        order_unique_id: order.order_unique_id,
        order_id: order.order_id,
        claimed_by: order.claimed_by,
        claimed_at: order.claimed_at,
        hours_claimed: Math.round((new Date() - new Date(order.claimed_at)) / (1000 * 60 * 60))
      }));

      logger.info('📋 Orders to be auto-reversed:');
      details.forEach(detail => {
      });

      // Auto-reverse the expired orders
      const updateQuery = `
        UPDATE claims SET 
          status = 'unclaimed',
          claimed_by = NULL,
          claimed_at = NULL
        WHERE status = 'claimed' 
          AND label_downloaded = 0 
          AND claimed_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `;

      const [updateResult] = await database.mysqlConnection.execute(updateQuery);
      const affectedRows = updateResult.affectedRows;

      logger.info(`✅ AUTO-REVERSAL COMPLETE`);

      // Log the auto-reversal event
      const timestamp = new Date().toISOString();
      logger.info(`[${timestamp}] AUTO-REVERSAL: ${affectedRows} orders auto-reversed due to 24+ hour claim without label download`);

      // Update service statistics
      this.isRunning = false;
      this.lastRun = new Date();
      this.totalRuns++;
      this.totalReversed += affectedRows;

      const result = {
        success: true,
        message: `Successfully auto-reversed ${affectedRows} expired orders`,
        data: {
          total_checked: expiredOrders.length,
          auto_reversed: affectedRows,
          details: details,
          reversed_at: timestamp,
          execution_time_ms: Date.now() - startTime.getTime()
        }
      };

      return result;

    } catch (error) {
      logger.error('❌ AUTO-REVERSE ERROR:', error);
      this.isRunning = false;
      this.lastRun = new Date();
      this.totalRuns++;
      
      return {
        success: false,
        message: 'Failed to auto-reverse expired orders',
        error: error.message,
        execution_time_ms: Date.now() - startTime.getTime()
      };
    }
  }

  /**
   * Get service statistics
   * @returns {Object} Service statistics
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      totalRuns: this.totalRuns,
      totalReversed: this.totalReversed,
      uptime: process.uptime()
    };
  }

  /**
   * Reset service statistics
   */
  resetStats() {
    this.totalRuns = 0;
    this.totalReversed = 0;
    this.lastRun = null;
    logger.info('📊 Auto-reversal service statistics reset');
  }
}

module.exports = new AutoReversalService();
