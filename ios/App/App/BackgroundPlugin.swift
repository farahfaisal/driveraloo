import Foundation
import Capacitor

@objc(BackgroundPlugin)
public class BackgroundPlugin: CAPPlugin {
    
    @objc func startBackgroundService(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            // Start location tracking
            BackgroundLocationManager.shared.startMonitoring()
            
            // Setup background fetch
            BackgroundFetchManager.shared.setupBackgroundFetch()
            
            // Schedule local notification for testing if requested
            if let showTestNotification = call.getBool("showTestNotification"), showTestNotification {
                NotificationService.shared.scheduleLocalNotification(
                    title: "تم تفعيل الخدمة",
                    body: "تم تفعيل خدمة العمل في الخلفية"
                )
            }
            
            call.resolve(["success": true])
        }
    }
    
    @objc func stopBackgroundService(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            // Stop location tracking
            BackgroundLocationManager.shared.stopMonitoring()
            
            call.resolve(["success": true])
        }
    }
    
    @objc func showOrderNotification(_ call: CAPPluginCall) {
        guard let title = call.getString("title"), let content = call.getString("content") else {
            call.reject("Missing title or content")
            return
        }
        
        DispatchQueue.main.async {
            NotificationService.shared.scheduleOrderNotification(
                title: title,
                body: content
            )
            call.resolve(["success": true])
        }
    }
    
    @objc func getLastLocation(_ call: CAPPluginCall) {
        if let location = BackgroundLocationManager.shared.getLastLocation() {
            call.resolve([
                "latitude": location.coordinate.latitude,
                "longitude": location.coordinate.longitude,
                "accuracy": location.horizontalAccuracy,
                "altitude": location.altitude,
                "speed": location.speed,
                "timestamp": Int(location.timestamp.timeIntervalSince1970 * 1000)
            ])
        } else {
            call.reject("No location available")
        }
    }
}