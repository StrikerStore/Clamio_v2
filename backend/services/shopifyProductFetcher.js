const axios = require('axios');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

/**
 * Check if there are any running bulk operations
 * @param {string} shopifyGraphqlUrl - The Shopify GraphQL endpoint
 * @param {object} headers - The headers for Shopify API
 * @returns {Object|null} The running bulk operation or null if none
 */
async function checkForRunningBulkOperations(shopifyGraphqlUrl, headers) {
  try {
    const body = {
      query: `query {
        currentBulkOperation {
          id
          status
          objectCount
          fileSize
          completedAt
          errorCode
        }
      }`
    };

    const response = await axios.post(shopifyGraphqlUrl, body, { headers });
    const currentOperation = response.data.data.currentBulkOperation;
    
    if (currentOperation && currentOperation.status === 'RUNNING') {
      console.log('[Shopify] Found running bulk operation:', currentOperation.id);
      return currentOperation;
    }
    
    return null;
  } catch (error) {
    console.error('[Shopify] Error checking for running bulk operations:', error);
    return null;
  }
}

/**
 * Cancel a running bulk operation
 * @param {string} shopifyGraphqlUrl - The Shopify GraphQL endpoint
 * @param {object} headers - The headers for Shopify API
 * @param {string} bulkOperationId - The bulk operation ID to cancel
 */
async function cancelBulkOperation(shopifyGraphqlUrl, headers, bulkOperationId) {
  try {
    const body = {
      query: `mutation {
        bulkOperationCancel(id: "${bulkOperationId}") {
          bulkOperation {
            id
            status
          }
          userErrors {
            field
            message
          }
        }
      }`
    };

    const response = await axios.post(shopifyGraphqlUrl, body, { headers });
    
    if (response.data.data.bulkOperationCancel.userErrors.length > 0) {
      console.error('[Shopify] Error canceling bulk operation:', response.data.data.bulkOperationCancel.userErrors);
      throw new Error('Failed to cancel bulk operation');
    }
    
    console.log('[Shopify] Successfully canceled bulk operation:', bulkOperationId);
  } catch (error) {
    console.error('[Shopify] Error canceling bulk operation:', error);
    throw error;
  }
}

/**
 * Fetch products from Shopify using Bulk Operations API and save to Excel
 * @param {string} shopifyGraphqlUrl - The Shopify GraphQL endpoint
 * @param {object} headers - The headers for Shopify API (including Authorization)
 * @param {string} excelFilePath - The path to save the Excel file
 * @param {boolean} forceNew - Whether to force a new operation (will cancel existing ones)
 */
async function fetchAndSaveShopifyProducts(shopifyGraphqlUrl, headers, excelFilePath, forceNew = false) {
  try {
    console.log('[Shopify] Starting bulk product fetch...');
    console.log('[Shopify] Endpoint:', shopifyGraphqlUrl);
    console.log('[Shopify] Headers:', Object.keys(headers));
    console.log('[Shopify] Excel output:', excelFilePath);

    // Check for existing running operations
    const runningOperation = await checkForRunningBulkOperations(shopifyGraphqlUrl, headers);
    
    if (runningOperation) {
      if (forceNew) {
        console.log('[Shopify] Canceling existing bulk operation to start new one...');
        await cancelBulkOperation(shopifyGraphqlUrl, headers, runningOperation.id);
        
        // Wait a bit for the cancellation to process
        console.log('[Shopify] Waiting for cancellation to process...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      } else {
        console.log('[Shopify] Using existing running bulk operation...');
        const completedOperation = await waitForBulkOperationCompletion(shopifyGraphqlUrl, headers, runningOperation.id);
        
        if (completedOperation.status === 'COMPLETED') {
          console.log('[Shopify] Existing bulk operation completed successfully');
          
          // Download and parse the data
          const jsonlData = await downloadBulkOperationData(completedOperation.url);
          const products = parseShopifyBulkData(jsonlData);
          const excelRows = convertProductsToExcelRows(products);
          
          // Save to Excel
          await saveToExcel(excelRows, excelFilePath);
          
          return {
            success: true,
            productsCount: products.length,
            excelFilePath: excelFilePath,
            message: `Successfully processed ${products.length} products from existing operation and saved to Excel`
          };
        } else {
          throw new Error(`Existing bulk operation failed with status: ${completedOperation.status}`);
        }
      }
    }

    // Use Bulk Operations API to fetch all products
    const body = {
      query: `mutation { bulkOperationRunQuery( query: """ { products { edges { node { id title images(first: 1) { edges { node { src altText } } } } } } } """ ) { bulkOperation { id status } userErrors { field message } } }`
    };

    console.log('[Shopify] Sending bulk operation request to Shopify...');
    const response = await axios.post(
      shopifyGraphqlUrl,
      body,
      { headers }
    );
    console.log('[Shopify] Bulk operation response received from Shopify.');

    // Check for user errors
    if (response.data.data.bulkOperationRunQuery.userErrors.length > 0) {
      console.error('[Shopify] User errors in bulk operation:', response.data.data.bulkOperationRunQuery.userErrors);
      throw new Error('Bulk operation failed with user errors');
    }

    // Get the bulk operation details
    const bulkOperation = response.data.data.bulkOperationRunQuery.bulkOperation;
    console.log('[Shopify] Bulk operation status:', bulkOperation.status);

    // Log cost information if available
    if (response.data.extensions && response.data.extensions.cost) {
      const cost = response.data.extensions.cost;
      console.log('[Shopify] Query cost - Requested:', cost.requestedQueryCost, 'Actual:', cost.actualQueryCost);
      console.log('[Shopify] Throttle status - Available:', cost.throttleStatus.currentlyAvailable, '/', cost.throttleStatus.maximumAvailable);
    }

    // Wait for bulk operation to complete
    const completedOperation = await waitForBulkOperationCompletion(shopifyGraphqlUrl, headers, bulkOperation.id);
    
    if (completedOperation.status === 'COMPLETED') {
      console.log('[Shopify] Bulk operation completed successfully');
      
      // Download and parse the data
      const jsonlData = await downloadBulkOperationData(completedOperation.url);
      const products = parseShopifyBulkData(jsonlData);
      const excelRows = convertProductsToExcelRows(products);
      
      // Save to Excel
      await saveToExcel(excelRows, excelFilePath);
      
      return {
        success: true,
        productsCount: products.length,
        excelFilePath: excelFilePath,
        message: `Successfully processed ${products.length} products and saved to Excel`
      };
    } else {
      throw new Error(`Bulk operation failed with status: ${completedOperation.status}`);
    }

  } catch (error) {
    console.error('[Shopify] Error in bulk product fetch:', error);
    throw error;
  }
}

/**
 * Wait for bulk operation to complete by polling its status
 * @param {string} shopifyGraphqlUrl - The Shopify GraphQL endpoint
 * @param {object} headers - The headers for Shopify API
 * @param {string} bulkOperationId - The bulk operation ID
 * @returns {Object} The completed bulk operation details
 */
async function waitForBulkOperationCompletion(shopifyGraphqlUrl, headers, bulkOperationId) {
  console.log('[Shopify] Waiting for bulk operation to complete...');
  
  const maxAttempts = 60; // 5 minutes with 5-second intervals
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      const body = {
        query: `query {
          node(id: "${bulkOperationId}") {
            ... on BulkOperation {
              id
              status
              url
              errorCode
              completedAt
              objectCount
              fileSize
            }
          }
        }`
      };

      const response = await axios.post(shopifyGraphqlUrl, body, { headers });
      const bulkOperation = response.data.data.node;
      
      console.log(`[Shopify] Bulk operation status: ${bulkOperation.status} (attempt ${attempts + 1}/${maxAttempts})`);
      
      if (bulkOperation.status === 'COMPLETED') {
        console.log('[Shopify] Bulk operation completed successfully');
        console.log(`[Shopify] Object count: ${bulkOperation.objectCount}`);
        console.log(`[Shopify] File size: ${bulkOperation.fileSize} bytes`);
        return bulkOperation;
      } else if (bulkOperation.status === 'FAILED') {
        throw new Error(`Bulk operation failed: ${bulkOperation.errorCode}`);
      } else if (bulkOperation.status === 'CANCELED') {
        throw new Error('Bulk operation was canceled');
      }
      
      // Wait 5 seconds before next poll
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
      
    } catch (error) {
      console.error('[Shopify] Error polling bulk operation status:', error);
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  throw new Error('Bulk operation timed out after 5 minutes');
}

/**
 * Download the bulk operation data file
 * @param {string} url - The URL to download the data from
 * @returns {string} The JSONL data content
 */
async function downloadBulkOperationData(url) {
  console.log('[Shopify] Downloading bulk operation data...');
  console.log('[Shopify] Download URL:', url);
  
  try {
    const response = await axios.get(url);
    console.log('[Shopify] Data download completed');
    return response.data;
  } catch (error) {
    console.error('[Shopify] Error downloading bulk operation data:', error);
    throw error;
  }
}

/**
 * Save products data to Excel file
 * @param {Array} excelRows - Array of product rows for Excel
 * @param {string} excelFilePath - Path to save the Excel file
 */
async function saveToExcel(excelRows, excelFilePath) {
  console.log('[Shopify] Saving products to Excel file...');
  
  try {
    // Prepare worksheet and workbook
    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

    // Ensure data directory exists
    const dir = path.dirname(excelFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`[Shopify] Created directory: ${dir}`);
    }

    // Write to Excel file
    XLSX.writeFile(workbook, excelFilePath);
    console.log(`[Shopify] Products saved to Excel: ${excelFilePath}`);
  } catch (error) {
    console.error('[Shopify] Error saving to Excel:', error);
    throw error;
  }
}

/**
 * Parse JSONL data from Shopify bulk operation
 * @param {string} jsonlData - The JSONL formatted data from Shopify
 * @returns {Array} Array of products with their images
 */
function parseShopifyBulkData(jsonlData) {
  const lines = jsonlData.trim().split('\n');
  const products = new Map(); // Use Map to group products by ID
  
  console.log(`[Shopify] Parsing ${lines.length} lines of JSONL data...`);

  lines.forEach((line, index) => {
    try {
      const data = JSON.parse(line);
      
      if (data.id && data.title) {
        // This is a product line
        const productId = data.id;
        products.set(productId, {
          id: productId,
          name: data.title,
          images: []
        });
      } else if (data.src && data.__parentId) {
        // This is an image line
        const productId = data.__parentId;
        if (products.has(productId)) {
          products.get(productId).images.push({
            src: data.src,
            altText: data.altText || ''
          });
        }
      }
    } catch (error) {
      console.error(`[Shopify] Error parsing line ${index + 1}:`, error);
    }
  });

  console.log(`[Shopify] Parsed ${products.size} products from bulk data`);
  return Array.from(products.values());
}

/**
 * Convert parsed products to Excel format
 * @param {Array} products - Array of products with images
 * @returns {Array} Array of rows for Excel
 */
function convertProductsToExcelRows(products) {
  return products.map(product => {
    const firstImage = product.images.length > 0 ? product.images[0] : {};
    return {
      id: product.id,
      name: product.name,
      image: firstImage.src || '',
      altText: firstImage.altText || '',
      totalImages: product.images.length
    };
  });
}

module.exports = { 
  fetchAndSaveShopifyProducts,
  parseShopifyBulkData,
  convertProductsToExcelRows,
  waitForBulkOperationCompletion,
  downloadBulkOperationData,
  saveToExcel,
  checkForRunningBulkOperations,
  cancelBulkOperation
}; 