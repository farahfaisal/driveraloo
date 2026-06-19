import React from 'react';
import { Play, Square, Navigation, MapPin, Clock, Gauge } from 'lucide-react';
import { GPSPosition } from '../hooks/useGPSTracking';

interface GPSTrackingControlsProps {
  isTracking: boolean;
  currentPosition: GPSPosition | null;
  onStartTracking: () => void;
  onStopTracking: () => void;
  error?: string | null;
  positionHistory: GPSPosition[];
}

export default function GPSTrackingControls({
  isTracking,
  currentPosition,
  onStartTracking,
  onStopTracking,
  error,
  positionHistory
}: GPSTrackingControlsProps) {
  const formatSpeed = (speed?: number) => {
    if (!speed || speed < 0) return '0 كم/س';
    return `${Math.round(speed * 3.6)} كم/س`;
  };

  const formatAccuracy = (accuracy: number) => {
    if (accuracy < 1000) {
      return `${Math.round(accuracy)} متر`;
    }
    return `${(accuracy / 1000).toFixed(1)} كم`;
  };

  const formatDirection = (heading?: number) => {
    if (!heading) return 'غير محدد';
    
    const directions = [
      'شمال', 'شمال شرق', 'شرق', 'جنوب شرق',
      'جنوب', 'جنوب غرب', 'غرب', 'شمال غرب'
    ];
    
    const index = Math.round(heading / 45) % 8;
    return `${directions[index]} (${Math.round(heading)}°)`;
  };

  return (
    <div className="bg-white rounded-lg p-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-base flex items-center">
          <Navigation className="w-5 h-5 text-blue-600 ml-2" />
          تتبع GPS
        </h3>
        
        <button
          onClick={isTracking ? onStopTracking : onStartTracking}
          className={`flex items-center px-3 py-1 rounded-lg font-medium transition-colors text-sm ${
            isTracking
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isTracking ? (
            <>
              <Square className="w-4 h-4 ml-2" />
              إيقاف التتبع
            </>
          ) : (
            <>
              <Play className="w-4 h-4 ml-2" />
              بدء التتبع
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-3">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {isTracking && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-3">
          <div className="flex items-center text-blue-700 mb-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse ml-2"></div>
            <span className="text-xs font-medium">التتبع نشط</span>
          </div>
          <p className="text-blue-600 text-xs">
            يتم تحديث موقعك كل 5 أمتار • {positionHistory.length} نقطة مسجلة
          </p>
        </div>
      )}

      {currentPosition && (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-50 rounded-lg p-2">
            <div className="flex items-center mb-2">
              <MapPin className="w-4 h-4 text-gray-600 ml-1" />
              <span className="text-xs font-medium text-gray-700">الإحداثيات</span>
            </div>
            <p className="text-xs text-gray-600">
              {currentPosition.latitude.toFixed(6)}, {currentPosition.longitude.toFixed(6)}
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-2">
            <div className="flex items-center mb-2">
              <Clock className="w-4 h-4 text-gray-600 ml-1" />
              <span className="text-xs font-medium text-gray-700">الدقة</span>
            </div>
            <p className="text-xs text-gray-600">
              {formatAccuracy(currentPosition.accuracy)}
            </p>
          </div>

          {currentPosition.speed !== undefined && (
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="flex items-center mb-2">
                <Gauge className="w-4 h-4 text-gray-600 ml-1" />
                <span className="text-xs font-medium text-gray-700">السرعة</span>
              </div>
              <p className="text-xs text-gray-600">
                {formatSpeed(currentPosition.speed)}
              </p>
            </div>
          )}

          {currentPosition.heading !== undefined && (
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="flex items-center mb-2">
                <Navigation className="w-4 h-4 text-gray-600 ml-1" />
                <span className="text-xs font-medium text-gray-700">الاتجاه</span>
              </div>
              <p className="text-xs text-gray-600">
                {formatDirection(currentPosition.heading)}
              </p>
            </div>
          )}
        </div>
      )}

      {!currentPosition && !isTracking && (
        <div className="text-center py-3">
          <MapPin className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">اضغط "بدء التتبع" لبدء تتبع موقعك</p>
        </div>
      )}
    </div>
  );
}