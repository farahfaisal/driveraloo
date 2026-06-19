#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Define the plugin using the CAP_PLUGIN macro.
CAP_PLUGIN(BackgroundPlugin, "BackgroundService",
           CAP_PLUGIN_METHOD(startBackgroundService, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(stopBackgroundService, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(showOrderNotification, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getLastLocation, CAPPluginReturnPromise);
)