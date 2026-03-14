# Stage 16: Order Lifecycle Audit Trail

> ⏱ **Time: 3-5 days** | 🟠 Priority: High | Dependencies: Stage 6 (Transactions), Stage 9 (Structured Logging)

Every meaningful change to an order — from creation to delivery — is written as an immutable event row. Searching by `order_id` gives a complete, timestamped story of the order across all products, vendors, clones, and financial changes.

---

## What This Solves

- **Disputes:** "I never claimed that order" → look up the lifecycle, see exactly who claimed it at what time
- **Debugging:** Order stuck in wrong status → trace every state transition
- **Finance queries:** "What was the price when it was claimed?" → snapshot captured at claim time
- **Clone traceability:** Original order and all its clones linked in one timeline
- **Ops visibility:** Admins can see the full story without asking vendors

---

## 16.1 Database — `order_lifecycle_events` Table

```sql
CREATE TABLE order_lifecycle_events (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- Order identity
  order_id          VARCHAR(100) NOT NULL,         -- e.g. "ORD-001"
  unique_id         VARCHAR(200) NOT NULL,         -- order + sku row identifier
  account_code      VARCHAR(100) NOT NULL,         -- which store

  -- SKU-level identity
  sku_id            VARCHAR(200),                  -- normalized SKU
  product_code      VARCHAR(200),                  -- raw product code
  product_name      VARCHAR(500),
  size              VARCHAR(50),
  quantity          INT,

  -- Event metadata
  event_type        VARCHAR(80)  NOT NULL,         -- see full list below
  event_at          DATETIME(3)  NOT NULL,         -- millisecond precision
  performed_by      VARCHAR(200),                  -- warehouse_id or system actor
  performed_by_role ENUM('vendor','admin','superadmin','system') NOT NULL,
  session_id        VARCHAR(100),                  -- vendor session or request ID

  -- Financial snapshot (captured AT TIME OF EVENT — immutable)
  product_price     DECIMAL(10,2),
  total_order_value DECIMAL(10,2),                 -- sum of all products in order at this moment
  payment_type      CHAR(1),                       -- C=COD, P=Prepaid

  -- Carrier & label details
  priority_carrier  TEXT,                          -- JSON: top-3 carriers assigned
  carrier_name      VARCHAR(200),
  awb               VARCHAR(200),
  label_url         TEXT,

  -- Manifest & handover
  manifest_id       VARCHAR(200),
  is_handover       TINYINT(1),

  -- Clone details (populated for any clone-related event)
  is_cloned_row     TINYINT(1)   DEFAULT 0,
  original_order_id VARCHAR(100),                 -- if this IS a clone, what is the parent
  cloned_order_id   VARCHAR(100),                 -- if this is the PARENT, what clone was made
  clone_status      VARCHAR(50),                  -- initiated / completed / failed

  -- State transition
  status_before     VARCHAR(80),                  -- status before this event
  status_after      VARCHAR(80),                  -- status after this event

  -- Reversal details
  reversal_reason   VARCHAR(500),                 -- why was it reversed/cancelled
  reversal_type     ENUM('simple','with_label_cancellation', 'admin_override') NULL,

  -- Shipment tracking
  shipment_status   VARCHAR(200),                 -- e.g. "In Transit", "Delivered"
  shipment_updated_at DATETIME,

  -- Raw context (for debugging — stores full request payload snapshot)
  event_context     JSON,                         -- any extra key/value pairs, store specific

  INDEX idx_order_id    (order_id),
  INDEX idx_unique_id   (unique_id),
  INDEX idx_account_code (account_code),
  INDEX idx_performed_by (performed_by),
  INDEX idx_event_at    (event_at),
  INDEX idx_event_type  (event_type),
  INDEX idx_sku_id      (sku_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 16.2 Complete Event Type List

### 📥 Order Arrival
| Event Type | Triggered When |
|---|---|
| `order.created` | New order inserted from Shopify/manual sync |
| `order.synced` | Order re-synced/refreshed from Shopify |
| `order.customer_info_enriched` | Customer name/phone updated during sync |

### 📌 Claim Lifecycle
| Event Type | Triggered When |
|---|---|
| `order.claimed` | Vendor successfully claims a product row |
| `order.claim_failed` | atomicClaimOrder returned false (race lost) |
| `order.bulk_claimed` | Same as claimed but via bulk-claim route |
| `order.unclaimed` | Vendor reverses/unclaims without label |
| `order.unclaim_race_lost` | atomicUnclaimOrder returned false |
| `order.admin_assigned` | Admin force-assigns to a vendor |
| `order.admin_unassigned` | Admin force-unassigns from a vendor |
| `order.admin_bulk_assigned` | Admin bulk-assigns multiple orders |
| `order.admin_bulk_unassigned` | Admin bulk-unassigns multiple orders |
| `order.auto_reversed` | Auto-reversal service unclaimed expired order (24h) |

### 🏷️ Label & Carrier
| Event Type | Triggered When |
|---|---|
| `order.carrier_assigned` | top-3 priority carriers assigned at claim time |
| `order.carrier_priority_swapped` | Admin manually swaps carrier priority |
| `label.generated` | Label URL + AWB created by shipway/shiprocket |
| `label.downloaded` | Vendor downloads the label PDF |
| `label.download_failed` | Label generation API call failed |
| `label.cancelled` | Label cancelled via shipway/shiprocket API |

### 📦 Manifest & Handover
| Event Type | Triggered When |
|---|---|
| `manifest.created` | Order included in a manifest |
| `manifest.downloaded` | Manifest PDF downloaded |
| `handover.marked` | Order marked as handed over to courier |
| `handover.reversed` | Handover marking undone |

### 🔁 Reversal with Cancellation
| Event Type | Triggered When |
|---|---|
| `order.reversed_with_cancellation` | Unclaim after label downloaded — shipment cancelled |
| `shipment.cancel_attempted` | Shipway/Shiprocket cancel API called |
| `shipment.cancel_succeeded` | Cancel API returned success |
| `shipment.cancel_failed` | Cancel API returned error |

### 🧬 Clone Lifecycle
| Event Type | Triggered When |
|---|---|
| `clone.initiated` | Clone process started for an order |
| `clone.awb_assigned` | AWB assigned to the cloned order |
| `clone.label_generated` | Label generated for clone |
| `clone.completed` | Clone fully completed, both rows linked |
| `clone.failed` | Clone process failed at any step |
| `original.updated_for_clone` | Original order row updated when clone was made |

### 🚚 Shipping Status Updates
| Event Type | Triggered When |
|---|---|
| `shipment.status_updated` | Tracking pulled from Shipway/Shiprocket |
| `shipment.delivered` | Status updated to Delivered |
| `shipment.rto_initiated` | Order marked RTO |
| `shipment.rto_processed` | RTO inventory entry created |

### 🛒 Pickup & Shiprocket-specific
| Event Type | Triggered When |
|---|---|
| `pickup.address_changed` | Shiprocket pickup location changed at claim |
| `pickup.scheduled` | Pickup request sent to Shiprocket |

### ⚙️ System Events
| Event Type | Triggered When |
|---|---|
| `order.is_new_reset` | is_in_new_order flag flipped |
| `order.priority_updated` | Priority carrier manually updated |
| `order.mark_ready` | Vendor marks order as ready for pickup |
| `order.bulk_mark_ready` | Same via bulk route |

---

## 16.3 Database Method — `logOrderEvent()`

A single function in `database.js`, called from every instrumented point:

```javascript
await database.logOrderEvent({
  order_id, unique_id, account_code,
  sku_id, product_code, product_name, size, quantity,
  event_type,    // e.g. 'order.claimed'
  performed_by,  // vendor.warehouseId or 'SYSTEM'
  performed_by_role,
  status_before, status_after,
  product_price, total_order_value, payment_type,
  priority_carrier, carrier_name, awb,
  manifest_id, is_handover,
  is_cloned_row, original_order_id, cloned_order_id, clone_status,
  reversal_reason, reversal_type,
  shipment_status,
  event_context: {}  // any extra data
});
```

- Always `INSERT` — never UPDATE/DELETE (immutable log)
- Non-blocking: called with `await` but errors only logged, never bubble up to break the main flow
- Uses millisecond timestamp: `DATETIME(3)` with `NOW(3)`

---

## 16.4 Instrumentation Points (Where to Call It)

| Route / Function | Event(s) Logged |
|---|---|
| `database.js → syncOrders()` | `order.created`, `order.synced` |
| `orders.js → /claim` | `order.claimed` or `order.claim_failed` |
| `orders.js → /bulk-claim` | `order.bulk_claimed` per order |
| `orders.js → /admin/assign` | `order.admin_assigned` |
| `orders.js → /admin/bulk-assign` | `order.admin_bulk_assigned` per order |
| `orders.js → /admin/unassign` | `order.admin_unassigned` |
| `orders.js → /admin/bulk-unassign` | `order.admin_bulk_unassigned` per order |
| `orders.js → /reverse` | `order.unclaimed` or `order.reversed_with_cancellation` + `shipment.cancel_*` |
| `orders.js → /reverse-grouped` | Same as above, per unique_id |
| `orders.js → /download-label` | `label.generated` + `label.downloaded` or `label.download_failed` |
| `orders.js → /bulk-download-labels` | Same, per order |
| `orders.js → /mark-ready` | `order.mark_ready` |
| `orders.js → /bulk-mark-ready` | `order.bulk_mark_ready` |
| `orders.js → /shiprocket/start-pickup` | `pickup.scheduled` |
| `database.js → atomicClaimOrder()` | (called from route — logged at route level) |
| `database.js → swapCarrierPriority()` | `order.carrier_priority_swapped` |
| `shipwayService.js → generateLabel()` | `label.generated` / `label.download_failed` |
| `shipwayService.js → cancelShipment()` | `shipment.cancel_attempted` + result |
| `shiprocketService.js → changePickupAddress()` | `pickup.address_changed` |
| `cloneService.js` (all steps) | `clone.initiated` → `clone.awb_assigned` → `clone.completed` or `clone.failed` |
| `autoReversalService.js` | `order.auto_reversed` per order |
| `shipwayService.js → updateShipmentStatus()` | `shipment.status_updated` / `shipment.delivered` / `shipment.rto_*` |

---

## 16.5 Query API

### `GET /api/orders/:order_id/lifecycle`
Returns full timeline for an order_id — includes all product rows (unique_ids), all clones, all events sorted by `event_at ASC`.

**Response shape:**
```json
{
  "order_id": "ORD-001",
  "account_code": "STORE_A",
  "timeline": [
    {
      "event_at":          "2025-03-01T10:00:00.123Z",
      "event_type":        "order.created",
      "unique_id":         "ORD-001_SHIRT-RED_M",
      "sku_id":            "SHIRT-RED",
      "product_name":      "Red Shirt",
      "size":              "M",
      "quantity":          2,
      "performed_by":      "SYSTEM",
      "performed_by_role": "system",
      "status_before":     null,
      "status_after":      "unclaimed",
      "product_price":     499.00,
      "payment_type":      "P",
      "event_context":     {}
    },
    {
      "event_at":          "2025-03-01T11:30:00.450Z",
      "event_type":        "order.claimed",
      "unique_id":         "ORD-001_SHIRT-RED_M",
      "performed_by":      "WH_MUMBAI_01",
      "performed_by_role": "vendor",
      "status_before":     "unclaimed",
      "status_after":      "claimed",
      "priority_carrier":  "[\"BlueDart\",\"Delhivery\",\"Ekart\"]",
      "product_price":     499.00,
      "total_order_value": 998.00
    },
    {
      "event_at":   "2025-03-01T12:00:00.000Z",
      "event_type": "label.generated",
      "awb":        "BD123456789",
      "carrier_name": "BlueDart",
      "label_url":  "https://..."
    },
    {
      "event_at":       "2025-03-01T12:05:00.000Z",
      "event_type":     "clone.initiated",
      "is_cloned_row":  0,
      "cloned_order_id": "ORD-001_2"
    },
    {
      "event_at":          "2025-03-01T12:06:00.000Z",
      "event_type":        "clone.completed",
      "original_order_id": "ORD-001",
      "cloned_order_id":   "ORD-001_2",
      "clone_status":      "completed"
    }
  ],
  "clones": ["ORD-001_2"],
  "summary": {
    "total_events":      12,
    "current_status":    "label_downloaded",
    "first_claimed_by":  "WH_MUMBAI_01",
    "first_claimed_at":  "2025-03-01T11:30:00Z",
    "label_downloaded_at": "2025-03-01T12:01:00Z",
    "times_reversed":    0,
    "has_clone":         true,
    "clone_ids":         ["ORD-001_2"]
  }
}
```

### `GET /api/orders/:order_id/lifecycle?event_type=order.claimed`
Filter by event type.

### `GET /api/orders/lifecycle/vendor/:warehouse_id?from=&to=`
All events performed by a specific vendor in a date range — useful for vendor audit.

### `GET /api/orders/lifecycle/export?order_id=&format=csv`
Export full lifecycle as CSV for ops/finance teams.

---

## 16.6 Additional Suggested Fields (Enhanced Granularity)

| Field | Why Useful |
|---|---|
| `request_ip` | Detect suspicious claims from unexpected IPs |
| `user_agent` | Mobile vs desktop, detect bots |
| `session_duration_ms` | How long vendor spent before claiming |
| `api_latency_ms` | How long the DB/API call took (ops monitoring) |
| `label_generation_source` | `shipway` / `shiprocket` / `cached` |
| `cancellation_api_response` | Raw response from cancel API for disputes |
| `clone_attempt_number` | Was this the 1st or 3rd retry? |
| `auto_reversal_reason` | `expired_24h` / `store_deactivated` |
| `wh_mapping_id` | Which warehouse mapping was used at claim time |
| `pickup_location` | Shiprocket pickup location at claim time |

---

## 16.7 Dependencies

| Depends On | Why |
|---|---|
| **Stage 6** (Transaction Manager) | `logOrderEvent()` should fire inside the same transaction as the business write where possible, so log and state change are atomic |
| **Stage 9** (Structured Logging) | Event context structure aligns with structured log format |
| **Stage 12** (Split database.js) | `logOrderEvent` will live in `OrderLifecycleRepository` |

---

## Verification Plan

### Automated Tests
- **Unit:** `logOrderEvent()` inserts correctly, handles errors without bubbling
- **Integration:** Claim an order → query lifecycle → assert `order.claimed` event exists with correct `status_before = unclaimed`, `status_after = claimed`, `performed_by = warehouse_id`
- **Integration:** Reverse flow → assert `order.unclaimed` event follows `order.claimed` in timeline
- **Integration:** Clone flow → assert `clone.initiated` + `clone.completed` appear, `original_order_id` and `cloned_order_id` cross-referenced

### Manual Verification
1. Create/sync an order → call `GET /api/orders/:id/lifecycle` → confirm `order.created` / `order.synced` events
2. Claim it as a vendor → call lifecycle → see `order.claimed` with vendor warehouseId, price snapshot, carriers
3. Download label → see `label.generated` + `label.downloaded` with AWB
4. Reverse it → see `order.unclaimed` or `order.reversed_with_cancellation`
5. Make a clone → see full clone event chain in same lifecycle response
6. Export as CSV → verify all columns present and correctly populated

---

## Summary Table Row (to add)

| Stage | Description | Time | Priority | Depends On |
|---|---|---|---|---|
| **16** | Order lifecycle audit trail | 3-5 days | 🟠 High | Stage 6, 9, 12 |
