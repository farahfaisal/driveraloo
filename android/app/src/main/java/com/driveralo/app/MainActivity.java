package com.driveralo.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.content.Context;
import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {

    private static final int PERM_CODE = 100;
    private static final int PERM_BG_LOCATION = 101;
    private boolean permissionsRequested = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Step 1: Request location + notification permissions
        // Do NOT start background service until permissions are resolved
        requestRequiredPermissions();

        handleNewOrderIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNewOrderIntent(intent);
    }

    private void requestRequiredPermissions() {
        if (permissionsRequested) return;
        permissionsRequested = true;

        List<String> needed = new ArrayList<>();

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.ACCESS_FINE_LOCATION);
            needed.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.POST_NOTIFICATIONS);
            }
        }

        if (!needed.isEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toArray(new String[0]), PERM_CODE);
        } else {
            onPermissionsReady();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions,
                                           @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == PERM_CODE) {
            onPermissionsReady();

            // Request background location separately (Android 10+ requirement)
            boolean hasFine = ContextCompat.checkSelfPermission(this,
                Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;

            if (hasFine && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                boolean hasBg = ContextCompat.checkSelfPermission(this,
                    Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED;
                if (!hasBg) {
                    ActivityCompat.requestPermissions(this,
                        new String[]{Manifest.permission.ACCESS_BACKGROUND_LOCATION},
                        PERM_BG_LOCATION);
                }
            }
        }
        // PERM_BG_LOCATION result — no action needed, service already started
    }

    private void onPermissionsReady() {
        boolean locationGranted = ContextCompat.checkSelfPermission(this,
            Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;

        if (locationGranted) {
            startBackgroundService();
        } else {
            android.util.Log.w("MainActivity", "Location permission not granted — background service not started");
        }

        requestIgnoreBatteryOptimization();
    }

    private void startBackgroundService() {
        try {
            Intent serviceIntent = new Intent(this, BackgroundOrderService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }
        } catch (Exception e) {
            android.util.Log.e("MainActivity", "startBackgroundService: " + e.getMessage());
        }
    }

    private void requestIgnoreBatteryOptimization() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                }
            } catch (Exception e) {
                android.util.Log.e("MainActivity", "batteryOpt: " + e.getMessage());
            }
        }
    }

    private void handleNewOrderIntent(Intent intent) {
        if (intent == null) return;
        boolean openOrders = intent.getBooleanExtra("openOrders", false)
            || intent.getBooleanExtra("newOrderAlert", false);

        if (!openOrders) return;

        runOnUiThread(() -> {
            try {
                getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED);
                getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);

                new Handler(Looper.getMainLooper()).postDelayed(() -> {
                    try {
                        getBridge().getWebView().evaluateJavascript(
                            "if(window.location.pathname !== '/orders'){ window.location.href='/orders'; }",
                            null
                        );
                    } catch (Exception e) {
                        android.util.Log.e("MainActivity", "JS navigate: " + e.getMessage());
                    }
                    new Handler(Looper.getMainLooper()).postDelayed(this::clearWindowFlags, 3000);
                }, 600);
            } catch (Exception e) {
                android.util.Log.e("MainActivity", "handleIntent: " + e.getMessage());
            }
        });
    }

    private void clearWindowFlags() {
        try {
            getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED);
            getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
            getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        } catch (Exception e) {
            android.util.Log.e("MainActivity", "clearFlags: " + e.getMessage());
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        boolean locationGranted = ContextCompat.checkSelfPermission(this,
            Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        if (locationGranted) {
            startBackgroundService();
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        clearWindowFlags();
    }

    @Override
    public void onStop() {
        super.onStop();
        clearWindowFlags();
    }

    @Override
    public void onBackPressed() {
        clearWindowFlags();
        super.onBackPressed();
    }
}
