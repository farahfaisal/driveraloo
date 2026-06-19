#!/bin/bash

echo "=== معلومات بناء التطبيق ==="
echo "Java Version: $(java -version 2>&1 | head -n 1)"
echo "Gradle Version: $(cd android && ./gradlew --version | grep 'Gradle')"
echo "Android Gradle Plugin: 8.2.0"
echo "Target Java: 17"
echo "Min SDK: 22"
echo "Target SDK: 34"
echo "Compile SDK: 34"
echo ""
echo "=== فحص إعدادات Java ==="
echo "JAVA_HOME: $JAVA_HOME"
echo "PATH Java: $(which java)"
echo ""
echo "=== بناء التطبيق ==="
cd android
echo "تنظيف المشروع..."
./gradlew clean
echo "بناء التطبيق..."
./gradlew assembleDebug
echo ""
echo "=== انتهى البناء ==="