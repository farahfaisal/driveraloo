import React from 'react';
import { Truck } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

interface LoadingScreenProps {
  message?: string;
}

export default function LoadingScreen({ message = 'جاري التحميل...' }: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 bg-secondary-800 flex flex-col items-center justify-center">
      <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6">
        <Truck className="w-14 h-14 text-primary-600" />
      </div>
      <LoadingSpinner size="lg" color="white" />
      <p className="mt-4 text-white text-lg font-bold">{message}</p>
      <p className="mt-2 text-secondary-100 text-sm max-w-xs text-center">
        الو جيتك - يتم تحميل البيانات
      </p>
    </div>
  );
}