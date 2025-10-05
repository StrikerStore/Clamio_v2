# Auto-Reverse Expired Orders Feature

## Overview

This feature automatically reverses orders that have been claimed by vendors for more than 24 hours without downloading a shipping label. This prevents vendors from unnecessarily holding orders and allows other vendors to process them.

## 🚀 **AUTOMATIC EXECUTION** 

The auto-reversal feature now runs **automatically** without any external setup:

1. **On Server Startup**: Runs once when the server starts (after 5-second delay)
2. **Scheduled Execution**: Runs automatically every 2 hours
3. **No External Dependencies**: Uses built-in Node.js scheduling (no cron required)

You don't need to set up any cron jobs or external schedulers!

## How It Works

### Criteria for Auto-Reversal
An order will be automatically reversed if ALL of the following conditions are met:
1. `status = 'claimed'` (order is currently claimed)
2. `label_downloaded = 0` (vendor has NOT downloaded the shipping label)
3. `claimed_at < NOW() - 24 HOURS` (order was claimed more than 24 hours ago)

### What Happens During Auto-Reversal
When an order meets the criteria, the system will:
- Set `status = 'unclaimed'`
- Clear `claimed_by = NULL`
- Clear `claimed_at = NULL`
- **Keep `label_downloaded = 0`** (unchanged)
- **Keep `last_claimed_by` and `last_claimed_at`** (for history)

The order will then appear back in the "All Orders" section and be available for other vendors to claim.

## API Endpoints

### POST /api/orders/auto-reverse-expired

**Access:** Admin/Superadmin only

**Authentication:** Basic Auth required

**Request Body:** Empty (no parameters needed)

**Response:**
```json
{
  "success": true,
  "message": "Successfully auto-reversed 5 expired orders",
  "data": {
    "total_checked": 8,
    "auto_reversed": 5,
    "details": [
      {
        "order_unique_id": "ORD123-ITEM1",
        "order_id": "ORD123",
        "claimed_by": "WAREHOUSE001",
        "claimed_at": "2024-01-15T10:30:00.000Z",
        "hours_claimed": 26
      }
    ],
    "reversed_at": "2024-01-16T12:30:00.000Z",
    "execution_time_ms": 1250
  }
}
```

### GET /api/orders/auto-reverse-stats

**Access:** Admin/Superadmin only

**Authentication:** Basic Auth required

**Response:**
```json
{
  "success": true,
  "data": {
    "isRunning": false,
    "lastRun": "2024-01-16T12:30:00.000Z",
    "totalRuns": 15,
    "totalReversed": 42,
    "uptime": 3600.5
  }
}
```

## 🎯 **Execution Methods**

### Method 1: Automatic (Recommended)
**No setup required!** The feature runs automatically:
- ✅ **Server Startup**: Runs once when server starts
- ✅ **Every 2 Hours**: Scheduled automatic execution
- ✅ **Built-in**: Uses Node.js internal scheduling

### Method 2: Manual API Call
Call the endpoint manually when needed:
```bash
curl -X POST http://localhost:5000/api/orders/auto-reverse-expired \
  -u admin:admin123 \
  -H "Content-Type: application/json"
```

### Method 3: Script Execution
Use the provided script for manual or external scheduling:

**API Mode (default):**
```bash
cd backend
node scripts/auto-reverse-expired-orders.js
```

**Direct Mode (no API call):**
```bash
cd backend
node scripts/auto-reverse-expired-orders.js --direct
```

### Method 4: External Scheduler (Optional)
If you want to override the built-in scheduling, you can still use external schedulers:

**Cron Job:**
```bash
0 */2 * * * cd /path/to/backend && node scripts/auto-reverse-expired-orders.js
```

**Windows Task Scheduler:**
Set up a task to run the script every 2 hours.

### Method 5: Custom Node.js Scheduler (Optional)
```javascript
const cron = require('node-cron');
const axios = require('axios');

// Override the built-in schedule if needed
cron.schedule('0 */6 * * *', async () => { // Every 6 hours instead of 2
  try {
    await axios.post('http://localhost:5000/api/orders/auto-reverse-expired', {}, {
      auth: { username: 'admin', password: 'admin123' }
    });
    console.log('Custom auto-reversal completed');
  } catch (error) {
    console.error('Custom auto-reversal failed:', error.message);
  }
});
```

## Monitoring and Logging

### Console Logs
The system logs detailed information about the auto-reversal process:
- Number of orders checked
- Number of orders auto-reversed
- Details of each auto-reversed order
- Execution time and timestamps

### Log Entry Format
```
[2024-01-16T12:30:00.000Z] AUTO-REVERSAL: 5 orders auto-reversed due to 24+ hour claim without label download
```

## Configuration

### Environment Variables
- `AUTO_REVERSE_API_URL`: API endpoint URL (default: http://localhost:5000/api/orders/auto-reverse-expired)
- `AUTO_REVERSE_USERNAME`: Basic auth username (default: admin)
- `AUTO_REVERSE_PASSWORD`: Basic auth password (default: admin123)

### Customizing the 24-Hour Threshold
To change the time threshold, modify the SQL query in the endpoint:
```sql
-- Change from 24 hours to 48 hours
AND claimed_at < DATE_SUB(NOW(), INTERVAL 48 HOUR)
```

## Testing

### Manual Testing
1. Create a test order and claim it
2. Manually update the `claimed_at` timestamp to be older than 24 hours:
   ```sql
   UPDATE claims SET claimed_at = DATE_SUB(NOW(), INTERVAL 25 HOUR) WHERE order_unique_id = 'TEST-ORDER';
   ```
3. Call the auto-reverse endpoint
4. Verify the order status changed to 'unclaimed'

### Test Script
```bash
# Test the endpoint manually
curl -X POST http://localhost:5000/api/orders/auto-reverse-expired \
  -u admin:admin123 \
  -H "Content-Type: application/json"
```

## Security Considerations

- The endpoint requires admin/superadmin authentication
- Basic auth credentials should be stored securely as environment variables
- Consider using HTTPS in production
- Monitor logs for any unusual auto-reversal activity

## Troubleshooting

### Common Issues

1. **No orders auto-reversed despite eligible orders**
   - Check if orders actually meet all criteria (claimed, label_downloaded=0, >24 hours)
   - Verify database connection and table structure

2. **Script fails to connect to API**
   - Check if the server is running
   - Verify the API URL and credentials
   - Check network connectivity

3. **Permission denied errors**
   - Ensure the script has proper file permissions
   - Verify database user has UPDATE permissions on claims table

### Debug Mode
Add debug logging to see more details:
```javascript
// Add to the auto-reverse script
console.log('API URL:', CONFIG.apiUrl);
console.log('Username:', CONFIG.username);
console.log('Password:', CONFIG.password ? '***' : 'NOT SET');
```
