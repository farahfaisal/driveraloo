package com.driveralo.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.content.Context;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

public class BackgroundOrderService extends Service {

    private static final String CHANNEL_ID = "DRIVER_SERVICE_CHANNEL";
    private static final String ORDER_CHANNEL_ID = "ORDER_NOTIFICATIONS";
    private static final int NOTIFICATION_ID = 1001;
    private static final int ORDER_NOTIFICATION_ID = 2001;
    private static final long WAKELOCK_TIMEOUT = 10 * 60 * 1000L; // 10 min max

    private Handler handler;
    private Runnable pingRunnable;
    private PowerManager.WakeLock wakeLock;
    private NotificationManager notificationManager;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        handler = new Handler(Looper.getMainLooper());

        // Acquire wake lock with timeout to prevent battery drain
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "DriverAlo::BgService");
                wakeLock.acquire(WAKELOCK_TIMEOUT);
            }
        } catch (Exception e) {
            android.util.Log.e("BgService", "WakeLock error: " + e.getMessage());
        }

        // Heartbeat - just keeps service alive, actual order polling is in the WebView
        pingRunnable = new Runnable() {
            @Override
            public void run() {
                android.util.Log.d("BgService", "heartbeat");
                handler.postDelayed(this, 30000); // every 30 seconds
            }
        };
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Must call startForeground immediately (within 5 seconds of startForegroundService)
        startForeground(NOTIFICATION_ID, buildServiceNotification("جاهز لاستقبال الطلبات"));
        handler.removeCallbacks(pingRunnable);
        handler.post(pingRunnable);
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();

        if (handler != null) handler.removeCallbacks(pingRunnable);

        if (wakeLock != null && wakeLock.isHeld()) {
            try { wakeLock.release(); } catch (Exception e) { /* ignore */ }
        }

        // Reschedule restart via BootReceiver logic (best-effort)
        android.util.Log.d("BgService", "Service destroyed — system will restart via START_STICKY");
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private Notification buildServiceNotification(String status) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("الو جيتك")
            .setContentText(status)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setAutoCancel(false)
            .build();
    }

    public void showOrderNotification(String title, String content) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra("openOrders", true);
        intent.putExtra("newOrderAlert", true);

        PendingIntent pendingIntent = PendingIntent.getActivity(this,
            (int) System.currentTimeMillis(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification orderNotification = new NotificationCompat.Builder(this, ORDER_CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(content)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setFullScreenIntent(pendingIntent, true)
            .setVibrate(new long[]{0, 500, 200, 500, 200, 500})
            .setLights(Color.RED, 1000, 1000)
            .build();

        if (notificationManager != null) {
            notificationManager.notify(ORDER_NOTIFICATION_ID + (int) System.currentTimeMillis(), orderNotification);
        }
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager == null) return;

            // Persistent service channel (silent)
            NotificationChannel serviceChannel = new NotificationChannel(
                CHANNEL_ID, "خدمة الو جيتك", NotificationManager.IMPORTANCE_LOW);
            serviceChannel.setDescription("خدمة تعمل في الخلفية");
            serviceChannel.enableLights(false);
            serviceChannel.enableVibration(false);
            serviceChannel.setShowBadge(false);
            serviceChannel.setLockscreenVisibility(Notification.VISIBILITY_SECRET);
            manager.createNotificationChannel(serviceChannel);

            // Order alert channel (loud)
            NotificationChannel orderChannel = new NotificationChannel(
                ORDER_CHANNEL_ID, "إشعارات الطلبات", NotificationManager.IMPORTANCE_HIGH);
            orderChannel.setDescription("إشعارات الطلبات الجديدة");
            orderChannel.enableLights(true);
            orderChannel.setLightColor(Color.RED);
            orderChannel.enableVibration(true);
            orderChannel.setVibrationPattern(new long[]{0, 500, 200, 500, 200, 500});
            orderChannel.setShowBadge(true);
            orderChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            orderChannel.setBypassDnd(true);
            manager.createNotificationChannel(orderChannel);
        }
    }
}
