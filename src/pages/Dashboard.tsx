import React, { useState, useEffect } from 'react';
import { MapPin, Package, Truck, CheckCircle, Wallet, Clock, Phone, AlertCircle, Search, Bell } from 'lucide-react';
import AvailabilityToggle from '../components/AvailabilityToggle';
import { getDriverDeliveries, Delivery, getWalletBalance, WalletBalance } from '../services/delivery';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { formatDateTime } from '../utils/date';
import { formatCurrency } from '../utils/delivery';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [walletData, setWalletData] = useState<WalletBalance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);

  // Filter deliveries by status
  const pendingDeliveries = deliveries.filter(d => d.status === 'pending');
  const activeDeliveries = deliveries.filter(d => d.status === 'delivering');
  const completedDeliveries = deliveries.filter(d => d.status === 'delivered');

  useEffect(() => {
    loadData();
    // Refresh data every 10 seconds (reduced from 30)
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Load all deliveries
      const deliveriesData = await getDriverDeliveries();
      setDeliveries(deliveriesData);
      
      // Load wallet data
      try {
        const wallet = await getWalletBalance();
        setWalletData(wallet);
      } catch (walletError) {
        console.error('Error loading wallet:', walletError);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'فشل في تحميل البيانات';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter deliveries by search query and status
  const filteredDeliveries = deliveries
    .filter(delivery => 
      delivery.delivery_location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      delivery.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      delivery.order_id.toString().includes(searchQuery)
    );


  // Handle retry when data loading fails
  const handleRetry = () => {
    loadData();
  };

  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.notifications-dropdown')) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <LoadingSpinner size="lg" color="emerald" />
        <p className="mt-4 text-gray-600">جاري تحميل البيانات...</p>
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
            onClick={handleRetry}
            className="bg-red-100 text-red-600 px-4 py-2 rounded-lg hover:bg-red-200 transition-colors"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 pb-20">
      {/* Header */}
      <div className="bg-secondary-800/90 rounded-lg p-4 text-white mb-4">
        <div className="flex justify-between items-center mb-4">
          <AvailabilityToggle />
          <div className="relative notifications-dropdown" onClick={() => setShowNotifications(!showNotifications)}>
            <button className="relative">
              <Bell className="h-6 w-6" />
              {(pendingDeliveries.length + activeDeliveries.length) > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {pendingDeliveries.length + activeDeliveries.length}
                </span>
              )}
            </button>
            
            {showNotifications && (
              <div className="absolute left-0 mt-2 w-80 bg-white rounded-lg shadow-lg z-50">
                <div className="p-3 border-b border-gray-100">
                  <h3 className="font-medium text-gray-800">الإشعارات</h3>
                </div>
                
                <div className="max-h-96 overflow-y-auto">
                  {pendingDeliveries.length === 0 && activeDeliveries.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      لا توجد إشعارات جديدة
                    </div>
                  ) : (
                    <div>
                      {pendingDeliveries.length > 0 && (
                        <div className="p-3 border-b border-gray-100">
                          <div className="flex items-center text-yellow-600 mb-2">
                            <Clock className="h-4 w-4 ml-1" />
                            <span className="font-medium">طلبات في الانتظار</span>
                          </div>
                          {pendingDeliveries.map(delivery => (
                            <div
                              key={delivery.id}
                              className="bg-yellow-50 rounded-lg p-2 mb-2 cursor-pointer hover:bg-yellow-100"
                              onClick={() => {
                                navigate('/orders');
                                setShowNotifications(false);
                              }}
                            >
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-sm font-medium">#{delivery.order_id}</span>
                                <span className="text-xs text-gray-500">
                                  {formatDateTime(delivery.created_at)}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 truncate">
                                {delivery.delivery_location}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {activeDeliveries.length > 0 && (
                        <div className="p-3">
                          <div className="flex items-center text-blue-600 mb-2">
                            <Truck className="h-4 w-4 ml-1" />
                            <span className="font-medium">رحلات نشطة</span>
                          </div>
                          {activeDeliveries.map(delivery => (
                            <div 
                              key={delivery.id}
                              className="bg-blue-50 rounded-lg p-2 mb-2 cursor-pointer hover:bg-blue-100"
                              onClick={() => {
                                navigate('/my-trips');
                                setShowNotifications(false);
                              }}
                            >
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-sm font-medium">#{delivery.order_id}</span>
                                <span className="text-xs text-gray-500">
                                  {formatDateTime(delivery.created_at)}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 truncate">
                                {delivery.customer_name}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-between items-center relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="البحث برقم الطلب أو اسم العميل..."
            className="w-full bg-secondary-700 text-white placeholder-secondary-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
          <Search className="absolute left-7 text-secondary-300" />
        </div>
      </div>

      {/* Wallet Summary */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-gray-800">المحفظة</h2>
          <button
            onClick={() => navigate('/wallet')}
            className="text-primary-600 text-sm"
          >
            عرض المزيد
          </button>
        </div>
        <div className="flex items-center space-x-4 space-x-reverse">
          <div className="bg-primary-50 p-2 rounded-full">
            <Wallet className="h-6 w-6 text-primary-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">الرصيد الحالي</p>
            <p className="font-bold text-gray-900">
              {walletData ? formatCurrency(walletData.balance) : 'جار التحميل...'}
            </p>
          </div>
        </div>
      </div>

      {/* Order Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-3 text-center">
          <div className="bg-red-50 w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-2">
            <Clock className="h-4 w-4 text-red-600" />
          </div>
          <p className="text-xs text-gray-600 mb-1">قيد الانتظار</p>
          <p className="text-xl font-bold text-red-600">
            {(activeDeliveries.length > 0 || deliveries.some(d => d.status === 'pending' && d.driver_name))
              ? 0
              : pendingDeliveries.length}
          </p>
          {(activeDeliveries.length > 0 || deliveries.some(d => d.status === 'pending' && d.driver_name)) && (
            <p className="text-xs text-blue-600 mt-1">
              {activeDeliveries.length > 0 ? 'لديك طلب نشط' : 'لديك طلب مُسند'}
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-3 text-center">
          <div className="bg-blue-50 w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-2">
            <Truck className="h-4 w-4 text-blue-600" />
          </div>
          <p className="text-xs text-gray-600 mb-1">قيد التوصيل</p>
          <p className="text-xl font-bold text-blue-600">{activeDeliveries.length}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-3 text-center">
          <div className="bg-green-50 w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
          </div>
          <p className="text-xs text-gray-600 mb-1">تم التوصيل</p>
          <p className="text-xl font-bold text-green-600">{completedDeliveries.length}</p>
        </div>
      </div>

      {/* Recent Orders Section */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-bold text-gray-800">الطلبات قيد الانتظار</h2>
          {pendingDeliveries.length > 0 && activeDeliveries.length === 0 && (
            <button
              onClick={() => navigate('/orders')}
              className="text-yellow-600 text-sm"
            >
              عرض الكل
            </button>
          )}
        </div>

        <div className="space-y-3">
          {/* تنبيه الرحلات النشطة */}
          {(activeDeliveries.length > 0 || deliveries.some(d => d.status === 'pending' && d.driver_name)) && (
            <div className="bg-blue-50 rounded-lg p-3 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="h-5 w-5 text-blue-600" />
                <p className="text-blue-700 font-medium text-sm">
                  لديك {activeDeliveries.length + deliveries.filter(d => d.status === 'pending' && d.driver_name).length} رحلة نشطة
                </p>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-blue-600 text-xs">
                  {activeDeliveries.length} قيد التوصيل • {deliveries.filter(d => d.status === 'pending' && d.driver_name).length} مُسند
                </p>
                <button
                  onClick={() => navigate('/my-trips')}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 transition-colors"
                >
                  إدارة الرحلات
                </button>
              </div>
            </div>
          )}

          {pendingDeliveries.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <Package className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">لا توجد طلبات في الانتظار حالياً</p>
            </div>
          ) : (
            // Show all pending orders (allow multiple trips)
            filteredDeliveries
              .filter(d => d.status === 'pending')
              .slice(0, 2)
              .map(delivery => (
              <div
                key={delivery.id}
                className="bg-white rounded-lg shadow p-3 border-r-4 border-yellow-200"
                onClick={() => navigate('/orders')}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">#{delivery.order_id}</span>
                  <div className="text-xs text-gray-500">
                    {formatDateTime(delivery.created_at)}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 text-red-600 ml-2" />
                    <span className="text-sm truncate max-w-[150px]">
                      {delivery.service_area || delivery.delivery_city || delivery.delivery_location}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-red-600">
                    {formatCurrency(delivery.delivery_fee)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Active Deliveries Section */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-bold text-gray-800">رحلات نشطة</h2>
          {(activeDeliveries.length > 0 || deliveries.some(d => d.status === 'pending' && d.driver_name)) && (
            <button 
              onClick={() => navigate('/my-trips')}
              className="text-red-600 text-sm"
            >
              عرض الكل
            </button>
          )}
        </div>

        <div className="space-y-3">
          {activeDeliveries.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <Truck className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">لا توجد رحلات نشطة حالياً</p>
            </div>
          ) : (
            activeDeliveries.slice(0, 2).map(delivery => (
              <div
                key={delivery.id}
                className="bg-white rounded-lg shadow p-3 border-r-4 border-blue-200"
                onClick={() => navigate('/my-trips')}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">#{delivery.order_id}</span>
                  <div className="bg-blue-50 text-blue-600 text-xs rounded-full px-2 py-1">
                    قيد التوصيل
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-start">
                    <MapPin className="h-4 w-4 text-blue-600 ml-2 mt-1" />
                    <div>
                      <span className="text-xs text-gray-500 block">الزبون:</span>
                      <span className="text-sm truncate block max-w-[200px]">
                        {delivery.customer_name}
                      </span>
                    </div>
                  </div>
                  {delivery.customer_phone && (
                    <a href={`tel:${delivery.customer_phone}`}>
                      <Phone className="h-5 w-5 text-blue-600" />
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Completed Deliveries Section */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-bold text-gray-800">رحلات مكتملة</h2>
          {completedDeliveries.length > 0 && (
            <button 
              onClick={() => navigate('/my-trips')}
              className="text-red-600 text-sm"
            >
              عرض الكل
            </button>
          )}
        </div>

        <div className="space-y-3">
          {completedDeliveries.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <CheckCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">لا توجد رحلات مكتملة</p>
            </div>
          ) : (
            completedDeliveries.slice(0, 2).map(delivery => (
              <div
                key={delivery.id}
                className="bg-white rounded-lg shadow p-3 border-r-4 border-green-200"
                onClick={() => navigate('/my-trips')}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">#{delivery.order_id}</span>
                  <div className="bg-green-50 text-green-600 text-xs rounded-full px-2 py-1">
                    تم التوصيل
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 text-green-600 ml-2" />
                    <span className="text-sm truncate max-w-[200px]">
                      {delivery.service_area || delivery.delivery_city || delivery.delivery_location}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-green-600">
                    {formatCurrency(delivery.delivery_fee)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      </div>
    </div>
  );
}