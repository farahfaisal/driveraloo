import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Bell, MapPin, Volume2 } from 'lucide-react';
import { useLocationPermission } from '../hooks/useLocationPermission';
import { useNotifications } from '../hooks/useNotifications';
import toast from 'react-hot-toast';

export default function PermissionChecker() {
  const { hasPermission: hasLocationPermission, requestPermission: requestLocation, isLoading: locationLoading } = useLocationPermission();
  const { 
    hasPermission: hasNotificationPermission, 
    requestPermission: requestNotification, 
    testNotification,
    permissionStatus,
    volumeLevel
  } = useNotifications();

  const [isTestingNotifications, setIsTestingNotifications] = useState(false);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [isRequestingNotification, setIsRequestingNotification] = useState(false);

  const handleRequestLocation = async () => {
    setIsRequestingLocation(true);
    try {
      const granted = await requestLocation();
      if (granted) {
        toast.success('تم تفعيل إذن الموقع بنجاح!');
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      toast.error('فشل في طلب إذن الموقع');
    } finally {
      setIsRequestingLocation(false);
    }
  };

  const handleRequestNotifications = async () => {
    setIsRequestingNotification(true);
    try {
      const granted = await requestNotification();
      if (granted) {
        toast.success('تم تفعيل إذن الإشعارات بنجاح!');
      } else {
        toast.error('تم رفض إذن الإشعارات');
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast.error('فشل في طلب إذن الإشعارات');
    } finally {
      setIsRequestingNotification(false);
    }
  };

  const handleTestAll = async () => {
    setIsTestingNotifications(true);
    try {
      if (!hasNotificationPermission) {
        toast.error('يجب تفعيل إذن الإشعارات أولاً');
        return;
      }

      const success = await testNotification();
      if (success) {
        toast.success('تم تشغيل الاختبار بنجاح!');
      } else {
        toast.error('فشل في تشغيل الاختبار');
      }
    } catch (error) {
      console.error('Error testing notifications:', error);
      toast.error('فشل في تشغيل الاختبار');
    } finally {
      setIsTestingNotifications(false);
    }
  };

  const getStatusDisplay = (permission: boolean | null, isLoading: boolean) => {
    if (isLoading) {
      return {
        icon: <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />,
        text: 'جاري التحقق...',
        color: 'text-gray-600'
      };
    }
    
    if (permission === true) {
      return {
        icon: <CheckCircle className="w-5 h-5 text-green-600" />,
        text: 'مُفعّل',
        color: 'text-green-600'
      };
    }
    
    if (permission === false) {
      return {
        icon: <AlertCircle className="w-5 h-5 text-red-600" />,
        text: 'غير مُفعّل',
        color: 'text-red-600'
      };
    }
    
    // permission === null (unknown state)
    return {
      icon: <AlertCircle className="w-5 h-5 text-yellow-600" />,
      text: 'غير محدد',
      color: 'text-yellow-600'
    };
  };

  const locationStatus = getStatusDisplay(hasLocationPermission, locationLoading);
  const notificationStatus = getStatusDisplay(hasNotificationPermission, false);

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <h3 className="font-bold text-lg mb-4 text-center">حالة الأذونات</h3>
      
      <div className="space-y-3">
        {/* Location Permission */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center">
            <MapPin className="w-5 h-5 text-red-600 ml-2" />
            <span className="font-medium">إذن الموقع</span>
          </div>
          <div className="flex items-center gap-2">
            {locationStatus.icon}
            <span className={`text-sm ${locationStatus.color}`}>
              {locationStatus.text}
            </span>
            {(hasLocationPermission === false || hasLocationPermission === null) && (
              <button
                onClick={handleRequestLocation}
                disabled={isRequestingLocation || locationLoading}
                className={`px-3 py-1 text-xs rounded-xl transition-all duration-300 transform hover:scale-105 ${
                  isRequestingLocation || locationLoading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-secondary-600 to-secondary-700 text-white hover:from-secondary-700 hover:to-secondary-800 shadow-md hover:shadow-lg'
                }`}
              >
                {isRequestingLocation ? 'جاري التفعيل...' : 'تفعيل'}
              </button>
            )}
          </div>
        </div>

        {/* Notification Permission */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center">
            <Bell className="w-5 h-5 text-red-600 ml-2" />
            <span className="font-medium">إذن الإشعارات</span>
          </div>
          <div className="flex items-center gap-2">
            {notificationStatus.icon}
            <span className={`text-sm ${notificationStatus.color}`}>
              {notificationStatus.text}
            </span>
            {!hasNotificationPermission && (
              <button
                onClick={handleRequestNotifications}
                disabled={isRequestingNotification}
                className={`px-3 py-1 text-xs rounded-xl transition-all duration-300 transform hover:scale-105 ${
                  isRequestingNotification
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-secondary-600 to-secondary-700 text-white hover:from-secondary-700 hover:to-secondary-800 shadow-md hover:shadow-lg'
                }`}
              >
                {isRequestingNotification ? 'جاري التفعيل...' : 'تفعيل'}
              </button>
            )}
          </div>
        </div>
        
        {/* Volume Level Display */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center">
            <Volume2 className="w-5 h-5 text-red-600 ml-2" />
            <span className="font-medium">مستوى الصوت</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              {volumeLevel === 'low' ? 'منخفض' :
               volumeLevel === 'medium' ? 'متوسط' :
               volumeLevel === 'high' ? 'عالي' : 'أقصى صوت'}
            </span>
            <div className={`w-3 h-3 rounded-full ${
              volumeLevel === 'max' ? 'bg-red-500' :
              volumeLevel === 'high' ? 'bg-red-500' :
              volumeLevel === 'medium' ? 'bg-blue-500' : 'bg-gray-400'
            }`}></div>
          </div>
        </div>
      </div>

      {/* Test Button */}
      {hasLocationPermission === true && hasNotificationPermission === true && (
        <div className="mt-4 text-center">
          <button
            onClick={handleTestAll}
            disabled={isTestingNotifications}
            className={`px-6 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center mx-auto shadow-lg hover:shadow-xl ${
              isTestingNotifications
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-gradient-to-r from-secondary-700 to-secondary-800 text-white hover:from-secondary-800 hover:to-secondary-900 btn-hover-lift ripple'
            }`}
          >
            {isTestingNotifications ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin ml-2"></div>
                جاري الاختبار...
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 ml-2" />
                اختبار الصوت والأذونات
              </>
            )}
          </button>
        </div>
      )}

      {/* Instructions */}
      {(hasLocationPermission !== true || hasNotificationPermission !== true) && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800 font-medium mb-2">ملاحظات مهمة:</p>
          <ul className="text-xs text-red-700 space-y-1">
            <li>• الموقع مطلوب لعرض الطلبات القريبة وحساب المسافات</li>
            <li>• الإشعارات مطلوبة لتنبيهك عند وصول طلبات جديدة</li>
            <li>• اضغط "تفعيل" بجانب كل إذن لطلبه</li>
            <li>• إذا لم يعمل الزر، فعّل الإذن من إعدادات المتصفح/الجهاز</li>
            <li>• بعض الميزات قد لا تعمل بدون هذه الأذونات</li>
          </ul>
        </div>
      )}

      {/* Browser-specific instructions */}
      {(hasLocationPermission === false || hasNotificationPermission === false) && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-700">
            <strong>إعدادات المتصفح:</strong><br/>
            • Chrome: اضغط على أيقونة القفل/الدرع بجانب العنوان واختر "السماح"<br/>
            • Firefox: اضغط على أيقونة الدرع وقم بإلغاء الحماية<br/>
            • Safari: قائمة Safari {'>'} الإعدادات {'>'} مواقع الويب {'>'} الموقع
          </p>
        </div>
      )}

      {/* Current status debug info */}
      <div className="mt-3 p-2 bg-gray-100 rounded text-xs text-gray-600">
        <strong>معلومات التشخيص:</strong><br/>
        • إذن الموقع: {String(hasLocationPermission)}<br/>
        • إذن الإشعارات: {permissionStatus}<br/>
        • المنصة: {typeof navigator !== 'undefined' ? navigator.platform : 'غير معروف'}
      </div>
    </div>
  );
}