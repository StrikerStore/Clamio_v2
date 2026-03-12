# Label Download Flow - Complete End-to-End Process

## Overview Flowchart

```
┌─────────────────────────────────────────────────────────────────────┐
│                    POST /api/orders/download-label                  │
│                   Input: order_id, format, token                    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  Validate Request    │
                    │  - order_id exists?  │
                    │  - token exists?     │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  Authenticate Vendor │
                    │  - Get vendor by token│
                    │  - Check active_session│
                    └──────────┬───────────┘
                               │
                    ┌──────────┴──────────┐
                    │   Valid Vendor?     │
                    └──────────┬──────────┘
                    NO          │ YES
                    │           │
                    ▼           ▼
            [Return 401 Error]  │
                               │
                               ▼
        ┌──────────────────────────────────────┐
        │  STEP 1: Fetch Products              │
        │  getOrdersByOrderId(order_id)        │
        │  Returns: orderProducts[]            │
        │  Query: WHERE o.order_id = ?         │
        └──────────────┬───────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────┐
        │  STEP 2: Filter Claimed Products     │
        │  claimedProducts = orderProducts     │
        │    .filter(p =>                     │
        │      p.claimed_by === vendor.whId && │
        │      p.is_handover !== 1            │
        │    )                                 │
        └──────────────┬───────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────┐
        │  STEP 3: Check if Label Exists       │
        │  Find product with:                  │
        │  - claimed_by === vendor.whId        │
        │  - status === 'claimed'              │
        │  - label_downloaded === 1            │
        └──────────────┬───────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │   Label Already Downloaded? │
        └──────────────┬──────────────┘
        YES            │ NO
        │              │
        ▼              │
┌───────────────┐     │
│ Check labels  │     │
│ table cache   │     │
└───────┬───────┘     │
        │              │
        ▼              │
┌───────────────┐     │
│ Return cached │     │
│ label URL     │     │
└───────────────┘     │
                      │
                      ▼
        ┌──────────────────────────────────────┐
        │  STEP 4: Determine Condition         │
        │                                      │
        │  Condition Check:                    │
        │  if (orderProducts.length ===        │
        │      claimedProducts.length)         │
        └──────────────┬───────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │   CONDITION 1 (TRUE)?       │
        │   All products claimed      │
        └──────────────┬──────────────┘
        YES            │ NO
        │              │
        │              ▼
        │      ┌───────────────┐
        │      │claimedProducts│
        │      │.length > 0?   │
        │      └───────┬───────┘
        │      NO      │ YES
        │      │       │
        │      ▼       ▼
        │  [Return Error:  │
        │   No products    │
        │   claimed]       │
        │                  │
        │                  ▼
        │      ┌─────────────────────┐
        │      │   CONDITION 2       │
        │      │   Some products     │
        │      │   claimed (Clone)   │
        │      └─────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│              CONDITION 1: DIRECT DOWNLOAD PATH                │
│              (All products claimed by vendor)                 │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
                    ┌──────────────────────────┐
                    │  generateLabelForOrder() │
                    │  - order_id (original)   │
                    │  - claimedProducts       │
                    │  - vendor                │
                    │  - format                │
                    └──────────┬───────────────┘
                               │
                               ▼
                    ┌──────────────────────────┐
                    │  Try Priority Carriers   │
                    │  Loop through carriers   │
                    │  until success           │
                    └──────────┬───────────────┘
                               │
                    ┌──────────┴──────────┐
                    │   Label Generated?  │
                    └──────────┬──────────┘
                    NO          │ YES
                    │           │
                    ▼           │
            [Return Error]      │
                               │
                               ▼
                    ┌──────────────────────────┐
                    │  Store Label in Cache    │
                    │  - labels table          │
                    │  - Update order:         │
                    │    label_downloaded = 1  │
                    └──────────┬───────────────┘
                               │
                               ▼
                    ┌──────────────────────────┐
                    │  Return Label Response   │
                    │  - shipping_url          │
                    │  - awb                   │
                    │  - original_order_id     │
                    └──────────────────────────┘


┌───────────────────────────────────────────────────────────────┐
│              CONDITION 2: CLONE PATH                          │
│              (Some products claimed by vendor)                │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
                    ┌──────────────────────────┐
                    │  handleOrderCloning()    │
                    │  Input:                  │
                    │  - originalOrderId       │
                    │  - claimedProducts       │
                    │  - allOrderProducts      │
                    │  - vendor                │
                    └──────────┬───────────────┘
                               │
                               ▼
                    ┌──────────────────────────┐
                    │  STEP 0: Prepare Data    │
                    │  - Generate clone ID     │
                    │  - Get customer info     │
                    │  - Build originalOrder   │
                    │  - Calculate remaining   │
                    │    products              │
                    └──────────┬───────────────┘
                               │
                               ▼
                    ┌──────────────────────────┐
                    │  STEP 1: Create Clone    │
                    │  - Call Shipway API      │
                    │  - Create ORDER_1_1      │
                    │  - NO label generation   │
                    └──────────┬───────────────┘
                               │
                               ▼
                    ┌──────────────────────────┐
                    │  STEP 2: Verify Clone    │
                    │  - Fetch from Shipway    │
                    │  - Confirm exists        │
                    └──────────┬───────────────┘
                               │
                               ▼
                    ┌──────────────────────────┐
                    │  STEP 3: Update Original │
                    │  - Calculate remaining   │
                    │    products              │
                    │  - If remaining > 0:     │
                    │    Update original order │
                    │    in Shipway            │
                    │  - If remaining = 0:     │
                    │    Skip (order empty)    │
                    └──────────┬───────────────┘
                               │
                               ▼
                    ┌──────────────────────────┐
                    │  STEP 4: Verify Update   │
                    │  - Fetch original order  │
                    │    from Shipway          │
                    │  - Confirm updated       │
                    └──────────┬───────────────┘
                               │
                               ▼
                    ┌──────────────────────────┐
                    │  STEP 5: Update DB       │
                    │  For each claimed product│
                    │  - order_id → cloneOrderId│
                    │  - clone_status = 'cloned'│
                    │  - cloned_order_id =     │
                    │    originalOrderId       │
                    │  - label_downloaded = 0  │
                    │  - Copy customer_info    │
                    └──────────┬───────────────┘
                               │
                               ▼
                    ┌──────────────────────────┐
                    │  STEP 6: Generate Label  │
                    │  - generateLabelForOrder │
                    │  - Use cloneOrderId      │
                    │  - Use updated products  │
                    │  - Try priority carriers │
                    └──────────┬───────────────┘
                               │
                               ▼
                    ┌──────────────────────────┐
                    │  STEP 7: Mark Downloaded │
                    │  - Store in labels table │
                    │  - Update:               │
                    │    label_downloaded = 1  │
                    └──────────┬───────────────┘
                               │
                               ▼
                    ┌──────────────────────────┐
                    │  Return Clone Response   │
                    │  - shipping_url          │
                    │  - awb                   │
                    │  - original_order_id     │
                    │  - clone_order_id        │
                    └──────────────────────────┘
```

## Critical Decision Points

### Condition Check (Line 2801)
```javascript
if (orderProducts.length === claimedProducts.length) {
  // CONDITION 1: Direct download
} else if (claimedProducts.length > 0) {
  // CONDITION 2: Clone required
} else {
  // Error: No products claimed
}
```

**This is where the bug occurs!**

### Claimed Products Filter (Line 2735-2738)
```javascript
const claimedProducts = orderProducts.filter(order => 
  order.claimed_by === vendor.warehouseId && 
  (order.is_handover !== 1 && order.is_handover !== '1')
);
```

**Note:** This filter does NOT check `status === 'claimed'`

### Remaining Products Calculation (Line 3830-3832)
```javascript
remainingProducts: allOrderProducts.filter(order => 
  !(order.claimed_by === vendor.warehouseId && order.status === 'claimed')
)
```

**Note:** This DOES check `status === 'claimed'` (inconsistency!)

## Potential Issues Identified

### 🐛 BUG #1: Filter Inconsistency
- **Location**: Lines 2735-2738 vs 3830-3832
- **Problem**: 
  - `claimedProducts` filter doesn't check `status === 'claimed'`
  - `remainingProducts` filter DOES check `status === 'claimed'`
  - This can cause `orderProducts.length !== claimedProducts.length` even when all products are claimed
  - **Example**: Product with `claimed_by = vendorId` but `status = 'unclaimed'` would be:
    - Included in `orderProducts.length` (counts toward total)
    - Excluded from `claimedProducts` (filtered out)
    - Included in `remainingProducts` (doesn't match vendor + status)
    - Result: Triggers Condition 2 (Clone) instead of Condition 1 (Direct)

### 🐛 BUG #2: Query Limitation After Cloning
- **Location**: Line 3213 (`getOrdersByOrderId`)
- **Problem**: 
  - Query uses `WHERE o.order_id = ?`
  - After cloning (Step 5), products have `order_id = cloneOrderId`
  - Querying original `order_id` won't find cloned products
  - Could cause incorrect condition evaluation on retry

### 🐛 BUG #3: Missing Clone Existence Check
- **Location**: Line 2847 (before calling `handleOrderCloning`)
- **Problem**: 
  - No check if products already have `clone_status = 'cloned'`
  - No check if `cloned_order_id` exists
  - Could create duplicate clones unnecessarily

### 🐛 BUG #4: Original Order Update Logic
- **Location**: Line 3830-3832 (`remainingProducts` calculation)
- **Problem**: 
  - Uses `allOrderProducts` which comes from `getOrdersByOrderId(originalOrderId)`
  - If products were already cloned in previous attempt, they won't be in `allOrderProducts`
  - `remainingProducts` calculation could be incorrect
  - Step 3 might update original order incorrectly in Shipway

## Root Cause Analysis for Your Specific Case

**Scenario**: Order has 1 product, product is claimed by vendor, but clone is created.

**Why this happens**:

1. `getOrdersByOrderId(order_id)` returns products where `o.order_id = order_id`
2. Filter creates `claimedProducts` using:
   ```javascript
   order.claimed_by === vendor.warehouseId && 
   order.is_handover !== 1
   ```
3. **CRITICAL**: Filter does NOT check `status === 'claimed'`
4. If the product has `status !== 'claimed'` (e.g., `status = 'unclaimed'` or null):
   - Product is in `orderProducts` (counts as 1)
   - Product is filtered OUT of `claimedProducts` (if status check was implicit, or other filter issue)
   - OR: Product passes filter but `claimedProducts.length` calculation is wrong
5. Condition check: `orderProducts.length (1) === claimedProducts.length (0 or different)` → FALSE
6. Goes to Condition 2 (Clone) instead of Condition 1 (Direct)

**Fix**: Add `status === 'claimed'` check to the `claimedProducts` filter at line 2735-2738.

## Troubleshooting Guide

When investigating clone issues, check these log values (around lines 2740-2798):

1. **`Total products in order:`** (orderProducts.length)
2. **`Products claimed by vendor:`** (claimedProducts.length)
3. **Product details** for each product:
   - `claimed_by` value
   - `status` value
   - `is_handover` value
   - Whether it matches the filter

**Expected Behavior**:
- If order has 1 product, claimed by vendor, not handed over:
  - `orderProducts.length = 1`
  - `claimedProducts.length = 1`
  - Condition 1 should trigger (Direct download)

**If clone is created instead**:
- Check if `orderProducts.length !== claimedProducts.length`
- Check why product doesn't pass the filter:
  - Is `claimed_by` different from `vendor.warehouseId`?
  - Is `is_handover = 1`?
  - Is `status` missing or incorrect?
  - Are there duplicate products in `orderProducts`?

