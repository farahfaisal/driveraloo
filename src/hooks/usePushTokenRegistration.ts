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

  const registerToken = async (attempt = 1): Promise<boolean> => {
    const MAX_ATTEMPTS = 3;
    try {
      const permResult = await PushNotifications.requestPermissions();
      if (permResult.receive !== 'granted') {
        console.warn('[FCM] Push permission not granted');
        return false;
      }

      // Deferred promise so we can `await` addListener() in the async body
      // while still resolving from inside the listeners.
      let resolveResult!: (v: boolean) => void;
      const resultPromise = new Promise<boolean>((resolve) => { resolveResult = resolve; });

      let settled = false;
      let regListener: { remove: () => void } | undefined;
      let errListener: { remove: () => void } | undefined;

      const timeoutId = setTimeout(() => {
        console.warn(`[FCM] Token registration timed out (attempt ${attempt})`);
        finish(false);
      }, 15000);

      const cleanup = () => {
        clearTimeout(timeoutId);
        regListener?.remove();
        errListener?.remove();
      };

      const finish = (result: boolean) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolveResult(result);
      };

      // Attach listeners BEFORE register() — on Android a cached FCM token
      // can fire synchronously, so a listener added after register() misses it.
      regListener = await PushNotifications.addListener('registration', async (token) => {
        if (settled) return;
        hasRegistered.current = true;

        const tokenValue = token.value;
        await storage.set('push_token', tokenValue);

        try {
          const session = await storage.get('driver_session');
          if (!session) { finish(true); return; }

          const userData = JSON.parse(session);
          const driverId = userData?.driver_profile?.id || userData?.driver_id || userData?.id;
          if (!driverId) { finish(true); return; }

          await saveTokenToDb(tokenValue, driverId);
        } catch (err) {
          console.error('[FCM] Error saving token:', err);
        }

        finish(true);
      });

      errListener = await PushNotifications.addListener('registrationError', (err) => {
        console.error(`[FCM] Registration error (attempt ${attempt}):`, err.error);
        finish(false);
      });

      // Now that listeners are in place, kick off registration.
      PushNotifications.register().catch((e) => {
        console.error(`[FCM] register() rejected (attempt ${attempt}):`, e);
        finish(false);
      });

      const success = await resultPromise;

      if (!success && attempt < MAX_ATTEMPTS) {
        const delay = attempt * 3000;
        console.warn(`[FCM] Retrying registration in ${delay}ms (attempt ${attempt + 1}/${MAX_ATTEMPTS})`);
        await new Promise(r => setTimeout(r, delay));
        return registerToken(attempt + 1);
      }

      return success;
    } catch (err) {
      console.error('[FCM] Unexpected error during token registration:', err);
      return false;
    }
  };
}
