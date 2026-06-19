import React, { useEffect } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

interface DeliveryMapProps {
  currentLocation: [number, number];
  destination: [number, number];
  deliveryLocation?: [number, number];
  showFullRoute?: boolean;
}

// Custom icons for different markers
const createCustomIcon = (color: string) => {
  const iconUrls = {
    blue: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iNDEiIHZpZXdCb3g9IjAgMCAyNSA0MSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyLjUgMEMxOS40MDM2IDAgMjUgNS41OTY0NCAyNSAxMi41QzI1IDE5LjQwMzYgMTkuNDAzNiAyNSAxMi41IDI1QzUuNTk2NDQgMjUgMCAxOS40MDM2IDAgMTIuNUMwIDUuNTk2NDQgNS41OTY0NCAwIDEyLjUgMFoiIGZpbGw9IiMzQjgyRjYiLz4KPHBhdGggZD0iTTEyLjUgNDFMMjUgMjVIMFoiIGZpbGw9IiMzQjgyRjYiLz4KPC9zdmc+',
    green: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iNDEiIHZpZXdCb3g9IjAgMCAyNSA0MSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyLjUgMEMxOS40MDM2IDAgMjUgNS41OTY0NCAyNSAxMi41QzI1IDE5LjQwMzYgMTkuNDAzNiAyNSAxMi41IDI1QzUuNTk2NDQgMjUgMCAxOS40MDM2IDAgMTIuNUMwIDUuNTk2NDQgNS41OTY0NCAwIDEyLjUgMFoiIGZpbGw9IiMxMEI5ODEiLz4KPHBhdGggZD0iTTEyLjUgNDFMMjUgMjVIMFoiIGZpbGw9IiMxMEI5ODEiLz4KPC9zdmc+',
    red: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iNDEiIHZpZXdCb3g9IjAgMCAyNSA0MSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyLjUgMEMxOS40MDM2IDAgMjUgNS41OTY0NCAyNSAxMi41QzI1IDE5LjQwMzYgMTkuNDAzNiAyNSAxMi41IDI1QzUuNTk2NDQgMjUgMCAxOS40MDM2IDAgMTIuNUMwIDUuNTk2NDQgNS41OTY0NCAwIDEyLjUgMFoiIGZpbGw9IiNEQzI2MjYiLz4KPHBhdGggZD0iTTEyLjUgNDFMMjUgMjVIMFoiIGZpbGw9IiNEQzI2MjYiLz4KPC9zdmc+'
  };

  return L.icon({
    iconUrl: iconUrls[color as keyof typeof iconUrls],
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

// Simple routing function using straight lines
const createSimpleRoute = (map: L.Map, waypoints: L.LatLng[]) => {
  // Create a polyline connecting all waypoints
  const polyline = L.polyline(waypoints.map(wp => [wp.lat, wp.lng]), {
    color: '#dc2626',
    weight: 4,
    opacity: 0.8,
    dashArray: '10, 5'
  }).addTo(map);
  
  // Fit bounds to show all points
  const bounds = L.latLngBounds(waypoints.map(wp => [wp.lat, wp.lng]));
  map.fitBounds(bounds, { padding: [20, 20] });
  
  return polyline;
};

// Advanced routing using OSRM
const createAdvancedRoute = async (map: L.Map, waypoints: L.LatLng[]) => {
  try {
    // Build OSRM URL
    const coords = waypoints.map(wp => `${wp.lng},${wp.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OSRM request failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const coordinates = route.geometry.coordinates;
      
      // Convert coordinates to Leaflet format [lat, lng]
      const latLngs = coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
      
      // Create polyline
      const polyline = L.polyline(latLngs, {
        color: '#dc2626',
        weight: 6,
        opacity: 0.8
      }).addTo(map);
      
      // Fit bounds
      map.fitBounds(polyline.getBounds(), { padding: [20, 20] });

      return polyline;
    } else {
      throw new Error('No routes found in OSRM response');
    }
  } catch (error) {
    console.error('OSRM routing failed:', error);
    throw error;
  }
};

export default function DeliveryMap({ 
  currentLocation, 
  destination, 
  deliveryLocation,
  showFullRoute = false 
}: DeliveryMapProps) {
  const map = useMap();

  useEffect(() => {
    if (!map) {
      console.error('Map instance not available');
      return;
    }

    // Enable all map interactions
    map.scrollWheelZoom.enable();
    map.doubleClickZoom.enable();
    map.touchZoom.enable();
    map.boxZoom.enable();
    map.keyboard.enable();
    map.dragging.enable();
    
    // Set zoom limits
    map.setMinZoom(8);
    map.setMaxZoom(18);

    // Clear existing layers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        if (!(layer instanceof L.TileLayer)) {
          map.removeLayer(layer);
        }
      }
    });

    let currentMarker: L.Marker | null = null;
    let pickupMarker: L.Marker | null = null;
    let deliveryMarker: L.Marker | null = null;
    let routePolyline: L.Polyline | null = null;

    const setupMapContent = async () => {
      try {
        // Add markers with custom icons

        currentMarker = L.marker(currentLocation, {
          icon: createCustomIcon('blue'),
          title: 'موقعك الحالي'
        }).addTo(map);
        currentMarker.bindPopup('<div style="text-align: center; font-family: Arial;"><strong>موقعك الحالي</strong></div>');
        
        pickupMarker = L.marker(destination, {
          icon: createCustomIcon('green'),
          title: 'موقع الاستلام'
        }).addTo(map);
        pickupMarker.bindPopup('<div style="text-align: center; font-family: Arial;"><strong>موقع الاستلام</strong></div>');
        
        if (showFullRoute && deliveryLocation) {
          deliveryMarker = L.marker(deliveryLocation, {
            icon: createCustomIcon('red'),
            title: 'موقع التوصيل'
          }).addTo(map);
          deliveryMarker.bindPopup('<div style="text-align: center; font-family: Arial;"><strong>موقع التوصيل</strong></div>');
        }

        // Create waypoints array
        const waypoints = showFullRoute && deliveryLocation
          ? [
              L.latLng(currentLocation[0], currentLocation[1]),
              L.latLng(destination[0], destination[1]),
              L.latLng(deliveryLocation[0], deliveryLocation[1])
            ]
          : [
              L.latLng(currentLocation[0], currentLocation[1]),
              L.latLng(destination[0], destination[1])
            ];

        // Try advanced routing first, fallback to simple routing
        try {
          routePolyline = await createAdvancedRoute(map, waypoints);
        } catch (routingError) {
          routePolyline = createSimpleRoute(map, waypoints);
        }

        // Add zoom control if not already present
        if (!map.zoomControl) {
          L.control.zoom({ position: 'topright' }).addTo(map);
        }

        // Add scale control
        L.control.scale({
          position: 'bottomleft',
          metric: true,
          imperial: false
        }).addTo(map);

      } catch (error) {
        console.error('Error setting up map content:', error);
        
        // Fallback: show markers without routing
        try {
          if (!currentMarker) {
            currentMarker = L.marker(currentLocation, {
              icon: createCustomIcon('blue'),
              title: 'موقعك الحالي'
            }).addTo(map);
            currentMarker.bindPopup('موقعك الحالي');
          }
          
          if (!pickupMarker) {
            pickupMarker = L.marker(destination, {
              icon: createCustomIcon('green'),
              title: 'موقع الاستلام'
            }).addTo(map);
            pickupMarker.bindPopup('موقع الاستلام');
          }
          
          if (showFullRoute && deliveryLocation && !deliveryMarker) {
            deliveryMarker = L.marker(deliveryLocation, {
              icon: createCustomIcon('red'),
              title: 'موقع التوصيل'
            }).addTo(map);
            deliveryMarker.bindPopup('موقع التوصيل');
          }

          // Fit bounds to show all markers
          const points = showFullRoute && deliveryLocation
            ? [currentLocation, destination, deliveryLocation]
            : [currentLocation, destination];
          
          const bounds = L.latLngBounds(points);
          map.fitBounds(bounds, { padding: [50, 50] });

        } catch (fallbackError) {
          console.error('Error in fallback setup:', fallbackError);
        }
      }
    };

    // Setup map content
    setupMapContent();

    // Cleanup function
    return () => {
      try {
        if (currentMarker) {
          map.removeLayer(currentMarker);
        }
        if (pickupMarker) {
          map.removeLayer(pickupMarker);
        }
        if (deliveryMarker) {
          map.removeLayer(deliveryMarker);
        }
        if (routePolyline) {
          map.removeLayer(routePolyline);
        }
        
        // Remove any remaining polylines
        map.eachLayer((layer) => {
          if (layer instanceof L.Polyline && !(layer instanceof L.TileLayer)) {
            map.removeLayer(layer);
          }
        });
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError);
      }
    };
  }, [map, currentLocation, destination, deliveryLocation, showFullRoute]);

  return null;
}