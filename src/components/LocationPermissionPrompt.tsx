import React from 'react';
import { useState } from 'react';
import { MapPin, AlertCircle } from 'lucide-react';
import { useLocationPermission } from '../hooks/useLocationPermission';

interface LocationPermissionPromptProps {
  onPermissionGranted?: () => void;
  onDismiss?: () => void;
}

export default function LocationPermissionPrompt({ onPermissionGranted, onDismiss }: LocationPermissionPromptProps) {
  const { hasPermission, isLoading, requestPermission } = useLocationPermission();
  const [isRequesting, setIsRequesting] = useState(false);

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    try {
    const granted = await requestPermission();
    if (granted && onPermissionGranted) {
      onPermissionGranted();
    }
    } catch (error) {
      console.error('Error requesting permission:', error);
    } finally {
      setIsRequesting(false);
    }
  };

  if (hasPermission === true) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
        <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <MapPin className="h-10 w-10 text-red-600" />
        </div>
        
        <h3 className="text-xl font-bold text-center mb-2">السماح بالوصول إلى الموقع</h3>
        <p className="text-gray-600 text-center mb-6">
          لتوفير أفضل تجربة ممكنة، تحتاج سائق كابتن طيار إلى الوصول إلى موقعك الحالي. هذا ضروري لتحديد الطلبات القريبة منك وحساب المسافة بدقة.
        </p>
        
        {hasPermission === false && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start">
            <AlertCircle className="h-5 w-5 text-red-500 ml-2 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-600">
              يرجى السماح بالوصول إلى موقعك الحالي للاستمرار في استخدام التطبيق. إذا رفضت من قبل، يرجى تفعيل الموقع من إعدادات المتصفح أو الجهاز.
            </p>
          </div>
        )}
        
        <button
          onClick={handleRequestPermission}
          disabled={isLoading || isRequesting}
          className={`w-full py-3 rounded-lg text-white font-medium ${
            (isLoading || isRequesting) ? 'bg-red-400' : 'bg-red-600 hover:bg-red-700'
           (isLoading || isRequesting) ? 'bg-red-400' : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          {(isLoading || isRequesting) ? (
            <div className="flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin ml-2" />
              {isRequesting ? 'جاري طلب الإذن...' : 'جاري التحميل...'}
            </div>
          ) : (
            'السماح بالوصول'
          )}
        </button>
        
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            disabled={isLoading || isRequesting}
          >
            إغلاق
          </button>
        )}
        
        <p className="text-xs text-gray-500 text-center mt-4">
          يمكنك تغيير هذا الإعداد لاحقاً من خلال إعدادات الجهاز
        </p>
        
        {hasPermission === false && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs text-red-700">
              <strong>تعليمات:</strong><br/>
              • في المتصفح: اضغط على أيقونة القفل بجانب العنوان واختر "السماح"<br/>
            
              • في الجهاز: اذهب إلى الإعدادات &gt; التطبيقات &gt; سائق كابتن طيار &gt; الأذونات &gt; الموقع
            </p>
          </div>
        )}
      </div>
    </div>
  );
}