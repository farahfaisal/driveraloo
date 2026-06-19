# 🔥 دليل إعداد Firebase Cloud Messaging (FCM)

## 📱 **نظام الإشعارات الجديد**

تم ترقية نظام الإشعارات ليدعم **Push Notifications** التي تعمل حتى لو التطبيق مغلق!

---

## ✅ **ما تم إنجازه:**

### 1️⃣ **تم تثبيت المكتبات**
```bash
✅ @capacitor/push-notifications@^6.0.4
```

### 2️⃣ **تم ترقية `useOrderNotifications.ts`**
- ✅ دعم Firebase Cloud Messaging
- ✅ تسجيل Push Token تلقائياً
- ✅ إرسال إشعارات عبر Supabase Edge Function
- ✅ حفظ سجل الإشعارات في localStorage
- ✅ منع الإشعارات المتكررة

### 3️⃣ **تم إنشاء Supabase Edge Function**
```
✅ send-push-notification
```
- يستقبل Push Token من التطبيق
- يرسل الإشعار عبر Firebase FCM
- يدعم بيانات إضافية (order ID, customer info, etc)

### 4️⃣ **تم التفعيل في:**
- ✅ `Orders.tsx` - مراقبة الطلبات الجديدة
- ✅ `Dashboard.tsx` - مراقبة الطلبات الجديدة

---

## 🔧 **خطوات الإعداد (يجب القيام بها):**

### **الخطوة 1: إنشاء مشروع Firebase**

1. اذهب إلى [Firebase Console](https://console.firebase.google.com/)
2. اضغط **"Add project"** أو **"Create a project"**
3. أدخل اسم المشروع: مثلاً **"Tayar Driver App"**
4. اختر إعدادات المشروع حسب رغبتك
5. اضغط **"Create project"**

---

### **الخطوة 2: إضافة تطبيق Android إلى Firebase**

1. في Firebase Console، اضغط على أيقونة **Android**
2. أدخل **Package name**:
   ```
   com.tayardriver.app
   ```
   ⚠️ **مهم:** يجب أن يطابق Package Name في `android/app/build.gradle`

3. اضغط **"Register app"**

4. **تحميل ملف `google-services.json`:**
   - Firebase سيعطيك ملف `google-services.json`
   - **ضع هذا الملف في:**
     ```
     android/app/google-services.json
     ```

5. **إضافة Google Services plugin:**

   افتح `android/build.gradle` وأضف:
   ```gradle
   buildscript {
       dependencies {
           // أضف هذا السطر
           classpath 'com.google.gms:google-services:4.4.0'
       }
   }
   ```

   افتح `android/app/build.gradle` وأضف في آخر الملف:
   ```gradle
   apply plugin: 'com.google.gms.google-services'
   ```

6. اضغط **"Next"** حتى تكمل الإعداد

---

### **الخطوة 3: إضافة تطبيق iOS إلى Firebase** (اختياري)

1. في Firebase Console، اضغط على أيقونة **iOS**
2. أدخل **Bundle ID**:
   ```
   com.tayardriver.app
   ```
3. اتبع الخطوات لتحميل `GoogleService-Info.plist`
4. ضع الملف في:
   ```
   ios/App/App/GoogleService-Info.plist
   ```

---

### **الخطوة 4: الحصول على Server Key**

1. في Firebase Console، اذهب إلى **Settings** ⚙️ (أعلى اليسار)
2. اختر **"Project settings"**
3. اذهب إلى تبويب **"Cloud Messaging"**
4. ابحث عن **"Server key"** (API Key القديم)

   ⚠️ **إذا لم تجده:** استخدم **Cloud Messaging API (V1)**:
   - انتقل إلى **Google Cloud Console**
   - فعّل **Cloud Messaging API**
   - احصل على Service Account Key (JSON file)

5. **انسخ Server Key**

---

### **الخطوة 5: إضافة FCM_SERVER_KEY إلى Supabase**

**⚠️ مهم جداً:** لا تضع Server Key في الكود أبداً!

#### **الطريقة الصحيحة (Supabase Dashboard):**

1. اذهب إلى [Supabase Dashboard](https://supabase.com/dashboard)
2. افتح مشروعك
3. من القائمة الجانبية، اختر **"Project Settings"** ⚙️
4. اختر **"Edge Functions"**
5. انزل إلى قسم **"Secrets"**
6. اضغط **"Add new secret"**
7. أدخل:
   - **Name:** `FCM_SERVER_KEY`
   - **Value:** (الصق Server Key من Firebase)
8. اضغط **"Save"**

---

## 🚀 **كيف يعمل النظام:**

### **1. عند فتح التطبيق:**
```typescript
// يطلب أذونات الإشعارات
PushNotifications.requestPermissions()

// يسجل الجهاز ويحصل على Push Token
PushNotifications.register()

// يحفظ Token في localStorage
localStorage.setItem('push_token', token)
```

### **2. عند وصول طلب جديد:**
```typescript
// 1. إشعار محلي فوري
await showOrderNotification(title, body)

// 2. تشغيل الصوت
await playSound('order')

// 3. إرسال Push Notification عبر Supabase
fetch('SUPABASE_URL/functions/v1/send-push-notification', {
  body: JSON.stringify({
    token: pushToken,
    title: '🔔 طلب جديد!',
    body: 'طلب من عميل - توصيل',
    data: { orderId, customerId }
  })
})
```

### **3. Supabase Edge Function:**
```typescript
// يستقبل الطلب
const { token, title, body, data } = await req.json()

// يرسل إلى Firebase FCM
fetch('https://fcm.googleapis.com/fcm/send', {
  headers: {
    'Authorization': `key=${FCM_SERVER_KEY}`
  },
  body: JSON.stringify({
    to: token,
    notification: { title, body },
    data
  })
})
```

### **4. Firebase يرسل الإشعار:**
- ✅ حتى لو التطبيق مغلق
- ✅ حتى لو الجهاز في وضع السكون
- ✅ مع صوت واهتزاز

---

## 🧪 **كيفية الاختبار:**

### **1. اختبار من التطبيق:**
```typescript
// في Orders.tsx أو Settings.tsx
const testPush = async () => {
  await showOrderNotification(
    '🔔 اختبار Push',
    'هذا اختبار للإشعارات'
  );
};
```

### **2. اختبار من Firebase Console:**
1. اذهب إلى **Cloud Messaging** في Firebase Console
2. اضغط **"Send your first message"**
3. أدخل عنوان ونص الإشعار
4. اختر **"Send test message"**
5. الصق Push Token من localStorage
6. اضغط **"Test"**

### **3. اختبار من Postman:**
```bash
POST https://YOUR_PROJECT.supabase.co/functions/v1/send-push-notification
Headers:
  Authorization: Bearer YOUR_ANON_KEY
  Content-Type: application/json

Body:
{
  "token": "DEVICE_PUSH_TOKEN",
  "title": "🔔 اختبار",
  "body": "رسالة اختبار",
  "data": {
    "orderId": "123",
    "test": true
  }
}
```

---

## 🔍 **التحقق من التفعيل:**

### **في التطبيق:**
```typescript
// افتح Console في التطبيق
console.log('Push Token:', localStorage.getItem('push_token'))
console.log('Notified Orders:', localStorage.getItem('notified_orders'))
console.log('Has Push Token:', hasPushToken) // من useOrderNotifications
```

### **في Logs:**
```
🔔 بدء تهيئة Push Notifications...
✅ تم منح أذونات الإشعارات
✅ تم الحصول على Push Token: xxxxxx...
🔄 تم تحميل سجل الإشعارات: 5
🚀 اكتُشف 2 طلب جديد
✅ تم إرسال Push Notification للطلب: abc123
```

---

## 📂 **الملفات المهمة:**

### **Frontend:**
```
src/hooks/useOrderNotifications.ts    - النظام الرئيسي
src/pages/Orders.tsx                  - مفعّل هنا
src/pages/Dashboard.tsx               - مفعّل هنا
```

### **Backend:**
```
supabase/functions/send-push-notification/index.ts
```

### **Android:**
```
android/app/google-services.json      - يجب إضافته!
android/build.gradle                  - إضافة plugin
android/app/build.gradle              - تطبيق plugin
android/app/src/main/AndroidManifest.xml  - أذونات
```

### **iOS:**
```
ios/App/App/GoogleService-Info.plist  - يجب إضافته!
```

---

## ⚠️ **مشاكل شائعة:**

### **1. "FCM_SERVER_KEY is not configured"**
✅ **الحل:** أضف Server Key في Supabase Secrets

### **2. "Push Token is null"**
✅ **الحل:**
- تأكد من إضافة `google-services.json`
- تأكد من تشغيل `cap sync android`
- أعد بناء التطبيق

### **3. "Permission denied"**
✅ **الحل:**
- اطلب الأذونات من المستخدم
- تحقق من AndroidManifest.xml

### **4. "Network request failed"**
✅ **الحل:**
- تحقق من VITE_SUPABASE_URL في .env
- تحقق من Edge Function deployed

---

## 🎯 **الملخص السريع:**

### **ما يجب فعله الآن:**

1. ✅ إنشاء مشروع Firebase
2. ✅ إضافة Android App (Package: `com.tayardriver.app`)
3. ✅ تحميل `google-services.json` → `android/app/`
4. ✅ إضافة Google Services plugin في `build.gradle`
5. ✅ الحصول على FCM Server Key
6. ✅ إضافة `FCM_SERVER_KEY` في Supabase Secrets
7. ✅ تشغيل `npx cap sync android`
8. ✅ بناء التطبيق: `npm run android:build`
9. ✅ اختبار الإشعارات

---

## 📞 **للمساعدة:**

إذا واجهت أي مشكلة:
1. تحقق من Console logs
2. تحقق من Supabase Edge Function logs
3. تحقق من Firebase Console → Cloud Messaging

---

**آخر تحديث:** 23 أكتوبر 2025
**الإصدار:** 2.0 (مع Firebase Push Support)
