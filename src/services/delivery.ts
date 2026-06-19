import { supabase } from './auth';
import { storage } from '../utils/storage';

export interface OrderItem {
  id?: string;
  product_id?: string;
  product_name: string;
  name?: string; // Fallback field name (used in older records)
  quantity: number;
  price: number;
  variant_name?: string;
  addons?: {
    name: string;
    price: number;
    quantity?: number;
  }[];
  notes?: string;
  vendor_id?: string;
  vendor_name?: string;
}

export interface Delivery {
  id: string;
  order_id: string;
  status: 'pending' | 'preparing' | 'assigned' | 'delivering' | 'delivered' | 'cancelled';
  customer_name: string;
  customer_phone?: string;
  order_type: string;
  service_area?: string;
  pickup_location: string;
  delivery_location: string;
  delivery_city?: string;
  delivery_instructions?: string;
  created_at: string;
  updated_at?: string;
  preparation_time?: number;
  actual_preparation_time?: number;
  preparation_start?: string;
  preparation_start_time?: string;
  preparation_end?: string;
  notes?: string;
  store_info?: {
    name: string;
    phone?: string;
    address?: string;
  };
  delivery_fee: number;
  total_amount: number;
  subtotal?: number;
  coupon_discount?: number;
  points_discount?: number;
  vendor_discount_amount?: number;
  vendor_discount_percentage?: number;
  payment_method?: string;
  driver_name?: string;
  items?: OrderItem[];
  order_group_id?: string;
  receiver_info?: {
    name?: string;
    phone?: string;
    address?: string;
  };
}

export interface DriverTrip {
  id: string;
  order_id: string;
  order_number?: string;
  driver_id: string;
  status: 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  customer_name: string;
  customer_phone?: string;
  pickup_address: string;
  delivery_address: string;
  delivery_city?: string;
  delivery_instructions?: string;
  total: number;
  subtotal?: number;
  coupon_discount?: number;
  points_discount?: number;
  vendor_discount_amount?: number;
  vendor_discount_percentage?: number;
  delivery_fee?: number;
  payment_method?: string;
  notes?: string;
  order_group_id?: string;
  assigned_at: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  order_type?: string;
  service_area?: string;
  preparation_time?: number;
  actual_preparation_time?: number;
  preparation_start?: string;
  preparation_start_time?: string;
  preparation_end?: string;
  store_name?: string;
  store_phone?: string;
  store_address?: string;
  items?: OrderItem[];
  receiver_info?: {
    name?: string;
    phone?: string;
    address?: string;
  };
}

export async function completeTrip(tripId: string): Promise<void> {
  try {
    const driver = await getCurrentDriver();
    if (!driver || !driver.id) {
      console.error('❌ Driver not found');
      throw new Error('لم يتم العثور على بيانات السائق');
    }
    // Fetch driver commission rate for settlement creation
    const { data: driverProfile } = await supabase
      .from('drivers')
      .select('commission_rate')
      .eq('id', driver.id)
      .maybeSingle();
    const commissionRate = parseFloat(driverProfile?.commission_rate?.toString() || '0');

    // Get trip details first
    const { data: trip, error: tripError } = await supabase
      .from('driver_trips')
      .select('order_id, captain_request_id, parcel_order_id, total, status')
      .eq('id', tripId)
      .single();

    if (tripError) {
      console.error('❌ Error fetching trip:', tripError);
      throw new Error('فشل في الحصول على بيانات الرحلة: ' + tripError.message);
    }

    if (!trip) {
      console.error('❌ Trip not found');
      throw new Error('الرحلة غير موجودة');
    }
    // Check if trip is already completed
    if (trip.status === 'completed') {
      throw new Error('هذه الرحلة مكتملة بالفعل');
    }

    // Check if trip has an order reference
    if (!trip.order_id && !trip.captain_request_id && !trip.parcel_order_id) {
      console.error('❌ No order reference found in trip');
      throw new Error('الرحلة لا تحتوي على مرجع طلب صالح');
    }

    const now = new Date().toISOString();

    // Update trip status to completed
    const { error: updateTripError } = await supabase
      .from('driver_trips')
      .update({
        status: 'completed',
        completed_at: now
      })
      .eq('id', tripId);

    if (updateTripError) {
      console.error('❌ Error updating trip status:', updateTripError);
      throw new Error('فشل في تحديث حالة الرحلة: ' + updateTripError.message);
    }
    // Handle captain order completion
    if (trip?.captain_request_id) {
      // Get captain_order details (captain_request_id column stores captain_orders.id)
      const { data: captainOrder, error: captainError } = await supabase
        .from('captain_orders')
        .select('delivery_fee')
        .eq('id', trip.captain_request_id)
        .maybeSingle();

      if (captainError) {
        console.error('❌ Error fetching captain_order:', captainError);
      }

      // Update captain_order status
      const { error: updateCaptainError } = await supabase
        .from('captain_orders')
        .update({
          status: 'delivered',
          delivered_at: now,
          updated_at: now
        })
        .eq('id', trip.captain_request_id);

      if (updateCaptainError) {
        console.error('❌ Error updating captain_order:', updateCaptainError);
        throw new Error('فشل في تحديث حالة الطلب: ' + updateCaptainError.message);
      }

      // Calculate fare
      const fare = captainOrder?.delivery_fee || trip.total || 0;
      const commission = parseFloat(fare.toString());
      // Add earnings to driver's wallet
      try {
        await addToDriverWallet(
          driver.id,
          commission,
          null,
          'عمولة طلب كابتن'
        );
        await createTripSettlement(driver.id, tripId, commission, commissionRate);
      } catch (walletError) {
        console.error('❌ Error adding to wallet:', walletError);
        throw new Error('فشل في إضافة العمولة إلى المحفظة: ' + (walletError instanceof Error ? walletError.message : 'خطأ غير معروف'));
      }

      return;
    }

    // Handle parcel order completion
    if (trip?.parcel_order_id) {
      // Get parcel order details
      const { data: parcelOrder, error: parcelError } = await supabase
        .from('parcel_orders')
        .select('delivery_fee')
        .eq('id', trip.parcel_order_id)
        .maybeSingle();

      if (parcelError) {
        console.error('❌ Error fetching parcel order:', parcelError);
        throw new Error('فشل في الحصول على بيانات طلب الطرد: ' + parcelError.message);
      }

      // Update parcel order status
      const { error: updateParcelError } = await supabase
        .from('parcel_orders')
        .update({
          status: 'delivered',
          delivered_at: now,
          updated_at: now
        })
        .eq('id', trip.parcel_order_id);

      if (updateParcelError) {
        console.error('❌ Error updating parcel status:', updateParcelError);
        throw new Error('فشل في تحديث حالة طلب الطرد: ' + updateParcelError.message);
      }

      // Calculate commission
      const deliveryCommission = parcelOrder?.delivery_fee || trip.total || 0;
      // Add earnings to driver's wallet
      try {
        await addToDriverWallet(
          driver.id,
          deliveryCommission,
          null,
          'عمولة توصيل طرد'
        );
        await createTripSettlement(driver.id, tripId, deliveryCommission, commissionRate);
      } catch (walletError) {
        console.error('❌ Error adding to wallet:', walletError);
        throw new Error('فشل في إضافة العمولة إلى المحفظة: ' + (walletError instanceof Error ? walletError.message : 'خطأ غير معروف'));
      }

      return;
    }

    // Handle regular store order completion
    if (!trip?.order_id) {
      console.error('❌ No order_id found in trip');
      throw new Error('لم يتم العثور على رقم الطلب في الرحلة');
    }
    // Update order status to completed
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .update({
        status: 'delivered',
        updated_at: now
      })
      .eq('id', trip.order_id)
      .select('delivery_fee, total, order_number')
      .single();

    if (orderError) {
      console.error('❌ Error updating order status:', orderError);
      throw new Error('فشل في تحديث حالة الطلب: ' + orderError.message);
    }
    // Add status history entry
    const { error: historyError } = await supabase
      .from('order_status_history')
      .insert({
        order_id: trip.order_id,
        status: 'delivered',
        created_by: driver.user_id || null,
        note: 'تم توصيل الطلب بنجاح',
        preparation_time_minutes: 0
      });

    if (historyError) {
      console.error('Error adding status history:', historyError);
    }

    // حساب عمولة التوصيل الصحيحة
    let deliveryCommission = 0;

    // أولاً: محاولة الحصول على العمولة من جدول الطلبات
    if (orderData?.delivery_fee && orderData.delivery_fee > 0) {
      deliveryCommission = orderData.delivery_fee;
    } else {
      // ثانياً: حساب العمولة بناءً على قيمة الطلب
      const orderTotal = orderData?.total || trip.total || 0;
      deliveryCommission = calculateDeliveryCommission(orderTotal);
}
    // Add delivery fee to driver's wallet and create pending settlement
    try {
      await addToDriverWallet(driver.id, deliveryCommission, trip.order_id, 'عمولة توصيل');
      await createTripSettlement(
        driver.id,
        tripId,
        deliveryCommission,
        commissionRate,
        orderData?.order_number || undefined
      );
    } catch (walletError) {
      console.error('❌ Error adding to wallet:', walletError);
      throw new Error('فشل في إضافة العمولة إلى المحفظة: ' + (walletError instanceof Error ? walletError.message : 'خطأ غير معروف'));
    }

  } catch (error) {
    console.error('❌ Error completing trip:', error);
    // Create a user-friendly error message
    const errorMessage = error instanceof Error ? error.message : 'فشل في إكمال الرحلة. يرجى المحاولة مرة أخرى';
    throw new Error(errorMessage);
  }
}

export async function startTrip(tripId: string): Promise<void> {
  try {
    const driver = await getCurrentDriver();
    if (!driver || !driver.id) {
      throw new Error('Driver not found');
    }

    // Get trip details first
    const { data: trip, error: tripError } = await supabase
      .from('driver_trips')
      .select('order_id, captain_request_id, parcel_order_id')
      .eq('id', tripId)
      .single();

    if (tripError) {
      throw tripError;
    }

    // Update trip status to in_progress
    const { error: updateTripError } = await supabase
      .from('driver_trips')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString()
      })
      .eq('id', tripId);

    if (updateTripError) {
      throw updateTripError;
    }

    // If it's a captain request, no need to update orders table
    if (trip?.captain_request_id) {
      return;
    }

    // If it's a parcel order, update parcel_orders table
    if (trip?.parcel_order_id) {
      const { error: updateParcelError } = await supabase
        .from('parcel_orders')
        .update({
          status: 'picked_up',
          picked_up_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', trip.parcel_order_id);

      if (updateParcelError) {
        console.error('Error updating parcel status:', updateParcelError);
      }
      return;
    }

    if (!trip?.order_id) {
      throw new Error('Order not found');
    }

    // Update order status to delivering
    const { error: updateOrderError } = await supabase
      .from('orders')
      .update({
        status: 'shipping',
        updated_at: new Date().toISOString()
      })
      .eq('id', trip.order_id);

    if (updateOrderError) {
      throw updateOrderError;
    }

    // Add status history entry
    const { error: historyError } = await supabase
      .from('order_status_history')
      .insert({
        order_id: trip.order_id,
        status: 'shipping',
        created_by: driver.user_id || null,
        note: 'السائق في الطريق للتوصيل',
        preparation_time_minutes: 0
      });

    if (historyError) {
      console.error('Error adding status history:', historyError);
    }

  } catch (error) {
    console.error('Error starting trip:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to start trip');
  }
}

export async function getDriverTrips(): Promise<DriverTrip[]> {
  try {
    const driver = await getCurrentDriver();
    if (!driver || !driver.id) {
      throw new Error('Driver not found');
    }

    // First get the trips
    const { data: trips, error } = await supabase
      .from('driver_trips')
      .select('*')
      .eq('driver_id', driver.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching driver trips:', error);
      throw error;
    }

    if (!trips || trips.length === 0) {
      return [];
    }

    // Separate trips into store orders, captain requests, and parcel orders
    const orderIds = trips.filter(t => t.order_id).map(t => t.order_id);
    const captainRequestIds = trips.filter(t => t.captain_request_id).map(t => t.captain_request_id);
    const parcelOrderIds = trips.filter(t => t.parcel_order_id).map(t => t.parcel_order_id);

    // Helper to batch large .in() queries (PostgREST URL limit ~8KB, 100 UUIDs ≈ 3.6KB safe)
    const fetchInBatches = async (
      table: string,
      column: string,
      ids: string[],
      selectCols: string
    ): Promise<any[]> => {
      const CHUNK = 100;
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));
      const results = await Promise.all(
        chunks.map(chunk => supabase.from(table).select(selectCols).in(column, chunk))
      );
      return results.flatMap(r => r.data || []);
    };

    // Fetch order details separately
    let orders: any[] = [];
    let orderItems: any[] = [];
    if (orderIds.length > 0) {
      [orders, orderItems] = await Promise.all([
        fetchInBatches('orders', 'id', orderIds, 'id, order_number, customer_name, customer_phone, order_type, delivery_fee, subtotal, coupon_discount, points_discount, vendor_discount_amount, vendor_discount_percentage, payment_method, service_area, city, preparation_time, actual_preparation_time, preparation_start, preparation_start_time, preparation_end, notes, vendor_id, address, delivery_instructions, order_group_id'),
        fetchInBatches('order_items', 'order_id', orderIds, 'id, order_id, product_id, product_name, quantity, price, variant_name, addons_data, notes, vendor_id, vendor_name'),
      ]);
    }

    // Fetch captain order details (captain_orders is the correct table for vendor-initiated captain trips)
    let captainRequests: any[] = [];
    if (captainRequestIds.length > 0) {
      captainRequests = await fetchInBatches('captain_orders', 'id', captainRequestIds, 'id, customer_name, customer_phone, pickup_address, delivery_address, delivery_fee, notes, vendor_id, order_number');
    }

    // Fetch parcel order details
    let parcelOrders: any[] = [];
    if (parcelOrderIds.length > 0) {
      parcelOrders = await fetchInBatches('parcel_orders', 'id', parcelOrderIds, 'id, order_number, sender_name, sender_phone, sender_address, receiver_name, receiver_phone, receiver_address, delivery_fee, description, notes');
    }

    // Get vendor IDs from both regular orders and captain orders
    const orderVendorIds = orders?.filter(o => o.vendor_id).map(o => o.vendor_id) || [];
    const captainVendorIds = captainRequests?.filter(c => c.vendor_id).map(c => c.vendor_id) || [];
    const vendorIds = [...new Set([...orderVendorIds, ...captainVendorIds])];

    // Fetch vendor details separately
    let vendors: any[] = [];
    if (vendorIds.length > 0) {
      vendors = await fetchInBatches('vendors', 'id', vendorIds, 'id, store_name, phone, address');
    }

    // Transform the data to include all order details
    const transformedTrips = trips.map(trip => {
      // Check if this is a captain request trip
      if (trip.captain_request_id) {
        const captainRequest = captainRequests.find(cr => cr.id === trip.captain_request_id);
        const captainVendor = captainRequest?.vendor_id ? vendors.find(v => v.id === captainRequest.vendor_id) : null;

        const captainOrderNumber = trip.order_number || captainRequest?.order_number || `CAP-${trip.captain_request_id.substring(0, 6).toUpperCase()}`;

        return {
          ...trip,
          order_number: captainOrderNumber,
          customer_name: trip.customer_name || captainRequest?.customer_name || 'عميل كابتن',
          customer_phone: trip.customer_phone || captainRequest?.customer_phone || null,
          pickup_address: trip.pickup_address || captainRequest?.pickup_address || 'غير محدد',
          delivery_address: trip.delivery_address || captainRequest?.delivery_address || 'غير محدد',
          service_area: null,
          order_type: 'طلب كابتن',
          delivery_fee: captainRequest?.delivery_fee || trip.total,
          preparation_time: null,
          preparation_start: null,
          preparation_end: null,
          notes: trip.notes ?? captainRequest?.notes ?? null,
          store_name: captainVendor?.store_name || null,
          store_phone: captainVendor?.phone || null,
          store_address: captainVendor?.address || null,
          items: []
        };
      }

      // Check if this is a parcel order trip
      if (trip.parcel_order_id) {
        const parcelOrder = parcelOrders.find(po => po.id === trip.parcel_order_id);

        if (parcelOrder) {
          return {
            ...trip,
            order_id: trip.parcel_order_id, // Use parcel_order_id as order_id for compatibility
            order_number: parcelOrder.order_number,
            customer_name: trip.customer_name || parcelOrder.receiver_name,
            customer_phone: trip.customer_phone || parcelOrder.receiver_phone,
            pickup_address: trip.pickup_address || parcelOrder.sender_address,
            delivery_address: trip.delivery_address || parcelOrder.receiver_address,
            service_area: null,
            order_type: 'طلب طرد',
            delivery_fee: parcelOrder.delivery_fee || trip.total,
            preparation_time: null,
            preparation_start: null,
            preparation_end: null,
            notes: trip.notes || parcelOrder.description || parcelOrder.notes || null,
            store_name: parcelOrder.sender_name + ' (مُرسِل)',
            store_phone: parcelOrder.sender_phone,
            store_address: parcelOrder.sender_address,
            items: [],
            receiver_info: {
              name: parcelOrder.receiver_name,
              phone: parcelOrder.receiver_phone,
              address: parcelOrder.receiver_address
            }
          };
        }
      }

      // Otherwise, it's a store order
      const order = orders?.find(o => o.id === trip.order_id);
      const vendor = order?.vendor_id ? vendors.find(v => v.id === order.vendor_id) : null;

      // Get items for this order and transform addons_data to addons
      const rawItems = orderItems.filter(item => item.order_id === trip.order_id);
      const items = rawItems.map(item => ({
        ...item,
        addons: item.addons_data || [] // Transform addons_data to addons
      }));
      if (items.length > 0) {
      } else {
      }

      // Convert order_type to Arabic
      const getOrderTypeLabel = (type: string | null | undefined) => {
        if (!type) return 'طلب توصيل';
        switch (type.toLowerCase()) {
          case 'single':
            return 'طلب توصيل';
          case 'multi':
            return 'طلب متعدد';
          case 'scheduled':
            return 'طلب مجدول';
          default:
            return type;
        }
      };

      const transformed = {
        ...trip,
        order_number: trip.order_number || order?.order_number || null,
        customer_phone: trip.customer_phone || order?.customer_phone || null,
        delivery_address: trip.delivery_address || order?.address || trip.delivery_address,
        delivery_city: order?.city || null,
        delivery_instructions: order?.delivery_instructions || null,
        service_area: order?.service_area || order?.city || trip.city || null,
        order_type: getOrderTypeLabel(order?.order_type),
        delivery_fee: order?.delivery_fee || calculateDeliveryCommission(trip.total),
        preparation_time: order?.preparation_time || null,
        actual_preparation_time: order?.actual_preparation_time || null,
        preparation_start: order?.preparation_start || null,
        preparation_start_time: order?.preparation_start_time || null,
        preparation_end: order?.preparation_end || null,
        notes: trip.notes ?? order?.notes ?? null,
        subtotal: order?.subtotal != null ? Number(order.subtotal) : null,
        coupon_discount: order?.coupon_discount != null ? Number(order.coupon_discount) : null,
        points_discount: order?.points_discount != null ? Number(order.points_discount) : null,
        vendor_discount_amount: order?.vendor_discount_amount != null ? Number(order.vendor_discount_amount) : null,
        vendor_discount_percentage: order?.vendor_discount_percentage != null ? Number(order.vendor_discount_percentage) : null,
        payment_method: order?.payment_method || null,
        store_name: vendor?.store_name || null,
        store_phone: vendor?.phone || null,
        store_address: vendor?.address || null,
        items: items.length > 0 ? items : [],
        order_group_id: order?.order_group_id || null
      };
      return transformed;
    });
    return transformedTrips;
  } catch (error) {
    console.error('Error in getDriverTrips:', error);
    throw error;
  }
}

export interface WalletTransaction {
  id: string;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  created_at: string;
  order_id?: string;
  order_total?: number;
  delivery_fee?: number;
}

export interface DriverSettlement {
  id: string;
  period_start: string;
  period_end: string;
  total_delivery_fees: number;
  driver_earnings: number;
  total_trips: number;
  is_settled: boolean;
  settlement_date?: string;
  payment_method?: string;
  settlement_notes?: string;
  settlement_status?: 'pending' | 'completed';
  trip_id?: string;
  order_number?: string;
}

export interface WalletBalance {
  balance: number;
  currency: string;
  total_earnings: number;
  total_withdrawals: number;
  total_delivery_fees: number;
  completed_deliveries_count: number;
  average_commission: number;
  transactions: WalletTransaction[];
  settlements: DriverSettlement[];
}

// Creates a pending settlement record for a single completed trip
async function createTripSettlement(
  driverId: string,
  tripId: string,
  deliveryFee: number,
  commissionRate: number,
  orderNumber?: string
): Promise<void> {
  try {
    const now = new Date().toISOString();
    const storeCommission = parseFloat((deliveryFee * (commissionRate / 100)).toFixed(2));
    const driverEarnings = parseFloat((deliveryFee - storeCommission).toFixed(2));

    const { error } = await supabase
      .from('driver_settlements')
      .insert({
        driver_id: driverId,
        trip_id: tripId,
        order_number: orderNumber || null,
        period_start: now,
        period_end: now,
        total_delivery_fees: deliveryFee,
        store_commission: storeCommission,
        driver_earnings: driverEarnings,
        total_trips: 1,
        commission_rate: commissionRate,
        is_settled: false,
        settlement_status: 'pending',
        payment_method: 'cash',
        settlement_notes: ''
      });

    if (error) {
      console.error('❌ Error creating trip settlement:', error);
    } else {
    }
  } catch (err) {
    console.error('❌ createTripSettlement error:', err);
  }
}

// Helper function to add money to driver wallet
async function addToDriverWallet(driverId: string, amount: number, orderId: string | null, description: string): Promise<void> {
  try {
    // Validate amount
    if (!amount || amount <= 0) {
      console.error('❌ Invalid amount:', amount);
      throw new Error('مبلغ العمولة غير صحيح');
    }

    // Get or create driver wallet
    let { data: wallet, error: walletError } = await supabase
      .from('driver_wallets')
      .select('*')
      .eq('driver_id', driverId)
      .maybeSingle();

    if (walletError && walletError.code !== 'PGRST116') {
      console.error('❌ Error fetching wallet:', walletError);
      throw new Error('فشل في الحصول على بيانات المحفظة: ' + walletError.message);
    }

    // Create wallet if it doesn't exist
    if (!wallet) {
      const { data: newWallet, error: createError } = await supabase
        .from('driver_wallets')
        .insert({
          driver_id: driverId,
          balance: amount,
          total_earnings: amount,
          total_withdrawals: 0
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creating wallet:', createError);
        throw new Error('فشل في إنشاء محفظة جديدة: ' + createError.message);
      }

      wallet = newWallet;
    } else {
      // Update existing wallet
      const newBalance = (wallet.balance || 0) + amount;
      const newTotalEarnings = (wallet.total_earnings || 0) + amount;
      const { error: updateError } = await supabase
        .from('driver_wallets')
        .update({
          balance: newBalance,
          total_earnings: newTotalEarnings,
          updated_at: new Date().toISOString()
        })
        .eq('id', wallet.id);

      if (updateError) {
        console.error('❌ Error updating wallet:', updateError);
        throw new Error('فشل في تحديث المحفظة: ' + updateError.message);
      }
    }

    // Add transaction record
    const { error: txError } = await supabase
      .from('wallet_transactions')
      .insert({
        wallet_id: wallet.id,
        order_id: orderId || null,
        amount: amount,
        type: 'credit',
        payment_type: 'commission',
        status: 'completed',
        description: `${description}${orderId ? ` - طلب #${orderId.substring(0, 8)}` : ''}`
      });

    if (txError) {
      console.error('❌ Error adding transaction:', txError);
      throw new Error('فشل في إضافة سجل المعاملة: ' + txError.message);
    }
  } catch (error) {
    console.error('❌ Error in addToDriverWallet:', error);
    throw error;
  }
}

export async function getCurrentDriver() {
  try {
    const storedSession = await storage.get('driver_session');
    if (!storedSession) {
      return null;
    }

    let session;
    try {
      session = JSON.parse(storedSession);
    } catch (parseError) {
      console.error('Error parsing session:', parseError);
      return null;
    }
    if (!session.id) {
      return null;
    }

    // If session has driver_profile, use that ID first (most reliable)
    if (session.driver_profile?.id) {
      const { data: driver, error: driverError } = await supabase
        .from('drivers')
        .select('*')
        .eq('id', session.driver_profile.id)
        .maybeSingle();

      if (!driverError && driver) {
        return driver;
      } else if (driverError) {
        console.error('❌ Error fetching by driver_profile.id:', driverError);
      }
    } else {
    }

    // Try to get driver by id (if user is directly a driver)
    let { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', session.id)
      .maybeSingle();

    if (driver) {
      return driver;
    }

    // If not found, try to get driver by user_id (if user has a driver profile)
    const { data: driverByUserId, error: userIdError } = await supabase
      .from('drivers')
      .select('*')
      .eq('user_id', session.id)
      .maybeSingle();

    if (!userIdError && driverByUserId) {
      driver = driverByUserId;
    }

    if (!driver) {
      return null;
    }

    return driver;
  } catch (error) {
    console.error('Error in getCurrentDriver:', error);
    return null;
  }
}

export async function requestWithdrawal(amount: number): Promise<void> {
  try {
    // Get current driver
    const driver = await getCurrentDriver();
    if (!driver || !driver.id) {
      throw new Error('لم يتم العثور على بيانات السائق');
    }

    // Get driver wallet
    const { data: wallet, error: walletError } = await supabase
      .from('driver_wallets')
      .select('id, balance')
      .eq('driver_id', driver.id)
      .maybeSingle();

    if (walletError) {
      throw walletError;
    }

    if (!wallet) {
      throw new Error('لم يتم العثور على المحفظة');
    }

    if (wallet.balance < amount) {
      throw new Error('الرصيد غير كافي');
    }

    // Create withdrawal request
    const { data: withdrawalRequest, error: withdrawalError } = await supabase
      .from('withdrawal_requests')
      .insert({
        driver_id: driver.id,
        amount: amount,
        status: 'pending',
        notes: 'طلب سحب من تطبيق السائق'
      })
      .select()
      .single();

    if (withdrawalError) {
      throw withdrawalError;
    }

    // Create withdrawal transaction
    const { error: txError } = await supabase
      .from('wallet_transactions')
      .insert({
        wallet_id: wallet.id,
        amount: amount,
        type: 'debit',
        payment_type: 'withdrawal',
        status: 'pending',
        description: 'طلب سحب',
        withdrawal_request_id: withdrawalRequest.id
      });

    if (txError) {
      throw txError;
    }

    // Update wallet balance
    const { error: updateError } = await supabase
      .from('driver_wallets')
      .update({
        balance: wallet.balance - amount,
        total_withdrawals: (wallet.total_withdrawals || 0) + amount,
        updated_at: new Date().toISOString()
      })
      .eq('id', wallet.id);

    if (updateError) {
      throw updateError;
    }
  } catch (error) {
    console.error('Error in requestWithdrawal:', error);
    throw error;
  }
}

export async function getDriverDeliveries(driverId?: string): Promise<Delivery[]> {
  try {
    // Round 1: all independent queries in parallel
    const [
      { data: captainRequests, error: captainRequestsError },
      { data: parcelOrders, error: parcelOrdersError },
      { data: waitingList, error: waitingListError },
      { data: serviceAreasData },
    ] = await Promise.all([
      supabase
        .from('captain_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      supabase
        .from('parcel_orders')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      supabase
        .from('driver_waiting_list')
        .select(`
          id,
          order_id,
          order_number,
          vendor_id,
          status,
          customer_name,
          customer_phone,
          address,
          city,
          total,
          notes,
          created_at,
          updated_at,
          driver_id,
          driver_name,
          vendor_name,
          payment_method,
          preparation_time,
          actual_preparation_time,
          preparation_start,
          preparation_end,
          geocoded_latitude,
          geocoded_longitude,
          vendor:vendor_id (id, store_name, phone, address, latitude, longitude)
        `)
        .in('status', ['pending', 'preparing'])
        .order('created_at', { ascending: false }),
      supabase
        .from('service_areas')
        .select('id, name, city, delivery_price')
        .eq('is_active', true),
    ]);

    let result: Delivery[] = [];

    // Captain requests
    if (captainRequestsError) {
      console.error('Error fetching captain requests:', captainRequestsError);
    } else {
      result = [
        ...result,
        ...(captainRequests || []).map(request => {
          const fareAmount = request.final_fare || request.estimated_fare || 0;
          const parsedFare = fareAmount ? parseFloat(fareAmount.toString()) : 0;
          return {
            id: request.id || '',
            order_id: request.order_number || request.id || '',
            status: request.status === 'in_progress' ? ('delivering' as const) :
                    request.status === 'assigned' ? ('assigned' as const) :
                    ('pending' as const),
            customer_name: request.customer_name || 'غير معروف',
            customer_phone: request.customer_phone || undefined,
            order_type: 'طلب كابتن',
            pickup_location: request.pickup_address || 'غير محدد',
            delivery_location: request.destination_address || 'غير محدد',
            created_at: request.created_at || new Date().toISOString(),
            updated_at: request.updated_at,
            store_info: undefined,
            delivery_fee: parsedFare,
            total_amount: parsedFare,
            driver_name: request.captain_id ? 'مُعيّن' : undefined
          };
        }),
      ];
    }

    // Parcel orders
    if (parcelOrdersError) {
      console.error('Error fetching parcel orders:', parcelOrdersError);
    } else {
      result = [
        ...result,
        ...(parcelOrders || []).map(order => {
          const deliveryFee = order.delivery_fee ? parseFloat(order.delivery_fee.toString()) : 0;
          return {
            id: order.id || '',
            order_id: order.order_number || order.id || '',
            status: 'pending' as const,
            customer_name: order.sender_name || 'غير معروف',
            customer_phone: order.sender_phone || undefined,
            order_type: 'توصيل طرد',
            pickup_location: order.sender_address || 'غير محدد',
            delivery_location: order.receiver_address || 'غير محدد',
            created_at: order.created_at || new Date().toISOString(),
            updated_at: order.updated_at,
            store_info: undefined,
            delivery_fee: deliveryFee,
            total_amount: deliveryFee,
            driver_name: undefined,
            notes: order.description || order.notes || undefined,
            receiver_info: {
              name: order.receiver_name,
              phone: order.receiver_phone,
              address: order.receiver_address
            }
          };
        }),
      ];
    }

    // Waiting list
    if (waitingListError) {
      console.error('Error fetching waiting list:', waitingListError);
    } else {
      // Build service area map
      const serviceAreaMap = new Map<string, { delivery_price: number; city: string }>();
      (serviceAreasData || []).forEach((sa: any) => {
        const key = (sa.name || '').trim();
        if (key) serviceAreaMap.set(key, {
          delivery_price: sa.delivery_price ? parseFloat(sa.delivery_price) : 0,
          city: (sa.city || '').trim()
        });
      });

      const orderIds = (waitingList || []).map(item => item.order_id).filter(Boolean);
      let ordersMap: Map<string, any> = new Map();

      if (orderIds.length > 0) {
        // Round 2: orders and order_items in parallel
        const [
          { data: ordersData, error: ordersError },
          { data: orderItems, error: itemsError },
        ] = await Promise.all([
          supabase
            .from('orders')
            .select('id, customer_name, customer_phone, address, service_area, city, order_type, total, subtotal, coupon_discount, points_discount, vendor_discount_amount, vendor_discount_percentage, delivery_fee, payment_method, created_at, preparation_time, actual_preparation_time, preparation_start, preparation_start_time, preparation_end, delivery_instructions, order_group_id')
            .in('id', orderIds),
          supabase
            .from('order_items')
            .select('order_id, product_name, quantity, price, variant_name, notes, addons_data, vendor_id, vendor_name')
            .in('order_id', orderIds),
        ]);

        if (!ordersError && ordersData) {
          ordersData.forEach(order => { ordersMap.set(order.id, order); });
        } else if (ordersError) {
          console.error('Error fetching orders data:', ordersError);
        }

        if (!itemsError && orderItems) {
          const itemsByOrder = new Map<string, any[]>();
          orderItems.forEach(item => {
            if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
            const rawAddons = Array.isArray(item.addons_data) ? item.addons_data : [];
            itemsByOrder.get(item.order_id)!.push({
              product_name: item.product_name,
              quantity: typeof item.quantity === 'string' ? parseInt(item.quantity) : (item.quantity || 1),
              price: typeof item.price === 'string' ? parseFloat(item.price) : (item.price || 0),
              variant_name: item.variant_name,
              notes: item.notes,
              vendor_id: item.vendor_id,
              vendor_name: item.vendor_name,
              addons: rawAddons.map((a: any) => ({
                name: a.name || '',
                price: typeof a.price === 'string' ? parseFloat(a.price) : (a.price || 0),
                quantity: typeof a.quantity === 'string' ? parseInt(a.quantity) : (a.quantity || 1)
              }))
            });
          });
          itemsByOrder.forEach((items, orderId) => {
            const order = ordersMap.get(orderId);
            if (order) order.items_data = items;
          });
        } else if (itemsError) {
          console.error('Error fetching order items:', itemsError);
        }
      }

      const pendingDeliveries = (waitingList || []).map(item => {
        const orderDetails = item.order_id ? ordersMap.get(item.order_id) : null;
        const orderTotal = orderDetails?.total || item.total || 0;
        const totalAmount = typeof orderTotal === 'number' ? orderTotal :
                           (typeof orderTotal === 'string' ? parseFloat(orderTotal) : 0);

        let deliveryFee: number;
        let serviceAreaDisplay: string | undefined;
        let subAreaDisplay: string | undefined;

        if (!item.order_id) {
          deliveryFee = item.total ? parseFloat(item.total.toString()) : 0;
          serviceAreaDisplay = (item.city || '').trim() || undefined;
          subAreaDisplay = undefined;
        } else {
          const subAreaName = (orderDetails?.city || item.city || '').trim();
          const serviceAreaInfo = subAreaName ? serviceAreaMap.get(subAreaName) : undefined;
          subAreaDisplay = subAreaName || undefined;
          serviceAreaDisplay = serviceAreaInfo ? serviceAreaInfo.city : (orderDetails?.service_area || undefined);
          if (serviceAreaInfo) {
            deliveryFee = serviceAreaInfo.delivery_price;
          } else {
            const rawDeliveryFee = orderDetails?.delivery_fee;
            const parsedDeliveryFee = rawDeliveryFee !== undefined && rawDeliveryFee !== null
              ? parseFloat(rawDeliveryFee.toString())
              : NaN;
            deliveryFee = !isNaN(parsedDeliveryFee) ? parsedDeliveryFee : calculateDeliveryCommission(totalAmount);
          }
        }
        return {
          id: item.id || '',
          order_id: item.order_number || item.order_id || '',
          status: item.status === 'preparing' ? ('preparing' as const) : ('pending' as const),
          customer_name: orderDetails?.customer_name || item.customer_name || 'غير معروف',
          customer_phone: orderDetails?.customer_phone || item.customer_phone || undefined,
          order_type: orderDetails?.order_type || (item.order_id ? 'توصيل طلب متجر' : 'طلب كابتن'),
          service_area: serviceAreaDisplay,
          pickup_location: item.vendor?.address || 'غير محدد',
          delivery_location: orderDetails?.address || item.address || 'غير محدد',
          delivery_city: subAreaDisplay,
          delivery_instructions: orderDetails?.delivery_instructions || undefined,
          notes: orderDetails?.delivery_instructions || item.notes || undefined,
          created_at: orderDetails?.created_at || item.created_at || new Date().toISOString(),
          updated_at: item.updated_at,
          preparation_time: item.preparation_time,
          actual_preparation_time: item.actual_preparation_time || orderDetails?.actual_preparation_time,
          preparation_start: item.preparation_start || orderDetails?.preparation_start,
          preparation_start_time: orderDetails?.preparation_start_time || null,
          preparation_end: item.preparation_end || orderDetails?.preparation_end,
          store_info: {
            name: item.vendor_name || item.vendor?.store_name || 'غير معروف',
            phone: item.vendor?.phone,
            address: item.vendor?.address
          },
          delivery_fee: deliveryFee,
          total_amount: totalAmount,
          subtotal: orderDetails?.subtotal !== undefined ? parseFloat(orderDetails.subtotal) : undefined,
          coupon_discount: orderDetails?.coupon_discount !== undefined ? parseFloat(orderDetails.coupon_discount) : undefined,
          points_discount: orderDetails?.points_discount !== undefined ? parseFloat(orderDetails.points_discount) : undefined,
          vendor_discount_amount: orderDetails?.vendor_discount_amount !== undefined ? parseFloat(orderDetails.vendor_discount_amount) : undefined,
          vendor_discount_percentage: orderDetails?.vendor_discount_percentage !== undefined ? parseFloat(orderDetails.vendor_discount_percentage) : undefined,
          payment_method: orderDetails?.payment_method || item.payment_method || undefined,
          driver_name: item.driver_name || undefined,
          items: orderDetails?.items_data || undefined,
          order_group_id: orderDetails?.order_group_id || undefined
        };
      });

      result = [...result, ...pendingDeliveries];
    }

    // Assigned/in-progress trips for this driver (if driverId provided)
    if (driverId) {
      const { data: assignedTrips, error: assignedTripsError } = await supabase
        .from('driver_trips')
        .select('*')
        .eq('driver_id', driverId)
        .in('status', ['assigned', 'in_progress'])
        .order('created_at', { ascending: false });

      if (assignedTripsError) {
        console.error('Error fetching assigned trips:', assignedTripsError);
      } else {
        const assignedDeliveries = (assignedTrips || []).map(trip => {
          const deliveryFee = trip.delivery_fee || 0;
          const totalAmount = trip.total || 0;
          let orderType = 'توصيل طلب متجر';
          if (trip.captain_request_id) orderType = 'طلب كابتن';
          else if (trip.parcel_order_id) orderType = 'توصيل طرد';

          return {
            id: trip.id || '',
            order_id: trip.order_number || trip.order_id || '',
            status: trip.status === 'in_progress' ? ('delivering' as const) : ('assigned' as const),
            customer_name: trip.customer_name || 'غير معروف',
            customer_phone: trip.customer_phone || undefined,
            order_type: orderType,
            service_area: trip.service_area || undefined,
            pickup_location: trip.pickup_address || 'غير محدد',
            delivery_location: trip.delivery_address || 'غير محدد',
            delivery_city: trip.delivery_city || undefined,
            delivery_instructions: trip.delivery_instructions || undefined,
            created_at: trip.created_at || new Date().toISOString(),
            updated_at: trip.updated_at,
            preparation_time: trip.actual_preparation_time || trip.preparation_time,
            actual_preparation_time: trip.actual_preparation_time,
            preparation_start: trip.preparation_start,
            preparation_end: trip.preparation_end,
            notes: trip.notes || undefined,
            store_info: trip.store_name ? {
              name: trip.store_name,
              phone: trip.store_phone,
              address: trip.store_address
            } : undefined,
            delivery_fee: deliveryFee,
            total_amount: totalAmount,
            subtotal: trip.subtotal ?? undefined,
            coupon_discount: trip.coupon_discount ?? undefined,
            payment_method: trip.payment_method || undefined,
            driver_name: 'مُعيّن',
            items: trip.items || undefined
          };
        });
        result = [...result, ...assignedDeliveries];
      }
    }

    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return result;
  } catch (error) {
    console.error('Error fetching driver deliveries:', error);
    return [];
  }
}

export interface CompletedOrderDay {
  date: string; // YYYY-MM-DD
  label: string; // "اليوم" / "أمس" / "الاثنين 2 يونيو" etc.
  orders: DriverTrip[];
  totalEarnings: number;
}

export async function getCompletedOrdersByDay(): Promise<CompletedOrderDay[]> {
  try {
    const driver = await getCurrentDriver();
    if (!driver?.id) return [];

    const { data: trips, error } = await supabase
      .from('driver_trips')
      .select('*')
      .eq('driver_id', driver.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(200);

    if (error || !trips || trips.length === 0) return [];

    // Fetch order details for regular orders
    const orderIds = trips.filter(t => t.order_id).map(t => t.order_id);
    const captainIds = trips.filter(t => t.captain_request_id).map(t => t.captain_request_id);
    const parcelIds = trips.filter(t => t.parcel_order_id).map(t => t.parcel_order_id);

    const ordersMap = new Map<string, any>();
    const captainMap = new Map<string, any>();
    const parcelMap = new Map<string, any>();

    if (orderIds.length > 0) {
      const { data } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, customer_phone, address, delivery_fee, total, notes, vendor_id')
        .in('id', orderIds);
      (data || []).forEach(o => ordersMap.set(o.id, o));
    }
    if (captainIds.length > 0) {
      const { data } = await supabase
        .from('captain_orders')
        .select('id, order_number, customer_name, customer_phone, pickup_address, delivery_address, delivery_fee')
        .in('id', captainIds);
      (data || []).forEach(c => captainMap.set(c.id, c));
    }
    if (parcelIds.length > 0) {
      const { data } = await supabase
        .from('parcel_orders')
        .select('id, order_number, sender_name, sender_phone, sender_address, receiver_address, delivery_fee')
        .in('id', parcelIds);
      (data || []).forEach(p => parcelMap.set(p.id, p));
    }

    // Fetch vendor names
    const vendorIdSet = new Set<string>();
    ordersMap.forEach(o => o.vendor_id && vendorIdSet.add(o.vendor_id));
    const vendorNameMap = new Map<string, string>();
    if (vendorIdSet.size > 0) {
      const { data } = await supabase
        .from('vendors')
        .select('id, store_name')
        .in('id', [...vendorIdSet]);
      (data || []).forEach(v => vendorNameMap.set(v.id, v.store_name));
    }

    // Build DriverTrip objects
    const mapped: DriverTrip[] = trips.map(t => {
      const order = t.order_id ? ordersMap.get(t.order_id) : null;
      const captain = t.captain_request_id ? captainMap.get(t.captain_request_id) : null;
      const parcel = t.parcel_order_id ? parcelMap.get(t.parcel_order_id) : null;

      let customerName = 'غير معروف';
      let customerPhone: string | undefined;
      let pickupAddress = '';
      let deliveryAddress = '';
      let fee = 0;
      let orderNumber = t.order_number || '';
      let orderType = 'توصيل طلب';
      let storeName: string | undefined;

      if (order) {
        customerName = order.customer_name || customerName;
        customerPhone = order.customer_phone;
        pickupAddress = vendorNameMap.get(order.vendor_id) || '';
        deliveryAddress = order.address || '';
        fee = parseFloat(order.delivery_fee?.toString() || '0');
        orderNumber = order.order_number || orderNumber;
        storeName = vendorNameMap.get(order.vendor_id);
      } else if (captain) {
        customerName = captain.customer_name || customerName;
        customerPhone = captain.customer_phone;
        pickupAddress = captain.pickup_address || '';
        deliveryAddress = captain.delivery_address || '';
        fee = parseFloat(captain.delivery_fee?.toString() || '0');
        orderNumber = captain.order_number || orderNumber;
        orderType = 'طلب كابتن';
      } else if (parcel) {
        customerName = parcel.sender_name || customerName;
        customerPhone = parcel.sender_phone;
        pickupAddress = parcel.sender_address || '';
        deliveryAddress = parcel.receiver_address || '';
        fee = parseFloat(parcel.delivery_fee?.toString() || '0');
        orderNumber = parcel.order_number || orderNumber;
        orderType = 'توصيل طرد';
      }

      return {
        id: t.id,
        order_id: t.order_id || '',
        order_number: orderNumber,
        driver_id: t.driver_id,
        status: t.status,
        customer_name: customerName,
        customer_phone: customerPhone,
        pickup_address: pickupAddress,
        delivery_address: deliveryAddress,
        total: parseFloat(t.total?.toString() || fee.toString() || '0'),
        delivery_fee: fee,
        assigned_at: t.assigned_at || t.created_at,
        started_at: t.started_at,
        completed_at: t.completed_at,
        created_at: t.created_at,
        updated_at: t.updated_at,
        order_type: orderType,
        store_name: storeName,
        notes: t.notes,
      } as DriverTrip;
    });

    // Group by day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dayMap = new Map<string, DriverTrip[]>();
    mapped.forEach(trip => {
      const d = new Date(trip.completed_at || trip.created_at);
      const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
      if (!dayMap.has(key)) dayMap.set(key, []);
      dayMap.get(key)!.push(trip);
    });

    const arabicDays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const arabicMonths = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

    const days: CompletedOrderDay[] = [...dayMap.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dateKey, orders]) => {
        const d = new Date(dateKey + 'T00:00:00');
        let label: string;
        if (dateKey === today.toISOString().slice(0, 10)) {
          label = 'اليوم';
        } else if (dateKey === yesterday.toISOString().slice(0, 10)) {
          label = 'أمس';
        } else {
          label = `${arabicDays[d.getDay()]} ${d.getDate()} ${arabicMonths[d.getMonth()]}`;
        }
        const totalEarnings = orders.reduce((sum, o) => sum + (o.delivery_fee || 0), 0);
        return { date: dateKey, label, orders, totalEarnings };
      });

    return days;
  } catch (err) {
    console.error('getCompletedOrdersByDay error:', err);
    return [];
  }
}

// حساب عمولة التوصيل بناءً على قيمة الطلب
function calculateDeliveryCommission(orderTotal: number | string | null): number {
  try {
    // تحويل قيمة الطلب إلى رقم
    const total = typeof orderTotal === 'number'
      ? orderTotal
      : typeof orderTotal === 'string'
        ? parseFloat(orderTotal)
        : 0;

    // إذا لم تكن هناك قيمة صحيحة، استخدم العمولة الافتراضية
    if (!total || total <= 0) {
      return 15;
    }

    // حساب العمولة بناءً على قيمة الطلب
    let commission = 0;

    if (total <= 50) {
      // للطلبات الصغيرة (حتى 50 شيكل): عمولة ثابتة 10 شيكل
      commission = 10;
    } else if (total <= 100) {
      // للطلبات المتوسطة (51-100 شيكل): عمولة ثابتة 15 شيكل
      commission = 15;
    } else if (total <= 200) {
      // للطلبات الكبيرة (101-200 شيكل): 15% من قيمة الطلب
      commission = Math.round(total * 0.15);
    } else {
      // للطلبات الكبيرة جداً (أكثر من 200 شيكل): 12% من قيمة الطلب مع حد أقصى 40 شيكل
      commission = Math.min(Math.round(total * 0.12), 40);
    }

    // التأكد من أن العمولة لا تقل عن 8 شيكل
    commission = Math.max(commission, 8);
    return commission;

  } catch (error) {
    console.error('Error calculating delivery commission:', error);
    return 15; // عمولة افتراضية في حالة الخطأ
  }
}

export async function startDeliveryTrip(deliveryId: string): Promise<void> {
  try {
    // Get current driver
    const driverData = await getCurrentDriver();
    if (!driverData || !driverData.id) {
      console.error('❌ Driver not found or invalid');
      throw new Error('لم يتم العثور على بيانات السائق. يرجى تسجيل الدخول مرة أخرى');
    }
    // FIRST: Check if this is already an accepted trip (driver_trips with status='assigned')
    // Search by trip.id first, then by captain_request_id (since delivery.id may be captain_request.id)
    let { data: driverTrip, error: driverTripError } = await supabase
      .from('driver_trips')
      .select('*, captain_request_id, parcel_order_id, order_id')
      .eq('id', deliveryId)
      .eq('status', 'assigned')
      .maybeSingle();

    if (driverTripError && driverTripError.code !== 'PGRST116') {
      console.error('❌ Error fetching driver trip by id:', driverTripError);
    }

    // If not found by trip.id, try finding by captain_request_id (for CAP orders)
    if (!driverTrip) {
      const { data: captainTrip, error: captainTripError } = await supabase
        .from('driver_trips')
        .select('*, captain_request_id, parcel_order_id, order_id')
        .eq('captain_request_id', deliveryId)
        .eq('status', 'assigned')
        .maybeSingle();

      if (captainTripError && captainTripError.code !== 'PGRST116') {
        console.error('❌ Error fetching driver trip by captain_request_id:', captainTripError);
      }

      if (captainTrip) {
        driverTrip = captainTrip;
      }
    }

    // If it's an accepted trip, start it by updating status to in_progress
    if (driverTrip) {
      // Update trip status to in_progress (use driverTrip.id, not deliveryId which may be captain_request.id)
      const { error: updateError } = await supabase
        .from('driver_trips')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', driverTrip.id);

      if (updateError) {
        console.error('Error starting trip:', updateError);
        throw new Error('فشل في بدء الرحلة');
      }

      // If it's a captain request, update captain_requests status to in_progress as well
      if (driverTrip.captain_request_id) {
        const { error: captainUpdateError } = await supabase
          .from('captain_requests')
          .update({
            status: 'in_progress',
            updated_at: new Date().toISOString()
          })
          .eq('id', driverTrip.captain_request_id);

        if (captainUpdateError) {
          console.error('Error updating captain request status:', captainUpdateError);
        }
      }

      // If it's a parcel order, update parcel_orders status to in_progress as well
      if (driverTrip.parcel_order_id) {
        const { error: parcelUpdateError } = await supabase
          .from('parcel_orders')
          .update({
            status: 'in_progress',
            updated_at: new Date().toISOString()
          })
          .eq('id', driverTrip.parcel_order_id);

        if (parcelUpdateError) {
          console.error('Error updating parcel order status:', parcelUpdateError);
        }
      }

      // If it's a regular order, update orders table status to picked_up
      if (driverTrip.order_id) {
        const { error: orderUpdateError } = await supabase
          .from('orders')
          .update({
            status: 'picked_up',
            updated_at: new Date().toISOString()
          })
          .eq('id', driverTrip.order_id);

        if (orderUpdateError) {
          console.error('Error updating order status:', orderUpdateError);
        }
      }
      return;
    }

    // SECOND: Check if this is a captain_order (direct by ID)
    const { data: captainOrderById, error: captainFetchError } = await supabase
      .from('captain_orders')
      .select('*')
      .eq('id', deliveryId)
      .maybeSingle();

    if (captainFetchError) {
      console.error('❌ Error fetching captain_order:', captainFetchError);
    }

    // If it's a captain_order, handle it
    if (captainOrderById) {
      const { error: updateError } = await supabase
        .from('captain_orders')
        .update({ status: 'accepted', driver_id: driverData.id, accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', deliveryId);

      if (updateError) {
        console.error('Error accepting captain_order:', updateError);
        throw new Error('فشل في قبول الطلب');
      }

      const fare = captainOrderById.delivery_fee || 0;
      const captainOrderNumber = captainOrderById.order_number || `CAP-${deliveryId.substring(0, 6).toUpperCase()}`;

      const { error: tripError } = await supabase
        .from('driver_trips')
        .insert({
          driver_id: driverData.id,
          captain_request_id: deliveryId,
          status: 'assigned',
          customer_name: captainOrderById.customer_name || 'غير معروف',
          customer_phone: captainOrderById.customer_phone || '',
          pickup_address: captainOrderById.pickup_address || 'غير محدد',
          delivery_address: captainOrderById.delivery_address || 'غير محدد',
          total: fare,
          assigned_at: new Date().toISOString(),
          order_number: captainOrderNumber
        });

      if (tripError) {
        console.error('Error creating captain trip:', tripError);
        throw new Error('فشل في إنشاء الرحلة');
      }
      return;
    }

    // Otherwise, handle as regular store order
    const { data: waitingListEntry, error: fetchError } = await supabase
      .from('driver_waiting_list')
      .select('order_id, captain_order_id, parcel_order_id, vendor_id, customer_name, customer_phone, address, total, order_number, vendor:vendor_id(address)')
      .eq('id', deliveryId)
      .eq('driver_id', driverData.id)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('❌ Error fetching waiting list entry:', fetchError);
      throw new Error(`فشل في جلب بيانات الطلب: ${fetchError.message}`);
    }

    if (!waitingListEntry) {
      console.error('❌ Waiting list entry not found or not assigned to this driver');
      throw new Error('لم يتم العثور على الطلب أو أنه غير مُعيّن لك');
    }

    // Handle captain_order start trip via waiting list
    if (!waitingListEntry.order_id && waitingListEntry.captain_order_id) {
      const { data: captainTrip } = await supabase
        .from('driver_trips')
        .select('id')
        .eq('captain_request_id', waitingListEntry.captain_order_id)
        .eq('driver_id', driverData.id)
        .maybeSingle();

      if (captainTrip) {
        await supabase.from('driver_trips').update({ status: 'in_progress', started_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', captainTrip.id);
        await supabase.from('captain_orders').update({ status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', waitingListEntry.captain_order_id);
      }
      return;
    }

    // Handle parcel order start trip via waiting list
    if (!waitingListEntry.order_id && waitingListEntry.parcel_order_id) {
      const { data: parcelTrip } = await supabase
        .from('driver_trips')
        .select('id')
        .eq('parcel_order_id', waitingListEntry.parcel_order_id)
        .eq('driver_id', driverData.id)
        .maybeSingle();

      if (parcelTrip) {
        await supabase.from('driver_trips').update({ status: 'in_progress', started_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', parcelTrip.id);
        await supabase.from('parcel_orders').update({ status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', waitingListEntry.parcel_order_id);
      }
      return;
    }

    const orderID = waitingListEntry?.order_id;

    if (!orderID) {
      throw new Error('معرف الطلب غير صحيح أو مفقود');
    }

    // Verify the order exists in orders table
    const { data: orderExists, error: orderCheckError } = await supabase
      .from('orders')
      .select('id')
      .eq('id', orderID)
      .maybeSingle();

    if (orderCheckError) {
      console.error('❌ Error checking order existence:', orderCheckError);
      throw new Error('فشل في التحقق من وجود الطلب');
    }

    if (!orderExists) {
      console.error('❌ Order not found in orders table:', orderID);
      // Remove the orphaned entry from waiting list
      await supabase
        .from('driver_waiting_list')
        .delete()
        .eq('id', deliveryId);
      throw new Error('الطلب غير موجود أو تم حذفه. تم تنظيف البيانات.');
    }
    // Update trip status to in_progress
    const { error: tripError } = await supabase
      .from('driver_trips')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString()
      })
      .eq('order_id', orderID)
      .eq('driver_id', driverData.id);

    if (tripError) {
      console.error('Error updating trip:', tripError);
      throw tripError;
    }

    // Update order status to 'shipping'
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        status: 'shipping',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderID);

    if (orderError) {
      console.error('Error updating orders table:', orderError);
      throw orderError;
    } else {
      // Add status history entry
      try {
        const { error: historyError } = await supabase
          .from('order_status_history')
          .insert({
            order_id: orderID,
            status: 'shipping',
            created_by: driverData.user_id || null,
            driver_name: driverData.name,
            note: 'السائق في الطريق للتوصيل',
            preparation_time_minutes: 0
          });

        if (historyError) {
          console.error('Error adding status history:', historyError);
        } else {
        }
      } catch (historyErr) {
        console.error('Error adding status history:', historyErr);
      }
    }
  } catch (error) {
    console.error('Error starting delivery trip:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to start delivery trip');
  }
}

export async function updateDeliveryStatus(deliveryId: string, status: 'delivering' | 'delivered'): Promise<void> {
  try {
    // Get current driver
    const driverData = await getCurrentDriver();
    if (!driverData || !driverData.id) {
      console.error('❌ Driver not found or invalid');
      throw new Error('لم يتم العثور على بيانات السائق. يرجى تسجيل الدخول مرة أخرى');
    }
    // Allow multiple trips - just log active trips for awareness
    if (status === 'delivering') {
      // Check for active orders to show warning but don't block
      const { data: existingActiveOrders, error: checkError } = await supabase
        .from('driver_waiting_list')
        .select('id, order_id, customer_name')
        .eq('driver_id', driverData.id)
        .eq('status', 'accepted');

      if (!checkError && existingActiveOrders && existingActiveOrders.length > 0) {
      }

      // Check for active trips
      const { data: activeTrips, error: tripsError } = await supabase
        .from('driver_trips')
        .select('id, order_id, customer_name')
        .eq('driver_id', driverData.id)
        .in('status', ['assigned', 'in_progress']);

      if (!tripsError && activeTrips && activeTrips.length > 0) {
      }
    }

    // Validate deliveryId to prevent UUID errors
    if (!deliveryId || deliveryId === 'NaN' || deliveryId === 'undefined') {
      throw new Error(`Invalid delivery ID: ${deliveryId}`);
    }

    // FIRST: Check if this is a driver_trip entry (already accepted)
    // Search by trip.id first, then by captain_request_id (since delivery.id may be captain_request.id)
    let { data: driverTrip, error: driverTripError } = await supabase
      .from('driver_trips')
      .select('*, captain_request_id, parcel_order_id, order_id')
      .eq('id', deliveryId)
      .maybeSingle();

    if (driverTripError && driverTripError.code !== 'PGRST116') {
      console.error('❌ Error fetching driver trip by id:', driverTripError);
    }

    // If not found by trip.id, try finding by captain_request_id (for CAP orders)
    if (!driverTrip) {
      const { data: captainTrip, error: captainTripError } = await supabase
        .from('driver_trips')
        .select('*, captain_request_id, parcel_order_id, order_id')
        .eq('captain_request_id', deliveryId)
        .maybeSingle();

      if (captainTripError && captainTripError.code !== 'PGRST116') {
        console.error('❌ Error fetching driver trip by captain_request_id:', captainTripError);
      }

      if (captainTrip) {
        driverTrip = captainTrip;
      }
    }

    // If it's a driver trip (already accepted), handle status updates
    if (driverTrip) {
      // Use the actual trip.id for all operations (not captain_request.id)
      const tripId = driverTrip.id;

      // Handle captain request trip
      if (driverTrip.captain_request_id) {
        if (status === 'delivering') {
          throw new Error('استخدم زر "بدء الرحلة" لبدء التوصيل');
        } else if (status === 'delivered') {
          await completeTrip(tripId);
        }
        return;
      }

      // Handle parcel order trip
      if (driverTrip.parcel_order_id) {
        if (status === 'delivering') {
          throw new Error('استخدم زر "بدء الرحلة" لبدء التوصيل');
        } else if (status === 'delivered') {
          await completeTrip(tripId);
        }
        return;
      }

      // Handle regular store order trip
      if (driverTrip.order_id) {
        // Continue with regular flow below
      }
    }

    // SECOND: Check if this is a captain_request (not yet accepted)
    const { data: captainOrderDirect, error: captainFetchError } = await supabase
      .from('captain_orders')
      .select('*')
      .eq('id', deliveryId)
      .maybeSingle();

    if (captainFetchError && captainFetchError.code !== 'PGRST116') {
      console.error('❌ Error fetching captain_order:', captainFetchError);
    }

    // If it's a captain_order (direct), accept it
    if (captainOrderDirect) {
      if (status === 'delivering') {
        const { error: updateError } = await supabase
          .from('captain_orders')
          .update({ status: 'accepted', driver_id: driverData.id, accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', deliveryId);

        if (updateError) {
          console.error('Error updating captain_order:', updateError);
          throw updateError;
        }

        const fare = captainOrderDirect.delivery_fee || 0;
        const captainOrderNumber = captainOrderDirect.order_number || `CAP-${deliveryId.substring(0, 6).toUpperCase()}`;

        const { error: tripError } = await supabase
          .from('driver_trips')
          .insert({
            driver_id: driverData.id,
            captain_request_id: deliveryId,
            status: 'assigned',
            customer_name: captainOrderDirect.customer_name || 'غير معروف',
            customer_phone: captainOrderDirect.customer_phone || '',
            pickup_address: captainOrderDirect.pickup_address || 'غير محدد',
            delivery_address: captainOrderDirect.delivery_address || 'غير محدد',
            total: fare,
            assigned_at: new Date().toISOString(),
            order_number: captainOrderNumber
          });

        if (tripError) {
          console.error('Error creating captain trip:', tripError);
          throw new Error('فشل في إنشاء الرحلة');
        }
      } else if (status === 'delivered') {
        const { error: updateError } = await supabase
          .from('captain_orders')
          .update({ status: 'delivered', delivered_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', deliveryId);

        if (updateError) throw updateError;

        await supabase
          .from('driver_trips')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('captain_request_id', deliveryId)
          .eq('driver_id', driverData.id);

        const commission = parseFloat((captainOrderDirect.delivery_fee || 0).toString());
        try {
          await addToDriverWallet(driverData.id, commission, null, 'عمولة طلب كابتن');
        } catch (walletError) {
          console.error('Error adding to wallet:', walletError);
        }
      }
      return;
    }

    // THIRD: Check if this is a parcel_order (not yet accepted)
    const { data: parcelOrder, error: parcelFetchError } = await supabase
      .from('parcel_orders')
      .select('*')
      .eq('id', deliveryId)
      .maybeSingle();

    if (parcelFetchError && parcelFetchError.code !== 'PGRST116') {
      console.error('❌ Error fetching parcel order:', parcelFetchError);
    }

    // If it's a parcel order (pending), accept it
    if (parcelOrder) {
      if (status === 'delivering') {
        // Accept the parcel order and assign to driver
        const { error: updateError } = await supabase
          .from('parcel_orders')
          .update({
            status: 'accepted',
            driver_id: driverData.id,
            accepted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', deliveryId)
          .eq('status', 'pending');

        if (updateError) {
          console.error('Error updating parcel order:', updateError);
          throw updateError;
        }

        // Create a driver trip entry for the parcel order
        const deliveryFee = parcelOrder.delivery_fee || 0;

        // Generate order number for parcel if not exists
        const parcelOrderNumber = parcelOrder.order_number || `P-${deliveryId.substring(0, 6).toUpperCase()}`;

        const { error: tripError } = await supabase
          .from('driver_trips')
          .insert({
            driver_id: driverData.id,
            parcel_order_id: deliveryId,
            status: 'assigned',
            customer_name: parcelOrder.sender_name || 'غير معروف',
            customer_phone: parcelOrder.sender_phone || '',
            pickup_address: parcelOrder.sender_address || 'غير محدد',
            delivery_address: parcelOrder.receiver_address || 'غير محدد',
            total: deliveryFee,
            assigned_at: new Date().toISOString(),
            order_number: parcelOrderNumber
          });

        if (tripError) {
          console.error('Error creating parcel trip:', tripError);
          throw new Error('فشل في إنشاء الرحلة');
        }
      } else if (status === 'delivered') {
        // Complete the parcel order
        const { data: orderData, error: fetchError } = await supabase
          .from('parcel_orders')
          .select('delivery_fee')
          .eq('id', deliveryId)
          .single();

        if (fetchError) {
          console.error('Error fetching parcel order:', fetchError);
          throw fetchError;
        }

        // Update parcel order status to delivered
        const { error: updateError } = await supabase
          .from('parcel_orders')
          .update({
            status: 'delivered',
            delivered_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', deliveryId);

        if (updateError) {
          console.error('Error completing parcel order:', updateError);
          throw updateError;
        }

        // Update driver_trips status to completed
        const { error: tripUpdateError } = await supabase
          .from('driver_trips')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('parcel_order_id', deliveryId)
          .eq('driver_id', driverData.id);

        if (tripUpdateError) {
          console.error('Error updating trip status:', tripUpdateError);
        }

        // Calculate delivery commission
        const deliveryFee = orderData.delivery_fee ? parseFloat(orderData.delivery_fee.toString()) : 0;
        // Add earnings to driver's wallet
        try {
          await addToDriverWallet(
            driverData.id,
            deliveryFee,
            null,
            'عمولة توصيل طرد'
          );
        } catch (walletError) {
          console.error('Error adding to wallet:', walletError);
        }
      }
      return;
    }

    // Otherwise, handle as regular waiting list entry
    const { data: waitingListEntry, error: fetchError } = await supabase
      .from('driver_waiting_list')
      .select('order_id, captain_order_id, parcel_order_id, vendor_id, customer_name, customer_phone, address, city, total, order_number, vendor:vendor_id(address)')
      .eq('id', deliveryId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('❌ Error fetching waiting list entry:', fetchError);
      throw new Error(`فشل في جلب بيانات الطلب: ${fetchError.message}`);
    }

    // Check if waiting list entry exists
    if (!waitingListEntry) {
      console.error('❌ Waiting list entry not found for ID:', deliveryId);
      throw new Error('لم يتم العثور على الطلب في قائمة الانتظار. قد يكون الطلب قد تم قبوله من قبل سائق آخر');
    }
    // Handle captain_order from waiting list
    if (!waitingListEntry.order_id && waitingListEntry.captain_order_id) {
      if (status === 'delivering') {
        const captainOrderId = waitingListEntry.captain_order_id;

        // Fetch captain_order details
        const { data: captainOrderData, error: captainOrderError } = await supabase
          .from('captain_orders')
          .select('*')
          .eq('id', captainOrderId)
          .maybeSingle();

        if (captainOrderError || !captainOrderData) {
          console.error('Error fetching captain_order:', captainOrderError);
          throw new Error('فشل في جلب بيانات الطلب');
        }

        // Accept captain_order
        const { error: updateCaptainError } = await supabase
          .from('captain_orders')
          .update({ status: 'accepted', driver_id: driverData.id, accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', captainOrderId);

        if (updateCaptainError) {
          throw new Error('فشل في قبول الطلب');
        }

        // Update waiting list
        await supabase
          .from('driver_waiting_list')
          .update({ status: 'accepted', driver_id: driverData.id, driver_name: driverData.name || 'Driver', updated_at: new Date().toISOString() })
          .eq('id', deliveryId);

        // Create driver trip
        const fare = captainOrderData.delivery_fee || waitingListEntry.total || 0;
        const captainOrderNumber = captainOrderData.order_number || waitingListEntry.order_number || `CAP-${captainOrderId.substring(0, 6).toUpperCase()}`;

        const { error: tripError } = await supabase
          .from('driver_trips')
          .insert({
            driver_id: driverData.id,
            captain_request_id: captainOrderId,
            status: 'assigned',
            customer_name: captainOrderData.customer_name || waitingListEntry.customer_name || 'غير معروف',
            customer_phone: captainOrderData.customer_phone || waitingListEntry.customer_phone || '',
            pickup_address: captainOrderData.pickup_address || 'غير محدد',
            delivery_address: captainOrderData.delivery_address || waitingListEntry.address || 'غير محدد',
            total: fare,
            assigned_at: new Date().toISOString(),
            order_number: captainOrderNumber
          });

        if (tripError) {
          console.error('Error creating captain trip:', tripError);
          throw new Error('فشل في إنشاء الرحلة');
        }
      }
      return;
    }

    // Handle parcel order from waiting list
    if (!waitingListEntry.order_id && waitingListEntry.parcel_order_id) {
      if (status === 'delivering') {
        const parcelId = waitingListEntry.parcel_order_id;

        const { data: parcelData, error: parcelDataError } = await supabase
          .from('parcel_orders')
          .select('*')
          .eq('id', parcelId)
          .maybeSingle();

        if (parcelDataError || !parcelData) {
          throw new Error('فشل في جلب بيانات طلب الطرد');
        }

        const { error: updateParcelError } = await supabase
          .from('parcel_orders')
          .update({ status: 'accepted', driver_id: driverData.id, accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', parcelId)
          .eq('status', 'pending');

        if (updateParcelError) {
          throw new Error('فشل في قبول طلب الطرد');
        }

        await supabase
          .from('driver_waiting_list')
          .update({ status: 'accepted', driver_id: driverData.id, driver_name: driverData.name || 'Driver', updated_at: new Date().toISOString() })
          .eq('id', deliveryId);

        const deliveryFee = parcelData.delivery_fee || waitingListEntry.total || 0;
        const parcelOrderNumber = parcelData.order_number || waitingListEntry.order_number || `P-${parcelId.substring(0, 6).toUpperCase()}`;

        const { error: tripError } = await supabase
          .from('driver_trips')
          .insert({
            driver_id: driverData.id,
            parcel_order_id: parcelId,
            status: 'assigned',
            customer_name: parcelData.sender_name || 'غير معروف',
            customer_phone: parcelData.sender_phone || '',
            pickup_address: parcelData.sender_address || 'غير محدد',
            delivery_address: parcelData.receiver_address || 'غير محدد',
            total: deliveryFee,
            assigned_at: new Date().toISOString(),
            order_number: parcelOrderNumber
          });

        if (tripError) {
          throw new Error('فشل في إنشاء الرحلة');
        }
      }
      return;
    }

    const orderID = waitingListEntry?.order_id;

    // Check if order_id is valid
    if (!orderID) {
      throw new Error('معرف الطلب غير صحيح أو مفقود');
    }

    // Verify the order exists in orders table
    const { data: orderExists, error: orderCheckError } = await supabase
      .from('orders')
      .select('id')
      .eq('id', orderID)
      .maybeSingle();

    if (orderCheckError) {
      console.error('❌ Error checking order existence:', orderCheckError);
      throw new Error('فشل في التحقق من وجود الطلب');
    }

    if (!orderExists) {
      console.error('❌ Order not found in orders table:', orderID);
      // Remove the orphaned entry from waiting list
      await supabase
        .from('driver_waiting_list')
        .delete()
        .eq('id', deliveryId);
      throw new Error('الطلب غير موجود أو تم حذفه. تم تنظيف البيانات.');
    }
    if (status === 'delivering') {
      // STEP 1: Update waiting list FIRST to mark as accepted and claim the order
      const { data: updatedData, error: updateError } = await supabase
        .from('driver_waiting_list')
        .update({
          status: 'accepted',
          driver_id: driverData.id,
          driver_name: driverData.name || 'Driver',
          updated_at: new Date().toISOString()
        })
        .eq('id', deliveryId)
        .eq('status', 'pending') // Only update if still pending (prevents double-acceptance)
        .select();

      if (updateError) {
        console.error('❌ Error updating driver_waiting_list:', updateError);
        throw new Error(`فشل في قبول الطلب: ${updateError.message}`);
      }

      // Check if any rows were updated
      if (!updatedData || updatedData.length === 0) {
        console.error('❌ No rows updated - order may already be accepted');
        throw new Error('هذا الطلب غير متاح. قد يكون قد تم قبوله من قبل سائق آخر');
      }
      // STEP 2: Create a new trip entry
      // Get order_number from orders table
      const { data: orderData, error: orderFetchError } = await supabase
        .from('orders')
        .select('order_number')
        .eq('id', orderID)
        .maybeSingle();

      if (orderFetchError) {
        console.error('❌ Error fetching order number:', orderFetchError);
      }

      // Prepare trip data with fallbacks
      const tripData = {
        order_id: orderID,
        order_number: orderData?.order_number || null,
        driver_id: driverData.id,
        status: 'assigned' as const,
        customer_name: waitingListEntry?.customer_name || 'عميل',
        pickup_address: waitingListEntry?.vendor?.address || 'غير محدد',
        delivery_address: waitingListEntry?.address || 'غير محدد',
        total: waitingListEntry?.total || 0
      };
      const { data: insertedTrip, error: tripError } = await supabase
        .from('driver_trips')
        .insert(tripData)
        .select()
        .single();

      if (tripError) {
        console.error('❌ Error creating trip:', tripError);
        console.error('Trip error details:', JSON.stringify(tripError, null, 2));
        // Rollback: revert waiting list status back to pending
        await supabase
          .from('driver_waiting_list')
          .update({
            status: 'pending',
            driver_id: null,
            driver_name: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', deliveryId);
        throw new Error(`فشل في إنشاء رحلة التوصيل: ${tripError.message}`);
      }

      // STEP 3: Update order status to 'picked_up' (تم استلام الطلب)
      if (orderID) {
        try {
          const { error: orderError } = await supabase
            .from('orders')
            .update({
              status: 'picked_up',
              driver_id: driverData.id,
              driver_name: driverData.name,
              updated_at: new Date().toISOString()
            })
            .eq('id', orderID);

          if (orderError) {
            console.error('Error updating orders table:', orderError);
            // Rollback: revert waiting list and trip
            await supabase
              .from('driver_waiting_list')
              .update({
                status: 'pending',
                driver_id: null,
                driver_name: null,
                updated_at: new Date().toISOString()
              })
              .eq('id', deliveryId);
            await supabase
              .from('driver_trips')
              .delete()
              .eq('order_id', orderID)
              .eq('driver_id', driverData.id);
            throw new Error(`فشل في تحديث حالة الطلب: ${orderError.message}`);
          } else {
            // Add status history entry
            try {
              const { error: historyError } = await supabase
                .from('order_status_history')
                .insert({
                  order_id: orderID,
                  status: 'picked_up',
                  created_by: driverData.user_id || null,
                  driver_name: driverData.name,
                  note: 'تم استلام الطلب من قبل السائق',
                  preparation_time_minutes: 0
                });

              if (historyError) {
                console.error('Error adding status history:', historyError);
              } else {
              }
            } catch (historyErr) {
              console.error('Error adding status history:', historyErr);
            }
          }
        } catch (err) {
          console.error('Error updating orders:', err);
          throw err;
        }
      }

      // STEP 4: Remove from waiting list now that order is accepted
      const { error: deleteError } = await supabase
        .from('driver_waiting_list')
        .delete()
        .eq('id', deliveryId);

      if (deleteError) {
        console.error('⚠️ Warning: Could not remove from waiting list:', deleteError);
        // Don't throw error here as order is already accepted
      } else {
      }
    } else if (status === 'delivered') {
      // Update trip status to completed
      const { error: tripError } = await supabase
        .from('driver_trips')
        .update({ status: 'completed' })
        .eq('order_id', orderID);

      if (tripError) {
        console.error('Error updating trip:', tripError);
      }
      
      // For delivery completion, update orders table
      if (orderID) {
        try {
          const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .update({
              status: 'completed',
              driver_id: driverData.id,
              driver_name: driverData.name
            })
            .eq('id', orderID)
            .select('delivery_fee, total')
            .single();
            
          if (orderError) {
            console.error('Error updating orders table:', orderError);
          } else {
            // Add status history entry for completion
            try {
              const { error: historyError } = await supabase
                .from('order_status_history')
                .insert({
                  order_id: orderID,
                  status: 'completed',
                  created_by: driverData.user_id || null,
                  driver_name: driverData.name,
                  note: 'تم توصيل الطلب للزبون بنجاح',
                  preparation_time_minutes: 0
                });
                
              if (historyError) {
                console.error('Error adding completion status history:', historyError);
              } else {
              }
            } catch (historyErr) {
              console.error('Error adding completion status history:', historyErr);
            }

            // حساب عمولة التوصيل الصحيحة
            let deliveryCommission = 0;
            
            // أولاً: محاولة الحصول على العمولة من جدول الطلبات
            if (orderData?.delivery_fee && orderData.delivery_fee > 0) {
              deliveryCommission = orderData.delivery_fee;
            } else {
              // ثانياً: حساب العمولة بناءً على قيمة الطلب
              const orderTotal = orderData?.total || waitingListEntry?.total || 0;
              deliveryCommission = calculateDeliveryCommission(orderTotal);
}
            // Add earnings to driver's wallet
            try {
              await addToDriverWallet(driverData.id, deliveryCommission, orderID, 'عمولة توصيل');
            } catch (walletError) {
              console.error('Error adding to wallet:', walletError);
              // Don't throw error here, order completion is more important
            }
          }
        } catch (err) {
          console.error('Error updating orders:', err);
        }
      }
      
      // Remove from waiting list
      const { error: deleteError } = await supabase
        .from('driver_waiting_list')
        .delete()
        .eq('id', deliveryId);
        
      if (deleteError) {
        console.error('Error deleting from driver_waiting_list:', deleteError);
        throw deleteError;
      } else {
      }
    }
    
  } catch (error) {
    console.error('Error updating delivery status:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to update delivery status');
  }
}

export async function getWalletBalance(): Promise<WalletBalance> {
  try {
    // Get driver information
    const driver = await getCurrentDriver();
    
    // Check if driver data is valid
    if (!driver || driver.status === 'unavailable' || !driver.id) {
      console.error('Driver not available for wallet lookup');
      throw new Error('لم يتم العثور على بيانات السائق');
    }
    // First, try to get existing wallet
    const { data: walletData, error: walletError } = await supabase
      .from('driver_wallets')
      .select('id, balance, total_earnings, total_withdrawals')
      .eq('driver_id', driver.id)
      .maybeSingle();

    // If we found a real wallet
    if (walletData) {
      // Get transactions (no broken join)
      const { data: transactions, error: txError } = await supabase
        .from('wallet_transactions')
        .select('id, amount, type, payment_type, description, created_at, order_id')
        .eq('wallet_id', walletData.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (txError) {
      }

      // Get settlements for this driver
      const { data: settlementsData, error: settlementsError } = await supabase
        .from('driver_settlements')
        .select('id, period_start, period_end, total_delivery_fees, driver_earnings, total_trips, is_settled, settlement_date, payment_method, settlement_notes')
        .eq('driver_id', driver.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (settlementsError) {
      }

      // Calculate delivery fees statistics
      const deliveryTransactions = (transactions || []).filter(
        tx => tx.type === 'credit' && tx.payment_type === 'commission'
      );

      const total_delivery_fees = deliveryTransactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      const completed_deliveries_count = deliveryTransactions.length;
      const average_commission = completed_deliveries_count > 0
        ? total_delivery_fees / completed_deliveries_count
        : 0;

      const transformedTransactions = (transactions || []).map(tx => ({
        id: tx.id,
        amount: Number(tx.amount),
        type: tx.type as 'credit' | 'debit',
        description: tx.description,
        created_at: tx.created_at,
        order_id: tx.order_id
      }));

      const transformedSettlements: DriverSettlement[] = (settlementsData || []).map(s => ({
        id: s.id,
        period_start: s.period_start,
        period_end: s.period_end,
        total_delivery_fees: Number(s.total_delivery_fees || 0),
        driver_earnings: Number(s.driver_earnings || 0),
        total_trips: s.total_trips || 0,
        is_settled: s.is_settled || false,
        settlement_date: s.settlement_date || undefined,
        payment_method: s.payment_method || undefined,
        settlement_notes: s.settlement_notes || undefined
      }));

      return {
        balance: Number(walletData.balance || 0),
        total_earnings: Number(walletData.total_earnings || 0),
        total_withdrawals: Number(walletData.total_withdrawals || 0),
        total_delivery_fees,
        completed_deliveries_count,
        average_commission,
        currency: 'ILS',
        transactions: transformedTransactions,
        settlements: transformedSettlements
      };
    }
    
    // If there was a specific error getting the wallet
    if (walletError && walletError.code !== 'PGRST116') {
      console.error('Error fetching wallet:', walletError);
      throw new Error('فشل في الوصول إلى المحفظة');
    }

    // No existing wallet found, create one
    try {
      const { data: newWallet, error: createError } = await supabase
        .from('driver_wallets')
        .insert({
          driver_id: driver.id,
          balance: 0,
          total_earnings: 0,
          total_withdrawals: 0
        })
        .select()
        .single();
        
      if (createError) {
        console.error('Error creating wallet:', createError);
        throw new Error('فشل في إنشاء محفظة جديدة');
      }
      
      if (newWallet) {
        return {
          balance: 0,
          total_earnings: 0,
          total_withdrawals: 0,
          total_delivery_fees: 0,
          completed_deliveries_count: 0,
          average_commission: 0,
          currency: 'ILS',
          transactions: [],
          settlements: []
        };
      }
    } catch (createErr) {
      console.error('Exception creating wallet:', createErr);
    }

    // Return empty wallet as fallback
    return {
      balance: 0,
      total_earnings: 0,
      total_withdrawals: 0,
      total_delivery_fees: 0,
      completed_deliveries_count: 0,
      average_commission: 0,
      currency: 'ILS',
      transactions: [],
      settlements: []
    };
  } catch (error) {
    console.error('Error in getWalletBalance:', error);
    throw error;
  }
}