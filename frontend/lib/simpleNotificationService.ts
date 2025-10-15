/**
 * Simple Notification Service
 * Uses basic browser notifications without complex push subscription
 * More reliable approach for mobile and desktop
 */

import { apiClient } from './api';

interface NotificationData {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: any;
}

class SimpleNotificationService {
  private isSupported: boolean;
  private isEnabled: boolean = false;
  private permission: NotificationPermission = 'default';

  constructor() {
    this.isSupported = 'Notification' in window;
    this.permission = this.isSupported ? Notification.permission : 'denied';
    this.loadState();
  }

  /**
   * Check if notifications are supported
   */
  get supported(): boolean {
    return this.isSupported;
  }

  /**
   * Check if notifications are enabled
   */
  get enabled(): boolean {
    return this.isEnabled && this.permission === 'granted';
  }

  /**
   * Get current permission status
   */
  get currentPermission(): NotificationPermission {
    return this.permission;
  }

  /**
   * Load saved state from localStorage
   */
  private loadState(): void {
    try {
      const saved = localStorage.getItem('simple_notifications_enabled');
      this.isEnabled = saved === 'true';
    } catch (error) {
      console.error('Error loading notification state:', error);
      this.isEnabled = false;
    }
  }

  /**
   * Save state to localStorage
   */
  private saveState(): void {
    try {
      localStorage.setItem('simple_notifications_enabled', this.isEnabled.toString());
    } catch (error) {
      console.error('Error saving notification state:', error);
    }
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) {
      throw new Error('Notifications are not supported in this browser');
    }

    console.log('🔔 [SIMPLE NOTIFICATIONS] Requesting permission...');
    this.permission = await Notification.requestPermission();
    console.log('🔔 [SIMPLE NOTIFICATIONS] Permission result:', this.permission);

    // Update backend about permission status
    await this.updateBackendStatus();

    return this.permission;
  }

  /**
   * Enable notifications (simple approach)
   */
  async enable(): Promise<boolean> {
    console.log('🔔 [SIMPLE NOTIFICATIONS] Enabling notifications...');

    try {
      // Request permission first
      const permission = await this.requestPermission();
      
      if (permission === 'granted') {
        this.isEnabled = true;
        this.saveState();
        
        // Update backend
        await this.updateBackendStatus();
        
        console.log('✅ [SIMPLE NOTIFICATIONS] Notifications enabled successfully');
        return true;
      } else {
        throw new Error(`Notification permission ${permission}`);
      }
    } catch (error) {
      console.error('❌ [SIMPLE NOTIFICATIONS] Error enabling notifications:', error);
      this.isEnabled = false;
      this.saveState();
      throw error;
    }
  }

  /**
   * Disable notifications
   */
  async disable(): Promise<boolean> {
    console.log('🔔 [SIMPLE NOTIFICATIONS] Disabling notifications...');

    try {
      this.isEnabled = false;
      this.saveState();

      // Update backend
      await this.updateBackendStatus();

      console.log('✅ [SIMPLE NOTIFICATIONS] Notifications disabled successfully');
      return true;
    } catch (error) {
      console.error('❌ [SIMPLE NOTIFICATIONS] Error disabling notifications:', error);
      throw error;
    }
  }

  /**
   * Update backend about notification status (optional - won't break if it fails)
   */
  private async updateBackendStatus(): Promise<void> {
    try {
      console.log('🔔 [SIMPLE NOTIFICATIONS] Updating backend status...');
      
      // Create a simple notification record in backend using existing type
      await apiClient.createNotification({
        type: 'other',
        severity: 'low',
        title: `Notification ${this.isEnabled ? 'Enabled' : 'Disabled'}`,
        message: `Browser notifications have been ${this.isEnabled ? 'enabled' : 'disabled'}`,
        vendor_id: 0, // System notification
        vendor_name: 'System',
        metadata: {
          notification_type: 'simple_browser',
          enabled: this.isEnabled,
          permission: this.permission,
          timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent
        },
        error_details: undefined
      });

      console.log('✅ [SIMPLE NOTIFICATIONS] Backend status updated');
    } catch (error) {
      console.log('⚠️ [SIMPLE NOTIFICATIONS] Backend status update failed (this is optional):', error.message);
      // Don't throw - this is optional and shouldn't break the main notification functionality
    }
  }

  /**
   * Show a notification
   */
  async showNotification(data: NotificationData): Promise<void> {
    if (!this.enabled) {
      console.log('🔔 [SIMPLE NOTIFICATIONS] Notifications not enabled, skipping...');
      return;
    }

    try {
      console.log('🔔 [SIMPLE NOTIFICATIONS] Showing notification:', data.title);

      const options: NotificationOptions = {
        body: data.body,
        icon: data.icon || '/icon-192x192.png',
        tag: data.tag || `notification-${Date.now()}`,
        data: data.data,
        requireInteraction: false,
        silent: false
      };

      const notification = new Notification(data.title, options);

      // Handle notification click
      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto-close after 8 seconds
      setTimeout(() => {
        notification.close();
      }, 8000);

      console.log('✅ [SIMPLE NOTIFICATIONS] Notification shown successfully');
    } catch (error) {
      console.error('❌ [SIMPLE NOTIFICATIONS] Error showing notification:', error);
    }
  }

  /**
   * Show test notification
   */
  async showTestNotification(): Promise<void> {
    console.log('🔔 [SIMPLE NOTIFICATIONS] Showing test notification...');

    const testData: NotificationData = {
      title: 'Test Notification',
      body: 'This is a test notification from Clamio. If you see this, notifications are working correctly!',
      icon: '/icon-192x192.png',
      tag: 'test-notification',
      data: { type: 'test' }
    };

    await this.showNotification(testData);
  }

  /**
   * Check if we can show notifications
   */
  canShowNotifications(): boolean {
    return this.isSupported && this.enabled;
  }

  /**
   * Get status information
   */
  getStatus(): {
    supported: boolean;
    enabled: boolean;
    permission: NotificationPermission;
    canShow: boolean;
  } {
    return {
      supported: this.isSupported,
      enabled: this.isEnabled,
      permission: this.permission,
      canShow: this.canShowNotifications()
    };
  }

  /**
   * Reset all settings
   */
  reset(): void {
    this.isEnabled = false;
    this.permission = this.isSupported ? Notification.permission : 'denied';
    this.saveState();
    console.log('🔔 [SIMPLE NOTIFICATIONS] Settings reset');
  }
}

// Export singleton instance
export const simpleNotificationService = new SimpleNotificationService();