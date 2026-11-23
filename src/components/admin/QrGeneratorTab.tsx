import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Check,
  Copy,
  Download,
  Edit3,
  Grid,
  Layers,
  Loader2,
  MapPin,
  Plus,
  Printer,
  QrCode,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { deleteHall, getHallTableNumbers, saveHall, subscribeHalls } from '../../lib/firestoreService';
import {
  resolveRestaurantShareDescription,
  resolveRestaurantShareTitle,
} from '../../lib/seoHead';
import { Hall, Restaurant } from '../../types/menu';
import { SafeImage } from '../SafeImage';
import { SharePreviewCard } from '../SharePreviewCard';

interface QrGeneratorTabProps {
  restaurant: Restaurant;
}

interface GeneratedTableQr {
  tableNum: string;
  url: string;
  dataUrl: string;
}

const HALL_PRESETS: Array<{ name: string; name_en: string; hallType: string; tableCount: number }> = [
  { name: 'الصالة الرئيسية', name_en: 'Main Hall', hallType: 'صالة داخلية', tableCount: 12 },
  { name: 'الدور الثاني', name_en: 'Second Floor', hallType: 'دور علوي', tableCount: 10 },
  { name: 'التراس الخارجي', name_en: 'Outdoor Terrace', hallType: 'تراس خارجي', tableCount: 8 },
  { name: 'قسم العائلات VIP', name_en: 'VIP Family Section', hallType: 'قسم عائلات VIP', tableCount: 6 },
];

function buildRangeCsv(count: number, skip13 = false): string {
  const safe = Math.max(1, Math.min(200, Math.round(Number(count) || 1)));
  const nums: string[] = [];
  for (let i = 1; i <= safe; i++) {
    if (skip13 && i === 13) continue;
    nums.push(String(i));
  }
  return nums.join(', ');
}

function parseTableNumbersCsv(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[,،\n\s]+/)
        .map((s) => s.trim().slice(0, 20))
        .filter((s) => s.length > 0)
    )
  ).slice(0, 200);
}

export function QrGeneratorTab({ restaurant }: QrGeneratorTabProps) {
  const { lang, dir, t, loc } = useLanguage();
  const isEn = lang === 'en';

  const [halls, setHalls] = useState<Hall[]>([]);
  const [selectedHallId, setSelectedHallId] = useState<string>('');
  const [bulkCountInput, setBulkCountInput] = useState<number>(10);
  const [generatedTables, setGeneratedTables] = useState<GeneratedTableQr[]>([]);
  const [generatingBulk, setGeneratingBulk] = useState(false);
  const [bulkCopiedNum, setBulkCopiedNum] = useState<string | null>(null);
  const [printTarget, setPrintTarget] = useState<'single' | 'bulk'>('single');

  // Hall modal state
  const [hallModalOpen, setHallModalOpen] = useState(false);
  const [editingHall, setEditingHall] = useState<Hall | null>(null);
  const [hallNameInput, setHallNameInput] = useState('');
  const [hallNameEnInput, setHallNameEnInput] = useState('');
  const [hallTypeInput, setHallTypeInput] = useState('');
  const [hallTablesInput, setHallTablesInput] = useState(10);
  const [tableNumbersText, setTableNumbersText] = useState('1, 2, 3, 4, 5, 6, 7, 8, 9, 10');
  const [savingHall, setSavingHall] = useState(false);
  const [hallError, setHallError] = useState<string | null>(null);

  // Single QR state
  const [hallLabel, setHallLabel] = useState('');
  const [hallTypeSingleLabel, setHallTypeSingleLabel] = useState('');
  const [tableLabel, setTableLabel] = useState('');
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    const unsub = subscribeHalls(
      restaurant.id,
      (list) => {
        setHalls(list);
        setSelectedHallId((prev) => {
          if (prev && list.some((h) => h.id === prev)) return prev;
          return list[0]?.id || '';
        });
      },
      () => {
        // Silent degrade if permissions/index issue
      }
    );
    return () => unsub();
  }, [restaurant.id]);

  const activeHall = useMemo(
    () => halls.find((h) => h.id === selectedHallId) || null,
    [halls, selectedHallId]
  );

  useEffect(() => {
    if (activeHall) {
      setBulkCountInput(getHallTableNumbers(activeHall).length);
      setHallLabel(activeHall.name);
      setHallTypeSingleLabel(activeHall.hallType || '');
    }
  }, [activeHall]);

  const buildTableUrl = useCallback(
    (hallNameVal: string, tableNumVal: string) => {
      const params = new URLSearchParams();
      if (hallNameVal.trim()) params.set('hall', hallNameVal.trim());
      if (tableNumVal.trim()) params.set('table', tableNumVal.trim());
      const qs = params.toString();
      return qs ? `${origin}/menu/${restaurant.slug}?${qs}` : `${origin}/menu/${restaurant.slug}`;
    },
    [origin, restaurant.slug]
  );

  const generateBulkTables = useCallback(
    async (hallNameVal: string, tableNumbers: string[]) => {
      const safeNums =
        tableNumbers.length > 0 ? tableNumbers.slice(0, 200) : ['1'];
      setGeneratingBulk(true);
      try {
        const results: GeneratedTableQr[] = [];
        const BATCH = 12;
        for (let start = 0; start < safeNums.length; start += BATCH) {
          const slice = safeNums.slice(start, start + BATCH);
          const chunk = await Promise.all(
            slice.map(async (numStr) => {
              const url = buildTableUrl(hallNameVal, numStr);
              const dataUrl = await QRCode.toDataURL(url, {
                width: 340,
                margin: 2,
                color: { dark: '#09090B', light: '#FFFFFF' },
              });
              return {
                tableNum: numStr,
                url,
                dataUrl,
              };
            })
          );
          results.push(...chunk);
        }
        setGeneratedTables(results);
      } finally {
        setGeneratingBulk(false);
      }
    },
    [buildTableUrl]
  );

  // Auto-render bulk grid whenever active hall switches
  useEffect(() => {
    if (!activeHall) {
      setGeneratedTables([]);
      return;
    }
    void generateBulkTables(activeHall.name, getHallTableNumbers(activeHall));
  }, [activeHall, generateBulkTables]);

  const handleBulkGenerateAndSave = async () => {
    const safeCount = Math.max(1, Math.min(200, Math.round(Number(bulkCountInput) || 1)));
    setBulkCountInput(safeCount);
    if (activeHall) {
      const existingNums = getHallTableNumbers(activeHall);
      const hadSkip13 = existingNums.length >= 13 && !existingNums.includes('13');
      const nextNums = parseTableNumbersCsv(buildRangeCsv(safeCount, hadSkip13));
      if (safeCount !== existingNums.length) {
        try {
          await saveHall(restaurant.id, restaurant.ownerId, {
            id: activeHall.id,
            name: activeHall.name,
            name_en: activeHall.name_en,
            hallType: activeHall.hallType,
            tableCount: nextNums.length,
            tableNumbers: nextNums,
            sortOrder: activeHall.sortOrder,
          });
        } catch {
          // Still render QR codes locally even if transient error
        }
      }
      await generateBulkTables(activeHall.name, nextNums);
    } else {
      await generateBulkTables(
        hallLabel.trim(),
        parseTableNumbersCsv(buildRangeCsv(safeCount, false))
      );
    }
  };

  const openNewHallModal = (preset?: {
    name: string;
    name_en: string;
    hallType: string;
    tableCount: number;
  }) => {
    const count = preset?.tableCount || 10;
    setEditingHall(null);
    setHallNameInput(preset?.name || '');
    setHallNameEnInput(preset?.name_en || '');
    setHallTypeInput(preset?.hallType || '');
    setHallTablesInput(count);
    setTableNumbersText(buildRangeCsv(count, false));
    setHallError(null);
    setHallModalOpen(true);
  };

  const openEditHallModal = (hall: Hall) => {
    const nums = getHallTableNumbers(hall);
    setEditingHall(hall);
    setHallNameInput(hall.name);
    setHallNameEnInput(hall.name_en || '');
    setHallTypeInput(hall.hallType || '');
    setHallTablesInput(nums.length);
    setTableNumbersText(nums.join(', '));
    setHallError(null);
    setHallModalOpen(true);
  };

  const handleToggleSkip13InModal = () => {
    const current = parseTableNumbersCsv(tableNumbersText);
    if (current.includes('13')) {
      const filtered = current.filter((n) => n !== '13');
      setTableNumbersText(filtered.join(', '));
      setHallTablesInput(filtered.length);
    } else {
      const added = [...current, '13'].sort((a, b) => {
        const na = Number(a);
        const nb = Number(b);
        if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
        return a.localeCompare(b);
      });
      setTableNumbersText(added.join(', '));
      setHallTablesInput(added.length);
    }
  };

  const handleSaveHall = async (e: FormEvent) => {
    e.preventDefault();
    if (!hallNameInput.trim()) return;
    setSavingHall(true);
    setHallError(null);
    try {
      const parsedNums = parseTableNumbersCsv(tableNumbersText);
      const count =
        parsedNums.length > 0
          ? parsedNums.length
          : Math.max(1, Math.min(200, Math.round(Number(hallTablesInput) || 1)));
      const finalNums =
        parsedNums.length > 0 ? parsedNums : parseTableNumbersCsv(buildRangeCsv(count, false));
      await saveHall(restaurant.id, restaurant.ownerId, {
        id: editingHall?.id,
        name: hallNameInput.trim(),
        name_en: hallNameEnInput.trim(),
        hallType: hallTypeInput.trim(),
        tableCount: finalNums.length,
        tableNumbers: finalNums,
        sortOrder: editingHall?.sortOrder ?? halls.length + 1,
      });
      setHallModalOpen(false);
    } catch (err) {
      setHallError(err instanceof Error ? err.message : t.auth.errGeneric);
    } finally {
      setSavingHall(false);
    }
  };

  const handleQuickCreatePreset = async (preset: {
    name: string;
    name_en: string;
    hallType: string;
    tableCount: number;
  }) => {
    setSavingHall(true);
    try {
      await saveHall(restaurant.id, restaurant.ownerId, {
        name: preset.name,
        name_en: preset.name_en,
        hallType: preset.hallType,
        tableCount: preset.tableCount,
        tableNumbers: parseTableNumbersCsv(buildRangeCsv(preset.tableCount, false)),
        sortOrder: halls.length + 1,
      });
    } finally {
      setSavingHall(false);
    }
  };

  const targetUrl = buildTableUrl(hallLabel, tableLabel);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, targetUrl, {
      width: 240,
      margin: 2,
      color: {
        dark: '#09090B',
        light: '#FFFFFF',
      },
    }).catch((err) => console.error('QR generation failed:', err));
  }, [targetUrl]);

  const handleDownloadPng = async () => {
    const dataUrl = await QRCode.toDataURL(targetUrl, {
      width: 900,
      margin: 2,
      color: { dark: '#09090B', light: '#FFFFFF' },
    });
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `qr-${restaurant.slug}${tableLabel ? `-table-${tableLabel}` : ''}.png`;
    link.click();
  };

  const handleDownloadSvg = async () => {
    const svg = await QRCode.toString(targetUrl, {
      type: 'svg',
      margin: 2,
      color: { dark: '#09090B', light: '#FFFFFF' },
    });
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `qr-${restaurant.slug}${tableLabel ? `-table-${tableLabel}` : ''}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handlePrintMode = (mode: 'single' | 'bulk') => {
    setPrintTarget(mode);
    window.setTimeout(() => {
      window.print();
    }, 80);
  };

  const displayName = loc(restaurant.name, restaurant.name_en);
  const activeBulkHallLabel = activeHall ? loc(activeHall.name, activeHall.name_en) : hallLabel.trim();

  return (
    <div className="space-y-6">
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-zinc-950">{t.admin.qr.title}</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {isEn
              ? 'Divide your restaurant into named Dining Halls, auto-generate QR codes for any number of tables, and print cut-ready table sheets.'
              : 'قسّم مطعمك إلى صالات بأسماء مخصصة، وولّد أكواد QR لأي عدد من الترابيزات بضغطة زر مع طباعة جماعية جاهزة للقص.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => openNewHallModal()}
          className="px-4 py-2.5 rounded-xl bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 flex items-center gap-1.5 cursor-pointer shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{isEn ? 'Add Dining Hall / Zone' : 'إضافة صالة / منطقة جديدة'}</span>
        </button>
      </div>

      {/* Section 1: Dining Halls / Zones Management + Bulk Table QR Generator */}
      <section className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-extrabold text-zinc-950">
                {isEn
                  ? `Halls & Floor Zones (${halls.length})`
                  : `صالات المطعم والمجموعات (${halls.length})`}
              </h3>
              <p className="text-[11px] text-zinc-500">
                {isEn
                  ? 'Select a hall to generate or print all its table QR cards.'
                  : 'اختر أي صالة لتوليد أو تعديل عدد ترابيزاتها وطباعة باركود كل ترابيزة.'}
              </p>
            </div>
          </div>

          {halls.length === 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {HALL_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  disabled={savingHall}
                  onClick={() => handleQuickCreatePreset(preset)}
                  className="px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-950 text-[11px] font-bold hover:bg-amber-100 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  <span>+ {isEn ? preset.name_en : preset.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {halls.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {halls.map((hall) => {
              const selected = hall.id === selectedHallId;
              return (
                <div
                  key={hall.id}
                  onClick={() => setSelectedHallId(hall.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedHallId(hall.id);
                    }
                  }}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-2 ${
                    selected
                      ? 'bg-zinc-950 text-white border-zinc-950 shadow-sm'
                      : 'bg-zinc-50/70 text-zinc-900 border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <MapPin
                        className={`w-3.5 h-3.5 shrink-0 ${
                          selected ? 'text-amber-400' : 'text-amber-600'
                        }`}
                      />
                      <p className="text-xs font-extrabold truncate">{loc(hall.name, hall.name_en)}</p>
                    </div>
                    <p
                      className={`text-[11px] font-mono-num ${
                        selected ? 'text-zinc-300' : 'text-zinc-500'
                      }`}
                    >
                      {getHallTableNumbers(hall).length} {isEn ? 'tables' : 'ترابيزة'}
                      {hall.hallType ? ` · ${hall.hallType}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => openEditHallModal(hall)}
                      aria-label={isEn ? 'Edit hall' : 'تعديل الصالة'}
                      className={`p-1.5 rounded-lg cursor-pointer ${
                        selected
                          ? 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                          : 'text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-900'
                      }`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteHall(hall.id)}
                      aria-label={isEn ? 'Delete hall' : 'حذف الصالة'}
                      className={`p-1.5 rounded-lg cursor-pointer ${
                        selected
                          ? 'text-rose-300 hover:bg-rose-900/50'
                          : 'text-zinc-400 hover:bg-red-50 hover:text-red-600'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-5 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/70 text-center space-y-2">
            <p className="text-xs font-bold text-zinc-700">
              {isEn
                ? 'No dining halls created yet. Add your first hall (e.g. Main Hall, Terrace, 2nd Floor) or tap a quick preset above.'
                : 'لم تقم بإضافة صالات بعد. أضف أول صالة (مثل: الصالة الرئيسية، التراس، الدور الثاني) أو استخدم الإضافة السريعة أعلاه.'}
            </p>
          </div>
        )}

        {/* Bulk Table QR Generator Controls */}
        <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
            <div>
              <label className="block text-xs font-bold text-zinc-800 mb-1.5">
                {isEn ? 'Selected Hall / Zone' : 'الصالة المحددة للتوليد'}
              </label>
              {halls.length > 0 ? (
                <select
                  value={selectedHallId}
                  onChange={(e) => setSelectedHallId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-white text-xs font-bold"
                >
                  {halls.map((h) => (
                    <option key={h.id} value={h.id}>
                      {loc(h.name, h.name_en)} ({h.tableCount} {isEn ? 'tables' : 'ترابيزة'})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={hallLabel}
                  onChange={(e) => setHallLabel(e.target.value)}
                  placeholder={isEn ? 'e.g. Main Hall' : 'مثال: الصالة الرئيسية'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-white text-xs"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-800 mb-1.5">
                {isEn ? 'Number of Tables (1 – 200)' : 'عدد الترابيزات المطلوب توليدها (1 – 200)'}
              </label>
              <input
                type="number"
                min={1}
                max={200}
                value={bulkCountInput}
                onChange={(e) => setBulkCountInput(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm font-mono-num font-bold"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={generatingBulk}
              onClick={handleBulkGenerateAndSave}
              className="min-h-[42px] px-4 py-2.5 rounded-xl bg-zinc-950 text-white text-xs font-extrabold hover:bg-zinc-800 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {generatingBulk ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Grid className="w-4 h-4" />
              )}
              <span>
                {isEn ? 'Generate Table QRs' : 'توليد الترابيزات التلقائي'}
              </span>
            </button>

            {generatedTables.length > 0 && (
              <button
                type="button"
                onClick={() => handlePrintMode('bulk')}
                style={{ backgroundColor: restaurant.primaryColor }}
                className="min-h-[42px] px-4 py-2.5 rounded-xl text-white text-xs font-extrabold hover:opacity-95 flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>
                  {isEn
                    ? `Print All (${generatedTables.length})`
                    : `طباعة كل ترابيزات الصالة (${generatedTables.length})`}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Generated Bulk Tables Grid (cut-ready when printTarget === 'bulk') */}
        {generatedTables.length > 0 && (
          <div className={printTarget === 'bulk' ? 'qr-bulk-print-area space-y-4' : 'space-y-4'}>
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-zinc-700" />
                <h4 className="text-xs sm:text-sm font-extrabold text-zinc-950">
                  {displayName}
                  {activeBulkHallLabel ? ` — ${activeBulkHallLabel}` : ''} ({generatedTables.length}{' '}
                  {isEn ? 'QR Cards Ready' : 'كود ترابيزة جاهز للطباعة والقص'})
                </h4>
              </div>
              <span className="text-[11px] text-zinc-500 print:hidden">
                {isEn ? 'Each card has its own table link' : 'كل كود مربوط برقم الترابيزة والصالة تلقائياً'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 print:grid-cols-3 print:gap-4">
              {generatedTables.map((tbl) => (
                <div
                  key={tbl.tableNum}
                  className="break-inside-avoid rounded-2xl border-2 border-dashed border-zinc-300 bg-white p-3.5 text-center space-y-2.5 flex flex-col justify-between"
                >
                  {/* Top: Welcome Header */}
                  <div className="space-y-0.5">
                    {isEn ? (
                      <>
                        <p className="text-[10px] font-extrabold text-zinc-700 leading-tight" dir="ltr">
                          Welcome to {restaurant.name_en || restaurant.name}
                        </p>
                        {restaurant.name && (
                          <p className="text-[9px] font-bold text-zinc-400 leading-tight" dir="rtl">
                            مرحباً بكم في {restaurant.name}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-[10px] font-extrabold text-zinc-700 leading-tight">
                          مرحباً بكم في {restaurant.name}
                        </p>
                        <p className="text-[9px] font-bold text-zinc-400 leading-tight" dir="ltr">
                          Welcome to {restaurant.name_en || restaurant.name}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Center: Large Prominent Table Number + QR Code */}
                  <div className="space-y-1.5">
                    <div
                      className="text-2xl sm:text-3xl font-extrabold font-mono-num leading-none"
                      style={{ color: restaurant.primaryColor }}
                    >
                      {tbl.tableNum}
                    </div>
                    <img
                      src={tbl.dataUrl}
                      alt={`QR Table ${tbl.tableNum}`}
                      className="w-28 h-28 mx-auto rounded-lg border border-zinc-100 bg-white"
                    />
                  </div>

                  {/* Bottom: Hall Name & Hall Type */}
                  <div className="space-y-0.5 pt-1 border-t border-zinc-100">
                    {activeBulkHallLabel && (
                      <p className="text-[11px] font-extrabold text-zinc-900 truncate">
                        {activeBulkHallLabel}
                      </p>
                    )}
                    {activeHall?.hallType && (
                      <p className="text-[10px] font-bold text-zinc-500 truncate">
                        {activeHall.hallType}
                      </p>
                    )}
                    <p className="text-[9px] text-zinc-400 leading-tight">
                      {isEn ? 'Scan to view menu & order' : 'امسح الكود للطلب من الترابيزة'}
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-1.5 pt-1 print:hidden">
                    <a
                      href={tbl.dataUrl}
                      download={`qr-${restaurant.slug}-${activeBulkHallLabel || 'hall'}-t${tbl.tableNum}.png`}
                      className="flex-1 py-1.5 px-2 rounded-lg border border-zinc-200 text-[10px] font-bold text-zinc-700 hover:bg-zinc-50 flex items-center justify-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>PNG</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(tbl.url).then(() => {
                          setBulkCopiedNum(tbl.tableNum);
                          setTimeout(() => setBulkCopiedNum(null), 1500);
                        });
                      }}
                      className="p-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                      aria-label={isEn ? 'Copy table link' : 'نسخ رابط الترابيزة'}
                    >
                      {bulkCopiedNum === tbl.tableNum ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Section 2: Single Custom QR Card Generator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 bg-white border border-zinc-200 rounded-2xl p-6 space-y-5">
          <div>
            <h3 className="text-sm font-extrabold text-zinc-950">
              {isEn ? 'Single Custom QR Card' : 'تخصيص كود QR مفرد'}
            </h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {isEn
                ? 'Generate a general menu QR or single high-resolution PNG/SVG sticker.'
                : 'لتوليد كود عام للمنيو أو ملصق مفرد بدقة عالية PNG / SVG.'}
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1.5">
              {t.admin.qr.menuUrlLabel}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                dir="ltr"
                value={targetUrl}
                className="flex-1 px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-mono-num text-zinc-700 text-left"
              />
              <button
                type="button"
                onClick={handleCopyUrl}
                className="px-3 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold hover:bg-zinc-50 flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copied ? t.admin.qr.copiedToast : t.admin.qr.copyUrlBtn}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-zinc-800 mb-1.5">
                {isEn ? 'Hall / Zone (optional)' : 'اسم الصالة / القسم (اختياري)'}
              </label>
              <input
                type="text"
                value={hallLabel}
                onChange={(e) => setHallLabel(e.target.value)}
                placeholder={isEn ? 'e.g. Main Hall' : 'مثال: الصالة الرئيسية'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-800 mb-1.5">
                {isEn ? 'Table Number (optional)' : 'رقم الطاولة (اختياري)'}
              </label>
              <input
                type="text"
                value={tableLabel}
                onChange={(e) => setTableLabel(e.target.value)}
                placeholder={isEn ? 'e.g. 5 (blank = general)' : 'مثال: 5 (فارغ = عام)'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm font-mono-num"
              />
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              onClick={handleDownloadPng}
              className="w-full py-3 px-4 rounded-xl bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{t.admin.qr.downloadPngBtn}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadSvg}
              className="w-full py-3 px-4 rounded-xl border border-zinc-300 text-zinc-800 text-xs font-bold hover:bg-zinc-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isEn ? 'Download Print-Ready SVG' : 'تحميل ملف SVG للطباعة'}</span>
            </button>

            <button
              type="button"
              onClick={() => handlePrintMode('single')}
              style={{ backgroundColor: restaurant.primaryColor }}
              className="w-full py-3 px-4 rounded-xl text-white text-xs font-bold hover:opacity-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{t.admin.qr.printCardBtn}</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-7 flex justify-center">
          <div
            className={`${
              printTarget === 'single' ? 'qr-print-area' : ''
            } bg-white border border-zinc-200 rounded-3xl p-8 w-full max-w-sm text-center space-y-5 shadow-sm`}
          >
            {/* Top Welcome */}
            <div className="space-y-1.5">
              {restaurant.logoUrl && (
                <SafeImage
                  src={restaurant.logoUrl}
                  alt={displayName}
                  className="w-16 h-16 rounded-2xl object-cover mx-auto border border-zinc-200"
                />
              )}
              {isEn ? (
                <>
                  <p className="text-sm font-extrabold text-zinc-900" dir="ltr">
                    Welcome to {restaurant.name_en || restaurant.name}
                  </p>
                  <p className="text-xs font-bold text-zinc-500" dir="rtl">
                    مرحباً بكم في {restaurant.name}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-extrabold text-zinc-900">
                    مرحباً بكم في {restaurant.name}
                  </p>
                  <p className="text-xs font-bold text-zinc-500" dir="ltr">
                    Welcome to {restaurant.name_en || restaurant.name}
                  </p>
                </>
              )}
            </div>

            {/* Large Center Table Number */}
            {tableLabel.trim() && (
              <div className="py-1">
                <span className="block text-[11px] font-bold text-zinc-400">
                  {isEn ? 'TABLE NO.' : 'ترابيزة رقم'}
                </span>
                <span
                  className="text-5xl font-extrabold font-mono-num leading-none"
                  style={{ color: restaurant.primaryColor }}
                >
                  {tableLabel.trim()}
                </span>
              </div>
            )}

            <div className="p-4 rounded-2xl border-2 border-dashed border-zinc-200 inline-block bg-white">
              <canvas ref={canvasRef} className="mx-auto block" />
            </div>

            {/* Bottom Hall Name & Hall Type */}
            <div className="space-y-1 pt-2 border-t border-zinc-100">
              {hallLabel.trim() && (
                <p className="text-sm font-extrabold text-zinc-950">{hallLabel.trim()}</p>
              )}
              {hallTypeSingleLabel.trim() && (
                <p className="text-xs font-bold text-zinc-500">{hallTypeSingleLabel.trim()}</p>
              )}
              <p className="text-xs font-bold text-zinc-700 pt-1">{t.admin.qr.cardScanPrompt}</p>
              <p className="text-[11px] text-zinc-500">{t.admin.qr.cardFooter}</p>
              <p className="text-[11px] font-mono-num text-zinc-400 pt-0.5" dir="ltr">
                /menu/{restaurant.slug}
              </p>
            </div>
          </div>
        </div>
      </div>

      <SharePreviewCard
        title={resolveRestaurantShareTitle(restaurant, lang)}
        description={resolveRestaurantShareDescription(restaurant, lang)}
        imageUrl={restaurant.logoUrl}
        shareUrl={targetUrl}
        isEn={isEn}
      />

      {/* Create / Edit Hall Modal */}
      {hallModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setHallModalOpen(false)}
        >
          <form
            dir={dir}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveHall}
            className="w-full max-w-md bg-white rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-extrabold text-zinc-950">
                {editingHall
                  ? isEn
                    ? 'Edit Dining Hall / Zone'
                    : 'تعديل الصالة / المنطقة'
                  : isEn
                    ? 'Add New Dining Hall / Zone'
                    : 'إضافة صالة / منطقة جديدة'}
              </h3>
              <button
                type="button"
                onClick={() => setHallModalOpen(false)}
                aria-label={isEn ? 'Close' : 'إغلاق'}
                className="w-9 h-9 rounded-xl hover:bg-zinc-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!editingHall && (
              <div className="space-y-1.5">
                <span className="block text-[11px] font-bold text-zinc-500">
                  {isEn ? 'Quick Templates:' : 'أسماء مقترحة جاهزة:'}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {HALL_PRESETS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => {
                        setHallNameInput(p.name);
                        setHallNameEnInput(p.name_en);
                        setHallTypeInput(p.hallType);
                        setHallTablesInput(p.tableCount);
                        setTableNumbersText(buildRangeCsv(p.tableCount, false));
                      }}
                      className="px-2.5 py-1 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-[11px] font-bold text-zinc-800 cursor-pointer"
                    >
                      {isEn ? p.name_en : p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">
                  {isEn ? 'Hall Name (AR) *' : 'اسم الصالة (عربي) *'}
                </label>
                <input
                  type="text"
                  dir="rtl"
                  required
                  value={hallNameInput}
                  onChange={(e) => setHallNameInput(e.target.value)}
                  placeholder={isEn ? 'e.g. الصالة الرئيسية' : 'مثال: الصالة الرئيسية'}
                  maxLength={80}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">
                  {isEn ? 'Hall Name (EN)' : 'اسم الصالة (إنجليزي)'}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={hallNameEnInput}
                  onChange={(e) => setHallNameEnInput(e.target.value)}
                  placeholder="e.g. Main Hall"
                  maxLength={80}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm text-left"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">
                  {isEn ? 'Hall Type / Zone' : 'نوع الصالة / القسم'}
                </label>
                <input
                  type="text"
                  value={hallTypeInput}
                  onChange={(e) => setHallTypeInput(e.target.value)}
                  placeholder={isEn ? 'e.g. Indoor / Terrace / VIP' : 'مثال: صالة داخلية / تراس / VIP'}
                  maxLength={60}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">
                  {isEn ? 'Tables Count (1 – 200)' : 'عدد الترابيزات (1 – 200)'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  required
                  value={hallTablesInput}
                  onChange={(e) => {
                    const cnt = Math.max(1, Math.min(200, Math.round(Number(e.target.value) || 1)));
                    setHallTablesInput(cnt);
                    const hadSkip13 =
                      parseTableNumbersCsv(tableNumbersText).length >= 13 &&
                      !parseTableNumbersCsv(tableNumbersText).includes('13');
                    setTableNumbersText(buildRangeCsv(cnt, hadSkip13));
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm font-mono-num font-bold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-zinc-800">
                  {isEn ? 'Custom Table Numbers (comma-separated)' : 'أرقام الترابيزات المخصصة'}
                </label>
                <button
                  type="button"
                  onClick={handleToggleSkip13InModal}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-extrabold cursor-pointer ${
                    !parseTableNumbersCsv(tableNumbersText).includes('13')
                      ? 'bg-amber-100 border-amber-300 text-amber-950'
                      : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200'
                  }`}
                >
                  {!parseTableNumbersCsv(tableNumbersText).includes('13')
                    ? isEn
                      ? '13 Hidden (Restore)'
                      : 'رقم 13 مخفي (إعادة)'
                    : isEn
                      ? 'Hide Table #13'
                      : 'إخفاء رقم 13'}
                </button>
              </div>
              <textarea
                rows={2}
                dir="ltr"
                value={tableNumbersText}
                onChange={(e) => {
                  setTableNumbersText(e.target.value);
                  const count = parseTableNumbersCsv(e.target.value).length;
                  if (count > 0) setHallTablesInput(count);
                }}
                placeholder="1, 2, 3, ... 12, 14, 15"
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs font-mono-num"
              />
            </div>

            {hallError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
                {hallError}
              </div>
            )}

            <button
              type="submit"
              disabled={savingHall}
              className="w-full py-3 rounded-xl bg-zinc-950 text-white text-sm font-bold hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
            >
              {savingHall
                ? isEn
                  ? 'Saving...'
                  : 'جاري الحفظ...'
                : isEn
                  ? 'Save Hall & Generate QRs'
                  : 'حفظ الصالة وتوليد الترابيزات'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
