import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutGrid, Map, Clock, Settings as SettingsIcon, Truck, Wallet } from 'lucide-react';
import { useOrders } from '../context/OrdersContext';

export default function Navigation() {
  const location = useLocation();
  const { pendingOrdersCount, activeOrdersCount } = useOrders();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navItems = [
    { path: '/dashboard', icon: LayoutGrid, label: 'الرئيسية', color: 'from-blue-400 to-blue-500' },
    { path: '/orders', icon: Clock, label: 'الطلبات', color: 'from-red-400 to-red-500' },
    { path: '/my-trips', icon: Truck, label: 'رحلاتي', color: 'from-purple-400 to-purple-500' },
    { path: '/wallet', icon: Wallet, label: 'المحفظة', color: 'from-yellow-400 to-yellow-500' },
    { path: '/map', icon: Map, label: 'الخريطة', color: 'from-green-400 to-green-500' },
    { path: '/settings', icon: SettingsIcon, label: 'الإعدادات', color: 'from-gray-400 to-gray-500' }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 nav-bar-glass border-t border-white/20 z-50 animate-slide-in-up">
      <div className="grid grid-cols-6 p-3 gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ripple ${
                active ? 'nav-item-active' : 'nav-item-inactive'
              }`}
            >
              {/* Active indicator */}
              {active && (
                <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-10 h-1 bg-primary-500 rounded-full animate-fade-in-scale shadow-glow" />
              )}
              
              {/* Icon with gradient background when active */}
              <div className={`relative ${active ? 'animate-glow' : ''}`}>
                {active && (
                  <div className={`absolute inset-0 bg-gradient-to-br ${item.color} rounded-full opacity-20 animate-pulse`} />
                )}
                <Icon className={`nav-icon relative z-10 ${active ? 'animate-bounce' : ''}`} />

                {/* Badge for pending/active orders */}
                {item.path === '/orders' && pendingOrdersCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse shadow-lg z-20">
                    {pendingOrdersCount}
                  </span>
                )}
                {item.path === '/my-trips' && activeOrdersCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse shadow-lg z-20">
                    {activeOrdersCount}
                  </span>
                )}
              </div>
              
              {/* Label with enhanced typography */}
              <span className={`nav-label ${active ? 'font-bold' : ''}`}>
                {item.label}
              </span>
              
              {/* Active glow effect */}
              {active && (
                <div className="absolute inset-0 bg-gradient-to-br from-primary-400/30 to-primary-600/30 rounded-2xl blur-sm -z-10" />
              )}
            </Link>
          );
        })}
      </div>
      
      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-400 via-primary-500 to-primary-600" />
    </nav>
  );
}