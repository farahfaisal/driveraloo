import React, { createContext, useContext, useState, ReactNode } from 'react';

interface OrdersContextType {
  pendingOrdersCount: number;
  setPendingOrdersCount: (count: number) => void;
  activeOrdersCount: number;
  setActiveOrdersCount: (count: number) => void;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);

  return (
    <OrdersContext.Provider
      value={{
        pendingOrdersCount,
        setPendingOrdersCount,
        activeOrdersCount,
        setActiveOrdersCount,
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrders() {
  const context = useContext(OrdersContext);
  if (context === undefined) {
    throw new Error('useOrders must be used within an OrdersProvider');
  }
  return context;
}
