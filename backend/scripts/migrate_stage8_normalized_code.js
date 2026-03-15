'use strict';

/**
 * Stage 8 Migration Script
 * 
 * 8.1 — Adds `normalized_product_code` column + index to the `orders` table.
 * 8.3 — Backfills all existing rows using MySQL REGEXP_REPLACE (same logic as
 *        the old JOIN conditions, run once as a migration — NOT on every query).
 *
 * Usage:
 *   node backend/scripts/migrate_stage8_normalized_code.js
 *
 * Safe to re-run: ALTER TABLE is wrapped in a column-existence check, and
 * the UPDATE only touches rows where normalized_product_code IS NULL.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

async function run() {
  const pool = await mysql.createPool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'clamio',
    multipleStatements: false,
  });

  const conn = await pool.getConnection();
  try {
    console.log('🔧 Stage 8 — Normalized Product Code Migration');

    // ── 8.1  Add column (idempotent) ──────────────────────────────────────
    const [cols] = await conn.execute(`
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'orders'
        AND COLUMN_NAME  = 'normalized_product_code'
    `);

    if (cols.length === 0) {
      console.log('  ➕ Adding column normalized_product_code …');
      await conn.execute(`
        ALTER TABLE orders
          ADD COLUMN normalized_product_code VARCHAR(255) DEFAULT NULL
            AFTER product_code
      `);
      console.log('  ✅ Column added');
    } else {
      console.log('  ✅ Column already exists — skipping ALTER');
    }

    // ── 8.1  Add index (idempotent) ───────────────────────────────────────
    const [idxRows] = await conn.execute(`
      SELECT INDEX_NAME
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'orders'
        AND INDEX_NAME   = 'idx_normalized_code'
    `);

    if (idxRows.length === 0) {
      console.log('  ➕ Creating index idx_normalized_code …');
      await conn.execute(`
        CREATE INDEX idx_normalized_code ON orders (normalized_product_code)
      `);
      console.log('  ✅ Index created');
    } else {
      console.log('  ✅ Index already exists — skipping');
    }

    // ── 8.3  Backfill existing rows ───────────────────────────────────────
    console.log('  🔄 Backfilling normalized_product_code for existing rows …');

    const [backfillResult] = await conn.execute(`
      UPDATE orders
      SET normalized_product_code =
        REGEXP_REPLACE(
          TRIM(
            REGEXP_REPLACE(
              REGEXP_REPLACE(
                REGEXP_REPLACE(
                  REGEXP_REPLACE(
                    TRIM(product_code),
                    '[-_](XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|5XL|Small|Medium|Large|Extra Large)$',
                    ''
                  ),
                  '[-_][0-9]+-[0-9]+$', ''
                ),
                '[-_][0-9]+\\.[0-9]+$', ''
              ),
              '[-_][0-9]+$', ''
            )
          ),
          '[-_]{2,}', '-'
        )
      WHERE normalized_product_code IS NULL
        AND product_code IS NOT NULL
    `);

    console.log(`  ✅ Backfilled ${backfillResult.affectedRows} rows`);

    console.log('\n✅ Stage 8 migration complete.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

run();
