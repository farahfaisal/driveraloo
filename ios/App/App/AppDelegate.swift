import UIKit
import Capacitor
import UserNotifications
import BackgroundTasks
import FirebaseCore
import FirebaseMessaging

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate, MessagingDelegate {

    var window: UIWindow?
    var backgroundTask: UIBackgroundTaskIdentifier = .invalid
    var backgroundUpdateTask: BGProcessingTask?
    var backgroundTimer: Timer?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Configure Firebase
        FirebaseApp.configure()

        // Set messaging delegate
        Messaging.messaging().delegate = self

        // Register for push notifications
        UNUserNotificationCenter.current().delegate = self

        // Request notification permissions
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            if granted {
                print("[APNS] Notification permission granted")
                DispatchQueue.main.async {
                    application.registerForRemoteNotifications()
                }
            } else {
                print("[APNS] Notification permission denied: \(String(describing: error))")
            }
        }

        // Register background tasks
        if #available(iOS 13.0, *) {
            BGTaskScheduler.shared.register(forTaskWithIdentifier: "com.jetk.app.refresh", using: nil) { task in
                self.handleAppRefresh(task: task as! BGAppRefreshTask)
            }
            BGTaskScheduler.shared.register(forTaskWithIdentifier: "com.jetk.app.processing", using: nil) { task in
                self.handleBackgroundProcessing(task: task as! BGProcessingTask)
            }
        }

        return true
    }

    // MARK: - Firebase Messaging Delegate

    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken else { return }
        print("[FCM] iOS FCM Token: \(token)")
        // Notify Capacitor plugin so it triggers the 'registration' event in JS
        NotificationCenter.default.post(
            name: Notification.Name("CapacitorDidRegisterForRemoteNotifications"),
            object: token
        )
    }

    // MARK: - APNs Token — Forward to Firebase & Capacitor

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        // Give APNs token to Firebase so it can exchange for FCM token
        Messaging.messaging().apnsToken = deviceToken

        // Also forward to Capacitor for its own handling
        ApplicationDelegateProxy.shared.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("[APNS] Failed to register: \(error)")
        ApplicationDelegateProxy.shared.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
    }

    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        // Let Firebase handle it
        if !Messaging.messaging().appDidReceiveMessage(userInfo).rawValue.isEmpty { }

        // Show local notification if app is in background
        if let aps = userInfo["aps"] as? [String: Any],
           let alert = aps["alert"] as? [String: Any],
           let title = alert["title"] as? String,
           let body = alert["body"] as? String,
           application.applicationState != .active {
            showLocalNotification(title: title, body: body)
        }

        ApplicationDelegateProxy.shared.application(application, didReceiveRemoteNotification: userInfo, fetchCompletionHandler: completionHandler)
    }

    // MARK: - UNUserNotificationCenterDelegate

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.alert, .sound, .badge])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        ApplicationDelegateProxy.shared.userNotificationCenter(center, didReceive: response, withCompletionHandler: completionHandler)
    }

    // MARK: - App Lifecycle

    func applicationWillResignActive(_ application: UIApplication) { }

    func applicationDidEnterBackground(_ application: UIApplication) {
        startBackgroundTask()
        if #available(iOS 13.0, *) {
            scheduleAppRefresh()
            scheduleBackgroundProcessing()
        }
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        endBackgroundTask()
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        application.applicationIconBadgeNumber = 0
    }

    func applicationWillTerminate(_ application: UIApplication) {
        endBackgroundTask()
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    // MARK: - Background Task Handling

    func startBackgroundTask() {
        if backgroundTask != .invalid { endBackgroundTask() }
        backgroundTask = UIApplication.shared.beginBackgroundTask { [weak self] in
            self?.endBackgroundTask()
        }
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
        // Background check — actual orders come via FCM push
    }

    func showLocalNotification(title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = UNNotificationSound(named: UNNotificationSoundName("notification.wav"))
        content.badge = 1
        let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
    }

    // MARK: - iOS 13+ Background Tasks

    @available(iOS 13.0, *)
    func scheduleAppRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: "com.jetk.app.refresh")
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
        try? BGTaskScheduler.shared.submit(request)
    }

    @available(iOS 13.0, *)
    func scheduleBackgroundProcessing() {
        let request = BGProcessingTaskRequest(identifier: "com.jetk.app.processing")
        request.requiresNetworkConnectivity = true
        request.earliestBeginDate = Date(timeIntervalSinceNow: 5 * 60)
        try? BGTaskScheduler.shared.submit(request)
    }

    @available(iOS 13.0, *)
    func handleAppRefresh(task: BGAppRefreshTask) {
        scheduleAppRefresh()
        task.expirationHandler = { task.setTaskCompleted(success: false) }
        checkForNewOrders()
        task.setTaskCompleted(success: true)
    }

    @available(iOS 13.0, *)
    func handleBackgroundProcessing(task: BGProcessingTask) {
        scheduleBackgroundProcessing()
        task.expirationHandler = { task.setTaskCompleted(success: false) }
        checkForNewOrders()
        task.setTaskCompleted(success: true)
    }
}

    var window: UIWindow?
    var backgroundTask: UIBackgroundTaskIdentifier = .invalid
    var backgroundUpdateTask: BGProcessingTask?
    var backgroundTimer: Timer?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        
        // Register for push notifications
        UNUserNotificationCenter.current().delegate = self
        
        // Request notification permissions
        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            if granted {
                print("Notification permission granted")
                DispatchQueue.main.async {
                    application.registerForRemoteNotifications()
                }
            } else {
                print("Notification permission denied")
            }
        }
        
        // Register background tasks
        if #available(iOS 13.0, *) {
            BGTaskScheduler.shared.register(forTaskWithIdentifier: "com.jetk.app.refresh", using: nil) { task in
                self.handleAppRefresh(task: task as! BGAppRefreshTask)
            }
            
            BGTaskScheduler.shared.register(forTaskWithIdentifier: "com.jetk.app.processing", using: nil) { task in
                self.handleBackgroundProcessing(task: task as! BGProcessingTask)
            }
        }
        
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
        
        // Start background task to keep app running longer
        self.startBackgroundTask()
        
        // Schedule background tasks
        if #available(iOS 13.0, *) {
            self.scheduleAppRefresh()
            self.scheduleBackgroundProcessing()
        }
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
        
        // End background task if running
        self.endBackgroundTask()
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
        
        // Clear badge count
        application.applicationIconBadgeNumber = 0
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
        self.endBackgroundTask()
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
    
    // MARK: - Push Notification Handling
    
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        // Forward the token to your server
        let tokenParts = deviceToken.map { data in String(format: "%02.2hhx", data) }
        let token = tokenParts.joined()
        print("Device Token: \(token)")
        
        // You would typically send this token to your server
        NotificationCenter.default.post(name: Notification.Name("PUSH_REGISTRATION_SUCCESS"), object: token)
    }
    
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("Failed to register for remote notifications: \(error)")
        NotificationCenter.default.post(name: Notification.Name("PUSH_REGISTRATION_ERROR"), object: error)
    }
    
    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable : Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        // Handle push notification when app is in background
        print("Received remote notification: \(userInfo)")
        
        // Process the notification data
        if let aps = userInfo["aps"] as? [String: Any] {
            if let alert = aps["alert"] as? [String: Any], 
               let title = alert["title"] as? String, 
               let body = alert["body"] as? String {
                // Show local notification if app is in background
                if application.applicationState == .background || application.applicationState == .inactive {
                    self.showLocalNotification(title: title, body: body)
                }
            }
        }
        
        // Notify the JavaScript side
        NotificationCenter.default.post(name: Notification.Name("PUSH_NOTIFICATION_RECEIVED"), object: userInfo)
        
        completionHandler(.newData)
    }
    
    // MARK: - UNUserNotificationCenterDelegate
    
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        // Show notification even when app is in foreground
        completionHandler([.alert, .sound, .badge])
    }
    
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        // Handle notification tap
        let userInfo = response.notification.request.content.userInfo
        NotificationCenter.default.post(name: Notification.Name("NOTIFICATION_OPENED"), object: userInfo)
        completionHandler()
    }
    
    // MARK: - Background Task Handling
    
    func startBackgroundTask() {
        if backgroundTask != .invalid {
            endBackgroundTask()
        }
        
        backgroundTask = UIApplication.shared.beginBackgroundTask { [weak self] in
            self?.endBackgroundTask()
        }
        
        // Start a timer to periodically check for new orders
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
        // This would typically make a network request to check for new orders
        // For demonstration, we'll just show a local notification
        
        // In a real app, you would:
        // 1. Make an API call to check for new orders
        // 2. If new orders are found, show a notification
        
        // For testing, uncomment this to see background notifications:
        // self.showLocalNotification(title: "تحقق من الخلفية", body: "تم التحقق من الطلبات الجديدة")
    }
    
    func showLocalNotification(title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = UNNotificationSound(named: UNNotificationSoundName("notification.wav"))
        content.badge = 1
        
        // Show immediately
        let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
    }
    
    // MARK: - iOS 13+ Background Tasks
    
    @available(iOS 13.0, *)
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
    
    @available(iOS 13.0, *)
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
    
    @available(iOS 13.0, *)
    func handleAppRefresh(task: BGAppRefreshTask) {
        // Schedule a new refresh task
        scheduleAppRefresh()
        
        // Create a task expiration handler
        task.expirationHandler = {
            // Cancel any ongoing work
            task.setTaskCompleted(success: false)
        }
        
        // Check for new orders
        checkForNewOrders()
        
        // Inform the system that the task is complete
        task.setTaskCompleted(success: true)
    }
    
    @available(iOS 13.0, *)
    func handleBackgroundProcessing(task: BGProcessingTask) {
        // Schedule a new processing task
        scheduleBackgroundProcessing()
        
        // Create a task expiration handler
        task.expirationHandler = {
            // Cancel any ongoing work
            task.setTaskCompleted(success: false)
        }
        
        // Perform background processing
        checkForNewOrders()
        
        // Inform the system that the task is complete
        task.setTaskCompleted(success: true)
    }
}