const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// File paths
const ORDERS_EXCEL_PATH = path.join(__dirname, '../backend/data/orders.xlsx');
const RAW_SHIPWAY_JSON_PATH = path.join(__dirname, '../backend/data/raw_shipway_orders.json');

console.log('🚀 Starting to add customer_name column to orders.xlsx...\n');

// Step 1: Read the raw shipway orders JSON
console.log('📄 Reading raw shipway orders JSON...');
let rawShipwayData;
try {
  const jsonData = fs.readFileSync(RAW_SHIPWAY_JSON_PATH, 'utf8');
  rawShipwayData = JSON.parse(jsonData);
  console.log(`✅ Raw shipway data loaded successfully`);
} catch (error) {
  console.error('❌ Error reading raw shipway JSON:', error.message);
  process.exit(1);
}

// Extract orders array from the response
let shipwayOrders = [];
if (rawShipwayData.success === 1 && Array.isArray(rawShipwayData.message)) {
  shipwayOrders = rawShipwayData.message;
} else if (rawShipwayData.success && rawShipwayData.data && Array.isArray(rawShipwayData.data.orders)) {
  shipwayOrders = rawShipwayData.data.orders;
} else {
  console.error('❌ Invalid raw shipway data format');
  process.exit(1);
}

console.log(`📦 Found ${shipwayOrders.length} orders in raw shipway data`);

// Create a lookup map: order_id -> customer_name
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

console.log(`🗺️ Created customer name lookup map with ${Object.keys(customerNameMap).length} entries`);
console.log('📝 Sample customer names:');
Object.entries(customerNameMap).slice(0, 3).forEach(([orderId, name]) => {
  console.log(`   - Order ${orderId}: ${name}`);
});

// Step 2: Read the existing orders.xlsx file
console.log('\n📊 Reading existing orders.xlsx file...');
let ordersWorkbook, ordersWorksheet, ordersData;
try {
  ordersWorkbook = XLSX.readFile(ORDERS_EXCEL_PATH);
  ordersWorksheet = ordersWorkbook.Sheets[ordersWorkbook.SheetNames[0]];
  ordersData = XLSX.utils.sheet_to_json(ordersWorksheet);
  console.log(`✅ Orders Excel loaded successfully with ${ordersData.length} rows`);
} catch (error) {
  console.error('❌ Error reading orders Excel:', error.message);
  process.exit(1);
}

// Step 3: Add customer_name column to each row
console.log('\n🔄 Adding customer_name column to orders...');
let matchedRows = 0;
let unmatchedRows = 0;

const updatedOrdersData = ordersData.map((row, index) => {
  const orderId = row.order_id?.toString();
  const customerName = customerNameMap[orderId];
  
  if (customerName) {
    matchedRows++;
    if (index < 5) { // Log first 5 matches
      console.log(`✅ Row ${index + 1}: Order ${orderId} -> Customer: ${customerName}`);
    }
    return {
      ...row,
      customer_name: customerName
    };
  } else {
    unmatchedRows++;
    if (unmatchedRows <= 3) { // Log first 3 unmatched
      console.log(`⚠️  Row ${index + 1}: Order ${orderId} -> No customer name found`);
    }
    return {
      ...row,
      customer_name: 'N/A'
    };
  }
});

console.log(`\n📊 Processing Summary:`);
console.log(`   ✅ Matched rows: ${matchedRows}`);
console.log(`   ⚠️  Unmatched rows: ${unmatchedRows}`);
console.log(`   📋 Total rows: ${updatedOrdersData.length}`);

// Step 4: Create backup of original file
console.log('\n💾 Creating backup of original file...');
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

// Step 5: Save updated Excel file
console.log('\n💾 Saving updated orders.xlsx file...');
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
  
  const sampleWithCustomerName = verifyData.filter(row => row.customer_name && row.customer_name !== 'N/A').slice(0, 3);
  
  console.log(`✅ Verification successful!`);
  console.log(`📋 Total rows in updated file: ${verifyData.length}`);
  console.log(`👥 Sample rows with customer names:`);
  sampleWithCustomerName.forEach(row => {
    console.log(`   - Order ${row.order_id}: ${row.customer_name}`);
  });
  
} catch (error) {
  console.error('❌ Error verifying update:', error.message);
}

console.log('\n🎉 Customer name column addition completed successfully!');
console.log(`📁 Updated file: ${ORDERS_EXCEL_PATH}`);
console.log(`📋 Backup file: ${backupPath}`);
console.log(`\n✨ The orders.xlsx file now includes a 'customer_name' column with data from raw_shipway_orders.json`); 