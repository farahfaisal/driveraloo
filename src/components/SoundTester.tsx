import React, { useState } from 'react';
import { Volume2, Bell, CheckCircle, AlertTriangle, XCircle, Music } from 'lucide-react';
import { playGeneratedSound } from '../utils/soundGenerator';
import toast from 'react-hot-toast';

interface SoundOption {
  type: 'notification' | 'order' | 'success' | 'warning' | 'error';
  label: string;
  description: string;
  icon: React.FC<{ className?: string }>;
  color: string;
}

export default function SoundTester() {
  const [playingSound, setPlayingSound] = useState<string | null>(null);

  const soundOptions: SoundOption[] = [
    {
      type: 'notification',
      label: 'تنبيه عادي',
      description: 'صوت جرس ناعم للإشعارات العامة',
      icon: Bell,
      color: 'blue'
    },
    {
      type: 'order',
      label: 'طلب جديد',
      description: 'صوت ثلاثي عاجل للطلبات الجديدة',
      icon: Music,
      color: 'yellow'
    },
    {
      type: 'success',
      label: 'نجاح',
      description: 'نغمات صاعدة للعمليات الناجحة',
      icon: CheckCircle,
      color: 'green'
    },
    {
      type: 'warning',
      label: 'تحذير',
      description: 'تنبيه ثنائي للتحذيرات',
      icon: AlertTriangle,
      color: 'orange'
    },
    {
      type: 'error',
      label: 'خطأ',
      description: 'صوت هابط للأخطاء',
      icon: XCircle,
      color: 'red'
    }
  ];

  const colorClasses = {
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-700',
      icon: 'text-blue-600',
      button: 'bg-blue-600 hover:bg-blue-700'
    },
    yellow: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-700',
      icon: 'text-yellow-600',
      button: 'bg-yellow-600 hover:bg-yellow-700'
    },
    green: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-700',
      icon: 'text-green-600',
      button: 'bg-green-600 hover:bg-green-700'
    },
    orange: {
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      text: 'text-orange-700',
      icon: 'text-orange-600',
      button: 'bg-orange-600 hover:bg-orange-700'
    },
    red: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-700',
      icon: 'text-red-600',
      button: 'bg-red-600 hover:bg-red-700'
    }
  };

  const handlePlaySound = async (soundOption: SoundOption) => {
    try {
      setPlayingSound(soundOption.type);

      await playGeneratedSound({
        type: soundOption.type,
        volume: 0.8,
        duration: soundOption.type === 'order' ? 0.8 : 0.6
      });

      toast.success(`تم تشغيل: ${soundOption.label}`);
    } catch (error) {
      console.error('Error playing sound:', error);
      toast.error('فشل في تشغيل الصوت');
    } finally {
      setTimeout(() => setPlayingSound(null), 1000);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium mb-2">اختبار الأصوات</h3>
        <p className="text-sm text-gray-600 mb-4">
          اختبر الأصوات المختلفة المولّدة تلقائياً
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {soundOptions.map((option) => {
          const Icon = option.icon;
          const colors = colorClasses[option.color as keyof typeof colorClasses];
          const isPlaying = playingSound === option.type;

          return (
            <div
              key={option.type}
              className={`p-4 rounded-lg border-2 ${colors.bg} ${colors.border} transition-all ${
                isPlaying ? 'scale-105 shadow-lg' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className={`p-2 bg-white rounded-lg ${colors.border} border`}>
                    <Icon className={`w-5 h-5 ${colors.icon}`} />
                  </div>
                  <div className="flex-1">
                    <h4 className={`font-medium ${colors.text}`}>{option.label}</h4>
                    <p className="text-xs text-gray-600">{option.description}</p>
                  </div>
                </div>

                <button
                  onClick={() => handlePlaySound(option)}
                  disabled={isPlaying}
                  className={`px-4 py-2 ${colors.button} text-white rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Volume2 className={`w-4 h-4 ${isPlaying ? 'animate-pulse' : ''}`} />
                  {isPlaying ? 'يُشغّل...' : 'تشغيل'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Music className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-blue-900 mb-1">أصوات مولّدة محلياً</h4>
            <p className="text-sm text-blue-700">
              جميع الأصوات يتم توليدها باستخدام Web Audio API ولا تحتاج لملفات خارجية.
              هذا يضمن عمل التنبيهات دائماً حتى بدون اتصال بالإنترنت.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
