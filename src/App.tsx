import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Orders = lazy(() => import('./pages/Orders'));
const Map = lazy(() => import('./pages/Map'));
const Settings = lazy(() => import('./pages/Settings'));
const MyTrips = lazy(() => import('./pages/MyTrips'));
const Wallet = lazy(() => import('./pages/Wallet'));
import Navigation from './components/Navigation';
import LoadingScreen from './components/LoadingScreen';
import PermissionWelcome from './components/PermissionWelcome';
import PWAInstallModal from './components/PWAInstallModal';
import { useAuth } from './context/AuthContext';
import { OrdersProvider, useOrders } from './context/OrdersContext';
import { useBackgroundService } from './hooks/useBackgroundService';
import { usePushTokenRegistration } from './hooks/usePushTokenRegistration';
import { useNotifications } from './hooks/useNotifications';
import { useLocationPermission } from './hooks/useLocationPermission';
import { useOrderNotifications } from './hooks/useOrderNotifications';
import { getDriverDeliveries, Delivery } from './services/delivery';
import { supabase } from './services/auth';
import { storage } from './utils/storage';

const PageLoader = <div className="flex items-center justify-center h-screen"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;

function withSuspense(element: React.ReactNode) {
  return <Suspense fallback={PageLoader}>{element}</Suspense>;
}

function AppContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [showPermissionWelcome, setShowPermissionWelcome] = useState(false);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const { isAuthenticated } = useAuth();
  const { setPendingOrdersCount, setActiveOrdersCount } = useOrders();

  // Initialize background service
  useBackgroundService();

  // Auto-register FCM push token after login
  usePushTokenRegistration();

  // Global order notifications - works across all pages
  useOrderNotifications(deliveries);

  // Load deliveries for global notifications
  useEffect(() => {
    if (!isAuthenticated) {
      setDeliveries([]);
      return;
    }

    const loadDeliveries = async () => {
      try {
        const data = await getDriverDeliveries();
        setDeliveries(data);

        const pendingCount = data.filter(d => d.status === 'pending').length;
        const activeCount = data.filter(d => d.status === 'delivering').length;
        setPendingOrdersCount(pendingCount);
        setActiveOrdersCount(activeCount);
      } catch {
        // silent fail - notifications are non-critical
      }
    };

    loadDeliveries();

    const interval = setInterval(loadDeliveries, 10000);

    const waitingListSubscription = supabase
      .channel('app_waiting_list_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_waiting_list' },
        () => { loadDeliveries(); }
      )
      .subscribe();

    const captainRequestsSubscription = supabase
      .channel('app_captain_requests_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'captain_requests' },
        () => { loadDeliveries(); }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      waitingListSubscription.unsubscribe();
      captainRequestsSubscription.unsubscribe();
    };
  }, [isAuthenticated]);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 800));

        const hasSeenWelcome = await storage.get('permissions_welcome_shown');

        if (!hasSeenWelcome && Capacitor.isNativePlatform()) {
          setShowPermissionWelcome(true);
        }

        if (Capacitor.isNativePlatform()) {
          await SplashScreen.hide({ fadeOutDuration: 800 });
        }
      } catch {
        // non-critical
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();

    // إضافة مستمع لفتح صفحة الطلبات من الخدمة الخلفية
    const handleOpenOrdersPage = () => {
      if (window.location.pathname !== '/orders') {
        window.location.href = '/orders';
      }
    };

    window.addEventListener('open-orders-page', handleOpenOrdersPage);

    return () => {
      window.removeEventListener('open-orders-page', handleOpenOrdersPage);
    };
  }, []);


  const handlePermissionWelcomeComplete = async () => {
    await storage.set('permissions_welcome_shown', 'true');
    setShowPermissionWelcome(false);
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (showPermissionWelcome) {
    return <PermissionWelcome onComplete={handlePermissionWelcomeComplete} />;
  }

  return (
    <ErrorBoundary>
      <div dir="rtl" className="min-h-screen bg-gray-50">
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#fff',
              color: '#374151',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />

        {/* PWA Install Modal */}
        {!Capacitor.isNativePlatform() && <PWAInstallModal />}
        
        <Routes>
          <Route path="/login" element={
            !isAuthenticated ? <Login /> : <Navigate to="/dashboard" replace />
          } />
          <Route path="/" element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
          } />
          <Route path="/orders" element={
            isAuthenticated ? withSuspense(<Orders />) : <Navigate to="/login" replace />
          } />
          <Route path="/dashboard" element={
            isAuthenticated ? withSuspense(<Dashboard />) : <Navigate to="/login" replace />
          } />
          <Route path="/map" element={
            isAuthenticated ? withSuspense(<Map />) : <Navigate to="/login" replace />
          } />
          <Route path="/settings" element={
            isAuthenticated ? withSuspense(<Settings />) : <Navigate to="/login" replace />
          } />
          <Route path="/my-trips" element={
            isAuthenticated ? withSuspense(<MyTrips />) : <Navigate to="/login" replace />
          } />
          <Route path="/wallet" element={
            isAuthenticated ? withSuspense(<Wallet />) : <Navigate to="/login" replace />
          } />
        </Routes>
        {isAuthenticated && <Navigation />}
      </div>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <OrdersProvider>
      <AppContent />
    </OrdersProvider>
  );
}

export default App;