export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      drivers: {
        Row: {
          id: string
          user_id: string
          name: string
          phone: string | null
          email: string | null
          status: 'offline' | 'available' | 'busy'
          rating: number
          rating_count: number
          commission_rate: number
          latitude: number | null
          longitude: number | null
          last_location_update: string | null
          created_at: string
          updated_at: string
          password?: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          phone?: string | null
          email?: string | null
          status?: 'offline' | 'available' | 'busy'
          rating?: number
          rating_count?: number
          commission_rate?: number
          latitude?: number | null
          longitude?: number | null
          last_location_update?: string | null
          created_at?: string
          updated_at?: string
          password?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          phone?: string | null
          email?: string | null
          status?: 'offline' | 'available' | 'busy'
          rating?: number
          rating_count?: number
          commission_rate?: number
          latitude?: number | null
          longitude?: number | null
          last_location_update?: string | null
          created_at?: string
          updated_at?: string
          password?: string
        }
      }
      custom_users: {
        Row: {
          id: string
          username: string
          password_hash: string
          name: string
          email: string | null
          phone: string | null
          role: string
          status: string
          created_at: string | null
          updated_at: string | null
          password: string | null
          last_login: string | null
        }
        Insert: {
          id?: string
          username: string
          password_hash: string
          name: string
          email?: string | null
          phone?: string | null
          role?: string
          status?: string
          created_at?: string | null
          updated_at?: string | null
          password?: string | null
          last_login?: string | null
        }
        Update: {
          id?: string
          username?: string
          password_hash?: string
          name?: string
          email?: string | null
          phone?: string | null
          role?: string
          status?: string
          created_at?: string | null
          updated_at?: string | null
          password?: string | null
          last_login?: string | null
        }
      }
      driver_wallets: {
        Row: {
          id: string
          driver_id: string
          balance: number
          total_earnings: number
          total_withdrawals: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          driver_id: string
          balance?: number
          total_earnings?: number
          total_withdrawals?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          driver_id?: string
          balance?: number
          total_earnings?: number
          total_withdrawals?: number
          created_at?: string
          updated_at?: string
        }
      }
      wallet_transactions: {
        Row: {
          id: string
          wallet_id: string
          amount: number
          type: 'credit' | 'debit'
          description: string
          order_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          wallet_id: string
          amount: number
          type: 'credit' | 'debit'
          description: string
          order_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          wallet_id?: string
          amount?: number
          type?: 'credit' | 'debit'
          description?: string
          order_id?: string | null
          created_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          customer_id: string | null
          vendor_id: string | null
          driver_id: string | null
          status: string
          total: number
          subtotal: number
          delivery_fee: number
          payment_method: string
          notes: string | null
          address: string | null
          latitude: number | null
          longitude: number | null
          created_at: string | null
          updated_at: string | null
          driver_name: string | null
        }
        Insert: {
          id?: string
          customer_id?: string | null
          vendor_id?: string | null
          driver_id?: string | null
          status?: string
          total?: number
          subtotal?: number
          delivery_fee?: number
          payment_method?: string
          notes?: string | null
          address?: string | null
          latitude?: number | null
          longitude?: number | null
          created_at?: string | null
          updated_at?: string | null
          driver_name?: string | null
        }
        Update: {
          id?: string
          customer_id?: string | null
          vendor_id?: string | null
          driver_id?: string | null
          status?: string
          total?: number
          subtotal?: number
          delivery_fee?: number
          payment_method?: string
          notes?: string | null
          address?: string | null
          latitude?: number | null
          longitude?: number | null
          created_at?: string | null
          updated_at?: string | null
          driver_name?: string | null
        }
      }
      driver_waiting_list: {
        Row: {
          id: string
          order_id: string
          vendor_id: string
          status: string
          created_at: string
          updated_at: string
          expires_at: string
          customer_name: string | null
          customer_phone: string | null
          address: string | null
          product_name: string | null
          quantity: number | null
          price: number | null
          total: number | null
          notes: string | null
          driver_id: string | null
          driver_name: string | null
        }
        Insert: {
          id?: string
          order_id: string
          vendor_id: string
          status?: string
          created_at?: string
          updated_at?: string
          expires_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          address?: string | null
          product_name?: string | null
          quantity?: number | null
          price?: number | null
          total?: number | null
          notes?: string | null
          driver_id?: string | null
          driver_name?: string | null
        }
        Update: {
          id?: string
          order_id?: string
          vendor_id?: string
          status?: string
          created_at?: string
          updated_at?: string
          expires_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          address?: string | null
          product_name?: string | null
          quantity?: number | null
          price?: number | null
          total?: number | null
          notes?: string | null
          driver_id?: string | null
          driver_name?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}