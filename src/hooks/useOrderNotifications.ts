import { useEffect, useRef, useCallback } from 'react';
import { Delivery } from '../services/delivery';
import { useBackgroundService } from './useBackgroundService';
import { useNotifications } from './useNotifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { storage } from '../utils/storage';
import { speakNewOrder } from '../utils/textToSpeech';
import { supabase } from '../services/auth';

/**
 * Hook متقدم لإدارة إشعارات الطلبات الجديدة
 * - يدعم Push Notifications (يعمل حتى لو التطبيق مغلق)
 * - يمنع إرسال إشعارات متكررة لنفس الطلب
 * - يحفظ سجل الإشعارات في localStorage
 * - يتكامل مع Supabase Edge Functions لإرسال FCM
 */
export function useOrderNotifications(deliveries: Delivery[]) {
  const { showOrderNotification } = useBackgroundService();
  const { playSound } = useNotifications();

  // تخزين معرفات الطلبات التي تم إرسال إشعار لها
  const notifiedOrdersRef = useRef<Set<string>>(new Set());

  // علم للتحقق من التحميل الأول
  const isInitialLoadRef = useRef<boolean>(true);

  // حالة Push Token
  const pushTokenRef = useRef<string | null>(null);

  // نظام تكرار الصوت للطلبات المعلقة
  const soundRepeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const storedNotified = await storage.get('notified_orders');
        if (storedNotified) {
          const parsed = JSON.parse(storedNotified);
          notifiedOrdersRef.current = new Set(parsed);
        }

        const storedToken = await storage.get('push_token');
        if (storedToken) {
          pushTokenRef.current = storedToken;
        }
      } catch (error) {
        console.error('❌ خطأ في تحميل البيانات:', error);
      }
    };
    loadData();
  }, []);

  // تهيئة Web Push للـ PWA (المتصفح)
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const initWebPush = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          return;
        }

        const registration = await navigator.serviceWorker.ready;
        const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        if (!VAPID_PUBLIC_KEY) {
          return;
        }

        // Convert VAPID public key from base64url to Uint8Array
        const padded = VAPID_PUBLIC_KEY.replace(/-/g, '+').replace(/_/g, '/');
        const raw = atob(padded);
        const applicationServerKey = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) applicationServerKey[i] = raw.charCodeAt(i);

        const existing = await registration.pushManager.getSubscription();
        const subscription = existing || await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });

        // حفظ الاشتراك في قاعدة البيانات
        const session = await storage.get('driver_session');
        if (session) {
          const user = JSON.parse(session);
          const driverId = user?.driver_profile?.id || user?.driver_id || user?.id;
          if (driverId) {
            const keys = subscription.toJSON().keys as { p256dh: string; auth: string };
            const { error } = await supabase.from('web_push_subscriptions').upsert({
              driver_id: driverId,
              endpoint: subscription.endpoint,
              p256dh: keys.p256dh,
              auth: keys.auth,
              is_active: true,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'driver_id,endpoint' });
            if (error) {
              console.error('❌ خطأ في حفظ Web Push subscription:', error);
            }
          }
        }
      } catch (err) {
        console.error('❌ خطأ في تهيئة Web Push:', err);
      }
    };

    initWebPush();
  }, []);

  // تهيئة Firebase Push Notifications (يعمل على Native فقط)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const initPush = async () => {
      try {
        // طلب الأذونات
        const permStatus = await PushNotifications.requestPermissions();

        if (permStatus.receive !== 'granted') {
          return;
        }

        // تسجيل الجهاز
        await PushNotifications.register();

        // الاستماع لتسجيل Token
        PushNotifications.addListener('registration', async token => {
          pushTokenRef.current = token.value;
          storage.set('push_token', token.value).catch(console.error);

          // حفظ token في قاعدة البيانات لإرسال إشعارات خارجية
          try {
            const session = await storage.get('driver_session');
            if (session) {
              const user = JSON.parse(session);
              // driver_profile.id is the real drivers table ID (used when login via custom_users)
              // user.id may be the custom_user ID in that flow, so prefer driver_profile.id
              const driverId = user?.driver_profile?.id || user?.driver_id || user?.id;
              if (driverId) {
                const { error: upsertError } = await supabase.from('driver_fcm_tokens').upsert({
                  driver_id: driverId,
                  fcm_token: token.value,
                  platform: Capacitor.getPlatform(),
                  is_active: true,
                  updated_at: new Date().toISOString(),
                }, { onConflict: 'driver_id,fcm_token' });
                if (upsertError) {
                  console.error('❌ خطأ في حفظ FCM token:', upsertError);
                }
              }
            }
          } catch (err) {
            console.error('❌ خطأ في حفظ FCM token:', err);
          }
        });

        // الاستماع لأخطاء التسجيل
        PushNotifications.addListener('registrationError', err => {
          console.error('❌ خطأ في تسجيل Push Notifications:', err.error);
        });

        // الاستماع للإشعارات الواردة (التطبيق مفتوح)
        PushNotifications.addListener('pushNotificationReceived', notification => {
        });

        // الاستماع للنقر على الإشعارات
        PushNotifications.addListener('pushNotificationActionPerformed', action => {
        });

      } catch (error) {
        console.error('❌ خطأ في تهيئة Push Notifications:', error);
      }
    };

    initPush();

    // Cleanup
    return () => {
      PushNotifications.removeAllListeners();
    };
  }, []);

  useEffect(() => {
    const handleDeliveries = async () => {
      if (!deliveries || deliveries.length === 0) {
        return;
      }

      const pendingOrders = deliveries.filter(d => d.status === 'pending');

      if (isInitialLoadRef.current) {
        if (pendingOrders.length > 0) {
          try {
            const title = '🔔 لديك طلبات معلقة!';
            const body = pendingOrders.length === 1
              ? `يوجد طلب واحد في انتظارك`
              : `يوجد ${pendingOrders.length} طلبات في انتظارك`;

            await showOrderNotification(title, body);
            await playSound(true);
          } catch (error) {
            console.error('❌ خطأ في إرسال إشعار الطلبات المعلقة:', error);
          }
        }

        pendingOrders.forEach(order => {
          notifiedOrdersRef.current.add(order.id);
        });
        isInitialLoadRef.current = false;

        try {
          await storage.set('notified_orders', JSON.stringify([...notifiedOrdersRef.current]));
        } catch (error) {
          console.error('❌ خطأ في حفظ الإشعارات:', error);
        }

        return;
      }

    // إيجاد الطلبات الجديدة التي لم يتم إرسال إشعار لها
    const newOrders = pendingOrders.filter(order =>
      !notifiedOrdersRef.current.has(order.id)
    );

    if (newOrders.length > 0) {

      // إرسال إشعار لكل طلب جديد
      newOrders.forEach(async (order, index) => {
        setTimeout(async () => {
          try {
            const orderNumber = order.order_id;
            const title = '🔔 طلب جديد!';
            const body = `طلب من ${order.customer_name || 'عميل'} - ${order.order_type || 'توصيل'}`;

            // 1. إشعار محلي (Local Notification)
            await showOrderNotification(title, body);

            // 2. تشغيل الصوت
            await playSound(true);

            // 3. تشغيل الصوت الناطق
            try {
              await speakNewOrder(orderNumber);
            } catch (ttsError) {
            }

            // 4. إرسال Push Notification عبر Supabase (للأجهزة)
            if (Capacitor.isNativePlatform() && pushTokenRef.current) {
              try {
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                  },
                  body: JSON.stringify({
                    token: pushTokenRef.current,
                    title,
                    body,
                    data: {
                      orderId: order.id,
                      orderType: order.order_type,
                      customerId: order.customer_id,
                    },
                  }),
                });
              } catch (pushError) {
                console.error('❌ خطأ في إرسال Push Notification:', pushError);
              }
            }

            // 5. تسجيل الطلب في السجل
            notifiedOrdersRef.current.add(order.id);
            storage.set('notified_orders', JSON.stringify([...notifiedOrdersRef.current])).catch(console.error);
          } catch (error) {
            console.error(`❌ فشل إرسال إشعار للطلب ${order.id}:`, error);
          }
        }, index * 1000);
      });
    }

    // تنظيف الطلبات التي لم تعد معلقة من القائمة
    const currentPendingIds = new Set(pendingOrders.map(o => o.id));
    const idsToRemove: string[] = [];

    notifiedOrdersRef.current.forEach(id => {
      if (!currentPendingIds.has(id)) {
        idsToRemove.push(id);
      }
    });

    // إزالة المعرفات القديمة
    idsToRemove.forEach(id => {
      notifiedOrdersRef.current.delete(id);
    });

    // حفظ التحديثات في localStorage
    if (idsToRemove.length > 0) {
      try {
        await storage.set('notified_orders', JSON.stringify([...notifiedOrdersRef.current]));
      } catch (error) {
        console.error('❌ خطأ في حفظ التحديثات:', error);
      }
    }
    };

    handleDeliveries();

    // تكرار الصوت كل 30 ثانية إذا كانت هناك طلبات معلقة
    const pendingOrders = deliveries?.filter(d => d.status === 'pending') || [];

    if (pendingOrders.length > 0 && !isInitialLoadRef.current) {

      // إيقاف التكرار السابق إن وجد
      if (soundRepeatIntervalRef.current) {
        clearInterval(soundRepeatIntervalRef.current);
      }

      // بدء التكرار
      soundRepeatIntervalRef.current = setInterval(async () => {
        try {
          await playSound(true);
          await showOrderNotification(
            '⏰ تذكير: لديك طلبات معلقة!',
            `يوجد ${pendingOrders.length} ${pendingOrders.length === 1 ? 'طلب' : 'طلبات'} في انتظارك`
          );
        } catch (error) {
          console.error('❌ خطأ في تكرار الصوت:', error);
        }
      }, 30000); // كل 30 ثانية
    } else {
      // إيقاف التكرار إذا لم تعد هناك طلبات معلقة
      if (soundRepeatIntervalRef.current) {
        clearInterval(soundRepeatIntervalRef.current);
        soundRepeatIntervalRef.current = null;
      }
    }

    // Cleanup عند إلغاء التحميل
    return () => {
      if (soundRepeatIntervalRef.current) {
        clearInterval(soundRepeatIntervalRef.current);
        soundRepeatIntervalRef.current = null;
      }
    };
  }, [deliveries, showOrderNotification, playSound]);

  const resetNotifications = useCallback(async () => {
    notifiedOrdersRef.current.clear();
    pushTokenRef.current = null;
    isInitialLoadRef.current = true;

    // إيقاف تكرار الصوت
    if (soundRepeatIntervalRef.current) {
      clearInterval(soundRepeatIntervalRef.current);
      soundRepeatIntervalRef.current = null;
    }

    try {
      // تعطيل token في قاعدة البيانات عند تسجيل الخروج
      if (pushTokenRef.current) {
        await supabase
          .from('driver_fcm_tokens')
          .update({ is_active: false })
          .eq('fcm_token', pushTokenRef.current);
      }
      await storage.remove('notified_orders');
      await storage.remove('push_token');
    } catch (error) {
      console.error('❌ خطأ في إعادة التعيين:', error);
    }
  }, []);

  return {
    resetNotifications,
    notifiedCount: notifiedOrdersRef.current.size,
    hasPushToken: !!pushTokenRef.current,
    pushToken: pushTokenRef.current,
  };
}
