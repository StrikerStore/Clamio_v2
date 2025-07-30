const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Check admin users
const usersPath = path.join(__dirname, 'data/users.xlsx');
console.log('Users file exists:', fs.existsSync(usersPath));

if (fs.existsSync(usersPath)) {
  const usersWb = XLSX.readFile(usersPath);
  const usersWs = usersWb.Sheets[usersWb.SheetNames[0]];
  const users = XLSX.utils.sheet_to_json(usersWs, { defval: '' });
  
  console.log('\nAll users with roles:');
  users.forEach((user, index) => {
    console.log(`${index + 1}. Role: ${user.role}, Email: ${user.email}, Name: ${user.name}, Status: ${user.status}`);
  });
  
  const admins = users.filter(user => user.role === 'admin' && user.status === 'active');
  console.log('\nActive admin users:');
  admins.forEach((admin, index) => {
    console.log(`${index + 1}. Email: ${admin.email}, Name: ${admin.name}`);
  });
  
  const superadmins = users.filter(user => user.role === 'superadmin' && user.status === 'active');
  console.log('\nActive superadmin users:');
  superadmins.forEach((superadmin, index) => {
    console.log(`${index + 1}. Email: ${superadmin.email}, Name: ${superadmin.name}`);
  });
} 