import React, { useState } from 'react';
import { Volume2, VolumeX, Volume1 } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import toast from 'react-hot-toast';

interface VolumeControlProps {
  className?: string;
  showLabel?: boolean;
}

export default function VolumeControl({ className = '', showLabel = true }: VolumeControlProps) {
  const { volumeLevel, updateVolumeLevel, testNotification } = useNotifications();
  const [showDropdown, setShowDropdown] = useState(false);

  const volumeConfig = {
    low: { 
      label: 'منخفض', 
      icon: Volume1, 
      color: 'text-gray-500',
      description: 'للبيئات الهادئة'
    },
    medium: { 
      label: 'متوسط', 
      icon: Volume2, 
      color: 'text-blue-500',
      description: 'للاستخدام العادي'
    },
    high: { 
      label: 'عالي', 
      icon: Volume2, 
      color: 'text-yellow-500',
      description: 'للبيئات الصاخبة'
    },
    max: { 
      label: 'أقصى', 
      icon: Volume2, 
      color: 'text-red-500',
      description: 'أعلى مستوى ممكن'
    }
  };

  const currentConfig = volumeConfig[volumeLevel];
  const CurrentIcon = currentConfig.icon;

  const handleVolumeChange = async (level: keyof typeof volumeConfig) => {
    updateVolumeLevel(level);
    setShowDropdown(false);
    
    // Test the new volume level
    setTimeout(async () => {
      await testNotification();
    }, 100);
    
    toast.success(`تم تعيين مستوى الصوت إلى: ${volumeConfig[level].label}`);
  };

  if (!showLabel) {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-3 py-2 bg-white text-yellow-600 rounded-lg hover:bg-yellow-50 transition-colors border border-yellow-200"
        >
          <CurrentIcon className={`w-4 h-4 ${currentConfig.color}`} />
        </button>

        {showDropdown && (
          <>
            <div 
              className="fixed inset-0 z-40"
              onClick={() => setShowDropdown(false)}
            />
            
            <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50 min-w-[200px]">
              <p className="text-gray-700 font-medium mb-3 text-sm">مستوى الصوت</p>
              
              <div className="space-y-2">
                {Object.entries(volumeConfig).map(([level, config]) => {
                  const IconComponent = config.icon;
                  return (
                    <button
                      key={level}
                      onClick={() => handleVolumeChange(level as keyof typeof volumeConfig)}
                      className={`w-full text-right px-3 py-2 rounded text-sm transition-colors ${
                        volumeLevel === level
                          ? 'bg-yellow-100 text-yellow-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <IconComponent className={`w-4 h-4 ml-2 ${config.color}`} />
                          <span>{config.label}</span>
                        </div>
                        {volumeLevel === level && (
                          <div className="w-2 h-2 bg-yellow-600 rounded-full"></div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              
              <div className="mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={async () => {
                    await testNotification();
                    setShowDropdown(false);
                  }}
                  className="w-full bg-yellow-600 text-white py-2 rounded text-sm hover:bg-yellow-700 transition-colors"
                >
                  اختبار الصوت
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium mb-3">مستوى صوت الطلبات</h3>
        <div className="space-y-3">
          {Object.entries(volumeConfig).map(([level, config]) => {
            const IconComponent = config.icon;
            return (
              <button
                key={level}
                onClick={() => handleVolumeChange(level as keyof typeof volumeConfig)}
                className={`w-full text-right p-3 rounded-lg border transition-colors ${
                  volumeLevel === level
                    ? 'border-yellow-300 bg-yellow-50 text-yellow-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <IconComponent className={`w-5 h-5 ml-2 ${
                      volumeLevel === level ? 'text-yellow-600' : 'text-gray-400'
                    }`} />
                    <div>
                      <p className="font-medium">{config.label}</p>
                      <p className="text-sm opacity-75">{config.description}</p>
                    </div>
                  </div>
                  {volumeLevel === level && (
                    <div className="w-3 h-3 bg-yellow-600 rounded-full"></div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        
        <div className="mt-4 flex gap-3">
          <button
            onClick={async () => {
              await testNotification();
              toast.success('تم تشغيل اختبار الصوت');
            }}
            className="flex-1 btn-primary btn-hover-lift ripple flex items-center justify-center"
          >
            <Volume2 className="w-4 h-4 ml-2" />
            اختبار الصوت
          </button>
        </div>
        
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>نصائح:</strong><br/>
            • استخدم "أقصى صوت\" في البيئات الصاخبة<br/>
            • "عالي\" مناسب للاستخدام العادي<br/>
            • "متوسط\" للبيئات الهادئة<br/>
            • "منخفض" للاستخدام الليلي
          </p>
        </div>
      </div>
    </div>
  );
}