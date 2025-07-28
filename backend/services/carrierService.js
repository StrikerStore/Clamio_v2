const axios = require('axios');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

/**
 * Carrier Service
 * Handles fetching carrier information from Shipway API and storing it in Excel
 */
class CarrierService {
  constructor() {
    this.baseURL = process.env.SHIPWAY_API_BASE_URL || 'https://app.shipway.com/api';
    this.basicAuthHeader = process.env.SHIPWAY_BASIC_AUTH_HEADER;
    this.carrierExcelPath = path.join(__dirname, '../data/logistic_carrier.xlsx');
  }

  /**
   * Fetch carrier data from Shipway API
   * @returns {Array} Array of carrier objects
   */
  async fetchCarriers() {
    try {
      if (!this.basicAuthHeader) {
        throw new Error('Shipway API configuration error. Please contact administrator.');
      }

      const url = `${this.baseURL}/getcarrier`;
      
      this.logApiActivity({
        type: 'carrier-request',
        url,
        headers: { Authorization: '***' },
      });

      const response = await axios.get(url, {
        headers: {
          'Authorization': this.basicAuthHeader,
          'Content-Type': 'application/json'
        },
        timeout: 15000 // 15 second timeout
      });

      this.logApiActivity({
        type: 'carrier-response',
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
      let carriers = [];
      if (Array.isArray(data)) {
        carriers = data;
      } else if (data && Array.isArray(data.carriers)) {
        carriers = data.carriers;
      } else if (data && Array.isArray(data.message)) {
        carriers = data.message;
      } else if (data && typeof data === 'object' && data.carrier_id) {
        carriers = [data];
      } else {
        this.logApiActivity({
          type: 'carrier-unexpected-format',
          data: data
        });
        throw new Error('Unexpected carrier API response format');
      }

      return carriers;

    } catch (error) {
      this.logApiActivity({
        type: 'carrier-error',
        error: error.message,
        stack: error.stack,
      });
      console.error('Error fetching carriers from Shipway API:', error.message);
      
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
          throw new Error('Carrier endpoint not found.');
        } else if (status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        } else {
          throw new Error(`Shipway API error: ${error.response.data?.message || `Status ${status}`}`);
        }
      }

      throw new Error('Failed to fetch carrier details from Shipway API');
    }
  }

  /**
   * Convert weight to grams
   * @param {string} weightString - Weight string with unit (e.g., "10kg", "500g", "2.5kg")
   * @returns {number} Weight in grams as number
   */
  convertWeightToGrams(weightString) {
    if (!weightString || typeof weightString !== 'string') {
      return '';
    }

    const trimmedWeight = weightString.trim().toLowerCase();
    
    // Extract number and unit
    const match = trimmedWeight.match(/^([\d.]+)\s*(kg|g|gm|grams?)?$/);
    
    if (!match) {
      return '';
    }

    const value = parseFloat(match[1]);
    const unit = match[2] || 'kg'; // Default to kg if no unit specified

    if (isNaN(value)) {
      return '';
    }

    // Convert to grams
    if (unit === 'kg' || unit === 'kgs') {
      return Math.round(value * 1000);
    } else if (unit === 'g' || unit === 'gm' || unit === 'gram' || unit === 'grams') {
      return Math.round(value);
    }

    return '';
  }

  /**
   * Extract weight from carrier name and convert to grams
   * @param {string} carrierName - Full carrier name that may contain weight in parentheses
   * @returns {Object} Object with clean name and weight in grams
   */
  extractWeightFromName(carrierName) {
    if (!carrierName || typeof carrierName !== 'string') {
      return { name: carrierName || '', weightInGms: '' };
    }

    // Pattern to match weight in parentheses at the end of the name
    // Examples: "Carrier Name (10kg)", "Carrier Name (500g)", "Carrier Name (2.5kg)"
    const weightPattern = /\s*\(([^)]+)\)\s*$/;
    const match = carrierName.match(weightPattern);

    if (match) {
      const rawWeight = match[1].trim();
      const cleanName = carrierName.replace(weightPattern, '').trim();
      const weightInGrams = this.convertWeightToGrams(rawWeight);
      return { name: cleanName, weightInGms: weightInGrams };
    }

    return { name: carrierName.trim(), weightInGms: '' };
  }

  /**
   * Format carrier data for Excel storage
   * @param {Array} carriers - Raw carrier data from API
   * @returns {Array} Formatted carrier data with carrier_id, carrier_name, weight in gms, priority, and status
   */
  formatCarrierData(carriers) {
    try {
      return carriers.map(carrier => {
        const rawCarrierName = carrier.carrier_name || carrier.name || carrier.title || '';
        const { name: cleanCarrierName, weightInGms } = this.extractWeightFromName(rawCarrierName);

        const formattedCarrier = {
          carrier_id: carrier.carrier_id || carrier.id || '',
          carrier_name: cleanCarrierName,
          'weight in gms': weightInGms,
          priority: '',
          status: carrier.status || carrier.carrier_status || 'active'
        };

        // Remove undefined values
        Object.keys(formattedCarrier).forEach(key => {
          if (formattedCarrier[key] === undefined) {
            delete formattedCarrier[key];
          }
        });

        return formattedCarrier;
      });
    } catch (error) {
      console.error('Error formatting carrier data:', error);
      throw new Error('Failed to format carrier data');
    }
  }

  /**
   * Save carrier data to Excel file
   * @param {Array} carriers - Formatted carrier data
   */
  saveToExcel(carriers) {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.carrierExcelPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Create worksheet and workbook
      const worksheet = XLSX.utils.json_to_sheet(carriers);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Carriers');

      // Write to file
      XLSX.writeFile(workbook, this.carrierExcelPath);

      this.logApiActivity({
        type: 'carrier-excel-saved',
        path: this.carrierExcelPath,
        count: carriers.length
      });

      console.log(`✅ Carrier data saved to Excel: ${carriers.length} carriers`);
    } catch (error) {
      this.logApiActivity({
        type: 'carrier-excel-error',
        error: error.message
      });
      console.error('Error saving carrier data to Excel:', error.message);
      throw new Error('Failed to save carrier data to Excel');
    }
  }

  /**
   * Fetch carriers and save to Excel
   * @returns {Object} Result object with success status and count
   */
  async fetchAndSaveCarriers() {
    try {
      console.log('🔄 Fetching carrier data from Shipway API...');
      
      const carriers = await this.fetchCarriers();
      
      if (!carriers || carriers.length === 0) {
        console.log('⚠️  No carrier data received from API');
        return { success: true, count: 0, message: 'No carriers found' };
      }

      const formattedCarriers = this.formatCarrierData(carriers);
      this.saveToExcel(formattedCarriers);

      return {
        success: true,
        count: formattedCarriers.length,
        message: `Successfully fetched and saved ${formattedCarriers.length} carriers`
      };

    } catch (error) {
      console.error('❌ Error in fetchAndSaveCarriers:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test carrier API connectivity
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

      const carriers = await this.fetchCarriers();
      
      return {
        success: true,
        message: `Successfully connected to Shipway Carrier API. Found ${carriers.length} carriers.`
      };
    } catch (error) {
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

module.exports = new CarrierService(); 