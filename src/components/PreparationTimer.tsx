import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface PreparationTimerProps {
  preparationStart?: string;
  preparationStartTime?: string;
  preparationEnd?: string;
  preparationTime?: number;
  actualPreparationTime?: number;
}

export default function PreparationTimer({
  preparationStartTime,
  preparationTime,
  actualPreparationTime
}: PreparationTimerProps) {
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  // preparation_time (minutes) × 60 - elapsed seconds since preparation_start_time
  const totalSeconds = (actualPreparationTime ?? preparationTime ?? 0) * 60;
  const vendorHasSetTime = totalSeconds > 0 && !!preparationStartTime;

  useEffect(() => {
    if (!vendorHasSetTime) {
      setRemainingSeconds(null);
      return;
    }

    const startMs = new Date(preparationStartTime!).getTime();

    const tick = () => {
      const elapsed = Math.floor((Date.now() - startMs) / 1000);
      setRemainingSeconds(totalSeconds - elapsed);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [preparationStartTime, totalSeconds, vendorHasSetTime]);

  if (!vendorHasSetTime) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300 my-2 shadow-sm">
        <div className="bg-amber-200 p-1.5 rounded-lg">
          <Clock className="w-4 h-4 text-amber-700" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-amber-900">
            البائع لم يحدد وقت التحضير بعد
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            انتظر حتى يقوم البائع بتحديد الوقت المتوقع
          </p>
        </div>
      </div>
    );
  }

  const isOverdue = remainingSeconds !== null && remainingSeconds <= 0;

  if (isOverdue) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 my-2 shadow-sm">
        <div className="bg-green-200 p-1.5 rounded-lg">
          <Clock className="w-4 h-4 text-green-700 animate-pulse" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-green-900">
            الطلب جاهز للاستلام
          </p>
          <p className="text-xs text-green-700 mt-0.5">
            يمكنك التوجه لاستلام الطلب الآن
          </p>
        </div>
      </div>
    );
  }

  const displayMinutes = remainingSeconds !== null ? Math.floor(remainingSeconds / 60) : 0;
  const displaySeconds = remainingSeconds !== null ? remainingSeconds % 60 : 0;
  const timeLabel = remainingSeconds !== null
    ? `${displayMinutes}:${displaySeconds.toString().padStart(2, '0')}`
    : null;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-blue-50 text-blue-700">
      <Clock className="w-3 h-3" />
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium">وقت التحضير المتبقي</span>
        {timeLabel && (
          <span className="text-sm font-bold text-blue-700">{timeLabel}</span>
        )}
      </div>
    </div>
  );
}
