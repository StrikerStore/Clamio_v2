const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Check if users.xlsx exists and read vendor data
const usersPath = path.join(__dirname, 'data/users.xlsx');
console.log('Users file exists:', fs.existsSync(usersPath));

if (fs.existsSync(usersPath)) {
  const usersWb = XLSX.readFile(usersPath);
  const usersWs = usersWb.Sheets[usersWb.SheetNames[0]];
  const users = XLSX.utils.sheet_to_json(usersWs, { defval: '' });
  
  console.log('Total users found:', users.length);
  console.log('Sample user:', users[0]);
  
  const vendors = users.filter(user => user.role === 'vendor');
  console.log('Total vendors found:', vendors.length);
  
  const activeVendors = vendors.filter(vendor => vendor.status === 'active');
  console.log('Active vendors found:', activeVendors.length);
  
  if (activeVendors.length > 0) {
    console.log('Sample active vendor:', activeVendors[0]);
  }
  
  // Show all users to see the structure
  console.log('\nAll users:');
  users.forEach((user, index) => {
    console.log(`${index + 1}. Role: ${user.role}, Status: ${user.status}, Name: ${user.name}`);
  });
} 