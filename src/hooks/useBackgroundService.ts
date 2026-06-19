import { useEffect, useCallback } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { storage } from '../utils/storage';

interface BackgroundServicePlugin {
  startBackgroundService(): Promise<{ success: boolean }>;
  stopBackgroundService(): Promise<{ success: boolean }>;
  showOrderNotification(options: { title: string; content: string }): Promise<{ success: boolean }>;
  bringAppToForeground(): Promise<{ success: boolean }>;
  schedulePeriodicCheck(): Promise<{ success: boolean }>;
}

// Register the plugin - this will use the native implementation on Android
// and a no-op implementation on iOS (since we handle iOS background differently)
const BackgroundService = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
  ? registerPlugin<BackgroundServicePlugin>('BackgroundService')
  : {
      startBackgroundService: async () => ({ success: true }),
      stopBackgroundService: async () => ({ success: true }),
      showOrderNotification: async () => ({ success: true }),
      bringAppToForeground: async () => ({ success: true }),
      schedulePeriodicCheck: async () => ({ success: true })
    };

export function useBackgroundService() {
  // Function to show order notification
  const showOrderNotification = useCallback(async (title: string, content: string) => {
    try {
      // تشغيل الصوت فوراً قبل أي شيء آخر
      try {
        // إنشاء صوت قوي فوري
        const urgentSound = new Howl({
          src: ['/order.wav', '/notification.wav'],
          volume: 1.0,
          preload: false,
          html5: true
        });
        urgentSound.play();
      } catch (soundError) {
        console.error('فشل في تشغيل الصوت الفوري:', soundError);
      }

      // إضافة اهتزاز قوي للتنبيه
      if (Capacitor.isNativePlatform()) {
        try {
          await Haptics.impact({ style: ImpactStyle.Heavy });
          setTimeout(() => Haptics.impact({ style: ImpactStyle.Heavy }), 500);
          setTimeout(() => Haptics.impact({ style: ImpactStyle.Heavy }), 1000);
        } catch (error) {
}
      }

      if (Capacitor.isNativePlatform()) {
        if (Capacitor.getPlatform() === 'android') {
          // Use Android native background service with overlay
          await BackgroundService.showOrderNotification({ title, content });

          // محاولة إحضار التطبيق للمقدمة مع تأخيرات متعددة
          try {
            await BackgroundService.bringAppToForeground();

            // محاولة ثانية بعد ثانية واحدة
            setTimeout(async () => {
              try {
                await BackgroundService.bringAppToForeground();
              } catch (retryError) {
}
            }, 1000);
          } catch (error) {
}
        } else if (Capacitor.getPlatform() === 'ios') {
          // On iOS, use local notifications directly
          await LocalNotifications.schedule({
            notifications: [
              {
              silent: false, // Make sure sound plays
                title,
                body: content,
                id: Date.now(),
                sound: 'notification.wav',
                attachments: [],
                actionTypeId: 'ORDER',
                extra: {
                  isOrder: true,
                  autoOpen: true
                },
                // إضافة أزرار تفاعلية لفتح التطبيق
                actions: [
                  {
                    id: 'open_app',
                    title: 'فتح التطبيق',
                    requiresAuthentication: false,
                    foreground: true
                  },
                  {
                    id: 'dismiss',
                    title: 'إغلاق',
                    destructive: true
                  }
                ]
              }
            ]
          });
        }
      } else {
        // For web, show browser notification with enhanced features
        if ('Notification' in window && Notification.permission === 'granted') {
          // محاولة إحضار النافذة للمقدمة فوراً
          try {
            window.focus();
            if (window.parent !== window) {
              window.parent.focus();
            }

            // تفعيل النافذة إذا كانت مخفية
            if (document.hidden) {
              document.dispatchEvent(new Event('visibilitychange'));
              window.dispatchEvent(new Event('focus'));
            }
          } catch (focusError) {
            console.error('فشل في إحضار النافذة للمقدمة:', focusError);
          }

          // تحسين الإشعارات للمتصفح
          const showWebNotification = (id: string, delay: number = 0) => {
            setTimeout(() => {
              const notification = new Notification(title, {
                body: content,
                icon: '/notification-icon.svg',
                tag: id,
                renotify: true,
                requireInteraction: true,
                vibrate: [500, 200, 500, 200, 500],
                silent: false,
                badge: '/notification-icon.svg',
                data: {
                  autoOpen: true,
                  url: '/orders',
                  timestamp: Date.now(),
                  forceOpen: true
                }
              });

              notification.onclick = () => {
                // محاولات متعددة لإحضار النافذة للمقدمة
                window.focus();
                if (window.parent !== window) {
                  window.parent.focus();
                }

                // محاولة تفعيل النافذة
                try {
                  if (document.hidden) {
                    document.dispatchEvent(new Event('visibilitychange'));
                    window.dispatchEvent(new Event('focus'));
                  }
                } catch (e) {
                }

                notification.close();
                if (window.location.pathname !== '/orders') {
                  window.location.href = '/orders';
                }
              };

              // إغلاق تلقائي بعد 45 ثانية
              setTimeout(() => notification.close(), 60000);
            }, delay);
          };

          // إظهار إشعار واحد فقط
          showWebNotification('new-order', 0);

          // محاولة فتح نافذة جديدة بعد 3 ثوانٍ
        }

        // تحذير المستخدم من القيود
}
    } catch (error) {
      console.error('Failed to show order notification:', error);
    }
  }, []);

  // Start background service when app loads
  useEffect(() => {
    const setupBackgroundService = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          if (Capacitor.getPlatform() === 'android') {
            // Start Android background service
            await BackgroundService.startBackgroundService();

            // جدولة الفحص الدوري
            await BackgroundService.schedulePeriodicCheck();

            // Register for background sync if available
            if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
              try {
                const registration = await navigator.serviceWorker.ready;
                await registration.sync.register('check-orders');
              } catch (error) {
}
            }
          } else if (Capacitor.getPlatform() === 'ios') {
            // For iOS, we use the built-in background modes
            // Register for app state changes to handle background/foreground transitions
            App.addListener('appStateChange', ({ isActive }) => {
              // When app goes to background, we could trigger some actions
              if (!isActive) {
                storage.set('app_last_background_time', new Date().toISOString()).catch(console.error);

                // جدولة فحص دوري في الخلفية
                setTimeout(() => {
                  if (!document.hasFocus()) {
                    window.dispatchEvent(new CustomEvent('background-order-check'));
                  }
                }, 10000); // فحص بعد 10 ثوانٍ
              } else {
                storage.get('app_last_background_time').then(lastBackgroundTime => {
                  if (lastBackgroundTime) {
                    const timeDiff = Date.now() - new Date(lastBackgroundTime).getTime();
                    if (timeDiff > 60000) {
                      window.dispatchEvent(new CustomEvent('app-foreground-refresh'));
                    }
                  }
                }).catch(console.error);
              }
            });

            // تسجيل للإشعارات المحلية مع إجراءات
            await LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
              if (notification.actionId === 'open_app' || notification.notification.extra?.autoOpen) {
                // فتح التطبيق وتوجيه لصفحة الطلبات
                window.location.href = '/orders';
              }
            });

            // Request notification permissions
            const permResult = await LocalNotifications.requestPermissions();
          }
        } catch (error) {
          console.error('Failed to setup background service:', error);
        }
      } else {
        // For web browsers, register service worker for background functionality
        if ('serviceWorker' in navigator) {
          try {
            await navigator.serviceWorker.register('/sw.js');

            // إضافة مستمع لأحداث الخلفية
            navigator.serviceWorker.addEventListener('message', (event) => {
              if (event.data && event.data.type === 'NEW_ORDER_DETECTED') {
                // تشغيل صوت وإحضار التطبيق للمقدمة
                window.focus();
                if (window.location.pathname !== '/orders') {
                  window.location.href = '/orders';
                }
              }
            });

            // Register for background sync if available
            if ('sync' in window.ServiceWorkerRegistration.prototype) {
              try {
                const registration = await navigator.serviceWorker.ready;
                await registration.sync.register('check-orders');
              } catch (error) {
}
            }

            // Register for periodic background sync if available
            if ('periodicSync' in window.ServiceWorkerRegistration.prototype) {
              try {
                const registration = await navigator.serviceWorker.ready;
                await (registration as any).periodicSync.register('check-orders-periodic', {
                  minInterval: 60000 // 1 minute
                });
              } catch (error) {
}
            }
          } catch (error) {
}
        }

        document.addEventListener('visibilitychange', () => {
          if (document.hidden) {
            storage.set('app_background_time', new Date().toISOString()).catch(console.error);
          } else {
            storage.get('app_background_time').then(backgroundTime => {
              if (backgroundTime) {
                const timeDiff = Date.now() - new Date(backgroundTime).getTime();
                if (timeDiff > 30000) {
                  window.dispatchEvent(new CustomEvent('app-foreground-refresh'));
                }
              }
            }).catch(console.error);
          }
        });

        // Enhanced app opening logic
        // فقط التركيز على النافذة الحالية بدون فتح نوافذ جديدة
        if (document.hidden || !document.hasFocus()) {
          try {
            window.focus();
            if (window.parent !== window) {
              window.parent.focus();
            }
          } catch (error) {
}
        }
      }
    };

    setupBackgroundService();

    // Cleanup function
    return () => {
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
        BackgroundService.stopBackgroundService().catch(err => {
          console.error('Failed to stop background service:', err);
        });
      }

      // Remove app state listener
      App.removeAllListeners();
      LocalNotifications.removeAllListeners();
    };
  }, []);

  // Return functions that can be used by other components
  return {
    showOrderNotification,
    startService: async () => {
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
        return BackgroundService.startBackgroundService();
      }
      return { success: true };
    },
    stopService: async () => {
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
        return BackgroundService.stopBackgroundService();
      }
      return { success: true };
    },
    bringToForeground: async () => {
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
        return BackgroundService.bringAppToForeground();
      }
      // للمتصفح، محاولة إحضار النافذة للمقدمة
      window.focus();
      if (window.parent !== window) {
        window.parent.focus();
      }
      return { success: true };
    }
  };
}