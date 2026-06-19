import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';
import { storage } from '../utils/storage';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fallback for production builds (APK) where env vars may not be embedded
const productionUrl = 'https://fliwyntfvfedslbwkvks.supabase.co';
const productionKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsaXd5bnRmdmZlZHNsYndrdmtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjYxOTUsImV4cCI6MjA3NjM0MjE5NX0.Fxhqj4VMq_a1ZkHabPChkzTh4Ep_QqBqPS2LDq0dfLY';

// Use production values if environment variables are not available (in APK)
const finalUrl = supabaseUrl || productionUrl;
const finalKey = supabaseKey || productionKey;

// Validate environment variables
if (!finalUrl || !finalKey) {
  throw new Error('Missing Supabase configuration. Please check your .env file and ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
}

if (!finalUrl.startsWith('https://') || !finalUrl.includes('.supabase.co')) {
  throw new Error(`Invalid Supabase URL: ${finalUrl}. Expected format: https://[project-id].supabase.co`);
}

if (finalKey.length < 100) {
  throw new Error(`Invalid Supabase anon key: key appears to be truncated (length: ${finalKey.length}). Please check your .env file.`);
}

export const supabase = createClient<Database>(finalUrl, finalKey);

export interface User {
  id: string;
  email: string;
  phone?: string;
  name?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  driver_profile?: {
    id: string;
    status: 'offline' | 'available' | 'busy';
    rating: number;
    commission_rate: number;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export async function login({ email, password }: LoginCredentials): Promise<User> {
  try {
    // First try to authenticate with custom_users table
    const { data: customUsersData, error: customUserError } = await supabase
      .from('custom_users')
      .select('*')
      .eq('email', email)
      .eq('password_hash', password);

    // Check if we found a user in custom_users table
    if (customUsersData && customUsersData.length > 0) {
      const customUser = customUsersData[0];

      // If user has driver role, check for driver profile
      if (customUser.role === 'driver') {
        const { data: driver, error: driverError } = await supabase
          .from('drivers')
          .select('*')
          .eq('user_id', customUser.id)
          .maybeSingle();

        if (driverError && driverError.code !== 'PGRST116') {
          console.error('Error fetching driver profile:', driverError);
        }

        const userData: User = {
          id: customUser.id,
          email: customUser.email || '',
          username: customUser.username,
          name: customUser.name,
          phone: customUser.phone,
          first_name: customUser.name?.split(' ')[0],
          last_name: customUser.name?.split(' ').slice(1).join(' ')
        };

        if (driver) {
          userData.driver_profile = {
            id: driver.id,
            status: driver.status,
            rating: driver.rating,
            commission_rate: driver.commission_rate
          };
        }

        // Store session with credentials for auto-refresh
        await storage.set('driver_session', JSON.stringify({
          ...userData,
          _credentials: { email, password }
        }));

        return userData;
      }
    }

    // If not found in custom_users or not a driver, try with drivers table directly
    const { data: driversData, error: driverError } = await supabase
      .from('drivers')
      .select('*')
      .eq('email', email)
      .eq('password', password);

    // Check if we found a driver
    if (driversData && driversData.length > 0) {
      const driver = driversData[0];
      const userData: User = {
        id: driver.id,
        email: driver.email || '',
        name: driver.name,
        phone: driver.phone,
        first_name: driver.name?.split(' ')[0],
        last_name: driver.name?.split(' ').slice(1).join(' '),
        driver_profile: {
          id: driver.id,
          status: driver.status,
          rating: driver.rating,
          commission_rate: driver.commission_rate
        }
      };

      // Store session with credentials for auto-refresh
      await storage.set('driver_session', JSON.stringify({
        ...userData,
        _credentials: { email, password }
      }));

      return userData;
    }

    // If we get here, no valid user was found
    throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
  } catch (error) {
    console.error('Login error:', error);
    throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
  }
}

export async function logout(): Promise<void> {
  await storage.remove('driver_session');
}

// Result type to distinguish "not found" from "network error"
type VerifyResult =
  | { status: 'found'; user: User }
  | { status: 'not_found' }
  | { status: 'network_error' };

async function verifyUserFromDb(id: string): Promise<VerifyResult> {
  try {
    // Try custom_users first
    const { data: customUser, error: cuError } = await supabase
      .from('custom_users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (cuError) {
      // Treat as network/transient error — do NOT delete session
      return { status: 'network_error' };
    }

    if (customUser) {
      const { data: driver, error: driverError } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', customUser.id)
        .maybeSingle();

      if (driverError) {
return { status: 'network_error' };
      }

      if (driver) {
        return {
          status: 'found',
          user: {
            id: customUser.id,
            email: customUser.email || '',
            username: customUser.username,
            name: customUser.name,
            phone: customUser.phone,
            first_name: customUser.name?.split(' ')[0],
            last_name: customUser.name?.split(' ').slice(1).join(' '),
            driver_profile: {
              id: driver.id,
              status: driver.status,
              rating: driver.rating,
              commission_rate: driver.commission_rate,
            },
          },
        };
      }
    }

    // Try direct driver lookup
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (driverError) {
return { status: 'network_error' };
    }

    if (driver) {
      return {
        status: 'found',
        user: {
          id: driver.id,
          email: driver.email || '',
          name: driver.name,
          phone: driver.phone,
          first_name: driver.name?.split(' ')[0],
          last_name: driver.name?.split(' ').slice(1).join(' '),
          driver_profile: {
            id: driver.id,
            status: driver.status,
            rating: driver.rating,
            commission_rate: driver.commission_rate,
          },
        },
      };
    }

    return { status: 'not_found' };
  } catch (err) {
    return { status: 'network_error' };
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const storedSession = await storage.get('driver_session');
    if (!storedSession) return null;

    const session = JSON.parse(storedSession);
    if (!session?.id) return null;

    const result = await verifyUserFromDb(session.id);

    if (result.status === 'found') {
      return result.user;
    }

    if (result.status === 'network_error') {
      // Network is unavailable — keep session alive, return cached data
      return buildUserFromSession(session);
    }

    // status === 'not_found': user genuinely does not exist in DB
    // Try auto-refresh with stored credentials before giving up
    if (session._credentials) {
      try {
        return await login(session._credentials);
      } catch (refreshError) {
        console.error('Auto re-login failed:', refreshError);
      }
    }

    // Confirmed the user no longer exists — safe to clear session
    await storage.remove('driver_session');
    return null;
  } catch (error) {
    console.error('getCurrentUser unexpected error:', error);
    // On any unexpected error keep session to avoid spurious logouts
    try {
      const storedSession = await storage.get('driver_session');
      if (storedSession) {
        const session = JSON.parse(storedSession);
        if (session?.id) return buildUserFromSession(session);
      }
    } catch {
      // ignore
    }
    return null;
  }
}

function buildUserFromSession(session: Record<string, unknown>): User | null {
  if (!session?.id) return null;
  return {
    id: session.id as string,
    email: (session.email as string) || '',
    name: session.name as string | undefined,
    username: session.username as string | undefined,
    phone: session.phone as string | undefined,
    first_name: session.first_name as string | undefined,
    last_name: session.last_name as string | undefined,
    driver_profile: session.driver_profile as User['driver_profile'] | undefined,
  };
}

export async function getAuthHeaders() {
  const session = await storage.get('driver_session');
  return {
    'Content-Type': 'application/json',
    'Authorization': session ? `Bearer ${JSON.parse(session).id}` : ''
  };
}