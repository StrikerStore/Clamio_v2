const fs = require('fs');
const path = require('path');

/**
 * Inspect raw orders file structure
 */
function inspectRawOrders() {
  console.log('🔍 Inspecting Raw Orders File Structure...\n');

  const rawOrdersPath = path.join(__dirname, '../data/raw_shipway_orders.json');
  
  console.log(`📁 File path: ${rawOrdersPath}`);
  
  // Check if file exists
  if (!fs.existsSync(rawOrdersPath)) {
    console.log('❌ File does not exist!');
    return;
  }
  
  // Get file stats
  const stats = fs.statSync(rawOrdersPath);
  console.log(`📊 File size: ${stats.size} bytes`);
  console.log(`📅 Last modified: ${stats.mtime}`);
  
  if (stats.size === 0) {
    console.log('❌ File is empty!');
    return;
  }
  
  // Read file content
  try {
    const fileContent = fs.readFileSync(rawOrdersPath, 'utf8');
    console.log(`📄 File content length: ${fileContent.length} characters`);
    
    // Check if content is empty or just whitespace
    if (!fileContent || fileContent.trim() === '') {
      console.log('❌ File content is empty or only whitespace!');
      return;
    }
    
    // Try to parse JSON
    let data;
    try {
      data = JSON.parse(fileContent);
      console.log('✅ JSON parsed successfully');
    } catch (parseError) {
      console.log('❌ JSON parsing failed:', parseError.message);
      console.log('📄 First 500 characters of file:');
      console.log(fileContent.substring(0, 500));
      return;
    }
    
    // Analyze data structure
    console.log(`\n📊 Data Analysis:`);
    console.log(`   Type: ${typeof data}`);
    console.log(`   Is null: ${data === null}`);
    console.log(`   Is array: ${Array.isArray(data)}`);
    console.log(`   Is object: ${typeof data === 'object' && data !== null}`);
    
    if (Array.isArray(data)) {
      console.log(`   Array length: ${data.length}`);
      
      if (data.length > 0) {
        console.log(`   First item type: ${typeof data[0]}`);
        console.log(`   First item keys:`, Object.keys(data[0]));
        console.log(`   Sample first item:`, JSON.stringify(data[0], null, 2));
      } else {
        console.log('   Array is empty');
      }
      
    } else if (typeof data === 'object' && data !== null) {
      console.log(`   Object keys:`, Object.keys(data));
      
      // Check for common patterns
      if (data.orders && Array.isArray(data.orders)) {
        console.log(`   Found 'orders' array with ${data.orders.length} items`);
        if (data.orders.length > 0) {
          console.log(`   First order keys:`, Object.keys(data.orders[0]));
        }
      }
      
      if (data.data && Array.isArray(data.data)) {
        console.log(`   Found 'data' array with ${data.data.length} items`);
        if (data.data.length > 0) {
          console.log(`   First data item keys:`, Object.keys(data.data[0]));
        }
      }
      
      // Show full structure
      console.log(`   Full object structure:`, JSON.stringify(data, null, 2));
    }
    
  } catch (error) {
    console.log('❌ Error reading file:', error.message);
  }
}

// Run the inspection
inspectRawOrders(); 