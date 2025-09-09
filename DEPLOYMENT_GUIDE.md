# 🚀 Deployment Guide for New Machine

This guide will help you deploy your migrated MySQL-based application to a new machine.

## 📋 Prerequisites

### On New Machine:
1. **Node.js** (v16 or higher)
2. **MySQL Server** (v8.0 or higher)
3. **Git** (to clone repository)

### Required Files from Current Machine:
1. **Excel Data Files** (copy these to new machine):
   - `backend/data/users.xlsx`
   - `backend/data/carrier.xlsx`
   - `backend/data/settlements.xlsx`
   - `backend/data/transactions.xlsx`
   - `backend/data/orders.xlsx` (if you want to migrate existing orders)

2. **Environment File**:
   - Copy your `.env` file to the new machine

## 🔧 Step-by-Step Setup

### 1. Clone Repository
```bash
git clone <your-repository-url>
cd Clamio_v2
```

### 2. Install Dependencies
```bash
cd backend
npm install
```

### 3. Setup MySQL Database
```bash
# Install MySQL (if not already installed)
# Windows: Download from mysql.com
# Linux: sudo apt-get install mysql-server
# macOS: brew install mysql

# Start MySQL service
# Windows: Start MySQL service from Services
# Linux: sudo systemctl start mysql
# macOS: brew services start mysql
```

### 4. Configure Environment Variables
Create/update `.env` file in the `backend` directory:
```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=clamio_v3

# Shipway API Configuration
SHIPWAY_USERNAME=your_shipway_username
SHIPWAY_PASSWORD=your_shipway_password
SHIPWAY_BASIC_AUTH_HEADER=your_basic_auth_header

# Server Configuration
PORT=5000
NODE_ENV=production
```

### 5. Copy Excel Data Files
Copy these files from your current machine to the new machine:
```
backend/data/
├── users.xlsx
├── carrier.xlsx
├── settlements.xlsx
├── transactions.xlsx
└── orders.xlsx (optional)
```

### 6. Run Complete Setup Script
```bash
cd backend
node -r dotenv/config scripts/setup-new-machine-complete.js
```

This script will:
- ✅ Create the `clamio_v3` database
- ✅ Create all required tables (carriers, products, users, settlements, transactions, orders)
- ✅ Create indexes for better performance
- ✅ Migrate all data from Excel files to MySQL
- ✅ Show detailed progress and results

### 7. Start the Application
```bash
# Start the backend server
npm start

# In another terminal, start the frontend (if needed)
cd ../frontend
npm install
npm start
```

## 🔍 Verification

### Check Database Setup:
```bash
# Connect to MySQL
mysql -u root -p

# Use the database
USE clamio_v3;

# Check tables
SHOW TABLES;

# Check data counts
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'carriers', COUNT(*) FROM carriers
UNION ALL
SELECT 'settlements', COUNT(*) FROM settlements
UNION ALL
SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL
SELECT 'orders', COUNT(*) FROM orders;
```

### Test API Endpoints:
```bash
# Test database connection
curl http://localhost:5000/api/health

# Test carriers endpoint
curl http://localhost:5000/api/shipway/carriers

# Test users endpoint (with auth)
curl -H "Authorization: your_auth_token" http://localhost:5000/api/users
```

## 🚨 Troubleshooting

### Common Issues:

1. **MySQL Connection Failed**:
   - Check if MySQL service is running
   - Verify credentials in `.env` file
   - Ensure MySQL user has proper permissions

2. **Excel Files Not Found**:
   - Verify Excel files are in `backend/data/` directory
   - Check file permissions

3. **Port Already in Use**:
   - Change PORT in `.env` file
   - Or kill the process using the port

4. **Permission Denied**:
   - Ensure MySQL user has CREATE, INSERT, UPDATE, DELETE permissions
   - Run MySQL as administrator if needed

### Logs Location:
- Application logs: Check console output
- MySQL logs: Check MySQL error log
- API logs: `backend/logs/api.log`

## 📊 Data Migration Summary

The setup script will migrate:
- **Users**: All user accounts with authentication data
- **Carriers**: All carrier information and priorities
- **Settlements**: All settlement records and status
- **Transactions**: All transaction history
- **Orders**: All order data (if Excel file provided)

## 🔄 Future Updates

After initial setup, your application will:
- ✅ Use MySQL for all data operations
- ✅ No longer depend on Excel files
- ✅ Automatically sync new data to MySQL
- ✅ Maintain all existing functionality

## 📞 Support

If you encounter any issues:
1. Check the console logs for error messages
2. Verify all prerequisites are installed
3. Ensure Excel data files are present
4. Check MySQL service status and permissions

---

**🎉 Congratulations!** Your application is now fully migrated to MySQL and ready to run on the new machine.
