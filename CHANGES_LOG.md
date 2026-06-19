# 📝 سجل التغييرات

## 🔐 **تحديث: نظام موافقة الأدمن على الطلبات - 2 فبراير 2026**

### ✨ الميزات الجديدة

#### نظام التحكم في إظهار الطلبات

عندما تكون **المعالجة التلقائية معطلة**:
- ❌ الطلبات **لا تظهر** للسائقين في تطبيق السائق
- ❌ الطلبات **لا تظهر** للبائعين في تطبيق البائع
- ⏳ الطلبات **تنتظر موافقة الأدمن** أولاً
- ✅ فقط بعد موافقة الأدمن → تظهر الطلبات للسائقين والبائعين

عندما تكون **المعالجة التلقائية مفعلة** (الوضع الافتراضي):
- ✅ الطلبات تظهر تلقائياً للجميع (كما كان سابقاً)
- ✅ لا حاجة لموافقة الأدمن
- ✅ العمليات سريعة وتلقائية

### 📁 الملفات المضافة

```
supabase/migrations/add_admin_approval_system.sql           - Migration لنظام الموافقة
supabase/migrations/update_vendor_policies_admin_approval.sql - تحديث RLS للبائعين والمستخدمين
docs/admin-approval-system.md                              - دليل شامل للنظام
```

### 🔧 الملفات المحدثة

```
src/services/delivery.ts                          - إضافة فلترة admin_approved
```

### 🗄️ التغييرات في قاعدة البيانات

#### 1. عمود جديد في driver_waiting_list
```sql
admin_approved BOOLEAN DEFAULT true
```
- `true`: الطلب موافق عليه (يظهر للجميع)
- `false`: يحتاج موافقة الأدمن (لا يظهر لأحد)

#### 2. تحديث RLS Policies للسائقين
```sql
-- السائقون يرون فقط الطلبات الموافق عليها
USING (
  status = 'pending'
  AND admin_approved = true      -- ✅ شرط جديد
  AND (vendor_approved = true OR vendor_approved IS NULL)
)
```

#### 3. تحديث RLS Policies للبائعين
```sql
-- البائعون يرون فقط طلباتهم الموافق عليها
USING (
  vendor_id IN (SELECT id FROM vendors WHERE user_id = auth.uid())
  AND admin_approved = true      -- ✅ شرط جديد
)
```

#### 4. تحديث RLS Policies للمستخدمين العامين
```sql
-- المستخدمون يرون فقط الطلبات الموافق عليها
USING (
  status = 'pending'
  AND admin_approved = true      -- ✅ شرط جديد
  AND (vendor_approved = true OR vendor_approved IS NULL)
)
```

#### 3. تحديث Trigger Function
```sql
-- الدالة التلقائية تحدد admin_approved بناءً على المعالجة التلقائية
v_admin_approved := v_auto_processing;
```

### 🎯 الفوائد

1. **التحكم الكامل**: الأدمن يراجع كل طلب قبل إرساله للسائقين
2. **المرونة**: تفعيل/تعطيل المعالجة التلقائية حسب الحاجة
3. **الأمان**: حماية من الطلبات الوهمية والمشبوهة
4. **الشفافية**: سجل واضح لجميع الموافقات

### 📚 التوثيق

راجع [docs/admin-approval-system.md](docs/admin-approval-system.md) للمزيد من التفاصيل

---

## 🎙️ **تحديث: الصوت الناطق للرحلات المخصصة - 2 فبراير 2026**

### ✨ الميزات الجديدة

#### 1️⃣ صوت ناطق عند تخصيص رحلة
عندما يتم تخصيص رحلة مباشرة للسائق في صفحة "رحلاتي":
- ✅ يظهر إشعار مرئي: "🚗 رحلة مخصصة!"
- ✅ يتم تشغيل صوت تنبيه
- ✅ **يتم تشغيل صوت ناطق باللغة العربية يقول: "لديك رحلة مخصصة - رقم الطلب [رقم]"**

#### 2️⃣ صوت ناطق للطلبات الجديدة
عندما يظهر طلب جديد في صفحة الطلبات:
- ✅ يظهر إشعار مرئي: "🔔 طلب جديد!"
- ✅ يتم تشغيل صوت تنبيه
- ✅ **يتم تشغيل صوت ناطق باللغة العربية يقول: "طلب جديد - رقم الطلب [رقم]"**

### 📁 الملفات المضافة

```
src/utils/textToSpeech.ts              - نظام Text-to-Speech الكامل
docs/text-to-speech-guide.md          - دليل شامل للصوت الناطق
```

### 🔧 الملفات المحدثة

```
src/pages/MyTrips.tsx                  - إضافة TTS للرحلات المخصصة
src/hooks/useOrderNotifications.ts     - إضافة TTS للطلبات الجديدة
```

### ⚙️ التقنية المستخدمة

- **Web Speech API**: نظام النطق المدمج في المتصفحات
- **اللغة**: العربية السعودية (ar-SA)
- **الدعم**: جميع المتصفحات الحديثة (Chrome, Safari, Edge, Firefox)
- **الأجهزة**: Android, iOS, Desktop

### 🎯 الفوائد

1. تنبيه صوتي واضح للسائق بالرحلات الجديدة
2. لا حاجة للنظر للشاشة باستمرار
3. تحسين تجربة المستخدم
4. عمل تلقائي بدون إعداد إضافي
5. لا يستهلك بيانات (يعمل على الجهاز مباشرة)

### 📚 التوثيق

راجع [docs/text-to-speech-guide.md](docs/text-to-speech-guide.md) للمزيد من التفاصيل

---

# 📝 سجل التغييرات السابقة - 20 أكتوبر 2025

## 🔴 **تحديث حرج - المشكلة الحقيقية!**

### ⚡ **الإشعارات العشوائية من Android Service**

**المشكلة الجذرية:** كانت الخدمة الخلفية Android ترسل إشعارات **عشوائية وهمية** كل 5 ثوانٍ!

**الملف:** `android/app/src/main/java/com/tayardriver/app/BackgroundOrderService.java`

**الكود القديم (السطور 162-165):**
```java
// محاكاة طلب جديد كل 30 ثانية للاختبار
if (Math.random() < 0.05) { // 5% احتمال كل فحص = إشعار كل دقيقة تقريباً
    showOrderNotification("طلب جديد!", "لديك طلب جديد في انتظار التوصيل");
}
```

**✅ تم حذفه بالكامل!** الآن الخدمة الخلفية لا ترسل إشعارات إلا عند طلبات حقيقية من قاعدة البيانات.

---

## 🎯 المشاكل التي تم إصلاحها

### 1️⃣ الإشعارات الوهمية عند فتح التطبيق ❌ → ✅
**المشكلة:**
- عند فتح التطبيق، يظهر إشعار "طلب جديد" رغم عدم وجود طلبات
- إشعارات للطلبات القديمة عند كل فتح للتطبيق
- إشعار "تم تفعيل الإشعارات" عند قبول الأذونات

**الحل:**
- ✅ حذف `useOrderNotifications` من `Orders.tsx`
- ✅ حذف `useOrderNotifications` من `Dashboard.tsx`
- ✅ حذف الإشعار التجريبي من `useNotifications.ts` (سطر 142-149)
- ✅ الإشعارات الآن **فقط** للطلبات الجديدة الحقيقية

**الملفات المعدلة:**
```
src/pages/Orders.tsx        - حذف import و استخدام useOrderNotifications
src/pages/Dashboard.tsx     - حذف import و استخدام useOrderNotifications
src/hooks/useNotifications.ts - حذف إشعار "تم تفعيل الإشعارات"
```

### 2️⃣ عدم طلب الأذونات تلقائياً ❌ → ✅
**المشكلة:**
- التطبيق لا يطلب أذونات الإشعارات والموقع تلقائياً عند الفتح
- المستخدم يضطر للذهاب إلى الإعدادات لتفعيلها يدوياً

**الحل:**
- ✅ إضافة طلب أذونات الإشعارات تلقائياً في `App.tsx`
- ✅ إضافة طلب أذونات الموقع تلقائياً بعد الإشعارات
- ✅ إضافة state `permissionsRequested` لمنع الطلب المتكرر
- ✅ إضافة سجلات واضحة بالـ emoji للتتبع

**الملفات المعدلة:**
```
src/App.tsx - إضافة طلب الأذونات التلقائي في useEffect
```

**الكود الجديد:**
```typescript
useEffect(() => {
  const initializeApp = async () => {
    await new Promise(resolve => setTimeout(resolve, 800));

    if (!permissionsRequested) {
      // طلب أذونات الإشعارات
      console.log('📢 طلب أذونات الإشعارات...');
      const notifGranted = await requestNotificationPermission();

      // تأخير 800ms
      await new Promise(resolve => setTimeout(resolve, 800));

      // طلب أذونات الموقع
      console.log('📍 طلب أذونات الموقع...');
      const locationGranted = await requestLocationPermission();

      setPermissionsRequested(true);
    }
  };

  initializeApp();
}, []);
```

## 🔧 التغييرات التقنية

### الملفات المحذوفة/المعدلة:
1. `src/pages/Orders.tsx`
   - حذف: `import { useOrderNotifications }`
   - حذف: `useOrderNotifications(deliveries)`

2. `src/pages/Dashboard.tsx`
   - حذف: `import { useOrderNotifications }`
   - حذف: `useOrderNotifications(deliveries)`

3. `src/hooks/useNotifications.ts`
   - حذف إشعار "تم تفعيل الإشعارات" من requestPermission

4. `src/App.tsx`
   - إضافة: `const [permissionsRequested, setPermissionsRequested] = useState(false)`
   - تحديث: `useEffect` لطلب الأذونات تلقائياً
   - إضافة: سجلات واضحة مع emoji

### الأذونات في AndroidManifest.xml:
```xml
✅ android.permission.POST_NOTIFICATIONS
✅ android.permission.ACCESS_FINE_LOCATION
✅ android.permission.ACCESS_COARSE_LOCATION
✅ android.permission.ACCESS_BACKGROUND_LOCATION
```

## 📦 الملفات الجديدة

1. **BUILD_INSTRUCTIONS.md**
   - تعليمات مفصلة لبناء التطبيق
   - خطوات حل المشاكل
   - طرق التثبيت والاختبار

2. **QUICK_START.md**
   - دليل سريع في 3 خطوات
   - أوامر البناء المباشرة
   - اختبار الأذونات

3. **CHANGES_LOG.md** (هذا الملف)
   - سجل مفصل للتغييرات
   - قبل وبعد المقارنة

## 🎯 السلوك الجديد

### عند فتح التطبيق لأول مرة:
```
1. ⏳ شاشة تحميل (800ms)
2. 🔔 نافذة نظام Android: "السماح بالإشعارات؟"
   ├─ قبول → ✅
   └─ رفض → يمكن تفعيلها من الإعدادات لاحقاً
3. ⏳ تأخير قصير (800ms)
4. 📍 نافذة نظام Android: "السماح بالوصول للموقع؟"
   ├─ قبول → ✅
   └─ رفض → يمكن تفعيلها من الإعدادات لاحقاً
5. ✅ بدء التطبيق - لا إشعارات وهمية!
```

### الإشعارات:
- ❌ **لا إشعارات** عند فتح التطبيق
- ❌ **لا إشعارات** للطلبات القديمة
- ✅ **إشعارات فقط** للطلبات الجديدة الحقيقية
- ✅ **إشعار واحد** لكل طلب جديد

## 🔍 التحقق من التغييرات

### عرض سجلات التطبيق:
```bash
adb logcat | grep -E "🚀|📢|📍|✅|❌"
```

### السجلات المتوقعة:
```
🚀 بدء تهيئة التطبيق...
📢 طلب أذونات الإشعارات...
✅ نتيجة أذونات الإشعارات: true
📍 طلب أذونات الموقع...
✅ نتيجة أذونات الموقع: true
✅ تم تهيئة التطبيق بنجاح
```

## 📱 خطوات البناء بعد التغييرات

```bash
# 1. بناء ملفات الويب
npm run build

# 2. مزامنة مع Android
npx cap sync android

# 3. بناء APK
cd android
./gradlew clean
./gradlew assembleDebug

# 4. الملف الناتج في:
# android/app/build/outputs/apk/debug/app-debug.apk
```

## ✅ قائمة التحقق

- [x] حذف الإشعارات الوهمية
- [x] إضافة طلب أذونات الإشعارات تلقائياً
- [x] إضافة طلب أذونات الموقع تلقائياً
- [x] إضافة سجلات واضحة للتتبع
- [x] اختبار البناء والمزامنة
- [x] إنشاء ملفات التوثيق

## 🎉 النتيجة النهائية

التطبيق الآن:
1. ✅ يطلب جميع الأذونات المطلوبة **تلقائياً**
2. ✅ لا يرسل أي إشعارات **وهمية** أو **مزعجة**
3. ✅ إشعارات **واضحة** للطلبات الجديدة فقط
4. ✅ تجربة مستخدم **نظيفة** ومهنية

---

**آخر تحديث:** 20 أكتوبر 2025
**الإصدار:** 1.0.0
**الحالة:** ✅ جاهز للاختبار
