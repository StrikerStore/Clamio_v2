# Carrier Management Feature

This feature allows you to fetch and manage logistics carrier information from the Shipway API and store it locally in an Excel file.

## Features

- **Automatic Data Fetching**: Carrier data is automatically fetched from Shipway API when the server starts
- **Excel Storage**: All carrier data is stored in `backend/data/logistic_carrier.xlsx`
- **API Endpoints**: RESTful API endpoints for managing carrier data
- **Authentication**: All endpoints require authentication
- **Admin Controls**: Only admin/superadmin users can fetch new data from Shipway API

## API Endpoints

### GET /api/carriers
Get all carriers from the Excel file
- **Authentication**: Required
- **Response**: List of all carriers with count

### GET /api/carriers/:id
Get a specific carrier by ID or code
- **Authentication**: Required
- **Parameters**: `id` - Carrier ID or carrier code
- **Response**: Single carrier object

### POST /api/carriers/fetch
Fetch fresh carrier data from Shipway API and update Excel file
- **Authentication**: Required
- **Access**: Admin/Superadmin only
- **Response**: Success message with count of carriers fetched

### GET /api/carriers/test-connection
Test connection to Shipway Carrier API
- **Authentication**: Required
- **Response**: Connection status and message

## Data Structure

The carrier data is stored with the following fields:

| Field | Description |
|-------|-------------|
| carrier_id | Unique carrier identifier |
| carrier_name | Name of the carrier (weight information removed) |
| weight in gms | Weight in grams as number without unit (e.g., 10000 for 10kg, 500 for 500g) |
| priority | Priority level (blank by default, can be manually set) |
| status | Carrier status (active/inactive) |

## Setup

1. **Environment Variables**: Ensure your `.env` file has the required Shipway API configuration:
   ```
   SHIPWAY_API_BASE_URL=https://app.shipway.com/api
   SHIPWAY_BASIC_AUTH_HEADER=Basic your-base64-encoded-credentials
   ```

2. **Server Startup**: The carrier data will be automatically fetched when the server starts

3. **Manual Refresh**: Use the `/api/carriers/fetch` endpoint to manually refresh carrier data

## Testing

Run the test script to verify the carrier API functionality:

```bash
cd backend
node test/test-carrier-api.js
```

## Error Handling

The system handles various error scenarios:
- **API Connection Issues**: Network timeouts and connection failures
- **Authentication Errors**: Invalid API credentials
- **Rate Limiting**: API rate limit exceeded
- **Data Format Issues**: Unexpected response formats from Shipway API
- **File System Errors**: Excel file read/write issues

## Logging

All API activities are logged to `backend/logs/api.log` with timestamps and detailed information for debugging purposes.

## Security

- All endpoints require authentication
- Only admin/superadmin users can fetch new data from external APIs
- API credentials are stored securely in environment variables
- Input validation and sanitization are implemented

## Integration

This feature integrates seamlessly with the existing Shipway service infrastructure and follows the same patterns for:
- Error handling
- Logging
- Authentication
- Excel file management
- API response formatting 