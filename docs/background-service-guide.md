# دليل العمل في الخلفية - سائق كابتن طيار

## 📋 فهرس المحتويات
1. [نظرة عامة](#نظرة-عامة)
2. [Android - الأندرويد](#android---الأندرويد)
3. [iOS - الآيفون](#ios---الآيفون)
4. [Web - المتصفح](#web---المتصفح)
5. [React Hooks](#react-hooks)
6. [إعدادات التطبيق](#إعدادات-التطبيق)

---

## نظرة عامة

التطبيق يستخدم عدة تقنيات للعمل في الخلفية:
- **Android**: Foreground Service + Background Tasks
- **iOS**: Background App Refresh + Location Updates
- **Web**: Service Worker + Notifications API

---

## Android - الأندرويد

### 1. الخدمة الرئيسية (BackgroundOrderService.java)

**الموقع:** `android/app/src/main/java/com/tayardriver/app/BackgroundOrderService.java`

```java
package com.tayardriver.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.IBinder;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.content.Context;
import androidx.core.app.NotificationCompat;
import androidx.annotation.Nullable;

public class BackgroundOrderService extends Service {
    private static final String CHANNEL_ID = "DRIVER_SERVICE_CHANNEL";
    private static final String ORDER_CHANNEL_ID = "ORDER_NOTIFICATIONS";
    private static final int NOTIFICATION_ID = 1001;
    private static final int ORDER_NOTIFICATION_ID = 2001;
    
    private Handler handler;
    private Runnable checkOrdersRunnable;
    private PowerManager.WakeLock wakeLock;
    private NotificationManager notificationManager;
    
    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
        
        // الحصول على Wake Lock لإبقاء المعالج يعمل
        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "CaptainDriver::BackgroundService");
        wakeLock.acquire();
        
        handler = new Handler(Looper.getMainLooper());
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        
        // فحص الطلبات كل 15 ثانية
        checkOrdersRunnable = new Runnable() {
            @Override
            public void run() {
                checkForNewOrders();
                // جدولة الفحص التالي
                handler.postDelayed(this, 15000); // 15 ثانية
            }
        };
    }
    
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // إنشاء إشعار دائم في المقدمة
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent, 
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("سائق كابتن طيار نشط")
                .setContentText("التطبيق يعمل في الخلفية - جاهز لاستقبال الطلبات")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setAutoCancel(false)
                .setShowWhen(true)
                .build();
        
        startForeground(NOTIFICATION_ID, notification);
        
        // بدء فحص الطلبات
        handler.post(checkOrdersRunnable);
        
        // إرجاع START_STICKY لإعادة تشغيل الخدمة إذا أوقفها النظام
        return START_STICKY;
    }
    
    @Override
    public void onDestroy() {
        super.onDestroy();
        
        // تحرير Wake Lock
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        
        // إيقاف Handler
        if (handler != null && checkOrdersRunnable != null) {
            handler.removeCallbacks(checkOrdersRunnable);
        }
        
        // إعادة تشغيل الخدمة تلقائياً
        Intent restartIntent = new Intent(this, BackgroundOrderService.class);
        PendingIntent restartPendingIntent = PendingIntent.getService(this, 1, restartIntent, 
            PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE);
        
        try {
            restartPendingIntent.send();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
    
    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
    
    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // قناة إشعارات الخدمة
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "خدمة سائق كابتن طيار",
                    NotificationManager.IMPORTANCE_LOW
            );
            serviceChannel.setDescription("خدمة تعمل في الخلفية للبحث عن طلبات جديدة");
            serviceChannel.enableLights(false);
            serviceChannel.enableVibration(false);
            serviceChannel.setShowBadge(false);
            serviceChannel.setLockscreenVisibility(Notification.VISIBILITY_SECRET);
            
            // قناة إشعارات الطلبات
            NotificationChannel orderChannel = new NotificationChannel(
                    ORDER_CHANNEL_ID,
                    "إشعارات الطلبات",
                    NotificationManager.IMPORTANCE_HIGH
            );
            orderChannel.setDescription("إشعارات الطلبات الجديدة");
            orderChannel.enableLights(true);
            orderChannel.setLightColor(Color.RED);
            orderChannel.enableVibration(true);
            orderChannel.setVibrationPattern(new long[]{0, 300, 200, 300});
            orderChannel.setShowBadge(true);
            orderChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(serviceChannel);
                manager.createNotificationChannel(orderChannel);
            }
        }
    }
    
    private void checkForNewOrders() {
        // هذه الدالة تفحص الطلبات الجديدة
        // في التطبيق الحقيقي، ستقوم بـ:
        // 1. إرسال طلب HTTP لـ API
        // 2. فحص الطلبات الجديدة
        // 3. إظهار إشعار إذا وُجدت طلبات جديدة
        
        updateServiceNotification("آخر فحص: " + new java.text.SimpleDateFormat("HH:mm:ss").format(new java.util.Date()));
    }
    
    private void updateServiceNotification(String status) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent, 
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("سائق كابتن طيار نشط")
                .setContentText("يعمل في الخلفية - " + status)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setAutoCancel(false)
                .setShowWhen(true)
                .build();
        
        if (notificationManager != null) {
            notificationManager.notify(NOTIFICATION_ID, notification);
        }
    }
    
    // دالة لإظهار إشعار طلب جديد
    public void showOrderNotification(String title, String content) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("openOrders", true);
        
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, 
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        
        Notification orderNotification = new NotificationCompat.Builder(this, ORDER_CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(content)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setFullScreenIntent(pendingIntent, true)
                .build();
        
        if (notificationManager != null) {
            notificationManager.notify(ORDER_NOTIFICATION_ID, orderNotification);
        }
    }
}
```

### 2. استقبال إعادة التشغيل (BootReceiver.java)

**الموقع:** `android/app/src/main/java/com/tayardriver/app/BootReceiver.java`

```java
package com.tayardriver.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction()) ||
            Intent.ACTION_MY_PACKAGE_REPLACED.equals(intent.getAction()) ||
            Intent.ACTION_PACKAGE_REPLACED.equals(intent.getAction())) {
            
            // تشغيل الخدمة الخلفية بعد إعادة التشغيل
            Intent serviceIntent = new Intent(context, BackgroundOrderService.class);
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
        }
    }
}
```

### 3. النشاط الرئيسي (MainActivity.java)

**الموقع:** `android/app/src/main/java/com/tayardriver/app/MainActivity.java`

```java
package com.tayardriver.app;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.content.ComponentName;
import android.content.ServiceConnection;
import android.os.IBinder;
import android.net.Uri;
import android.os.PowerManager;
import android.content.Context;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private BackgroundOrderService backgroundService;
    private boolean serviceBound = false;
    
    private ServiceConnection serviceConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            serviceBound = true;
        }
        
        @Override
        public void onServiceDisconnected(ComponentName name) {
            serviceBound = false;
        }
    };
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate();
        
        // طلب استثناء من تحسين البطارية
        requestIgnoreBatteryOptimization();
        
        // تشغيل الخدمة الخلفية
        startBackgroundService();
        
        // ربط الخدمة للتواصل
        Intent bindIntent = new Intent(this, BackgroundOrderService.class);
        bindService(bindIntent, serviceConnection, Context.BIND_AUTO_CREATE);
    }
    
    private void requestIgnoreBatteryOptimization() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + getPackageName()));
                try {
                    startActivity(intent);
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }
    }
    
    private void startBackgroundService() {
        Intent serviceIntent = new Intent(this, BackgroundOrderService.class);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
    }
    
    @Override
    public void onResume() {
        super.onResume();
        // التأكد من تشغيل الخدمة عند العودة للمقدمة
        startBackgroundService();
    }
    
    @Override
    public void onDestroy() {
        super.onDestroy();
        if (serviceBound) {
            unbindService(serviceConnection);
            serviceBound = false;
        }
    }
    
    @Override
    public void onPause() {
        super.onPause();
        // إبقاء الخدمة تعمل عند الانتقال للخلفية
        startBackgroundService();
    }
}
```

### 4. إعدادات Android Manifest

**الموقع:** `android/app/src/main/AndroidManifest.xml`

```xml
<!-- الأذونات المطلوبة -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />

<!-- تسجيل الخدمة الخلفية -->
<service
    android:name=".BackgroundOrderService"
    android:enabled="true"
    android:exported="false"
    android:foregroundServiceType="location" />

<!-- مستقبل إعادة التشغيل -->
<receiver
    android:name=".BootReceiver"
    android:enabled="true"
    android:exported="true">
    <intent-filter android:priority="1000">
        <action android:name="android.intent.action.BOOT_COMPLETED" />
        <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
        <action android:name="android.intent.action.PACKAGE_REPLACED" />
        <data android:scheme="package" />
    </intent-filter>
</receiver>
```

---

## iOS - الآيفون

### 1. مدير التطبيق (AppDelegate.swift)

**الموقع:** `ios/App/App/AppDelegate.swift`

```swift
import UIKit
import Capacitor
import UserNotifications
import BackgroundTasks

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    var window: UIWindow?
    var backgroundTask: UIBackgroundTaskIdentifier = .invalid
    var backgroundUpdateTask: BGProcessingTask?
    var backgroundTimer: Timer?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        
        // تسجيل للإشعارات
        UNUserNotificationCenter.current().delegate = self
        
        // طلب أذونات الإشعارات
        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            if granted {
                print("تم منح إذن الإشعارات")
                DispatchQueue.main.async {
                    application.registerForRemoteNotifications()
                }
            }
        }
        
        // تسجيل المهام الخلفية
        if #available(iOS 13.0, *) {
            BGTaskScheduler.shared.register(forTaskWithIdentifier: "com.benedekd.app.refresh", using: nil) { task in
                self.handleAppRefresh(task: task as! BGAppRefreshTask)
            }
            
            BGTaskScheduler.shared.register(forTaskWithIdentifier: "com.benedekd.app.processing", using: nil) { task in
                self.handleBackgroundProcessing(task: task as! BGProcessingTask)
            }
        }
        
        return true
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // بدء المهمة الخلفية
        self.startBackgroundTask()
        
        // جدولة المهام الخلفية
        if #available(iOS 13.0, *) {
            self.scheduleAppRefresh()
            self.scheduleBackgroundProcessing()
        }
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // إنهاء المهمة الخلفية
        self.endBackgroundTask()
    }
    
    // بدء المهمة الخلفية
    func startBackgroundTask() {
        if backgroundTask != .invalid {
            endBackgroundTask()
        }
        
        backgroundTask = UIApplication.shared.beginBackgroundTask { [weak self] in
            self?.endBackgroundTask()
        }
        
        // بدء مؤقت للفحص الدوري
        backgroundTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            self?.checkForNewOrders()
        }
    }
    
    func endBackgroundTask() {
        if backgroundTask != .invalid {
            UIApplication.shared.endBackgroundTask(backgroundTask)
            backgroundTask = .invalid
        }
        
        backgroundTimer?.invalidate()
        backgroundTimer = nil
    }
    
    func checkForNewOrders() {
        // فحص الطلبات الجديدة
        // في التطبيق الحقيقي:
        // 1. إرسال طلب API للفحص
        // 2. إظهار إشعار إذا وُجدت طلبات
    }
    
    // جدولة تحديث التطبيق
    @available(iOS 13.0, *)
    func scheduleAppRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: "com.benedekd.app.refresh")
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60) // 15 دقيقة
        
        do {
            try BGTaskScheduler.shared.submit(request)
            print("تم جدولة تحديث التطبيق في الخلفية")
        } catch {
            print("فشل في جدولة تحديث التطبيق: \(error)")
        }
    }
}
```

### 2. مدير المهام الخلفية (BackgroundTaskManager.swift)

**الموقع:** `ios/App/App/BackgroundTaskManager.swift`

```swift
import Foundation
import UIKit
import BackgroundTasks

@available(iOS 13.0, *)
class BackgroundTaskManager {
    static let shared = BackgroundTaskManager()
    
    private init() {}
    
    func registerBackgroundTasks() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: "com.benedekd.app.refresh", using: nil) { task in
            self.handleAppRefresh(task: task as! BGAppRefreshTask)
        }
        
        BGTaskScheduler.shared.register(forTaskWithIdentifier: "com.benedekd.app.processing", using: nil) { task in
            self.handleBackgroundProcessing(task: task as! BGProcessingTask)
        }
    }
    
    func scheduleAppRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: "com.benedekd.app.refresh")
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60) // 15 دقيقة
        
        do {
            try BGTaskScheduler.shared.submit(request)
            print("تم جدولة تحديث الخلفية")
        } catch {
            print("فشل في الجدولة: \(error)")
        }
    }
    
    func handleAppRefresh(task: BGAppRefreshTask) {
        // جدولة مهمة جديدة
        scheduleAppRefresh()
        
        // معالج انتهاء المهمة
        task.expirationHandler = {
            task.setTaskCompleted(success: false)
        }
        
        // فحص الطلبات الجديدة
        checkForNewOrders { success in
            task.setTaskCompleted(success: success)
        }
    }
    
    func checkForNewOrders(completion: @escaping (Bool) -> Void) {
        // فحص الطلبات الجديدة
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            completion(true)
        }
    }
}
```

### 3. خدمة الإشعارات (NotificationService.swift)

**الموقع:** `ios/App/App/NotificationService.swift`

```swift
import UserNotifications
import UIKit

class NotificationService {
    static let shared = NotificationService()
    
    private init() {}
    
    func scheduleOrderNotification(title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = UNNotificationSound(named: UNNotificationSoundName("order.wav"))
        content.badge = 1
        content.categoryIdentifier = "ORDER_CATEGORY"
        
        // إضافة أزرار التفاعل
        let acceptAction = UNNotificationAction(
            identifier: "ACCEPT_ACTION",
            title: "قبول الطلب",
            options: [.foreground]
        )
        
        let viewAction = UNNotificationAction(
            identifier: "VIEW_ACTION",
            title: "عرض التفاصيل",
            options: [.foreground]
        )
        
        let category = UNNotificationCategory(
            identifier: "ORDER_CATEGORY",
            actions: [acceptAction, viewAction],
            intentIdentifiers: [],
            options: [.customDismissAction]
        )
        
        UNUserNotificationCenter.current().setNotificationCategories([category])
        
        // إنشاء طلب الإشعار
        let request = UNNotificationRequest(
            identifier: "order-\(UUID().uuidString)",
            content: content,
            trigger: nil // إظهار فوري
        )
        
        // إضافة الطلب لمركز الإشعارات
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("خطأ في جدولة إشعار الطلب: \(error)")
            }
        }
    }
}
```

---

## Web - المتصفح

### 1. Service Worker

**الموقع:** `public/sw.js`

```javascript
// Service Worker بسيط للإشعارات المحسنة
const CACHE_NAME = 'captain-driver-v1';
const urlsToCache = [
  '/',
  '/orders',
  '/dashboard',
  '/my-trips',
  '/wallet',
  '/settings',
  '/map'
];

self.addEventListener('install', (event) => {
  console.log('تم تثبيت Service Worker');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('تم فتح الذاكرة المؤقتة');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('تم تفعيل Service Worker');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// التعامل مع طلبات الشبكة للعمل بدون اتصال
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request);
      }
    )
  );
});

// المزامنة الخلفية لفحص الطلبات
self.addEventListener('sync', (event) => {
  if (event.tag === 'check-orders') {
    event.waitUntil(checkForNewOrders());
  }
});

// المزامنة الدورية (إذا كانت مدعومة)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-orders-periodic') {
    event.waitUntil(checkForNewOrders());
  }
});

// التعامل مع النقر على الإشعارات
self.addEventListener('notificationclick', (event) => {
  console.log('تم النقر على الإشعار:', event.notification);
  
  event.notification.close();
  
  // التركيز على نافذة التطبيق أو فتح نافذة جديدة
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          return client.navigate('/orders');
        }
      }
      
      return self.clients.openWindow('/orders');
    })
  );
});

// التعامل مع رسائل Push (للاستخدام المستقبلي)
self.addEventListener('push', (event) => {
  console.log('تم استلام رسالة Push:', event);
  
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'طلب جديد متاح',
      icon: '/notification-icon.svg',
      badge: '/notification-icon.svg',
      tag: 'new-order',
      renotify: true,
      requireInteraction: true,
      vibrate: [300, 150, 300, 150, 300],
      actions: [
        {
          action: 'view',
          title: 'عرض الطلب'
        },
        {
          action: 'dismiss',
          title: 'إغلاق'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'طلب جديد!', options)
    );
  }
});
```

---

## React Hooks

### 1. Hook الخدمة الخلفية

**الموقع:** `src/hooks/useBackgroundService.ts`

```typescript
import { useEffect, useCallback } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';

interface BackgroundServicePlugin {
  startBackgroundService(): Promise<{ success: boolean }>;
  stopBackgroundService(): Promise<{ success: boolean }>;
  showOrderNotification(options: { title: string; content: string }): Promise<{ success: boolean }>;
}

// تسجيل البرنامج المساعد
const BackgroundService = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
  ? registerPlugin<BackgroundServicePlugin>('BackgroundService')
  : {
      startBackgroundService: async () => ({ success: true }),
      stopBackgroundService: async () => ({ success: true }),
      showOrderNotification: async () => ({ success: true })
    };

export function useBackgroundService() {
  // دالة لإظهار إشعار الطلب
  const showOrderNotification = useCallback(async (title: string, content: string) => {
    try {
      console.log('إظهار إشعار الطلب:', { title, content });
      
      if (Capacitor.isNativePlatform()) {
        if (Capacitor.getPlatform() === 'android') {
          // استخدام خدمة Android الأصلية
          await BackgroundService.showOrderNotification({ title, content });
          console.log('تم إرسال إشعار Android');
        } else if (Capacitor.getPlatform() === 'ios') {
          // على iOS، استخدام الإشعارات المحلية مباشرة
          await LocalNotifications.schedule({
            notifications: [
              {
                silent: false,
                title,
                body: content,
                id: Date.now(),
                sound: 'notification.wav',
                attachments: [],
                actionTypeId: 'ORDER',
                extra: {
                  isOrder: true
                }
              }
            ]
          });
          console.log('تم إرسال إشعار iOS');
        }
      } else {
        // للمتصفح، إظهار إشعار متقدم
        if ('Notification' in window && Notification.permission === 'granted') {
          const notification = new Notification(title, {
            body: content,
            icon: '/notification-icon.svg',
            tag: 'new-order',
            renotify: true,
            requireInteraction: true,
            vibrate: [300, 150, 300, 150, 300],
            silent: false,
            badge: '/notification-icon.svg'
          });
          
          notification.onclick = () => {
            window.focus();
            notification.close();
            if (window.location.pathname !== '/orders') {
              window.location.href = '/orders';
            }
          };
          
          setTimeout(() => {
            notification.close();
          }, 45000);
          
          console.log('تم إرسال إشعار المتصفح');
        }
      }
    } catch (error) {
      console.error('فشل في إظهار إشعار الطلب:', error);
    }
  }, []);

  // إعداد الخدمة الخلفية عند تحميل التطبيق
  useEffect(() => {
    const setupBackgroundService = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          if (Capacitor.getPlatform() === 'android') {
            // بدء خدمة Android الخلفية
            await BackgroundService.startBackgroundService();
            console.log('تم بدء خدمة Android الخلفية');
            
            // تسجيل للمزامنة الخلفية إذا كانت متاحة
            if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
              try {
                const registration = await navigator.serviceWorker.ready;
                await registration.sync.register('check-orders');
                console.log('تم تسجيل المزامنة الخلفية');
              } catch (error) {
                console.warn('المزامنة الخلفية غير مدعومة:', error);
              }
            }
          } else if (Capacitor.getPlatform() === 'ios') {
            // لـ iOS، استخدام أوضاع الخلفية المدمجة
            App.addListener('appStateChange', ({ isActive }) => {
              console.log('تغيرت حالة التطبيق. نشط:', isActive);
              
              if (!isActive) {
                console.log('انتقل التطبيق للخلفية');
                localStorage.setItem('app_last_background_time', new Date().toISOString());
              } else {
                console.log('عاد التطبيق للمقدمة');
                const lastBackgroundTime = localStorage.getItem('app_last_background_time');
                if (lastBackgroundTime) {
                  const timeDiff = Date.now() - new Date(lastBackgroundTime).getTime();
                  if (timeDiff > 60000) { // إذا كان أكثر من دقيقة في الخلفية
                    window.dispatchEvent(new CustomEvent('app-foreground-refresh'));
                  }
                }
              }
            });
            
            console.log('تم إعداد أوضاع iOS الخلفية');
          }
        } catch (error) {
          console.error('فشل في إعداد الخدمة الخلفية:', error);
        }
      } else {
        // للمتصفحات، تسجيل Service Worker
        if ('serviceWorker' in navigator) {
          try {
            await navigator.serviceWorker.register('/sw.js');
            console.log('تم تسجيل Service Worker');
            
            // تسجيل للمزامنة الخلفية
            if ('sync' in window.ServiceWorkerRegistration.prototype) {
              try {
                const registration = await navigator.serviceWorker.ready;
                await registration.sync.register('check-orders');
                console.log('تم تسجيل المزامنة الخلفية للمتصفح');
              } catch (error) {
                console.warn('فشل تسجيل المزامنة الخلفية:', error);
              }
            }
          } catch (error) {
            console.warn('فشل تسجيل Service Worker:', error);
          }
        }
      }
    };

    setupBackgroundService();

    // دالة التنظيف
    return () => {
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
        BackgroundService.stopBackgroundService().catch(err => {
          console.error('فشل في إيقاف الخدمة الخلفية:', err);
        });
      }
      
      App.removeAllListeners();
    };
  }, []);

  return {
    showOrderNotification,
    startService: async () => {
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
        return BackgroundService.startBackgroundService();
      }
      return { success: true };
    },
    stopService: async () => {
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
        return BackgroundService.stopBackgroundService();
      }
      return { success: true };
    }
  };
}
```

---

## إعدادات التطبيق

### 1. إعدادات Capacitor

**الموقع:** `capacitor.config.ts`

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tayardriver.app',
  appName: 'سائق كابتن طيار',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'localhost',
    cleartext: true,
    allowNavigation: [
      'localhost',
      '*.supabase.co',
      'router.project-osrm.org'
    ]
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#dc2626"
    },
    StatusBar: {
      style: "dark",
      backgroundColor: "#b91c1c"
    },
    LocalNotifications: {
      smallIcon: "ic_notification",
      iconColor: "#dc2626",
      sound: "notification.wav"
    },
    Geolocation: {
      permissions: {
        location: "always"
      }
    }
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
    backgroundColor: "#dc2626"
  },
  ios: {
    backgroundColor: "#dc2626",
    scheme: "Captain Driver"
  }
};

export default config;
```

### 2. إعدادات iOS Info.plist

**الموقع:** `ios/App/App/Info.plist`

```xml
<!-- أوضاع الخلفية -->
<key>UIBackgroundModes</key>
<array>
    <string>fetch</string>
    <string>location</string>
    <string>processing</string>
    <string>remote-notification</string>
</array>

<!-- معرفات المهام المسموحة -->
<key>BGTaskSchedulerPermittedIdentifiers</key>
<array>
    <string>com.benedekd.app.refresh</string>
    <string>com.benedekd.app.processing</string>
</array>

<!-- أذونات الموقع -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>يحتاج التطبيق للوصول للموقع لإظهار الطلبات القريبة وحساب المسافات.</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>يحتاج التطبيق للوصول للموقع لتتبع موقعك أثناء التوصيل وإظهار الطلبات القريبة.</string>
```

---

## 🔧 كيفية التعديل والتطوير

### لإضافة ميزة جديدة للخلفية:

1. **Android**: عدّل `BackgroundOrderService.java`
2. **iOS**: عدّل `AppDelegate.swift` أو `BackgroundTaskManager.swift`
3. **Web**: عدّل `public/sw.js`
4. **React**: عدّل `useBackgroundService.ts`

### لتغيير فترة الفحص:

**Android**: غيّر `15000` في `BackgroundOrderService.java`
**iOS**: غيّر `15 * 60` في `scheduleAppRefresh()`
**Web**: غيّر `60000` في Service Worker

### لإضافة إشعارات جديدة:

استخدم `showOrderNotification()` من `useBackgroundService` hook

---

## 🚀 نصائح للتطوير

1. **اختبار Android**: استخدم `adb logcat` لمراقبة السجلات
2. **اختبار iOS**: استخدم Xcode Console
3. **اختبار Web**: استخدم Developer Tools > Application > Service Workers
4. **التصحيح**: فعّل `webContentsDebuggingEnabled` في Capacitor config

هذا الدليل يحتوي على جميع أكواد العمل في الخلفية مع شرح مفصل لكل جزء! 📚