// API utility for making backend calls with Basic Authentication

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

interface ApiResponse<T = any> {
  success: boolean
  message: string
  data?: T
  errors?: any[]
}

class ApiClient {
  private getAuthHeader(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('authHeader')
    }
    return null
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const authHeader = this.getAuthHeader()
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { 'Authorization': authHeader }),
        ...options.headers,
      },
      ...options,
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, config)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`)
      }

      return data
    } catch (error) {
      console.error('API request failed:', error)
      throw error
    }
  }

  // Authentication methods
  async generateAuthHeader(email: string, password: string): Promise<ApiResponse> {
    return this.makeRequest('/auth/generate-header', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    })
  }

  async logout(): Promise<ApiResponse> {
    return this.makeRequest('/auth/logout', {
      method: 'POST'
    })
  }

  async getProfile(): Promise<ApiResponse> {
    return this.makeRequest('/auth/profile')
  }

  async changePassword(oldPassword: string, newPassword: string, confirmPassword: string): Promise<ApiResponse> {
    return this.makeRequest('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ oldPassword, newPassword, confirmPassword })
    })
  }

  async resetPassword(email: string, oldPassword: string, newPassword: string, confirmPassword: string): Promise<ApiResponse> {
    return this.makeRequest('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, oldPassword, newPassword, confirmPassword })
    })
  }

  async changeUserPassword(userId: string, newPassword: string): Promise<ApiResponse> {
    return this.makeRequest('/auth/change-user-password', {
      method: 'PUT',
      body: JSON.stringify({ userId, newPassword })
    })
  }

  // User management methods (Superadmin only)
  async getUsers(params?: {
    page?: number
    limit?: number
    role?: string
    status?: string
    q?: string
  }): Promise<ApiResponse> {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.role) queryParams.append('role', params.role)
    if (params?.status) queryParams.append('status', params.status)
    if (params?.q) queryParams.append('q', params.q)

    const queryString = queryParams.toString()
    const endpoint = queryString ? `/users?${queryString}` : '/users'
    
    return this.makeRequest(endpoint)
  }

  async createUser(userData: {
    name: string
    email: string
    phone?: string
    password: string
    role: 'admin' | 'vendor'
    status?: string
    warehouseId?: string
    contactNumber?: string
  }): Promise<ApiResponse> {
    return this.makeRequest('/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    })
  }

  async updateUser(userId: string, userData: Partial<{
    name: string
    email: string
    phone: string
    status: string
    warehouseId: string
    contactNumber: string
  }>): Promise<ApiResponse> {
    return this.makeRequest(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    })
  }

  async deleteUser(userId: string): Promise<ApiResponse> {
    return this.makeRequest(`/users/${userId}`, {
      method: 'DELETE'
    })
  }

  async getUserById(userId: string): Promise<ApiResponse> {
    return this.makeRequest(`/users/${userId}`)
  }

  async getUsersByRole(role: string): Promise<ApiResponse> {
    return this.makeRequest(`/users/role/${role}`)
  }

  async getUsersByStatus(status: string): Promise<ApiResponse> {
    return this.makeRequest(`/users/status/${status}`)
  }

  async toggleUserStatus(userId: string): Promise<ApiResponse> {
    return this.makeRequest(`/users/${userId}/toggle-status`, {
      method: 'PATCH'
    })
  }

  async getVendorAddress(): Promise<ApiResponse> {
    return this.makeRequest('/users/vendor/address');
  }

  // Shipway API methods (Superadmin only)
  async getWarehouseById(warehouseId: string): Promise<ApiResponse> {
    return this.makeRequest(`/shipway/warehouse/${warehouseId}`)
  }

  async validateWarehouseId(warehouseId: string): Promise<ApiResponse> {
    return this.makeRequest(`/shipway/validate/${warehouseId}`)
  }

  async validateWarehouseForUser(warehouseId: string): Promise<ApiResponse> {
    return this.makeRequest('/shipway/validate-warehouse', {
      method: 'POST',
      body: JSON.stringify({ warehouseId })
    })
  }

  async testShipwayConnection(): Promise<ApiResponse> {
    return this.makeRequest('/shipway/test-connection')
  }

  async getShipwayStats(): Promise<ApiResponse> {
    return this.makeRequest('/shipway/stats')
  }

  async verifyWarehouse(warehouseId: string): Promise<ApiResponse> {
    return this.makeRequest(`/shipway/verify-warehouse/${warehouseId}`);
  }


  // Orders API for vendor panel
  async getOrders(): Promise<ApiResponse> {
    return this.makeRequest('/orders');
  }
  async getOrdersLastUpdated(): Promise<ApiResponse> {
    return this.makeRequest('/orders/last-updated')
  }

  // Admin orders API
  async getAdminOrders(): Promise<ApiResponse> {
    return this.makeRequest('/orders/admin/all');
  }

  async getAdminVendors(): Promise<ApiResponse> {
    return this.makeRequest('/orders/admin/vendors');
  }

  async assignOrderToVendor(unique_id: string, vendor_warehouse_id: string): Promise<ApiResponse> {
    return this.makeRequest('/orders/admin/assign', {
      method: 'POST',
      body: JSON.stringify({ unique_id, vendor_warehouse_id })
    });
  }

  async unassignOrder(unique_id: string): Promise<ApiResponse> {
    return this.makeRequest('/orders/admin/unassign', {
      method: 'POST',
      body: JSON.stringify({ unique_id })
    });
  }

  async claimOrder(unique_id: string): Promise<ApiResponse> {
    console.log('🔵 API CLIENT: claimOrder called');
    console.log('  - unique_id:', unique_id);
    
    // Use vendor token for claim endpoint
    const vendorToken = localStorage.getItem('vendorToken')
    console.log('🔑 API CLIENT: Token check');
    console.log('  - vendorToken exists:', vendorToken ? 'YES' : 'NO');
    console.log('  - vendorToken value:', vendorToken ? vendorToken.substring(0, 8) + '...' : 'null');
    
    if (!vendorToken) {
      console.log('❌ API CLIENT: No vendor token found');
      throw new Error('No vendor token found. Please login again.')
    }

    console.log('📤 API CLIENT: Making request to /orders/claim');
    console.log('  - Method: POST');
    console.log('  - Headers: Content-Type, Authorization');
    console.log('  - Body:', JSON.stringify({ unique_id }));

    return this.makeRequest('/orders/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': vendorToken
      },
      body: JSON.stringify({ unique_id }),
    })
  }

  async bulkClaimOrders(unique_ids: string[]): Promise<ApiResponse> {
    console.log('🔵 API CLIENT: bulkClaimOrders called');
    console.log('  - unique_ids:', unique_ids);
    
    // Use vendor token for bulk claim endpoint
    const vendorToken = localStorage.getItem('vendorToken')
    console.log('🔑 API CLIENT: Token check');
    console.log('  - vendorToken exists:', vendorToken ? 'YES' : 'NO');
    
    if (!vendorToken) {
      console.log('❌ API CLIENT: No vendor token found');
      throw new Error('No vendor token found. Please login again.')
    }

    console.log('📤 API CLIENT: Making request to /orders/bulk-claim');
    console.log('  - Method: POST');
    console.log('  - Headers: Content-Type, Authorization');
    console.log('  - Body:', JSON.stringify({ unique_ids }));

    return this.makeRequest('/orders/bulk-claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': vendorToken
      },
      body: JSON.stringify({ unique_ids }),
    })
  }

  async getGroupedOrders(): Promise<ApiResponse> {
    console.log('🔵 API CLIENT: getGroupedOrders called');
    
    // Use vendor token for grouped orders endpoint
    const vendorToken = localStorage.getItem('vendorToken')
    console.log('🔑 API CLIENT: Token check');
    console.log('  - vendorToken exists:', vendorToken ? 'YES' : 'NO');
    
    if (!vendorToken) {
      console.log('❌ API CLIENT: No vendor token found');
      throw new Error('No vendor token found. Please login again.')
    }

    console.log('📤 API CLIENT: Making request to /orders/grouped');
    console.log('  - Method: GET');
    console.log('  - Headers: Authorization');

    return this.makeRequest('/orders/grouped', {
      method: 'GET',
      headers: {
        'Authorization': vendorToken
      },
    })
  }
  // Settlement API methods
  
  // Vendor settlement methods
  async getVendorPayments(): Promise<ApiResponse> {
    return this.makeRequest('/settlements/vendor/payments');
  }

  async createSettlementRequest(upiId: string): Promise<ApiResponse> {
    return this.makeRequest('/settlements/vendor/request', {
      method: 'POST',
      body: JSON.stringify({ upiId })
    });
  }

  async getVendorSettlements(): Promise<ApiResponse> {
    return this.makeRequest('/settlements/vendor/history');
  }

  async getVendorTransactions(): Promise<ApiResponse> {
    return this.makeRequest('/settlements/vendor/transactions');
  }

  // Admin settlement methods
  async getAllSettlements(params?: {
    page?: number;
    limit?: number;
    status?: string;
    vendorName?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.vendorName) queryParams.append('vendorName', params.vendorName);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);

    const queryString = queryParams.toString();
    const endpoint = queryString ? `/settlements/admin/all?${queryString}` : '/settlements/admin/all';
    
    return this.makeRequest(endpoint);
  }

  async getSettlementById(settlementId: string): Promise<ApiResponse> {
    return this.makeRequest(`/settlements/admin/${settlementId}`);
  }

  async approveSettlement(settlementId: string, amountPaid: number, transactionId: string, paymentProof?: File): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('amountPaid', amountPaid.toString());
    formData.append('transactionId', transactionId);
    if (paymentProof) {
      formData.append('paymentProof', paymentProof);
    }

    const authHeader = this.getAuthHeader();
    
    const config: RequestInit = {
      method: 'POST',
      headers: {
        ...(authHeader && { 'Authorization': authHeader }),
      },
      body: formData,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/settlements/admin/${settlementId}/approve`, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async rejectSettlement(settlementId: string, rejectionReason: string): Promise<ApiResponse> {
    return this.makeRequest(`/settlements/admin/${settlementId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ rejectionReason })
    });
  }

  async exportSettlementsCSV(): Promise<Blob> {
    const authHeader = this.getAuthHeader();
    
    const config: RequestInit = {
      headers: {
        ...(authHeader && { 'Authorization': authHeader }),
      },
    };

    try {
      const response = await fetch(`${API_BASE_URL}/settlements/admin/export-csv`, config);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.blob();
    } catch (error) {
      console.error('CSV export failed:', error);
      throw error;
    }
  }

  async getPaymentProof(filename: string): Promise<Blob> {
    const authHeader = this.getAuthHeader();
    
    const config: RequestInit = {
      headers: {
        ...(authHeader && { 'Authorization': authHeader }),
      },
    };

    try {
      const response = await fetch(`${API_BASE_URL}/settlements/proof/${filename}`, config);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.blob();
    } catch (error) {
      console.error('Payment proof fetch failed:', error);
      throw error;
    }
  }

  // Carrier management methods
  async getCarriers(): Promise<ApiResponse> {
    return this.makeRequest('/shipway/carriers/local')
  }

  async syncCarriers(): Promise<ApiResponse> {
    return this.makeRequest('/shipway/carriers/sync', {
      method: 'POST'
    })
  }

  async getCarrierStatus(): Promise<ApiResponse> {
    return this.makeRequest('/shipway/carriers/status')
  }

  async downloadCarriersCSV(): Promise<void> {
    try {
      const authHeader = this.getAuthHeader();
      
      const response = await fetch(`${API_BASE_URL}/shipway/carriers/download`, {
        method: 'GET',
        headers: {
          ...(authHeader && { 'Authorization': authHeader }),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Get the filename from the response headers
      const contentDisposition = response.headers.get('content-disposition');
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || 'carriers.csv'
        : 'carriers.csv';

      // Convert response to blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading carriers CSV:', error);
      throw error;
    }
  }

  async uploadCarrierPriorities(file: File): Promise<ApiResponse> {
    try {
      const authHeader = this.getAuthHeader();
      
      const formData = new FormData();
      formData.append('csvFile', file, file.name); // Add filename explicitly

      console.log('🔍 Uploading file:', {
        name: file.name,
        size: file.size,
        type: file.type
      });

      const response = await fetch(`${API_BASE_URL}/shipway/carriers/upload-priority`, {
        method: 'POST',
        headers: {
          ...(authHeader && { 'Authorization': authHeader }),
          // Don't set Content-Type for FormData, let browser set it with boundary
        },
        body: formData,
      });

      console.log('🔍 Response status:', response.status);
      console.log('🔍 Response headers:', response.headers);

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.log('🔍 Response text:', text);
        throw new Error(`Unexpected response format: ${text}`);
      }
      
      console.log('🔍 Response data:', data);
      
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('Error uploading carrier priorities:', error);
      throw error;
    }
  }

  async getCarrierFormat(): Promise<ApiResponse> {
    return this.makeRequest('/shipway/carriers/format')
  }
}

// Export singleton instance
export const apiClient = new ApiClient() 