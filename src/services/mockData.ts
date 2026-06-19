// Mock data for the delivery app
export const MOCK_DELIVERIES = [
  {
    id: 1,
    order_id: 1001,
    status: 'pending',
    customer_name: 'أحمد محمد',
    customer_phone: '0599123456',
    order_type: 'توصيل طعام',
    pickup_location: 'مطعم السلطان، شارع أبو بكر، جنين',
    delivery_location: 'حي الجابريات، جنين',
    created_at: new Date(Date.now() - 30 * 60000).toISOString(),
    preparation_time: 20,
    actual_preparation_time: 20,
    preparation_start: new Date(Date.now() - 15 * 60000).toISOString(),
    preparation_end: new Date(Date.now() + 5 * 60000).toISOString(),
    store_info: {
      name: 'مطعم السلطان',
      phone: '042987654',
      address: 'شارع أبو بكر، جنين'
    },
    delivery_fee: 15.00,
    total_amount: 145.00,
    week_number: getCurrentWeekNumber()
  },
  {
    id: 2,
    order_id: 1002,
    status: 'delivering',
    customer_name: 'سارة خالد',
    customer_phone: '0599789012',
    order_type: 'توصيل طلبية',
    pickup_location: 'سوبرماركت الهدى، وسط البلد، جنين',
    delivery_location: 'حي البساتين، جنين',
    created_at: new Date(Date.now() - 45 * 60000).toISOString(),
    preparation_time: 15,
    actual_preparation_time: 15,
    preparation_start: new Date(Date.now() - 45 * 60000).toISOString(),
    preparation_end: new Date(Date.now() - 30 * 60000).toISOString(),
    store_info: {
      name: 'سوبرماركت الهدى',
      phone: '042987655',
      address: 'وسط البلد، جنين'
    },
    delivery_fee: 12.00,
    total_amount: 85.50,
    week_number: getCurrentWeekNumber()
  },
  {
    id: 3,
    order_id: 1003,
    status: 'delivered',
    customer_name: 'محمود عبد الله',
    customer_phone: '0599345678',
    order_type: 'توصيل طعام',
    pickup_location: 'مطعم زمن، شارع حيفا، جنين',
    delivery_location: 'مخيم جنين',
    created_at: new Date(Date.now() - 120 * 60000).toISOString(),
    preparation_time: 25,
    actual_preparation_time: 25,
    preparation_start: new Date(Date.now() - 120 * 60000).toISOString(),
    preparation_end: new Date(Date.now() - 95 * 60000).toISOString(),
    store_info: {
      name: 'مطعم زمن',
      phone: '042987656',
      address: 'شارع حيفا، جنين'
    },
    delivery_fee: 18.00,
    total_amount: 165.00,
    week_number: getCurrentWeekNumber()
  },
  {
    id: 4,
    order_id: 1004,
    status: 'pending',
    customer_name: 'رامي حسن',
    customer_phone: '0599567890',
    order_type: 'توصيل طعام',
    pickup_location: 'مطعم القدس، وسط البلد، جنين',
    delivery_location: 'قباطية',
    created_at: new Date(Date.now() - 15 * 60000).toISOString(),
    preparation_time: 30,
    actual_preparation_time: 30,
    preparation_start: new Date(Date.now() - 10 * 60000).toISOString(),
    preparation_end: new Date(Date.now() + 20 * 60000).toISOString(),
    store_info: {
      name: 'مطعم القدس',
      phone: '042987657',
      address: 'وسط البلد، جنين'
    },
    delivery_fee: 25.00,
    total_amount: 220.00,
    week_number: getCurrentWeekNumber()
  },
  {
    id: 5,
    order_id: 1005,
    status: 'delivering',
    customer_name: 'ليلى عمر',
    customer_phone: '0599123789',
    order_type: 'توصيل طلبية',
    pickup_location: 'سوبرماركت النجمة، جنين',
    delivery_location: 'يعبد',
    created_at: new Date(Date.now() - 60 * 60000).toISOString(),
    preparation_time: 10,
    actual_preparation_time: 10,
    preparation_start: new Date(Date.now() - 60 * 60000).toISOString(),
    preparation_end: new Date(Date.now() - 50 * 60000).toISOString(),
    store_info: {
      name: 'سوبرماركت النجمة',
      phone: '042987658',
      address: 'شارع الناصرة، جنين'
    },
    delivery_fee: 20.00,
    total_amount: 350.00,
    week_number: getCurrentWeekNumber()
  }
];

export const MOCK_WALLET_DATA = {
  balance: 85.50,
  currency: 'ILS',
  current_week: getCurrentWeekNumber(),
  transactions: [
    {
      id: 1,
      amount: 165.00,
      type: 'debit',
      description: 'تحصيل مبلغ الطلب #1003',
      created_at: new Date(Date.now() - 120 * 60000).toISOString(),
      order_id: 1003,
      week_number: getCurrentWeekNumber()
    },
    {
      id: 2,
      amount: 18.00,
      type: 'credit',
      description: 'عمولة توصيل طلب #1003',
      created_at: new Date(Date.now() - 120 * 60000).toISOString(),
      order_id: 1003,
      week_number: getCurrentWeekNumber()
    }
  ]
};

export const MOCK_DRIVER_STATUS = {
  is_available: true,
  last_updated: new Date().toISOString()
};

// Helper function to get current week number
function getCurrentWeekNumber(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  const oneWeek = 1000 * 60 * 60 * 24 * 7;
  return Math.floor(diff / oneWeek);
}