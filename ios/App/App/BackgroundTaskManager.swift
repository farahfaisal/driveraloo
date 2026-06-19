import Foundation
import UIKit
import BackgroundTasks

@available(iOS 13.0, *)
class BackgroundTaskManager {
    static let shared = BackgroundTaskManager()
    
    private init() {}
    
    func registerBackgroundTasks() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: "com.jetk.app.refresh", using: nil) { task in
            self.handleAppRefresh(task: task as! BGAppRefreshTask)
        }
        
        BGTaskScheduler.shared.register(forTaskWithIdentifier: "com.jetk.app.processing", using: nil) { task in
            self.handleBackgroundProcessing(task: task as! BGProcessingTask)
        }
    }
    
    func scheduleAppRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: "com.jetk.app.refresh")
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60) // 15 minutes
        
        do {
            try BGTaskScheduler.shared.submit(request)
            print("Background app refresh scheduled")
        } catch {
            print("Could not schedule app refresh: \(error)")
        }
    }
    
    func scheduleBackgroundProcessing() {
        let request = BGProcessingTaskRequest(identifier: "com.jetk.app.processing")
        request.requiresNetworkConnectivity = true
        request.requiresExternalPower = false
        request.earliestBeginDate = Date(timeIntervalSinceNow: 5 * 60) // 5 minutes
        
        do {
            try BGTaskScheduler.shared.submit(request)
            print("Background processing scheduled")
        } catch {
            print("Could not schedule background processing: \(error)")
        }
    }
    
    func handleAppRefresh(task: BGAppRefreshTask) {
        // Schedule a new refresh task
        scheduleAppRefresh()
        
        // Create a task expiration handler
        task.expirationHandler = {
            // Cancel any ongoing work
            task.setTaskCompleted(success: false)
        }
        
        // Check for new orders
        checkForNewOrders { success in
            // Inform the system that the task is complete
            task.setTaskCompleted(success: success)
        }
    }
    
    func handleBackgroundProcessing(task: BGProcessingTask) {
        // Schedule a new processing task
        scheduleBackgroundProcessing()
        
        // Create a task expiration handler
        task.expirationHandler = {
            // Cancel any ongoing work
            task.setTaskCompleted(success: false)
        }
        
        // Perform background processing
        performBackgroundProcessing { success in
            // Inform the system that the task is complete
            task.setTaskCompleted(success: success)
        }
    }
    
    func checkForNewOrders(completion: @escaping (Bool) -> Void) {
        // This would typically make a network request to check for new orders
        // For demonstration, we'll just simulate a successful check
        
        // In a real app, you would:
        // 1. Make an API call to check for new orders
        // 2. If new orders are found, show a notification
        // 3. Call completion(true) when done
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            // Show a test notification
            self.showLocalNotification(title: "تحقق من الطلبات", body: "تم التحقق من الطلبات الجديدة في الخلفية")
            completion(true)
        }
    }
    
    func performBackgroundProcessing(completion: @escaping (Bool) -> Void) {
        // This would perform more intensive background tasks
        // For demonstration, we'll just simulate a successful process
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
            completion(true)
        }
    }
    
    func showLocalNotification(title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = UNNotificationSound(named: UNNotificationSoundName("notification.wav"))
        
        // Show immediately
        let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
    }
}