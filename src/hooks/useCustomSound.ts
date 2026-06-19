import { useState, useEffect, useCallback } from 'react';
import { Howl } from 'howler';
import toast from 'react-hot-toast';
import { storage } from '../utils/storage';

export interface CustomSoundSettings {
  hasCustomSound: boolean;
  soundName: string;
  soundUrl: string;
  volume: number;
}

export function useCustomSound() {
  const [customSoundSettings, setCustomSoundSettings] = useState<CustomSoundSettings>({
    hasCustomSound: false,
    soundName: '',
    soundUrl: '',
    volume: 1.0
  });
  const [customSound, setCustomSound] = useState<Howl | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const defaultCustomSound = {
        hasCustomSound: false,
        soundName: '',
        soundUrl: 'https://fliwyntfvfedslbwkvks.supabase.co/storage/v1/object/public/general/logos/WhatsApp%20Audio%202025-09-02%20at%201.56.07%20PM.mp4',
        volume: 1.0
      };

      const savedSettings = await storage.get('custom_sound_settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setCustomSoundSettings(settings);
        
        // Load the custom sound if it exists
        if (settings.hasCustomSound && settings.soundUrl) {
          loadCustomSound(settings.soundUrl, settings.volume);
        }
      } catch (error) {
        console.error('Error loading custom sound settings:', error);
        setCustomSoundSettings(defaultCustomSound);
      }
    } else {
      setCustomSoundSettings(defaultCustomSound);
      await storage.set('custom_sound_settings', JSON.stringify(defaultCustomSound));
    }
    };
    loadSettings();
  }, []);

  const saveSettings = useCallback(async (settings: CustomSoundSettings) => {
    await storage.set('custom_sound_settings', JSON.stringify(settings));
    setCustomSoundSettings(settings);
  }, []);

  // Load custom sound from URL
  const loadCustomSound = useCallback((url: string, volume: number = 1.0) => {
    try {
      // Create Howl instance directly with better error handling
      createHowlInstance(url, volume);
      
    } catch (error) {
      console.error('Error testing audio format:', error);
      handleSoundLoadError('خطأ في اختبار الملف الصوتي');
    }
  }, []);

  // Create Howl instance after format validation
  const createHowlInstance = useCallback((url: string, volume: number) => {
    try {
      const sound = new Howl({
        src: [url],
        volume: volume,
        preload: true,
        html5: false, // Use Web Audio API for better format support
        format: ['mp3', 'wav', 'ogg', 'm4a', 'aac'], // Support more formats
        onload: () => {
          setCustomSound(sound);
          toast.success('تم تحميل الصوت المخصص بنجاح');
        },
        onloaderror: (id, error) => {
          console.error('Error loading custom sound:', error);
          // Try with HTML5 fallback
          const fallbackSound = new Howl({
            src: [url],
            volume: volume,
            preload: true,
            html5: true, // Fallback to HTML5
            onload: () => {
              setCustomSound(fallbackSound);
              toast.success('تم تحميل الصوت المخصص بنجاح (وضع التوافق)');
            },
            onloaderror: () => {
              handleSoundLoadError('فشل في تحميل الصوت المخصص');
            }
          });
        }
      });
    } catch (error) {
      console.error('Error creating custom sound:', error);
      handleSoundLoadError('خطأ في إعداد الصوت المخصص');
    }
  }, []);

  // Handle sound loading errors
  const handleSoundLoadError = useCallback((message: string) => {
    toast.error(`${message}. سيتم استخدام الصوت الافتراضي`);
    
    // Remove the invalid custom sound settings
    const resetSettings: CustomSoundSettings = {
      hasCustomSound: false,
      soundName: '',
      soundUrl: '',
      volume: 1.0
    };
    saveSettings(resetSettings);
    setCustomSound(null);
  }, [saveSettings]);

  // Upload custom sound file
  const uploadCustomSound = useCallback(async (file: File): Promise<boolean> => {
    try {
      setIsLoading(true);

      // Validate file type
      if (!file.type.startsWith('audio/')) {
        toast.error('يرجى اختيار ملف صوتي صحيح (MP3, WAV, OGG)');
        return false;
      }

      // Accept more audio formats
      const supportedFormats = [
        'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 
        'audio/mp4', 'audio/m4a', 'audio/aac', 'audio/webm'
      ];
      
      // Only warn if format is completely unsupported, but still try to load
      if (!supportedFormats.includes(file.type)) {
        toast(`تحذير: صيغة ${file.type} قد لا تكون مدعومة. سنحاول تحميلها...`, {
          icon: '⚠️',
          duration: 3000
        });
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('حجم الملف كبير جداً. الحد الأقصى 5 ميجابايت');
        return false;
      }

      // Convert file to base64 for persistent storage (blob URLs expire on page reload)
      const base64Url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Try to create Howl instance directly with multiple fallback strategies
      return new Promise<boolean>((resolve) => {
        const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'mp3';

        // Strategy 1: Web Audio API (best quality)
        const primarySound = new Howl({
          src: [base64Url],
          volume: customSoundSettings.volume,
          preload: true,
          html5: false,
          format: [fileExtension],
          onload: () => {
            const newSettings: CustomSoundSettings = {
              hasCustomSound: true,
              soundName: file.name,
              soundUrl: base64Url,
              volume: customSoundSettings.volume
            };
            saveSettings(newSettings);
            setCustomSound(primarySound);
            toast.success(`تم رفع الصوت "${file.name}" بنجاح`);
            resolve(true);
          },
          onloaderror: (id, error) => {
            // Strategy 2: HTML5 Audio fallback
            const fallbackSound = new Howl({
              src: [base64Url],
              volume: customSoundSettings.volume,
              preload: true,
              html5: true,
              format: [fileExtension],
              onload: () => {
                const newSettings: CustomSoundSettings = {
                  hasCustomSound: true,
                  soundName: file.name,
                  soundUrl: base64Url,
                  volume: customSoundSettings.volume
                };
                saveSettings(newSettings);
                setCustomSound(fallbackSound);
                toast.success(`تم رفع الصوت "${file.name}" بنجاح (وضع التوافق)`);
                resolve(true);
              },
              onloaderror: () => {
                console.error('Both Web Audio and HTML5 failed');
                toast.error(`فشل في تحميل "${file.name}". جرب ملف MP3 بترميز مختلف أو حجم أصغر`);
                resolve(false);
              }
            });
          }
        });
      });

      return true;
    } catch (error) {
      console.error('Error uploading custom sound:', error);
      toast.error('فشل في رفع الملف الصوتي');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [customSoundSettings.volume, saveSettings, loadCustomSound]);

  // Remove custom sound
  const removeCustomSound = useCallback(() => {
    try {
      // Stop and unload current sound
      if (customSound) {
        customSound.stop();
        customSound.unload();
        setCustomSound(null);
      }

      // Reset settings
      const newSettings: CustomSoundSettings = {
        hasCustomSound: false,
        soundName: '',
        soundUrl: '',
        volume: 1.0
      };

      saveSettings(newSettings);
      toast.success('تم حذف الصوت المخصص');
    } catch (error) {
      console.error('Error removing custom sound:', error);
      toast.error('فشل في حذف الصوت المخصص');
    }
  }, [customSound, customSoundSettings.soundUrl, saveSettings]);

  // Update volume
  const updateVolume = useCallback((volume: number) => {
    const newSettings = {
      ...customSoundSettings,
      volume: Math.max(0.1, Math.min(2.0, volume)) // Clamp between 0.1 and 2.0
    };
    
    saveSettings(newSettings);
    
    // Update current sound volume
    if (customSound) {
      customSound.volume(newSettings.volume);
    }
  }, [customSoundSettings, customSound, saveSettings]);

  // Play custom sound
  const playCustomSound = useCallback(async () => {
    try {
      if (customSound && customSoundSettings.hasCustomSound) {
        // Enable audio context if needed
        if (window.AudioContext || (window as any).webkitAudioContext) {
          try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            if (audioContext.state === 'suspended') {
              await audioContext.resume();
            }
          } catch (contextError) {
          }
        }

        try {
          customSound.stop();
          customSound.play();
          return true;
        } catch (playError) {
          console.error('Error playing custom sound:', playError);
          toast.error('فشل في تشغيل الصوت المخصص. سيتم استخدام الصوت الافتراضي');
          return false;
        }
      }
      return false;
    } catch (error) {
      console.error('Error playing custom sound:', error);
      return false;
    }
  }, [customSound, customSoundSettings]);

  // Test custom sound
  const testCustomSound = useCallback(async () => {
    const success = await playCustomSound();
    if (success) {
      toast.success('تم تشغيل الصوت المخصص');
    } else {
      toast.error('فشل في تشغيل الصوت المخصص');
    }
    return success;
  }, [playCustomSound]);

  return {
    customSoundSettings,
    customSound,
    isLoading,
    uploadCustomSound,
    removeCustomSound,
    updateVolume,
    playCustomSound,
    testCustomSound
  };
}