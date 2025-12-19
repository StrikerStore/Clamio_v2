// API utility for making backend calls with Basic Authentication

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

// Debug logging for API requests
const DEBUG_API = process.env.NODE_ENV === 'development';

if (DEBUG_API) {
  console.log('🔧 API Configuration:');
  console.log('  API_BASE_URL:', API_BASE_URL);
  console.log('  Environment:', process.env.NODE_ENV);
}

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

  private getCurrentUserInfo(): { role?: string; email?: string } | null {
    try {
      if (typeof window !== 'undefined') {
        const userData = localStorage.getItem('user_data')
        if (userData) {
          return JSON.parse(userData)
        }
      }
    } catch (error) {
      console.error('Error parsing user info:', error)
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
      if (DEBUG_API) {
        console.log(`🚀 API Request: ${config.method || 'GET'} ${API_BASE_URL}${endpoint}`);
        console.log('  Headers:', config.headers);
        if (config.body) console.log('  Body:', config.body);
      }
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`, config)
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      let data: any;
      
      if (!contentType || !contentType.includes('application/json')) {
        // If not JSON, read as text to get the actual error
        const text = await response.text()
        console.error('Non-JSON response received:', {
          status: response.status,
          statusText: response.statusText,
          url: `${API_BASE_URL}${endpoint}`,
          contentType,
          responseText: text.substring(0, 200) // First 200 chars
        })
        
        if (response.status === 404) {
          throw new Error(`API endpoint not found: ${endpoint}. Please ensure the backend server is running and has been restarted to register new endpoints.`)
        } else if (response.status >= 500) {
          throw new Error(`Server error: ${response.status} ${response.statusText}`)
        } else {
          throw new Error(`Invalid response format: Expected JSON, got ${contentType || 'unknown'}. Status: ${response.status}`)
        }
      }
      
      try {
        data = await response.json()
      } catch (jsonError) {
        // If JSON parsing fails, it's not a valid JSON response
        console.error('Failed to parse JSON response:', jsonError)
        throw new Error(`Invalid JSON response from server. Status: ${response.status}. The endpoint may not exist or the server may need to be restarted.`)
      }

      if (!response.ok) {
        // Don't log errors for verification endpoint - it's optional and non-critical
        const isVerificationEndpoint = endpoint.includes('/verify-status');
        
        if (!isVerificationEndpoint) {
          // Log detailed error information for debugging (except for verification)
          console.error('❌ API Error Response:', {
            status: response.status,
            statusText: response.statusText,
            endpoint: endpoint,
            data: data || 'No data received'
          })
        }
        
        // Log detailed validation errors for debugging
        if (data && data.errors && Array.isArray(data.errors)) {
          if (!isVerificationEndpoint) {
            console.error('Validation errors:', data.errors)
          }
          const errorMessages = data.errors.map((err: any) => `${err.field}: ${err.message}`).join(', ')
          throw new Error(`${data.message || 'Validation error'}: ${errorMessages}`)
        }
        
        // For 404 errors, provide more specific message
        if (response.status === 404) {
          if (isVerificationEndpoint) {
            // Silent 404 for verification - endpoint may not exist yet
            throw new Error(`Endpoint not found`)
          }
          throw new Error(`API endpoint not found: ${endpoint}. Please ensure the backend server is running and has been restarted to register new endpoints.`)
        }
        
        // For other errors, use the message from the response, or provide a default
        const errorMessage = data?.message || `HTTP error! status: ${response.status} ${response.statusText}`
        throw new Error(errorMessage)
      }

      if (DEBUG_API) {
        console.log(`✅ API Response: ${response.status} ${response.statusText}`);
        console.log('  Data:', data);
      }
      
      return data
    } catch (error) {
      if (DEBUG_API) {
        console.error('❌ API request failed:', error);
      }
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
    // Check user role from localStorage to determine which endpoint to use
    const authHeader = this.getAuthHeader()
    if (!authHeader) {
      throw new Error('Authentication required')
    }

    // Decode the auth header to check user role
    const userInfo = this.getCurrentUserInfo()
    
    if (userInfo?.role === 'superadmin') {
      // Superadmin can create both vendors and admins via the general /users endpoint
      return this.makeRequest('/users', {
        method: 'POST',
        body: JSON.stringify(userData)
      })
    } else if (userInfo?.role === 'admin') {
      // Admin can only create vendors via the vendor-specific endpoint
      if (userData.role !== 'vendor') {
        throw new Error('Admins can only create vendor accounts')
      }
      return this.makeRequest('/users/vendor', {
        method: 'POST',
        body: JSON.stringify(userData)
      })
    } else {
      throw new Error('Insufficient permissions to create users')
    }
  }

  async updateUser(userId: string, userData: Partial<{
    name: string
    email: string
    phone: string
    status: string
    warehouseId: string
    contactNumber: string
  }>): Promise<ApiResponse> {
    const userInfo = this.getCurrentUserInfo()
    
    if (userInfo?.role === 'superadmin') {
      // Superadmin uses the general route which allows updating any user (vendor or admin)
      return this.makeRequest(`/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(userData)
      })
    } else if (userInfo?.role === 'admin') {
      // Admin can only update vendors via the vendor-specific endpoint
      return this.makeRequest(`/users/vendor/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(userData)
      })
    } else {
      throw new Error('Insufficient permissions to update users')
    }
  }

  async deleteUser(userId: string): Promise<ApiResponse> {
    const userInfo = this.getCurrentUserInfo()
    
    if (userInfo?.role === 'superadmin') {
      // Superadmin uses the general route which allows deleting any user (vendor or admin)
      return this.makeRequest(`/users/${userId}`, {
        method: 'DELETE'
      })
    } else if (userInfo?.role === 'admin') {
      // Admin can only delete vendors via the vendor-specific endpoint
      return this.makeRequest(`/users/vendor/${userId}`, {
        method: 'DELETE'
      })
    } else {
      throw new Error('Insufficient permissions to delete users')
    }
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
  async getOrders(page: number = 1, limit: number = 50, status: string = 'unclaimed', search?: string, dateFrom?: string, dateTo?: string): Promise<ApiResponse> {
    let url = `/orders?page=${page}&limit=${limit}&status=${status}`;
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }
    if (dateFrom) {
      url += `&dateFrom=${encodeURIComponent(dateFrom)}`;
    }
    if (dateTo) {
      url += `&dateTo=${encodeURIComponent(dateTo)}`;
    }
    return this.makeRequest(url);
  }
  async getOrdersLastUpdated(): Promise<ApiResponse> {
    return this.makeRequest('/orders/last-updated')
  }

  async refreshOrders(): Promise<ApiResponse> {
    // For vendor endpoints, use vendorToken instead of authHeader
    const vendorToken = typeof window !== 'undefined' ? localStorage.getItem('vendorToken') : null;
    
    
    const config: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(vendorToken && { 'Authorization': vendorToken }),
      }
    }

    try {
      const response = await fetch(`${API_BASE_URL}/orders/refresh`, config)
      const data = await response.json()


      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`)
      }

      return data
    } catch (error) {
      console.error('Refresh orders API request failed:', error)
      throw error
    }
  }

  // Admin orders API
  async getAdminOrders(): Promise<ApiResponse> {
    return this.makeRequest('/orders/admin/all');
  }

  async refreshAdminOrders(): Promise<ApiResponse> {
    return this.makeRequest('/orders/admin/refresh', {
      method: 'POST',
    });
  }

  async getAdminVendors(): Promise<ApiResponse> {
    // Prefer enriched vendors report for admin auditing table
    return this.makeRequest('/users/vendors-report');
  }

  async assignOrderToVendor(unique_id: string, vendor_warehouse_id: string): Promise<ApiResponse> {
    return this.makeRequest('/orders/admin/assign', {
      method: 'POST',
      body: JSON.stringify({ unique_id, vendor_warehouse_id })
    });
  }

  async bulkAssignOrdersToVendor(unique_ids: string[], vendor_warehouse_id: string): Promise<ApiResponse> {
    return this.makeRequest('/orders/admin/bulk-assign', {
      method: 'POST',
      body: JSON.stringify({ unique_ids, vendor_warehouse_id })
    });
  }

  async bulkUnassignOrders(unique_ids: string[]): Promise<ApiResponse> {
    return this.makeRequest('/orders/admin/bulk-unassign', {
      method: 'POST',
      body: JSON.stringify({ unique_ids })
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
   

    if (!vendorToken) {
      console.log('❌ API CLIENT: No vendor token found');
      throw new Error('No vendor token found. Please login again.')
    }

    console.log('📤 API CLIENT: Making request to /orders/claim');
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

  async verifyOrderStatuses(unique_ids: string[]): Promise<ApiResponse> {
    console.log('🔵 API CLIENT: verifyOrderStatuses called');
    console.log('  - unique_ids:', unique_ids);
    
    const vendorToken = localStorage.getItem('vendorToken')
    
    if (!vendorToken) {
      console.log('❌ API CLIENT: No vendor token found');
      return { success: false, message: 'No vendor token found' };
    }

    console.log('📤 API CLIENT: Making request to /orders/verify-status');
    console.log('  - Method: POST');
    console.log('  - Headers: Content-Type, Authorization');
    console.log('  - Body:', JSON.stringify({ unique_ids }));

    // Now that the backend method exists, errors should be actual errors, not missing methods
    return this.makeRequest('/orders/verify-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': vendorToken
      },
      body: JSON.stringify({ unique_ids }),
    });
  }

  async getGroupedOrders(page: number = 1, limit: number = 50): Promise<ApiResponse> {
    console.log('🔵 API CLIENT: getGroupedOrders called');
    console.log('  - page:', page);
    console.log('  - limit:', limit);
    
    // Use vendor token for grouped orders endpoint
    const vendorToken = localStorage.getItem('vendorToken')
    console.log('🔑 API CLIENT: Token check');
    console.log('  - vendorToken exists:', vendorToken ? 'YES' : 'NO');
    console.log('  - vendorToken value:', JSON.stringify(vendorToken));
    
    if (!vendorToken) {
      console.log('❌ API CLIENT: No vendor token found');
      throw new Error('No vendor token found. Please login again.')
    }

    console.log('📤 API CLIENT: Making request to /orders/grouped');
    console.log('  - Method: GET');
    console.log('  - Headers: Authorization');
    console.log('  - Query params: page=' + page + ', limit=' + limit);

    return this.makeRequest(`/orders/grouped?page=${page}&limit=${limit}`, {
      method: 'GET',
      headers: {
        'Authorization': vendorToken
      },
    })
  }

  async getHandoverOrders(page: number = 1, limit: number = 50): Promise<ApiResponse> {
    console.log('🔵 API CLIENT: getHandoverOrders called');
    console.log('  - page:', page);
    console.log('  - limit:', limit);
    
    // Use vendor token for handover orders endpoint
    const vendorToken = localStorage.getItem('vendorToken')
    console.log('🔑 API CLIENT: Token check');
    console.log('  - vendorToken exists:', vendorToken ? 'YES' : 'NO');
    
    if (!vendorToken) {
      console.log('❌ API CLIENT: No vendor token found');
      throw new Error('No vendor token found. Please login again.')
    }

    console.log('📤 API CLIENT: Making request to /orders/handover');
    console.log('  - Method: GET');
    console.log('  - Headers: Authorization');
    console.log('  - Query params: page=' + page + ', limit=' + limit);

    return this.makeRequest(`/orders/handover?page=${page}&limit=${limit}`, {
      method: 'GET',
      headers: {
        'Authorization': vendorToken
      },
    })
  }

  async getOrderTrackingOrders(page: number = 1, limit: number = 50): Promise<ApiResponse> {
    console.log('🔵 API CLIENT: getOrderTrackingOrders called');
    console.log('  - page:', page);
    console.log('  - limit:', limit);
    
    // Use vendor token for order tracking endpoint
    const vendorToken = localStorage.getItem('vendorToken')
    console.log('🔑 API CLIENT: Token check');
    console.log('  - vendorToken exists:', vendorToken ? 'YES' : 'NO');
    
    if (!vendorToken) {
      console.log('❌ API CLIENT: No vendor token found');
      throw new Error('No vendor token found. Please login again.')
    }

    console.log('📤 API CLIENT: Making request to /orders/order-tracking');
    console.log('  - Method: GET');
    console.log('  - Headers: Authorization');
    console.log('  - Query params: page=' + page + ', limit=' + limit);

    return this.makeRequest(`/orders/order-tracking?page=${page}&limit=${limit}`, {
      method: 'GET',
      headers: {
        'Authorization': vendorToken
      },
    })
  }

  async getDashboardStats(): Promise<ApiResponse> {
    console.log('📊 API CLIENT: getDashboardStats called');
    
    // Use vendor token for dashboard stats endpoint
    const vendorToken = localStorage.getItem('vendorToken')
    console.log('🔑 API CLIENT: Token check');
    console.log('  - vendorToken exists:', vendorToken ? 'YES' : 'NO');
    
    if (!vendorToken) {
      console.log('❌ API CLIENT: No vendor token found');
      throw new Error('No vendor token found. Please login again.')
    }

    console.log('📤 API CLIENT: Making request to /orders/dashboard-stats');
    console.log('  - Method: GET');
    console.log('  - Headers: Authorization');

    return this.makeRequest(`/orders/dashboard-stats`, {
      method: 'GET',
      headers: {
        'Authorization': vendorToken
      },
    })
  }

  async reverseOrder(unique_id: string): Promise<ApiResponse> {
    console.log('🔵 API CLIENT: reverseOrder called');
    console.log('  - unique_id:', unique_id);
    
    // Use vendor token for reverse endpoint
    const vendorToken = localStorage.getItem('vendorToken')
    console.log('🔑 API CLIENT: Token check');
    console.log('  - vendorToken exists:', vendorToken ? 'YES' : 'NO');
    
    if (!vendorToken) {
      console.log('❌ API CLIENT: No vendor token found');
      throw new Error('No vendor token found. Please login again.')
    }

    console.log('📤 API CLIENT: Making request to /orders/reverse');
    console.log('  - Method: POST');
    console.log('  - Headers: Content-Type, Authorization');
    console.log('  - Body:', JSON.stringify({ unique_id }));

    return this.makeRequest('/orders/reverse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': vendorToken
      },
      body: JSON.stringify({ unique_id }),
    })
  }

  async reverseGroupedOrder(order_id: string, unique_ids: string[]): Promise<ApiResponse> {
    console.log('🔵 API CLIENT: reverseGroupedOrder called');
    console.log('  - order_id:', order_id);
    console.log('  - unique_ids:', unique_ids);
    
    // Use vendor token for reverse grouped endpoint
    const vendorToken = localStorage.getItem('vendorToken')
    console.log('🔑 API CLIENT: Token check');
    console.log('  - vendorToken exists:', vendorToken ? 'YES' : 'NO');
    
    if (!vendorToken) {
      console.log('❌ API CLIENT: No vendor token found');
      throw new Error('No vendor token found. Please login again.')
    }

    console.log('📤 API CLIENT: Making request to /orders/reverse-grouped');
    console.log('  - Method: POST');
    console.log('  - Headers: Content-Type, Authorization');
    console.log('  - Body:', JSON.stringify({ order_id, unique_ids }));

    return this.makeRequest('/orders/reverse-grouped', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': vendorToken
      },
      body: JSON.stringify({ order_id, unique_ids }),
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
  async getCarriers(accountCode?: string): Promise<ApiResponse> {
    const url = accountCode 
      ? `/shipway/carriers/local?account_code=${encodeURIComponent(accountCode)}`
      : '/shipway/carriers/local'
    return this.makeRequest(url)
  }

  async syncCarriers(): Promise<ApiResponse> {
    return this.makeRequest('/shipway/carriers/sync', {
      method: 'POST'
    })
  }

  async getCarrierStatus(): Promise<ApiResponse> {
    return this.makeRequest('/shipway/carriers/status')
  }

  async updateCarrier(carrierId: string, updates: { carrier_id?: string; status?: string }): Promise<ApiResponse> {
    return this.makeRequest(`/shipway/carriers/${encodeURIComponent(carrierId)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  async deleteCarrier(carrierId: string): Promise<ApiResponse> {
    return this.makeRequest(`/shipway/carriers/${encodeURIComponent(carrierId)}`, {
      method: 'DELETE',
    })
  }

  async moveCarrier(carrierId: string, direction: 'up' | 'down', accountCode: string): Promise<ApiResponse> {
    return this.makeRequest(`/shipway/carriers/${encodeURIComponent(carrierId)}/move`, {
      method: 'POST',
      body: JSON.stringify({ direction, account_code: accountCode }),
    })
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
      // Note: account_code should be in CSV file itself for multi-store upload

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
    return this.makeRequest('/shipway/carrier-format')
  }

  // Store methods
  async getStoresForFilter(): Promise<ApiResponse> {
    return this.makeRequest('/stores/list-for-filter')
  }

  async getAllStores(): Promise<ApiResponse> {
    return this.makeRequest('/stores')
  }

  async getStoreByCode(accountCode: string): Promise<ApiResponse> {
    return this.makeRequest(`/stores/${accountCode}`)
  }

  async getShippingPartners(): Promise<ApiResponse> {
    return this.makeRequest('/stores/shipping-partners')
  }

  async createStore(storeData: {
    store_name: string
    shipping_partner: string
    username: string
    password: string
    shopify_store_url: string
    shopify_token: string
    status: 'active' | 'inactive'
  }): Promise<ApiResponse> {
    return this.makeRequest('/stores', {
      method: 'POST',
      body: JSON.stringify(storeData)
    })
  }

  async updateStore(accountCode: string, storeData: {
    store_name?: string
    username?: string
    password?: string
    shopify_store_url?: string
    shopify_token?: string
    status?: 'active' | 'inactive'
  }): Promise<ApiResponse> {
    return this.makeRequest(`/stores/${accountCode}`, {
      method: 'PUT',
      body: JSON.stringify(storeData)
    })
  }

  async deleteStore(accountCode: string): Promise<ApiResponse> {
    return this.makeRequest(`/stores/${accountCode}`, {
      method: 'DELETE'
    })
  }

  async toggleStoreStatus(accountCode: string): Promise<ApiResponse> {
    return this.makeRequest(`/stores/${accountCode}/toggle-status`, {
      method: 'PATCH'
    })
  }

  // Warehouse Mapping API methods (Superadmin only)
  async getAllWhMappings(includeInactive: boolean = true): Promise<ApiResponse> {
    return this.makeRequest(`/warehouse-mapping?includeInactive=${includeInactive}`);
  }

  async getWhMappingVendors(): Promise<ApiResponse> {
    return this.makeRequest('/warehouse-mapping/vendors');
  }

  async getWhMappingStores(): Promise<ApiResponse> {
    return this.makeRequest('/warehouse-mapping/stores');
  }

  async validateVendorWhId(vendor_wh_id: string, account_code: string): Promise<ApiResponse> {
    return this.makeRequest('/warehouse-mapping/validate', {
      method: 'POST',
      body: JSON.stringify({ vendor_wh_id, account_code })
    });
  }

  async createWhMapping(mappingData: {
    claimio_wh_id: string;
    vendor_wh_id: string;
    account_code: string;
    return_warehouse_id?: string;
  }): Promise<ApiResponse> {
    return this.makeRequest('/warehouse-mapping', {
      method: 'POST',
      body: JSON.stringify(mappingData)
    });
  }

  async deleteWhMapping(id: number): Promise<ApiResponse> {
    return this.makeRequest(`/warehouse-mapping/${id}`, {
      method: 'DELETE'
    });
  }

  async testShipwayConnection(credentials: {
    username: string
    password: string
  }): Promise<ApiResponse> {
    return this.makeRequest('/stores/test-shipway', {
      method: 'POST',
      body: JSON.stringify(credentials)
    })
  }

  async testShopifyConnection(credentials: {
    shopify_store_url: string
    shopify_token: string
  }): Promise<ApiResponse> {
    return this.makeRequest('/stores/test-shopify', {
      method: 'POST',
      body: JSON.stringify(credentials)
    })
  }

  // Download label methods
  async downloadLabel(orderId: string, format: string = 'thermal'): Promise<ApiResponse> {
    // For vendor endpoints, use vendorToken instead of authHeader
    const vendorToken = typeof window !== 'undefined' ? localStorage.getItem('vendorToken') : null;
    
    console.log('🔍 DOWNLOAD LABEL API CLIENT DEBUG:');
    console.log('  - Order ID being sent:', orderId);
    console.log('  - Order ID type:', typeof orderId);
    console.log('  - Format being sent:', format);
    console.log('  - Vendor token:', vendorToken ? vendorToken.substring(0, 20) + '...' : 'null');
    
    const config: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(vendorToken && { 'Authorization': vendorToken }),
      },
      body: JSON.stringify({ order_id: orderId, format: format })
    }

    console.log('  - Request body:', JSON.stringify({ order_id: orderId, format: format }));

    try {
      const response = await fetch(`${API_BASE_URL}/orders/download-label`, config)
      const data = await response.json()

      console.log('🔍 DOWNLOAD LABEL API RESPONSE DEBUG:');
      console.log('  - Status:', response.status);
      console.log('  - OK:', response.ok);
      console.log('  - Data:', data);

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`)
      }

      return data
    } catch (error) {
      console.error('Download label API request failed:', error)
      throw error
    }
  }

  async bulkDownloadLabels(orderIds: string[], format: string = 'thermal', generateOnly: boolean = false): Promise<Blob | ApiResponse> {
    // For vendor endpoints, use vendorToken instead of authHeader
    const vendorToken = typeof window !== 'undefined' ? localStorage.getItem('vendorToken') : null;
    
    console.log('🔍 BULK DOWNLOAD LABELS API CLIENT DEBUG:');
    console.log('  - Order IDs being sent:', orderIds);
    console.log('  - Order IDs count:', orderIds.length);
    console.log('  - Format being sent:', format);
    console.log('  - Generate only:', generateOnly);
    console.log('  - Vendor token:', vendorToken ? vendorToken.substring(0, 20) + '...' : 'null');
    
    const config: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(vendorToken && { 'Authorization': vendorToken }),
      },
      body: JSON.stringify({ order_ids: orderIds, format: format, generate_only: generateOnly })
    }

    console.log('  - Request body:', JSON.stringify({ order_ids: orderIds, format: format, generate_only: generateOnly }));

    try {
      const response = await fetch(`${API_BASE_URL}/orders/bulk-download-labels`, config)
      
      console.log('🔍 BULK DOWNLOAD LABELS API RESPONSE DEBUG:');
      console.log('  - Status:', response.status);
      console.log('  - OK:', response.ok);
      console.log('  - Content-Type:', response.headers.get('content-type'));

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      // If generate_only is true, return JSON response
      if (generateOnly) {
        const data = await response.json();
        console.log('✅ Bulk labels generated successfully (generate_only=true)');
        console.log('  - Response data:', data);
        return data as ApiResponse;
      }

      // Get the blob from the response
      const blob = await response.blob()
      console.log('✅ Bulk labels PDF downloaded successfully');
      console.log('  - Blob size:', blob.size, 'bytes');
      
      // Check for warning headers and store them in blob object
      const warningsHeader = response.headers.get('X-Download-Warnings');
      const failedOrdersHeader = response.headers.get('X-Failed-Orders');
      
      if (warningsHeader) {
        console.log('⚠️ Some orders failed during bulk download');
        const warnings = atob(warningsHeader);
        const failedOrders = failedOrdersHeader ? JSON.parse(failedOrdersHeader) : [];
        console.log('  - Warnings:', warnings);
        console.log('  - Failed orders:', failedOrders);
        
        // Store warnings in blob object for later access
        (blob as any)._warnings = warnings;
        (blob as any)._failedOrders = failedOrders;
      }
      console.log('  - Blob type:', blob.type);
      
      return blob
    } catch (error) {
      console.error('Bulk download labels API request failed:', error)
      throw error
    }
  }

  async bulkDownloadLabelsMerge(orderIds: string[], format: string = 'thermal'): Promise<Blob> {
    // For vendor endpoints, use vendorToken instead of authHeader
    const vendorToken = typeof window !== 'undefined' ? localStorage.getItem('vendorToken') : null;
    
    console.log('🔍 BULK DOWNLOAD LABELS MERGE API CLIENT DEBUG:');
    console.log('  - Order IDs being sent:', orderIds);
    console.log('  - Order IDs count:', orderIds.length);
    console.log('  - Format being sent:', format);
    console.log('  - Vendor token:', vendorToken ? vendorToken.substring(0, 20) + '...' : 'null');
    
    const config: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(vendorToken && { 'Authorization': vendorToken }),
      },
      body: JSON.stringify({ order_ids: orderIds, format: format })
    }

    console.log('  - Request body:', JSON.stringify({ order_ids: orderIds, format: format }));

    try {
      const response = await fetch(`${API_BASE_URL}/orders/bulk-download-labels-merge`, config)
      
      console.log('🔍 BULK DOWNLOAD LABELS MERGE API RESPONSE DEBUG:');
      console.log('  - Status:', response.status);
      console.log('  - OK:', response.ok);
      console.log('  - Content-Type:', response.headers.get('content-type'));

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      // Get the blob from the response
      const blob = await response.blob()
      console.log('✅ Bulk labels PDF merged and downloaded successfully');
      console.log('  - Blob size:', blob.size, 'bytes');
      console.log('  - Blob type:', blob.type);
      
      return blob
    } catch (error) {
      console.error('Bulk download labels merge API request failed:', error)
      throw error
    }
  }

  async downloadLabelFile(shippingUrl: string): Promise<Blob> {
    console.log('🔍 DOWNLOAD LABEL FILE DEBUG:');
    console.log('  - Shipping URL:', shippingUrl);
    
    // Use backend proxy to avoid CORS issues (same as before migration)
    const vendorToken = typeof window !== 'undefined' ? localStorage.getItem('vendorToken') : null;
    
    console.log('🔍 FRONTEND TOKEN DEBUG:');
    console.log('  - vendorToken exists:', vendorToken ? 'YES' : 'NO');
    console.log('  - vendorToken value:', vendorToken ? vendorToken.substring(0, 20) + '...' : 'null');
    
    const config: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(vendorToken && { 'Authorization': vendorToken }),
      },
      body: JSON.stringify({ pdfUrl: shippingUrl })
    }

    console.log('🔍 REQUEST CONFIG DEBUG:');
    console.log('  - Headers:', config.headers);
    console.log('  - Body:', config.body);

    try {
      console.log('🔄 Fetching label file via backend proxy...');
      const response = await fetch(`${API_BASE_URL}/orders/download-pdf`, config)
      
      console.log('🔍 Label file response:');
      console.log('  - Status:', response.status);
      console.log('  - OK:', response.ok);
      console.log('  - Content-Type:', response.headers.get('content-type'));
      
      if (!response.ok) {
        // Try to get the error message from the response
        try {
          const errorData = await response.json();
          console.log('🔍 Error response data:', errorData);
          throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
        } catch (jsonError) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
      }

      const blob = await response.blob()
      console.log('✅ Label file downloaded successfully via proxy');
      console.log('  - Blob size:', blob.size, 'bytes');
      console.log('  - Blob type:', blob.type);
      
      return blob
    } catch (error) {
      console.error('❌ Download label file failed:', error)
      throw error
    }
  }

  // ==================== NOTIFICATION METHODS ====================

  /**
   * Get all notifications with filters
   */
  async getNotifications(params?: {
    page?: number
    limit?: number
    status?: string
    type?: string
    severity?: string
    vendor_id?: number
    order_id?: string
    start_date?: string
    end_date?: string
    search?: string
  }): Promise<ApiResponse> {
    const queryParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value))
        }
      })
    }
    const queryString = queryParams.toString()
    return this.makeRequest(`/notifications${queryString ? `?${queryString}` : ''}`)
  }

  /**
   * Get notification by ID
   */
  async getNotificationById(id: number): Promise<ApiResponse> {
    return this.makeRequest(`/notifications/${id}`)
  }

  /**
   * Create new notification
   */
  async createNotification(data: {
    type: string
    severity?: string
    title: string
    message: string
    order_id?: string
    vendor_id?: number
    vendor_name?: string
    vendor_warehouse_id?: string
    metadata?: any
    error_details?: string
  }): Promise<ApiResponse> {
    return this.makeRequest('/notifications', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  /**
   * Update notification status
   */
  async updateNotificationStatus(id: number, status: string): Promise<ApiResponse> {
    return this.makeRequest(`/notifications/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    })
  }

  /**
   * Resolve notification
   */
  async resolveNotification(id: number, resolution_notes?: string): Promise<ApiResponse> {
    return this.makeRequest(`/notifications/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolution_notes })
    })
  }

  /**
   * Dismiss notification
   */
  async dismissNotification(id: number, dismiss_reason?: string): Promise<ApiResponse> {
    return this.makeRequest(`/notifications/${id}/dismiss`, {
      method: 'POST',
      body: JSON.stringify({ dismiss_reason })
    })
  }

  /**
   * Bulk resolve notifications
   */
  async bulkResolveNotifications(notification_ids: number[], resolution_notes?: string): Promise<ApiResponse> {
    return this.makeRequest('/notifications/bulk-resolve', {
      method: 'POST',
      body: JSON.stringify({ notification_ids, resolution_notes })
    })
  }

  /**
   * Delete notification
   */
  async deleteNotification(id: number): Promise<ApiResponse> {
    return this.makeRequest(`/notifications/${id}`, {
      method: 'DELETE'
    })
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(): Promise<ApiResponse> {
    return this.makeRequest('/notifications/stats')
  }

  // ==================== PUSH NOTIFICATION METHODS ====================

  /**
   * Get VAPID public key
   */
  async getVapidKey(): Promise<ApiResponse> {
    return this.makeRequest('/public/vapid-key')
  }

  /**
   * Subscribe to push notifications
   */
  async subscribeToPushNotifications(subscription: any): Promise<ApiResponse> {
    return this.makeRequest('/notifications/subscribe', {
      method: 'POST',
      body: JSON.stringify({ subscription })
    })
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribeFromPushNotifications(): Promise<ApiResponse> {
    return this.makeRequest('/notifications/unsubscribe', {
      method: 'POST'
    })
  }

  /**
   * Get push subscription status
   */
  async getPushNotificationStatus(): Promise<ApiResponse> {
    return this.makeRequest('/notifications/push-status')
  }

  /**
   * Update push notification preference
   */
  async updatePushNotificationPreference(enabled: boolean): Promise<ApiResponse> {
    return this.makeRequest('/notifications/push-preference', {
      method: 'PATCH',
      body: JSON.stringify({ enabled })
    })
  }
}

// Export singleton instance
export const apiClient = new ApiClient() 