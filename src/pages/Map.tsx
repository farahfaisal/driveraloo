import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { 
  MapPin, 
  Navigation, 
  Layers, 
  Maximize, 
  Minimize, 
  RotateCcw, 
  Target, 
  Settings,
  Truck,
  Package,
  Clock,
  Phone,
  X,
  Compass,
  Gauge,
  Wifi,
  WifiOff
} from 'lucide-react';
import L from 'leaflet';
import { useLocationPermission } from '../hooks/useLocationPermission';
import { useGPSTracking } from '../hooks/useGPSTracking';
import { getDriverDeliveries, Delivery } from '../services/delivery';
import { useAuth } from '../context/AuthContext';
import { formatDateTime } from '../utils/date';
import { formatCurrency } from '../utils/delivery';
import LocationPermissionPrompt from '../components/LocationPermissionPrompt';
import GPSTrackingControls from '../components/GPSTrackingControls';
import DeliveryMap from '../components/DeliveryMap';
import toast from 'react-hot-toast';

// إعداد أيقونات Leaflet المخصصة
const createCustomIcon = (color: string, size: 'small' | 'medium' | 'large' = 'medium') => {
  const sizes = {
    small: [20, 20],
    medium: [30, 30],
    large: [40, 40]
  };
  
  const iconUrls = {
    blue: `data:image/svg+xml;base64,${btoa(`
      <svg width="${sizes[size][0]}" height="${sizes[size][1]}" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
        <circle cx="15" cy="15" r="12" fill="#3B82F6" stroke="white" stroke-width="3"/>
        <circle cx="15" cy="15" r="6" fill="white"/>
        <circle cx="15" cy="15" r="3" fill="#3B82F6"/>
      </svg>
    `)}`,
    green: `data:image/svg+xml;base64,${btoa(`
      <svg width="${sizes[size][0]}" height="${sizes[size][1]}" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
        <circle cx="15" cy="15" r="12" fill="#10B981" stroke="white" stroke-width="3"/>
        <circle cx="15" cy="15" r="6" fill="white"/>
        <circle cx="15" cy="15" r="3" fill="#10B981"/>
      </svg>
    `)}`,
    red: `data:image/svg+xml;base64,${btoa(`
      <svg width="${sizes[size][0]}" height="${sizes[size][1]}" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
        <circle cx="15" cy="15" r="12" fill="#DC2626" stroke="white" stroke-width="3"/>
        <circle cx="15" cy="15" r="6" fill="white"/>
        <circle cx="15" cy="15" r="3" fill="#DC2626"/>
      </svg>
    `)}`,
    yellow: `data:image/svg+xml;base64,${btoa(`
      <svg width="${sizes[size][0]}" height="${sizes[size][1]}" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
        <circle cx="15" cy="15" r="12" fill="#EAB308" stroke="white" stroke-width="3"/>
        <circle cx="15" cy="15" r="6" fill="white"/>
        <circle cx="15" cy="15" r="3" fill="#EAB308"/>
      </svg>
    `)}`
  };

  return L.icon({
    iconUrl: iconUrls[color as keyof typeof iconUrls],
    iconSize: sizes[size],
    iconAnchor: [sizes[size][0] / 2, sizes[size][1] / 2],
    popupAnchor: [0, -sizes[size][1] / 2]
  });
};

// مكون للتحكم في الخريطة
function MapController({ 
  center, 
  onLocationUpdate, 
  isFullscreen,
  onToggleFullscreen 
}: {
  center: [number, number] | null;
  onLocationUpdate: (lat: number, lng: number) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);

  useEffect(() => {
    const handleClick = (e: L.LeafletMouseEvent) => {
      onLocationUpdate(e.latlng.lat, e.latlng.lng);
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [map, onLocationUpdate]);

  return null;
}

// مكون لعرض الطلبات على الخريطة
function DeliveryMarkers({ deliveries }: { deliveries: Delivery[] }) {
  return (
    <>
      {deliveries.map((delivery) => {
        // محاولة تحديد الإحداثيات بناءً على العنوان
        const getCoordinatesFromAddress = (address: string): [number, number] => {
          const mockLocations: Record<string, [number, number]> = {
            'حي الجابريات': [32.4624, 35.2936],
            'حي البساتين': [32.4584, 35.2976],
            'مخيم جنين': [32.4554, 35.2926],
            'قباطية': [32.4104, 35.2856],
            'يعبد': [32.4454, 35.2286],
            'وسط البلد': [32.4594, 35.2956],
            'مطعم السلطان': [32.4594, 35.2956],
            'سوبرماركت الهدى': [32.4584, 35.2946],
            'مطعم زمن': [32.4574, 35.2936],
            'مطعم القدس': [32.4604, 35.2966],
            'سوبرماركت النجمة': [32.4614, 35.2976]
          };

          for (const [key, value] of Object.entries(mockLocations)) {
            if (address.toLowerCase().includes(key.toLowerCase())) {
              return value;
            }
          }
          
          // إحداثيات افتراضية في جنين
          return [32.4594 + (Math.random() - 0.5) * 0.01, 35.2956 + (Math.random() - 0.5) * 0.01];
        };

        const pickupCoords = getCoordinatesFromAddress(delivery.pickup_location);
        const deliveryCoords = getCoordinatesFromAddress(delivery.delivery_location);

        const getMarkerColor = (status: string) => {
          switch (status) {
            case 'pending': return 'yellow';
            case 'delivering': return 'blue';
            case 'delivered': return 'green';
            default: return 'red';
          }
        };

        return (
          <React.Fragment key={delivery.id}>
            {/* علامة موقع الاستلام */}
            <Marker 
              position={pickupCoords} 
              icon={createCustomIcon(getMarkerColor(delivery.status))}
            >
              <Popup>
                <div className="text-center" style={{ fontFamily: 'Arial', direction: 'rtl' }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 'bold' }}>
                    طلب #{delivery.order_id}
                  </h3>
                  <p style={{ margin: '4px 0', fontSize: '14px' }}>
                    <strong>العميل:</strong> {delivery.customer_name}
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '14px' }}>
                    <strong>الاستلام:</strong> {delivery.pickup_location}
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '14px' }}>
                    <strong>التوصيل:</strong> {delivery.delivery_location}
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '14px', color: '#DC2626', fontWeight: 'bold' }}>
                    <strong>العمولة:</strong> {formatCurrency(delivery.delivery_fee)}
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '12px', color: '#666' }}>
                    {formatDateTime(delivery.created_at)}
                  </p>
                  {delivery.customer_phone && (
                    <a 
                      href={`tel:${delivery.customer_phone}`}
                      style={{ 
                        display: 'inline-block',
                        marginTop: '8px',
                        padding: '4px 8px',
                        backgroundColor: '#EAB308',
                        color: 'white',
                        textDecoration: 'none',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}
                    >
                      اتصال: {delivery.customer_phone}
                    </a>
                  )}
                </div>
              </Popup>
            </Marker>

            {/* علامة موقع التوصيل */}
            <Marker 
              position={deliveryCoords} 
              icon={createCustomIcon('red', 'small')}
            >
              <Popup>
                <div className="text-center" style={{ fontFamily: 'Arial', direction: 'rtl' }}>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 'bold' }}>
                    موقع التوصيل
                  </h4>
                  <p style={{ margin: '2px 0', fontSize: '12px' }}>
                    {delivery.delivery_location}
                  </p>
                  <p style={{ margin: '2px 0', fontSize: '12px', color: '#666' }}>
                    طلب #{delivery.order_id}
                  </p>
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
        );
      })}
    </>
  );
}

export default function Map() {
  const { user } = useAuth();
  const { hasPermission, requestPermission } = useLocationPermission();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([32.4594, 35.2956]); // جنين
  const [selectedLocation, setSelectedLocation] = useState<[number, number] | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapLayer, setMapLayer] = useState<'street' | 'satellite' | 'terrain'>('street');
  const [showDeliveries, setShowDeliveries] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // GPS tracking
  const {
    currentPosition,
    isTracking,
    error: gpsError,
    positionHistory,
    startTracking,
    stopTracking,
    getCurrentPosition
  } = useGPSTracking({
    enableHighAccuracy: true,
    distanceFilter: 10
  });

  // مراقبة حالة الاتصال
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // تحميل الطلبات
  useEffect(() => {
    loadDeliveries();
    const interval = setInterval(loadDeliveries, 60000); // كل دقيقة
    return () => clearInterval(interval);
  }, []);

  // تحديث موقع الخريطة عند تغيير موقع GPS
  useEffect(() => {
    if (currentPosition) {
      setMapCenter([currentPosition.latitude, currentPosition.longitude]);
    }
  }, [currentPosition]);

  // الحصول على الموقع الحالي عند تحميل الصفحة
  useEffect(() => {
    const getInitialLocation = async () => {
      try {
        const position = await getCurrentPosition();
        if (position) {
          setMapCenter([position.latitude, position.longitude]);
        }
      } catch (error) {
        console.error('Error getting initial position:', error);
      }
    };

    if (hasPermission) {
      getInitialLocation();
    }
  }, [hasPermission, getCurrentPosition]);

  const loadDeliveries = async () => {
    try {
      setError(null);
      const data = await getDriverDeliveries();
      setDeliveries(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'فشل في تحميل الطلبات';
      setError(message);
      console.error('Error loading deliveries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocationClick = useCallback((lat: number, lng: number) => {
    setSelectedLocation([lat, lng]);
    toast.success(`تم تحديد الموقع: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
  }, []);

  const centerOnCurrentLocation = async () => {
    try {
      const position = await getCurrentPosition();
      if (position) {
        setMapCenter([position.latitude, position.longitude]);
        toast.success('تم توسيط الخريطة على موقعك الحالي');
      } else {
        toast.error('لم نتمكن من تحديد موقعك الحالي');
      }
    } catch (error) {
      toast.error('فشل في تحديد الموقع الحالي');
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    if (!isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
  };

  const getMapTileUrl = () => {
    switch (mapLayer) {
      case 'satellite':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'terrain':
        return 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
      default:
        return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    }
  };

  const getMapAttribution = () => {
    switch (mapLayer) {
      case 'satellite':
        return '&copy; <a href="https://www.esri.com/">Esri</a>';
      case 'terrain':
        return '&copy; <a href="https://opentopomap.org/">OpenTopoMap</a>';
      default:
        return '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
    }
  };

  // إذا لم يكن هناك إذن للموقع
  if (hasPermission === false) {
    return <LocationPermissionPrompt onPermissionGranted={() => window.location.reload()} />;
  }

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-white' : 'h-screen'} flex flex-col`}>
      {/* شريط العنوان والتحكم */}
      <div className={`bg-secondary-800 text-white p-4 ${isFullscreen ? 'relative z-10' : ''}`}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <MapPin className="w-6 h-6" />
            <h1 className="text-xl font-bold">الخريطة</h1>
            {!isOnline && (
              <div className="flex items-center gap-1 bg-red-700 px-2 py-1 rounded text-xs">
                <WifiOff className="w-3 h-3" />
                غير متصل
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* زر إعدادات الطبقات */}
            <div className="relative">
              <button
                onClick={() => setShowControls(!showControls)}
                className="bg-secondary-700 p-2 rounded-lg hover:bg-secondary-900 transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
            
            {/* زر الشاشة الكاملة */}
            <button
              onClick={toggleFullscreen}
              className="bg-secondary-700 p-2 rounded-lg hover:bg-secondary-900 transition-colors"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* شريط المعلومات */}
        <div className="mt-2 flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            {currentPosition && (
              <div className="flex items-center gap-1">
                <Target className="w-4 h-4" />
                <span>
                  {currentPosition.latitude.toFixed(4)}, {currentPosition.longitude.toFixed(4)}
                </span>
                {currentPosition.accuracy && (
                  <span className="text-red-200">
                    (±{Math.round(currentPosition.accuracy)}م)
                  </span>
                )}
              </div>
            )}
            
            {currentPosition?.speed && currentPosition.speed > 0 && (
              <div className="flex items-center gap-1">
                <Gauge className="w-4 h-4" />
                <span>{Math.round(currentPosition.speed * 3.6)} كم/س</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {isTracking && (
              <div className="flex items-center gap-1 bg-secondary-700 px-2 py-1 rounded">
                <div className="w-2 h-2 bg-primary-400 rounded-full animate-pulse"></div>
                <span className="text-xs">تتبع نشط</span>
              </div>
            )}
            
            <span className="text-secondary-200">
              {deliveries.length} طلب
            </span>
          </div>
        </div>
      </div>

      {/* لوحة التحكم الجانبية */}
      {showControls && (
        <div className={`bg-white border-b shadow-md p-4 ${isFullscreen ? 'relative z-10' : ''}`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* تحكم GPS */}
            <div className="space-y-2">
              <h3 className="font-medium text-sm">تتبع GPS</h3>
              <div className="flex gap-2">
                <button
                  onClick={isTracking ? stopTracking : startTracking}
                  className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                    isTracking
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isTracking ? 'إيقاف' : 'بدء'}
                </button>
                <button
                  onClick={centerOnCurrentLocation}
                  className="px-3 py-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                >
                  <Target className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* طبقات الخريطة */}
            <div className="space-y-2">
              <h3 className="font-medium text-sm">نوع الخريطة</h3>
              <select
                value={mapLayer}
                onChange={(e) => setMapLayer(e.target.value as any)}
                className="w-full px-2 py-2 border border-gray-300 rounded text-sm"
              >
                <option value="street">شوارع</option>
                <option value="satellite">أقمار صناعية</option>
                <option value="terrain">تضاريس</option>
              </select>
            </div>

            {/* عرض الطلبات */}
            <div className="space-y-2">
              <h3 className="font-medium text-sm">عرض الطلبات</h3>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showDeliveries}
                  onChange={(e) => setShowDeliveries(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">إظهار الطلبات</span>
              </label>
            </div>

            {/* إحصائيات سريعة */}
            <div className="space-y-2">
              <h3 className="font-medium text-sm">الإحصائيات</h3>
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span>قيد الانتظار:</span>
                  <span className="font-medium text-yellow-600">
                    {deliveries.filter(d => d.status === 'pending').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>قيد التوصيل:</span>
                  <span className="font-medium text-blue-600">
                    {deliveries.filter(d => d.status === 'delivering').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>مكتملة:</span>
                  <span className="font-medium text-green-600">
                    {deliveries.filter(d => d.status === 'delivered').length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* الخريطة */}
      <div className={`flex-1 relative ${isFullscreen ? 'h-screen' : ''}`}>
        {isLoading ? (
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
              <p className="text-gray-600">جاري تحميل الخريطة...</p>
            </div>
          </div>
        ) : error ? (
          <div className="absolute inset-0 bg-red-50 flex items-center justify-center z-10">
            <div className="text-center p-4">
              <MapPin className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-red-700 mb-2">خطأ في تحميل الخريطة</h3>
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={loadDeliveries}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                إعادة المحاولة
              </button>
            </div>
          </div>
        ) : (
          <MapContainer
            center={mapCenter}
            zoom={13}
            scrollWheelZoom={true}
            doubleClickZoom={true}
            touchZoom={true}
            zoomControl={true}
            dragging={true}
            keyboard={true}
            boxZoom={true}
            className="h-full w-full"
            style={{ 
              height: isFullscreen ? '100vh' : '100%',
              touchAction: 'none'
            }}
          >
            <TileLayer
              attribution={getMapAttribution()}
              url={getMapTileUrl()}
              maxZoom={18}
              minZoom={8}
            />
            
            <MapController
              center={mapCenter}
              onLocationUpdate={handleLocationClick}
              isFullscreen={isFullscreen}
              onToggleFullscreen={toggleFullscreen}
            />

            {/* موقعك الحالي */}
            {currentPosition && (
              <Marker 
                position={[currentPosition.latitude, currentPosition.longitude]}
                icon={createCustomIcon('blue', 'large')}
              >
                <Popup>
                  <div className="text-center" style={{ fontFamily: 'Arial', direction: 'rtl' }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 'bold' }}>
                      موقعك الحالي
                    </h3>
                    <p style={{ margin: '4px 0', fontSize: '12px' }}>
                      <strong>الإحداثيات:</strong><br/>
                      {currentPosition.latitude.toFixed(6)}, {currentPosition.longitude.toFixed(6)}
                    </p>
                    <p style={{ margin: '4px 0', fontSize: '12px' }}>
                      <strong>الدقة:</strong> ±{Math.round(currentPosition.accuracy)} متر
                    </p>
                    {currentPosition.speed && (
                      <p style={{ margin: '4px 0', fontSize: '12px' }}>
                        <strong>السرعة:</strong> {Math.round(currentPosition.speed * 3.6)} كم/س
                      </p>
                    )}
                    {currentPosition.heading && (
                      <p style={{ margin: '4px 0', fontSize: '12px' }}>
                        <strong>الاتجاه:</strong> {Math.round(currentPosition.heading)}°
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            )}

            {/* الموقع المحدد */}
            {selectedLocation && (
              <Marker 
                position={selectedLocation}
                icon={createCustomIcon('red')}
              >
                <Popup>
                  <div className="text-center" style={{ fontFamily: 'Arial', direction: 'rtl' }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 'bold' }}>
                      موقع محدد
                    </h3>
                    <p style={{ margin: '4px 0', fontSize: '12px' }}>
                      {selectedLocation[0].toFixed(6)}, {selectedLocation[1].toFixed(6)}
                    </p>
                    <button
                      onClick={() => setSelectedLocation(null)}
                      style={{
                        marginTop: '8px',
                        padding: '4px 8px',
                        backgroundColor: '#DC2626',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      إزالة العلامة
                    </button>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* عرض الطلبات على الخريطة */}
            {showDeliveries && <DeliveryMarkers deliveries={deliveries} />}
          </MapContainer>
        )}

        {/* أزرار التحكم العائمة */}
        <div className="absolute top-4 right-4 z-10 space-y-2">
          <button
            onClick={centerOnCurrentLocation}
            className="bg-white p-3 rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
            title="توسيط على موقعي"
          >
            <Target className="w-5 h-5 text-red-600" />
          </button>
          
          <button
            onClick={() => setSelectedLocation(null)}
            className="bg-white p-3 rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
            title="مسح العلامات"
          >
            <RotateCcw className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* معلومات الحالة */}
        <div className="absolute bottom-4 left-4 z-10">
          <div className="bg-white rounded-lg shadow-lg p-3 space-y-2">
            {/* حالة GPS */}
            <div className="flex items-center gap-2 text-sm">
              <div className={`w-3 h-3 rounded-full ${
                isTracking ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`}></div>
              <span className={isTracking ? 'text-green-600' : 'text-gray-600'}>
                GPS {isTracking ? 'نشط' : 'متوقف'}
              </span>
            </div>

            {/* حالة الاتصال */}
            <div className="flex items-center gap-2 text-sm">
              {isOnline ? (
                <>
                  <Wifi className="w-4 h-4 text-green-600" />
                  <span className="text-green-600">متصل</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-red-600" />
                  <span className="text-red-600">غير متصل</span>
                </>
              )}
            </div>

            {/* عدد النقاط المسجلة */}
            {positionHistory.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Navigation className="w-4 h-4 text-blue-600" />
                <span className="text-blue-600">
                  {positionHistory.length} نقطة مسجلة
                </span>
              </div>
            )}
          </div>
        </div>

        {/* قائمة الطلبات العائمة */}
        {!isFullscreen && deliveries.length > 0 && (
          <div className="absolute top-4 left-4 z-10 w-80 max-h-96 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <Package className="w-5 h-5 text-red-600" />
                الطلبات على الخريطة
              </h3>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {deliveries.slice(0, 5).map((delivery) => (
                  <div 
                    key={delivery.id}
                    className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors cursor-pointer"
                    onClick={() => {
                      // توسيط الخريطة على هذا الطلب
                      const coords = delivery.pickup_location.includes('جنين') 
                        ? [32.4594, 35.2956] as [number, number]
                        : [32.4594, 35.2956] as [number, number];
                      setMapCenter(coords);
                    }}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">#{delivery.order_id}</span>
                      <div className={`w-3 h-3 rounded-full ${
                        delivery.status === 'pending' ? 'bg-yellow-500' :
                        delivery.status === 'delivering' ? 'bg-blue-500' :
                        delivery.status === 'delivered' ? 'bg-green-500' : 'bg-gray-500'
                      }`}></div>
                    </div>
                    
                    <p className="text-xs text-gray-600 mb-1">
                      {delivery.customer_name}
                    </p>
                    
                    <p className="text-xs text-gray-500 truncate">
                      {delivery.delivery_location}
                    </p>
                    
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs font-medium text-red-600">
                        {formatCurrency(delivery.delivery_fee)}
                      </span>
                      {delivery.customer_phone && (
                        <a 
                          href={`tel:${delivery.customer_phone}`}
                          className="text-xs text-blue-600 hover:text-blue-700"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Phone className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                
                {deliveries.length > 5 && (
                  <div className="text-center pt-2">
                    <span className="text-xs text-gray-500">
                      و {deliveries.length - 5} طلب آخر...
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* رسالة خطأ GPS */}
        {gpsError && (
          <div className="absolute bottom-20 left-4 right-4 z-10">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-red-600" />
                <p className="text-red-600 text-sm">{gpsError}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* شريط التحكم السفلي (في الوضع العادي فقط) */}
      {!isFullscreen && (
        <div className="bg-white border-t p-4 pb-20">
          <GPSTrackingControls
            isTracking={isTracking}
            currentPosition={currentPosition}
            onStartTracking={startTracking}
            onStopTracking={stopTracking}
            error={gpsError}
            positionHistory={positionHistory}
          />
        </div>
      )}
    </div>
  );
}