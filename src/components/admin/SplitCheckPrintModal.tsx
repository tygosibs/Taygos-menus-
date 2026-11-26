import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Layers,
  Loader2,
  Printer,
  Scissors,
  Settings,
  X,
} from 'lucide-react';
import {
  Category,
  MenuItem,
  Order,
  OrderItemPayload,
  Restaurant,
} from '../../types/menu';
import {
  getStationIconComponent,
  resolveOrderItemStation,
  StationMeta,
} from '../../lib/stationUtils';
import {
  buildCombinedOrderReceiptJob,
  buildStationTicketJob,
  PrintableTicketJob,
  printThermalJobsSequentially,
} from '../../lib/thermalPrinterService';
import { useLanguage } from '../../contexts/LanguageContext';

interface SplitCheckPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  restaurant: Restaurant;
  stations: StationMeta[];
  itemsMap: Map<string, MenuItem>;
  categoriesMap: Map<string, Category>;
  onOpenPrinterSettings?: () => void;
}

export const SplitCheckPrintModal: React.FC<SplitCheckPrintModalProps> = ({
  isOpen,
  onClose,
  order,
  restaurant,
  stations,
  itemsMap,
  categoriesMap,
  onOpenPrinterSettings,
}) => {
  const { lang, dir, loc, formatCurrency } = useLanguage();
  const isEn = lang === 'en';
  const [includePricesOnCombined, setIncludePricesOnCombined] = useState(true);
  const [printingKey, setPrintingKey] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const stationBuckets = useMemo(() => {
    if (!order) return [];
    const stationsById = new Map<string, StationMeta>(stations.map((s) => [s.stationId, s]));
    const grouped = new Map<string, { meta: StationMeta; items: OrderItemPayload[] }>();

    order.items.forEach((it) => {
      const stId = resolveOrderItemStation(it, itemsMap, categoriesMap, stations[0]?.stationId || 'kitchen');
      const existing = grouped.get(stId);
      if (existing) {
        existing.items.push(it);
      } else {
        const meta: StationMeta = stationsById.get(stId) || {
          id: stId,
          stationId: stId,
          label: it.stationName || stId,
          label_en: stId,
          shortLabel: it.stationName || stId,
          shortLabel_en: stId,
          color: '#EA580C',
          icon: 'chef-hat',
          badgeClass: 'bg-zinc-100 text-zinc-900 border-zinc-200',
          screenType: 'prep',
          isActive: true,
          isArchived: false,
          isDefaultFallback: false,
          showPrices: false,
          allowedOrderTypes: ['dine_in', 'pickup', 'delivery'],
          soundAlertEnabled: true,
          overdueAlertMinutes: 15,
          thermalPrintMode: 'manual',
          availableStatusButtons: ['preparing', 'ready', 'served'],
          assignedHallIds: [],
          assignedTableNumbers: [],
          tableVisibilityScope: 'all',
          sortOrder: 999,
        };
        grouped.set(stId, { meta, items: [it] });
      }
    });

    return Array.from(grouped.values()).sort(
      (a, b) => (a.meta.sortOrder ?? 999) - (b.meta.sortOrder ?? 999)
    );
  }, [order, stations, itemsMap, categoriesMap]);

  if (!isOpen || !order) return null;

  const currencyLabel = formatCurrency(restaurant.currency);

  const runPrint = async (key: string, jobs: PrintableTicketJob[], label: string) => {
    setPrintingKey(key);
    setToastMsg('');
    setErrorMsg('');
    try {
      const res = await printThermalJobsSequentially(jobs, { lang });
      setToastMsg(
        res.mode === 'hardware'
          ? isEn
            ? `Printed "${label}" (${res.count} tickets) sequentially to thermal printer.`
            : `تمت طباعة "${label}" (${res.count} تذكرة) على الطابعة الحرارية بالتتابع.`
          : isEn
            ? `Prepared "${label}" (${res.count} tickets) for browser thermal printing.`
            : `تم تجهيز "${label}" (${res.count} تذكرة) للطباعة الحرارية عبر المتصفح.`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Unable to complete printing.'
            : 'تعذر إتمام الطباعة.'
      );
    } finally {
      setPrintingKey(null);
    }
  };

  const handlePrintCombinedOnly = () => {
    const combinedJob = buildCombinedOrderReceiptJob({
      restaurant,
      order,
      currencyLabel,
      includePrices: includePricesOnCombined,
      includeSeparateChecks: true,
      lang,
    });
    void runPrint('combined', [combinedJob], isEn ? 'Consolidated Check Only' : 'الأوردر المجمع فقط');
  };

  const handlePrintSingleStation = (bucket: { meta: StationMeta; items: OrderItemPayload[] }) => {
    const stationName = loc(bucket.meta.shortLabel, bucket.meta.shortLabel_en);
    const job = buildStationTicketJob({
      restaurant,
      order,
      station: bucket.meta,
      stationItems: bucket.items,
      lang,
    });
    void runPrint(
      bucket.meta.stationId,
      [job],
      isEn ? `${stationName} Ticket` : `تذكرة ${stationName}`
    );
  };

  const handlePrintAll = () => {
    const combinedJob = buildCombinedOrderReceiptJob({
      restaurant,
      order,
      currencyLabel,
      includePrices: includePricesOnCombined,
      includeSeparateChecks: true,
      lang,
    });
    const stationJobs = stationBuckets.map((b) =>
      buildStationTicketJob({
        restaurant,
        order,
        station: b.meta,
        stationItems: b.items,
        lang,
      })
    );
    void runPrint(
      'all',
      [combinedJob, ...stationJobs],
      isEn ? 'Consolidated Check + All Stations' : 'الطلب المجمع + جميع الأقسام'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl" dir={dir}>
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div className="flex items-center gap-2">
            <Scissors className="h-5 w-5 text-orange-600" />
            <div>
              <h4 className="text-base font-extrabold text-zinc-900">
                {isEn ? 'Split Check & Station Ticket Printing' : 'تقسيم الشيك والطباعة حسب الأقسام'}
              </h4>
              <p className="text-[11px] font-bold text-zinc-500">
                {isEn ? 'Order' : 'طلب'} <span className="font-mono-num">#{order.orderNumber}</span> ·{' '}
                {order.orderType === 'dine_in'
                  ? `${order.hallName || (isEn ? 'Hall' : 'صالة')} - ${
                      isEn ? 'Table' : 'طاولة'
                    } ${order.tableNumber || '-'}`
                  : order.customerName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onOpenPrinterSettings && (
              <button
                type="button"
                onClick={onOpenPrinterSettings}
                className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 px-2.5 py-1.5 text-[11px] font-bold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
              >
                <Settings className="h-3.5 w-3.5" />
                {isEn ? 'Printer' : 'الطابعة'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label={isEn ? 'Close' : 'إغلاق'}
              className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {/* Primary actions: Combined + Print All */}
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3.5 space-y-3">
            <label className="flex items-center gap-2 text-xs font-bold text-zinc-800 cursor-pointer">
              <input
                type="checkbox"
                checked={includePricesOnCombined}
                onChange={(e) => setIncludePricesOnCombined(e.target.checked)}
                className="h-4 w-4 rounded accent-zinc-900"
              />
              {isEn
                ? 'Show prices and check breakdown on the "Consolidated Check" ticket'
                : 'إظهار الأسعار وتفاصيل الفاتورة في تذكرة "الأوردر الأساسي المجمع"'}
            </label>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={printingKey !== null}
                onClick={handlePrintCombinedOnly}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-xs font-extrabold text-zinc-900 hover:bg-zinc-100 disabled:opacity-50 cursor-pointer"
              >
                {printingKey === 'combined' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
                {isEn ? 'Print Consolidated Check Only' : 'طباعة الأوردر المجمع فقط'}
              </button>

              <button
                type="button"
                disabled={printingKey !== null}
                onClick={handlePrintAll}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
              >
                {printingKey === 'all' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Layers className="h-4 w-4" />
                )}
                {isEn
                  ? `Print All (${stationBuckets.length + 1} Tickets)`
                  : `طباعة الكل (${stationBuckets.length + 1} تذاكر بالتتابع)`}
              </button>
            </div>
          </div>

          {/* Dynamic stations present in order */}
          <div>
            <div className="mb-2 text-xs font-extrabold text-zinc-700">
              {isEn
                ? `Stations Involved in This Order (${stationBuckets.length}):`
                : `الأقسام المشاركة في هذا الطلب (${stationBuckets.length}):`}
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto pe-0.5">
              {stationBuckets.map((bucket) => {
                const IconComp = getStationIconComponent(bucket.meta.icon);
                const qtySum = bucket.items.reduce((s, it) => s + (it.quantity || 1), 0);
                return (
                  <div
                    key={bucket.meta.stationId}
                    className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-white"
                          style={{ backgroundColor: bucket.meta.color }}
                        >
                          <IconComp className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-xs font-extrabold text-zinc-900">
                          {loc(bucket.meta.shortLabel, bucket.meta.shortLabel_en)}
                        </span>
                        <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-700 font-mono-num">
                          {isEn ? `${qtySum} items` : `${qtySum} صنف`}
                        </span>
                      </div>
                      <div className="mt-1.5 space-y-0.5 text-[11px] text-zinc-600">
                        {bucket.items.map((it, idx) => (
                          <div key={idx} className="truncate">
                            • {it.quantity}× {it.name}
                            {it.sizeName ? ` (${it.sizeName})` : ''}
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={printingKey !== null}
                      onClick={() => handlePrintSingleStation(bucket)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs font-extrabold text-zinc-900 hover:bg-zinc-900 hover:text-white disabled:opacity-50 cursor-pointer"
                    >
                      {printingKey === bucket.meta.stationId ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Printer className="h-3.5 w-3.5" />
                      )}
                      {isEn ? 'Print' : 'طباعة'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {toastMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{toastMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-800">
              {errorMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
