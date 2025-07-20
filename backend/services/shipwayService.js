const axios = require('axios');

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

      const response = await axios.get(url, {
        params,
        headers: {
          'Authorization': this.basicAuthHeader,
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
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
      // Extract common warehouse fields
      const warehouse = {
        id: shipwayData.warehouseid || shipwayData.id,
        name: shipwayData.warehousename || shipwayData.name,
        address: shipwayData.address || shipwayData.warehouseaddress,
        city: shipwayData.city,
        state: shipwayData.state,
        country: shipwayData.country,
        pincode: shipwayData.pincode || shipwayData.postalcode,
        contactPerson: shipwayData.contactperson || shipwayData.contact_person,
        phone: shipwayData.phone || shipwayData.contactphone,
        email: shipwayData.email || shipwayData.contactemail,
        status: shipwayData.status || shipwayData.warehousestatus,
        createdAt: shipwayData.createddate || shipwayData.created_at,
        updatedAt: shipwayData.updateddate || shipwayData.updated_at
      };

      // Remove undefined values
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
}

module.exports = new ShipwayService(); 