import type { Alert2 } from '@/shared/types';

/**
 * Push notification support for critical alerts
 */
export class AlertNotificationService {
  private static instance: AlertNotificationService;
  private notificationPermission: NotificationPermission = 'default';

  private constructor() {
    this.checkPermission();
  }

  static getInstance(): AlertNotificationService {
    if (!AlertNotificationService.instance) {
      AlertNotificationService.instance = new AlertNotificationService();
    }
    return AlertNotificationService.instance;
  }

  /**
   * Request notification permission from user
   */
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    if (this.notificationPermission === 'granted') {
      return true;
    }

    try {
      const permission = await Notification.requestPermission();
      this.notificationPermission = permission;
      return permission === 'granted';
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  }

  /**
   * Check current notification permission
   */
  private checkPermission(): void {
    if ('Notification' in window) {
      this.notificationPermission = Notification.permission;
    }
  }

  /**
   * Send notification for critical alert
   */
  sendAlert(alert: Alert2): void {
    // Only send for critical and high severity
    if (alert.severity !== 'critical' && alert.severity !== 'high') {
      return;
    }

    if (this.notificationPermission !== 'granted') {
      return;
    }

    const title = `🚨 ${alert.severity.toUpperCase()}: ${alert.field_name || 'Farm Alert'}`;
    const options: NotificationOptions = {
      body: alert.title,
      icon: '/logo.png',
      badge: '/logo-badge.png',
      tag: `alert-${alert.id}`,
      requireInteraction: alert.severity === 'critical',
      data: {
        alert_id: alert.id,
        field_id: alert.field_id,
        url: `/alerts?id=${alert.id}`,
      },
    };

    // Add recommended action to body if present
    if (alert.recommended_action) {
      options.body = `${alert.title}\n\n→ ${alert.recommended_action}`;
    }

    try {
      const notification = new Notification(title, options);

      // Handle click
      notification.onclick = () => {
        window.focus();
        window.location.href = `/alerts?id=${alert.id}`;
        notification.close();
      };

      // Auto-close non-critical alerts after 10 seconds
      if (alert.severity !== 'critical') {
        setTimeout(() => notification.close(), 10000);
      }
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  /**
   * Close specific notification
   */
  closeAlert(): void {
    // Browser doesn't provide API to close specific notifications
    // This is a placeholder for future enhancement
  }

  /**
   * Check if notifications are enabled
   */
  isEnabled(): boolean {
    return this.notificationPermission === 'granted';
  }

  /**
   * Get current permission status
   */
  getPermission(): NotificationPermission {
    return this.notificationPermission;
  }
}

// Export singleton instance
export const alertNotificationService = AlertNotificationService.getInstance();
