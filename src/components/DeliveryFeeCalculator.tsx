import React from 'react';
import { calculateDeliveryFee, formatCurrency } from '../utils/delivery';

interface DeliveryFeeCalculatorProps {
  distance: number;
}

export default function DeliveryFeeCalculator({ distance }: DeliveryFeeCalculatorProps) {
  const fee = calculateDeliveryFee(distance);
  
  return (
    <div className="bg-yellow-50 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-600">المسافة:</span>
        <span className="font-medium">
          {distance < 1 
            ? `${Math.round(distance * 1000)} متر`
            : `${distance.toFixed(1)} كم`}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-yellow-700">رسوم التوصيل:</span>
        <span className="font-medium text-yellow-700">{formatCurrency(fee)}</span>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        * الحد الأدنى ٧ شيكل لأول ٢ كم، و٣ شيكل لكل كيلومتر إضافي
      </p>
    </div>
  );
}