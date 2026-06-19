import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/auth';
import { storage } from '../utils/storage';

export async function saveTokenToDb(tokenValue: string, driverId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('driver_fcm_tokens')
      .upsert({
        driver_id: driverId,
        fcm_token: tokenValue,
        platform: Capacitor.getPlatform(),
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'driver_id' });

    if (error) {
      console.error('[FCM] DB upsert error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[FCM] saveTokenToDb exception:', err);
    return false;
  }
}

export function usePushTokenRegistration() {
  const { isAuthenticated } = useAuth();
  const hasRegistered = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !Capacitor.isNativePlatform()) return;
    if (hasRegistered.current) return;

    registerToken();
  }, [isAuthenticated]);

  const registerToken = async () => {
    try {
      const permResult = await PushNotifications.requestPermissions();
      if (permResult.receive !== 'granted') {
        return;
      }

      await PushNotifications.register();

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          resolve();
        }, 15000);

        PushNotifications.addListener('registration', async (token) => {
          clearTimeout(timeout);
          hasRegistered.current = true;

          const tokenValue = token.value;
          await storage.set('push_token', tokenValue);

          try {
            const session = await storage.get('driver_session');
            if (!session) { resolve(); return; }

            const userData = JSON.parse(session);
            const driverId = userData?.driver_profile?.id || userData?.driver_id || userData?.id;
            if (!driverId) { resolve(); return; }

            await saveTokenToDb(tokenValue, driverId);
          } catch (err) {
            console.error('[FCM] Error saving token:', err);
          }

          resolve();
        });

        PushNotifications.addListener('registrationError', (err) => {
          clearTimeout(timeout);
          console.error('[FCM] Registration error:', err.error);
          resolve();
        });
      });
    } catch (err) {
      console.error('[FCM] Unexpected error during token registration:', err);
    }
  };
}
