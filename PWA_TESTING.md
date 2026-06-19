# دليل اختبار PWA

## كيفية اختبار PWA محلياً

### 1. تشغيل السيرفر المحلي

```bash
npm run build
npm run preview
```

أو استخدم أي سيرفر HTTPS محلي.

### 2. فتح التطبيق في المتصفح

**مهم جداً:** يجب استخدام HTTPS أو localhost للحصول على خاصية PWA

- افتح `http://localhost:4173` (أو المنفذ الذي يعرضه vite preview)
- أو رفع المشروع على خادم HTTPS

### 3. التحقق من PWA

#### على Chrome (Desktop):

1. افتح DevTools (F12)
2. اذهب إلى تبويب **Application**
3. تحقق من:
   - **Manifest**: يجب أن يظهر ملف manifest بدون أخطاء
   - **Service Workers**: يجب أن يكون مسجل وفي حالة "activated"
   - **Storage**: تحقق من Cache Storage

4. في شريط العنوان، يجب أن تظهر أيقونة تثبيت (+) أو (⊕)

#### على Chrome (Android):

1. افتح الموقع في Chrome
2. اضغط على القائمة (⋮)
3. يجب أن تظهر خيار **"Install app"** أو **"Add to Home screen"**

#### على Safari (iOS):

1. افتح الموقع في Safari
2. اضغط على زر المشاركة
3. اختر **"Add to Home Screen"**

### 4. اختبار الميزات

بعد التثبيت:

✅ **Test 1: Offline Mode**
- افتح التطبيق
- افصل الإنترنت
- حاول التنقل بين الصفحات
- يجب أن تعمل الصفحات المخبأة

✅ **Test 2: Standalone Mode**
- افتح التطبيق من الشاشة الرئيسية
- يجب أن يفتح بدون شريط المتصفح (fullscreen)

✅ **Test 3: Install Prompt**
- افتح صفحة الإعدادات
- يجب أن تظهر رسالة التثبيت بعد 5 ثواني (في حالة عدم التثبيت)
- أو يجب أن يظهر زر "ثبت التطبيق الآن" في قسم "تثبيت التطبيق"

✅ **Test 4: Notifications**
- يجب أن تعمل الإشعارات حتى عند إغلاق التطبيق

### 5. مشاكل شائعة وحلولها

#### لا يظهر زر التثبيت:

**الأسباب المحتملة:**
- التطبيق مثبت بالفعل
- لا تستخدم HTTPS (ما عدا localhost)
- المتصفح لا يدعم PWA
- manifest.json يحتوي على أخطاء

**الحل:**
1. افتح DevTools → Console
2. ابحث عن أخطاء متعلقة بـ manifest أو service worker
3. تأكد من أن `prefer_related_applications` = `false` في manifest

#### Service Worker لا يسجل:

**الحل:**
1. افتح DevTools → Application → Service Workers
2. اضغط على "Unregister"
3. أعد تحميل الصفحة
4. تحقق من Console للأخطاء

#### التطبيق لا يعمل offline:

**الحل:**
1. تحقق من أن Service Worker في حالة "activated"
2. تحقق من Cache Storage - يجب أن تحتوي على الملفات
3. جرب مسح الـ cache وإعادة تحميل الصفحة

### 6. أدوات مفيدة للاختبار

#### Lighthouse (Chrome DevTools):

1. افتح DevTools → Lighthouse
2. اختر "Progressive Web App"
3. اضغط "Generate report"
4. يجب أن تحصل على درجة عالية (90+)

#### PWA Builder:

رفع الموقع على [PWABuilder.com](https://www.pwabuilder.com/) للحصول على تقرير شامل

### 7. متطلبات PWA

للحصول على PWA كامل الوظائف:

✅ يجب استخدام HTTPS
✅ manifest.json صحيح ومكتمل
✅ Service Worker مسجل
✅ أيقونات بأحجام مختلفة (192x192, 512x512)
✅ start_url صحيح
✅ theme_color و background_color محددين

### 8. التحقق من Console

افتح Console وابحث عن الرسائل التالية:

```
PWA: تهيئة PWA Install Prompt
PWA: التطبيق غير مثبت، في انتظار beforeinstallprompt
Service Worker: تحميل Service Worker
Service Worker: التثبيت
Service Worker: التفعيل
```

إذا لم تظهر هذه الرسائل، هناك مشكلة في التسجيل.

---

## الدعم الفني

إذا واجهت أي مشاكل، تحقق من:

1. **Console Errors** - افتح DevTools → Console
2. **Network Tab** - تحقق من أن manifest و service worker يتم تحميلهما
3. **Application Tab** - تحقق من Service Workers و Manifest

للمزيد من المساعدة، راجع:
- [PWA Checklist](https://web.dev/pwa-checklist/)
- [MDN PWA Guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
