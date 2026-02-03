const axios = require('axios');
const database = require('../config/database');

/**
 * Webhook Service for Customer Message Tracking
 * Sends webhook notifications when order statuses are updated
 */
class WebhookService {
    constructor() {
        this.webhookUrl = null;
    }

    /**
     * Send status update webhook for orders whose status changed
     * @param {Array} updatedOrders - Array of {order_id, account_code, new_status, old_status}
     * @returns {Promise<Object>} Webhook send result
     */
    async sendStatusUpdateWebhook(updatedOrders) {
        if (!updatedOrders || updatedOrders.length === 0) {
            console.log('📤 [Webhook] No updated orders to send');
            return { success: true, message: 'No orders to send', sent: 0 };
        }

        try {
            // Get webhook URL from utility table
            this.webhookUrl = await database.getUtilityValue('OrderStatusWebhookUrl');

            if (!this.webhookUrl) {
                console.log('⚠️ [Webhook] OrderStatusWebhookUrl not configured in utility table, skipping webhook');
                return { success: false, message: 'Webhook URL not configured', sent: 0 };
            }

            console.log(`📤 [Webhook] Preparing to send ${updatedOrders.length} orders to ${this.webhookUrl}`);

            // Fetch additional data for all orders in bulk
            const orderIds = updatedOrders.map(o => o.order_id);
            const orderAccountPairs = updatedOrders.map(o => ({
                order_id: o.order_id,
                account_code: o.account_code
            }));

            // Bulk fetch labels data
            const [labelsData] = await database.mysqlConnection.execute(`
        SELECT 
          order_id,
          account_code,
          carrier_id,
          awb,
          current_shipment_status
        FROM labels
        WHERE (order_id, account_code) IN (${orderAccountPairs.map(() => '(?, ?)').join(', ')})
      `, orderAccountPairs.flatMap(p => [p.order_id, p.account_code]));

            // Bulk fetch customer info
            const [customerData] = await database.mysqlConnection.execute(`
        SELECT 
          order_id,
          account_code,
          shipping_phone,
          shipping_firstname,
          shipping_lastname
        FROM customer_info
        WHERE (order_id, account_code) IN (${orderAccountPairs.map(() => '(?, ?)').join(', ')})
      `, orderAccountPairs.flatMap(p => [p.order_id, p.account_code]));

            // Bulk fetch order product counts and quantities
            const [orderStats] = await database.mysqlConnection.execute(`
        SELECT 
          order_id,
          account_code,
          COUNT(DISTINCT product_code) as number_of_product,
          SUM(quantity) as number_of_quantity
        FROM orders
        WHERE (order_id, account_code) IN (${orderAccountPairs.map(() => '(?, ?)').join(', ')})
        GROUP BY order_id, account_code
      `, orderAccountPairs.flatMap(p => [p.order_id, p.account_code]));

            // Bulk fetch latest message status
            const messageStatusMap = await database.getLatestMessageStatusByOrders(orderAccountPairs);

            // Create lookup maps
            const labelsMap = new Map();
            labelsData.forEach(label => {
                const key = `${label.order_id}|${label.account_code}`;
                labelsMap.set(key, label);
            });

            const customerMap = new Map();
            customerData.forEach(customer => {
                const key = `${customer.order_id}|${customer.account_code}`;
                customerMap.set(key, customer);
            });

            const orderStatsMap = new Map();
            orderStats.forEach(stats => {
                const key = `${stats.order_id}|${stats.account_code}`;
                orderStatsMap.set(key, stats);
            });

            // Build webhook payload
            const orders = updatedOrders.map(order => {
                const key = `${order.order_id}|${order.account_code}`;
                const label = labelsMap.get(key);
                const customer = customerMap.get(key);
                const stats = orderStatsMap.get(key);
                const messageStatus = messageStatusMap.get(key) || null;

                return {
                    order_id: order.order_id,
                    account_code: order.account_code,
                    carrier_id: label?.carrier_id || null,
                    awb: label?.awb || null,
                    current_shipment_status: order.new_status,
                    previous_status: order.old_status || null,
                    shipping_phone: customer?.shipping_phone || null,
                    shipping_firstname: customer?.shipping_firstname || null,
                    shipping_lastname: customer?.shipping_lastname || null,
                    number_of_product: stats?.number_of_product || 0,
                    number_of_quantity: stats?.number_of_quantity || 0,
                    latest_message_status: messageStatus
                };
            });

            const payload = {
                timestamp: new Date().toISOString(),
                event: 'status_update',
                orders: orders
            };

            console.log(`📤 [Webhook] Sending payload with ${orders.length} orders...`);

            // Send webhook with timeout
            const response = await axios.post(this.webhookUrl, payload, {
                timeout: 10000, // 10 second timeout
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Claimio-Webhook/1.0'
                }
            });

            console.log(`✅ [Webhook] Successfully sent to ${this.webhookUrl}`);
            console.log(`📊 [Webhook] Response status: ${response.status}`);

            return {
                success: true,
                message: 'Webhook sent successfully',
                sent: orders.length,
                response_status: response.status
            };

        } catch (error) {
            console.error('❌ [Webhook] Failed to send webhook:', error.message);

            // Log error details but don't throw - webhook failures shouldn't break the sync
            if (error.response) {
                console.error(`   Response status: ${error.response.status}`);
                console.error(`   Response data:`, error.response.data);
            } else if (error.request) {
                console.error('   No response received from webhook endpoint');
            }

            return {
                success: false,
                message: `Webhook failed: ${error.message}`,
                sent: 0,
                error: error.message
            };
        }
    }
}

module.exports = new WebhookService();
