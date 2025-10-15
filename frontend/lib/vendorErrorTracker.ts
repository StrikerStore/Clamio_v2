/**
 * Vendor Error Tracker - Frontend
 * Captures all frontend errors and sends them to backend for notification creation
 */

import { apiClient } from './api';

export interface FrontendError {
  type: string;
  code?: string | number;
  message: string;
  stack?: string;
  component?: string;
  action?: string;
  url?: string;
  userAgent?: string;
  timestamp: string;
  metadata?: any;
}

class VendorErrorTracker {
  private isEnabled: boolean = false;
  private vendorInfo: { id: string; name: string; email: string } | null = null;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize error tracking
   */
  private initialize() {
    // Only enable for vendor users
    try {
      const userData = localStorage.getItem('user_data');
      if (userData) {
        const user = JSON.parse(userData);
        if (user.role === 'vendor') {
          this.isEnabled = true;
          this.vendorInfo = {
            id: user.id,
            name: user.name,
            email: user.email
          };
          this.setupGlobalErrorHandlers();
          console.log('🔍 Vendor Error Tracker initialized for:', user.name);
        }
      }
    } catch (error) {
      console.error('Error initializing vendor error tracker:', error);
    }
  }

  /**
   * Setup global error handlers
   */
  private setupGlobalErrorHandlers() {
    // Handle uncaught JavaScript errors
    window.addEventListener('error', (event) => {
      this.trackError({
        type: 'JAVASCRIPT_ERROR',
        code: 'UNCAUGHT_ERROR',
        message: event.message,
        stack: event.error?.stack,
        component: this.getComponentFromStack(event.error?.stack),
        url: event.filename,
        timestamp: new Date().toISOString()
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError({
        type: 'PROMISE_REJECTION',
        code: 'UNHANDLED_REJECTION',
        message: event.reason?.message || 'Unhandled promise rejection',
        stack: event.reason?.stack,
        component: this.getComponentFromStack(event.reason?.stack),
        timestamp: new Date().toISOString(),
        metadata: { reason: event.reason }
      });
    });

    // Handle fetch/API errors
    this.interceptFetchErrors();
  }

  /**
   * Intercept fetch errors
   */
  private interceptFetchErrors() {
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        
        // Check if response is an error
        if (!response.ok) {
          const errorData = await response.clone().text();
          this.trackError({
            type: 'NETWORK_ERROR',
            code: response.status,
            message: `HTTP ${response.status}: ${response.statusText}`,
            url: args[0] as string,
            timestamp: new Date().toISOString(),
            metadata: {
              status: response.status,
              statusText: response.statusText,
              response: errorData
            }
          });
        }
        
        return response;
      } catch (error: any) {
        this.trackError({
          type: 'NETWORK_ERROR',
          code: 'FETCH_ERROR',
          message: error.message || 'Network request failed',
          url: args[0] as string,
          timestamp: new Date().toISOString(),
          metadata: { error: error.message }
        });
        throw error;
      }
    };
  }

  /**
   * Track a frontend error
   */
  async trackError(error: FrontendError) {
    if (!this.isEnabled || !this.vendorInfo) {
      return;
    }

    try {
      // Add vendor info to error
      const enhancedError = {
        ...error,
        userAgent: navigator.userAgent,
        vendorId: this.vendorInfo.id,
        vendorName: this.vendorInfo.name
      };

      console.log('🔍 Tracking frontend error:', enhancedError);

      // Send to backend for notification creation
      await apiClient.createNotification({
        type: this.getNotificationType(error),
        severity: this.getSeverity(error),
        title: this.getTitle(error),
        message: this.getMessage(error),
        vendor_id: parseInt(this.vendorInfo.id),
        vendor_name: this.vendorInfo.name,
        metadata: {
          ...enhancedError,
          source: 'frontend',
          component: error.component,
          action: error.action
        },
        error_details: this.formatErrorDetails(enhancedError)
      });

      console.log('✅ Frontend error tracked successfully');
    } catch (trackingError) {
      console.error('❌ Error tracking frontend error:', trackingError);
      // Don't throw - error tracking should not break the app
    }
  }

  /**
   * Track component-specific error
   */
  trackComponentError(component: string, action: string, error: any, metadata?: any) {
    this.trackError({
      type: 'COMPONENT_ERROR',
      code: error.code || 'COMPONENT_ERROR',
      message: error.message || 'Component error occurred',
      stack: error.stack,
      component,
      action,
      timestamp: new Date().toISOString(),
      metadata
    });
  }

  /**
   * Track API error
   */
  trackApiError(operation: string, error: any, metadata?: any) {
    this.trackError({
      type: 'API_ERROR',
      code: (error.status || error.code || 'API_ERROR').toString(),
      message: error.message || 'API request failed',
      stack: error.stack,
      action: operation,
      timestamp: new Date().toISOString(),
      metadata
    });
  }

  /**
   * Get notification type from error
   */
  private getNotificationType(error: FrontendError): string {
    const typeMap = {
      'JAVASCRIPT_ERROR': 'vendor_operation_error',
      'PROMISE_REJECTION': 'vendor_operation_error',
      'NETWORK_ERROR': 'vendor_connection_error',
      'COMPONENT_ERROR': 'vendor_operation_error',
      'API_ERROR': 'vendor_api_error'
    };

    return typeMap[error.type as keyof typeof typeMap] || 'vendor_operation_error';
  }

  /**
   * Get severity from error
   */
  private getSeverity(error: FrontendError): string {
    if (error.code && typeof error.code === 'number' && error.code >= 500) {
      return 'critical';
    }
    
    if (error.type === 'JAVASCRIPT_ERROR' || error.type === 'PROMISE_REJECTION') {
      return 'high';
    }
    
    if (error.type === 'NETWORK_ERROR') {
      return 'high';
    }
    
    return 'medium';
  }

  /**
   * Get title from error
   */
  private getTitle(error: FrontendError): string {
    const component = error.component ? ` - ${error.component}` : '';
    const action = error.action ? ` (${error.action})` : '';
    return `Frontend Error${component}${action}`;
  }

  /**
   * Get message from error
   */
  private getMessage(error: FrontendError): string {
    return error.message || 'An error occurred in the vendor panel';
  }

  /**
   * Get component name from stack trace
   */
  private getComponentFromStack(stack?: string): string | undefined {
    if (!stack) return undefined;
    
    // Look for component names in stack trace
    const componentMatch = stack.match(/(\w+\.tsx?|\w+\.js)/);
    return componentMatch ? componentMatch[1] : undefined;
  }

  /**
   * Format error details for storage
   */
  private formatErrorDetails(error: FrontendError): string {
    return JSON.stringify({
      type: error.type,
      code: error.code,
      message: error.message,
      stack: error.stack,
      component: error.component,
      action: error.action,
      url: error.url,
      timestamp: error.timestamp,
      metadata: error.metadata
    }, null, 2);
  }

  /**
   * Enable/disable error tracking
   */
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  /**
   * Check if tracking is enabled
   */
  isTrackingEnabled(): boolean {
    return this.isEnabled;
  }
}

// Export singleton instance
export const vendorErrorTracker = new VendorErrorTracker();