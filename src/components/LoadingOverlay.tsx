import React from 'react';
import LoadingSpinner from './LoadingSpinner';

interface LoadingOverlayProps {
  message?: string;
  transparent?: boolean;
}

export default function LoadingOverlay({ message, transparent = false }: LoadingOverlayProps) {
  return (
    <div className={`fixed inset-0 ${transparent ? 'bg-black/50' : 'bg-white'} flex flex-col items-center justify-center z-50`}>
      <LoadingSpinner size="lg" color={transparent ? 'white' : 'emerald'} />
      {message && (
        <p className={`mt-4 ${transparent ? 'text-white' : 'text-gray-600'}`}>{message}</p>
      )}
    </div>
  );
}