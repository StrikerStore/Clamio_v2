const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

class OrderEnhancementService {
  constructor() {
    this.ordersPath = path.join(__dirname, '../data/orders.xlsx');
    this.rawShipwayPath = path.join(__dirname, '../data/raw_shipway_orders.json');
    this.productsPath = path.join(__dirname, '../data/products.xlsx');
  }

  /**
   * Automatically enhance orders.xlsx with customer_name and product_image columns
   * This is called after orders.xlsx is created/updated by shipwayService
   */
  async enhanceOrdersFile() {
    console.log('🔧 OrderEnhancementService: Starting automatic enhancement...');
    
    try {
      // Check if orders.xlsx exists
      if (!fs.existsSync(this.ordersPath)) {
        console.log('ℹ️  OrderEnhancementService: orders.xlsx not found, skipping enhancement');
        return { success: false, message: 'Orders file not found' };
      }

      // Read current orders
      const ordersWb = XLSX.readFile(this.ordersPath);
      const ordersWs = ordersWb.Sheets[ordersWb.SheetNames[0]];
      const orders = XLSX.utils.sheet_to_json(ordersWs);

      console.log(`📊 OrderEnhancementService: Processing ${orders.length} orders`);

      // Check if enhancement is needed
      const needsCustomerNames = !orders[0]?.customer_name;
      const needsProductImages = !orders[0]?.product_image;

      if (!needsCustomerNames && !needsProductImages) {
        console.log('✅ OrderEnhancementService: Orders already enhanced, skipping');
        return { success: true, message: 'Orders already enhanced' };
      }

      let enhancedOrders = [...orders];

      // Add customer names if needed
      if (needsCustomerNames) {
        console.log('👥 OrderEnhancementService: Adding customer names...');
        enhancedOrders = await this.addCustomerNames(enhancedOrders);
      }

      // Add product images if needed
      if (needsProductImages) {
        console.log('🖼️  OrderEnhancementService: Adding product images...');
        enhancedOrders = await this.addProductImages(enhancedOrders);
      }

      // Save enhanced orders
      const newWorksheet = XLSX.utils.json_to_sheet(enhancedOrders);
      ordersWb.Sheets[ordersWb.SheetNames[0]] = newWorksheet;
      XLSX.writeFile(ordersWb, this.ordersPath);

      console.log('✅ OrderEnhancementService: Orders enhanced successfully');
      return { 
        success: true, 
        message: 'Orders enhanced successfully',
        customerNamesAdded: needsCustomerNames,
        productImagesAdded: needsProductImages
      };

    } catch (error) {
      console.error('❌ OrderEnhancementService: Error enhancing orders:', error.message);
      return { success: false, message: error.message };
    }
  }

  /**
   * Add customer names from raw shipway data
   */
  async addCustomerNames(orders) {
    if (!fs.existsSync(this.rawShipwayPath)) {
      console.log('⚠️  OrderEnhancementService: raw_shipway_orders.json not found');
      return orders.map(order => ({ ...order, customer_name: 'N/A' }));
    }

    try {
      const rawData = JSON.parse(fs.readFileSync(this.rawShipwayPath, 'utf8'));
      let shipwayOrders = [];

      if (rawData.success === 1 && Array.isArray(rawData.message)) {
        shipwayOrders = rawData.message;
      } else if (rawData.success && rawData.data && Array.isArray(rawData.data.orders)) {
        shipwayOrders = rawData.data.orders;
      }

      // Create customer name lookup map
      const customerNameMap = {};
      shipwayOrders.forEach(order => {
        const orderId = order.order_id?.toString();
        const firstName = order.s_firstname || '';
        const lastName = order.s_lastname || '';
        const customerName = `${firstName} ${lastName}`.trim();
        
        if (orderId && customerName) {
          customerNameMap[orderId] = customerName;
        }
      });

      console.log(`🗺️  OrderEnhancementService: Created customer map with ${Object.keys(customerNameMap).length} entries`);

      // Add customer names to orders
      return orders.map(order => ({
        ...order,
        customer_name: customerNameMap[order.order_id] || 'N/A'
      }));

    } catch (error) {
      console.error('❌ OrderEnhancementService: Error adding customer names:', error.message);
      return orders.map(order => ({ ...order, customer_name: 'N/A' }));
    }
  }

  /**
   * Add product images from products.xlsx
   */
  async addProductImages(orders) {
    if (!fs.existsSync(this.productsPath)) {
      console.log('⚠️  OrderEnhancementService: products.xlsx not found');
      return orders.map(order => ({ ...order, product_image: '/placeholder.svg' }));
    }

    try {
      const productsWb = XLSX.readFile(this.productsPath);
      const productsWs = productsWb.Sheets[productsWb.SheetNames[0]];
      const products = XLSX.utils.sheet_to_json(productsWs);

      // Create product image lookup map
      const productImageMap = {};
      products.forEach(product => {
        const productName = product.name?.trim();
        const productImage = product.image?.trim();
        
        if (productName && productImage) {
          // Store multiple variations of the product name
          const cleanName = this.removeSize(productName);
          productImageMap[cleanName] = productImage;
          
          // Also store the original name
          productImageMap[productName] = productImage;
          
          // Store without common variations
          const variations = this.generateProductVariations(productName);
          variations.forEach(variation => {
            productImageMap[variation] = productImage;
          });
        }
      });

      console.log(`🗺️  OrderEnhancementService: Created product image map with ${Object.keys(productImageMap).length} entries`);

      // Add product images to orders
      return orders.map(order => {
        const originalProductName = order.product_name || '';
        const cleanProductName = this.removeSize(originalProductName);
        
        // Try multiple matching strategies
        let productImage = productImageMap[originalProductName] || 
                          productImageMap[cleanProductName] ||
                          this.findBestMatch(originalProductName, Object.keys(productImageMap));
        
        // Log matching for debugging
        if (!productImage || productImage === '/placeholder.svg') {
          console.log(`⚠️  No image found for: "${originalProductName}" -> Cleaned: "${cleanProductName}"`);
        } else {
          console.log(`✅ Image found for: "${originalProductName}" -> "${productImage}"`);
        }
        
        return {
          ...order,
          product_image: productImage || '/placeholder.svg'
        };
      });

    } catch (error) {
      console.error('❌ OrderEnhancementService: Error adding product images:', error);
      return orders.map(order => ({ ...order, product_image: '/placeholder.svg' }));
    }
  }

  /**
   * Remove size from product name
   */
  removeSize(productName) {
    if (!productName) return '';
    
    const sizePatterns = [
      // Size patterns that come AFTER the product name
      / - (XS|S|M|L|XL|2XL|3XL|4XL|5XL)$/i,
      / - (\d+-\d+)$/,
      / - (XXXL|XXL)$/i,
      / - (Small|Medium|Large|Extra Large)$/i,
      / - (\d{4}-\d{4})$/i, // Year patterns like 2025-26
      
      // Size patterns that come BEFORE the product name (less common)
      /^(XS|S|M|L|XL|2XL|3XL|4XL|5XL) - /i,
      /^(Small|Medium|Large|Extra Large) - /i,
      
      // Size patterns in the middle (like "Player Version - M")
      / - (XS|S|M|L|XL|2XL|3XL|4XL|5XL)(?= - |$)/gi,
      / - (Small|Medium|Large|Extra Large)(?= - |$)/gi,
    ];
    
    let cleanName = productName.trim();
    
    // First, remove size patterns
    for (const pattern of sizePatterns) {
      cleanName = cleanName.replace(pattern, '');
    }
    
    // Then clean up any double spaces or trailing dashes
    cleanName = cleanName.replace(/\s*-\s*$/, ''); // Remove trailing dash
    cleanName = cleanName.replace(/\s+/g, ' '); // Replace multiple spaces with single space
    cleanName = cleanName.trim();
    
    return cleanName;
  }

  /**
   * Generate product name variations for better matching
   */
  generateProductVariations(productName) {
    if (!productName) return [];
    
    const variations = [];
    const cleanName = this.removeSize(productName);
    
    // Add variations without common words
    const wordsToRemove = ['jersey', 'shirt', 'kit', 'uniform'];
    wordsToRemove.forEach(word => {
      const variation = cleanName.replace(new RegExp(`\\b${word}\\b`, 'gi'), '').trim();
      if (variation && variation !== cleanName) {
        variations.push(variation);
      }
    });
    
    // Add variations with common abbreviations
    const abbreviations = {
      'home': 'h',
      'away': 'a',
      'third': '3rd',
      'player': 'player version',
      'fan': 'fan version'
    };
    
    Object.entries(abbreviations).forEach(([full, abbrev]) => {
      if (cleanName.toLowerCase().includes(full)) {
        variations.push(cleanName.replace(new RegExp(full, 'gi'), abbrev));
      }
    });
    
    return variations;
  }

  /**
   * Find best matching product name using fuzzy matching
   */
  findBestMatch(productName, availableNames) {
    if (!productName || !availableNames.length) return null;
    
    const cleanProductName = this.removeSize(productName).toLowerCase();
    
    // Try exact match first
    const exactMatch = availableNames.find(name => 
      this.removeSize(name).toLowerCase() === cleanProductName
    );
    if (exactMatch) return exactMatch;
    
    // Try partial matches
    const partialMatches = availableNames.filter(name => {
      const cleanName = this.removeSize(name).toLowerCase();
      return cleanName.includes(cleanProductName) || cleanProductName.includes(cleanName);
    });
    
    if (partialMatches.length > 0) {
      // Return the best match (longest common substring)
      return partialMatches.reduce((best, current) => {
        const bestScore = this.getSimilarityScore(cleanProductName, this.removeSize(best).toLowerCase());
        const currentScore = this.getSimilarityScore(cleanProductName, this.removeSize(current).toLowerCase());
        return currentScore > bestScore ? current : best;
      });
    }
    
    return null;
  }

  /**
   * Calculate similarity score between two strings
   */
  getSimilarityScore(str1, str2) {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    return (longer.length - this.editDistance(longer, shorter)) / longer.length;
  }

  /**
   * Calculate edit distance between two strings
   */
  editDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}

module.exports = new OrderEnhancementService(); 