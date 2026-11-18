import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, BellOff, Check, Clock, Volume2, XCircle } from 'lucide-react';
import { subscribeOwnerOrders, updateOrderStatus } from '../../lib/firestoreService';
import { playOrderAlertChime } from '../../lib/sound';
import { Order, OrderStatus, Restaurant } from '../../types/menu';

interface LiveOrdersTabProps {
  restaurant: Restaurant;
}

const STATUS_LABELS: Record<OrderStatus, { label: string; colorClass: string }> = {
  pending: { label: 'قيد الانتظار', colorClass: 'text-amber-700 bg-amber-50 border-amber-200' },
  preparing: { label: 'جاري التحضير', colorClass: 'text-blue-700 bg-blue-50 border-blue-200' },
  completed: { label: 'مكتمل', colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  cancelled: { label: 'ملغي', colorClass: 'text-red-700 bg-red-50 border-red-200' },
};

export function LiveOrdersTab({ restaurant }: LiveOrdersTabProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | OrderStatus>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const initializedRef = useRef(false);
  const knownIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    initializedRef.current = false;
    knownIdsRef.current = new Set();

    const unsub = subscribeOwnerOrders(restaurant.id, restaurant.ownerId, (incoming) => {
      if (!initializedRef.current) {
        incoming.forEach((o) => knownIdsRef.current.add(o.id));
        initializedRef.current = true;
      } else {
        let hasNewPending = false;
        incoming.forEach((o) => {
          if (!knownIdsRef.current.has(o.id)) {
            knownIdsRef.current.add(o.id);
            if (o.status === 'pending') hasNewPending = true;
          }
        });
        if (hasNewPending && soundEnabled) {
          playOrderAlertChime();
        }
      }
      setOrders(incoming);
      setLoading(false);
    });

    return () => unsub();
  }, [restaurant.id, restaurant.ownerId, soundEnabled]);

  const filteredOrders = useMemo(() => {
    if (filterStatus === 'all') return orders;
    return orders.filter((o) => o.status === filterStatus);
  }, [orders, filterStatus]);

  const handleStatusChange = async (orderId: string, nextStatus: OrderStatus) => {
    setUpdatingId(orderId);
    try {
      await updateOrderStatus(orderId, nextStatus);
    } finally {
      setUpdatingId(null);
    }
  };

  const formatMoney = (val: number) => `${val.toFixed(2).replace(/\.00$/, '')} ${restaurant.currency}`;

  const pendingCount = orders.filter((o) => o.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-zinc-200 rounded-2xl p-5">
        <div>
          <h2 className="text-lg font-extrabold text-zinc-950">الطلبات الحية</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            استقبال فوري لطلبات العملاء مع تنبيه صوتي تلقائي عند وصول طلب جديد
            {pendingCount > 0 && (
              <span className="font-mono-num font-bold text-amber-700 mr-2">
                · {pendingCount} قيد الانتظار
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => playOrderAlertChime()}
            className="px-3.5 py-2 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50 flex items-center gap-1.5 cursor-pointer"
          >
            <Volume2 className="w-4 h-4" />
            <span>اختبار التنبيه</span>
          </button>
          <button
            type="button"
            onClick={() => setSoundEnabled((v) => !v)}
            className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
              soundEnabled
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-zinc-200 bg-zinc-50 text-zinc-500'
            }`}
          >
            {soundEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            <span>{soundEnabled ? 'التنبيه الصوتي مفعّل' : 'التنبيه مكتوم'}</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'all' as const, label: `الكل (${orders.length})` },
          { id: 'pending' as const, label: 'قيد الانتظار' },
          { id: 'preparing' as const, label: 'جاري التحضير' },
          { id: 'completed' as const, label: 'مكتمل' },
          { id: 'cancelled' as const, label: 'ملغي' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterStatus(tab.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer ${
              filterStatus === tab.id
                ? 'bg-zinc-950 text-white'
                : 'bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-950'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2].map((n) => (
            <div key={n} className="h-36 rounded-2xl bg-zinc-200/70" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center space-y-2">
          <Clock className="w-8 h-8 text-zinc-300 mx-auto" />
          <h3 className="text-base font-bold text-zinc-800">لا توجد طلبات في هذا التصنيف حالياً</h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
            عند إرسال أي عميل لطلب جديد من رابط المنيو العام (/menu/{restaurant.slug})، سيظهر هنا فوراً مع رنين التنبيه.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredOrders.map((order) => {
            const st = STATUS_LABELS[order.status] || STATUS_LABELS.pending;
            const isTerminal = order.status === 'completed' || order.status === 'cancelled';
            const typeLabel =
              order.orderType === 'dine_in'
                ? `صالة · طاولة ${order.tableNumber || '-'}`
                : order.orderType === 'delivery'
                  ? 'دليفري (توصيل)'
                  : 'استلام من الفرع';

            return (
              <article
                key={order.id}
                className="bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3 border-b border-zinc-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-num text-base font-extrabold text-zinc-950">
                          #{order.orderNumber}
                        </span>
                        <span className="text-xs text-zinc-500">· {typeLabel}</span>
                      </div>
                      <p className="text-xs text-zinc-600 mt-1">
                        {order.customerName} ·{' '}
                        <span className="font-mono-num">{order.customerPhone}</span>
                      </p>
                      {order.deliveryAddress && (
                        <p className="text-xs text-zinc-500 mt-0.5">
                          العنوان: {order.deliveryAddress}
                        </p>
                      )}
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-lg border text-xs font-bold shrink-0 ${st.colorClass}`}
                    >
                      {st.label}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {order.items.map((item, idx) => (
                      <div
                        key={`${order.id}_${idx}`}
                        className="flex items-start justify-between gap-3 text-xs"
                      >
                        <div>
                          <p className="font-bold text-zinc-900">
                            <span className="font-mono-num">{item.quantity}×</span> {item.name}
                            {item.sizeName ? ` (${item.sizeName})` : ''}
                          </p>
                          {item.addonNames?.length > 0 && (
                            <p className="text-zinc-500">+ {item.addonNames.join('، ')}</p>
                          )}
                          {item.notes && (
                            <p className="text-amber-700">ملاحظة: {item.notes}</p>
                          )}
                        </div>
                        <span className="font-mono-num font-semibold text-zinc-800 shrink-0">
                          {formatMoney(item.lineTotal)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {order.notes && (
                    <p className="text-xs text-amber-800 bg-amber-50/70 border border-amber-200/70 rounded-lg px-3 py-2">
                      ملاحظات العميل: {order.notes}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-zinc-100 space-y-3">
                  <div className="flex items-center justify-between text-xs text-zinc-600">
                    <span>
                      الضريبة: <span className="font-mono-num">{formatMoney(order.taxAmount)}</span>
                      {order.serviceCharge > 0 &&
                        ` · الخدمة: ${formatMoney(order.serviceCharge)}`}
                    </span>
                    <span className="text-sm font-extrabold text-zinc-950 font-mono-num">
                      الإجمالي: {formatMoney(order.total)}
                    </span>
                  </div>

                  {!isTerminal && (
                    <div className="flex flex-wrap items-center gap-2">
                      {order.status === 'pending' && (
                        <button
                          type="button"
                          disabled={updatingId === order.id}
                          onClick={() => handleStatusChange(order.id, 'preparing')}
                          className="flex-1 py-2 px-3 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 cursor-pointer disabled:opacity-50"
                        >
                          جاري التحضير
                        </button>
                      )}
                      {order.status === 'preparing' && (
                        <button
                          type="button"
                          disabled={updatingId === order.id}
                          onClick={() => handleStatusChange(order.id, 'completed')}
                          className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>مكتمل</span>
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={updatingId === order.id}
                        onClick={() => handleStatusChange(order.id, 'cancelled')}
                        className="py-2 px-3 rounded-xl border border-red-200 text-red-700 text-xs font-bold hover:bg-red-50 cursor-pointer flex items-center gap-1 disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>ملغي</span>
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
