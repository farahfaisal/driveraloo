# نظام العداد التلقائي لوقت التحضير
## Automatic Preparation Timer System

## نظرة عامة | Overview

عندما يحدد البائع وقت تحضير الطلب في حقل `actual_preparation_time`، يبدأ العداد (Timer) تلقائياً دون أي تدخل يدوي.

When the vendor sets the preparation time in the `actual_preparation_time` field, the timer starts automatically without any manual intervention.

---

## كيف يعمل النظام | How It Works

### 1. البائع يحدد وقت التحضير | Vendor Sets Preparation Time

```sql
UPDATE orders
SET actual_preparation_time = 30  -- 30 دقيقة
WHERE id = 'order-id';
```

### 2. النظام يحسب الأوقات تلقائياً | System Calculates Times Automatically

عند تحديث `actual_preparation_time`, يتم تفعيل **Trigger** الذي:

When `actual_preparation_time` is updated, a **Trigger** is activated that:

- **يحسب `preparation_start`** = الوقت الحالي (إذا لم يكن محدداً مسبقاً)
  - **Calculates `preparation_start`** = Current time (if not already set)

- **يحسب `preparation_end`** = `preparation_start` + `actual_preparation_time` دقائق
  - **Calculates `preparation_end`** = `preparation_start` + `actual_preparation_time` minutes

### 3. مكون PreparationTimer يعرض العداد | PreparationTimer Component Displays Counter

مكون `PreparationTimer` يستمع للتغييرات ويعرض:

The `PreparationTimer` component listens to changes and displays:

- ⏰ **العداد التنازلي** - الوقت المتبقي حتى جاهزية الطلب
  - **Countdown timer** - Time remaining until order is ready

- ✅ **رسالة "جاهز للاستلام"** - عندما ينتهي الوقت
  - **"Ready for pickup" message** - When time expires

- ⚠️ **رسالة تنبيه** - إذا لم يحدد البائع الوقت بعد
  - **Warning message** - If vendor hasn't set time yet

---

## الكود التقني | Technical Code

### Database Trigger

```sql
CREATE TRIGGER auto_set_preparation_times_on_update
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_actual_preparation_time_on_acceptance();
```

### Database Function

```sql
CREATE OR REPLACE FUNCTION set_actual_preparation_time_on_acceptance()
RETURNS TRIGGER AS $$
BEGIN
  -- عندما يتم تحديث actual_preparation_time
  IF NEW.actual_preparation_time IS NOT NULL AND
     (OLD.actual_preparation_time IS NULL OR
      NEW.actual_preparation_time != OLD.actual_preparation_time) THEN

    -- حساب preparation_start
    IF NEW.preparation_start IS NULL THEN
      NEW.preparation_start := NOW();
    END IF;

    -- حساب preparation_end
    NEW.preparation_end := NEW.preparation_start +
                          (NEW.actual_preparation_time * INTERVAL '1 minute');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## مثال عملي | Practical Example

### السيناريو | Scenario

1. البائع يستقبل طلب جديد
   - Vendor receives new order

2. البائع يحدد: "سيكون الطلب جاهز خلال 25 دقيقة"
   - Vendor sets: "Order will be ready in 25 minutes"

3. البائع يحدث `actual_preparation_time = 25`
   - Vendor updates `actual_preparation_time = 25`

4. **النظام يعمل تلقائياً:**
   - **System works automatically:**
   - `preparation_start` = 2026-03-07 10:00:00
   - `preparation_end` = 2026-03-07 10:25:00

5. **السائق يرى:**
   - **Driver sees:**
   - في الدقيقة 0: "⏰ وقت التحضير المتبقي: 25:00"
   - في الدقيقة 10: "⏰ وقت التحضير المتبقي: 15:00"
   - في الدقيقة 25: "✅ الطلب جاهز للاستلام"

---

## الحقول في قاعدة البيانات | Database Fields

| Field | Type | Description |
|-------|------|-------------|
| `actual_preparation_time` | integer | الوقت بالدقائق الذي يحدده البائع |
| `preparation_start` | timestamptz | وقت بداية التحضير (يُحسب تلقائياً) |
| `preparation_end` | timestamptz | وقت انتهاء التحضير (يُحسب تلقائياً) |

---

## الفوائد | Benefits

✅ **تلقائي بالكامل** - لا يحتاج البائع للقلق بشأن حساب الأوقات
   - **Fully automatic** - Vendor doesn't need to worry about time calculations

✅ **دقيق** - يستخدم وقت النظام الفعلي
   - **Accurate** - Uses actual system time

✅ **شفاف** - السائق يرى الوقت المتبقي بالضبط
   - **Transparent** - Driver sees exact remaining time

✅ **يعمل في الوقت الفعلي** - يتحدث كل ثانية
   - **Real-time** - Updates every second

---

## الملفات المعنية | Related Files

1. **Migration**: `supabase/migrations/20260307001024_recreate_auto_timer_on_preparation_time.sql`
2. **Component**: `src/components/PreparationTimer.tsx`
3. **Page**: `src/pages/Orders.tsx`
4. **Types**: `src/services/delivery.ts`

---

## التكامل مع قائمة الانتظار | Integration with Waiting List

عند تحديث `actual_preparation_time` في جدول `orders`:

When `actual_preparation_time` is updated in `orders` table:

1. يتم نسخه تلقائياً إلى جدول `driver_waiting_list`
   - Automatically copied to `driver_waiting_list` table

2. جميع السائقين يرون الوقت المحدث
   - All drivers see the updated time

3. العداد يعمل لجميع السائقين في نفس الوقت
   - Timer works for all drivers simultaneously

---

## ملاحظات هامة | Important Notes

⚠️ **إذا لم يحدد البائع الوقت** (`actual_preparation_time = NULL`):
   - يعرض رسالة: "⚠️ البائع لم يحدد وقت التحضير بعد"
   - **If vendor doesn't set time**: Shows warning message

✅ **إذا حدد البائع الوقت** (`actual_preparation_time > 0`):
   - يبدأ العداد فوراً
   - **If vendor sets time**: Timer starts immediately

🔄 **إذا غيّر البائع الوقت**:
   - يتم إعادة حساب `preparation_end` تلقائياً
   - **If vendor changes time**: `preparation_end` is recalculated automatically
