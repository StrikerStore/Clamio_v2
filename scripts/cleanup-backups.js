const fs = require('fs');
const path = require('path');

const backendDataPath = path.join(__dirname, '../backend/data');

console.log('🧹 Cleaning up multiple backup files...\n');

// List of backup files to remove (keep only orders_backup.xlsx)
const backupFilesToRemove = [
  'orders_backup_before_customer_name.xlsx',
  'orders_backup_before_images.xlsx'
];

let filesRemoved = 0;
let filesNotFound = 0;

backupFilesToRemove.forEach(filename => {
  const filePath = path.join(backendDataPath, filename);
  
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`✅ Removed: ${filename}`);
      filesRemoved++;
    } catch (error) {
      console.error(`❌ Error removing ${filename}:`, error.message);
    }
  } else {
    console.log(`ℹ️  Not found: ${filename}`);
    filesNotFound++;
  }
});

console.log(`\n📊 Cleanup Summary:`);
console.log(`   🗑️  Files removed: ${filesRemoved}`);
console.log(`   ℹ️  Files not found: ${filesNotFound}`);

// Check if main backup exists
const mainBackupPath = path.join(backendDataPath, 'orders_backup.xlsx');
if (fs.existsSync(mainBackupPath)) {
  console.log(`   ✅ Main backup exists: orders_backup.xlsx`);
} else {
  console.log(`   ⚠️  Main backup missing: orders_backup.xlsx`);
  console.log(`   💡 Run the customer name or images script to create it`);
}

console.log('\n🎉 Backup cleanup completed!'); 