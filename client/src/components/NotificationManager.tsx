import { useState, useEffect } from 'react';
import { useGameState } from '../systems';
import './NotificationManager.css';

export interface Notification {
  id: string;
  message: string;
  type: 'achievement' | 'level-up' | 'info' | 'success' | 'warning';
  duration?: number;
}

let notificationIdCounter = 0;
const notificationListeners: Set<(notification: Notification) => void> = new Set();

/**
 * Show a notification (can be called from anywhere)
 */
export function showNotification(
  message: string,
  type: Notification['type'] = 'info',
  duration: number = 5000
): void {
  const notification: Notification = {
    id: `notification-${notificationIdCounter++}`,
    message,
    type,
    duration,
  };

  // Notify all listeners
  notificationListeners.forEach((listener) => listener(notification));
}

/**
 * Notification Manager Component
 * Renders notifications based on settings
 */
export default function NotificationManager() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const showNotifications = useGameState((state) => state.settings.showNotifications ?? true);

  useEffect(() => {
    const handleNotification = (notification: Notification) => {
      if (!showNotifications) {
        return;
      }

      setNotifications((prev) => [...prev, notification]);

      // Auto-remove after duration
      if (notification.duration && notification.duration > 0) {
        setTimeout(() => {
          setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
        }, notification.duration);
      }
    };

    notificationListeners.add(handleNotification);

    return () => {
      notificationListeners.delete(handleNotification);
    };
  }, [showNotifications]);

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  if (!showNotifications || notifications.length === 0) {
    return null;
  }

  return (
    <div className="notification-container">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`notification notification-${notification.type}`}
          onClick={() => removeNotification(notification.id)}
        >
          <div className="notification-icon">
            {notification.type === 'achievement' && '🏆'}
            {notification.type === 'level-up' && '⬆️'}
            {notification.type === 'success' && '✓'}
            {notification.type === 'warning' && '⚠️'}
            {notification.type === 'info' && 'ℹ️'}
          </div>
          <div className="notification-message">{notification.message}</div>
          <button className="notification-close" onClick={() => removeNotification(notification.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

