package com.driveralo.app;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.content.ContextCompat;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action)
                && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            return;
        }

        // Only start foreground service if location permission is granted
        boolean locationGranted = ContextCompat.checkSelfPermission(context,
            Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;

        if (!locationGranted) {
            android.util.Log.w("BootReceiver", "Location permission not granted — skipping service start");
            return;
        }

        try {
            Intent serviceIntent = new Intent(context, BackgroundOrderService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
            android.util.Log.d("BootReceiver", "Background service started after boot");
        } catch (Exception e) {
            android.util.Log.e("BootReceiver", "Failed to start service: " + e.getMessage());
        }
    }
}
