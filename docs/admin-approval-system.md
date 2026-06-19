# نظام موافقة الأدمن على الطلبات

## نظرة عامة

تم إضافة نظام موافقة الأدمن للتحكم في إظهار الطلبات للسائقين والبائعين عندما تكون **المعالجة التلقائية معطلة**.

### من يتأثر بهذا النظام؟
- ✅ **السائقون**: لا يرون الطلبات غير الموافق عليها في تطبيق السائق
- ✅ **البائعون**: لا يرون الطلبات غير الموافق عليها في تطبيق البائع
- ✅ **المستخدمون العامون**: لا يرون الطلبات غير الموافق عليها
- ✅ **الأدمن فقط**: يستطيع رؤية جميع الطلبات والموافقة عليها

## كيفية العمل

### المعالجة التلقائية مفعلة (Auto Processing: ON)
```
طلب جديد → يضاف تلقائياً لـ driver_waiting_list
             ↓
         admin_approved = true (موافقة تلقائية)
             ↓
         يظهر للسائقين والبائعين مباشرة ✅
```

### المعالجة التلقائية معطلة (Auto Processing: OFF)
```
طلب جديد → لا يضاف لـ driver_waiting_list
             ↓
         ينتظر موافقة الأدمن ⏳
             ↓
    [الأدمن يوافق على الطلب يدوياً]
             ↓
         يضاف لـ driver_waiting_list
         admin_approved = true
             ↓
         يظهر للسائقين والبائعين ✅
```

## التغييرات التقنية

### 1. قاعدة البيانات

#### إضافة عمود جديد
```sql
ALTER TABLE driver_waiting_list
ADD COLUMN admin_approved BOOLEAN DEFAULT true;
```

#### السلوك الافتراضي
- `admin_approved = true`: الطلب موافق عليه (يظهر للسائقين)
- `admin_approved = false`: يحتاج موافقة الأدمن (لا يظهر للسائقين)

#### RLS Policies

**للسائقين:**
```sql
CREATE POLICY "Drivers can view available orders"
ON driver_waiting_list
FOR SELECT
TO authenticated
USING (
  status = 'pending'
  AND admin_approved = true      -- ✅ فلترة جديدة
  AND (vendor_approved = true OR vendor_approved IS NULL)
  AND driver_id IS NULL
);
```

**للبائعين:**
```sql
CREATE POLICY "vendors_can_view_their_orders"
ON driver_waiting_list
FOR SELECT
TO authenticated
USING (
  vendor_id IN (
    SELECT id FROM vendors WHERE user_id = auth.uid()
  )
  AND admin_approved = true    -- ✅ فلترة جديدة
);
```

**للمستخدمين العامين:**
```sql
CREATE POLICY "public_can_view_waiting_list"
ON driver_waiting_list
FOR SELECT
TO public
USING (
  status = 'pending'
  AND admin_approved = true    -- ✅ فلترة جديدة
  AND (vendor_approved = true OR vendor_approved IS NULL)
);
```

### 2. الدالة التلقائية (Trigger)

تم تحديث `auto_add_to_waiting_list()`:

```sql
-- تحديد حالة الموافقة بناءً على المعالجة التلقائية
v_admin_approved := v_auto_processing;

-- إذا كانت المعالجة التلقائية مفعلة
IF v_auto_processing THEN
  -- إضافة الطلب مع admin_approved = true
  INSERT INTO driver_waiting_list (
    order_id,
    ...
    admin_approved  -- ✅ جديد
  ) VALUES (
    NEW.id,
    ...
    v_admin_approved  -- true إذا auto_processing مفعلة
  );
ELSE
  -- لا نضيف الطلبات تلقائياً، ننتظر موافقة الأدمن
  RAISE NOTICE 'المعالجة التلقائية معطلة - يتطلب موافقة الأدمن';
END IF;
```

### 3. الكود (TypeScript)

#### تحديث Interface
```typescript
export interface Delivery {
  // ... الحقول الموجودة
  vendor_approved?: boolean;
  admin_approved?: boolean;  // ✅ جديد
}
```

#### فلترة الطلبات
```typescript
// في getDriverDeliveries()
const { data: waitingList } = await supabase
  .from('driver_waiting_list')
  .select(...)
  .eq('status', 'pending')
  .eq('admin_approved', true)  // ✅ فلترة جديدة
  .order('created_at', { ascending: false });

// فلتر إضافي في الكود
const approvedWaitingList = waitingList.filter(item => {
  if (item.admin_approved === false) {
    console.log('تم تخطي الطلب - لم يوافق عليه الأدمن');
    return false;
  }
  return true;
});
```

## سيناريوهات الاستخدام

### السيناريو 1: المعالجة التلقائية مفعلة (الوضع العادي)
1. ✅ يصل طلب جديد من العميل
2. ✅ يتم إضافته تلقائياً إلى `driver_waiting_list`
3. ✅ `admin_approved = true` (موافقة تلقائية)
4. ✅ يظهر فوراً في تطبيق السائق وتطبيق البائع
5. ✅ السائق يمكنه قبول الطلب

### السيناريو 2: المعالجة التلقائية معطلة (التحكم اليدوي)
1. ✅ يصل طلب جديد من العميل
2. ⏳ **لا يتم إضافته** إلى `driver_waiting_list` تلقائياً
3. ⏳ الطلب موجود فقط في جدول `orders`
4. ❌ **لا يظهر** للسائقين في تطبيق السائق
5. ❌ **لا يظهر** للبائعين في تطبيق البائع
6. 👨‍💼 **الأدمن يراجع الطلب** في لوحة التحكم
7. ✅ الأدمن يوافق على الطلب يدوياً
8. ✅ يتم إضافة الطلب إلى `driver_waiting_list` مع `admin_approved = true`
9. ✅ الآن يظهر للسائقين والبائعين
10. ✅ السائق يمكنه قبول الطلب

### السيناريو 3: الأدمن يرفض الطلب
1. ✅ يصل طلب جديد
2. ⏳ ينتظر موافقة الأدمن
3. 👨‍💼 الأدمن يراجع الطلب
4. ❌ الأدمن يرفض الطلب (لأي سبب)
5. ❌ لا يتم إضافته إلى `driver_waiting_list`
6. ❌ لا يظهر أبداً للسائقين
7. 🔄 يمكن إلغاء الطلب أو معالجته بطريقة أخرى

## الفوائد

### 1. التحكم الكامل
- الأدمن يستطيع مراجعة كل طلب قبل إرساله للسائقين
- منع الطلبات المشبوهة أو غير الصحيحة

### 2. المرونة
- يمكن تفعيل/تعطيل المعالجة التلقائية حسب الحاجة
- في الأوقات العادية: تلقائي (سريع)
- في الأوقات المزدحمة: يدوي (متحكم به)

### 3. الأمان
- حماية من الطلبات الوهمية
- فحص الطلبات ذات القيمة العالية
- التأكد من بيانات العميل قبل الإرسال

### 4. الشفافية
- سجل واضح لجميع الموافقات
- يمكن تتبع من وافق على كل طلب
- تقارير دقيقة عن العمليات

## كيفية الاختبار

### اختبار 1: المعالجة التلقائية مفعلة
```sql
-- 1. تفعيل المعالجة التلقائية
UPDATE app_settings
SET settings = jsonb_set(
  settings,
  '{orders,autoProcessing}',
  'true'::jsonb
);

-- 2. إضافة طلب جديد
INSERT INTO orders (...) VALUES (...);

-- 3. التحقق: يجب أن يظهر في driver_waiting_list
SELECT * FROM driver_waiting_list WHERE order_id = 'ORDER_ID';
-- النتيجة: admin_approved = true ✅
```

### اختبار 2: المعالجة التلقائية معطلة
```sql
-- 1. تعطيل المعالجة التلقائية
UPDATE app_settings
SET settings = jsonb_set(
  settings,
  '{orders,autoProcessing}',
  'false'::jsonb
);

-- 2. إضافة طلب جديد
INSERT INTO orders (...) VALUES (...);

-- 3. التحقق: لا يجب أن يظهر في driver_waiting_list
SELECT * FROM driver_waiting_list WHERE order_id = 'ORDER_ID';
-- النتيجة: (لا توجد نتائج) ⏳

-- 4. الأدمن يوافق يدوياً
INSERT INTO driver_waiting_list (
  order_id,
  admin_approved,
  ...
) VALUES (
  'ORDER_ID',
  true,
  ...
);

-- 5. التحقق: الآن يظهر
SELECT * FROM driver_waiting_list WHERE order_id = 'ORDER_ID';
-- النتيجة: admin_approved = true ✅
```

### اختبار 3: الفلترة في تطبيق السائق
```typescript
// في تطبيق السائق
const deliveries = await getDriverDeliveries();

// يجب أن تكون جميع الطلبات موافق عليها
deliveries.forEach(delivery => {
  console.log(delivery.admin_approved); // يجب أن تكون true
});
```

## الأذونات المطلوبة

### للأدمن
- `INSERT` على `driver_waiting_list` (إضافة طلبات جديدة)
- `UPDATE` على `driver_waiting_list` (تحديث admin_approved)
- `SELECT` على `orders` (مراجعة الطلبات)
- `DELETE` على `driver_waiting_list` (حذف الطلبات إذا لزم)

### للسائقين
- `SELECT` على `driver_waiting_list` WHERE:
  - `admin_approved = true` ✅
  - `status = 'pending'`
  - `driver_id IS NULL` (الطلبات المتاحة)
- `SELECT` على `driver_waiting_list` WHERE:
  - `driver_id = auth.uid()` (طلباتهم المعينة)
- ❌ لا يستطيعون رؤية الطلبات غير الموافق عليها من الأدمن

### للبائعين
- `SELECT` على `driver_waiting_list` WHERE:
  - `vendor_id` = بائع المستخدم الحالي
  - `admin_approved = true` ✅
- `UPDATE` على `driver_waiting_list` WHERE:
  - `vendor_id` = بائع المستخدم الحالي
  - `admin_approved = true` ✅
- `INSERT` على `driver_waiting_list` (إضافة طلبات لمتجرهم)
- ❌ لا يستطيعون رؤية أو تعديل الطلبات غير الموافق عليها من الأدمن

### للمستخدمين العامين (Public)
- `SELECT` على `driver_waiting_list` WHERE:
  - `status = 'pending'`
  - `admin_approved = true` ✅
  - `vendor_approved = true OR vendor_approved IS NULL`
- ❌ لا يستطيعون رؤية الطلبات غير الموافق عليها

## الملفات المعدلة

### Database Migrations
```
supabase/migrations/add_admin_approval_system.sql
  - إضافة عمود admin_approved
  - تحديث Trigger Function
  - تحديث RLS Policies للسائقين

supabase/migrations/update_vendor_policies_admin_approval.sql
  - تحديث RLS Policies للبائعين
  - تحديث RLS Policies للمستخدمين العامين
  - إضافة فلترة admin_approved للجميع
```

### Backend Code
```
src/services/delivery.ts
  - تحديث interface Delivery (إضافة admin_approved)
  - تحديث getDriverDeliveries() (فلترة admin_approved)
  - إضافة فلترة admin_approved في الاستعلامات
```

## ملاحظات مهمة

### 1. الترحيل التدريجي
جميع الطلبات الموجودة ستكون `admin_approved = true` افتراضياً لضمان عدم تعطيل العمليات الحالية.

### 2. الأداء
تم إضافة فهرس `idx_driver_waiting_list_admin_approved` لتحسين أداء الاستعلامات:
```sql
CREATE INDEX idx_driver_waiting_list_admin_approved
ON driver_waiting_list(admin_approved)
WHERE admin_approved = false;
```

### 3. التوافقية
النظام متوافق تماماً مع:
- ✅ نظام موافقة البائع (`vendor_approved`)
- ✅ المعالجة التلقائية الحالية
- ✅ جميع أنواع الطلبات (orders, captain_orders, parcel_orders)

## الخلاصة

تم إضافة **نظام موافقة الأدمن** بنجاح! الآن:
- ✅ عندما المعالجة التلقائية **مفعلة**: كل شيء يعمل تلقائياً كما كان
- ✅ عندما المعالجة التلقائية **معطلة**: الطلبات **لا تظهر** للسائقين أو البائعين حتى يوافق عليها الأدمن
- ✅ الأدمن لديه التحكم الكامل في إظهار/إخفاء الطلبات
- ✅ النظام آمن وفعال وسهل الاستخدام
