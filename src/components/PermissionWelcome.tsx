import React, { useState } from 'react';
import { Bell, MapPin, CheckCircle, ChevronRight } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { useLocationPermission } from '../hooks/useLocationPermission';
import toast from 'react-hot-toast';

interface PermissionWelcomeProps {
  onComplete: () => void;
}

export default function PermissionWelcome({ onComplete }: PermissionWelcomeProps) {
  const [step, setStep] = useState<'welcome' | 'notifications' | 'location' | 'complete'>('welcome');
  const [notificationsGranted, setNotificationsGranted] = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  const { requestPermission: requestNotificationPermission } = useNotifications();
  const { requestPermission: requestLocationPermission } = useLocationPermission();

  const handleRequestNotifications = async () => {
    setIsRequesting(true);
    try {
      const granted = await requestNotificationPermission();
      setNotificationsGranted(granted);

      if (granted) {
        toast.success('✅ تم تفعيل إذن الإشعارات');
        setTimeout(() => setStep('location'), 500);
      } else {
        toast.error('⚠️ لم يتم تفعيل إذن الإشعارات. يمكنك تفعيله لاحقاً من الإعدادات');
        setTimeout(() => setStep('location'), 1500);
      }
    } catch (error) {
      console.error('Error requesting notifications:', error);
      toast.error('حدث خطأ في طلب إذن الإشعارات');
      setTimeout(() => setStep('location'), 1500);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleRequestLocation = async () => {
    setIsRequesting(true);
    try {
      const granted = await requestLocationPermission();
      setLocationGranted(granted);

      if (granted) {
        toast.success('✅ تم تفعيل إذن الموقع');
        setTimeout(() => setStep('complete'), 500);
      } else {
        toast.error('⚠️ لم يتم تفعيل إذن الموقع. يمكنك تفعيله لاحقاً من الإعدادات');
        setTimeout(() => setStep('complete'), 1500);
      }
    } catch (error) {
      console.error('Error requesting location:', error);
      toast.error('حدث خطأ في طلب إذن الموقع');
      setTimeout(() => setStep('complete'), 1500);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleSkipNotifications = () => {
    toast('يمكنك تفعيل الإشعارات لاحقاً من الإعدادات', { icon: 'ℹ️' });
    setStep('location');
  };

  const handleSkipLocation = () => {
    toast('يمكنك تفعيل الموقع لاحقاً من الإعدادات', { icon: 'ℹ️' });
    setStep('complete');
  };

  const handleFinish = () => {
    onComplete();
  };

  if (step === 'welcome') {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-primary-600 to-primary-800 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="mb-6">
            <div className="w-24 h-24 bg-primary-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <Bell className="w-12 h-12 text-primary-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">مرحباً بك!</h1>
            <p className="text-gray-600 text-lg">في تطبيق الو جيتك للسائقين</p>
          </div>

          <div className="space-y-4 mb-8 text-right">
            <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
              <Bell className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">إشعارات الطلبات</h3>
                <p className="text-sm text-gray-600">استقبل إشعارات فورية عند وصول طلبات جديدة</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg">
              <MapPin className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">تحديد الموقع</h3>
                <p className="text-sm text-gray-600">لعرض الطلبات القريبة منك وحساب المسافات</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setStep('notifications')}
            className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 text-white font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
          >
            <span>ابدأ الإعداد</span>
            <ChevronRight className="w-5 h-5" />
          </button>

          <button
            onClick={handleFinish}
            className="mt-3 w-full py-2 text-gray-500 text-sm hover:text-gray-700"
          >
            تخطي وإعداد لاحقاً
          </button>
        </div>
      </div>
    );
  }

  if (step === 'notifications') {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-blue-600 to-blue-800 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="mb-6">
            <div className="w-24 h-24 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center animate-pulse">
              <Bell className="w-12 h-12 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">إشعارات الطلبات</h2>
            <p className="text-gray-600">نحتاج إذنك لإرسال إشعارات عند وصول طلبات جديدة</p>
          </div>

          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-6 text-right">
            <h3 className="font-semibold text-blue-900 mb-2">لماذا نحتاج هذا الإذن؟</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>تنبيهك فوراً عند وصول طلبات جديدة</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>تشغيل صوت تنبيه حتى لو كان التطبيق في الخلفية</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>عدم تفويت أي فرصة توصيل</span>
              </li>
            </ul>
          </div>

          <button
            onClick={handleRequestNotifications}
            disabled={isRequesting}
            className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRequesting ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>جاري الطلب...</span>
              </div>
            ) : (
              'السماح بالإشعارات'
            )}
          </button>

          <button
            onClick={handleSkipNotifications}
            disabled={isRequesting}
            className="mt-3 w-full py-2 text-gray-500 text-sm hover:text-gray-700 disabled:opacity-50"
          >
            تخطي هذه الخطوة
          </button>
        </div>
      </div>
    );
  }

  if (step === 'location') {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-green-600 to-green-800 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="mb-6">
            <div className="w-24 h-24 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center animate-pulse">
              <MapPin className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">إذن الموقع</h2>
            <p className="text-gray-600">نحتاج إذنك للوصول إلى موقعك الحالي</p>
          </div>

          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 mb-6 text-right">
            <h3 className="font-semibold text-green-900 mb-2">لماذا نحتاج هذا الإذن؟</h3>
            <ul className="space-y-2 text-sm text-green-800">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>عرض الطلبات القريبة منك أولاً</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>حساب المسافة ووقت التوصيل بدقة</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>تتبع رحلات التوصيل على الخريطة</span>
              </li>
            </ul>
          </div>

          <button
            onClick={handleRequestLocation}
            disabled={isRequesting}
            className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-green-600 to-green-700 text-white font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRequesting ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>جاري الطلب...</span>
              </div>
            ) : (
              'السماح بالموقع'
            )}
          </button>

          <button
            onClick={handleSkipLocation}
            disabled={isRequesting}
            className="mt-3 w-full py-2 text-gray-500 text-sm hover:text-gray-700 disabled:opacity-50"
          >
            تخطي هذه الخطوة
          </button>
        </div>
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-primary-600 to-primary-800 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="mb-6">
            <div className="w-24 h-24 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">تم الإعداد!</h2>
            <p className="text-gray-600">أنت الآن جاهز لاستقبال الطلبات</p>
          </div>

          <div className="space-y-3 mb-6 text-right">
            <div className={`flex items-center gap-3 p-3 rounded-lg ${
              notificationsGranted ? 'bg-green-50' : 'bg-gray-50'
            }`}>
              {notificationsGranted ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
              )}
              <span className={notificationsGranted ? 'text-green-900 font-medium' : 'text-gray-600'}>
                الإشعارات {notificationsGranted ? 'مُفعّلة' : 'غير مُفعّلة'}
              </span>
            </div>

            <div className={`flex items-center gap-3 p-3 rounded-lg ${
              locationGranted ? 'bg-green-50' : 'bg-gray-50'
            }`}>
              {locationGranted ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
              )}
              <span className={locationGranted ? 'text-green-900 font-medium' : 'text-gray-600'}>
                الموقع {locationGranted ? 'مُفعّل' : 'غير مُفعّل'}
              </span>
            </div>
          </div>

          {(!notificationsGranted || !locationGranted) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-right">
              <p className="text-sm text-yellow-800">
                <strong>ملاحظة:</strong> يمكنك تفعيل الأذونات المتبقية لاحقاً من صفحة الإعدادات
              </p>
            </div>
          )}

          <button
            onClick={handleFinish}
            className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 text-white font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
          >
            ابدأ العمل
          </button>
        </div>
      </div>
    );
  }

  return null;
}
