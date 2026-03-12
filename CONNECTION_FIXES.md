# Frontend Connection Issues - Fixes Applied

## Issues Identified

1. **"Array buffer allocation failed"** - Webpack running out of memory during compilation
2. **"Request timed out after 3000ms"** - Next.js dev server or service worker timeout
3. **Backend connection failures** - Frontend unable to connect to backend at `http://localhost:5000/api`

## Fixes Applied

### 1. Increased Node.js Memory Limit
- **File**: `frontend/package.json`
- **Change**: Added `NODE_OPTIONS='--max-old-space-size=4096'` to all npm scripts
- **Impact**: Prevents webpack from running out of memory during compilation
- **Action Required**: Restart the frontend dev server

### 2. Improved Error Messages
- **File**: `frontend/lib/api.ts`
- **Change**: Enhanced timeout error messages to indicate backend connection issues
- **Impact**: Better diagnostics when backend is not running

### 3. Added Health Check Endpoint
- **Backend**: `backend/routes/public.js` - Added `/api/public/health` endpoint
- **Frontend**: `frontend/lib/api.ts` - Added `checkBackendHealth()` method
- **Impact**: Can verify backend server status programmatically

## Troubleshooting Steps

### Step 1: Verify Backend Server is Running
```bash
# In backend directory
cd backend
npm start
# or
node server.js
```

Check that you see:
```
✅ Server running on port 5000
✅ MySQL connection established
```

### Step 2: Test Backend Health
Open browser console and run:
```javascript
// Check if backend is reachable
fetch('http://localhost:5000/api/public/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

Expected response:
```json
{
  "success": true,
  "status": "ok",
  "database": "connected",
  "message": "Backend server is running"
}
```

### Step 3: Restart Frontend with New Memory Settings
```bash
# Stop current dev server (Ctrl+C)
# Then restart:
cd frontend
npm run dev
```

The new memory settings will automatically apply.

### Step 4: Clear Browser Cache & Service Worker
1. Open DevTools (F12)
2. Go to **Application** tab
3. Click **Clear storage** → **Clear site data**
4. Or manually unregister service worker:
   - Go to **Application** → **Service Workers**
   - Click **Unregister** if any are registered

### Step 5: Check Network Tab
1. Open DevTools → **Network** tab
2. Try making a request
3. Check if requests to `http://localhost:5000/api/*` are:
   - **Pending** → Backend not running or slow
   - **Failed (net::ERR_CONNECTION_REFUSED)** → Backend not running
   - **Timeout** → Backend too slow or not responding

## Common Issues & Solutions

### Issue: "Cannot connect to backend server"
**Solution**: 
- Ensure backend is running: `cd backend && npm start`
- Check port 5000 is not blocked by firewall
- Verify `NEXT_PUBLIC_API_URL` in `.env` matches backend URL

### Issue: "Array buffer allocation failed"
**Solution**: 
- Restart frontend dev server (new memory settings will apply)
- If still occurs, increase memory further: `NODE_OPTIONS='--max-old-space-size=6144'`

### Issue: "Request timed out after 3000ms"
**Solution**: 
- This is likely from Next.js service worker
- Clear browser cache and service worker (Step 4 above)
- Check backend is responding quickly (Step 2 above)

### Issue: Frontend keeps losing connection
**Possible Causes**:
1. Backend server is crashing → Check backend logs
2. Database connection issues → Check MySQL is running
3. Port conflicts → Check if port 5000 is already in use
4. Firewall blocking → Check Windows Firewall settings

## Verification

After applying fixes, verify:
1. ✅ Backend health check returns success
2. ✅ Frontend compiles without memory errors
3. ✅ API requests complete successfully
4. ✅ No "Request timed out" errors in console

## Additional Notes

- The 60-second timeout in `api.ts` is for API requests, not webpack compilation
- Service worker timeouts are configured in `next.config.mjs` (30 seconds)
- If issues persist, check backend logs for errors or crashes
