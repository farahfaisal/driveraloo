import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.driveralo.app',
  appName: 'سائق الو جيتك',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: [
      '*.supabase.co',
      'router.project-osrm.org',
      'https://*.supabase.co',
      'https://fliwyntfvfedslbwkvks.supabase.co'
    ]
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#9f1239",
      androidSplashResourceName: "ic_launcher",
      showSpinner: true,
      androidSpinnerStyle: "large",
      spinnerColor: "#ffffff",
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      style: "dark",
      backgroundColor: "#9f1239",
      overlaysWebView: true,
      androidOverlaysWebView: true
    },
    LocalNotifications: {
      smallIcon: "ic_notification",
      iconColor: "#eab308",
      sound: "notification.wav"
    },
    Geolocation: {
      permissions: {
        location: "always"
      }
    },
    App: {
      launchUrl: "capacitor://localhost",
      iosScheme: "capacitor",
      androidScheme: "https"
    }
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: "#1e293b",
    loggingBehavior: "none",
    buildOptions: {
      keystorePath: 'captain-release-key.keystore',
      keystorePassword: 'captain123',
      keystoreAlias: 'captain',
      keystoreAliasPassword: 'captain123'
    }
  },
  ios: {
    backgroundColor: "#1e293b",
    scheme: "الو جيتك"
  }
};

export default config;