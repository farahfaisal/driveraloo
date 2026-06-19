/**
 * Text-to-Speech Utility
 * تحويل النص إلى كلام منطوق باستخدام Web Speech API
 */

export interface TTSOptions {
  volume?: number;    // 0-1
  rate?: number;      // 0.1-10 (معدل السرعة)
  pitch?: number;     // 0-2 (طبقة الصوت)
  lang?: string;      // لغة النطق
  voice?: string;     // اسم الصوت المطلوب
}

/**
 * تشغيل صوت ناطق للنص المطلوب
 */
export async function speak(text: string, options: TTSOptions = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    // التحقق من دعم المتصفح
    if (!('speechSynthesis' in window)) {
reject(new Error('TTS not supported'));
      return;
    }

    const {
      volume = 1.0,
      rate = 1.0,
      pitch = 1.0,
      lang = 'ar-SA',  // اللغة العربية السعودية
      voice = null
    } = options;

    // إنشاء utterance
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = volume;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.lang = lang;

    // محاولة اختيار صوت عربي
    const voices = window.speechSynthesis.getVoices();

    if (voices.length > 0) {
      // البحث عن صوت عربي
      const arabicVoice = voices.find(v =>
        v.lang.startsWith('ar') ||
        v.name.toLowerCase().includes('arabic')
      );

      // استخدام الصوت المحدد أو الصوت العربي أو الافتراضي
      if (voice) {
        const selectedVoice = voices.find(v => v.name === voice);
        if (selectedVoice) utterance.voice = selectedVoice;
      } else if (arabicVoice) {
        utterance.voice = arabicVoice;
      }
    }

    // معالجة الأحداث
    utterance.onend = () => {
      resolve();
    };

    utterance.onerror = (event) => {
      console.error('❌ خطأ في النطق:', event.error);
      reject(new Error(`TTS error: ${event.error}`));
    };

    // إلغاء أي نطق سابق وبدء النطق الجديد
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}

/**
 * إيقاف النطق الحالي
 */
export function stopSpeaking(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * التحقق من جاهزية النطق
 */
export function isSpeaking(): boolean {
  if ('speechSynthesis' in window) {
    return window.speechSynthesis.speaking;
  }
  return false;
}

/**
 * الحصول على قائمة الأصوات المتاحة
 */
export async function getAvailableVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();

    if (voices.length > 0) {
      resolve(voices);
    } else {
      // بعض المتصفحات تحتاج إلى انتظار تحميل الأصوات
      window.speechSynthesis.onvoiceschanged = () => {
        resolve(window.speechSynthesis.getVoices());
      };
    }
  });
}

/**
 * الحصول على الأصوات العربية المتاحة
 */
export async function getArabicVoices(): Promise<SpeechSynthesisVoice[]> {
  const voices = await getAvailableVoices();
  return voices.filter(v =>
    v.lang.startsWith('ar') ||
    v.name.toLowerCase().includes('arabic')
  );
}

/**
 * نطق رسالة رحلة مخصصة
 */
export async function speakAssignedTrip(orderNumber?: string): Promise<void> {
  const message = orderNumber
    ? `لديك رحلة مخصصة. رقم الطلب ${orderNumber}`
    : 'لديك رحلة مخصصة';

  try {
    await speak(message, {
      volume: 1.0,
      rate: 0.9,   // سرعة أبطأ قليلاً للوضوح
      pitch: 1.1,  // صوت أعلى قليلاً للانتباه
      lang: 'ar-SA'
    });
  } catch (error) {
    console.error('فشل نطق رسالة الرحلة المخصصة:', error);
  }
}

/**
 * نطق رسالة طلب جديد
 */
export async function speakNewOrder(orderNumber?: string): Promise<void> {
  const message = orderNumber
    ? `طلب جديد. رقم الطلب ${orderNumber}`
    : 'طلب جديد';

  try {
    await speak(message, {
      volume: 1.0,
      rate: 0.9,
      pitch: 1.1,
      lang: 'ar-SA'
    });
  } catch (error) {
    console.error('فشل نطق رسالة الطلب الجديد:', error);
  }
}
