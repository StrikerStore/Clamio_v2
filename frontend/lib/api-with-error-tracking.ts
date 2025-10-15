/**
 * API Client with Automatic Error Tracking
 * Wraps the main API client to automatically track all errors
 */

import { apiClient } from './api';
import { vendorErrorTracker } from './vendorErrorTracker';

class ApiClientWithErrorTracking {
  /**
   * Wrap any API call with error tracking
   */
  private async wrapApiCall<T>(
    apiCall: () => Promise<T>,
    operation: string,
    context?: any
  ): Promise<T> {
    try {
      const result = await apiCall();
      return result;
    } catch (error: any) {
      // Track the API error
      vendorErrorTracker.trackApiError(operation, error, context);
      
      // Re-throw the error so the calling code can handle it
      throw error;
    }
  }

  // Orders API with error tracking
  async getOrders(params?: any) {
    return this.wrapApiCall(
      () => apiClient.getOrders(params),
      'fetch_orders',
      { params }
    );
  }

  async claimOrder(orderId: string) {
    return this.wrapApiCall(
      () => apiClient.claimOrder(orderId),
      'claim_order',
      { orderId }
    );
  }

  async bulkClaimOrders(orderIds: string[]) {
    return this.wrapApiCall(
      () => apiClient.bulkClaimOrders(orderIds),
      'bulk_claim_orders',
      { orderIds }
    );
  }

  async reverseOrder(orderId: string, reason: string) {
    return this.wrapApiCall(
      () => apiClient.reverseOrder(orderId, reason),
      'reverse_order',
      { orderId, reason }
    );
  }

  async bulkReverseOrders(orderIds: string[], reason: string) {
    return this.wrapApiCall(
      () => apiClient.bulkReverseOrders(orderIds, reason),
      'bulk_reverse_orders',
      { orderIds, reason }
    );
  }

  async downloadLabel(orderId: string, format: string) {
    return this.wrapApiCall(
      () => apiClient.downloadLabel(orderId, format),
      'download_label',
      { orderId, format }
    );
  }

  async bulkDownloadLabels(orderIds: string[], format: string) {
    return this.wrapApiCall(
      () => apiClient.bulkDownloadLabels(orderIds, format),
      'bulk_download_labels',
      { orderIds, format }
    );
  }

  async markOrderReady(orderId: string) {
    return this.wrapApiCall(
      () => apiClient.markOrderReady(orderId),
      'mark_ready',
      { orderId }
    );
  }

  async bulkMarkOrdersReady(orderIds: string[]) {
    return this.wrapApiCall(
      () => apiClient.bulkMarkOrdersReady(orderIds),
      'bulk_mark_ready',
      { orderIds }
    );
  }

  // User/Auth API with error tracking
  async login(email: string, password: string) {
    return this.wrapApiCall(
      () => apiClient.login(email, password),
      'login',
      { email }
    );
  }

  async refreshToken() {
    return this.wrapApiCall(
      () => apiClient.refreshToken(),
      'token_refresh'
    );
  }

  // Vendor API with error tracking
  async getVendorAddress() {
    return this.wrapApiCall(
      () => apiClient.getVendorAddress(),
      'fetch_address'
    );
  }

  async updateVendorAddress(addressData: any) {
    return this.wrapApiCall(
      () => apiClient.updateVendorAddress(addressData),
      'update_address',
      { addressData }
    );
  }

  // Settlements API with error tracking
  async getVendorPayments() {
    return this.wrapApiCall(
      () => apiClient.getVendorPayments(),
      'fetch_payments'
    );
  }

  async getVendorSettlements() {
    return this.wrapApiCall(
      () => apiClient.getVendorSettlements(),
      'fetch_settlements'
    );
  }

  async getVendorTransactions() {
    return this.wrapApiCall(
      () => apiClient.getVendorTransactions(),
      'fetch_transactions'
    );
  }

  async createSettlementRequest(upiId: string) {
    return this.wrapApiCall(
      () => apiClient.createSettlementRequest(upiId),
      'create_settlement_request',
      { upiId }
    );
  }

  // Generic method for any other API calls
  async callApi<T>(operation: string, apiCall: () => Promise<T>, context?: any): Promise<T> {
    return this.wrapApiCall(apiCall, operation, context);
  }

  // Expose the original API client for cases where we don't want error tracking
  get original() {
    return apiClient;
  }
}

// Export singleton instance
export const apiClientWithErrorTracking = new ApiClientWithErrorTracking();
