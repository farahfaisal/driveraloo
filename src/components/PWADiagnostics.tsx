import { useState, useEffect } from 'react';
import { Info, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface DiagnosticItem {
  label: string;
  status: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

export default function PWADiagnostics() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const runDiagnostics = async () => {
      const results: DiagnosticItem[] = [];

      // Check if PWA is installed
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                          window.matchMedia('(display-mode: fullscreen)').matches ||
                          (window.navigator as any).standalone === true;

      results.push({
        label: 'حالة التثبيت',
        status: isStandalone ? 'success' : 'info',
        message: isStandalone ? 'التطبيق مثبت ويعمل بوضع PWA' : 'التطبيق يعمل في المتصفح'
      });

      // Check beforeinstallprompt support
      const supportsBeforeInstall = 'onbeforeinstallprompt' in window;
      results.push({
        label: 'دعم التثبيت التلقائي',
        status: supportsBeforeInstall ? 'success' : 'warning',
        message: supportsBeforeInstall
          ? 'المتصفح يدعم beforeinstallprompt'
          : 'المتصفح لا يدعم beforeinstallprompt (استخدم Chrome أو Edge)'
      });

      // Check Service Worker
      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          if (registrations.length > 0) {
            const sw = registrations[0];
            results.push({
              label: 'Service Worker',
              status: 'success',
              message: `مسجل ونشط (${sw.active?.state || 'unknown'})`
            });
          } else {
            results.push({
              label: 'Service Worker',
              status: 'warning',
              message: 'لم يتم تسجيله بعد - أعد تحميل الصفحة'
            });
          }
        } catch (error) {
          results.push({
            label: 'Service Worker',
            status: 'error',
            message: 'خطأ في التحقق من Service Worker'
          });
        }
      } else {
        results.push({
          label: 'Service Worker',
          status: 'error',
          message: 'غير مدعوم في هذا المتصفح'
        });
      }

      // Check HTTPS
      const isSecure = window.location.protocol === 'https:' ||
                      window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1';
      results.push({
        label: 'اتصال آمن (HTTPS)',
        status: isSecure ? 'success' : 'error',
        message: isSecure ? 'الاتصال آمن' : 'PWA يتطلب HTTPS'
      });

      // Check if install prompt was dismissed
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (dismissed && !isStandalone) {
        const dismissedDate = new Date(dismissed);
        const now = new Date();
        const daysSince = Math.floor((now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24));

        results.push({
          label: 'حالة زر التثبيت',
          status: daysSince < 3 ? 'warning' : 'info',
          message: daysSince < 3
            ? `تم رفض التثبيت قبل ${daysSince} يوم - سيظهر الزر بعد ${3 - daysSince} يوم`
            : 'جاهز للظهور'
        });
      }

      // Check browser
      const userAgent = navigator.userAgent.toLowerCase();
      let browserName = 'غير معروف';
      let browserSupport: 'success' | 'warning' | 'error' = 'info';
      let browserMessage = '';

      if (userAgent.includes('chrome') && !userAgent.includes('edge')) {
        browserName = 'Chrome';
        browserSupport = 'success';
        browserMessage = 'متصفح مدعوم بالكامل';
      } else if (userAgent.includes('edg')) {
        browserName = 'Edge';
        browserSupport = 'success';
        browserMessage = 'متصفح مدعوم بالكامل';
      } else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
        browserName = 'Safari';
        browserSupport = 'warning';
        browserMessage = 'دعم محدود - استخدم Chrome للحصول على أفضل تجربة';
      } else if (userAgent.includes('firefox')) {
        browserName = 'Firefox';
        browserSupport = 'error';
        browserMessage = 'غير مدعوم - استخدم Chrome أو Edge';
      }

      results.push({
        label: 'المتصفح',
        status: browserSupport,
        message: `${browserName} - ${browserMessage}`
      });

      setDiagnostics(results);
    };

    runDiagnostics();
  }, []);

  const getIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      default:
        return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  const clearDismissed = () => {
    localStorage.removeItem('pwa-install-dismissed');
    window.location.reload();
  };

  return (
    <div className="border-t border-gray-100 pt-6">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="w-5 h-5 text-blue-600" />
          <span className="font-medium text-gray-900">تشخيص PWA</span>
        </div>
        <span className="text-sm text-gray-500">
          {isExpanded ? 'إخفاء' : 'عرض التفاصيل'}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-3">
          {diagnostics.map((item, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg border ${getStatusColor(item.status)}`}
            >
              <div className="flex items-start gap-3">
                {getIcon(item.status)}
                <div className="flex-1">
                  <p className="font-medium text-sm mb-1">{item.label}</p>
                  <p className="text-xs opacity-90">{item.message}</p>
                </div>
              </div>
            </div>
          ))}

          {localStorage.getItem('pwa-install-dismissed') && (
            <button
              onClick={clearDismissed}
              className="w-full mt-4 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              إعادة تعيين حالة التثبيت وإعادة تحميل
            </button>
          )}

          <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-xs text-gray-600">
              <strong>نصيحة:</strong> للحصول على أفضل تجربة PWA، استخدم Chrome أو Edge على Desktop.
              إذا كان التطبيق غير مثبت وتريد تثبيته، يمكنك استخدام الطريقة اليدوية:
              <br />
              • <strong>Chrome/Edge:</strong> ابحث عن أيقونة التثبيت في شريط العنوان
              <br />
              • <strong>Safari:</strong> اختر Share → Add to Dock
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
