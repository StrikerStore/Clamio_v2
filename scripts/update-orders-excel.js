const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// File paths
const EXCEL_FILE_PATH = path.join(__dirname, '../backend/data/orders.xlsx');
const API_RESPONSE_PATH = path.join(__dirname, '../backend/data/shipway-orders-response.json');

// Function to read Excel file
function readExcelFile(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    return { workbook, worksheet, data, sheetName };
  } catch (error) {
    console.error('Error reading Excel file:', error.message);
    throw error;
  }
}

// Function to write Excel file
function writeExcelFile(workbook, filePath) {
  try {
    XLSX.writeFile(workbook, filePath);
    console.log(`✅ Excel file updated: ${filePath}`);
  } catch (error) {
    console.error('Error writing Excel file:', error.message);
    throw error;
  }
}

// Function to read API response JSON
function readAPIResponse(filePath) {
  try {
    const jsonData = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(jsonData);
  } catch (error) {
    console.error('Error reading API response JSON:', error.message);
    throw error;
  }
}

// Function to calculate payment type
function getPaymentType(orderTags) {
  if (Array.isArray(orderTags) && orderTags.includes('PPCOD')) {
    return 'C'; // COD
  }
  return 'P'; // Prepaid
}

// Function to calculate prepaid amount
function getPrepaidAmount(paymentType, orderTotal) {
  const total = parseFloat(orderTotal);
  if (paymentType === 'P') {
    return total.toFixed(2);
  } else if (paymentType === 'C') {
    return (total * 0.1).toFixed(2); // 10% of order total
  }
  return '0.00';
}

// Function to find matching product in API response
function findMatchingProduct(apiOrders, orderId, productName, productCode) {
  for (const order of apiOrders) {
    if (order.order_id === orderId) {
      for (const product of order.products || []) {
        // Match by product name or product code
        if (product.product === productName || product.product_code === productCode) {
          return {
            order: order,
            product: product
          };
        }
      }
    }
  }
  return null;
}

// Main function to update Excel file
function updateOrdersExcel() {
  console.log('🚀 Starting Excel update process...\n');

  // Step 1: Read Excel file
  console.log('📊 Reading Excel file...');
  const { workbook, worksheet, data } = readExcelFile(EXCEL_FILE_PATH);
  console.log(`Found ${data.length} rows in Excel file`);

  // Step 2: Read API response
  console.log('\n📄 Reading API response...');
  const apiResponse = readAPIResponse(API_RESPONSE_PATH);
  
  let apiOrders = [];
  if (apiResponse.success === 1 && Array.isArray(apiResponse.message)) {
    apiOrders = apiResponse.message;
  } else if (apiResponse.success && apiResponse.data && Array.isArray(apiResponse.data.orders)) {
    apiOrders = apiResponse.data.orders;
  } else {
    console.error('❌ Invalid API response format');
    return;
  }
  
  console.log(`Found ${apiOrders.length} orders in API response`);

  // Step 3: Process each row and add new columns
  console.log('\n🔄 Processing rows and adding columns...');
  let updatedRows = 0;
  let skippedRows = 0;

  const updatedData = data.map((row, index) => {
    const orderId = row.order_id?.toString();
    const productName = row.product_name;
    const productCode = row.product_code;

    if (!orderId || (!productName && !productCode)) {
      console.log(`⚠️  Row ${index + 1}: Missing order_id or product info, skipping`);
      skippedRows++;
      return row;
    }

    // Find matching order and product in API response
    const match = findMatchingProduct(apiOrders, orderId, productName, productCode);
    
    if (match) {
      const { order, product } = match;
      
      // Calculate new column values
      const sellingPrice = parseFloat(product.price || '0').toFixed(2);
      const orderTotal = parseFloat(order.order_total || '0').toFixed(2);
      const paymentType = getPaymentType(order.order_tags);
      const prepaidAmount = getPrepaidAmount(paymentType, order.order_total);
      
      // Add new columns
      const updatedRow = {
        ...row,
        selling_price: sellingPrice,
        order_total: orderTotal,
        payment_type: paymentType,
        prepaid_amount: prepaidAmount
      };
      
      updatedRows++;
      
      if (index < 5) { // Log first 5 updates for verification
        console.log(`✅ Row ${index + 1} (Order: ${orderId}): Added columns`);
        console.log(`   - selling_price: ${sellingPrice}`);
        console.log(`   - order_total: ${orderTotal}`);
        console.log(`   - payment_type: ${paymentType}`);
        console.log(`   - prepaid_amount: ${prepaidAmount}`);
      }
      
      return updatedRow;
    } else {
      console.log(`⚠️  Row ${index + 1}: No matching order/product found for Order ID: ${orderId}, Product: ${productName || productCode}`);
      skippedRows++;
      return row;
    }
  });

  // Step 4: Convert back to worksheet and save
  console.log('\n💾 Saving updated Excel file...');
  const newWorksheet = XLSX.utils.json_to_sheet(updatedData);
  workbook.Sheets[workbook.SheetNames[0]] = newWorksheet;
  
  // Create backup of original file
  const backupPath = EXCEL_FILE_PATH.replace('.xlsx', '_backup.xlsx');
  fs.copyFileSync(EXCEL_FILE_PATH, backupPath);
  console.log(`📋 Backup created: ${backupPath}`);
  
  // Save updated file
  writeExcelFile(workbook, EXCEL_FILE_PATH);

  // Step 5: Summary
  console.log('\n🎉 Update completed!');
  console.log(`✅ Updated rows: ${updatedRows}`);
  console.log(`⚠️  Skipped rows: ${skippedRows}`);
  console.log(`📁 Updated file: ${EXCEL_FILE_PATH}`);
  console.log(`📋 Backup file: ${backupPath}`);
}

// Execute if run directly
if (require.main === module) {
  try {
    updateOrdersExcel();
  } catch (error) {
    console.error('💥 Error during update process:', error.message);
    process.exit(1);
  }
}

module.exports = { updateOrdersExcel }; 