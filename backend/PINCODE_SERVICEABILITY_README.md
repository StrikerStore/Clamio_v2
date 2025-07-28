# Pincode Serviceability Feature

This feature checks carrier serviceability at pincodes and automatically assigns the highest priority carrier to each order based on pincode serviceability and carrier priorities.

## Features

- **Pincode Serviceability Check**: Check which carriers can service a specific pincode
- **Priority-Based Carrier Assignment**: Assign carriers based on priority levels from Excel
- **Bulk Order Processing**: Process all orders and assign carriers automatically
- **API Integration**: Uses Shipway API for serviceability checks
- **Priority Mapping**: Maps serviceable carriers with priority from `logistic_carrier.xlsx`

## API Endpoints

### GET /api/pincode-serviceability/:pincode
Check carrier serviceability at a specific pincode
- **Authentication**: Required
- **Parameters**: `pincode` - The pincode to check
- **Response**: List of serviceable carriers for the pincode

### POST /api/pincode-serviceability/process-orders
Process all orders and assign carriers based on pincode serviceability
- **Authentication**: Required
- **Access**: Admin/Superadmin only
- **Response**: Processing results with counts and output file location

### GET /api/pincode-serviceability/processed-orders
Get processed orders with assigned carriers
- **Authentication**: Required
- **Response**: All processed orders with carrier assignments

### GET /api/pincode-serviceability/carrier-priorities
Get carrier priorities from Excel file
- **Authentication**: Required
- **Response**: Map of carrier IDs to priority numbers

## How It Works

### 1. Pincode Serviceability Check
- Calls Shipway API: `https://app.shipway.com/api/pincodeserviceable?pincode={pincode}`
- Returns list of carriers that can service the pincode
- Handles various API response formats

### 2. Priority-Based Assignment
- Reads carrier priorities from `logistic_carrier.xlsx`
- Sorts serviceable carriers by priority (lower number = higher priority)
- Assigns the highest priority carrier to each order

### 3. Order Processing
- Reads orders from `backend/data/raw_shipway_orders.json`
- Extracts pincode from each order using the `s_zipcode` field
- For each order:
  - Checks serviceability at the pincode
  - Assigns highest priority carrier
  - Adds `carrier_id` field to the order
- Saves processed orders to `backend/data/post_shipway_orders.json`

## Data Flow

```
raw_shipway_orders.json → Extract s_zipcode → Check serviceability → 
Sort by priority → Assign carriers → post_shipway_orders.json
```

## Priority System

- **Lower numbers = Higher priority** (e.g., 1 = highest, 5 = lowest)
- Carriers without priority get lowest priority (999)
- If no serviceable carriers, `carrier_id` is set to `null`

## File Structure

- **Input**: `backend/data/raw_shipway_orders.json`
- **Carrier Data**: `backend/data/logistic_carrier.xlsx`
- **Output**: `backend/data/post_shipway_orders.json`

## Example Output

```json
{
  "order_id": "12345",
  "pincode": "560037",
  "customer_name": "John Doe",
  "carrier_id": "5",
  // ... other order fields
}
```

## Setup

1. **Environment Variables**: Ensure your `.env` file has Shipway API configuration:
   ```
   SHIPWAY_API_BASE_URL=https://app.shipway.com/api
   SHIPWAY_BASIC_AUTH_HEADER=Basic your-base64-encoded-credentials
   ```

2. **Carrier Priorities**: Set priority values in `logistic_carrier.xlsx` priority column

3. **Raw Orders**: Ensure `raw_shipway_orders.json` exists with order data

## Testing

Run the test script to verify the functionality:

```bash
cd backend
node test/test-pincode-serviceability.js
```

## Error Handling

The system handles various error scenarios:
- **API Connection Issues**: Network timeouts and connection failures
- **Authentication Errors**: Invalid API credentials
- **Rate Limiting**: API rate limit exceeded
- **Missing Data**: Orders without pincodes or missing carrier priorities
- **File System Errors**: JSON file read/write issues

## Logging

All API activities are logged to `backend/logs/api.log` with timestamps and detailed information for debugging purposes.

## Security

- All endpoints require authentication
- Only admin/superadmin users can process orders
- API credentials are stored securely in environment variables
- Input validation and sanitization are implemented

## Integration

This feature integrates with:
- **Shipway API**: For pincode serviceability checks
- **Carrier Management**: Uses carrier data and priorities
- **Order Management**: Processes existing order data
- **Authentication System**: Uses existing auth middleware 