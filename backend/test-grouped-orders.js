const XLSX = require('xlsx');
const path = require('path');

function testGroupedOrders() {
  try {
    console.log('🧪 Testing Grouped Orders Image Data...\n');
    
    const ordersExcelPath = path.join(__dirname, 'data/orders.xlsx');
    const usersExcelPath = path.join(__dirname, 'data/users.xlsx');
    
    // Check if files exist
    if (!require('fs').existsSync(ordersExcelPath)) {
      console.log('❌ orders.xlsx not found');
      return;
    }
    
    if (!require('fs').existsSync(usersExcelPath)) {
      console.log('❌ users.xlsx not found');
      return;
    }
    
    // Read orders data
    const ordersWorkbook = XLSX.readFile(ordersExcelPath);
    const ordersWorksheet = ordersWorkbook.Sheets[ordersWorkbook.SheetNames[0]];
    const orders = XLSX.utils.sheet_to_json(ordersWorksheet);
    
    // Read users data
    const usersWorkbook = XLSX.readFile(usersExcelPath);
    const usersWorksheet = usersWorkbook.Sheets[usersWorkbook.SheetNames[0]];
    const users = XLSX.utils.sheet_to_json(usersWorksheet);
    
    console.log(`📊 Orders found: ${orders.length}`);
    console.log(`📊 Users found: ${users.length}`);
    
    // Find a vendor
    const vendor = users.find(u => u.role === 'vendor' && u.active_session === 'TRUE');
    if (!vendor) {
      console.log('❌ No active vendor found');
      return;
    }
    
    console.log(`\n👤 Vendor found: ${vendor.name} (Warehouse ID: ${vendor.warehouseId})`);
    
    // Filter orders claimed by this vendor
    const vendorOrders = orders.filter(order => 
      order.claimed_by === vendor.warehouseId && 
      (order.status === 'claimed' || order.status === 'ready_for_handover')
    );
    
    console.log(`📦 Vendor orders found: ${vendorOrders.length}`);
    
    // Group orders by order_id (simulating the backend logic)
    const groupedOrders = {};
    
    vendorOrders.forEach(order => {
      const orderId = order.order_id;
      
      if (!groupedOrders[orderId]) {
        groupedOrders[orderId] = {
          order_id: orderId,
          status: order.status,
          order_date: order.order_date || order.created_at,
          customer_name: order.customer_name || order.customer,
          claimed_at: order.claimed_at,
          total_value: 0,
          total_products: 0,
          products: []
        };
      }
      
      // Add product to the group (this is how the backend does it)
      groupedOrders[orderId].products.push({
        unique_id: order.unique_id,
        product_name: order.product_name || order.product,
        product_code: order.product_code,
        value: order.value || order.price || 0,
        image: order.image || order.product_image, // This is the key mapping
        quantity: order.quantity || 1
      });
      
      // Update totals
      const productValue = parseFloat(order.value || order.price || 0);
      groupedOrders[orderId].total_value += productValue;
      groupedOrders[orderId].total_products += 1;
    });
    
    const groupedOrdersArray = Object.values(groupedOrders);
    
    console.log(`\n📊 Grouped orders created: ${groupedOrdersArray.length}`);
    
    // Check image data in grouped orders
    let productsWithImages = 0;
    let productsWithoutImages = 0;
    
    groupedOrdersArray.forEach((groupedOrder, index) => {
      console.log(`\n📦 Order ${index + 1}: ${groupedOrder.order_id}`);
      console.log(`   Products: ${groupedOrder.total_products}`);
      
      groupedOrder.products.forEach((product, productIndex) => {
        console.log(`   Product ${productIndex + 1}: ${product.product_name}`);
        console.log(`     Image field: ${product.image || 'NO IMAGE'}`);
        
        if (product.image && product.image.trim() !== '') {
          productsWithImages++;
        } else {
          productsWithoutImages++;
        }
      });
    });
    
    console.log(`\n📊 Image Statistics:`);
    console.log(`  - Products with images: ${productsWithImages}`);
    console.log(`  - Products without images: ${productsWithoutImages}`);
    console.log(`  - Image coverage: ${((productsWithImages / (productsWithImages + productsWithoutImages)) * 100).toFixed(1)}%`);
    
    console.log('\n✅ Grouped Orders Test Completed!');
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testGroupedOrders(); 