import React, { useState, useEffect } from 'react';
import { Wallet as WalletIcon, ArrowDownCircle, ArrowUpCircle, Clock, TrendingUp, Package, DollarSign, CheckCircle, AlertCircle, Calendar, Banknote } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getWalletBalance, requestWithdrawal, DriverSettlement } from '../services/delivery';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatDateTime } from '../utils/date';
import { formatCurrency } from '../utils/delivery';
import toast from 'react-hot-toast';

export default function Wallet() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [withdrawalAmount, setWithdrawalAmount] = useState<string>('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [showWithdrawalForm, setShowWithdrawalForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'transactions' | 'settlements'>('transactions');
  const [walletData, setWalletData] = useState<{
    balance: number;
    total_earnings: number;
    total_withdrawals: number;
    total_delivery_fees: number;
    completed_deliveries_count: number;
    average_commission: number;
    transactions: Array<{
      id: string;
      amount: number;
      type: 'credit' | 'debit';
      description: string;
      created_at: string;
      order_id?: string;
    }>;
    settlements: DriverSettlement[];
  } | null>(null);

  useEffect(() => {
    loadWalletData();
    
    // Refresh wallet data every 30 seconds
    const interval = setInterval(loadWalletData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadWalletData = async () => {
    try {
      setError(null);
      const data = await getWalletBalance();
      setWalletData(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'حدث خطأ أثناء تحميل بيانات المحفظة';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdrawal = async () => {
    try {
      setIsWithdrawing(true);
      const amount = parseFloat(withdrawalAmount);
      
      if (isNaN(amount) || amount <= 0) {
        toast.error('يرجى إدخال مبلغ صحيح');
        return;
      }
      
      if (amount > (walletData?.balance || 0)) {
        toast.error('المبلغ المطلوب أكبر من الرصيد المتاح');
        return;
      }
      
      await requestWithdrawal(amount);
      toast.success('تم إرسال طلب السحب بنجاح');
      setWithdrawalAmount('');
      setShowWithdrawalForm(false);
      loadWalletData(); // Refresh wallet data
    } catch (error) {
      const message = error instanceof Error ? error.message : 'حدث خطأ أثناء طلب السحب';
      toast.error(message);
    } finally {
      setIsWithdrawing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <LoadingSpinner size="lg" color="emerald" />
          <p className="mt-4 text-gray-600">جاري تحميل بيانات المحفظة...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadWalletData}
            className="bg-red-100 text-red-600 px-4 py-2 rounded-lg hover:bg-red-200 transition-colors"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  if (!walletData) {
    return (
      <div className="p-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <WalletIcon className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
          <p className="text-yellow-700">لم يتم العثور على بيانات المحفظة</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50 min-h-screen pb-20" dir="rtl">
      <div className="bg-secondary-800/90 rounded-lg p-4 text-white mb-4">
        <h1 className="text-xl font-bold mb-1">المحفظة</h1>
        <p className="text-sm opacity-90">إدارة رصيدك وعرض المعاملات</p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-1">الرصيد الحالي</p>
          <p className="text-3xl font-bold text-primary-600">
            {formatCurrency(walletData.balance)}
          </p>
          
          <button
            onClick={() => setShowWithdrawalForm(true)}
            className="mt-4 btn-primary btn-hover-lift ripple"
          >
            طلب سحب
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="bg-emerald-50 rounded-lg p-3 text-center">
            <p className="text-sm text-emerald-600 mb-1">إجمالي المكتسبات</p>
            <p className="font-bold text-emerald-700">
              {formatCurrency(walletData.total_earnings)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-sm text-gray-600 mb-1">إجمالي السحوبات</p>
            <p className="font-bold text-gray-700">
              {formatCurrency(walletData.total_withdrawals)}
            </p>
          </div>
        </div>
      </div>

      {/* إحصائيات التوصيل */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          إحصائيات التوصيل
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <Package className="w-6 h-6 text-blue-600 mx-auto mb-2" />
            <p className="text-xs text-blue-600 mb-1">عدد التوصيلات</p>
            <p className="font-bold text-blue-700 text-lg">
              {walletData.completed_deliveries_count}
            </p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 text-center">
            <DollarSign className="w-6 h-6 text-yellow-600 mx-auto mb-2" />
            <p className="text-xs text-yellow-600 mb-1">رسوم التوصيل</p>
            <p className="font-bold text-yellow-700">
              {formatCurrency(walletData.total_delivery_fees)}
            </p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <TrendingUp className="w-6 h-6 text-purple-600 mx-auto mb-2" />
            <p className="text-xs text-purple-600 mb-1">متوسط العمولة</p>
            <p className="font-bold text-purple-700">
              {formatCurrency(walletData.average_commission)}
            </p>
          </div>
        </div>
      </div>

      {/* Withdrawal Form Modal */}
      {showWithdrawalForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
            <h3 className="text-xl font-bold mb-4">طلب سحب</h3>
            <p className="text-gray-600 mb-4">الرصيد المتاح: {formatCurrency(walletData.balance)}</p>
            
            <div className="mb-4">
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                المبلغ المطلوب سحبه
              </label>
              <input
                id="amount"
                type="number"
                value={withdrawalAmount}
                onChange={(e) => setWithdrawalAmount(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="أدخل المبلغ"
                min="1"
                max={walletData.balance}
                required
                disabled={isWithdrawing}
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleWithdrawal}
                disabled={isWithdrawing || !withdrawalAmount}
                className={`flex-1 py-2 rounded-lg text-white font-medium ${
                  isWithdrawing || !withdrawalAmount
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isWithdrawing ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>جاري الطلب...</span>
                  </div>
                ) : (
                  'تأكيد السحب'
                )}
              </button>
              <button
                onClick={() => setShowWithdrawalForm(false)}
                className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                disabled={isWithdrawing}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${
              activeTab === 'transactions'
                ? 'text-emerald-700 border-b-2 border-emerald-600 bg-emerald-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            سجل المعاملات
          </button>
          <button
            onClick={() => setActiveTab('settlements')}
            className={`flex-1 py-3 text-sm font-bold transition-colors flex items-center justify-center gap-1 ${
              activeTab === 'settlements'
                ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            التسويات
            {walletData.settlements.filter(s => !s.is_settled).length > 0 && (
              <span className="bg-amber-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {walletData.settlements.filter(s => !s.is_settled).length}
              </span>
            )}
          </button>
        </div>

        <div className="p-4">
          {/* Transactions Tab */}
          {activeTab === 'transactions' && (
            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {walletData.transactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  لا توجد معاملات حتى الآن
                </div>
              ) : (
                walletData.transactions.map(transaction => (
                  <div
                    key={transaction.id}
                    className="flex items-start border-b border-gray-100 pb-4 last:border-b-0 gap-3"
                  >
                    {/* المبلغ - يسار */}
                    <div className="shrink-0 text-left min-w-[80px]">
                      <span className={`font-bold text-base tabular-nums block ${
                        transaction.type === 'credit' ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {transaction.type === 'credit' ? '+' : '-'}{formatCurrency(transaction.amount)}
                      </span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {transaction.type === 'credit' ? 'إيداع' : 'سحب'}
                      </p>
                    </div>

                    {/* النص - يمين */}
                    <div className="flex-1 min-w-0 text-right">
                      <p className="font-medium text-gray-800">{transaction.description}</p>
                      <div className="flex items-center justify-end text-sm text-gray-500 mt-1 gap-1">
                        <span>{formatDateTime(transaction.created_at)}</span>
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                      </div>
                      {transaction.order_id && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          #{transaction.order_id.substring(0, 8)}
                        </p>
                      )}
                    </div>

                    {/* الأيقونة - أقصى اليمين */}
                    <div className="shrink-0 mt-0.5">
                      {transaction.type === 'credit' ? (
                        <ArrowDownCircle className="w-6 h-6 text-emerald-500" />
                      ) : (
                        <ArrowUpCircle className="w-6 h-6 text-red-500" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Settlements Tab */}
          {activeTab === 'settlements' && (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {walletData.settlements.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  لا توجد تسويات حتى الآن
                </div>
              ) : (
                walletData.settlements.map(settlement => (
                  <div
                    key={settlement.id}
                    className={`rounded-xl border p-4 ${
                      settlement.is_settled
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-amber-50 border-amber-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        <span dir="ltr">{new Date(settlement.period_start).toLocaleDateString('ar')} — {new Date(settlement.period_end).toLocaleDateString('ar')}</span>
                      </div>
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold ${
                        settlement.is_settled
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {settlement.is_settled ? 'تمت التسوية' : 'في الانتظار'}
                        {settlement.is_settled
                          ? <CheckCircle className="w-3.5 h-3.5" />
                          : <AlertCircle className="w-3.5 h-3.5" />
                        }
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="bg-white/70 rounded-lg p-2">
                        <p className="text-xs text-gray-500 mb-0.5 text-right">رسوم التوصيل</p>
                        <p className="font-bold text-sm text-gray-800 text-left tabular-nums">{formatCurrency(settlement.total_delivery_fees)}</p>
                      </div>
                      <div className="bg-white/70 rounded-lg p-2">
                        <p className="text-xs text-gray-500 mb-0.5 text-right">أرباحك</p>
                        <p className="font-bold text-sm text-emerald-700 text-left tabular-nums">{formatCurrency(settlement.driver_earnings)}</p>
                      </div>
                      <div className="bg-white/70 rounded-lg p-2">
                        <p className="text-xs text-gray-500 mb-0.5 text-right">عدد الرحلات</p>
                        <p className="font-bold text-sm text-blue-700 text-left tabular-nums">{settlement.total_trips}</p>
                      </div>
                    </div>

                    {settlement.is_settled && settlement.settlement_date && (
                      <div className="flex items-center justify-end gap-1.5 text-xs text-emerald-600 border-t border-emerald-200 pt-2">
                        {settlement.payment_method && <span>{settlement.payment_method} —</span>}
                        <span>تمت التسوية في {new Date(settlement.settlement_date).toLocaleDateString('ar')}</span>
                        <Banknote className="w-3.5 h-3.5" />
                      </div>
                    )}
                    {settlement.settlement_notes && (
                      <p className="text-xs text-gray-500 mt-1 border-t border-gray-100 pt-1 text-right">{settlement.settlement_notes}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}