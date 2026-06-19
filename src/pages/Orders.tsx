import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  MapPin,
  Phone,
  CheckCircle,
  Package,
  Truck,
  AlertCircle,
  Navigation,
  RefreshCw,
  Search,
  X,
  Maximize,
  Minimize,
  Target,
  Eye,
  EyeOff,
  Bell,
  ArrowDown,
  Store,
  User,
  DollarSign,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  History,
  ChevronRight,
  Calendar
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOrders } from '../context/OrdersContext';
import { getDriverDeliveries, updateDeliveryStatus, startDeliveryTrip, Delivery, getCompletedOrdersByDay, CompletedOrderDay } from '../services/delivery';
import { supabase } from '../services/auth';
import { formatDateTime } from '../utils/date';
import { formatCurrency, formatOrderType } from '../utils/delivery';
import { useCustomSound } from '../hooks/useCustomSound';
import { useBackgroundService } from '../hooks/useBackgroundService';
import { useNotifications } from '../hooks/useNotifications';
import { MapContainer, TileLayer } from 'react-leaflet';
import GPSTrackingMap from '../components/GPSTrackingMap';
import GPSTrackingControls from '../components/GPSTrackingControls';
import SimpleRouteMap from '../components/SimpleRouteMap';
import { useGPSTracking } from '../hooks/useGPSTracking';
import { useLocationPermission } from '../hooks/useLocationPermission';
import LocationPermissionPrompt from '../components/LocationPermissionPrompt';
import LoadingSpinner from '../components/LoadingSpinner';
import PreparationTimer from '../components/PreparationTimer';
import toast from 'react-hot-toast';

export default function Orders() {
  const { user } = useAuth();
  const { setPendingOrdersCount } = useOrders();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [pickupLocation, setPickupLocation] = useState<[number, number] | null>(null);
  const [deliveryLocation, setDeliveryLocation] = useState<[number, number] | null>(null);
  const [showFullRoute, setShowFullRoute] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSimpleMapModal, setShowSimpleMapModal] = useState(false);
  const [simpleMapDelivery, setSimpleMapDelivery] = useState<Delivery | null>(null);
  const [simpleMapPickupLocation, setSimpleMapPickupLocation] = useState<[number, number] | null>(null);
  const [simpleMapDeliveryLocation, setSimpleMapDeliveryLocation] = useState<[number, number] | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyDays, setHistoryDays] = useState<CompletedOrderDay[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  // Hooks
  const { hasPermission: hasLocationPermission, requestPermission: requestLocationPermission } = useLocationPermission();
  const { showOrderNotification } = useBackgroundService();
  const { testNotification, showNotification } = useNotifications();
  const { testCustomSound } = useCustomSound();

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
    distanceFilter: 5
  });

  // Update current location when GPS position changes
  useEffect(() => {
    if (gpsPosition) {
      setCurrentLocation([gpsPosition.latitude, gpsPosition.longitude]);
    }
  }, [gpsPosition]);

  // Get initial position
  useEffect(() => {
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

    if (hasLocationPermission) {
      getInitialPosition();
    }
    // getCurrentPosition is stable (memoized in useGPSTracking hook)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLocationPermission]);

  // Geocode address to coordinates
  const toggleOrderExpansion = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const openHistoryModal = async () => {
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try {
      const days = await getCompletedOrdersByDay();
      setHistoryDays(days);
      // Auto-expand today/yesterday
      if (days.length > 0) {
        setExpandedDays(new Set([days[0].date]));
      }
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  };

  const toggleDayExpansion = (date: string) => {
    setExpandedDays(prev => {
      const s = new Set(prev);
      if (s.has(date)) s.delete(date);
      else s.add(date);
      return s;
    });
  };

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

    return [32.4594, 35.2956];
  };

  const loadDeliveries = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setIsLoading(true);
        setError(null);
      }

      const data = await getDriverDeliveries();

      setDeliveries(data);

      // Update pending orders count in context for badge
      const pendingCount = data.filter(d => d.status === 'pending').length;
      setPendingOrdersCount(pendingCount);

      if (!silent) {
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'فشل في تحميل الطلبات';
      setError(message);
      if (!silent) {
        toast.error(message);
      }
      console.error('❌ Error loading deliveries:', error);
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [setPendingOrdersCount]);

  // Load deliveries on mount and set up auto-refresh
  useEffect(() => {
    loadDeliveries();

    const interval = setInterval(() => {
      loadDeliveries(true); // Silent refresh
    }, 10000); // Refresh every 10 seconds for faster updates

    return () => clearInterval(interval);
  }, [loadDeliveries]);

  // Listen for app foreground refresh events
  useEffect(() => {
    const handleForegroundRefresh = () => {
      loadDeliveries(true);
    };

    window.addEventListener('app-foreground-refresh', handleForegroundRefresh);
    return () => window.removeEventListener('app-foreground-refresh', handleForegroundRefresh);
  }, [loadDeliveries]);

  // Realtime subscription for order updates
  useEffect(() => {
    // Subscribe to driver_waiting_list changes
    const waitingListSubscription = supabase
      .channel('driver_waiting_list_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_waiting_list'
        },
        (payload) => {
          // Reload deliveries when any change occurs
          loadDeliveries(true);
        }
      )
      .subscribe();

    // Subscribe to captain_requests changes
    const captainRequestsSubscription = supabase
      .channel('captain_requests_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'captain_requests'
        },
        (payload) => {
          // Reload deliveries when any change occurs
          loadDeliveries(true);
        }
      )
      .subscribe();

    // Subscribe to orders table changes (for preparation_time updates)
    const ordersSubscription = supabase
      .channel('orders_preparation_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          // Immediately refresh when vendor updates preparation time
          loadDeliveries(true);
        }
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      waitingListSubscription.unsubscribe();
      captainRequestsSubscription.unsubscribe();
      ordersSubscription.unsubscribe();
    };
  }, [loadDeliveries]);

  const handleStatusUpdate = async (deliveryId: string, newStatus: 'delivering' | 'delivered') => {
    try {
      setUpdatingStatus(deliveryId);

      await updateDeliveryStatus(deliveryId, newStatus);

      const statusText = newStatus === 'delivering' ? 'تم قبول الطلب' : 'تم توصيل الطلب';
      toast.success(statusText);

      // Refresh deliveries
      await loadDeliveries(true);

      // Play notification sound for status update
      try {
        await testCustomSound();
      } catch (soundError) {
        // Silently handle sound error
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'فشل في تحديث حالة الطلب';
      toast.error(message);
      console.error('Error updating delivery status:', error);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleStartTrip = async (deliveryId: string) => {
    try {
      setUpdatingStatus(deliveryId);

      await startDeliveryTrip(deliveryId);

      toast.success('تم بدء الرحلة بنجاح');

      // Refresh deliveries
      await loadDeliveries(true);

      // Play notification sound
      try {
        await testCustomSound();
      } catch (soundError) {
        // Silently handle sound error
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'فشل في بدء الرحلة';
      toast.error(message);
      console.error('Error starting trip:', error);
    } finally {
      setUpdatingStatus(null);
    }
  };


  const handleShowRoute = async (delivery: Delivery) => {
    try {
      setSelectedDelivery(delivery);

      if (!currentLocation) {
        toast.error('يرجى تفعيل GPS لتحديد موقعك الحالي', {
          duration: 4000,
          icon: '📍'
        });
        return;
      }

      // Show loading toast
      const loadingToast = toast.loading('جاري تحميل المسار...');

      try {
        const pickupCoords = await geocodeAddress(delivery.pickup_location);

        if (!pickupCoords) {
          toast.dismiss(loadingToast);
          toast.error('لم نتمكن من تحديد موقع الاستلام على الخريطة', {
            duration: 4000
          });
          return;
        }
        setPickupLocation(pickupCoords);

        const deliveryCoords = await geocodeAddress(delivery.delivery_location);

        if (deliveryCoords) {
          setDeliveryLocation(deliveryCoords);
        }

        toast.dismiss(loadingToast);
        toast.success('تم تحميل المسار بنجاح', {
          duration: 2000,
          icon: '🗺️'
        });

        setShowMap(true);
      } catch (geocodeError) {
        toast.dismiss(loadingToast);
        console.error('❌ Geocoding error:', geocodeError);
        toast.error('فشل في تحديد الموقع على الخريطة', {
          duration: 4000
        });
      }
    } catch (error) {
      console.error('❌ Error in handleShowRoute:', error);
      toast.error('حدث خطأ في تحميل الخريطة. يرجى المحاولة مرة أخرى', {
        duration: 4000
      });
    }
  };

  const handleShowMap = async (delivery: Delivery) => {
    try {
      setSimpleMapDelivery(delivery);

      const loadingToast = toast.loading('جاري تحميل المسار...');

      try {
        const pickupCoords = await geocodeAddress(delivery.pickup_location);

        if (!pickupCoords) {
          toast.dismiss(loadingToast);
          toast.error('لم نتمكن من تحديد موقع الاستلام على الخريطة', {
            duration: 4000
          });
          return;
        }
        setSimpleMapPickupLocation(pickupCoords);

        const deliveryCoords = await geocodeAddress(delivery.delivery_location);

        if (deliveryCoords) {
          setSimpleMapDeliveryLocation(deliveryCoords);
        }

        toast.dismiss(loadingToast);
        toast.success('تم تحميل المسار بنجاح', {
          duration: 2000,
          icon: '🗺️'
        });

        setShowSimpleMapModal(true);
      } catch (geocodeError) {
        toast.dismiss(loadingToast);
        console.error('❌ Geocoding error:', geocodeError);
        toast.error('فشل في تحديد الموقع على الخريطة', {
          duration: 4000
        });
      }
    } catch (error) {
      console.error('❌ Error in handleShowMap:', error);
      toast.error('حدث خطأ في تحميل الخريطة. يرجى المحاولة مرة أخرى', {
        duration: 4000
      });
    }
  };

  const openInGoogleMaps = async (delivery: Delivery) => {
    try {
      let targetLocation = delivery.pickup_location;
      let locationName = 'موقع الاستلام';

      if (delivery.status === 'delivering') {
        targetLocation = delivery.delivery_location;
        locationName = 'موقع التوصيل';
      }

      const coords = await geocodeAddress(targetLocation);
      if (!coords) {
        toast.error(`لم نتمكن من تحديد ${locationName}`);
        return;
      }

      const destination = `${coords[0]},${coords[1]}`;
      const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;

      window.open(googleMapsUrl, '_blank');
      toast.success(`تم فتح التوجيه إلى ${locationName}`);
    } catch (error) {
      console.error('Error opening Google Maps:', error);
      toast.error('فشل في فتح خرائط Google');
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

  // Build a map of order_group_id -> count to detect grouped orders
  const groupCounts = new Map<string, number>();
  deliveries.forEach(d => {
    if (d.order_group_id) {
      groupCounts.set(d.order_group_id, (groupCounts.get(d.order_group_id) || 0) + 1);
    }
  });

  const filteredDeliveries = deliveries.filter(delivery => {
    const matchesSearch =
      delivery.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      delivery.delivery_location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      delivery.order_id.toString().includes(searchQuery);

    return matchesSearch;
  });

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          icon: Clock,
          text: 'قيد الانتظار',
          className: 'bg-yellow-50 text-yellow-700 border-yellow-200',
          buttonText: 'قبول الطلب',
          buttonClass: 'bg-yellow-600 hover:bg-yellow-700',
          nextStatus: 'delivering' as const,
          actionType: 'accept' as const,
          canAccept: true
        };
      case 'preparing':
        return {
          icon: Package,
          text: 'قيد التحضير',
          className: 'bg-orange-50 text-orange-700 border-orange-200',
          buttonText: 'استلام الطلب',
          buttonClass: 'bg-orange-600 hover:bg-orange-700',
          nextStatus: 'delivering' as const,
          actionType: 'accept' as const,
          canAccept: true
        };
      case 'assigned':
        return {
          icon: CheckCircle,
          text: 'مقبول - جاهز للانطلاق',
          className: 'bg-purple-50 text-purple-700 border-purple-200',
          buttonText: 'بدء الرحلة',
          buttonClass: 'bg-purple-600 hover:bg-purple-700',
          nextStatus: null,
          actionType: 'start_trip' as const,
          canAccept: true
        };
      case 'delivering':
        return {
          icon: Truck,
          text: 'قيد التوصيل',
          className: 'bg-blue-50 text-blue-700 border-blue-200',
          buttonText: 'تم التوصيل',
          buttonClass: 'bg-blue-600 hover:bg-blue-700',
          nextStatus: 'delivered' as const,
          actionType: 'deliver' as const,
          canAccept: true
        };
      case 'delivered':
        return {
          icon: CheckCircle,
          text: 'تم التوصيل',
          className: 'bg-green-50 text-green-700 border-green-200',
          buttonText: null,
          buttonClass: '',
          nextStatus: null,
          actionType: null,
          canAccept: false
        };
      default:
        return {
          icon: AlertCircle,
          text: 'غير محدد',
          className: 'bg-gray-50 text-gray-700 border-gray-200',
          buttonText: null,
          buttonClass: '',
          nextStatus: null,
          actionType: null,
          canAccept: false
        };
    }
  };

  // Test notifications function
  const testAllNotifications = async () => {
    try {
      // Test 1: Custom sound
      await testCustomSound();
      
      // Test 2: Background service notification
      await showOrderNotification(
        'اختبار إشعار الطلب',
        'هذا اختبار لإشعارات الطلبات الجديدة'
      );
      
      // Test 3: Regular notification
      await showNotification(
        'اختبار الإشعار العادي',
        {
          body: 'هذا اختبار للإشعارات العادية',
          tag: 'test-notification'
        }
      );
      
      // Test 4: System notification test
      await testNotification();
      
      toast.success('تم إرسال جميع أنواع الإشعارات للاختبار!');
    } catch (error) {
      console.error('Error testing notifications:', error);
      toast.error('فشل في اختبار الإشعارات');
    }
  };

  // If no location permission, show permission prompt
  if (hasLocationPermission === false) {
    return <LocationPermissionPrompt onPermissionGranted={() => window.location.reload()} />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <LoadingSpinner size="lg" color="emerald" />
          <p className="mt-4 text-gray-600">جاري تحميل الطلبات...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-red-700 mb-2">حدث خطأ</h3>
          <p className="text-lg text-red-600 mb-4">{error}</p>
          <button
            onClick={() => loadDeliveries()}
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
      {/* Header */}
      <div className="bg-secondary-800 p-6 text-white sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Package className="w-8 h-8" />
            <h1 className="text-3xl font-bold">الطلبات المتاحة</h1>
          </div>
          
          <div className="flex items-center gap-2">
            {/* History button */}
            <button
              onClick={openHistoryModal}
              className="p-2 bg-secondary-700 rounded-lg hover:bg-secondary-900 transition-colors"
              title="الطلبات القديمة"
            >
              <History className="w-5 h-5" />
            </button>

            {/* Test notifications button */}
            <button
              onClick={testAllNotifications}
              className="p-2 bg-secondary-700 rounded-lg hover:bg-secondary-900 transition-colors"
              title="اختبار الإشعارات"
            >
              <Bell className="w-5 h-5" />
            </button>

            {/* Manual refresh */}
            <button
              onClick={() => loadDeliveries()}
              className="p-2 bg-secondary-700 rounded-lg hover:bg-secondary-900 transition-colors"
              title="تحديث يدوي"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mt-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-secondary-300 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="البحث برقم الطلب أو اسم العميل أو العنوان..."
              className="w-full bg-secondary-700 text-white placeholder-secondary-200 rounded-lg px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="p-4 space-y-4 pb-24">
        {filteredDeliveries.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-800 mb-2">
              {searchQuery ? 'لا توجد نتائج' : 'لا توجد طلبات متاحة'}
            </h3>
            <p className="text-gray-600">
              {searchQuery
                ? 'جرب تغيير كلمات البحث'
                : 'لا توجد طلبات متاحة في الوقت الحالي'
              }
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-4 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
              >
                مسح البحث
              </button>
            )}
          </div>
        ) : (
          filteredDeliveries.map((delivery) => {
            const statusConfig = getStatusConfig(delivery.status);
            const StatusIcon = statusConfig.icon;
            const isUpdating = updatingStatus === delivery.id;

            // Determine card background color based on status
            const getCardBgClass = () => {
              switch (delivery.status) {
                case 'pending':
                case 'preparing':
                  return 'bg-gradient-to-r from-rose-50 via-rose-100 to-rose-50 hover:from-rose-100 hover:via-rose-200 hover:to-rose-100';
                case 'assigned':
                  return 'bg-gradient-to-r from-purple-50 via-purple-100 to-purple-50 hover:from-purple-100 hover:via-purple-200 hover:to-purple-100';
                case 'delivering':
                  return 'bg-gradient-to-r from-yellow-50 via-yellow-100 to-yellow-50 hover:from-yellow-100 hover:via-yellow-200 hover:to-yellow-100';
                case 'delivered':
                  return 'bg-gradient-to-r from-green-50 via-green-100 to-green-50 hover:from-green-100 hover:via-green-200 hover:to-green-100';
                default:
                  return 'bg-gradient-to-r from-gray-50 via-gray-100 to-gray-50 hover:from-gray-100 hover:via-gray-200 hover:to-gray-100';
              }
            };

            // Determine icon background color
            const getIconBgClass = () => {
              switch (delivery.status) {
                case 'pending':
                case 'preparing':
                  return 'bg-rose-200';
                case 'assigned':
                  return 'bg-purple-200';
                case 'delivering':
                  return 'bg-yellow-200';
                case 'delivered':
                  return 'bg-green-200';
                default:
                  return 'bg-gray-200';
              }
            };

            // Determine icon color
            const getIconColorClass = () => {
              switch (delivery.status) {
                case 'pending':
                case 'preparing':
                  return 'text-rose-700';
                case 'assigned':
                  return 'text-purple-700';
                case 'delivering':
                  return 'text-yellow-700';
                case 'delivered':
                  return 'text-green-700';
                default:
                  return 'text-gray-700';
              }
            };

            const isExpanded = expandedOrders.has(delivery.id);

            const isGroupedOrder = !!(delivery.order_group_id && (groupCounts.get(delivery.order_group_id) || 0) > 1);
            const groupSize = isGroupedOrder ? groupCounts.get(delivery.order_group_id!) : 0;

            return (
              <div key={delivery.id} className={`bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-lg transition-all duration-300 ${isGroupedOrder ? 'border-2 border-orange-400' : 'border border-gray-300'}`}>
                {/* Grouped order banner */}
                {isGroupedOrder && (
                  <div className="bg-orange-500 text-white text-xs font-bold text-center py-1.5 flex items-center justify-center gap-2">
                    <Store className="w-3.5 h-3.5" />
                    طلب متعدد المتاجر — {groupSize} طلبات من نفس الزبون
                  </div>
                )}

                {/* Compact Header - Always Visible - Clickable */}
                <button
                  onClick={() => toggleOrderExpansion(delivery.id)}
                  className={`w-full ${getCardBgClass()} p-3 text-gray-900 text-right transition-all border-b border-gray-200`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`${getIconBgClass()} p-1.5 rounded-lg`}>
                        <Package className={`w-5 h-5 ${getIconColorClass()}`} />
                      </div>
                      <span className="text-xl font-bold text-gray-900">#{delivery.order_id}</span>
                      {/* Order Type Badge */}
                      {delivery.order_type && (
                        <div className={`px-2 py-1 rounded-lg text-xs font-bold ${
                          delivery.order_type === 'طلب كابتن'
                            ? 'bg-purple-100 text-purple-700 border border-purple-300'
                            : delivery.order_type === 'طلب طرد'
                            ? 'bg-orange-100 text-orange-700 border border-orange-300'
                            : 'bg-blue-100 text-blue-700 border border-blue-300'
                        }`}>
                          {delivery.order_type === 'طلب كابتن' ? '🚗 كابتن' :
                           delivery.order_type === 'طلب طرد' ? '📦 طرد' :
                           '🍔 توصيل'}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`inline-flex items-center px-3 py-1 rounded-full border-2 text-xs font-bold shadow-md ${statusConfig.className}`}>
                        <StatusIcon className="w-3 h-3 ml-1" />
                        {statusConfig.text}
                      </div>
                      <div className={`${getIconBgClass()} p-1 rounded-lg`}>
                        {isExpanded ? (
                          <ChevronUp className={`w-5 h-5 ${getIconColorClass()}`} />
                        ) : (
                          <ChevronDown className={`w-5 h-5 ${getIconColorClass()}`} />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Compact Info - Always Visible */}
                  <div className="space-y-2">
                    {/* Combined Store and Customer Info in one row */}
                    <div className="grid grid-cols-2 gap-2">
                      {delivery.order_type === 'توصيل طرد' ? (
                        <>
                          {/* Parcel: Sender */}
                          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-2 border border-orange-200">
                            <div className="flex items-center gap-2">
                              <div className="bg-orange-100 p-1.5 rounded-lg">
                                <User className="w-4 h-4 text-orange-600 flex-shrink-0" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-orange-600 font-bold">المرسِل</div>
                                <div className="font-bold text-gray-900 text-sm truncate">{delivery.customer_name}</div>
                              </div>
                              {delivery.customer_phone && (
                                <a
                                  href={`tel:${delivery.customer_phone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center justify-center bg-orange-500 text-white w-8 h-8 rounded-lg hover:bg-orange-600 transition-all shadow flex-shrink-0"
                                >
                                  <Phone className="w-4 h-4" />
                                </a>
                              )}
                            </div>
                          </div>
                          {/* Parcel: Receiver */}
                          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-2 border border-green-200">
                            <div className="flex items-center gap-2">
                              <div className="bg-green-100 p-1.5 rounded-lg">
                                <User className="w-4 h-4 text-green-600 flex-shrink-0" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-green-600 font-bold">المستلِم</div>
                                <div className="font-bold text-gray-900 text-sm truncate">
                                  {delivery.receiver_info?.name || 'غير محدد'}
                                </div>
                              </div>
                              {delivery.receiver_info?.phone && (
                                <a
                                  href={`tel:${delivery.receiver_info.phone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center justify-center bg-green-600 text-white w-8 h-8 rounded-lg hover:bg-green-700 transition-all shadow flex-shrink-0"
                                >
                                  <Phone className="w-4 h-4" />
                                </a>
                              )}
                            </div>
                          </div>
                        </>
                      ) : delivery.store_info?.name ? (
                        <>
                          {/* Store Info */}
                          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-2 border border-gray-200">
                            <div className="flex items-center gap-2">
                              <div className="bg-amber-100 p-1.5 rounded-lg">
                                <Store className="w-4 h-4 text-amber-600 flex-shrink-0" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-gray-600">المتجر</div>
                                <div className="font-bold text-gray-900 text-sm truncate">{delivery.store_info.name}</div>
                                {delivery.store_info.address && (
                                  <div className="text-xs text-gray-500 truncate">{delivery.store_info.address}</div>
                                )}
                              </div>
                              {delivery.store_info?.phone && (
                                <a
                                  href={`tel:${delivery.store_info.phone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center justify-center bg-amber-600 text-white w-8 h-8 rounded-lg hover:bg-amber-700 transition-all shadow flex-shrink-0"
                                >
                                  <Phone className="w-4 h-4" />
                                </a>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Pickup location when no store info */}
                          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-2 border border-gray-200 col-span-2">
                            <div className="flex items-center gap-2">
                              <MapPin className={`w-4 h-4 ${getIconColorClass()} flex-shrink-0`} />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-gray-600 font-medium">الاستلام</div>
                                <div className="font-bold text-gray-900 text-sm truncate">{delivery.pickup_location}</div>
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Customer Info - only for non-parcel orders */}
                      {delivery.order_type !== 'توصيل طرد' && (
                        <div className="bg-white/80 backdrop-blur-sm rounded-lg p-2 border border-gray-200">
                          <div className="flex items-center gap-2">
                            <div className="bg-green-100 p-1.5 rounded-lg">
                              <User className="w-4 h-4 text-green-600 flex-shrink-0" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-gray-600">العميل</div>
                              <div className="font-bold text-gray-900 text-sm truncate">{delivery.customer_name}</div>
                            </div>
                            {delivery.customer_phone && (
                              <a
                                href={`tel:${delivery.customer_phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center justify-center bg-green-600 text-white w-8 h-8 rounded-lg hover:bg-green-700 transition-all shadow flex-shrink-0"
                              >
                                <Phone className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        </div>
                      )}
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
                            {delivery.service_area && ` - ${delivery.service_area}`}
                            {delivery.delivery_city && ` - ${delivery.delivery_city}`}
                          </p>
                          <p className="text-sm font-bold text-gray-900 truncate">{delivery.delivery_location}</p>
                        </div>
                        <button
                          onClick={() => handleShowMap(delivery)}
                          className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg transition-all duration-200 flex items-center gap-1.5 text-xs font-bold shadow-md hover:shadow-lg"
                          title="عرض المسار"
                        >
                          <Navigation className="w-4 h-4" />
                          <span>مسار</span>
                        </button>
                      </div>
                    </div>

                    {/* Preparation Timer - Show for all orders that need preparation tracking */}
                    <PreparationTimer
                      preparationStart={delivery.preparation_start}
                      preparationStartTime={delivery.preparation_start_time}
                      preparationEnd={delivery.preparation_end}
                      preparationTime={delivery.preparation_time}
                      actualPreparationTime={delivery.actual_preparation_time}
                    />

                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1 bg-white/80 backdrop-blur-sm px-2 py-1 rounded-lg border border-gray-200">
                        <MapPin className="w-3 h-3 text-gray-700" />
                        <span className="text-xs font-semibold text-gray-900">{delivery.delivery_city || delivery.service_area || 'single'}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-white/80 backdrop-blur-sm px-2 py-1 rounded-lg border border-gray-200">
                        <span className="text-xs font-semibold text-gray-900">{formatOrderType(delivery.order_type)}</span>
                      </div>
                      <div className={`flex items-center gap-1 ${getIconBgClass()} backdrop-blur-sm px-2 py-1 rounded-lg border ${delivery.status === 'pending' || delivery.status === 'preparing' ? 'border-rose-300' : delivery.status === 'delivering' ? 'border-yellow-300' : 'border-green-300'}`}>
                        <DollarSign className={`w-3 h-3 ${getIconColorClass()}`} />
                        <span className={`text-xs font-bold ${delivery.status === 'pending' || delivery.status === 'preparing' ? 'text-rose-900' : delivery.status === 'delivering' ? 'text-yellow-900' : 'text-green-900'}`}>{formatCurrency(delivery.delivery_fee)}</span>
                      </div>
                    </div>

                    {/* Discount & Payment Info */}
                    {((delivery.coupon_discount != null && delivery.coupon_discount > 0) ||
                      (delivery.points_discount != null && delivery.points_discount > 0) ||
                      (delivery.vendor_discount_amount != null && delivery.vendor_discount_amount > 0) ||
                      (delivery.payment_method && delivery.payment_method !== 'cash')) && (
                      <div className="space-y-1">
                        {delivery.coupon_discount != null && delivery.coupon_discount > 0 && (
                          <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5">
                            <span className="text-xs font-bold text-orange-700">- {formatCurrency(delivery.coupon_discount)}</span>
                            <span className="text-xs font-bold text-orange-700">خصم كوبون</span>
                          </div>
                        )}
                        {delivery.points_discount != null && delivery.points_discount > 0 && (
                          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                            <span className="text-xs font-bold text-amber-700">- {formatCurrency(delivery.points_discount)}</span>
                            <span className="text-xs font-bold text-amber-700">خصم النقاط</span>
                          </div>
                        )}
                        {delivery.vendor_discount_amount != null && delivery.vendor_discount_amount > 0 && (
                          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                            <span className="text-xs font-bold text-green-700">- {formatCurrency(delivery.vendor_discount_amount)}</span>
                            <span className="text-xs font-bold text-green-700">خصم المتجر{delivery.vendor_discount_percentage != null && delivery.vendor_discount_percentage > 0 ? ` (${delivery.vendor_discount_percentage}%)` : ''}</span>
                          </div>
                        )}
                        {delivery.payment_method && delivery.payment_method !== 'cash' && (
                          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
                            <span className="text-xs font-bold text-blue-700">
                              {delivery.payment_method === 'wallet' ? 'محفظة' :
                               delivery.payment_method === 'card' ? 'بطاقة' :
                               delivery.payment_method}
                            </span>
                            <span className="text-xs font-bold text-blue-700">طريقة الدفع</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="text-center text-xs text-gray-500 pt-1">
                      {isExpanded ? '⬆ اخفاء التفاصيل' : '⬇ عرض تفاصيل المنتج'}
                    </div>
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                <div className="bg-white border-t border-gray-100">
                  {/* Parcel Details - special section for parcel orders */}
                  {delivery.order_type === 'توصيل طرد' && (
                    <div className="mx-4 mt-4 space-y-3">
                      {/* Sender address */}
                      <div className="bg-orange-50 rounded-xl p-3 border border-orange-200">
                        <div className="flex items-center gap-2 mb-1.5">
                          <MapPin className="w-4 h-4 text-orange-600" />
                          <span className="text-xs font-bold text-orange-700">عنوان الاستلام (المرسِل)</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-800">{delivery.pickup_location}</p>
                        {delivery.customer_phone && (
                          <a href={`tel:${delivery.customer_phone}`} className="mt-2 flex items-center gap-2 text-sm text-orange-700 font-medium">
                            <Phone className="w-3.5 h-3.5" />
                            {delivery.customer_phone}
                          </a>
                        )}
                      </div>
                      {/* Receiver address */}
                      <div className="bg-green-50 rounded-xl p-3 border border-green-200">
                        <div className="flex items-center gap-2 mb-1.5">
                          <MapPin className="w-4 h-4 text-green-600" />
                          <span className="text-xs font-bold text-green-700">عنوان التسليم (المستلِم)</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-800">
                          {delivery.receiver_info?.name && <span className="block text-green-800 font-bold">{delivery.receiver_info.name}</span>}
                          {delivery.delivery_location}
                        </p>
                        {delivery.receiver_info?.phone && (
                          <a href={`tel:${delivery.receiver_info.phone}`} className="mt-2 flex items-center gap-2 text-sm text-green-700 font-medium">
                            <Phone className="w-3.5 h-3.5" />
                            {delivery.receiver_info.phone}
                          </a>
                        )}
                      </div>
                      {/* Package description */}
                      {delivery.notes && (
                        <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Package className="w-4 h-4 text-amber-600" />
                            <span className="text-xs font-bold text-amber-700">وصف الطرد</span>
                          </div>
                          <p className="text-sm text-gray-800">{delivery.notes}</p>
                        </div>
                      )}
                      {/* Fee */}
                      <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 flex items-center justify-between">
                        <span className="text-base font-bold text-gray-900">₪{delivery.delivery_fee.toFixed(2)}</span>
                        <span className="text-sm font-bold text-gray-600">عمولة التوصيل</span>
                      </div>
                    </div>
                  )}

                  {/* Order Notes - for non-parcel orders */}
                  {delivery.order_type !== 'توصيل طرد' && delivery.notes && (
                    <div className="mx-4 mt-4 bg-amber-50 rounded-xl p-3 border border-amber-200">
                      <div className="flex items-center gap-2 mb-1.5">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <span className="text-xs font-bold text-amber-700">ملاحظات الطلب</span>
                      </div>
                      <p className="text-sm text-gray-800">{delivery.notes}</p>
                    </div>
                  )}

                  {/* Order Summary with items - only for non-parcel orders */}
                  {delivery.order_type !== 'توصيل طرد' && (
                  <div className="p-4">
                    {(() => {
                      const hasItems = delivery.items && delivery.items.length > 0;

                      // Detect multi-vendor: items from more than one distinct vendor
                      const vendorIds = hasItems
                        ? [...new Set(delivery.items!.map(i => i.vendor_id).filter(Boolean))]
                        : [];
                      const isMultiVendor = vendorIds.length > 1;

                      // Group items by vendor for multi-vendor display
                      const vendorGroups: { vendorId: string | undefined; vendorName: string; items: typeof delivery.items }[] = [];
                      if (hasItems) {
                        if (isMultiVendor) {
                          const seen = new Map<string, number>();
                          delivery.items!.forEach(item => {
                            const key = item.vendor_id || '__unknown__';
                            if (!seen.has(key)) {
                              seen.set(key, vendorGroups.length);
                              vendorGroups.push({ vendorId: item.vendor_id, vendorName: item.vendor_name || 'متجر', items: [] });
                            }
                            vendorGroups[seen.get(key)!].items!.push(item);
                          });
                        } else {
                          vendorGroups.push({ vendorId: undefined, vendorName: '', items: delivery.items });
                        }
                      }

                      // Use subtotal and coupon_discount from DB when available
                      let subtotal: number;
                      if (delivery.subtotal !== undefined && delivery.subtotal > 0) {
                        subtotal = delivery.subtotal;
                      } else if (hasItems) {
                        subtotal = delivery.items!.reduce((sum, item) => {
                          const p = typeof item.price === 'string' ? parseFloat(item.price as any) : (item.price || 0);
                          const q = typeof item.quantity === 'string' ? parseInt(item.quantity as any) : (item.quantity || 1);
                          const addonsTotal = item.addons ? item.addons.reduce((s, a) => {
                            const ap = typeof a.price === 'string' ? parseFloat(a.price as any) : (a.price || 0);
                            const aq = a.quantity || 1;
                            return s + ap * aq;
                          }, 0) : 0;
                          return sum + (p * q) + (addonsTotal * q);
                        }, 0);
                      } else {
                        subtotal = delivery.total_amount - delivery.delivery_fee;
                      }

                      const discount = (delivery.coupon_discount || 0) + (delivery.points_discount || 0) + (delivery.vendor_discount_amount || 0)
                        || Math.max(0, subtotal + delivery.delivery_fee - delivery.total_amount);

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

                      return (
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

                          <div className={`p-3 space-y-3 ${isMultiVendor ? 'bg-orange-50/30' : 'bg-gray-50'}`}>

                            {/* Items grouped by vendor */}
                            {vendorGroups.map((group, gi) => (
                              <div key={gi}>
                                {isMultiVendor && (
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="flex-1 h-px bg-orange-200"></div>
                                    <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full border border-orange-200">
                                      {group.vendorName}
                                    </span>
                                    <div className="flex-1 h-px bg-orange-200"></div>
                                  </div>
                                )}
                                <div className="space-y-2">
                                  {group.items!.map((item, idx) => renderItem(item, idx))}
                                </div>
                              </div>
                            ))}

                            {/* Totals */}
                            <div className="pt-1 space-y-1.5 border-t border-gray-200" dir="rtl">
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">المجموع الفرعي</span>
                                <span className="font-semibold text-gray-800">₪{subtotal.toFixed(2)}</span>
                              </div>
                              {delivery.coupon_discount != null && delivery.coupon_discount > 0 && (
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-orange-600">خصم كوبون</span>
                                  <span className="font-semibold text-orange-600">-₪{delivery.coupon_discount.toFixed(2)}</span>
                                </div>
                              )}
                              {delivery.points_discount != null && delivery.points_discount > 0 && (
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-amber-600">خصم النقاط</span>
                                  <span className="font-semibold text-amber-600">-₪{delivery.points_discount.toFixed(2)}</span>
                                </div>
                              )}
                              {delivery.vendor_discount_amount != null && delivery.vendor_discount_amount > 0 && (
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-green-600">خصم المتجر{delivery.vendor_discount_percentage != null && delivery.vendor_discount_percentage > 0 ? ` (${delivery.vendor_discount_percentage}%)` : ''}</span>
                                  <span className="font-semibold text-green-600">-₪{delivery.vendor_discount_amount.toFixed(2)}</span>
                                </div>
                              )}
                              {discount > 0.01 && delivery.coupon_discount == null && delivery.points_discount == null && delivery.vendor_discount_amount == null && (
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-green-600">خصم</span>
                                  <span className="font-semibold text-green-600">-₪{discount.toFixed(2)}</span>
                                </div>
                              )}
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">التوصيل</span>
                                <span className="font-semibold text-gray-800">₪{delivery.delivery_fee.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between items-center pt-1.5 border-t border-gray-200">
                                <span className="text-sm font-bold text-gray-900">المجموع الكلي</span>
                                <span className="text-base font-bold text-red-600">₪{delivery.total_amount.toFixed(2)}</span>
                              </div>
                            </div>

                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  )}
                </div>
                )}

                {/* Action Button - Always Visible on Card */}
                <div className="p-2 bg-white">
                  {statusConfig.buttonText ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent card expansion
                        if (statusConfig.actionType === 'start_trip') {
                          handleStartTrip(delivery.id);
                        } else if (statusConfig.nextStatus) {
                          handleStatusUpdate(delivery.id, statusConfig.nextStatus);
                        }
                      }}
                      disabled={isUpdating}
                      className={`w-full btn-hover-lift ripple px-4 py-2.5 rounded-lg text-white font-bold text-base transition-all duration-300 ${
                        isUpdating ? 'bg-gray-400 cursor-not-allowed' : `${statusConfig.buttonClass} shadow-md hover:shadow-lg`
                      }`}
                    >
                      {isUpdating ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                          جاري التحديث...
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <StatusIcon className="w-5 h-5" />
                          {statusConfig.buttonText}
                        </div>
                      )}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col">
          <div className="bg-white flex flex-col h-full max-h-full">
            {/* Header */}
            <div className="bg-gray-800 text-white px-4 py-4 flex items-center justify-between flex-shrink-0">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <History className="w-6 h-6" />
                <h2 className="text-xl font-bold">الطلبات المنجزة</h2>
              </div>
              <div className="w-10" />
            </div>

            {/* Summary bar */}
            {!historyLoading && historyDays.length > 0 && (
              <div className="bg-emerald-600 text-white px-4 py-2 flex items-center justify-between flex-shrink-0">
                <span className="text-sm font-bold">
                  ₪{historyDays.reduce((s, d) => s + d.totalEarnings, 0).toFixed(2)} إجمالي الأرباح
                </span>
                <span className="text-sm">
                  {historyDays.reduce((s, d) => s + d.orders.length, 0)} طلب مكتمل
                </span>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto pb-6">
              {historyLoading ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                  <div className="w-8 h-8 border-3 border-gray-300 border-t-emerald-600 rounded-full animate-spin" />
                  <p className="text-gray-500">جاري التحميل...</p>
                </div>
              ) : historyDays.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
                  <Package className="w-12 h-12 opacity-40" />
                  <p className="text-lg font-medium">لا توجد طلبات مكتملة</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {historyDays.map(day => (
                    <div key={day.date}>
                      {/* Day header - clickable */}
                      <button
                        onClick={() => toggleDayExpansion(day.date)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-right"
                      >
                        <div className="flex items-center gap-2 text-gray-500 text-sm">
                          <span className="font-bold text-emerald-600">₪{day.totalEarnings.toFixed(2)}</span>
                          <span className="text-gray-400">·</span>
                          <span>{day.orders.length} طلب</span>
                          {expandedDays.has(day.date)
                            ? <ChevronDown className="w-4 h-4" />
                            : <ChevronRight className="w-4 h-4" />
                          }
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="font-bold text-gray-800 text-base">{day.label}</span>
                        </div>
                      </button>

                      {/* Orders in this day */}
                      {expandedDays.has(day.date) && (
                        <div className="divide-y divide-gray-100 bg-white">
                          {day.orders.map(trip => (
                            <div key={trip.id} className="px-4 py-3">
                              <div className="flex items-start justify-between gap-3">
                                {/* Right side - info */}
                                <div className="flex-1 text-right">
                                  {/* Order number + type */}
                                  <div className="flex items-center justify-end gap-2 mb-1">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                      trip.order_type === 'طلب كابتن'
                                        ? 'bg-gray-100 text-gray-600'
                                        : trip.order_type === 'توصيل طرد'
                                        ? 'bg-orange-100 text-orange-700'
                                        : 'bg-blue-100 text-blue-700'
                                    }`}>
                                      {trip.order_type === 'طلب كابتن' ? 'كابتن' :
                                       trip.order_type === 'توصيل طرد' ? 'طرد' : 'توصيل'}
                                    </span>
                                    <span className="font-bold text-gray-900">
                                      {trip.order_number ? `#${trip.order_number}` : `#${trip.id.slice(0, 8)}`}
                                    </span>
                                  </div>

                                  {/* Customer */}
                                  <div className="flex items-center justify-end gap-1.5 text-sm text-gray-700 mb-0.5">
                                    <span>{trip.customer_name}</span>
                                    <User className="w-3.5 h-3.5 text-gray-400" />
                                  </div>

                                  {/* Store name */}
                                  {trip.store_name && (
                                    <div className="flex items-center justify-end gap-1.5 text-xs text-gray-500 mb-0.5">
                                      <span>{trip.store_name}</span>
                                      <Store className="w-3 h-3 text-gray-400" />
                                    </div>
                                  )}

                                  {/* Delivery address */}
                                  {trip.delivery_address && (
                                    <div className="flex items-center justify-end gap-1.5 text-xs text-gray-500 mb-0.5">
                                      <span className="truncate max-w-[200px]">{trip.delivery_address}</span>
                                      <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                    </div>
                                  )}

                                  {/* Time */}
                                  <div className="text-xs text-gray-400 mt-1">
                                    {trip.completed_at
                                      ? new Date(trip.completed_at).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })
                                      : ''}
                                  </div>
                                </div>

                                {/* Left side - earnings */}
                                <div className="flex flex-col items-center justify-center bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 min-w-[70px]">
                                  <span className="text-xs text-emerald-600 font-medium">عمولة</span>
                                  <span className="text-base font-bold text-emerald-700">₪{(trip.delivery_fee || 0).toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Map Modal */}
      {showMap && currentLocation && pickupLocation && selectedDelivery && (
        <div className={`fixed inset-0 bg-white z-50 ${isFullscreen ? '' : 'p-4'}`}>
          <div className="h-full w-full flex flex-col">
            {/* Map Header */}
            <div className="p-4 border-b bg-white">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">
                  {showFullRoute ? 'مسار التوصيل الكامل' : 'مسار الاستلام'}
                </h3>
                <div className="flex items-center gap-2">
                  {/* Controls toggle */}
                  <button
                    onClick={() => setShowControls(!showControls)}
                    className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    title="إظهار/إخفاء التحكم"
                  >
                    {showControls ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                  
                  {/* Fullscreen toggle */}
                  <button
                    onClick={toggleFullscreen}
                    className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    title="شاشة كاملة"
                  >
                    {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                  </button>
                  
                  {/* Route toggle */}
                  {deliveryLocation && (
                    <button
                      onClick={() => setShowFullRoute(!showFullRoute)}
                      className="px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors text-sm"
                    >
                      {showFullRoute ? 'مسار الاستلام' : 'المسار الكامل'}
                    </button>
                  )}

                  {/* Open in Google Maps button */}
                  <button
                    onClick={() => openInGoogleMaps(selectedDelivery)}
                    className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
                    title="فتح في خرائط Google"
                  >
                    <Navigation className="w-4 h-4" />
                  </button>

                  {/* Close button */}
                  <button 
                    onClick={() => {
                      setShowMap(false);
                      setSelectedDelivery(null);
                      setPickupLocation(null);
                      setDeliveryLocation(null);
                      setShowFullRoute(false);
                      setIsFullscreen(false);
                      document.body.style.overflow = 'auto';
                    }}
                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              {/* Customer contact */}
              {selectedDelivery.customer_phone && (
                <a 
                  href={`tel:${selectedDelivery.customer_phone}`}
                  className="flex items-center justify-center bg-yellow-50 text-yellow-600 py-2 rounded-lg hover:bg-yellow-100 transition-colors"
                >
                  <Phone className="h-5 w-5 ml-2" />
                  <span>اتصال بالزبون - {selectedDelivery.customer_phone}</span>
                </a>
              )}
            </div>

            {/* Map Container */}
            <div className={`flex-1 relative ${isFullscreen ? 'h-screen' : ''}`}>
              <MapContainer
                center={currentLocation}
                zoom={13}
                scrollWheelZoom={true}
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
                    orderNumber: selectedDelivery.order_number,
                    customerName: selectedDelivery.customer_name,
                    storeName: selectedDelivery.store_info?.name || selectedDelivery.pickup_location,
                    deliveryFee: selectedDelivery.delivery_fee,
                    orderType: selectedDelivery.order_type
                  }}
                />
              </MapContainer>

              {/* Map Controls */}
              <div className="absolute top-4 right-4 z-10 space-y-2">
                <button
                  onClick={async () => {
                    try {
                      const position = await getCurrentPosition();
                      if (position) {
                        setCurrentLocation([position.latitude, position.longitude]);
                      }
                    } catch (error) {
                      toast.error('فشل في تحديد الموقع الحالي');
                    }
                  }}
                  className="bg-white p-3 rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
                  title="توسيط على موقعي"
                >
                  <Target className="w-5 h-5 text-red-600" />
                </button>
              </div>
            </div>
            
            {/* GPS Controls */}
            {showControls && (
              <div className="p-3 bg-gray-50 border-t map-controls-section max-h-40 overflow-y-auto">
                <GPSTrackingControls
                  isTracking={isGPSTracking}
                  currentPosition={gpsPosition}
                  onStartTracking={startTracking}
                  onStopTracking={stopTracking}
                  error={gpsError}
                  positionHistory={positionHistory}
                />
              </div>
            )}
            
            {/* Delivery Details */}
            <div className="p-4 bg-white border-t">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-lg">طلب #{selectedDelivery.order_id}</span>
                <span className="text-sm text-gray-500">
                  {isFullscreen ? 'اضغط مرتين للتكبير' : 'اسحب للتنقل'}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 mb-1">العميل</p>
                  <p className="font-medium">{selectedDelivery.customer_name}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">العمولة</p>
                  <p className="font-medium text-red-600">{formatCurrency(selectedDelivery.delivery_fee)}</p>
                </div>
              </div>
              
              {/* Action buttons */}
              <div className="flex gap-3 mt-4">
                {selectedDelivery.customer_phone && (
                  <a
                    href={`tel:${selectedDelivery.customer_phone}`}
                    className="flex-1 flex items-center justify-center bg-yellow-600 text-white py-2 rounded-lg hover:bg-yellow-700 transition-colors"
                  >
                    <Phone className="h-4 w-4 ml-2" />
                    <span>اتصال بالعميل</span>
                  </a>
                )}

                {(() => {
                  const currentStatusConfig = getStatusConfig(selectedDelivery.status);
                  const isCurrentlyUpdating = updatingStatus === selectedDelivery.id;

                  return currentStatusConfig.buttonText && (
                    <button
                      onClick={() => {
                        if (currentStatusConfig.actionType === 'start_trip') {
                          handleStartTrip(selectedDelivery.id);
                        } else if (currentStatusConfig.nextStatus) {
                          handleStatusUpdate(selectedDelivery.id, currentStatusConfig.nextStatus);
                        }
                      }}
                      disabled={isCurrentlyUpdating}
                      className={`flex-1 py-2 rounded-lg text-white font-medium transition-colors ${
                        isCurrentlyUpdating ? 'bg-gray-400 cursor-not-allowed' : currentStatusConfig.buttonClass
                      }`}
                    >
                      {isCurrentlyUpdating ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          جاري التحديث...
                        </div>
                      ) : (
                        currentStatusConfig.buttonText
                      )}
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Simple Map Modal */}
      {showSimpleMapModal && simpleMapDelivery && simpleMapPickupLocation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg">خريطة التوصيل</h3>
              <button
                onClick={() => {
                  setShowSimpleMapModal(false);
                  setSimpleMapDelivery(null);
                  setSimpleMapPickupLocation(null);
                  setSimpleMapDeliveryLocation(null);
                }}
                className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Map */}
            <div className="flex-1 relative">
              <MapContainer
                center={simpleMapPickupLocation}
                zoom={13}
                scrollWheelZoom={true}
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
                <SimpleRouteMap
                  pickupLocation={simpleMapPickupLocation}
                  deliveryLocation={simpleMapDeliveryLocation}
                />
              </MapContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}