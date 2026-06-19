import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User as UserIcon, Mail, Phone, Bell, Shield, Info, Settings as SettingsIcon, ChevronDown, ChevronUp, Eye, EyeOff, AlertTriangle, Download, Smartphone, RefreshCw, CheckCircle, XCircle, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import PermissionChecker from '../components/PermissionChecker';
import VolumeControl from '../components/VolumeControl';
import CustomSoundUploader from '../components/CustomSoundUploader';
import SoundTester from '../components/SoundTester';
import PWADiagnostics from '../components/PWADiagnostics';
import { useBackgroundService } from '../hooks/useBackgroundService';
import { useNotifications } from '../hooks/useNotifications';
import { storage } from '../utils/storage';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '../services/auth';
import { saveTokenToDb } from '../hooks/usePushTokenRegistration';

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { showOrderNotification } = useBackgroundService();
  const { testNotification, showNotification } = useNotifications();
  const [isTestingExternal, setIsTestingExternal] = useState(false);
  const [isAccountSectionOpen, setIsAccountSectionOpen] = useState(false);
  const [overlayPermissionEnabled, setOverlayPermissionEnabled] = useState(false);
  const [isCheckingOverlayPermission, setIsCheckingOverlayPermission] = useState(false);
  const [pwaInstallPrompt, setPwaInstallPrompt] = useState<any>(null);
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [fcmStatus, setFcmStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [fcmSavedToDb, setFcmSavedToDb] = useState<boolean | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      const savedSetting = await storage.get('overlay_permission_enabled');
      setOverlayPermissionEnabled(savedSetting === 'true');
    };
    loadSettings();

    if (!Capacitor.isNativePlatform()) {
      setIsPWAInstalled(window.matchMedia('(display-mode: standalone)').matches);

      const handler = (e: any) => {
        e.preventDefault();
        setPwaInstallPrompt(e);
      };

      window.addEventListener('beforeinstallprompt', handler);

      return () => {
        window.removeEventListener('beforeinstallprompt', handler);
      };
    }
  }, []);

  const updateOverlayPermission = async (enabled: boolean) => {
    setOverlayPermissionEnabled(enabled);
    await storage.set('overlay_permission_enabled', enabled.toString());
    
    if (enabled) {
      toast.success('تم تفعيل العرض فوق التطبيقات الأخرى');
      toast('تنبيه: قد يمنع هذا الإعداد الوصول للتطبيقات الأخرى', {
        icon: '⚠️',
        duration: 5000
      });
    } else {
      toast.success('تم إلغاء تفعيل العرض فوق التطبيقات الأخرى');
    }
  };

  // Check if overlay permission is actually granted by the system
  const checkSystemOverlayPermission = async () => {
    setIsCheckingOverlayPermission(true);
    try {
      // This is a mock check - in a real app, you'd check the actual system permission
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // For demonstration, we'll assume it matches our setting
      const hasSystemPermission = overlayPermissionEnabled;
      
      if (hasSystemPermission) {
        toast.success('إذن العرض فوق التطبيقات مُفعّل في النظام');
      } else {
        toast.error('إذن العرض فوق التطبيقات غير مُفعّل في النظام');
      }
      
      return hasSystemPermission;
    } catch (error) {
      toast.error('فشل في فحص إذن العرض فوق التطبيقات');
      return false;
    } finally {
      setIsCheckingOverlayPermission(false);
    }
  };

  const generateFcmToken = async () => {
    if (!Capacitor.isNativePlatform()) {
      toast.error('FCM متاح فقط على تطبيق الأندرويد/iOS');
      return;
    }
    setFcmStatus('loading');
    setFcmToken(null);
    setFcmSavedToDb(null);
    try {
      const permResult = await PushNotifications.requestPermissions();
      if (permResult.receive !== 'granted') {
        toast.error('يجب منح إذن الإشعارات أولاً');
        setFcmStatus('error');
        return;
      }
      await PushNotifications.register();
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('انتهت مهلة الانتظار — لم يصل FCM Token')), 15000);
        PushNotifications.addListener('registration', async (token) => {
          clearTimeout(timeout);
          const tokenValue = token.value;
          setFcmToken(tokenValue);
          await storage.set('push_token', tokenValue);
          try {
            const session = await storage.get('driver_session');
            if (session) {
              const u = JSON.parse(session);
              const driverId = u?.driver_profile?.id || u?.driver_id || u?.id;
              if (driverId) {
                const saved = await saveTokenToDb(tokenValue, driverId);
                setFcmSavedToDb(saved);
              } else {
                setFcmSavedToDb(false);
              }
            } else {
              setFcmSavedToDb(false);
            }
          } catch {
            setFcmSavedToDb(false);
          }
          setFcmStatus('success');
          resolve();
        });
        PushNotifications.addListener('registrationError', (err) => {
          clearTimeout(timeout);
          reject(new Error(err.error));
        });
      });
      toast.success('تم توليد FCM Token بنجاح');
    } catch (err: any) {
      setFcmStatus('error');
      toast.error(err?.message || 'فشل في توليد FCM Token');
    }
  };

  const copyFcmToken = () => {
    if (!fcmToken) return;
    navigator.clipboard.writeText(fcmToken)
      .then(() => toast.success('تم نسخ الـ Token'))
      .catch(() => toast.error('فشل النسخ'));
  };

  const handleLogout = () => {
    logout();
    toast.success('تم تسجيل الخروج بنجاح');
    navigate('/login');
  };

  const testExternalNotifications = async () => {
    setIsTestingExternal(true);
    try {
      // Test 1: Browser/System notification
      await showNotification(
        'اختبار الإشعار الخارجي',
        {
          body: 'هذا اختبار للإشعارات الخارجية - يجب أن تراه حتى لو كان التطبيق مُصغر',
          tag: 'external-test',
          requireInteraction: true,
          icon: '/vite.svg'
        },
        true // Play sound
      );

      // Test 2: Native overlay notification (Android)
      await showOrderNotification(
        'اختبار طلب جديد!',
        'هذا اختبار لإشعار الطلبات - يجب أن يظهر فوق التطبيقات الأخرى'
      );

      // Test 3: Audio notification test
      await testNotification();

      toast.success('تم إرسال جميع أنواع الإشعارات الخارجية للاختبار!');
      
      // Show instructions
      setTimeout(() => {
        toast('تحقق من شريط الإشعارات وتأكد من سماع الأصوات', {
          duration: 5000,
          icon: '🔔'
        });
      }, 1000);

    } catch (error) {
      console.error('Error testing external notifications:', error);
      toast.error('فشل في اختبار الإشعارات الخارجية');
    } finally {
      setIsTestingExternal(false);
    }
  };

  const handlePWAInstall = async () => {
    if (!pwaInstallPrompt) {
      toast.error('زر التثبيت غير متاح حالياً');
      return;
    }

    try {
      await pwaInstallPrompt.prompt();
      const { outcome } = await pwaInstallPrompt.userChoice;

      if (outcome === 'accepted') {
        toast.success('تم تثبيت التطبيق بنجاح!');
        setIsPWAInstalled(true);
        setPwaInstallPrompt(null);
      } else {
        toast('تم إلغاء التثبيت');
      }
    } catch (error) {
      console.error('Error installing PWA:', error);
      toast.error('فشل في تثبيت التطبيق');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-secondary-800 p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <SettingsIcon className="w-8 h-8" />
          <h1 className="text-3xl font-bold">الإعدادات</h1>
        </div>
        
        {/* Profile Summary */}
        <div className="bg-secondary-700/50 rounded-lg p-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary-100/20 rounded-full flex items-center justify-center">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.username}
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <UserIcon className="w-8 h-8 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold">{user?.name || user?.username}</h2>
              <p className="text-secondary-100 text-base">{user?.email}</p>
              {user?.phone && (
                <p className="text-secondary-200 text-base">{user.phone}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6 overflow-y-auto">
        {/* Account Section */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <button 
            onClick={() => setIsAccountSectionOpen(!isAccountSectionOpen)}
            className="w-full bg-gray-50 px-6 py-4 border-b border-gray-100 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <UserIcon className="w-6 h-6 text-red-600" />
              <h2 className="text-xl font-bold text-gray-900">معلومات الحساب</h2>
              <div className="mr-auto">
                {isAccountSectionOpen ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
              </div>
            </div>
          </button>
          
          {isAccountSectionOpen && (
            <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <UserIcon className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-600">اسم المستخدم</span>
                </div>
                <span className="font-medium text-gray-900">{user?.username}</span>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-600">البريد الإلكتروني</span>
                </div>
                <span className="font-medium text-gray-900">{user?.email}</span>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-600">رقم الهاتف</span>
                </div>
                <span className="font-medium text-gray-900">{user?.phone || 'غير متوفر'}</span>
              </div>

              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <UserIcon className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-600">الاسم الكامل</span>
                </div>
                <span className="font-medium text-gray-900">
                  {`${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'غير متوفر'}
                </span>
              </div>
            </div>
            </div>
          )}
        </div>

        {/* Notifications Section */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <Bell className="w-6 h-6 text-red-600" />
              <h2 className="text-xl font-bold text-gray-900">الإشعارات والأصوات</h2>
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Volume Control */}
            <div>
              <h3 className="text-base font-medium text-gray-900 mb-4">مستوى الصوت</h3>
              <VolumeControl showLabel={true} />
            </div>
            
            {/* Sound Tester */}
            <div className="border-t border-gray-100 pt-6">
              <SoundTester />
            </div>

            {/* Custom Sound */}
            <div className="border-t border-gray-100 pt-6">
              <h3 className="text-base font-medium text-gray-900 mb-4">الصوت المخصص</h3>
              <CustomSoundUploader />
            </div>

            {/* External Notifications Test */}
            <div className="border-t border-gray-100 pt-6">
              <h3 className="text-base font-medium text-gray-900 mb-4">اختبار الإشعارات الخارجية</h3>
              <p className="text-sm text-gray-600 mb-4">
                اختبر جميع أنواع الإشعارات التي ستصلك عند وصول طلبات جديدة
              </p>
              
              <button
                onClick={testExternalNotifications}
                disabled={isTestingExternal}
                className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
                  isTestingExternal
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-gradient-to-r from-secondary-700 to-secondary-800 text-white hover:from-secondary-800 hover:to-secondary-900 btn-hover-lift ripple'
                }`}
              >
                {isTestingExternal ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    جاري الاختبار...
                  </>
                ) : (
                  <>
                    <Bell className="w-5 h-5" />
                    اختبار الإشعارات الخارجية
                  </>
                )}
              </button>
              
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>سيتم اختبار:</strong><br/>
                  • إشعار في شريط النظام<br/>
                  • نافذة منبثقة فوق التطبيقات (أندرويد)<br/>
                  • أصوات التنبيه<br/>
                  • اهتزاز الجهاز
                </p>
              </div>
              
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-700">
                  <strong>نصيحة:</strong> صغّر التطبيق أو انتقل لتطبيق آخر لرؤية الإشعارات الخارجية بوضوح
                </p>
              </div>
            </div>

            {/* Overlay Permission Control */}
            <div className="border-t border-gray-100 pt-6">
              <h3 className="text-base font-medium text-gray-900 mb-4">العرض فوق التطبيقات الأخرى</h3>
              <p className="text-sm text-gray-600 mb-4">
                تحكم في إظهار إشعارات الطلبات فوق التطبيقات الأخرى
              </p>
              
              <div className="space-y-4">
                {/* Toggle Switch */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {overlayPermissionEnabled ? (
                      <Eye className="w-5 h-5 text-red-600" />
                    ) : (
                      <EyeOff className="w-5 h-5 text-gray-400" />
                    )}
                    <div>
                      <p className="font-medium text-gray-900">العرض فوق التطبيقات</p>
                      <p className="text-sm text-gray-500">
                        {overlayPermissionEnabled ? 'مُفعّل - ستظهر الإشعارات فوق التطبيقات' : 'مُعطّل - إشعارات عادية فقط'}
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => updateOverlayPermission(!overlayPermissionEnabled)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${
                      overlayPermissionEnabled ? 'bg-red-600' : 'bg-gray-200'
                    }`}
                    role="switch"
                    aria-checked={overlayPermissionEnabled}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        overlayPermissionEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* System Permission Check */}
                <div className="flex gap-3">
                  <button
                    onClick={checkSystemOverlayPermission}
                    disabled={isCheckingOverlayPermission}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-colors ${
                      isCheckingOverlayPermission
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isCheckingOverlayPermission ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        جاري الفحص...
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4" />
                        فحص إذن النظام
                      </>
                    )}
                  </button>
                </div>

                {/* Warning when enabled */}
                {overlayPermissionEnabled && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-yellow-800 mb-2">تحذير مهم:</p>
                        <ul className="text-sm text-yellow-700 space-y-1">
                          <li>• قد يمنع الوصول للتطبيقات الأخرى عند ظهور الإشعارات</li>
                          <li>• يُنصح بإلغاء التفعيل عند عدم الحاجة</li>
                          <li>• يمكن تفعيله فقط عند انتظار طلبات مهمة</li>
                          <li>• إذا واجهت مشاكل، قم بإلغاء التفعيل فوراً</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Instructions */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>كيفية الاستخدام:</strong><br/>
                    • <strong>مُفعّل:</strong> ستظهر إشعارات الطلبات فوق جميع التطبيقات<br/>
                    • <strong>مُعطّل:</strong> إشعارات عادية في شريط الإشعارات فقط<br/>
                    • يمكنك تغيير هذا الإعداد في أي وقت حسب الحاجة<br/>
                    • الإعداد محفوظ ويبقى كما اخترته عند إعادة فتح التطبيق
                  </p>
                </div>
              </div>
            </div>

            {/* FCM Token Generator */}
            <div className="border-t border-gray-100 pt-6">
              <h3 className="text-base font-medium text-gray-900 mb-1">إشعارات الطلبات (FCM)</h3>
              <p className="text-sm text-gray-500 mb-4">
                اضغط لتوليد وتحديث رمز الإشعارات حتى تصلك طلبات التوصيل فوراً
              </p>

              {!Capacitor.isNativePlatform() && (
                <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">هذه الميزة تعمل فقط على تطبيق Android/iOS</p>
                </div>
              )}

              <button
                onClick={generateFcmToken}
                disabled={fcmStatus === 'loading' || !Capacitor.isNativePlatform()}
                className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold transition-all duration-300 shadow-md ${
                  !Capacitor.isNativePlatform()
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : fcmStatus === 'loading'
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : fcmStatus === 'success'
                    ? 'bg-gradient-to-r from-green-500 to-green-600 text-white'
                    : fcmStatus === 'error'
                    ? 'bg-gradient-to-r from-red-500 to-red-600 text-white'
                    : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 active:scale-95'
                }`}
              >
                {fcmStatus === 'loading' ? (
                  <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />جاري توليد الـ Token...</>
                ) : fcmStatus === 'success' ? (
                  <><CheckCircle className="w-5 h-5" />تم توليد الـ Token بنجاح</>
                ) : fcmStatus === 'error' ? (
                  <><XCircle className="w-5 h-5" />فشل — اضغط للمحاولة مجدداً</>
                ) : (
                  <><RefreshCw className="w-5 h-5" />توليد / تحديث رمز الإشعارات</>
                )}
              </button>

              {fcmStatus === 'success' && fcmToken && (
                <div className="mt-4 space-y-3">
                  <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                    fcmSavedToDb === true ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}>
                    {fcmSavedToDb === true
                      ? <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      : <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />}
                    <p className={`text-sm font-medium ${fcmSavedToDb === true ? 'text-green-800' : 'text-red-800'}`}>
                      {fcmSavedToDb === true
                        ? 'تم حفظ الرمز — ستصلك الإشعارات فوراً'
                        : 'فشل حفظ الرمز في قاعدة البيانات'}
                    </p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">FCM Token</span>
                      <button onClick={copyFcmToken} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                        <Copy className="w-3.5 h-3.5" />نسخ
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 font-mono break-all leading-relaxed">
                      {fcmToken.substring(0, 60)}...
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Permissions */}
            <div className="border-t border-gray-100 pt-6">
              <h3 className="text-base font-medium text-gray-900 mb-4">الأذونات والخصوصية</h3>
              <PermissionChecker />

              {/* Reset Permission Welcome */}
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700 mb-3">
                  <strong>إعادة ضبط الأذونات:</strong><br/>
                  إذا لم تظهر شاشة طلب الأذونات أو تخطيتها سابقاً، يمكنك إعادة إظهارها
                </p>
                <button
                  onClick={async () => {
                    await storage.set('permissions_welcome_shown', 'false');
                    toast.success('تم إعادة الضبط! أعد فتح التطبيق لعرض شاشة الأذونات');
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
                >
                  <Shield className="w-4 h-4" />
                  إعادة عرض شاشة الأذونات
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* PWA Install Section */}
        {!Capacitor.isNativePlatform() && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b border-blue-200">
              <div className="flex items-center gap-3">
                <Smartphone className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-bold text-gray-900">تثبيت التطبيق</h2>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {isPWAInstalled ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <Download className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-green-900 mb-1">التطبيق مثبت</h3>
                      <p className="text-sm text-green-700">
                        التطبيق مثبت على جهازك ويعمل بوضع PWA
                      </p>
                    </div>
                  </div>
                </div>
              ) : pwaInstallPrompt ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-bold text-blue-900 mb-2">ثبت التطبيق على جهازك</h3>
                    <p className="text-sm text-blue-700 mb-4">
                      احصل على تجربة أفضل مع:
                    </p>
                    <ul className="text-sm text-blue-700 space-y-2 mb-4">
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600">•</span>
                        <span>إشعارات فورية للطلبات الجديدة</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600">•</span>
                        <span>العمل بدون إنترنت</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600">•</span>
                        <span>فتح سريع من الشاشة الرئيسية</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600">•</span>
                        <span>لا يحتاج مساحة تخزين كبيرة</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    onClick={handlePWAInstall}
                    className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                  >
                    <Download className="w-6 h-6" />
                    <span className="text-lg font-bold">ثبت التطبيق الآن</span>
                  </button>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <Info className="w-5 h-5 text-gray-600" />
                    <div>
                      <h3 className="font-medium text-gray-900 mb-1">تثبيت PWA غير متاح</h3>
                      <p className="text-sm text-gray-600">
                        قد يكون التطبيق مثبتاً بالفعل أو متصفحك لا يدعم التثبيت
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-100">
                <h4 className="font-medium text-gray-900 mb-2">كيفية التثبيت يدوياً:</h4>
                <div className="space-y-3 text-sm text-gray-600">
                  <div>
                    <p className="font-medium text-gray-900 mb-1">على Chrome (أندرويد):</p>
                    <p>القائمة ← "إضافة إلى الشاشة الرئيسية"</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 mb-1">على Safari (iPhone):</p>
                    <p>زر المشاركة ← "إضافة إلى الشاشة الرئيسية"</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 mb-1">على الكمبيوتر:</p>
                    <p>اضغط على أيقونة التثبيت في شريط العنوان</p>
                  </div>
                </div>
              </div>

              {/* PWA Diagnostics */}
              <PWADiagnostics />
            </div>
          </div>
        )}

        {/* App Info Section */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <Info className="w-6 h-6 text-red-600" />
              <h2 className="text-xl font-bold text-gray-900">حول التطبيق</h2>
            </div>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <span className="text-gray-600">إصدار التطبيق</span>
              <span className="font-medium text-gray-900">1.0.0</span>
            </div>
            
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <span className="text-gray-600">اسم التطبيق</span>
              <span className="font-medium text-gray-900">الو جيتك</span>
            </div>
            
            <div className="flex items-center justify-between py-3">
              <span className="text-gray-600">الدعم الفني</span>
              <span className="font-medium text-gray-900">متوفر 24/7</span>
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-red-50 to-red-100 text-red-600 py-4 rounded-xl hover:from-red-100 hover:to-red-200 transition-all duration-300 transform hover:scale-105 border border-red-200 shadow-md hover:shadow-lg btn-hover-lift ripple"
          >
            <LogOut className="w-6 h-6" />
            <span className="text-lg font-medium">تسجيل الخروج</span>
          </button>
          
          <p className="text-center text-sm text-gray-500 mt-3">
            سيتم إيقاف جميع الخدمات وحذف بيانات الجلسة
          </p>
        </div>
      </div>
    </div>
  );
}