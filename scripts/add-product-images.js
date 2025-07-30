const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// File paths
const ORDERS_EXCEL_PATH = path.join(__dirname, '../backend/data/orders.xlsx');
const PRODUCTS_EXCEL_PATH = path.join(__dirname, '../backend/data/products.xlsx');

console.log('🚀 Starting to add product images to orders.xlsx...\n');

// Step 1: Read products.xlsx to create image lookup map
console.log('📊 Reading products.xlsx...');
let productsData;
try {
  const productsWb = XLSX.readFile(PRODUCTS_EXCEL_PATH);
  const productsWs = productsWb.Sheets[productsWb.SheetNames[0]];
  productsData = XLSX.utils.sheet_to_json(productsWs);
  console.log(`✅ Products loaded: ${productsData.length}`);
} catch (error) {
  console.error('❌ Error reading products.xlsx:', error.message);
  process.exit(1);
}

// Create product name to image lookup map
console.log('🗺️ Creating product image lookup map...');
const productImageMap = {};
productsData.forEach(product => {
  const productName = product.name?.trim();
  const productImage = product.image?.trim();
  
  if (productName && productImage) {
    productImageMap[productName] = productImage;
  }
});

console.log(`📋 Created image map with ${Object.keys(productImageMap).length} entries`);
console.log('🔬 Sample mappings:');
Object.entries(productImageMap).slice(0, 3).forEach(([name, image]) => {
  console.log(`   - "${name}" -> "${image.substring(0, 60)}..."`);
});

// Function to remove size from product name
function removeSize(productName) {
  if (!productName) return '';
  
  // Common size patterns at the end of product names
  const sizePatterns = [
    / - (XS|S|M|L|XL|2XL|3XL|4XL|5XL)$/i,           // Standard sizes
    / - (\d+-\d+)$/,                                   // Kids sizes like 16-18, 24-26
    / - (XXXL|XXL)$/i,                                 // Extended sizes
    / - (Small|Medium|Large|Extra Large)$/i,           // Word sizes
  ];
  
  let cleanName = productName.trim();
  
  // Try each pattern
  for (const pattern of sizePatterns) {
    cleanName = cleanName.replace(pattern, '');
  }
  
  return cleanName.trim();
}

// Step 2: Read orders.xlsx
console.log('\n📦 Reading orders.xlsx...');
let ordersWorkbook, ordersWorksheet, ordersData;
try {
  ordersWorkbook = XLSX.readFile(ORDERS_EXCEL_PATH);
  ordersWorksheet = ordersWorkbook.Sheets[ordersWorkbook.SheetNames[0]];
  ordersData = XLSX.utils.sheet_to_json(ordersWorksheet);
  console.log(`✅ Orders loaded: ${ordersData.length}`);
} catch (error) {
  console.error('❌ Error reading orders.xlsx:', error.message);
  process.exit(1);
}

// Step 3: Add product images to orders
console.log('\n🖼️ Adding product images to orders...');
let matchedImages = 0;
let unmatchedProducts = 0;

const updatedOrdersData = ordersData.map((order, index) => {
  const originalProductName = order.product_name || '';
  const cleanProductName = removeSize(originalProductName);
  const productImage = productImageMap[cleanProductName];
  
  if (productImage) {
    matchedImages++;
    if (index < 5) { // Log first 5 matches
      console.log(`✅ Row ${index + 1}: "${originalProductName}" -> "${cleanProductName}" -> Image found`);
    }
    return {
      ...order,
      product_image: productImage
    };
  } else {
    unmatchedProducts++;
    if (unmatchedProducts <= 5) { // Log first 5 unmatched
      console.log(`⚠️  Row ${index + 1}: "${originalProductName}" -> "${cleanProductName}" -> No image found`);
    }
    return {
      ...order,
      product_image: '/placeholder.svg' // Default placeholder
    };
  }
});

console.log(`\n📊 Image Mapping Summary:`);
console.log(`   ✅ Matched images: ${matchedImages}`);
console.log(`   ⚠️  Unmatched products: ${unmatchedProducts}`);
console.log(`   📋 Total orders: ${updatedOrdersData.length}`);

// Step 4: Create backup
console.log('\n💾 Creating backup...');
const backupPath = ORDERS_EXCEL_PATH.replace('.xlsx', '_backup.xlsx');
try {
  // Only create backup if it doesn't exist
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(ORDERS_EXCEL_PATH, backupPath);
    console.log(`✅ Backup created: ${backupPath}`);
  } else {
    console.log(`ℹ️  Backup already exists: ${backupPath}`);
  }
} catch (error) {
  console.error('❌ Error creating backup:', error.message);
  process.exit(1);
}

// Step 5: Save updated orders.xlsx
console.log('\n💾 Saving updated orders.xlsx...');
try {
  const newWorksheet = XLSX.utils.json_to_sheet(updatedOrdersData);
  ordersWorkbook.Sheets[ordersWorkbook.SheetNames[0]] = newWorksheet;
  XLSX.writeFile(ordersWorkbook, ORDERS_EXCEL_PATH);
  console.log(`✅ Updated orders.xlsx saved successfully`);
} catch (error) {
  console.error('❌ Error saving updated Excel:', error.message);
  process.exit(1);
}

// Step 6: Verify the update
console.log('\n🔍 Verifying the update...');
try {
  const verifyWorkbook = XLSX.readFile(ORDERS_EXCEL_PATH);
  const verifyWorksheet = verifyWorkbook.Sheets[verifyWorkbook.SheetNames[0]];
  const verifyData = XLSX.utils.sheet_to_json(verifyWorksheet);
  
  const samplesWithImages = verifyData.filter(row => 
    row.product_image && row.product_image !== '/placeholder.svg'
  ).slice(0, 3);
  
  console.log(`✅ Verification successful!`);
  console.log(`📋 Total rows: ${verifyData.length}`);
  console.log(`🖼️ Sample rows with images:`);
  samplesWithImages.forEach((row, i) => {
    console.log(`   ${i+1}. ${row.product_name}`);
    console.log(`      -> ${row.product_image.substring(0, 60)}...`);
  });
  
} catch (error) {
  console.error('❌ Error verifying update:', error.message);
}

console.log('\n🎉 Product images addition completed successfully!');
console.log(`📁 Updated file: ${ORDERS_EXCEL_PATH}`);
console.log(`📋 Backup file: ${backupPath}`);
console.log(`\n✨ The orders.xlsx file now includes a 'product_image' column with images from products.xlsx`); 