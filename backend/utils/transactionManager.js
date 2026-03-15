/**
 * TransactionManager — Stage 6.1
 *
 * Provides a single, reusable wrapper for MySQL transactions.
 * Usage:
 *   const txManager = new TransactionManager(database.pool);
 *   const result = await txManager.runInTransaction(async (conn) => {
 *     await conn.execute('UPDATE ...', [...]);
 *     await conn.execute('INSERT ...', [...]);
 *     return someValue;
 *   });
 *
 * - Automatically commits on success.
 * - Automatically rolls back on any thrown error (and re-throws it).
 * - Always releases the connection back to the pool in the `finally` block.
 */
class TransactionManager {
  /**
   * @param {import('mysql2/promise').Pool} pool — The mysql2 connection pool
   */
  constructor(pool) {
    if (!pool) {
      throw new Error('TransactionManager requires a valid mysql2 pool instance');
    }
    this.pool = pool;
  }

  /**
   * Run a callback inside a database transaction.
   *
   * @template T
   * @param {(conn: import('mysql2/promise').PoolConnection) => Promise<T>} callback
   * @returns {Promise<T>} The value returned by the callback
   */
  async runInTransaction(callback) {
    const conn = await this.pool.getConnection();
    await conn.beginTransaction();
    try {
      const result = await callback(conn);
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

module.exports = TransactionManager;
