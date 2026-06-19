import React, { useRef, useState } from 'react';
import { Upload, X, Play, Volume2, Trash2, FileAudio } from 'lucide-react';
import { useCustomSound } from '../hooks/useCustomSound';
import toast from 'react-hot-toast';

export default function CustomSoundUploader() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const {
    customSoundSettings,
    isLoading,
    uploadCustomSound,
    removeCustomSound,
    updateVolume,
    testCustomSound
  } = useCustomSound();

  const handleFileSelect = async (file: File) => {
    if (file) {
      await uploadCustomSound(file);
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('audio/')) {
        handleFileSelect(file);
      } else {
        toast.error('يرجى اختيار ملف صوتي صحيح');
      }
    }
  };

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(event.target.value);
    updateVolume(volume);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">الصوت المخصص للطلبات</h3>
        {customSoundSettings.hasCustomSound && (
          <button
            onClick={testCustomSound}
            className="flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors text-sm"
          >
            <Play className="w-4 h-4" />
            تشغيل
          </button>
        )}
      </div>

      {!customSoundSettings.hasCustomSound ? (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
            isDragOver
              ? 'border-red-400 bg-red-50'
              : 'border-gray-300 hover:border-red-400 hover:bg-red-50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileInputChange}
            className="hidden"
            disabled={isLoading}
          />
          
          {isLoading ? (
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-red-600 font-medium">جاري رفع الملف...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Upload className="w-12 h-12 text-gray-400 mb-3" />
              <p className="text-lg font-medium text-gray-700 mb-2">
                ارفع ملف صوتي مخصص
              </p>
              <p className="text-sm text-gray-500 mb-4">
                اسحب وأفلت ملف MP3 أو اضغط للاختيار
              </p>
              <div className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm">
                الصيغ المدعومة: MP3, WAV, OGG
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <FileAudio className="w-6 h-6 text-red-600" />
              <div>
                <p className="font-medium text-red-800">
                  {customSoundSettings.soundName}
                </p>
                <p className="text-sm text-red-600">
                  صوت مخصص للطلبات
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={testCustomSound}
                className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-secondary-600 to-secondary-700 text-white rounded-xl hover:from-secondary-700 hover:to-secondary-800 transition-all duration-300 transform hover:scale-105 text-sm shadow-md"
              >
                <Play className="w-4 h-4" />
                تشغيل
              </button>
              
              <button
                onClick={removeCustomSound}
                className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-red-100 to-red-200 text-red-600 rounded-xl hover:from-red-200 hover:to-red-300 transition-all duration-300 transform hover:scale-105 text-sm shadow-md"
              >
                <Trash2 className="w-4 h-4" />
                حذف
              </button>
            </div>
          </div>

          {/* Volume Control */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-red-700">
                مستوى الصوت
              </label>
              <span className="text-sm text-red-600">
                {Math.round(customSoundSettings.volume * 100)}%
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <Volume2 className="w-4 h-4 text-red-600" />
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.1"
                value={customSoundSettings.volume}
                onChange={handleVolumeChange}
                className="flex-1 h-2 bg-red-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <span className="text-sm text-red-600 min-w-[40px]">
                {customSoundSettings.volume > 1 ? 'مضخم' : 'عادي'}
              </span>
            </div>
          </div>

          {/* Upload new sound button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="w-full mt-4 flex items-center justify-center gap-2 bg-gradient-to-r from-white to-gray-50 text-secondary-600 border border-secondary-300 py-3 rounded-xl hover:from-secondary-50 hover:to-secondary-100 transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg btn-hover-lift"
          >
            <Upload className="w-4 h-4" />
            رفع صوت جديد
          </button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileInputChange}
            className="hidden"
            disabled={isLoading}
          />
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 mb-2">تعليمات:</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• اختر ملف صوتي بصيغة MP3 عادية (يُنصح بها بشدة)</li>
          <li>• إذا واجهت مشاكل، جرب تحويل الملف إلى MP3 بترميز مختلف</li>
          <li>• الحد الأقصى لحجم الملف: 5 ميجابايت</li>
          <li>• يُنصح بملفات قصيرة (3-10 ثوانٍ) للحصول على أفضل تجربة</li>
          <li>• سيتم استخدام هذا الصوت لجميع الطلبات الجديدة</li>
          <li>• يمكنك ضبط مستوى الصوت حتى 200% للتضخيم</li>
          <li>• في حالة فشل التحميل، تأكد من سلامة الملف الصوتي</li>
        </ul>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #ca8a04;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #ca8a04;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
      `}</style>
    </div>
  );
}