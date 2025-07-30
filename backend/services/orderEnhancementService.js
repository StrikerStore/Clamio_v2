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
          productImageMap[productName] = productImage;
        }
      });

      console.log(`🗺️  OrderEnhancementService: Created product image map with ${Object.keys(productImageMap).length} entries`);

      // Function to remove size from product name
      const removeSize = (productName) => {
        if (!productName) return '';
        
        const sizePatterns = [
          / - (XS|S|M|L|XL|2XL|3XL|4XL|5XL)$/i,
          / - (\d+-\d+)$/,
          / - (XXXL|XXL)$/i,
          / - (Small|Medium|Large|Extra Large)$/i,
        ];
        
        let cleanName = productName.trim();
        for (const pattern of sizePatterns) {
          cleanName = cleanName.replace(pattern, '');
        }
        return cleanName.trim();
      };

      // Add product images to orders
      return orders.map(order => {
        const originalProductName = order.product_name || '';
        const cleanProductName = removeSize(originalProductName);
        const productImage = productImageMap[cleanProductName];
        
        return {
          ...order,
          product_image: productImage || '/placeholder.svg'
        };
      });

    } catch (error) {
      console.error('❌ OrderEnhancementService: Error adding product images:', error.message);
      return orders.map(order => ({ ...order, product_image: '/placeholder.svg' }));
    }
  }
}

module.exports = new OrderEnhancementService(); 