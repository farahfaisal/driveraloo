import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import toast from 'react-hot-toast';

interface SimpleRouteMapProps {
  pickupLocation: [number, number];
  deliveryLocation: [number, number] | null;
}

// Create custom icons
const createCustomIcon = (color: string) => {
  const iconUrls = {
    green: `data:image/svg+xml;base64,${btoa(`
      <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.5 0C19.4036 0 25 5.59644 25 12.5C25 19.4036 19.4036 25 12.5 25C5.59644 25 0 19.4036 0 12.5C0 5.59644 5.59644 0 12.5 0Z" fill="#10B981"/>
        <path d="M12.5 41L25 25H0Z" fill="#10B981"/>
        <circle cx="12.5" cy="12.5" r="6" fill="white"/>
      </svg>
    `)}`,
    red: `data:image/svg+xml;base64,${btoa(`
      <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.5 0C19.4036 0 25 5.59644 25 12.5C25 19.4036 19.4036 25 12.5 25C5.59644 25 0 19.4036 0 12.5C0 5.59644 5.59644 0 12.5 0Z" fill="#DC2626"/>
        <path d="M12.5 41L25 25H0Z" fill="#DC2626"/>
        <circle cx="12.5" cy="12.5" r="6" fill="white"/>
      </svg>
    `)}`
  };

  return L.icon({
    iconUrl: iconUrls[color as keyof typeof iconUrls],
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34]
  });
};

// Create route using OSRM
const createRoute = async (map: L.Map, waypoints: L.LatLng[]): Promise<L.Polyline | null> => {
  try {
    if (waypoints.length < 2) {
      return null;
    }

    const coords = waypoints.map(wp => `${wp.lng},${wp.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`OSRM API returned status ${response.status}`);
      }

      const data = await response.json();

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error('No routes available');
      }

      const route = data.routes[0];
      if (!route.geometry || !route.geometry.coordinates) {
        throw new Error('Invalid route geometry');
      }

      const coordinates = route.geometry.coordinates;
      const latLngs = coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);

      return L.polyline(latLngs, {
        color: '#DC2626',
        weight: 6,
        opacity: 0.8,
        lineJoin: 'round',
        lineCap: 'round'
      }).addTo(map);

    } catch (fetchError) {
      clearTimeout(timeout);
      throw fetchError;
    }
  } catch (error) {
    console.error('Error creating route with OSRM:', error);
    return null;
  }
};

export default function SimpleRouteMap({
  pickupLocation,
  deliveryLocation
}: SimpleRouteMapProps) {
  const map = useMap();
  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const deliveryMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!map) return;

    const setupMap = async () => {
      try {
        // Create pickup marker
        const pickupLatLng = L.latLng(pickupLocation[0], pickupLocation[1]);
        pickupMarkerRef.current = L.marker(pickupLatLng, {
          icon: createCustomIcon('green'),
          title: 'موقع الاستلام'
        }).addTo(map);
        pickupMarkerRef.current.bindPopup('<div style="text-align: center; font-family: Arial;"><strong>📍 موقع الاستلام</strong><br/><small>(المتجر)</small></div>');

        // Create delivery marker if available
        if (deliveryLocation) {
          const deliveryLatLng = L.latLng(deliveryLocation[0], deliveryLocation[1]);
          deliveryMarkerRef.current = L.marker(deliveryLatLng, {
            icon: createCustomIcon('red'),
            title: 'موقع التوصيل'
          }).addTo(map);
          deliveryMarkerRef.current.bindPopup('<div style="text-align: center; font-family: Arial;"><strong>🏠 موقع التوصيل</strong><br/><small>(العميل)</small></div>');

          // Create route between pickup and delivery
          const waypoints = [pickupLatLng, deliveryLatLng];

          try {
            const route = await createRoute(map, waypoints);

            if (route) {
              routePolylineRef.current = route;
            } else {
              // Fallback: straight line
              const fallbackCoords = waypoints.map(wp => [wp.lat, wp.lng] as [number, number]);
              routePolylineRef.current = L.polyline(fallbackCoords, {
                color: '#DC2626',
                weight: 6,
                opacity: 0.8,
                dashArray: '10, 5',
                lineJoin: 'round',
                lineCap: 'round'
              }).addTo(map);

              toast('يتم عرض مسار مباشر', {
                icon: 'ℹ️',
                duration: 2000
              });
            }
          } catch (error) {
            // Fallback: straight line
            const fallbackCoords = waypoints.map(wp => [wp.lat, wp.lng] as [number, number]);
            routePolylineRef.current = L.polyline(fallbackCoords, {
              color: '#DC2626',
              weight: 6,
              opacity: 0.8,
              dashArray: '10, 5',
              lineJoin: 'round',
              lineCap: 'round'
            }).addTo(map);
          }

          // Fit map to show all points
          const bounds = L.latLngBounds([pickupLocation, deliveryLocation]);
          map.fitBounds(bounds, {
            padding: [50, 50],
            maxZoom: 15
          });
        } else {
          // Only pickup location, center on it
          map.setView(pickupLatLng, 13);
        }

      } catch (error) {
        console.error('Error setting up simple route map:', error);
      }
    };

    setupMap();

    // Cleanup
    return () => {
      if (pickupMarkerRef.current && map.hasLayer(pickupMarkerRef.current)) {
        map.removeLayer(pickupMarkerRef.current);
      }
      if (deliveryMarkerRef.current && map.hasLayer(deliveryMarkerRef.current)) {
        map.removeLayer(deliveryMarkerRef.current);
      }
      if (routePolylineRef.current && map.hasLayer(routePolylineRef.current)) {
        map.removeLayer(routePolylineRef.current);
      }
    };
  }, [map, pickupLocation, deliveryLocation]);

  return null;
}
