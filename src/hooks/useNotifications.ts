import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Howl } from 'howler';
import { useCustomSound } from './useCustomSound';
import { playGeneratedSound } from '../utils/soundGenerator';
import { storage } from '../utils/storage';

export type VolumeLevel = 'low' | 'medium' | 'high' | 'max';

interface NotificationOptions {
  body?: string;
  icon?: string;
  tag?: string;
  renotify?: boolean;
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
  actions?: Array<{
    action: string;
    title: string;
  }>;
}

export function useNotifications() {
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [permissionStatus, setPermissionStatus] = useState<'default' | 'granted' | 'denied'>('default');
  const [volumeLevel, setVolumeLevel] = useState<VolumeLevel>('high');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { customSoundSettings, playCustomSound } = useCustomSound();

  useEffect(() => {
    const loadVolume = async () => {
      const savedVolume = await storage.get('notification_volume_level') as VolumeLevel;
      if (savedVolume && ['low', 'medium', 'high', 'max'].includes(savedVolume)) {
        setVolumeLevel(savedVolume);
      }
    };
    loadVolume();
  }, []);

  const updateVolumeLevel = useCallback(async (level: VolumeLevel) => {
    setVolumeLevel(level);
    await storage.set('notification_volume_level', level);
  }, []);

  // Get volume multiplier based on level
  const getVolumeMultiplier = useCallback((level: VolumeLevel): number => {
    switch (level) {
      case 'low': return 0.3;
      case 'medium': return 0.6;
      case 'high': return 0.9;
      case 'max': return 1.2; // Amplified beyond normal
      default: return 0.9;
    }
  }, []);

  // Create sound instances with volume control
  const createSound = useCallback((isOrderSound = false) => {
    const volume = getVolumeMultiplier(volumeLevel);
    const adjustedVolume = isOrderSound ? Math.min(volume * 1.2, 1.0) : volume; // Order sounds 20% louder

    return new Howl({
      src: [
        isOrderSound ? '/order.wav' : '/notification.wav',
        '/notification.wav', // Fallback
      ],
      volume: adjustedVolume,
      preload: true,
      onloaderror: (id, error) => {
}
    });
  }, [volumeLevel, getVolumeMultiplier]);

  // Check notification permission
  const checkPermission = useCallback(async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await LocalNotifications.checkPermissions();
        const granted = result.display === 'granted';
        setHasPermission(granted);
        setPermissionStatus(result.display);
        return granted;
      } else {
        if ('Notification' in window) {
          const permission = Notification.permission;
          setPermissionStatus(permission);
          setHasPermission(permission === 'granted');
          return permission === 'granted';
        }
        return false;
      }
    } catch (error) {
      console.error('Error checking notification permission:', error);
      return false;
    }
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await LocalNotifications.requestPermissions();
        const granted = result.display === 'granted';
        setHasPermission(granted);
        setPermissionStatus(result.display);
        
        if (granted) {
} else {
}
        
        return granted;
      } else {
        if ('Notification' in window) {
          // For web browsers, also request persistent notification permission
          if ('serviceWorker' in navigator) {
            try {
              // Register a simple service worker for persistent notifications
              await navigator.serviceWorker.register('/sw.js').catch(() => {
              });
            } catch (error) {
            }
          }
          
          let permission: NotificationPermission;
          try {
            permission = await Notification.requestPermission();
          } catch (error) {
            console.error('Error requesting notification permission:', error);
            permission = 'denied';
          }
          
          setPermissionStatus(permission);
          setHasPermission(permission === 'granted');

          if (permission !== 'granted') {
            return false;
          }
          
          return permission === 'granted';
        }
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      // Don't throw error, just return false and update state
      setHasPermission(false);
      setPermissionStatus('denied');
      return false;
    }
  }, []);

  // Play sound with volume control
  const playSound = useCallback(async (isOrderSound = false) => {
    try {
      // If this is an order sound and we have a custom sound, use it
      if (isOrderSound && customSoundSettings.hasCustomSound) {
        const customPlayed = await playCustomSound();
        if (customPlayed) {
          return;
        }
        // If custom sound failed, fall back to generated sound
      }

      try {
        // Try to use generated sound first (always available)
        const volume = getVolumeMultiplier(volumeLevel);
        await playGeneratedSound({
          type: isOrderSound ? 'order' : 'notification',
          volume: isOrderSound ? Math.min(volume * 1.2, 1.0) : volume,
          duration: isOrderSound ? 0.8 : 0.6
        });
        return;
      } catch (generatedError) {
}

      // Fallback to file-based sound
      const sound = createSound(isOrderSound);

      // Enable audio context if needed
      if (window.AudioContext || (window as any).webkitAudioContext) {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
      }

      if (sound.state() === 'loaded') {
        sound.play();
      } else {
        // Final fallback beep sound
        createFallbackBeep(isOrderSound);
      }
    } catch (error) {
      console.error('Error playing sound:', error);
      createFallbackBeep(isOrderSound);
    }
  }, [createSound, volumeLevel, customSoundSettings, playCustomSound, getVolumeMultiplier]);

  // Create fallback beep sound
  const createFallbackBeep = useCallback((isOrderSound = false) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Higher frequency for order sounds
      oscillator.frequency.value = isOrderSound ? 1000 : 600;
      oscillator.type = 'sine';
      
      const volume = getVolumeMultiplier(volumeLevel);
      const adjustedVolume = isOrderSound ? Math.min(volume * 1.5, 1.0) : volume;
      
      gainNode.gain.setValueAtTime(adjustedVolume, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.8);
    } catch (error) {
      console.error('Error creating fallback beep:', error);
    }
  }, [volumeLevel, getVolumeMultiplier]);

  // Show notification
  const showNotification = useCallback(async (
    title: string,
    options: NotificationOptions = {},
    playNotificationSound = false
  ) => {
    try {
      if (!hasPermission) {
        const granted = await requestPermission();
        if (!granted) {
          // Don't throw error, just return false
          return false;
        }
      }

      if (Capacitor.isNativePlatform()) {
        await LocalNotifications.schedule({
          notifications: [
            {
              title,
              body: options.body || '',
              id: Date.now(),
              sound: 'notification.wav',
              attachments: [],
              actionTypeId: 'ORDER',
              extra: { ...options, autoOpen: true }
            }
          ]
        });
      } else {
        if ('Notification' in window && Notification.permission === 'granted') {
          // إنشاء إشعار محسن للمتصفح
          const notificationOptions = {
            body: options.body,
            icon: options.icon || '/notification-icon.svg',
            tag: options.tag,
            renotify: options.renotify,
            requireInteraction: options.requireInteraction,
            silent: options.silent || false,
            vibrate: options.vibrate || [200, 100, 200],
            badge: '/notification-icon.svg',
            timestamp: Date.now(),
            actions: options.actions || [],
            data: {
              autoOpen: true,
              url: '/orders',
              timestamp: Date.now()
            }
          };

          const notification = new Notification(title, notificationOptions);

          // Handle notification click
          notification.onclick = () => {
            // التركيز على النافذة الحالية فقط
            window.focus();

            if (window.parent !== window) {
              window.parent.focus();
            }

            notification.close();

            // التوجه لصفحة الطلبات فقط إذا كان في الصفحة الرئيسية
            if (window.location.pathname === '/' || window.location.pathname === '/dashboard') {
              window.location.href = '/orders';
            }
          };

          // إغلاق تلقائي بعد 60 ثانية
          setTimeout(() => {
            notification.close();
          }, 60000);

        } else {
return false;
        }
      }

      // Play sound if requested
      if (playNotificationSound) {
        await playSound(false);
      }

      return true;
    } catch (error) {
      console.error('Error showing notification:', error);
      return false;
    }
  }, [hasPermission, playSound]);

  // Test notification with current volume
  const testNotification = useCallback(async (): Promise<boolean> => {
    try {
      // Play test sound first
      await playSound(true); // Use order sound for testing
      
      // Show test notification
      const success = await showNotification(
        'اختبار الصوت',
        {
          body: `مستوى الصوت: ${
            volumeLevel === 'low' ? 'منخفض' :
            volumeLevel === 'medium' ? 'متوسط' :
            volumeLevel === 'high' ? 'عالي' : 'أقصى صوت'
          }`,
          tag: 'test-notification',
          requireInteraction: false
        }
      );

      return success;
    } catch (error) {
      console.error('Error testing notification:', error);
      return false;
    }
  }, [showNotification, playSound, volumeLevel]);

  // Initialize permissions on mount
  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  return {
    hasPermission,
    permissionStatus,
    volumeLevel,
    isAuthenticated,
    checkPermission,
    requestPermission,
    showNotification,
    testNotification,
    playSound,
    updateVolumeLevel,
    getVolumeMultiplier
  };
}