const axios = require('axios');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

/**
 * Fetch products from Shopify GraphQL and save to Excel
 * @param {string} shopifyGraphqlUrl - The Shopify GraphQL endpoint
 * @param {object} headers - The headers for Shopify API (including Authorization)
 * @param {string} excelFilePath - The path to save the Excel file
 */
async function fetchAndSaveShopifyProducts(shopifyGraphqlUrl, headers, excelFilePath) {
  try {
    console.log('[Shopify] Starting product fetch...');
    console.log('[Shopify] Endpoint:', shopifyGraphqlUrl);
    console.log('[Shopify] Headers:', Object.keys(headers));
    console.log('[Shopify] Excel output:', excelFilePath);

    // Use the provided GraphQL query
    const body = {
      query: `query GetProducts { products(first: 250) { nodes { id title images(first: 1) { edges { node { src altText } } } variants(first: 10) { nodes { id title price } } } } }`
    };
    console.log('[Shopify] Sending POST request to Shopify...');
    const response = await axios.post(
      shopifyGraphqlUrl,
      body,
      { headers }
    );
    console.log('[Shopify] Response received from Shopify.');

    // Parse the response for product id, title, and first image (src, altText)
    const nodes = response.data.data.products.nodes;
    console.log(`[Shopify] Number of products fetched: ${nodes.length}`);
    const productRows = nodes.map(product => {
      const firstImage = (product.images.edges[0] && product.images.edges[0].node) || {};
      return {
        id: product.id,
        name: product.title,
        image: firstImage.src || '',
        altText: firstImage.altText || ''
      };
    });

    // Prepare worksheet and workbook
    const worksheet = XLSX.utils.json_to_sheet(productRows);
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
    console.log(`[Shopify] Shopify products saved to ${excelFilePath}`);
  } catch (error) {
    console.error('[Shopify] Error fetching or saving Shopify products:', error);
  }
}

module.exports = fetchAndSaveShopifyProducts; 