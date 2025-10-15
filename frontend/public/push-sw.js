/**
 * Custom Service Worker for Push Notifications
 * This extends the existing service worker with push notification handling
 */

// Import the existing service worker functionality
importScripts('./sw.js');

// Add push notification event listener
self.addEventListener('push', (event) => {
  console.log('📱 Push notification received:', event);

  if (!event.data) {
    console.log('No push data received');
    return;
  }

  try {
    const data = event.data.json();
    const notificationData = data.data;

    const options = {
      body: data.body,
      icon: data.icon || '/icon-192x192.png',
      badge: data.badge || '/icon-72x72.png',
      tag: `notification-${notificationData.notificationId}`,
      data: notificationData,
      requireInteraction: data.requireInteraction || false,
      vibrate: data.vibrate || [200],
      actions: data.actions || [
        {
          action: 'view',
          title: 'View Details',
          icon: '/icon-72x72.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/icon-72x72.png'
        }
      ],
      silent: false,
      timestamp: Date.now()
    };

    // Show notification
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );

  } catch (error) {
    console.error('Error handling push notification:', error);
    
    // Fallback notification
    event.waitUntil(
      self.registration.showNotification('New Notification', {
        body: 'You have a new notification from Clamio',
        icon: '/icon-192x192.png',
        badge: '/icon-72x72.png',
        tag: 'fallback-notification'
      })
    );
  }
});

// Handle notification click events
self.addEventListener('notificationclick', (event) => {
  console.log('📱 Notification clicked:', event);

  event.notification.close();

  const notificationData = event.notification.data;
  const action = event.action;

  if (action === 'dismiss') {
    // Just close the notification
    return;
  }

  // Default action or 'view' action
  const url = notificationData?.url || '/admin/orders';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Check if app is already open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Focus existing window and navigate to notification
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            data: notificationData,
            url: url
          });
          return client.focus();
        }
      }
      
      // Open new window if app is not open
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Handle notification close events
self.addEventListener('notificationclose', (event) => {
  console.log('📱 Notification closed:', event);
  
  // Optional: Track notification dismissal
  const notificationData = event.notification.data;
  if (notificationData) {
    // Could send analytics data here
    console.log('Notification dismissed:', notificationData.notificationId);
  }
});

// Handle background sync (for offline scenarios)
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync:', event);
  
  if (event.tag === 'notification-sync') {
    event.waitUntil(
      // Handle any offline notification sync logic here
      Promise.resolve()
    );
  }
});

// Handle push subscription changes
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('📱 Push subscription changed:', event);
  
  event.waitUntil(
    // Re-subscribe to push notifications
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: event.oldSubscription.options.applicationServerKey
    }).then(newSubscription => {
      // Send new subscription to server
      return fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subscription: {
            endpoint: newSubscription.endpoint,
            keys: {
              p256dh: arrayBufferToBase64(newSubscription.getKey('p256dh')),
              auth: arrayBufferToBase64(newSubscription.getKey('auth'))
            }
          }
        })
      });
    })
  );
});

// Utility function to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  console.log('📱 Service worker message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
    // Handle notification click message from main thread
    console.log('Notification click handled:', event.data);
  }
});

console.log('📱 Push notification service worker loaded');
