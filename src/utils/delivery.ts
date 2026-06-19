export interface DeliveryFeeConfig {
  baseDistance: number; // Distance covered by minimum fee in kilometers
  minimumFee: number;  // Minimum delivery fee in shekels
  ratePerKm: number;   // Additional fee per kilometer in shekels
}

export const DEFAULT_FEE_CONFIG: DeliveryFeeConfig = {
  baseDistance: 2, // First 2 kilometers
  minimumFee: 7,   // 7 shekels minimum
  ratePerKm: 3     // 3 shekels per additional kilometer
};

export function calculateDeliveryFee(
  distanceInKm: number,
  config: DeliveryFeeConfig = DEFAULT_FEE_CONFIG
): number {
  // Always charge minimum fee
  if (distanceInKm <= config.baseDistance) {
    return config.minimumFee;
  }

  // Calculate additional distance fee
  const additionalDistance = distanceInKm - config.baseDistance;
  const additionalFee = Math.ceil(additionalDistance) * config.ratePerKm;

  return config.minimumFee + additionalFee;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ar-PS', {
    style: 'currency',
    currency: 'ILS'
  }).format(amount);
}

export function formatOrderId(orderId: string | number): string {
  const orderIdStr = String(orderId);
  // Return last 4 digits of order ID
  return orderIdStr.slice(-4);
}

export function formatOrderType(orderType?: string): string {
  if (!orderType) return 'طلب توصيل';

  switch (orderType.toLowerCase()) {
    case 'parcel':
    case 'طرد':
      return 'توصيل طرد';
    case 'captain':
    case 'كابتن':
      return 'توصيل كابتن';
    case 'store':
    case 'متجر':
      return 'متجر';
    default:
      return orderType;
  }
}