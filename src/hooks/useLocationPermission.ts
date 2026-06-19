import { useEffect, useState, useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import toast from 'react-hot-toast';

export function useLocationPermission() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const checkPermission = useCallback(async () => {
    try {
      setIsLoading(true);
      
      if (!Capacitor.isNativePlatform()) {
        // في المتصفح، استخدم getCurrentPosition للتحقق من الإذن
        if (!('geolocation' in navigator)) {
          setHasPermission(false);
          return false;
        }

        // محاولة الحصول على الموقع دون طلب الإذن
        try {
          await new Promise<void>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              () => {
                setHasPermission(true);
                resolve();
              },
              (error) => {
                if (error.code === error.PERMISSION_DENIED) {
                  setHasPermission(false);
                } else {
                  // للأخطاء الأخرى، نحتاج لطلب الإذن
                  setHasPermission(null);
                }
                resolve();
              },
              { 
                timeout: 5000, 
                maximumAge: 300000, // استخدم الموقع المخزن إذا كان متاحاً
                enableHighAccuracy: false 
              }
            );
          });
          return hasPermission === true;
        } catch (error) {
          console.error('Error checking web geolocation:', error);
          setHasPermission(null);
          return false;
        }
      }
      
      // على المنصات الأصلية، استخدم Capacitor Geolocation
      try {
        const status = await Geolocation.checkPermissions();

        const hasPermission = status.location === 'granted';
        setHasPermission(hasPermission);
        return hasPermission;
      } catch (error) {
        console.error('Error checking native permissions:', error);
        setHasPermission(false);
        return false;
      }
    } catch (error) {
      console.error('Error in checkPermission:', error);
      setHasPermission(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [hasPermission]);

  const requestPermission = useCallback(async () => {
    try {
      setIsLoading(true);
      
      if (!Capacitor.isNativePlatform()) {
        // في المتصفح، استخدم getCurrentPosition لطلب الإذن
        if (!('geolocation' in navigator)) {
          toast.error('خدمة تحديد الموقع غير مدعومة في متصفحك');
          setHasPermission(false);
          return false;
        }

        try {
          await new Promise<void>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                setHasPermission(true);
                toast.success('تم الحصول على إذن الموقع بنجاح');
                resolve();
              },
              (error) => {
                let errorMessage = 'فشل في الحصول على إذن الموقع';

                switch (error.code) {
                  case error.PERMISSION_DENIED:
                    errorMessage = 'يرجى السماح بالوصول إلى الموقع من إعدادات المتصفح';
                    setHasPermission(false);
                    break;
                  case error.POSITION_UNAVAILABLE:
                    errorMessage = 'خدمة تحديد الموقع غير متوفرة';
                    setHasPermission(false);
                    break;
                  case error.TIMEOUT:
                    errorMessage = 'انتهت مهلة طلب تحديد الموقع - يرجى المحاولة مرة أخرى';
                    setHasPermission(null);
                    break;
                  default:
                    errorMessage = 'حدث خطأ غير متوقع في طلب الموقع';
                    setHasPermission(false);
                }

                toast.error(errorMessage);
                reject(new Error(errorMessage));
              },
              {
                timeout: 15000,
                enableHighAccuracy: true,
                maximumAge: 0
              }
            );
          });
          return true;
        } catch (error) {
          return false;
        }
      }

      // على المنصات الأصلية، استخدم Capacitor Geolocation
      try {
        const status = await Geolocation.requestPermissions({
          permissions: ['location']
        });

        const granted = status.location === 'granted';
        setHasPermission(granted);

        if (granted) {
          toast.success('تم الحصول على إذن الموقع بنجاح');
        } else {
          toast.error('يرجى السماح بالوصول إلى الموقع من إعدادات الجهاز');
        }

        return granted;
      } catch (error) {
        console.error('Error requesting native permissions:', error);
        setHasPermission(false);
        toast.error('فشل في طلب إذن الموقع');
        return false;
      }
    } catch (error) {
      console.error('Error in requestPermission:', error);
      setHasPermission(false);
      toast.error('حدث خطأ في طلب إذن الموقع');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  return { hasPermission, isLoading, checkPermission, requestPermission };
}