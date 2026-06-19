import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import toast from 'react-hot-toast';

export interface GPSPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

export interface GPSTrackingOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  distanceFilter?: number; // Minimum distance in meters to trigger update
}

export function useGPSTracking(options: GPSTrackingOptions = {}) {
  const [currentPosition, setCurrentPosition] = useState<GPSPosition | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [positionHistory, setPositionHistory] = useState<GPSPosition[]>([]);
  const watchIdRef = useRef<string | null>(null);
  const lastPositionRef = useRef<GPSPosition | null>(null);

  const defaultOptions: GPSTrackingOptions = useMemo(() => ({
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 5000,
    distanceFilter: 5, // 5 meters
    ...options
  }), [options.enableHighAccuracy, options.timeout, options.maximumAge, options.distanceFilter]);

  // Calculate distance between two points
  const calculateDistance = useCallback((pos1: GPSPosition, pos2: GPSPosition): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = pos1.latitude * Math.PI / 180;
    const φ2 = pos2.latitude * Math.PI / 180;
    const Δφ = (pos2.latitude - pos1.latitude) * Math.PI / 180;
    const Δλ = (pos2.longitude - pos1.longitude) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  }, []);

  // Start GPS tracking
  const startTracking = useCallback(async () => {
    try {
      setError(null);
      setIsTracking(true);

      if (Capacitor.isNativePlatform()) {
        // Use Capacitor Geolocation for native platforms
        const watchId = await Geolocation.watchPosition(
          {
            enableHighAccuracy: defaultOptions.enableHighAccuracy,
            timeout: defaultOptions.timeout,
            maximumAge: defaultOptions.maximumAge
          },
          (position, err) => {
            if (err) {
              console.error('GPS tracking error:', err);
              setError('خطأ في تتبع الموقع: ' + err.message);
              return;
            }

            if (position) {
              const newPosition: GPSPosition = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                heading: position.coords.heading || undefined,
                speed: position.coords.speed || undefined,
                timestamp: position.timestamp
              };

              // Check if we should update based on distance filter
              const lastPos = lastPositionRef.current;
              if (!lastPos || calculateDistance(lastPos, newPosition) >= (defaultOptions.distanceFilter || 5)) {
                setCurrentPosition(newPosition);
                setPositionHistory(prev => [...prev.slice(-50), newPosition]); // Keep last 50 positions
                lastPositionRef.current = newPosition;
              }
            }
          }
        );

        watchIdRef.current = watchId;
      } else {
        // Use Web Geolocation API for web platforms
        if (!navigator.geolocation) {
          throw new Error('خدمة تحديد الموقع غير مدعومة في هذا المتصفح');
        }

        const watchId = navigator.geolocation.watchPosition(
          (position) => {
            const newPosition: GPSPosition = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              heading: position.coords.heading || undefined,
              speed: position.coords.speed || undefined,
              timestamp: position.timestamp
            };

            // Check distance filter
            const lastPos = lastPositionRef.current;
            if (!lastPos || calculateDistance(lastPos, newPosition) >= (defaultOptions.distanceFilter || 5)) {
              setCurrentPosition(newPosition);
              setPositionHistory(prev => [...prev.slice(-50), newPosition]);
              lastPositionRef.current = newPosition;
            }
          },
          (error) => {
            console.error('GPS tracking error:', error);
            let errorMessage = 'خطأ في تتبع الموقع';
            
            switch (error.code) {
              case error.PERMISSION_DENIED:
                errorMessage = 'تم رفض إذن الوصول للموقع';
                break;
              case error.POSITION_UNAVAILABLE:
                errorMessage = 'الموقع غير متوفر';
                break;
              case error.TIMEOUT:
                errorMessage = 'انتهت مهلة تحديد الموقع';
                break;
            }
            
            setError(errorMessage);
          },
          {
            enableHighAccuracy: defaultOptions.enableHighAccuracy,
            timeout: defaultOptions.timeout,
            maximumAge: defaultOptions.maximumAge
          }
        );

        watchIdRef.current = watchId.toString();
      }
toast.success('تم بدء تتبع الموقع');

    } catch (error) {
      console.error('Error starting GPS tracking:', error);
      setError(error instanceof Error ? error.message : 'فشل في بدء تتبع الموقع');
      setIsTracking(false);
      toast.error('فشل في بدء تتبع الموقع');
    }
  }, [defaultOptions, calculateDistance]);

  // Stop GPS tracking
  const stopTracking = useCallback(async () => {
    try {
      if (watchIdRef.current) {
        if (Capacitor.isNativePlatform()) {
          await Geolocation.clearWatch({ id: watchIdRef.current });
        } else {
          navigator.geolocation.clearWatch(parseInt(watchIdRef.current));
        }

        watchIdRef.current = null;
      }

      setIsTracking(false);
toast.success('تم إيقاف تتبع الموقع');

    } catch (error) {
      console.error('Error stopping GPS tracking:', error);
      toast.error('خطأ في إيقاف تتبع الموقع');
    }
  }, []);

  // Get current position once
  const getCurrentPosition = useCallback(async (): Promise<GPSPosition | null> => {
    try {
      setError(null);

      if (Capacitor.isNativePlatform()) {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: defaultOptions.enableHighAccuracy,
          timeout: defaultOptions.timeout,
          maximumAge: defaultOptions.maximumAge
        });

        return {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          heading: position.coords.heading || undefined,
          speed: position.coords.speed || undefined,
          timestamp: position.timestamp
        };
      } else {
        return new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                heading: position.coords.heading || undefined,
                speed: position.coords.speed || undefined,
                timestamp: position.timestamp
              });
            },
            (error) => {
              let errorMessage = 'فشل في تحديد الموقع الحالي';
              
              switch (error.code) {
                case error.PERMISSION_DENIED:
                  errorMessage = 'تم رفض إذن الوصول للموقع. يرجى السماح بالوصول للموقع في إعدادات المتصفح';
                  break;
                case error.POSITION_UNAVAILABLE:
                  errorMessage = 'الموقع غير متوفر. تأكد من تفعيل GPS أو خدمات الموقع';
                  break;
                case error.TIMEOUT:
                  errorMessage = 'انتهت مهلة تحديد الموقع. يرجى المحاولة مرة أخرى';
                  break;
                default:
                  errorMessage = 'خطأ غير معروف في تحديد الموقع: ' + error.message;
              }
              
              reject(new Error(errorMessage));
            },
            {
              enableHighAccuracy: defaultOptions.enableHighAccuracy,
              timeout: defaultOptions.timeout,
              maximumAge: defaultOptions.maximumAge
            }
          );
        });
      }
    } catch (error) {
      console.error('Error getting current position:', error);
      setError(error instanceof Error ? error.message : 'فشل في تحديد الموقع');
      return null;
    }
  }, [defaultOptions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current) {
        if (Capacitor.isNativePlatform()) {
          Geolocation.clearWatch({ id: watchIdRef.current }).catch(console.error);
        } else {
          navigator.geolocation.clearWatch(parseInt(watchIdRef.current));
        }
      }
    };
  }, []);

  return {
    currentPosition,
    isTracking,
    error,
    positionHistory,
    startTracking,
    stopTracking,
    getCurrentPosition,
    clearError: () => setError(null),
    clearHistory: () => setPositionHistory([])
  };
}