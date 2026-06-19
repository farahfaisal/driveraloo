#!/bin/bash

echo "=== بناء تطبيق Captain Driver للاندرويد ==="
echo ""

# Check Java version
echo "فحص إصدار Java..."
java -version
echo ""

# Check if we're in the right directory
if [ ! -d "android" ]; then
    echo "❌ خطأ: مجلد android غير موجود"
    echo "يرجى تشغيل هذا السكريپت من المجلد الجذر للمشروع"
    exit 1
fi

# Build web assets first
echo "📦 بناء ملفات الويب..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ فشل في بناء ملفات الويب"
    exit 1
fi

# Sync with Capacitor
echo "🔄 مزامنة Capacitor..."
npx cap sync android
if [ $? -ne 0 ]; then
    echo "❌ فشل في مزامنة Capacitor"
    exit 1
fi

# Change to android directory
cd android

# Clean previous builds
echo "🧹 تنظيف البناءات السابقة..."
./gradlew clean
if [ $? -ne 0 ]; then
    echo "❌ فشل في تنظيف المشروع"
    exit 1
fi

# Build debug APK
echo "🔨 بناء APK تجريبي..."
./gradlew assembleDebug
if [ $? -ne 0 ]; then
    echo "❌ فشل في بناء APK التجريبي"
    exit 1
fi

echo ""
echo "✅ تم بناء APK بنجاح!"
echo "📱 مسار الملف: android/app/build/outputs/apk/debug/app-debug.apk"
echo ""

# Check if APK exists
if [ -f "app/build/outputs/apk/debug/app-debug.apk" ]; then
    APK_SIZE=$(du -h app/build/outputs/apk/debug/app-debug.apk | cut -f1)
    echo "📊 حجم APK: $APK_SIZE"
    echo ""
    echo "🎉 يمكنك الآن تثبيت التطبيق على جهازك!"
    echo "📋 للتثبيت: adb install app/build/outputs/apk/debug/app-debug.apk"
else
    echo "⚠️  لم يتم العثور على ملف APK في المسار المتوقع"
fi

echo ""
echo "=== انتهى البناء ==="