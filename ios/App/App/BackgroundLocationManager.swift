import Foundation
import CoreLocation
import UserNotifications

class BackgroundLocationManager: NSObject, CLLocationManagerDelegate {
    static let shared = BackgroundLocationManager()
    
    private let locationManager = CLLocationManager()
    private var lastLocation: CLLocation?
    private var isMonitoring = false
    
    private override init() {
        super.init()
        setupLocationManager()
    }
    
    private func setupLocationManager() {
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.allowsBackgroundLocationUpdates = true
        locationManager.pausesLocationUpdatesAutomatically = false
        locationManager.showsBackgroundLocationIndicator = true
        
        // For iOS 14+, we need to request temporary full accuracy
        if #available(iOS 14.0, *) {
            locationManager.requestTemporaryFullAccuracyAuthorization(
                withPurposeKey: "TrackingPurposeKey",
                completion: { error in
                    if let error = error {
                        print("Error requesting temporary full accuracy: \(error)")
                    }
                }
            )
        }
    }
    
    func startMonitoring() {
        if !isMonitoring {
            // Request authorization
            locationManager.requestAlwaysAuthorization()
            
            // Start location updates
            locationManager.startUpdatingLocation()
            isMonitoring = true
            
            print("Started location monitoring")
        }
    }
    
    func stopMonitoring() {
        if isMonitoring {
            locationManager.stopUpdatingLocation()
            isMonitoring = false
            
            print("Stopped location monitoring")
        }
    }
    
    // MARK: - CLLocationManagerDelegate
    
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        
        // Store the last location
        lastLocation = location
        
        // Log location update
        print("Location updated: \(location.coordinate.latitude), \(location.coordinate.longitude)")
        
        // Notify the app about the location update
        NotificationCenter.default.post(
            name: Notification.Name("LOCATION_UPDATED"),
            object: ["latitude": location.coordinate.latitude, "longitude": location.coordinate.longitude]
        )
        
        // Check if we should send the location to the server
        // This would typically be done periodically, not on every update
        checkIfShouldSendLocationToServer(location: location)
    }
    
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("Location manager failed with error: \(error)")
    }
    
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        switch manager.authorizationStatus {
        case .authorizedAlways:
            print("Location authorization: Always")
            startMonitoring()
        case .authorizedWhenInUse:
            print("Location authorization: When in Use")
            // Show alert to request always authorization
            NotificationCenter.default.post(name: Notification.Name("LOCATION_AUTHORIZATION_NEEDED"), object: nil)
        case .denied, .restricted:
            print("Location authorization: Denied or Restricted")
            stopMonitoring()
            // Show alert to enable location services
            NotificationCenter.default.post(name: Notification.Name("LOCATION_AUTHORIZATION_DENIED"), object: nil)
        case .notDetermined:
            print("Location authorization: Not Determined")
        @unknown default:
            print("Location authorization: Unknown")
        }
    }
    
    // MARK: - Helper Methods
    
    private func checkIfShouldSendLocationToServer(location: CLLocation) {
        // This would typically check if enough time has passed or distance moved
        // to justify sending the location to the server
        
        // For demonstration, we'll just log it
        print("Would send location to server: \(location.coordinate.latitude), \(location.coordinate.longitude)")
    }
    
    func getLastLocation() -> CLLocation? {
        return lastLocation
    }
}