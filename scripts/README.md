# API Response Fetcher

This script fetches responses from your GET APIs and saves them as JSON files in the `backend/data/` folder for development purposes.

## Setup

1. **Get Authentication Tokens**:
   - Open your app in the browser
   - Login as a vendor/admin user
   - Open browser Developer Tools (F12)
   - Go to Application tab → Local Storage
   - Copy the values for:
     - `authHeader` (for general API calls)
     - `vendorToken` (for vendor-specific API calls)

2. **Configure the script**:
   
   **Option A: Environment Variables**
   ```bash
   export AUTH_HEADER="Basic your-actual-auth-header-here"
   export VENDOR_TOKEN="your-actual-vendor-token-here"
   export API_BASE_URL="http://localhost:5000/api"  # optional
   ```

   **Option B: Edit the script directly**
   - Open `fetch-api-responses.js`
   - Replace the placeholder tokens with your actual tokens

## Usage

```bash
# Make sure your backend server is running
npm run dev  # or however you start your backend

# Run the script
cd scripts
node fetch-api-responses.js
```

## Output

The script will create JSON files in the `backend/data/` folder:

- `orders-response.json` - All orders data
- `grouped-orders-response.json` - Grouped orders for vendor dashboard
- `vendor-payments-response.json` - Vendor payment information
- `vendor-settlements-response.json` - Settlement history
- `vendor-transactions-response.json` - Transaction history
- `vendor-address-response.json` - Vendor address details
- `user-profile-response.json` - User profile data
- `users-list-response.json` - Users list (admin endpoint)
- `admin-settlements-response.json` - Admin settlements view

## API Endpoints Covered

- `GET /orders` - Orders data
- `GET /orders/grouped` - Grouped orders
- `GET /orders/last-updated` - Last update timestamp
- `GET /settlements/vendor/payments` - Vendor payments
- `GET /settlements/vendor/history` - Settlement history
- `GET /settlements/vendor/transactions` - Transaction history
- `GET /users/vendor/address` - Vendor address
- `GET /auth/profile` - User profile
- `GET /users` - Users list
- `GET /settlements/admin/all` - Admin settlements

## Notes

- The script handles both HTTP and HTTPS endpoints
- Failed requests will be saved with error information
- All responses are prettified with 2-space indentation
- Make sure your backend server is running before executing the script 