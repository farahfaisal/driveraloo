import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import { GPSPosition } from '../hooks/useGPSTracking';
import toast from 'react-hot-toast';

interface GPSTrackingMapProps {
  currentPosition: GPSPosition | null;
  destination: [number, number];
  deliveryLocation?: [number, number];
  positionHistory: GPSPosition[];
  showFullRoute?: boolean;
  isTracking?: boolean;
  orderInfo?: {
    orderNumber?: string;
    customerName?: string;
    storeName?: string;
    deliveryFee?: number;
    orderType?: string;
  };
}

// Pre-built icons (module-level, created once)
const ICONS = {
  blue: L.icon({
    iconUrl: `data:image/svg+xml;base64,${btoa('<svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg"><circle cx="15" cy="15" r="12" fill="#3B82F6" stroke="white" stroke-width="3"/><circle cx="15" cy="15" r="6" fill="white"/></svg>')}`,
    iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [1, -15]
  }),
  blueMoving: L.icon({
    iconUrl: `data:image/svg+xml;base64,${btoa('<svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg"><circle cx="15" cy="15" r="12" fill="#3B82F6" stroke="white" stroke-width="3"/><circle cx="15" cy="15" r="6" fill="white"/><circle cx="15" cy="15" r="3" fill="#3B82F6"><animate attributeName="r" values="3;8;3" dur="2s" repeatCount="indefinite"/></circle></svg>')}`,
    iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [1, -15]
  }),
  green: L.icon({
    iconUrl: `data:image/svg+xml;base64,${btoa('<svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 0C19.4036 0 25 5.59644 25 12.5C25 19.4036 19.4036 25 12.5 25C5.59644 25 0 19.4036 0 12.5C0 5.59644 5.59644 0 12.5 0Z" fill="#10B981"/><path d="M12.5 41L25 25H0Z" fill="#10B981"/><circle cx="12.5" cy="12.5" r="6" fill="white"/></svg>')}`,
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34]
  }),
  red: L.icon({
    iconUrl: `data:image/svg+xml;base64,${btoa('<svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 0C19.4036 0 25 5.59644 25 12.5C25 19.4036 19.4036 25 12.5 25C5.59644 25 0 19.4036 0 12.5C0 5.59644 5.59644 0 12.5 0Z" fill="#DC2626"/><path d="M12.5 41L25 25H0Z" fill="#DC2626"/><circle cx="12.5" cy="12.5" r="6" fill="white"/></svg>')}`,
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34]
  }),
};

const createCustomIcon = (color: string, isMoving = false) => {
  if (color === 'blue') return isMoving ? ICONS.blueMoving : ICONS.blue;
  return ICONS[color as keyof typeof ICONS] ?? ICONS.red;
};

// Create route using OSRM with timeout and better error handling
const createRoute = async (map: L.Map, waypoints: L.LatLng[]): Promise<L.Polyline | null> => {
  try {
    if (waypoints.length < 2) {
      return null;
    }

    const coords = waypoints.map(wp => `${wp.lng},${wp.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`;

    // Create abort controller with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

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

      if (data.code !== 'Ok') {
        throw new Error(`OSRM error: ${data.code} - ${data.message || 'Unknown error'}`);
      }

      if (!data.routes || data.routes.length === 0) {
        throw new Error('No routes available for these coordinates');
      }

      const route = data.routes[0];
      if (!route.geometry || !route.geometry.coordinates) {
        console.error('Invalid route geometry in response');
        throw new Error('Invalid route geometry');
      }

      const coordinates = route.geometry.coordinates;
      const latLngs = coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);

      return L.polyline(latLngs, {
        color: '#DC2626',
        weight: 6,
        opacity: 0.8,
        dashArray: '10, 5',
        lineJoin: 'round',
        lineCap: 'round'
      }).addTo(map);

    } catch (fetchError) {
      clearTimeout(timeout);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error('Request timeout - network is slow or unavailable');
      }
      throw fetchError;
    }
  } catch (error) {
    return null;
  }
};

export default function GPSTrackingMap({
  currentPosition,
  destination,
  deliveryLocation,
  positionHistory,
  showFullRoute = false,
  isTracking = false,
  orderInfo
}: GPSTrackingMapProps) {
  const map = useMap();
  const currentMarkerRef = useRef<L.Marker | null>(null);
  const destinationMarkerRef = useRef<L.Marker | null>(null);
  const deliveryMarkerRef = useRef<L.Marker | null>(null);
  const trailPolylineRef = useRef<L.Polyline | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const deliveryRoutePolylineRef = useRef<L.Polyline | null>(null);
  const scaleControlRef = useRef<L.Control.Scale | null>(null);

  // Safely remove layer from map
  const safeRemoveLayer = useCallback((layer: L.Layer | null) => {
    if (layer && map.hasLayer(layer)) {
      try {
        map.removeLayer(layer);
      } catch (error) {
        // Silently handle layer removal error
      }
    }
  }, [map]);

  // Update map content
  useEffect(() => {
    if (!map || !currentPosition) return;

    // تفعيل جميع أنواع التفاعل مع الخريطة
    map.scrollWheelZoom.enable(); // تفعيل السكرول بالعجلة في الشاشة الكاملة
    map.doubleClickZoom.enable();
    map.touchZoom.enable();
    map.dragging.enable();
    map.keyboard.enable();
    map.boxZoom.enable();
    map.tap?.enable();
    
    // إعداد حدود التكبير
    map.setMinZoom(10);
    map.setMaxZoom(18);
    const setupMap = async () => {
      try {
        // Update or create current position marker
        const currentLatLng = L.latLng(currentPosition.latitude, currentPosition.longitude);
        const currentPopupContent = `
          <div style="text-align: center; font-family: Arial;">
            <strong>موقعك الحالي</strong><br/>
            <small>دقة: ${Math.round(currentPosition.accuracy)}م</small>
            ${currentPosition.speed ? `<br/><small>السرعة: ${Math.round(currentPosition.speed * 3.6)} كم/س</small>` : ''}
            ${currentPosition.heading ? `<br/><small>الاتجاه: ${Math.round(currentPosition.heading)}°</small>` : ''}
          </div>
        `;

        if (currentMarkerRef.current && map.hasLayer(currentMarkerRef.current)) {
          // Update existing marker
          currentMarkerRef.current.setLatLng(currentLatLng);
          currentMarkerRef.current.setIcon(createCustomIcon('blue', isTracking));
          currentMarkerRef.current.getPopup()?.setContent(currentPopupContent);
        } else {
          // Create new marker
          safeRemoveLayer(currentMarkerRef.current);
          currentMarkerRef.current = L.marker(currentLatLng, {
            icon: createCustomIcon('blue', isTracking),
            title: 'موقعك الحالي'
          }).addTo(map);
          currentMarkerRef.current.bindPopup(currentPopupContent);
        }

        // Update or create destination marker (pickup location)
        const destLatLng = L.latLng(destination[0], destination[1]);
        if (destinationMarkerRef.current && map.hasLayer(destinationMarkerRef.current)) {
          // Update existing marker
          destinationMarkerRef.current.setLatLng(destLatLng);
        } else {
          // Create new marker
          safeRemoveLayer(destinationMarkerRef.current);
          destinationMarkerRef.current = L.marker(destLatLng, {
            icon: createCustomIcon('green'),
            title: 'موقع الاستلام (المتجر)'
          }).addTo(map);
          destinationMarkerRef.current.bindPopup('<div style="text-align: center; font-family: Arial;"><strong>📍 موقع الاستلام</strong><br/><small>(المتجر أو نقطة الاستلام)</small></div>');
        }

        // Update or create delivery location marker if showing full route
        if (showFullRoute && deliveryLocation) {
          const deliveryLatLng = L.latLng(deliveryLocation[0], deliveryLocation[1]);
          if (deliveryMarkerRef.current && map.hasLayer(deliveryMarkerRef.current)) {
            // Update existing marker
            deliveryMarkerRef.current.setLatLng(deliveryLatLng);
          } else {
            // Create new marker
            safeRemoveLayer(deliveryMarkerRef.current);
            deliveryMarkerRef.current = L.marker(deliveryLatLng, {
              icon: createCustomIcon('red'),
              title: 'موقع التوصيل (العميل)'
            }).addTo(map);
            deliveryMarkerRef.current.bindPopup('<div style="text-align: center; font-family: Arial;"><strong>🏠 موقع التوصيل</strong><br/><small>(عنوان العميل)</small></div>');
          }
        } else {
          // Remove delivery marker if not needed
          safeRemoveLayer(deliveryMarkerRef.current);
          deliveryMarkerRef.current = null;
        }

        // Update or create GPS tracking trail
        if (positionHistory.length > 1) {
          const trailCoords = positionHistory.map(pos => [pos.latitude, pos.longitude] as [number, number]);

          if (trailPolylineRef.current && map.hasLayer(trailPolylineRef.current)) {
            // Update existing trail
            trailPolylineRef.current.setLatLngs(trailCoords);
          } else {
            // Create new trail
            safeRemoveLayer(trailPolylineRef.current);
            trailPolylineRef.current = L.polyline(trailCoords, {
              color: '#3B82F6',
              weight: 5,
              opacity: 0.7,
              dashArray: '1, 8',
              lineJoin: 'round',
              lineCap: 'round'
            }).addTo(map);
          }
        } else {
          // Remove trail if not enough points
          safeRemoveLayer(trailPolylineRef.current);
          trailPolylineRef.current = null;
        }

        // Create route from current location to pickup
        const waypointsToPickup = [currentLatLng, destLatLng];

        // Create or update route to pickup location
        safeRemoveLayer(routePolylineRef.current);

        // Create fallback function for simple straight line route
        const createFallbackRoute = (points: L.LatLng[], showNotification = true): L.Polyline => {
          if (showNotification) {
            toast('يتم عرض مسار مباشر (خط مستقيم)', {
              icon: '⚠️',
              duration: 3000
            });
          }

          const fallbackCoords = points.map(wp => [wp.lat, wp.lng] as [number, number]);
          return L.polyline(
            fallbackCoords,
            {
              color: '#DC2626',
              weight: 6,
              opacity: 0.9,
              dashArray: '10, 5',
              lineJoin: 'round',
              lineCap: 'round'
            }
          ).addTo(map);
        };

        try {
          // Try to create route to pickup with OSRM
          const routeToPickup = await createRoute(map, waypointsToPickup);

          if (routeToPickup) {
            routePolylineRef.current = routeToPickup;

            // Add popup to route on click
            const pickupPopupContent = `
              <div style="text-align: center; font-family: Arial; padding: 8px;">
                <strong style="font-size: 16px; color: #DC2626;">🚗 مسار الذهاب للاستلام</strong>
                ${orderInfo ? `
                  <div style="margin-top: 8px; border-top: 1px solid #e5e7eb; padding-top: 8px;">
                    ${orderInfo.orderNumber ? `<div style="margin: 4px 0;"><strong>رقم الطلب:</strong> #${orderInfo.orderNumber}</div>` : ''}
                    ${orderInfo.storeName ? `<div style="margin: 4px 0;"><strong>المتجر:</strong> ${orderInfo.storeName}</div>` : ''}
                    ${orderInfo.orderType ? `<div style="margin: 4px 0;"><strong>النوع:</strong> ${orderInfo.orderType}</div>` : ''}
                  </div>
                ` : ''}
                <div style="margin-top: 8px; font-size: 12px; color: #6b7280;">
                  انقر على الخريطة للإغلاق
                </div>
              </div>
            `;
            routeToPickup.bindPopup(pickupPopupContent);
          } else {
            // OSRM failed, use fallback
            routePolylineRef.current = createFallbackRoute(waypointsToPickup, true);

            // Add popup to fallback route
            const pickupPopupContent = `
              <div style="text-align: center; font-family: Arial; padding: 8px;">
                <strong style="font-size: 16px; color: #DC2626;">🚗 مسار الذهاب للاستلام</strong>
                ${orderInfo ? `
                  <div style="margin-top: 8px; border-top: 1px solid #e5e7eb; padding-top: 8px;">
                    ${orderInfo.orderNumber ? `<div style="margin: 4px 0;"><strong>رقم الطلب:</strong> #${orderInfo.orderNumber}</div>` : ''}
                    ${orderInfo.storeName ? `<div style="margin: 4px 0;"><strong>المتجر:</strong> ${orderInfo.storeName}</div>` : ''}
                    ${orderInfo.orderType ? `<div style="margin: 4px 0;"><strong>النوع:</strong> ${orderInfo.orderType}</div>` : ''}
                  </div>
                ` : ''}
                <div style="margin-top: 8px; font-size: 12px; color: #6b7280;">
                  انقر على الخريطة للإغلاق
                </div>
              </div>
            `;
            routePolylineRef.current.bindPopup(pickupPopupContent);
          }
        } catch (routeError) {
          // Always guarantee a route is shown, even on error
          try {
            routePolylineRef.current = createFallbackRoute(waypointsToPickup, true);

            // Add popup to emergency fallback route
            const pickupPopupContent = `
              <div style="text-align: center; font-family: Arial; padding: 8px;">
                <strong style="font-size: 16px; color: #DC2626;">🚗 مسار الذهاب للاستلام</strong>
                ${orderInfo ? `
                  <div style="margin-top: 8px; border-top: 1px solid #e5e7eb; padding-top: 8px;">
                    ${orderInfo.orderNumber ? `<div style="margin: 4px 0;"><strong>رقم الطلب:</strong> #${orderInfo.orderNumber}</div>` : ''}
                    ${orderInfo.storeName ? `<div style="margin: 4px 0;"><strong>المتجر:</strong> ${orderInfo.storeName}</div>` : ''}
                    ${orderInfo.orderType ? `<div style="margin: 4px 0;"><strong>النوع:</strong> ${orderInfo.orderType}</div>` : ''}
                  </div>
                ` : ''}
                <div style="margin-top: 8px; font-size: 12px; color: #6b7280;">
                  انقر على الخريطة للإغلاق
                </div>
              </div>
            `;
            routePolylineRef.current.bindPopup(pickupPopupContent);
          } catch (fallbackError) {
            console.error('❌ Critical: Fallback route creation failed:', fallbackError);
            // Last resort: show error message to user
            toast.error('فشل في عرض المسار. يرجى التحقق من الاتصال بالإنترنت', {
              duration: 5000
            });
          }
        }

        // Create route from pickup to delivery location if showing full route
        if (showFullRoute && deliveryLocation) {
          safeRemoveLayer(deliveryRoutePolylineRef.current);

          const waypointsPickupToDelivery = [
            destLatLng,
            L.latLng(deliveryLocation[0], deliveryLocation[1])
          ];

          try {
            const routeToDelivery = await createRoute(map, waypointsPickupToDelivery);

            if (routeToDelivery) {
              // Update style to be solid and more visible
              routeToDelivery.setStyle({
                color: '#10B981',
                weight: 6,
                opacity: 0.9,
                dashArray: '',
                lineJoin: 'round',
                lineCap: 'round'
              });

              // Add popup to delivery route on click
              const deliveryPopupContent = `
                <div style="text-align: center; font-family: Arial; padding: 8px;">
                  <strong style="font-size: 16px; color: #10B981;">🏠 مسار التوصيل للعميل</strong>
                  ${orderInfo ? `
                    <div style="margin-top: 8px; border-top: 1px solid #e5e7eb; padding-top: 8px;">
                      ${orderInfo.orderNumber ? `<div style="margin: 4px 0;"><strong>رقم الطلب:</strong> #${orderInfo.orderNumber}</div>` : ''}
                      ${orderInfo.customerName ? `<div style="margin: 4px 0;"><strong>العميل:</strong> ${orderInfo.customerName}</div>` : ''}
                      ${orderInfo.deliveryFee ? `<div style="margin: 4px 0;"><strong>رسوم التوصيل:</strong> ${orderInfo.deliveryFee} د.ع</div>` : ''}
                      ${orderInfo.orderType ? `<div style="margin: 4px 0;"><strong>النوع:</strong> ${orderInfo.orderType}</div>` : ''}
                    </div>
                  ` : ''}
                  <div style="margin-top: 8px; font-size: 12px; color: #6b7280;">
                    انقر على الخريطة للإغلاق
                  </div>
                </div>
              `;
              routeToDelivery.bindPopup(deliveryPopupContent);

              deliveryRoutePolylineRef.current = routeToDelivery;
            } else {
              // OSRM failed, use fallback
              const fallback = L.polyline(
                waypointsPickupToDelivery.map(wp => [wp.lat, wp.lng] as [number, number]),
                {
                  color: '#10B981',
                  weight: 6,
                  opacity: 0.9,
                  dashArray: '',
                  lineJoin: 'round',
                  lineCap: 'round'
                }
              ).addTo(map);

              // Add popup to fallback delivery route
              const deliveryPopupContent = `
                <div style="text-align: center; font-family: Arial; padding: 8px;">
                  <strong style="font-size: 16px; color: #10B981;">🏠 مسار التوصيل للعميل</strong>
                  ${orderInfo ? `
                    <div style="margin-top: 8px; border-top: 1px solid #e5e7eb; padding-top: 8px;">
                      ${orderInfo.orderNumber ? `<div style="margin: 4px 0;"><strong>رقم الطلب:</strong> #${orderInfo.orderNumber}</div>` : ''}
                      ${orderInfo.customerName ? `<div style="margin: 4px 0;"><strong>العميل:</strong> ${orderInfo.customerName}</div>` : ''}
                      ${orderInfo.deliveryFee ? `<div style="margin: 4px 0;"><strong>رسوم التوصيل:</strong> ${orderInfo.deliveryFee} د.ع</div>` : ''}
                      ${orderInfo.orderType ? `<div style="margin: 4px 0;"><strong>النوع:</strong> ${orderInfo.orderType}</div>` : ''}
                    </div>
                  ` : ''}
                  <div style="margin-top: 8px; font-size: 12px; color: #6b7280;">
                    انقر على الخريطة للإغلاق
                  </div>
                </div>
              `;
              fallback.bindPopup(deliveryPopupContent);

              deliveryRoutePolylineRef.current = fallback;
            }
          } catch (deliveryRouteError) {
            try {
              const fallback = L.polyline(
                waypointsPickupToDelivery.map(wp => [wp.lat, wp.lng] as [number, number]),
                {
                  color: '#10B981',
                  weight: 6,
                  opacity: 0.9,
                  dashArray: '',
                  lineJoin: 'round',
                  lineCap: 'round'
                }
              ).addTo(map);

              // Add popup to emergency fallback delivery route
              const deliveryPopupContent = `
                <div style="text-align: center; font-family: Arial; padding: 8px;">
                  <strong style="font-size: 16px; color: #10B981;">🏠 مسار التوصيل للعميل</strong>
                  ${orderInfo ? `
                    <div style="margin-top: 8px; border-top: 1px solid #e5e7eb; padding-top: 8px;">
                      ${orderInfo.orderNumber ? `<div style="margin: 4px 0;"><strong>رقم الطلب:</strong> #${orderInfo.orderNumber}</div>` : ''}
                      ${orderInfo.customerName ? `<div style="margin: 4px 0;"><strong>العميل:</strong> ${orderInfo.customerName}</div>` : ''}
                      ${orderInfo.deliveryFee ? `<div style="margin: 4px 0;"><strong>رسوم التوصيل:</strong> ${orderInfo.deliveryFee} د.ع</div>` : ''}
                      ${orderInfo.orderType ? `<div style="margin: 4px 0;"><strong>النوع:</strong> ${orderInfo.orderType}</div>` : ''}
                    </div>
                  ` : ''}
                  <div style="margin-top: 8px; font-size: 12px; color: #6b7280;">
                    انقر على الخريطة للإغلاق
                  </div>
                </div>
              `;
              fallback.bindPopup(deliveryPopupContent);

              deliveryRoutePolylineRef.current = fallback;
            } catch (fallbackError) {
              // Silently handle fallback error
            }
          }
        } else {
          // Remove delivery route if not showing full route
          safeRemoveLayer(deliveryRoutePolylineRef.current);
          deliveryRoutePolylineRef.current = null;
        }

        // Fit map to show all points
        const allPoints = [
          [currentPosition.latitude, currentPosition.longitude],
          destination,
          ...(showFullRoute && deliveryLocation ? [deliveryLocation] : [])
        ];

        const bounds = L.latLngBounds(allPoints);
        map.fitBounds(bounds, {
          padding: [20, 20],
          maxZoom: 16
        });

        // Add scale control if not exists
        if (!scaleControlRef.current) {
          scaleControlRef.current = L.control.scale({
            position: 'bottomleft',
            metric: true,
            imperial: false
          }).addTo(map);
        }

        // إضافة أزرار تحكم مخصصة للتكبير والتصغير
        if (!map.zoomControl) {
          L.control.zoom({
            position: 'topright',
            zoomInTitle: 'تكبير',
            zoomOutTitle: 'تصغير'
          }).addTo(map);
        }

      } catch (error) {
      }
    };

    setupMap();

  }, [map, currentPosition, destination, deliveryLocation, positionHistory, showFullRoute, isTracking, safeRemoveLayer]);

  // Auto-center map on current position when tracking
  useEffect(() => {
    if (map && currentPosition && isTracking) {
      // Only pan to current position, don't zoom
      map.panTo([currentPosition.latitude, currentPosition.longitude], {
        animate: true,
        duration: 1
      });
    }
  }, [map, currentPosition, isTracking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      safeRemoveLayer(currentMarkerRef.current);
      safeRemoveLayer(destinationMarkerRef.current);
      safeRemoveLayer(deliveryMarkerRef.current);
      safeRemoveLayer(trailPolylineRef.current);
      safeRemoveLayer(routePolylineRef.current);
      safeRemoveLayer(deliveryRoutePolylineRef.current);

      if (scaleControlRef.current) {
        try {
          scaleControlRef.current.remove();
        } catch (error) {
          // Silently handle removal error
        }
      }
    };
  }, [map, safeRemoveLayer]);

  return null;
}