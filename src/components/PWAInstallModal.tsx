import { useState, useEffect } from 'react';
import { X, Download, Smartphone, Monitor, CheckCircle } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallModal() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        window.matchMedia('(display-mode: fullscreen)').matches ||
                        (window.navigator as any).standalone === true;

    if (isStandalone) {
      return;
    }

    // Check if user dismissed recently (within 3 days)
    const dismissedTime = localStorage.getItem('pwa-install-dismissed');
    if (dismissedTime) {
      const daysSinceDismissed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 3) {
        return;
      }
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Show modal after 3 seconds
      setTimeout(() => {
        setShowModal(true);
      }, 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    setIsInstalling(true);

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        setIsInstalled(true);
        localStorage.removeItem('pwa-install-dismissed');

        // Close modal after showing success
        setTimeout(() => {
          setShowModal(false);
          setIsInstalling(false);
        }, 2000);
      } else {
        handleDismiss();
      }

      setDeferredPrompt(null);
    } catch (error) {
      console.error('PWA: خطأ في التثبيت:', error);
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    setShowModal(false);
  };

  const handleLater = () => {
    // Don't save dismissed time, just close
    setShowModal(false);
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-slideUp">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 left-4 z-10 p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-gray-100"
          aria-label="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with gradient */}
        <div className="relative bg-gradient-to-br from-blue-600 to-blue-700 text-white p-8 pb-12">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 bg-white rounded-2xl shadow-lg flex items-center justify-center">
              <img src="/app-icon-192.png" alt="الو جيتك" className="w-16 h-16 rounded-xl" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center mb-2">
            ثبت تطبيق الو جيتك
          </h2>
          <p className="text-blue-100 text-center text-sm">
            احصل على تجربة أفضل وأسرع
          </p>
        </div>

        {/* Content */}
        <div className="p-6 -mt-6">
          {isInstalled ? (
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-lg font-semibold text-gray-900 mb-2">
                تم التثبيت بنجاح!
              </p>
              <p className="text-sm text-gray-600">
                يمكنك الآن الوصول للتطبيق من سطح المكتب
              </p>
            </div>
          ) : (
            <>
              <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl p-4 mb-6 border border-blue-100">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                      <Smartphone className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">فتح سريع</h4>
                      <p className="text-sm text-gray-600">
                        افتح التطبيق مباشرة من الشاشة الرئيسية
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                      <Monitor className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">تجربة محسّنة</h4>
                      <p className="text-sm text-gray-600">
                        يعمل مثل التطبيق العادي بدون شريط المتصفح
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">إشعارات فورية</h4>
                      <p className="text-sm text-gray-600">
                        استلم إشعارات الطلبات الجديدة مباشرة
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="space-y-2">
                <button
                  onClick={handleInstall}
                  disabled={isInstalling || !deferredPrompt}
                  className={`w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-semibold text-white shadow-lg shadow-blue-600/30 transition-all ${
                    isInstalling || !deferredPrompt
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 hover:shadow-xl hover:shadow-blue-600/40 active:scale-95'
                  }`}
                >
                  {isInstalling ? (
                    <>
                      <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>جاري التثبيت...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      <span>ثبت التطبيق الآن</span>
                    </>
                  )}
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={handleLater}
                    className="flex-1 py-3 px-4 rounded-xl font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    لاحقاً
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="flex-1 py-3 px-4 rounded-xl font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    لا، شكراً
                  </button>
                </div>
              </div>

              <p className="text-xs text-center text-gray-500 mt-4">
                لن يستغرق سوى ثانية واحدة
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
