import UserNotifications
import UIKit

class NotificationService {
    static let shared = NotificationService()
    
    private init() {}
    
    func requestPermissions(completion: @escaping (Bool) -> Void) {
        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            if let error = error {
                print("Error requesting notification permissions: \(error)")
            }
            completion(granted)
        }
    }
    
    func scheduleLocalNotification(title: String, body: String, identifier: String? = nil, timeInterval: TimeInterval? = nil) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = UNNotificationSound(named: UNNotificationSoundName("notification.wav"))
        content.badge = 1
        
        // Create trigger (either immediate or delayed)
        let trigger: UNNotificationTrigger?
        if let interval = timeInterval {
            trigger = UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
        } else {
            trigger = nil
        }
        
        // Create request
        let id = identifier ?? UUID().uuidString
        let request = UNNotificationRequest(identifier: id, content: content, trigger: trigger)
        
        // Add request to notification center
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("Error scheduling notification: \(error)")
            }
        }
    }
    
    func scheduleOrderNotification(title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = UNNotificationSound(named: UNNotificationSoundName("order.wav"))
        content.badge = 1
        content.categoryIdentifier = "ORDER_CATEGORY"
        
        // Add actions
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
        
        // Create request with no trigger (immediate delivery)
        let request = UNNotificationRequest(
            identifier: "order-\(UUID().uuidString)",
            content: content,
            trigger: nil
        )
        
        // Add request to notification center
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("Error scheduling order notification: \(error)")
            }
        }
    }
    
    func cancelAllNotifications() {
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
    }
    
    func clearBadge() {
        DispatchQueue.main.async {
            UIApplication.shared.applicationIconBadgeNumber = 0
        }
    }
}