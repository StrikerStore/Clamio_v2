/**
 * Store Controller
 * Handles all store management operations (Superadmin only)
 */

const database = require('../config/database');
const encryptionService = require('../services/encryptionService');
const { generateUniqueAccountCode } = require('../utils/accountCodeGenerator');
const axios = require('axios');
const multiStoreSyncService = require('../services/multiStoreSyncService');

class StoreController {
  /**
   * Get all stores
   */
  async getAllStores(req, res) {
    try {
      const stores = await database.getAllStores();
      
      // Remove sensitive data before sending to frontend
      const sanitizedStores = stores.map(store => ({
        id: store.id,
        account_code: store.account_code,
        store_name: store.store_name,
        shipway_username: store.shipway_username,
        shopify_store_url: store.shopify_store_url,
        status: store.status,
        created_at: store.created_at,
        updated_at: store.updated_at,
        created_by: store.created_by,
        last_synced_at: store.last_synced_at,
        last_shopify_sync_at: store.last_shopify_sync_at,
        has_credentials: true // Indicate credentials exist without exposing them
      }));
      
      res.json({
        success: true,
        data: sanitizedStores
      });
      
    } catch (error) {
      console.error('Get all stores error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch stores',
        error: error.message
      });
    }
  }

  /**
   * Get store by account code
   */
  async getStoreByCode(req, res) {
    try {
      const { accountCode } = req.params;
      
      const store = await database.getStoreByAccountCode(accountCode);
      
      if (!store) {
        return res.status(404).json({
          success: false,
          message: 'Store not found'
        });
      }
      
      // Remove sensitive data
      const sanitizedStore = {
        id: store.id,
        account_code: store.account_code,
        store_name: store.store_name,
        shipway_username: store.shipway_username,
        shopify_store_url: store.shopify_store_url,
        status: store.status,
        created_at: store.created_at,
        updated_at: store.updated_at,
        created_by: store.created_by,
        last_synced_at: store.last_synced_at,
        last_shopify_sync_at: store.last_shopify_sync_at,
        has_credentials: true
      };
      
      res.json({
        success: true,
        data: sanitizedStore
      });
      
    } catch (error) {
      console.error('Get store error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch store',
        error: error.message
      });
    }
  }

  /**
   * Get store list for filtering (Admin/Superadmin accessible)
   * Returns only account_code and store_name
   */
  async getStoreListForFilter(req, res) {
    try {
      const stores = await database.getAllStores();
      
      // Return only essential fields for filtering
      const storeList = stores.map(store => ({
        account_code: store.account_code,
        store_name: store.store_name,
        status: store.status
      }));
      
      res.json({
        success: true,
        data: storeList
      });
      
    } catch (error) {
      console.error('Get store list error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch store list',
        error: error.message
      });
    }
  }

  /**
   * Create new store
   */
  async createStore(req, res) {
    try {
      const { 
        store_name, 
        shipway_username, 
        shipway_password, 
        shopify_store_url, 
        shopify_token,
        status
      } = req.body;
      
      // Validation - ALL FIELDS REQUIRED
      if (!store_name) {
        return res.status(400).json({
          success: false,
          message: 'Store name is required'
        });
      }
      
      if (!shipway_username || !shipway_password) {
        return res.status(400).json({
          success: false,
          message: 'Shipway username and password are required'
        });
      }
      
      if (!shopify_store_url || !shopify_token) {
        return res.status(400).json({
          success: false,
          message: 'Shopify store URL and token are required'
        });
      }
      
      if (!status || !['active', 'inactive'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Status must be either "active" or "inactive"'
        });
      }
      
      // Generate unique account_code from store_name
      const accountCode = await generateUniqueAccountCode(store_name, database);
      console.log(`✅ Generated account code: ${accountCode} for store: ${store_name}`);
      
      // Encrypt Shipway password
      const encryptedPassword = encryptionService.encrypt(shipway_password);
      
      // Generate Basic Auth token
      const authToken = Buffer.from(`${shipway_username}:${shipway_password}`).toString('base64');
      
      // Create store
      await database.createStore({
        account_code: accountCode,
        store_name: store_name,
        shipway_username: shipway_username,
        shipway_password_encrypted: encryptedPassword,
        auth_token: `Basic ${authToken}`,
        shopify_store_url: shopify_store_url,
        shopify_token: shopify_token,
        status: status,
        created_by: req.user.id
      });
      
      console.log(`✅ Store created: ${store_name} (${accountCode})`);
      
      res.json({
        success: true,
        message: 'Store created successfully',
        data: {
          account_code: accountCode,
          store_name: store_name,
          status: status
        }
      });
      
    } catch (error) {
      console.error('Create store error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create store',
        error: error.message
      });
    }
  }

  /**
   * Update store
   */
  async updateStore(req, res) {
    try {
      const { accountCode } = req.params;
      const { 
        store_name, 
        shipway_username, 
        shipway_password, 
        shopify_store_url, 
        shopify_token,
        status
      } = req.body;
      
      // Check if store exists
      const existingStore = await database.getStoreByAccountCode(accountCode);
      if (!existingStore) {
        return res.status(404).json({
          success: false,
          message: 'Store not found'
        });
      }
      
      // Build update object
      const updateData = {};
      
      if (store_name !== undefined) {
        updateData.store_name = store_name;
      }
      
      if (shipway_username !== undefined) {
        updateData.shipway_username = shipway_username;
      }
      
      // Handle password update and auth token regeneration
      if (shipway_password !== undefined && shipway_password !== '') {
        // Encrypt new password
        updateData.shipway_password_encrypted = encryptionService.encrypt(shipway_password);
        
        // Regenerate auth token with new password
        const username = shipway_username !== undefined ? shipway_username : existingStore.shipway_username;
        updateData.auth_token = `Basic ${Buffer.from(`${username}:${shipway_password}`).toString('base64')}`;
      } else if (shipway_username !== undefined && shipway_username !== existingStore.shipway_username) {
        // Username changed but password not provided - regenerate auth token with existing password
        if (existingStore.shipway_password_encrypted) {
          try {
            const existingPassword = encryptionService.decrypt(existingStore.shipway_password_encrypted);
            updateData.auth_token = `Basic ${Buffer.from(`${shipway_username}:${existingPassword}`).toString('base64')}`;
          } catch (error) {
            console.error('Error decrypting existing password for auth token regeneration:', error);
            // Continue without regenerating auth token if decryption fails
          }
        }
      }
      
      if (shopify_store_url !== undefined) {
        updateData.shopify_store_url = shopify_store_url;
      }
      
      if (shopify_token !== undefined) {
        updateData.shopify_token = shopify_token;
      }
      
      if (status !== undefined) {
        if (!['active', 'inactive'].includes(status)) {
          return res.status(400).json({
            success: false,
            message: 'Status must be either "active" or "inactive"'
          });
        }
        updateData.status = status;
      }
      
      // Update store
      await database.updateStore(accountCode, updateData);
      
      console.log(`✅ Store updated: ${accountCode}`);
      
      res.json({
        success: true,
        message: 'Store updated successfully'
      });
      
    } catch (error) {
      console.error('Update store error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update store',
        error: error.message
      });
    }
  }

  /**
   * Delete store (soft delete - set status to inactive)
   */
  async deleteStore(req, res) {
    try {
      const { accountCode } = req.params;
      
      // Check if store exists
      const existingStore = await database.getStoreByAccountCode(accountCode);
      if (!existingStore) {
        return res.status(404).json({
          success: false,
          message: 'Store not found'
        });
      }
      
      // Soft delete by setting status to inactive
      await database.deleteStore(accountCode);
      
      console.log(`✅ Store deleted (soft): ${accountCode}`);
      
      res.json({
        success: true,
        message: 'Store deleted successfully'
      });
      
    } catch (error) {
      console.error('Delete store error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete store',
        error: error.message
      });
    }
  }

  /**
   * Toggle store status (active/inactive)
   */
  async toggleStoreStatus(req, res) {
    try {
      const { accountCode } = req.params;
      
      // Get current store
      const store = await database.getStoreByAccountCode(accountCode);
      if (!store) {
        return res.status(404).json({
          success: false,
          message: 'Store not found'
        });
      }
      
      // Toggle status
      const newStatus = store.status === 'active' ? 'inactive' : 'active';
      
      await database.updateStore(accountCode, { status: newStatus });
      
      console.log(`✅ Store status toggled: ${accountCode} -> ${newStatus}`);
      
      res.json({
        success: true,
        message: `Store ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`,
        data: {
          account_code: accountCode,
          status: newStatus
        }
      });
      
    } catch (error) {
      console.error('Toggle store status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to toggle store status',
        error: error.message
      });
    }
  }

  /**
   * Test Shipway connection
   */
  async testShipwayConnection(req, res) {
    try {
      const { shipway_username, shipway_password } = req.body;
      
      if (!shipway_username || !shipway_password) {
        return res.status(400).json({
          success: false,
          message: 'Shipway username and password are required'
        });
      }
      
      // Generate auth token
      const authToken = Buffer.from(`${shipway_username}:${shipway_password}`).toString('base64');
      
      // Test connection by calling Shipway API
      const response = await axios.get('https://app.shipway.com/api/getorders', {
        params: { status: 'O', page: 1 },
        headers: {
          'Authorization': `Basic ${authToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      if (response.status === 200) {
        res.json({
          success: true,
          message: 'Shipway connection successful'
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Shipway connection failed: Invalid response'
        });
      }
      
    } catch (error) {
      console.error('Test Shipway connection error:', error.message);
      
      if (error.response && error.response.status === 401) {
        res.status(401).json({
          success: false,
          message: 'Shipway connection failed: Invalid credentials'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Shipway connection failed',
          error: error.message
        });
      }
    }
  }

  /**
   * Test Shopify connection
   */
  async testShopifyConnection(req, res) {
    try {
      const { shopify_store_url, shopify_token } = req.body;
      
      if (!shopify_store_url || !shopify_token) {
        return res.status(400).json({
          success: false,
          message: 'Shopify store URL and token are required'
        });
      }
      
      // Test connection by calling Shopify API
      const response = await axios.get(
        `https://${shopify_store_url}/admin/api/2024-01/shop.json`,
        {
          headers: {
            'X-Shopify-Access-Token': shopify_token
          },
          timeout: 10000
        }
      );
      
      if (response.status === 200 && response.data.shop) {
        res.json({
          success: true,
          message: 'Shopify connection successful',
          data: {
            shop_name: response.data.shop.name,
            domain: response.data.shop.domain
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Shopify connection failed: Invalid response'
        });
      }
      
    } catch (error) {
      console.error('Test Shopify connection error:', error.message);
      
      if (error.response && error.response.status === 401) {
        res.status(401).json({
          success: false,
          message: 'Shopify connection failed: Invalid token'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Shopify connection failed',
          error: error.message
        });
      }
    }
  }

  /**
   * Sync all active stores in parallel
   */
  async syncAllStores(req, res) {
    try {
      const { concurrencyLimit } = req.body;
      
      console.log('🚀 Triggering multi-store sync...');
      
      // Start sync (this may take a while)
      const result = await multiStoreSyncService.syncAllStores(concurrencyLimit);
      
      res.json({
        success: true,
        message: 'Multi-store sync completed',
        data: result
      });
      
    } catch (error) {
      console.error('Sync all stores error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to sync stores',
        error: error.message
      });
    }
  }

  /**
   * Sync a single store
   */
  async syncSingleStore(req, res) {
    try {
      const { accountCode } = req.params;
      
      console.log(`🚀 Triggering sync for store: ${accountCode}`);
      
      const result = await multiStoreSyncService.syncStore(accountCode);
      
      if (result.success) {
        res.json({
          success: true,
          message: `Store ${accountCode} synced successfully`,
          data: result
        });
      } else {
        res.status(500).json({
          success: false,
          message: `Store ${accountCode} sync failed`,
          error: result.error
        });
      }
      
    } catch (error) {
      console.error('Sync single store error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to sync store',
        error: error.message
      });
    }
  }
}

module.exports = new StoreController();

