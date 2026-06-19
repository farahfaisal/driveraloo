import React from 'react';
import { Clock, CheckCircle, Truck, XCircle, Package } from 'lucide-react';

type Status = 'pending' | 'picked_up' | 'delivering' | 'delivered' | 'cancelled';

interface StatusBadgeProps {
  status: Status;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = {
    pending: {
      icon: Clock,
      text: 'قيد الانتظار',
      className: 'bg-red-50 text-red-700 border-red-200'
    },
    picked_up: {
      icon: Package,
      text: 'تم الاستلام',
      className: 'bg-yellow-50 text-yellow-700 border-yellow-200'
    },
    delivering: {
      icon: Truck,
      text: 'قيد التوصيل',
      className: 'bg-blue-50 text-blue-700 border-blue-200'
    },
    delivered: {
      icon: CheckCircle,
      text: 'تم التوصيل',
      className: 'bg-green-50 text-green-700 border-green-200'
    },
    cancelled: {
      icon: XCircle,
      text: 'ملغي',
      className: 'bg-red-50 text-red-700 border-red-200'
    }
  };

  const { icon: Icon, text, className } = config[status];

  return (
    <div className={`inline-flex items-center px-3 py-1 rounded-full border ${className}`}>
      <Icon className="w-4 h-4 ml-1" />
      <span className="text-sm">{text}</span>
    </div>
  );
}