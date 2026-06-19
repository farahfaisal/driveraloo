# دليل تثبيت PWA على الديسكتوب

## لماذا لا يظهر زر التثبيت؟

### الأسباب الشائعة:

1. **التطبيق مثبت بالفعل**
   - إذا كان التطبيق مثبتاً مسبقاً، لن يظهر زر التثبيت
   - للتحقق: افتح Console واكتب `window.matchMedia('(display-mode: standalone)').matches`
   - إذا كانت النتيجة `true`، التطبيق مثبت بالفعل

2. **المتصفح لا يدعم beforeinstallprompt**
   - Safari على macOS لا يدعم `beforeinstallprompt`
   - Firefox Desktop لا يدعم PWA بشكل كامل
   - **الحل**: استخدم Chrome أو Edge على Windows/Mac/Linux

3. **HTTPS مطلوب**
   - PWA يتطلب HTTPS (أو localhost للتطوير)
   - تأكد من أن الموقع يعمل على HTTPS

4. **شروط PWA غير مستوفاة**
   - يجب أن يكون هناك Service Worker مسجل
   - يجب أن يكون هناك Web Manifest صحيح
   - يجب أن تكون هناك أيقونات بأحجام مناسبة

5. **تم رفض التثبيت خلال آخر 3 أيام**
   - إذا ضغطت "ليس الآن"، لن يظهر الزر لمدة 3 أيام
   - **الحل**: امسح localStorage

## كيفية التحقق من جاهزية PWA

افتح Console في المتصفح وتحقق من:

```javascript
// 1. تحقق من Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    console.log('Service Workers:', registrations);
  });
}

// 2. تحقق من beforeinstallprompt
console.log('يدعم beforeinstallprompt:', 'onbeforeinstallprompt' in window);

// 3. تحقق من حالة التثبيت
console.log('مثبت:', window.matchMedia('(display-mode: standalone)').matches);

// 4. امسح localStorage للسماح بظهور الزر مجدداً
localStorage.removeItem('pwa-install-dismissed');
```

## كيفية التثبيت يدوياً

### على Chrome/Edge (Windows/Mac/Linux):

1. **الطريقة الأولى: من شريط العنوان**
   - ابحث عن أيقونة "تثبيت" (➕) في شريط العنوان
   - اضغط عليها واتبع التعليمات

2. **الطريقة الثانية: من القائمة**
   - اضغط على القائمة (⋮)
   - اختر "تثبيت [اسم التطبيق]..." أو "Install app"
   - اضغط "تثبيت"

### على Safari (macOS):

⚠️ **تنبيه**: Safari لا يدعم PWA بنفس طريقة Chrome
- يمكنك إضافة التطبيق إلى Dock من خلال: Share → Add to Dock
- لن تحصل على كل مميزات PWA

### على Firefox:

⚠️ **تنبيه**: Firefox Desktop لا يدعم PWA حالياً
- استخدم Chrome أو Edge للحصول على أفضل تجربة

## التحقق من التشخيص

افتح Console وابحث عن رسائل PWA:

```
PWA: تهيئة PWA Install Prompt
PWA: التطبيق غير مثبت، في انتظار beforeinstallprompt
PWA: المتصفح: [معلومات المتصفح]
PWA: يدعم beforeinstallprompt: true/false
PWA: Service Worker مسجل: true/false
```

إذا رأيت:
- ✅ `PWA: تم استلام beforeinstallprompt event` - الزر سيظهر بعد 3 ثواني
- ❌ لم تظهر هذه الرسالة - المتصفح لا يدعم أو الشروط غير مستوفاة

## الحل البديل: صفحة الإعدادات

إذا لم يظهر الزر التلقائي:

1. اذهب إلى صفحة **الإعدادات**
2. ابحث عن قسم **"تثبيت التطبيق"**
3. ستجد زر تثبيت دائم هناك
4. أو اتبع التعليمات اليدوية الموجودة في نفس القسم

## المتصفحات المدعومة

| المتصفح | Windows | macOS | Linux | Android | iOS |
|---------|---------|-------|-------|---------|-----|
| Chrome | ✅ | ✅ | ✅ | ✅ | ❌* |
| Edge | ✅ | ✅ | ✅ | ✅ | ❌ |
| Safari | ❌ | ⚠️ | - | - | ✅ |
| Firefox | ❌ | ❌ | ❌ | ⚠️ | ❌ |

*iOS يتطلب Safari فقط

## ملاحظات هامة

1. **localhost**: يعمل PWA على localhost حتى بدون HTTPS
2. **إعادة التحميل**: بعد بناء الإصدار الجديد، أعد تحميل الصفحة مرتين
3. **Cache**: امسح cache المتصفح إذا كنت تواجه مشاكل
4. **DevTools**: افتح Application tab → Service Workers للتحقق من الحالة

## استكشاف الأخطاء

### المشكلة: "PWA: يدعم beforeinstallprompt: false"
**الحل**: استخدم Chrome أو Edge

### المشكلة: Service Worker لا يتم تسجيله
**الحل**:
1. تأكد من أن الموقع على HTTPS أو localhost
2. أعد بناء المشروع: `npm run build`
3. امسح cache المتصفح

### المشكلة: الزر لا يظهر أبداً
**الحل**:
1. افتح Console وتحقق من السجلات
2. امسح localStorage: `localStorage.removeItem('pwa-install-dismissed')`
3. أعد تحميل الصفحة
4. استخدم زر التثبيت في صفحة الإعدادات

## للمطورين

لإجبار ظهور الزر في وضع التطوير:

```javascript
// في Console
localStorage.removeItem('pwa-install-dismissed');
location.reload();
```

لمحاكاة beforeinstallprompt:

```javascript
// لاحظ: هذا للاختبار فقط ولن يثبت التطبيق فعلياً
window.dispatchEvent(new Event('beforeinstallprompt'));
```
