'use strict';

/**
 * Normalize a product code by stripping size and numeric suffixes.
 *
 * This mirrors the REGEXP_REPLACE chain previously used in all SQL JOINs:
 *   REGEXP_REPLACE(TRIM(REGEXP_REPLACE(product_code, '[-_](XS|S|M|...)$', '')), '[-_]{2,}', '-')
 *
 * Running this once on INSERT and storing the result in the
 * `normalized_product_code` column lets every JOIN use a simple indexed
 * equality check instead of recomputing the regex millions of times.
 *
 * @param {string|null|undefined} code - Raw product_code from the order
 * @returns {string|null}              - Normalized code, or null if input is empty
 */
function normalizeProductCode(code) {
  if (!code) return null;

  let normalized = String(code).trim();

  // 1. Strip size suffixes: -XS, -S, -M, -L, -XL, -XXL, -XXXL, -2XL, -3XL, -4XL, -5XL
  //    Also handles word sizes: -Small, -Medium, -Large, -Extra Large
  normalized = normalized.replace(
    /[-_](XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|5XL|Small|Medium|Large|Extra\s+Large)$/i,
    ''
  );

  // 2. Strip numeric range suffixes: -123-456
  normalized = normalized.replace(/[-_]\d+-\d+$/, '');

  // 3. Strip decimal suffixes: -123.456
  normalized = normalized.replace(/[-_]\d+\.\d+$/, '');

  // 4. Strip plain numeric suffixes: -123
  normalized = normalized.replace(/[-_]\d+$/, '');

  // 5. Collapse double separators that may result from stripping
  normalized = normalized.replace(/[-_]{2,}/g, '-').trim();

  return normalized || null;
}

module.exports = { normalizeProductCode };
