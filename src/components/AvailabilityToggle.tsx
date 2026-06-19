import React, { useEffect, useState } from 'react';
import { ToggleLeft as Toggle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/auth';

const RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY = 1000;

export default function AvailabilityToggle() {
  const { user } = useAuth();
  const [status, setStatus] = useState<'offline' | 'available' | 'busy'>('offline');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadStatus();
      const interval = setInterval(loadStatus, 60000);
      return () => clearInterval(interval);
    }
  }, [user?.id]);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const loadStatus = async (retryCount = 0) => {
    if (!user?.id) return;

    try {
      setError(null);

      // Check for network connectivity
      if (!navigator.onLine) {
        throw new Error('لا يوجد اتصال بالإنترنت');
      }
      
      // First try to get status from driver_profile if it exists
      if (user.driver_profile?.id) {
        const { data, error } = await supabase
          .from('drivers')
          .select('status')
          .eq('id', user.driver_profile.id)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // No rows found, this is expected if the user doesn't have a driver profile
            setStatus('offline');
          } else {
            throw error;
          }
        } else if (data) {
          setStatus(data.status);
          return;
        }
      }
      
      // If we don't have a driver_profile or couldn't get status from it,
      // try to get status from drivers table using user_id
      const { data, error } = await supabase
        .from('drivers')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        throw error;
      } else if (data) {
        setStatus(data.status);
      } else {
        setStatus('offline');
      }
    } catch (error) {
      console.error('Error loading status:', error);

      // Implement retry with exponential backoff
      if (retryCount < RETRY_ATTEMPTS) {
        const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
        await sleep(retryDelay);
        return loadStatus(retryCount + 1);
      }

      const errorMessage = error instanceof Error ? error.message : 'فشل في تحميل الحالة';
      setError(errorMessage);
      toast.error(errorMessage);
      setStatus('offline');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleStatus = async () => {
    if (isLoading || !user?.id) return;
    
    try {
      setIsLoading(true);
      setError(null);

      // Check for network connectivity
      if (!navigator.onLine) {
        throw new Error('لا يوجد اتصال بالإنترنت');
      }
      
      const newStatus = status === 'available' ? 'offline' : 'available';
      
      // First try to update using driver_profile.id if it exists
      if (user.driver_profile?.id) {
        const { error } = await supabase
          .from('drivers')
          .update({ 
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.driver_profile.id);

        if (error) throw error;
      } else {
        // If no driver_profile, try to update using user_id
        const { error } = await supabase
          .from('drivers')
          .update({ 
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);

        if (error) throw error;
      }
      
      setStatus(newStatus);
      toast.success(newStatus === 'available' ? 'أنت متاح الآن للطلبات' : 'تم تغيير حالتك إلى غير متاح');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'فشل في تحديث الحالة';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user?.id) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggleStatus}
        disabled={isLoading || status === 'busy'}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
          status === 'available'
            ? 'bg-primary-600'
            : status === 'busy'
            ? 'bg-primary-600 cursor-not-allowed'
            : 'bg-gray-200'
        }`}
        role="switch"
        aria-checked={status === 'available'}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            status === 'available' ? 'rtl:-translate-x-[18px] ltr:translate-x-[18px]' : 'translate-x-0'
          }`}
        />
      </button>
      <span className={`text-sm ${
        status === 'available'
          ? 'text-primary-600'
          : status === 'busy'
          ? 'text-primary-600'
          : 'text-gray-500'
      }`}>
        {status === 'available' 
          ? 'متاح للطلبات'
          : status === 'busy'
          ? 'مشغول'
          : 'غير متاح'}
      </span>
      {error && (
        <span className="text-sm text-red-600">
          {error}
        </span>
      )}
    </div>
  );
}