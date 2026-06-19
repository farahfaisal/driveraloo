import React, { useEffect, useState, useRef, useMemo } from 'react';
import { getDriverTrips, DriverTrip } from '../services/delivery';
import { useAuth } from '../context/AuthContext';
import { useOrders } from '../context/OrdersContext';
import { formatDateTime } from '../utils/date';
import { formatCurrency, formatOrderType } from '../utils/delivery';
import { MapPin, Package, Clock, CheckCircle, XCircle, ArrowRight, Phone, Navigation, Truck, ChevronDown, ChevronUp, Store, User, DollarSign, ShoppingBag, AlertCircle, Calendar } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import PreparationTimer from '../components/PreparationTimer';
import toast from 'react-hot-toast';
import { MapContainer, TileLayer } from 'react-leaflet';
import GPSTrackingMap from '../components/GPSTrackingMap';
import GPSTrackingControls from '../components/GPSTrackingControls';
import { useGPSTracking } from '../hooks/useGPSTracking';
import { startTrip, completeTrip } from '../services/delivery';
import { useNotifications } from '../hooks/useNotifications';
import { useBackgroundService } from '../hooks/useBackgroundService';
import { speakAssignedTrip } from '../utils/textToSpeech';
import { supabase } from '../services/auth';

type TabType = 'active' | 'completed' | 'cancelled';

// Helper function to format trip order number
function getDisplayOrderNumber(trip: DriverTrip): string {
  // If order_number exists, use it directly
  if (trip.order_number) {
    return trip.order_number;
  }

  // If order_id exists, use it directly (it should contain the order_number)
  if (trip.order_id) {
    return trip.order_id;
  }

  // Default fallback
  return `#${trip.id.substring(0, 6).toUpperCase()}`;
}

export default function MyTrips() {
  const { user } = useAuth();
  const { setActiveOrdersCount } = useOrders();
  const [trips, setTrips] = useState<DriverTrip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingTrip, setStartingTrip] = useState<string | null>(null);
  const [completingTrip, setCompletingTrip] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<DriverTrip | null>(null);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [pickupLocation, setPickupLocation] = useState<[number, number] | null>(null);
  const [deliveryLocation, setDeliveryLocation] = useState<[number, number] | null>(null);
  const [showFullRoute, setShowFullRoute] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [expandedTrips, setExpandedTrips] = useState<Set<string>>(new Set());
  const [selectedDayFilter, setSelectedDayFilter] = useState<string | null>(new Date().toISOString().slice(0, 10));

  const { playSound } = useNotifications();
  const { showOrderNotification } = useBackgroundService();
  const previousTripsCountRef = useRef<number>(0);
  const isInitialLoadRef = useRef<boolean>(true);

  // GPS tracking
  const {
    currentPosition: gpsPosition,
    isTracking: isGPSTracking,
    error: gpsError,
    positionHistory,
    startTracking,
    stopTracking,
    getCurrentPosition
  } = useGPSTracking({
    enableHighAccuracy: true,
    distanceFilter: 3 // Update every 3 meters for more precise tracking
  });

  useEffect(() => {
    // Get initial position
    const getInitialPosition = async () => {
      try {
        const position = await getCurrentPosition();
        if (position) {
          setCurrentLocation([position.latitude, position.longitude]);
        }
      } catch (error) {
        console.error('Error getting initial position:', error);
      }
    };

    getInitialPosition();
  }, [getCurrentPosition]);

  // Update current location when GPS position changes
  useEffect(() => {
    if (gpsPosition) {
      setCurrentLocation([gpsPosition.latitude, gpsPosition.longitude]);
    }
  }, [gpsPosition]);

  const geocodeAddress = async (address: string): Promise<[number, number] | null> => {
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
      'سوبرماركت النجمة': [32.4614, 35.2976],
      'متجر': [32.4594, 35.2956],
      'مطعم': [32.4594, 35.2956],
      'سوبرماركت': [32.4584, 35.2946]
    };

    await new Promise(resolve => setTimeout(resolve, 300));
    
    for (const [key, value] of Object.entries(mockLocations)) {
      if (address.toLowerCase().includes(key.toLowerCase())) {
        return value;
      }
    }

    // If no exact match found, return a default location in Jenin
    return [32.4594, 35.2956]; // Default to center of Jenin
  };

  const toggleTripExpansion = (tripId: string) => {
    setExpandedTrips(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tripId)) {
        newSet.delete(tripId);
      } else {
        newSet.add(tripId);
      }
      return newSet;
    });
  };

  const handleShowRoute = async (trip: DriverTrip) => {
    try {
      setSelectedTrip(trip);

      if (!currentLocation) {
        toast.error('لم نتمكن من تحديد موقعك الحالي');
        return;
      }

      const pickupCoords = await geocodeAddress(trip.pickup_address);

      if (!pickupCoords) {
        toast.error('لم نتمكن من تحديد موقع الاستلام على الخريطة');
        return;
      }
      setPickupLocation(pickupCoords);

      const deliveryCoords = await geocodeAddress(trip.delivery_address);

      if (deliveryCoords) {
        setDeliveryLocation(deliveryCoords);
      }

      setShowMap(true);
    } catch (error) {
      console.error('Error in handleShowRoute:', error);
      toast.error('حدث خطأ في تحميل الخريطة');
    }
  };

  useEffect(() => {
    loadTrips();

    // Setup realtime subscription for driver_trips
    const tripsSubscription = supabase
      .channel('driver_trips_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_trips'
        },
        (payload: any) => {
          // Reload trips when any change occurs
          loadTrips();
        }
      )
      .subscribe();

    // Refresh trips every 30 seconds as backup
    const interval = setInterval(loadTrips, 30000);

    return () => {
      clearInterval(interval);
      tripsSubscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleNewTrips = async () => {
      if (isInitialLoadRef.current) {
        previousTripsCountRef.current = trips.length;
        isInitialLoadRef.current = false;
        return;
      }

      const activeTrips = trips.filter(t => t.status === 'assigned' || t.status === 'in_progress');
      const newTripsCount = activeTrips.length;
      const previousCount = previousTripsCountRef.current;

      if (newTripsCount > previousCount) {
        const addedTripsCount = newTripsCount - previousCount;

        // الحصول على الرحلة الجديدة
        const newTrip = activeTrips[activeTrips.length - 1];
        const orderNumber = newTrip ? (newTrip.order_number || newTrip.order_id) : undefined;

        try {
          const title = '🚗 رحلة مخصصة!';
          const body = addedTripsCount === 1
            ? `تم تخصيص رحلة جديدة لك - رقم ${orderNumber || 'الطلب'}`
            : `تم تخصيص ${addedTripsCount} رحلات جديدة لك`;

          // 1. إرسال إشعار مرئي
          await showOrderNotification(title, body);

          // 2. تشغيل صوت التنبيه
          await playSound(true);

          // 3. تشغيل الصوت الناطق
          await speakAssignedTrip(orderNumber);
        } catch (error) {
          console.error('❌ خطأ في إرسال إشعار الرحلة:', error);
        }
      }

      previousTripsCountRef.current = newTripsCount;
    };

    handleNewTrips();
  }, [trips, playSound, showOrderNotification]);

  const loadTrips = async () => {
    try {
      setError(null);
      const data = await getDriverTrips();
      setTrips(data);

      // Update active orders count in context for badge
      const activeCount = data.filter(t => t.status === 'assigned' || t.status === 'in_progress').length;
      setActiveOrdersCount(activeCount);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'فشل في تحميل الرحلات';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartTrip = async (tripId: string) => {
    try {
      setStartingTrip(tripId);
      await startTrip(tripId);
      toast.success('تم بدء الرحلة بنجاح');
      loadTrips(); // Refresh trips list
    } catch (error) {
      const message = error instanceof Error ? error.message : 'فشل في بدء الرحلة';
      toast.error(message);
    } finally {
      setStartingTrip(null);
    }
  };

  const handleCompleteTrip = async (tripId: string) => {
    try {
      setCompletingTrip(tripId);
      await completeTrip(tripId);
      toast.success('تم إكمال الرحلة بنجاح وإضافة العمولة إلى محفظتك');
      loadTrips(); // Refresh trips list
    } catch (error) {
      const message = error instanceof Error ? error.message : 'فشل في إكمال الرحلة';
      toast.error(message);
    } finally {
      setCompletingTrip(null);
    }
  };

  const activeTrips = trips.filter(t => t.status === 'assigned' || t.status === 'in_progress');
  const completedTrips = trips.filter(t => t.status === 'completed');
  const cancelledTrips = trips.filter(t => t.status === 'cancelled');

  // Group completed trips by day — must be before early returns (Rules of Hooks)
  const completedByDay = useMemo(() => {
    const arabicDays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const arabicMonths = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    const map = new Map<string, DriverTrip[]>();
    completedTrips.forEach(trip => {
      const d = new Date(trip.completed_at || trip.created_at);
      const key = d.toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(trip);
    });

    return [...map.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dateKey, orders]) => {
        const d = new Date(dateKey + 'T00:00:00');
        let label: string;
        if (dateKey === todayStr) label = 'اليوم';
        else if (dateKey === yesterdayStr) label = 'أمس';
        else label = `${arabicDays[d.getDay()]} ${d.getDate()} ${arabicMonths[d.getMonth()]}`;
        const earnings = orders.reduce((s, t) => s + (t.delivery_fee || 0), 0);
        return { dateKey, label, orders, earnings };
      });
  }, [completedTrips]);

  // Which trips to show in the list
  const filteredTrips = activeTab === 'active'
    ? activeTrips
    : activeTab === 'completed'
    ? (selectedDayFilter ? (completedByDay.find(d => d.dateKey === selectedDayFilter)?.orders ?? []) : completedTrips)
    : cancelledTrips;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <LoadingSpinner size="lg" color="emerald" />
          <p className="mt-4 text-gray-600">جاري تحميل الرحلات...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadTrips}
            className="bg-red-100 text-red-600 px-4 py-2 rounded-lg hover:bg-red-200 transition-colors"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-secondary-800/90 rounded-lg p-4 text-white mb-4">
        <div className="p-4">
        <h1 className="text-xl font-bold">رحلاتي</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 mb-4">
        <div className="bg-white rounded-lg shadow-sm p-1 flex gap-1">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'active'
                ? 'bg-yellow-500 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            النشطة ({activeTrips.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'completed'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            المكتملة ({completedTrips.length})
          </button>
          <button
            onClick={() => setActiveTab('cancelled')}
            className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'cancelled'
                ? 'bg-red-500 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            الملغية ({cancelledTrips.length})
          </button>
        </div>
      </div>

      {/* Earnings Summary for Completed Trips */}
      {activeTab === 'completed' && completedTrips.length > 0 && (
        <div className="px-4 mb-4">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg shadow-md p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-100 mb-1">إجمالي الأرباح من الرحلات المكتملة</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(completedTrips.reduce((sum, trip) => sum + (trip.delivery_fee || 0), 0))}
                </p>
              </div>
              <div className="bg-white/20 rounded-full p-3">
                <CheckCircle className="h-8 w-8" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Day filter for completed trips */}
      {activeTab === 'completed' && completedByDay.length > 1 && (
        <div className="px-4 mb-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setSelectedDayFilter(null)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                selectedDayFilter === null
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              الكل ({completedTrips.length})
            </button>
            {completedByDay.map(day => (
              <button
                key={day.dateKey}
                onClick={() => setSelectedDayFilter(day.dateKey === selectedDayFilter ? null : day.dateKey)}
                className={`flex-shrink-0 flex flex-col items-center px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                  selectedDayFilter === day.dateKey
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-400'
                }`}
              >
                <span>{day.label}</span>
                <span className={`text-[10px] font-normal mt-0.5 ${selectedDayFilter === day.dateKey ? 'text-emerald-100' : 'text-emerald-600'}`}>
                  {day.orders.length} · ₪{day.earnings.toFixed(0)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {filteredTrips.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center mx-4">
          <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-800 mb-2">
            {activeTab === 'active' && 'لا توجد رحلات نشطة'}
            {activeTab === 'completed' && 'لا توجد رحلات مكتملة'}
            {activeTab === 'cancelled' && 'لا توجد رحلات ملغية'}
          </h3>
          <p className="text-gray-600">
            {activeTab === 'active' && 'سيتم عرض الرحلات المعينة والجارية هنا'}
            {activeTab === 'completed' && 'سيتم عرض الرحلات المكتملة في سجلك هنا'}
            {activeTab === 'cancelled' && 'سيتم عرض الرحلات الملغية هنا'}
          </p>
        </div>
      ) : (
        <div className="space-y-4 px-4 overflow-y-auto max-h-screen">
          {filteredTrips.map((trip) => {
            const getStatusConfig = () => {
              switch (trip.status) {
                case 'assigned':
                  return {
                    icon: Clock,
                    text: 'قيد الانتظار',
                    className: 'bg-yellow-50 text-yellow-700 border-yellow-200'
                  };
                case 'in_progress':
                  return {
                    icon: Truck,
                    text: 'قيد التنفيذ',
                    className: 'bg-blue-50 text-blue-700 border-blue-200'
                  };
                case 'completed':
                  return {
                    icon: CheckCircle,
                    text: 'تم التوصيل',
                    className: 'bg-green-50 text-green-700 border-green-200'
                  };
                case 'cancelled':
                  return {
                    icon: XCircle,
                    text: 'ملغية',
                    className: 'bg-red-50 text-red-700 border-red-200'
                  };
                default:
                  return {
                    icon: Clock,
                    text: 'غير محدد',
                    className: 'bg-gray-50 text-gray-700 border-gray-200'
                  };
              }
            };

            const statusConfig = getStatusConfig();
            const StatusIcon = statusConfig.icon;
            const isExpanded = expandedTrips.has(trip.id);

            // Get header colors based on status
            const getHeaderColors = () => {
              switch (trip.status) {
                case 'assigned':
                  return 'bg-gradient-to-r from-yellow-50 via-yellow-100 to-yellow-50 hover:from-yellow-100 hover:via-yellow-200 hover:to-yellow-100';
                case 'in_progress':
                  return 'bg-gradient-to-r from-blue-50 via-blue-100 to-blue-50 hover:from-blue-100 hover:via-blue-200 hover:to-blue-100';
                case 'completed':
                  return 'bg-gradient-to-r from-emerald-50 via-emerald-100 to-emerald-50 hover:from-emerald-100 hover:via-emerald-200 hover:to-emerald-100';
                case 'cancelled':
                  return 'bg-gradient-to-r from-red-50 via-red-100 to-red-50 hover:from-red-100 hover:via-red-200 hover:to-red-100';
                default:
                  return 'bg-gradient-to-r from-gray-50 via-gray-100 to-gray-50 hover:from-gray-100 hover:via-gray-200 hover:to-gray-100';
              }
            };

            // Get icon background colors based on status
            const getIconBgColors = () => {
              switch (trip.status) {
                case 'assigned':
                  return 'bg-yellow-200 text-yellow-700';
                case 'in_progress':
                  return 'bg-blue-200 text-blue-700';
                case 'completed':
                  return 'bg-emerald-200 text-emerald-700';
                case 'cancelled':
                  return 'bg-red-200 text-red-700';
                default:
                  return 'bg-gray-200 text-gray-700';
              }
            };

            // Get small icon colors based on status
            const getSmallIconColor = () => {
              switch (trip.status) {
                case 'assigned':
                  return 'text-yellow-600';
                case 'in_progress':
                  return 'text-blue-600';
                case 'completed':
                  return 'text-emerald-600';
                case 'cancelled':
                  return 'text-red-600';
                default:
                  return 'text-gray-600';
              }
            };

            const isGroupedOrder = !!(trip.order_group_id);

            return (
              <div key={trip.id} className={`bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-lg transition-all duration-300 ${isGroupedOrder ? 'border-2 border-orange-400' : 'border border-gray-300'}`}>
                {/* Grouped order banner */}
                {isGroupedOrder && (
                  <div className="bg-orange-500 text-white text-xs font-bold text-center py-1.5 flex items-center justify-center gap-2">
                    <Store className="w-3.5 h-3.5" />
                    طلب متعدد المتاجر
                  </div>
                )}

                {/* Compact Header - Always Visible - Clickable */}
                <button
                  onClick={() => toggleTripExpansion(trip.id)}
                  className={`w-full ${getHeaderColors()} p-3 text-gray-900 text-right transition-all border-b border-gray-200`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`${getIconBgColors()} p-1.5 rounded-lg`}>
                        <Package className="w-5 h-5" />
                      </div>
                      <span className="text-xl font-bold text-gray-900">{getDisplayOrderNumber(trip)}</span>
                      {/* Order Type Badge */}
                      {trip.order_type && (
                        <div className={`px-2 py-1 rounded-lg text-xs font-bold ${
                          trip.order_type === 'طلب كابتن' || trip.order_type === 'captain'
                            ? 'bg-blue-100 text-blue-700 border border-blue-300'
                            : trip.order_type === 'طلب طرد' || trip.order_type === 'parcel'
                            ? 'bg-orange-100 text-orange-700 border border-orange-300'
                            : 'bg-blue-100 text-blue-700 border border-blue-300'
                        }`}>
                          {trip.order_type === 'طلب كابتن' || trip.order_type === 'captain' ? 'كابتن' :
                           trip.order_type === 'طلب طرد' || trip.order_type === 'parcel' ? 'طرد' :
                           'توصيل'}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`inline-flex items-center px-3 py-1 rounded-full border-2 text-xs font-bold shadow-md ${statusConfig.className}`}>
                        <StatusIcon className="w-3 h-3 ml-1" />
                        {statusConfig.text}
                      </div>
                      <div className={`${getIconBgColors()} p-1 rounded-lg`}>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Compact Info - Always Visible */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {/* Store Info or Pickup */}
                      {trip.store_name ? (
                        <div className="bg-white/80 backdrop-blur-sm rounded-lg p-2 border border-gray-200">
                          <div className="flex items-center gap-2">
                            <div className="bg-amber-100 p-1.5 rounded-lg">
                              <Store className="w-4 h-4 text-amber-600 flex-shrink-0" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-gray-600">المتجر</div>
                              <div className="font-bold text-gray-900 text-sm truncate">{trip.store_name}</div>
                              {trip.store_address && (
                                <div className="text-xs text-gray-500 truncate">{trip.store_address}</div>
                              )}
                            </div>
                            {trip.store_phone && (
                              <a
                                href={`tel:${trip.store_phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center justify-center bg-amber-600 text-white w-8 h-8 rounded-lg hover:bg-amber-700 transition-all shadow flex-shrink-0"
                              >
                                <Phone className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white/80 backdrop-blur-sm rounded-lg p-2 border border-gray-200 col-span-2">
                          <div className="flex items-center gap-2">
                            <MapPin className={`w-4 h-4 ${getSmallIconColor()} flex-shrink-0`} />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-gray-600">الاستلام</div>
                              <div className="font-bold text-gray-900 text-sm truncate">{trip.pickup_address}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Customer Name */}
                      <div className="bg-white/80 backdrop-blur-sm rounded-lg p-2 border border-gray-200">
                        <div className="flex items-center gap-2">
                          <div className="bg-green-100 p-1.5 rounded-lg">
                            <User className="w-4 h-4 text-green-600 flex-shrink-0" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-gray-600">العميل</div>
                            <div className="font-bold text-gray-900 text-sm truncate">{trip.customer_name}</div>
                          </div>
                          {trip.customer_phone && (
                            <a
                              href={`tel:${trip.customer_phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center justify-center bg-green-600 text-white w-8 h-8 rounded-lg hover:bg-green-700 transition-all shadow flex-shrink-0"
                            >
                              <Phone className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Delivery Address - Compact */}
                    <div className="bg-gradient-to-r from-green-100 to-green-50 rounded-lg p-2 border-2 border-green-300">
                      <div className="flex items-center gap-2">
                        <div className="bg-green-600 p-1.5 rounded-lg">
                          <MapPin className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-green-800">
                            عنوان التوصيل
                            {trip.service_area && ` - ${trip.service_area}`}
                            {trip.delivery_city && ` - ${trip.delivery_city}`}
                          </p>
                          <p className="text-sm font-bold text-gray-900 truncate">{trip.delivery_address}</p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedTrip(trip);
                            handleShowMap(trip);
                          }}
                          className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg transition-all duration-200 flex items-center gap-1.5 text-xs font-bold shadow-md hover:shadow-lg"
                          title="عرض المسار"
                        >
                          <Navigation className="w-4 h-4" />
                          <span>مسار</span>
                        </button>
                      </div>
                    </div>

                    {/* Preparation Timer - Show preparation status for active trips */}
                    {(trip.status === 'assigned' ||
                      trip.status === 'in_progress' ||
                      trip.status === 'picked_up') && (
                      <PreparationTimer
                        preparationStart={trip.preparation_start}
                        preparationStartTime={trip.preparation_start_time}
                        preparationEnd={trip.preparation_end}
                        preparationTime={trip.preparation_time}
                        actualPreparationTime={trip.actual_preparation_time}
                      />
                    )}

                    {/* Discount & Payment Info */}
                    {((trip.coupon_discount != null && trip.coupon_discount > 0) ||
                      (trip.points_discount != null && trip.points_discount > 0) ||
                      (trip.vendor_discount_amount != null && trip.vendor_discount_amount > 0) ||
                      (trip.payment_method && trip.payment_method !== 'cash')) && (
                      <div className="space-y-1">
                        {trip.coupon_discount != null && trip.coupon_discount > 0 && (
                          <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5">
                            <span className="text-xs font-bold text-orange-700">- {formatCurrency(trip.coupon_discount)}</span>
                            <span className="text-xs font-bold text-orange-700">خصم كوبون</span>
                          </div>
                        )}
                        {trip.points_discount != null && trip.points_discount > 0 && (
                          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                            <span className="text-xs font-bold text-amber-700">- {formatCurrency(trip.points_discount)}</span>
                            <span className="text-xs font-bold text-amber-700">خصم النقاط</span>
                          </div>
                        )}
                        {trip.vendor_discount_amount != null && trip.vendor_discount_amount > 0 && (
                          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                            <span className="text-xs font-bold text-green-700">- {formatCurrency(trip.vendor_discount_amount)}</span>
                            <span className="text-xs font-bold text-green-700">خصم المتجر{trip.vendor_discount_percentage != null && trip.vendor_discount_percentage > 0 ? ` (${trip.vendor_discount_percentage}%)` : ''}</span>
                          </div>
                        )}
                        {trip.payment_method && trip.payment_method !== 'cash' && (
                          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
                            <span className="text-xs font-bold text-blue-700">
                              {trip.payment_method === 'wallet' ? 'محفظة' :
                               trip.payment_method === 'card' ? 'بطاقة' :
                               trip.payment_method}
                            </span>
                            <span className="text-xs font-bold text-blue-700">طريقة الدفع</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1 bg-white/80 backdrop-blur-sm px-2 py-1 rounded-lg border border-gray-200">
                        <MapPin className="w-3 h-3 text-gray-700" />
                        <span className="text-xs font-semibold text-gray-900">{trip.delivery_city || trip.service_area || 'single'}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-white/80 backdrop-blur-sm px-2 py-1 rounded-lg border border-gray-200">
                        <span className="text-xs font-semibold text-gray-900">{formatOrderType(trip.order_type)}</span>
                      </div>
                      <div className={`flex items-center gap-1 backdrop-blur-sm px-2 py-1 rounded-lg border ${
                        trip.status === 'assigned' ? 'bg-yellow-100 border-yellow-300' :
                        trip.status === 'in_progress' ? 'bg-blue-100 border-blue-300' :
                        trip.status === 'completed' ? 'bg-emerald-100 border-emerald-300' :
                        trip.status === 'cancelled' ? 'bg-red-100 border-red-300' :
                        'bg-gray-100 border-gray-300'
                      }`}>
                        <DollarSign className={`w-3 h-3 ${
                          trip.status === 'assigned' ? 'text-yellow-700' :
                          trip.status === 'in_progress' ? 'text-blue-700' :
                          trip.status === 'completed' ? 'text-emerald-700' :
                          trip.status === 'cancelled' ? 'text-red-700' :
                          'text-gray-700'
                        }`} />
                        <span className={`text-xs font-bold ${
                          trip.status === 'assigned' ? 'text-yellow-900' :
                          trip.status === 'in_progress' ? 'text-blue-900' :
                          trip.status === 'completed' ? 'text-emerald-900' :
                          trip.status === 'cancelled' ? 'text-red-900' :
                          'text-gray-900'
                        }`}>{formatCurrency(trip.delivery_fee || 0)}</span>
                      </div>
                    </div>

                    <div className="text-center text-xs text-gray-500 pt-1">
                      {isExpanded ? '⬆ اخفاء التفاصيل' : '⬇ عرض التفاصيل'}
                    </div>
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                <div className="bg-white border-t border-gray-100">
                  {/* Order Notes */}
                  {trip.notes && (
                    <div className="mx-4 mt-4 bg-amber-50 rounded-xl p-3 border border-amber-200">
                      <div className="flex items-center gap-2 mb-1.5">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <span className="text-xs font-bold text-amber-700">ملاحظات الطلب</span>
                      </div>
                      <p className="text-sm text-gray-800">{trip.notes}</p>
                    </div>
                  )}

                  {/* Parcel Details */}
                  {(trip.order_type === 'طلب طرد' || trip.order_type === 'parcel') ? (
                    <div className="p-4 space-y-3">
                      {/* Sender */}
                      <div className="bg-orange-50 rounded-xl border border-orange-200 p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="bg-orange-500 p-1.5 rounded-lg">
                            <User className="w-4 h-4 text-white" />
                          </div>
                          <span className="text-sm font-bold text-orange-800">المُرسِل</span>
                        </div>
                        <div className="space-y-1.5">
                          {trip.store_name && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-gray-800">{trip.store_name.replace(' (مُرسِل)', '')}</span>
                              <span className="text-xs text-gray-500">الاسم</span>
                            </div>
                          )}
                          {trip.store_address && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm text-gray-700">{trip.store_address}</span>
                              <span className="text-xs text-gray-500">العنوان</span>
                            </div>
                          )}
                          {trip.store_phone && (
                            <a
                              href={`tel:${trip.store_phone}`}
                              className="flex items-center justify-center gap-2 bg-orange-500 text-white py-2 rounded-lg mt-1 text-sm font-bold"
                            >
                              <Phone className="w-4 h-4" />
                              اتصال بالمُرسِل
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Receiver */}
                      {trip.receiver_info && (
                        <div className="bg-green-50 rounded-xl border border-green-200 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="bg-green-500 p-1.5 rounded-lg">
                              <User className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-sm font-bold text-green-800">المُستلِم</span>
                          </div>
                          <div className="space-y-1.5">
                            {trip.receiver_info.name && (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-gray-800">{trip.receiver_info.name}</span>
                                <span className="text-xs text-gray-500">الاسم</span>
                              </div>
                            )}
                            {trip.receiver_info.address && (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm text-gray-700">{trip.receiver_info.address}</span>
                                <span className="text-xs text-gray-500">العنوان</span>
                              </div>
                            )}
                            {trip.receiver_info.phone && (
                              <a
                                href={`tel:${trip.receiver_info.phone}`}
                                className="flex items-center justify-center gap-2 bg-green-500 text-white py-2 rounded-lg mt-1 text-sm font-bold"
                              >
                                <Phone className="w-4 h-4" />
                                اتصال بالمُستلِم
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Delivery fee */}
                      <div className="flex items-center justify-between bg-gray-50 rounded-xl border border-gray-200 px-4 py-3">
                        <span className="text-base font-bold text-gray-900">{formatCurrency(trip.delivery_fee || 0)}</span>
                        <span className="text-sm font-bold text-gray-600">أجرة التوصيل</span>
                      </div>
                    </div>
                  ) : trip.items && trip.items.length > 0 ? (() => {
                    const vendorIds = [...new Set(trip.items!.map((i: any) => i.vendor_id).filter(Boolean))];
                    const isMultiVendor = vendorIds.length > 1;

                    type VendorGroup = { vendorId: string | undefined; vendorName: string; items: typeof trip.items };
                    const vendorGroups: VendorGroup[] = [];
                    if (isMultiVendor) {
                      const seen = new Map<string, number>();
                      trip.items!.forEach((item: any) => {
                        const key = item.vendor_id || '__unknown__';
                        if (!seen.has(key)) {
                          seen.set(key, vendorGroups.length);
                          vendorGroups.push({ vendorId: item.vendor_id, vendorName: item.vendor_name || 'متجر', items: [] });
                        }
                        vendorGroups[seen.get(key)!].items!.push(item);
                      });
                    } else {
                      vendorGroups.push({ vendorId: undefined, vendorName: '', items: trip.items });
                    }

                    const renderItem = (item: any, index: number) => {
                      const itemPrice = typeof item.price === 'string' ? parseFloat(item.price) : (item.price || 0);
                      const itemQty = typeof item.quantity === 'string' ? parseInt(item.quantity) : (item.quantity || 1);
                      return (
                        <div key={index} className="pb-2 border-b border-gray-200 last:border-0 last:pb-0">
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-sm font-bold text-gray-800">₪{(itemPrice * itemQty).toFixed(2)}</span>
                            <span className="text-sm font-semibold text-gray-900 text-right flex-1">
                              {item.product_name || item.name || 'منتج'}
                              {itemQty > 1 && <span className="text-gray-400 font-normal"> ({itemQty}x)</span>}
                            </span>
                          </div>
                          {item.variant_name && (
                            <p className="text-xs text-gray-500 mt-0.5 text-right">النوع: {item.variant_name}</p>
                          )}
                          {item.addons && item.addons.length > 0 && item.addons.map((addon: any, ai: number) => {
                            const ap = typeof addon.price === 'string' ? parseFloat(addon.price) : (addon.price || 0);
                            const aq = addon.quantity || 1;
                            return (
                              <div key={ai} className="flex justify-between items-center mt-1 gap-2">
                                <span className="text-xs font-semibold text-blue-600">
                                  {ap > 0 ? `+₪${(ap * aq).toFixed(2)}` : 'مجاني'}
                                </span>
                                <span className="text-xs text-gray-500 text-right">• {addon.name}{aq > 1 && ` (x${aq})`}</span>
                              </div>
                            );
                          })}
                          {item.notes && (
                            <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 mt-1 text-right">{item.notes}</p>
                          )}
                        </div>
                      );
                    };

                    // Calculate totals — mirror Orders.tsx logic
                    let subtotal: number;
                    if (trip.subtotal !== undefined && trip.subtotal > 0) {
                      subtotal = trip.subtotal;
                    } else {
                      subtotal = trip.items!.reduce((sum: number, item: any) => {
                        const p = typeof item.price === 'string' ? parseFloat(item.price) : (item.price || 0);
                        const q = typeof item.quantity === 'string' ? parseInt(item.quantity) : (item.quantity || 1);
                        const addonsTotal = item.addons ? item.addons.reduce((s: number, a: any) => {
                          const ap = typeof a.price === 'string' ? parseFloat(a.price) : (a.price || 0);
                          const aq = a.quantity || 1;
                          return s + ap * aq;
                        }, 0) : 0;
                        return sum + (p * q) + (addonsTotal * q);
                      }, 0);
                    }
                    const discount = (trip.coupon_discount || 0) + (trip.points_discount || 0) + (trip.vendor_discount_amount || 0);

                    return (
                      <div className="p-4">
                        <div className={`rounded-xl border overflow-hidden ${isMultiVendor ? 'border-orange-300 ring-2 ring-orange-200' : 'border-gray-200 bg-gray-50'}`}>
                          {/* Header */}
                          <div className={`p-3 border-b flex items-center justify-between ${isMultiVendor ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
                            <div className="flex items-center gap-2">
                              {isMultiVendor && (
                                <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                  {vendorIds.length} متاجر
                                </span>
                              )}
                            </div>
                            <p className={`text-sm font-bold text-right ${isMultiVendor ? 'text-orange-800' : 'text-gray-800'}`}>
                              {isMultiVendor ? 'طلب متعدد المتاجر' : 'ملخص الطلب'}
                            </p>
                          </div>

                          {/* Items grouped by vendor */}
                          {vendorGroups.map((group, gi) => (
                            <div key={gi}>
                              {isMultiVendor && (
                                <div className="bg-orange-100 px-3 py-1.5 border-b border-orange-200 flex items-center justify-end gap-1.5">
                                  <span className="text-xs font-bold text-orange-800">{group.vendorName}</span>
                                  <Store className="w-3.5 h-3.5 text-orange-600" />
                                </div>
                              )}
                              <div className="p-3 space-y-0">
                                {group.items!.map((item: any, idx: number) => renderItem(item, idx))}
                              </div>
                            </div>
                          ))}

                          {/* Totals */}
                          <div className={`p-3 border-t space-y-1.5 ${isMultiVendor ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-bold text-gray-800">₪{subtotal.toFixed(2)}</span>
                              <span className="text-xs text-gray-600">المجموع الفرعي</span>
                            </div>
                            {trip.coupon_discount != null && trip.coupon_discount > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-red-600">-₪{trip.coupon_discount.toFixed(2)}</span>
                                <span className="text-xs text-gray-600">خصم كوبون</span>
                              </div>
                            )}
                            {trip.points_discount != null && trip.points_discount > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-amber-600">-₪{trip.points_discount.toFixed(2)}</span>
                                <span className="text-xs text-gray-600">خصم النقاط</span>
                              </div>
                            )}
                            {trip.vendor_discount_amount != null && trip.vendor_discount_amount > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-green-600">-₪{trip.vendor_discount_amount.toFixed(2)}</span>
                                <span className="text-xs text-gray-600">خصم المتجر{trip.vendor_discount_percentage ? ` (${trip.vendor_discount_percentage}%)` : ''}</span>
                              </div>
                            )}
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-bold text-gray-800">₪{(trip.delivery_fee || 0).toFixed(2)}</span>
                              <span className="text-xs text-gray-600">التوصيل</span>
                            </div>
                            <div className="flex justify-between items-center pt-1 border-t border-gray-300">
                              <span className="text-base font-bold text-gray-900">₪{(subtotal - discount + (trip.delivery_fee || 0)).toFixed(2)}</span>
                              <span className="text-sm font-bold text-gray-800">المجموع الكلي</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })() : (
                    <div className="p-4">
                      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-center">
                        <ShoppingBag className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">لا توجد تفاصيل منتجات</p>
                      </div>
                    </div>
                  )}
                </div>
                )}

                {/* Action Buttons - Always Visible */}
                <div className="p-2 bg-white border-t border-gray-200">
                  {trip.status === 'assigned' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartTrip(trip.id);
                      }}
                      disabled={startingTrip === trip.id}
                      className={`w-full flex items-center justify-center px-4 py-2.5 rounded-lg text-white font-bold text-base transition-all duration-300 shadow-md hover:shadow-lg ${
                        startingTrip === trip.id ? 'bg-gray-400 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-700'
                      }`}
                    >
                      {startingTrip === trip.id ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                          جاري بدء الرحلة...
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <ArrowRight className="w-5 h-5" />
                          بدء الرحلة
                        </div>
                      )}
                    </button>
                  )}

                  {trip.status === 'in_progress' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCompleteTrip(trip.id);
                      }}
                      disabled={completingTrip === trip.id}
                      className={`w-full flex items-center justify-center px-4 py-2.5 rounded-lg text-white font-bold text-base transition-all duration-300 shadow-md hover:shadow-lg ${
                        completingTrip === trip.id ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'
                      }`}
                    >
                      {completingTrip === trip.id ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                          جاري إكمال الرحلة...
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <CheckCircle className="w-5 h-5" />
                          تم التوصيل
                        </div>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showMap && currentLocation && pickupLocation && selectedTrip && (
        <div className="fixed inset-0 bg-white z-50">
          <div className="h-full w-full flex flex-col">
            <div className="p-4 border-b">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">
                  {showFullRoute ? 'مسار التوصيل الكامل' : 'مسار الاستلام'}
                </h3>
                <div className="flex items-center gap-4">
                  {deliveryLocation && (
                    <button
                      onClick={() => setShowFullRoute(!showFullRoute)}
                      className="text-sm text-yellow-600 hover:text-yellow-700"
                    >
                      {showFullRoute ? 'عرض مسار الاستلام' : 'عرض المسار الكامل'}
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      setShowMap(false);
                      setSelectedTrip(null);
                      setPickupLocation(null);
                      setDeliveryLocation(null);
                      setShowFullRoute(false);
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
              </div>
              {selectedTrip.customer_phone && (
                <a 
                  href={`tel:${selectedTrip.customer_phone}`}
                  className="flex items-center justify-center bg-yellow-50 text-yellow-600 py-2 rounded-lg hover:bg-yellow-100 transition-colors"
                >
                  <Phone className="h-5 w-5 ml-2" />
                  <span>اتصال بالزبون - {selectedTrip.customer_phone}</span>
                </a>
              )}
            </div>
            <div className="flex-1 relative touch-none">
              <MapContainer
                center={currentLocation}
                zoom={13}
                scrollWheelZoom={false}
                doubleClickZoom={true}
                touchZoom={true}
                zoomControl={true}
                dragging={true}
                keyboard={true}
                boxZoom={true}
                className="h-full w-full"
                style={{ touchAction: 'none' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <GPSTrackingMap
                  currentPosition={gpsPosition}
                  destination={pickupLocation}
                  deliveryLocation={deliveryLocation}
                  positionHistory={positionHistory}
                  showFullRoute={showFullRoute}
                  isTracking={isGPSTracking}
                  orderInfo={{
                    orderNumber: selectedTrip.order_number,
                    customerName: selectedTrip.customer_name,
                    storeName: selectedTrip.store_name || selectedTrip.pickup_address,
                    deliveryFee: selectedTrip.delivery_fee,
                    orderType: selectedTrip.order_type
                  }}
                />
              </MapContainer>
            </div>
              
            {/* GPS Tracking Controls */}
            <div className="p-3 bg-gray-50 border-t">
              <GPSTrackingControls
                isTracking={isGPSTracking}
                currentPosition={gpsPosition}
                onStartTracking={startTracking}
                onStopTracking={stopTracking}
                error={gpsError}
                positionHistory={positionHistory}
              />
            </div>
            
            {/* Trip Details */}
            <div className="p-4 bg-white border-t">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-lg">رحلة {getDisplayOrderNumber(selectedTrip)}</span>
                <span className="text-sm text-gray-500">
                  اسحب للتنقل
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                <div>
                  <p className="text-gray-500 mb-1">العميل</p>
                  <p className="font-medium">{selectedTrip.customer_name}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">العمولة</p>
                  <p className="font-medium text-red-600">{formatCurrency(selectedTrip.delivery_fee || 0)}</p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                {selectedTrip.customer_phone && (
                  <a
                    href={`tel:${selectedTrip.customer_phone}`}
                    className="flex-1 flex items-center justify-center bg-yellow-600 text-white py-2 rounded-lg hover:bg-yellow-700 transition-colors"
                  >
                    <Phone className="h-4 w-4 ml-2" />
                    <span>اتصال بالعميل</span>
                  </a>
                )}

                {selectedTrip.status === 'assigned' && (
                  <button
                    onClick={() => handleStartTrip(selectedTrip.id)}
                    disabled={startingTrip === selectedTrip.id}
                    className={`flex-1 py-2 rounded-lg text-white font-medium transition-colors ${
                      startingTrip === selectedTrip.id ? 'bg-gray-400 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-700'
                    }`}
                  >
                    {startingTrip === selectedTrip.id ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        جاري...
                      </div>
                    ) : (
                      'بدء الرحلة'
                    )}
                  </button>
                )}

                {selectedTrip.status === 'in_progress' && (
                  <button
                    onClick={() => handleCompleteTrip(selectedTrip.id)}
                    disabled={completingTrip === selectedTrip.id}
                    className={`flex-1 py-2 rounded-lg text-white font-medium transition-colors ${
                      completingTrip === selectedTrip.id ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                  >
                    {completingTrip === selectedTrip.id ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        جاري...
                      </div>
                    ) : (
                      'تم التوصيل'
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}