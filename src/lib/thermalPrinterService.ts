import { AppLang, formatCurrency, getActiveLang, loc } from '../data/translations';
import { Order, OrderItemPayload, Restaurant } from '../types/menu';
import { StationMeta } from './stationUtils';

export type PrinterTransport = 'bluetooth' | 'serial' | 'usb' | 'browser';
export type ThermalPaperWidth = 58 | 80;

export interface SavedPrinterProfile {
  transport: PrinterTransport;
  name: string;
  paperWidth: ThermalPaperWidth;
  deviceId?: string;
  vendorId?: number;
  productId?: number;
  baudRate?: number;
  updatedAt: number;
}

export interface PrintTicketSection {
  type: 'divider' | 'title' | 'subtitle' | 'meta' | 'item' | 'total' | 'note' | 'space';
  text: string;
  subText?: string;
  rightText?: string;
  bold?: boolean;
}

export interface PrintableTicketJob {
  jobTitle: string;
  headerBadge?: string;
  sections: PrintTicketSection[];
  cutAfter?: boolean;
}

const PRINTER_STORAGE_KEY = 'sufra_preferred_printer_v1';

// Common BLE Thermal Printer Service UUIDs
const BLE_PRINTER_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ae30-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb',
];

type NavBluetooth = {
  requestDevice(options: unknown): Promise<BluetoothDeviceLike>;
  getDevices?(): Promise<BluetoothDeviceLike[]>;
};

interface BluetoothDeviceLike {
  id: string;
  name?: string;
  gatt?: {
    connected: boolean;
    connect(): Promise<{
      getPrimaryServices(): Promise<
        Array<{
          getCharacteristics(): Promise<
            Array<{
              properties: { write: boolean; writeWithoutResponse: boolean };
              writeValueWithoutResponse?(data: BufferSource): Promise<void>;
              writeValue?(data: BufferSource): Promise<void>;
            }>
          >;
        }>
      >;
    }>;
  };
}

interface SerialPortLike {
  readable: unknown;
  writable: WritableStream<Uint8Array> | null;
  getInfo?(): { usbVendorId?: number; usbProductId?: number };
  open(options: { baudRate: number }): Promise<void>;
}

interface UsbDeviceLike {
  vendorId: number;
  productId: number;
  productName?: string;
  opened: boolean;
  configuration: {
    interfaces: Array<{
      interfaceNumber: number;
      alternates: Array<{
        interfaceClass: number;
        endpoints: Array<{ direction: 'in' | 'out'; endpointNumber: number }>;
      }>;
    }>;
  } | null;
  open(): Promise<void>;
  selectConfiguration(cfg: number): Promise<void>;
  claimInterface(iface: number): Promise<void>;
  transferOut(endpointNumber: number, data: BufferSource): Promise<unknown>;
}

// Active in-memory handles
let activeBleChar: {
  writeValueWithoutResponse?(data: BufferSource): Promise<void>;
  writeValue?(data: BufferSource): Promise<void>;
  properties: { write: boolean; writeWithoutResponse: boolean };
} | null = null;
let activeSerialPort: SerialPortLike | null = null;
let activeUsbHandle: { device: UsbDeviceLike; endpointNumber: number } | null = null;
let activeConnectedName = '';
let activeConnectedTransport: PrinterTransport | null = null;
let printQueuePromise: Promise<void> = Promise.resolve();

export function getSavedPrinterProfile(): SavedPrinterProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PRINTER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedPrinterProfile;
  } catch {
    return null;
  }
}

export function savePrinterProfile(profile: SavedPrinterProfile): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PRINTER_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore storage quota errors
  }
}

export function clearSavedPrinterProfile(): void {
  activeBleChar = null;
  activeSerialPort = null;
  activeUsbHandle = null;
  activeConnectedName = '';
  activeConnectedTransport = null;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PRINTER_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getPrinterHardwareCapabilities(): {
  bluetooth: boolean;
  serial: boolean;
  usb: boolean;
} {
  if (typeof navigator === 'undefined') {
    return { bluetooth: false, serial: false, usb: false };
  }
  const nav = navigator as unknown as {
    bluetooth?: unknown;
    serial?: unknown;
    usb?: unknown;
  };
  return {
    bluetooth: Boolean(nav.bluetooth),
    serial: Boolean(nav.serial),
    usb: Boolean(nav.usb),
  };
}

export function getActivePrinterConnection(): {
  connected: boolean;
  transport: PrinterTransport | null;
  name: string;
} {
  return {
    connected: Boolean(activeBleChar || activeSerialPort || activeUsbHandle),
    transport: activeConnectedTransport,
    name: activeConnectedName,
  };
}

async function connectBluetoothDevice(device: BluetoothDeviceLike): Promise<void> {
  const isEn = getActiveLang() === 'en';
  if (!device.gatt) {
    throw new Error(
      isEn ? 'Selected device does not support GATT Bluetooth.' : 'الجهاز المختار لا يدعم GATT Bluetooth.'
    );
  }
  const server = device.gatt.connected ? device.gatt : await device.gatt.connect();
  const gattServer = await (server as { connect(): Promise<unknown> }).connect?.().catch(() => server);
  const srv = (gattServer || server) as NonNullable<BluetoothDeviceLike['gatt']> extends {
    connect(): Promise<infer R>;
  }
    ? R
    : never;

  const services = await srv.getPrimaryServices();
  for (const service of services) {
    const chars = await service.getCharacteristics();
    for (const ch of chars) {
      if (ch.properties.writeWithoutResponse || ch.properties.write) {
        activeBleChar = ch;
        activeConnectedTransport = 'bluetooth';
        activeConnectedName = device.name || 'Bluetooth Thermal Printer';
        return;
      }
    }
  }
  throw new Error(
    isEn
      ? 'No writable characteristic found on the Bluetooth printer.'
      : 'لم يتم العثور على منفذ كتابة في طابعة البلوتوث.'
  );
}

export async function pairBluetoothPrinter(paperWidth: ThermalPaperWidth = 80): Promise<SavedPrinterProfile> {
  const isEn = getActiveLang() === 'en';
  const nav = navigator as unknown as { bluetooth?: NavBluetooth };
  if (!nav.bluetooth) {
    throw new Error(
      isEn
        ? 'This browser does not support Web Bluetooth. Use Chrome/Edge on Android or Desktop, or switch to Web Serial / WebUSB.'
        : 'المتصفح الحالي لا يدعم البلوتوث المباشر. استخدم Chrome أو Edge أو اختر الطباعة عبر المتصفح / المنفذ التسلسلي / USB.'
    );
  }
  const device = await nav.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: BLE_PRINTER_SERVICE_UUIDS,
  });
  await connectBluetoothDevice(device);
  const profile: SavedPrinterProfile = {
    transport: 'bluetooth',
    name: device.name || 'Bluetooth Printer',
    paperWidth,
    deviceId: device.id,
    updatedAt: Date.now(),
  };
  savePrinterProfile(profile);
  return profile;
}

export async function pairSerialPrinter(
  paperWidth: ThermalPaperWidth = 80,
  baudRate = 9600
): Promise<SavedPrinterProfile> {
  const isEn = getActiveLang() === 'en';
  const nav = navigator as unknown as {
    serial?: {
      requestPort(): Promise<SerialPortLike>;
      getPorts(): Promise<SerialPortLike[]>;
    };
  };
  if (!nav.serial) {
    throw new Error(
      isEn
        ? 'This browser does not support Web Serial. Use Chrome or Edge on Desktop.'
        : 'المتصفح الحالي لا يدعم المنفذ التسلسلي. استخدم Chrome أو Edge على الكمبيوتر.'
    );
  }
  const port = await nav.serial.requestPort();
  if (!port.writable) {
    await port.open({ baudRate });
  }
  activeSerialPort = port;
  activeConnectedTransport = 'serial';
  const info = port.getInfo?.();
  activeConnectedName = info?.usbVendorId
    ? `Serial Printer (${info.usbVendorId.toString(16)})`
    : 'Serial Thermal Printer';

  const profile: SavedPrinterProfile = {
    transport: 'serial',
    name: activeConnectedName,
    paperWidth,
    vendorId: info?.usbVendorId,
    productId: info?.usbProductId,
    baudRate,
    updatedAt: Date.now(),
  };
  savePrinterProfile(profile);
  return profile;
}

async function openUsbPrinter(device: UsbDeviceLike): Promise<void> {
  if (!device.opened) {
    await device.open();
  }
  if (!device.configuration) {
    await device.selectConfiguration(1);
  }
  const interfaces = device.configuration?.interfaces || [];
  for (const iface of interfaces) {
    for (const alt of iface.alternates) {
      const outEp = alt.endpoints.find((ep) => ep.direction === 'out');
      if (outEp) {
        await device.claimInterface(iface.interfaceNumber);
        activeUsbHandle = { device, endpointNumber: outEp.endpointNumber };
        activeConnectedTransport = 'usb';
        activeConnectedName = device.productName || `USB Printer (${device.vendorId.toString(16)})`;
        return;
      }
    }
  }
  const isEn = getActiveLang() === 'en';
  throw new Error(
    isEn
      ? 'No printable USB endpoint found on the selected device.'
      : 'لم يتم العثور على منفذ للطباعة في جهاز USB المختار.'
  );
}

export async function pairUsbPrinter(paperWidth: ThermalPaperWidth = 80): Promise<SavedPrinterProfile> {
  const isEn = getActiveLang() === 'en';
  const nav = navigator as unknown as {
    usb?: {
      requestDevice(opts: { filters: Array<Record<string, number>> }): Promise<UsbDeviceLike>;
      getDevices(): Promise<UsbDeviceLike[]>;
    };
  };
  if (!nav.usb) {
    throw new Error(
      isEn
        ? 'This browser does not support WebUSB. Use Chrome/Edge or print via Browser / Serial.'
        : 'المتصفح الحالي لا يدعم طباعة USB المباشرة. استخدم Chrome أو Edge أو اختر الطباعة عبر المتصفح.'
    );
  }
  const device = await nav.usb.requestDevice({ filters: [{ classCode: 7 }] }).catch(() =>
    nav.usb!.requestDevice({ filters: [] })
  );
  await openUsbPrinter(device);
  const profile: SavedPrinterProfile = {
    transport: 'usb',
    name: activeConnectedName,
    paperWidth,
    vendorId: device.vendorId,
    productId: device.productId,
    updatedAt: Date.now(),
  };
  savePrinterProfile(profile);
  return profile;
}

export async function tryAutoReconnectSavedPrinter(): Promise<{
  reconnected: boolean;
  profile: SavedPrinterProfile | null;
}> {
  const profile = getSavedPrinterProfile();
  if (!profile) return { reconnected: false, profile: null };
  if (getActivePrinterConnection().connected) return { reconnected: true, profile };

  try {
    if (profile.transport === 'bluetooth') {
      const nav = navigator as unknown as { bluetooth?: NavBluetooth };
      const devices = await nav.bluetooth?.getDevices?.();
      const match = devices?.find((d) => !profile.deviceId || d.id === profile.deviceId);
      if (match) {
        await connectBluetoothDevice(match);
        return { reconnected: true, profile };
      }
    } else if (profile.transport === 'serial') {
      const nav = navigator as unknown as {
        serial?: { getPorts(): Promise<SerialPortLike[]> };
      };
      const ports = await nav.serial?.getPorts();
      const port =
        ports?.find((p) => {
          const info = p.getInfo?.();
          return !profile.vendorId || info?.usbVendorId === profile.vendorId;
        }) || ports?.[0];
      if (port) {
        if (!port.writable) {
          await port.open({ baudRate: profile.baudRate || 9600 });
        }
        activeSerialPort = port;
        activeConnectedTransport = 'serial';
        activeConnectedName = profile.name;
        return { reconnected: true, profile };
      }
    } else if (profile.transport === 'usb') {
      const nav = navigator as unknown as {
        usb?: { getDevices(): Promise<UsbDeviceLike[]> };
      };
      const devices = await nav.usb?.getDevices();
      const dev =
        devices?.find(
          (d) =>
            (!profile.vendorId || d.vendorId === profile.vendorId) &&
            (!profile.productId || d.productId === profile.productId)
        ) || devices?.[0];
      if (dev) {
        await openUsbPrinter(dev);
        return { reconnected: true, profile };
      }
    }
  } catch {
    return { reconnected: false, profile };
  }
  return { reconnected: false, profile };
}

/**
 * Renders an RTL Arabic thermal ticket to a monochrome bitmap and encodes
 * standard ESC/POS `GS v 0` raster commands + feed + partial cut.
 * Ensures crisp Arabic rendering on ALL 58mm / 80mm thermal printers.
 */
function encodeTicketToEscPosBytes(
  job: PrintableTicketJob,
  paperWidthMm: ThermalPaperWidth = 80,
  lang: AppLang = getActiveLang()
): Uint8Array {
  const isEn = lang === 'en';
  const fontStack = isEn ? 'Inter, Arial, sans-serif' : 'Tajawal, Cairo, Arial, sans-serif';
  const pixelWidth = paperWidthMm === 58 ? 384 : 576;
  const widthBytes = pixelWidth / 8;

  const canvas = document.createElement('canvas');
  canvas.width = pixelWidth;
  canvas.height = 1800;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return new Uint8Array([0x1b, 0x40, 0x0a, 0x0a]);
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, pixelWidth, canvas.height);
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';

  const pad = 12;
  let y = 10;
  const lineFont = paperWidthMm === 58 ? 19 : 22;
  const titleFont = paperWidthMm === 58 ? 26 : 32;
  const subFont = paperWidthMm === 58 ? 20 : 24;

  const drawWrappedText = (
    text: string,
    fontSize: number,
    bold = false,
    center = false
  ) => {
    ctx.font = `${bold ? '800' : '600'} ${fontSize}px ${fontStack}`;
    ctx.direction = isEn ? 'ltr' : 'rtl';
    ctx.textAlign = center ? 'center' : isEn ? 'left' : 'right';

    const maxW = pixelWidth - pad * 2;
    const words = (text || '').split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';
    for (const w of words) {
      const test = current ? `${current} ${w}` : w;
      if (ctx.measureText(test).width > maxW && current) {
        lines.push(current);
        current = w;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    if (lines.length === 0) lines.push('');

    for (const ln of lines) {
      const x = center ? pixelWidth / 2 : isEn ? pad : pixelWidth - pad;
      ctx.fillText(ln, x, y);
      y += Math.round(fontSize * 1.38);
    }
  };

  if (job.headerBadge) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(pad, y, pixelWidth - pad * 2, titleFont + 16);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 ${subFont}px ${fontStack}`;
    ctx.direction = isEn ? 'ltr' : 'rtl';
    ctx.textAlign = 'center';
    ctx.fillText(job.headerBadge, pixelWidth / 2, y + 8);
    ctx.fillStyle = '#000000';
    y += titleFont + 24;
  }

  for (const sec of job.sections) {
    if (sec.type === 'divider') {
      y += 4;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(pixelWidth - pad, y);
      ctx.stroke();
      ctx.setLineDash([]);
      y += 10;
    } else if (sec.type === 'space') {
      y += 12;
    } else if (sec.type === 'title') {
      drawWrappedText(sec.text, titleFont, true, true);
    } else if (sec.type === 'subtitle') {
      drawWrappedText(sec.text, subFont, true, true);
    } else if (sec.type === 'total') {
      ctx.font = `800 ${subFont}px ${fontStack}`;
      if (sec.rightText) {
        ctx.direction = 'ltr';
        ctx.textAlign = isEn ? 'right' : 'left';
        ctx.fillText(sec.rightText, isEn ? pixelWidth - pad : pad, y);
      }
      ctx.direction = isEn ? 'ltr' : 'rtl';
      ctx.textAlign = isEn ? 'left' : 'right';
      ctx.fillText(sec.text, isEn ? pad : pixelWidth - pad, y);
      y += Math.round(subFont * 1.45);
    } else if (sec.type === 'item') {
      ctx.font = `800 ${lineFont}px ${fontStack}`;
      if (sec.rightText) {
        ctx.direction = 'ltr';
        ctx.textAlign = isEn ? 'right' : 'left';
        ctx.fillText(sec.rightText, isEn ? pixelWidth - pad : pad, y);
      }
      drawWrappedText(sec.text, lineFont, true, false);
      if (sec.subText) {
        drawWrappedText(sec.subText, Math.max(16, lineFont - 3), false, false);
      }
      y += 4;
    } else {
      drawWrappedText(sec.text, lineFont, Boolean(sec.bold), false);
    }
  }

  y += 16;
  const finalHeight = Math.min(canvas.height, Math.max(80, y));
  const imgData = ctx.getImageData(0, 0, pixelWidth, finalHeight).data;

  const rasterBytes = new Uint8Array(widthBytes * finalHeight);
  for (let row = 0; row < finalHeight; row += 1) {
    for (let byteIdx = 0; byteIdx < widthBytes; byteIdx += 1) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit += 1) {
        const px = byteIdx * 8 + bit;
        const offset = (row * pixelWidth + px) * 4;
        const lum =
          0.299 * imgData[offset] +
          0.587 * imgData[offset + 1] +
          0.114 * imgData[offset + 2];
        if (lum < 165) {
          byte |= 1 << (7 - bit);
        }
      }
      rasterBytes[row * widthBytes + byteIdx] = byte;
    }
  }

  const xL = widthBytes & 0xff;
  const xH = (widthBytes >> 8) & 0xff;
  const yL = finalHeight & 0xff;
  const yH = (finalHeight >> 8) & 0xff;

  const initCmd = [0x1b, 0x40]; // ESC @
  const rasterHeader = [0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH]; // GS v 0
  const feedAndCut = job.cutAfter !== false
    ? [0x1b, 0x64, 0x04, 0x1d, 0x56, 0x42, 0x00] // Feed 4 lines + Partial Cut
    : [0x1b, 0x64, 0x02];

  const totalLen = initCmd.length + rasterHeader.length + rasterBytes.length + feedAndCut.length;
  const out = new Uint8Array(totalLen);
  let pos = 0;
  out.set(initCmd, pos);
  pos += initCmd.length;
  out.set(rasterHeader, pos);
  pos += rasterHeader.length;
  out.set(rasterBytes, pos);
  pos += rasterBytes.length;
  out.set(feedAndCut, pos);
  return out;
}

async function writeRawEscPosBytes(bytes: Uint8Array): Promise<void> {
  if (activeBleChar) {
    const chunkSize = 180;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const slice = bytes.slice(i, i + chunkSize);
      if (activeBleChar.writeValueWithoutResponse) {
        await activeBleChar.writeValueWithoutResponse(slice);
      } else if (activeBleChar.writeValue) {
        await activeBleChar.writeValue(slice);
      }
      await new Promise((r) => setTimeout(r, 18));
    }
    return;
  }

  if (activeSerialPort?.writable) {
    const writer = activeSerialPort.writable.getWriter();
    try {
      await writer.write(bytes);
    } finally {
      writer.releaseLock();
    }
    return;
  }

  if (activeUsbHandle) {
    await activeUsbHandle.device.transferOut(activeUsbHandle.endpointNumber, new Uint8Array(bytes));
    return;
  }

  throw new Error('NO_HARDWARE_PRINTER');
}

function escapeHtml(raw: string): string {
  return (raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function printJobsViaBrowserThermalSheet(
  jobs: PrintableTicketJob[],
  paperWidth: ThermalPaperWidth,
  lang: AppLang = getActiveLang()
): void {
  if (typeof document === 'undefined') return;

  const isEn = lang === 'en';
  const existing = document.getElementById('sufra-thermal-print-root');
  if (existing) existing.remove();

  const widthCss = paperWidth === 58 ? '58mm' : '80mm';
  const root = document.createElement('div');
  root.id = 'sufra-thermal-print-root';
  root.dir = isEn ? 'ltr' : 'rtl';

  const style = document.createElement('style');
  style.textContent = `
    #sufra-thermal-print-root { display: none; }
    @media print {
      body > *:not(#sufra-thermal-print-root) { display: none !important; }
      #sufra-thermal-print-root {
        display: block !important;
        width: ${widthCss};
        margin: 0 auto;
        color: #000;
        font-family: ${isEn ? 'Inter, Arial, sans-serif' : 'Tajawal, Cairo, Arial, sans-serif'};
        font-size: ${paperWidth === 58 ? '11px' : '12px'};
      }
      .sufra-ticket-block {
        padding: 6px 2px 14px;
        page-break-inside: avoid;
      }
      .sufra-ticket-separator {
        border-top: 2px dashed #000;
        margin: 12px 0;
        text-align: center;
        font-size: 10px;
        font-weight: 800;
        padding-top: 4px;
      }
    }
  `;
  root.appendChild(style);

  const ticketsHtml = jobs
    .map((job, idx) => {
      const linesHtml = job.sections
        .map((sec) => {
          if (sec.type === 'divider') {
            return '<div style="border-top:1px dashed #000;margin:6px 0;"></div>';
          }
          if (sec.type === 'space') {
            return '<div style="height:6px;"></div>';
          }
          if (sec.type === 'title') {
            return `<div style="text-align:center;font-weight:900;font-size:15px;margin-bottom:2px;">${escapeHtml(sec.text)}</div>`;
          }
          if (sec.type === 'subtitle') {
            return `<div style="text-align:center;font-weight:800;font-size:13px;margin-bottom:4px;">${escapeHtml(sec.text)}</div>`;
          }
          if (sec.type === 'total') {
            return `<div style="display:flex;justify-content:space-between;font-weight:900;font-size:13px;margin:2px 0;"><span>${escapeHtml(sec.text)}</span><span dir="ltr">${escapeHtml(sec.rightText || '')}</span></div>`;
          }
          if (sec.type === 'item') {
            return `<div style="margin:3px 0;"><div style="display:flex;justify-content:space-between;font-weight:800;"><span>${escapeHtml(sec.text)}</span><span dir="ltr">${escapeHtml(sec.rightText || '')}</span></div>${
              sec.subText
                ? `<div style="font-size:11px;color:#333;${isEn ? 'padding-left:8px;' : 'padding-right:8px;'}">${escapeHtml(sec.subText)}</div>`
                : ''
            }</div>`;
          }
          return `<div style="${sec.bold ? 'font-weight:800;' : ''}margin:2px 0;">${escapeHtml(sec.text)}</div>`;
        })
        .join('');

      const badge = job.headerBadge
        ? `<div style="background:#000;color:#fff;text-align:center;font-weight:900;padding:4px 6px;margin-bottom:6px;font-size:12px;">${escapeHtml(job.headerBadge)}</div>`
        : '';

      const sep =
        idx < jobs.length - 1
          ? '<div class="sufra-ticket-separator">========================</div>'
          : '';

      return `<div class="sufra-ticket-block">${badge}${linesHtml}</div>${sep}`;
    })
    .join('');

  const container = document.createElement('div');
  container.innerHTML = ticketsHtml;
  root.appendChild(container);
  document.body.appendChild(root);

  window.print();
  window.setTimeout(() => {
    root.remove();
  }, 1500);
}

export async function printThermalJobsSequentially(
  jobs: PrintableTicketJob[],
  opts?: { paperWidth?: ThermalPaperWidth; lang?: AppLang }
): Promise<{ mode: 'hardware' | 'browser'; count: number }> {
  const activeLang = opts?.lang || getActiveLang();
  const isEn = activeLang === 'en';
  if (jobs.length === 0) {
    throw new Error(isEn ? 'No tickets queued for printing.' : 'لا توجد تذاكر للطباعة.');
  }

  const profile = getSavedPrinterProfile();
  const paperWidth = opts?.paperWidth || profile?.paperWidth || 80;

  let resultMode: 'hardware' | 'browser' = 'browser';

  const task = printQueuePromise.then(async () => {
    if (!getActivePrinterConnection().connected && profile) {
      await tryAutoReconnectSavedPrinter();
    }

    if (getActivePrinterConnection().connected) {
      for (let i = 0; i < jobs.length; i += 1) {
        const job = jobs[i];
        const bytes = encodeTicketToEscPosBytes(job, paperWidth, activeLang);
        await writeRawEscPosBytes(bytes);
        if (i < jobs.length - 1) {
          await new Promise((r) => setTimeout(r, 300));
        }
      }
      resultMode = 'hardware';
    } else {
      printJobsViaBrowserThermalSheet(jobs, paperWidth, activeLang);
      resultMode = 'browser';
    }
  });

  printQueuePromise = task.catch(() => {});
  await task;

  return { mode: resultMode, count: jobs.length };
}

function formatOrderTime(ts: unknown, lang: AppLang = getActiveLang()): string {
  const locale = lang === 'en' ? 'en-US' : 'ar-EG-u-nu-latn';
  if (!ts) {
    return new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  }
  let ms = 0;
  if (typeof ts === 'object' && ts !== null && 'seconds' in ts) {
    ms = Number((ts as { seconds: number }).seconds) * 1000;
  } else if (ts instanceof Date) {
    ms = ts.getTime();
  }
  return new Date(ms || Date.now()).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildStationTicketJob(params: {
  restaurant: Restaurant;
  order: Order;
  station: StationMeta;
  stationItems: OrderItemPayload[];
  lang?: AppLang;
}): PrintableTicketJob {
  const { restaurant, order, station, stationItems } = params;
  const activeLang = params.lang || getActiveLang();
  const isEn = activeLang === 'en';
  const restName = loc(restaurant.name, restaurant.name_en, activeLang);
  const stationLabel = isEn ? station.shortLabel_en || station.shortLabel : station.shortLabel;

  const guestsSet = new Set<string>();
  if (order.customerName?.trim()) guestsSet.add(order.customerName.trim());
  stationItems.forEach((it) => {
    if (it.guestName?.trim()) guestsSet.add(it.guestName.trim());
  });
  const totalQty = stationItems.reduce((sum, it) => sum + (it.quantity || 1), 0);

  const sections: PrintTicketSection[] = [
    { type: 'title', text: restName },
    {
      type: 'subtitle',
      text: isEn ? `Prep Ticket: ${stationLabel}` : `تذكرة تحضير: ${stationLabel}`,
    },
    { type: 'divider', text: '' },
    {
      type: 'meta',
      text: isEn ? `Order #: #${order.orderNumber}` : `رقم الطلب: #${order.orderNumber}`,
      bold: true,
    },
    {
      type: 'meta',
      text:
        order.orderType === 'dine_in'
          ? isEn
            ? `Hall: ${order.hallName || 'Dine-in'} | Table: ${order.tableNumber || '-'}`
            : `الصالة: ${order.hallName || 'الصالة'} | الترابيزة: ${order.tableNumber || '-'}`
          : order.orderType === 'delivery'
            ? isEn
              ? 'Order Type: Delivery'
              : 'نوع الطلب: توصيل'
            : isEn
              ? 'Order Type: Takeaway'
              : 'نوع الطلب: استلام',
      bold: true,
    },
    {
      type: 'meta',
      text: isEn
        ? `Time: ${formatOrderTime(order.createdAt, activeLang)}`
        : `الوقت: ${formatOrderTime(order.createdAt, activeLang)}`,
    },
    {
      type: 'meta',
      text: isEn
        ? `Guest(s): ${Array.from(guestsSet).join(', ') || '-'}`
        : `العميل / الضيوف: ${Array.from(guestsSet).join('، ') || '-'}`,
    },
    { type: 'divider', text: '' },
  ];

  stationItems.forEach((it) => {
    const details: string[] = [];
    if (it.guestName) details.push(isEn ? `Guest: ${it.guestName}` : `للضيف: ${it.guestName}`);
    if (it.addonNames?.length) {
      details.push(
        isEn ? `Add-ons: ${it.addonNames.join(', ')}` : `إضافات: ${it.addonNames.join('، ')}`
      );
    }
    if (it.notes) details.push(isEn ? `Note: ${it.notes}` : `ملاحظة: ${it.notes}`);
    sections.push({
      type: 'item',
      text: `${it.quantity}× ${it.name}${it.sizeName ? ` (${it.sizeName})` : ''}`,
      subText: details.join(' | '),
    });
  });

  if (order.notes) {
    sections.push({ type: 'divider', text: '' });
    sections.push({
      type: 'note',
      text: isEn ? `Order Notes: ${order.notes}` : `ملاحظات عامة: ${order.notes}`,
      bold: true,
    });
  }

  sections.push({ type: 'divider', text: '' });
  sections.push({
    type: 'total',
    text: isEn ? `Total items for ${stationLabel}:` : `إجمالي عدد الأصناف في ${stationLabel}:`,
    rightText: String(totalQty),
  });

  return {
    jobTitle: `${stationLabel} #${order.orderNumber}`,
    headerBadge: `*** ${stationLabel} ***`,
    sections,
    cutAfter: true,
  };
}

export function buildCombinedOrderReceiptJob(params: {
  restaurant: Restaurant;
  order: Order;
  currencyLabel: string;
  includePrices?: boolean;
  includeSeparateChecks?: boolean;
  lang?: AppLang;
}): PrintableTicketJob {
  const {
    restaurant,
    order,
    currencyLabel,
    includePrices = true,
    includeSeparateChecks = true,
  } = params;
  const activeLang = params.lang || getActiveLang();
  const isEn = activeLang === 'en';
  const restName = loc(restaurant.name, restaurant.name_en, activeLang);
  const displayCurr = formatCurrency(currencyLabel, activeLang);

  const fmt = (n: number) => `${n.toFixed(2).replace(/\.00$/, '')} ${displayCurr}`;
  const totalQty = order.items.reduce((s, it) => s + (it.quantity || 1), 0);

  const sections: PrintTicketSection[] = [
    { type: 'title', text: restName },
    {
      type: 'subtitle',
      text: includePrices
        ? isEn
          ? 'Consolidated Check / Receipt'
          : 'الطلب الأساسي المجمع / الريسيت'
        : isEn
          ? 'Consolidated Operations Ticket'
          : 'الطلب الأساسي المجمع (تشغيل)',
    },
    { type: 'divider', text: '' },
    {
      type: 'meta',
      text: isEn ? `Order #: #${order.orderNumber}` : `رقم الطلب: #${order.orderNumber}`,
      bold: true,
    },
    {
      type: 'meta',
      text:
        order.orderType === 'dine_in'
          ? isEn
            ? `Hall: ${order.hallName || 'Dine-in'} | Table: ${order.tableNumber || '-'}`
            : `الصالة: ${order.hallName || 'الصالة'} | الترابيزة: ${order.tableNumber || '-'}`
          : order.orderType === 'delivery'
            ? isEn
              ? `Delivery · ${order.deliveryAddress || ''}`
              : `توصيل · ${order.deliveryAddress || ''}`
            : isEn
              ? 'Takeaway'
              : 'استلام من المطعم',
      bold: true,
    },
    {
      type: 'meta',
      text: `${isEn ? 'Customer' : 'العميل'}: ${order.customerName}${order.customerPhone ? ` · ${order.customerPhone}` : ''}`,
    },
    {
      type: 'meta',
      text: isEn
        ? `Time: ${formatOrderTime(order.createdAt, activeLang)}`
        : `الوقت: ${formatOrderTime(order.createdAt, activeLang)}`,
    },
    { type: 'divider', text: '' },
  ];

  order.items.forEach((it) => {
    const details: string[] = [];
    if (it.stationName) details.push(isEn ? `Station: ${it.stationName}` : `القسم: ${it.stationName}`);
    if (it.guestName) details.push(isEn ? `Guest: ${it.guestName}` : `الضيف: ${it.guestName}`);
    if (it.addonNames?.length) {
      details.push(`+ ${it.addonNames.join(isEn ? ', ' : '، ')}`);
    }
    if (it.notes) details.push(isEn ? `Note: ${it.notes}` : `ملاحظة: ${it.notes}`);
    sections.push({
      type: 'item',
      text: `${it.quantity}× ${it.name}${it.sizeName ? ` (${it.sizeName})` : ''}`,
      subText: details.join(' | '),
      rightText: includePrices ? fmt(it.lineTotal) : undefined,
    });
  });

  if (order.notes) {
    sections.push({ type: 'divider', text: '' });
    sections.push({
      type: 'note',
      text: isEn ? `Notes: ${order.notes}` : `ملاحظات: ${order.notes}`,
      bold: true,
    });
  }

  if (includeSeparateChecks && order.guestChecks && order.guestChecks.length > 0) {
    sections.push({ type: 'divider', text: '' });
    sections.push({
      type: 'meta',
      text: isEn ? 'Split Check by Guest:' : 'تقسيم الشيك بالاسم:',
      bold: true,
    });
    order.guestChecks.forEach((gc) => {
      sections.push({
        type: 'item',
        text: `${gc.guestName} (${gc.itemsCount})`,
        rightText: includePrices ? fmt(gc.total) : undefined,
      });
    });
  }

  sections.push({ type: 'divider', text: '' });
  if (includePrices) {
    sections.push({
      type: 'item',
      text: isEn ? 'Subtotal:' : 'المجموع الفرعي:',
      rightText: fmt(order.subtotal),
    });
    if (order.serviceCharge > 0) {
      sections.push({
        type: 'item',
        text: isEn ? 'Service Charge:' : 'رسوم الخدمة:',
        rightText: fmt(order.serviceCharge),
      });
    }
    if (order.taxAmount > 0) {
      sections.push({
        type: 'item',
        text: isEn ? 'Tax:' : 'الضريبة:',
        rightText: fmt(order.taxAmount),
      });
    }
    if (typeof order.deliveryFee === 'number' && order.deliveryFee > 0) {
      sections.push({
        type: 'item',
        text: isEn ? 'Delivery Fee:' : 'التوصيل:',
        rightText: fmt(order.deliveryFee),
      });
    }
    if (typeof order.discountAmount === 'number' && order.discountAmount > 0) {
      sections.push({
        type: 'item',
        text: isEn ? 'Discount:' : 'الخصم:',
        rightText: `-${fmt(order.discountAmount)}`,
      });
    }
    sections.push({
      type: 'total',
      text: isEn ? 'Total Due:' : 'الإجمالي المطلوب:',
      rightText: fmt(order.total),
    });
  } else {
    sections.push({
      type: 'total',
      text: isEn ? 'Total Items:' : 'إجمالي الأصناف:',
      rightText: String(totalQty),
    });
  }

  return {
    jobTitle: isEn ? `Consolidated Check #${order.orderNumber}` : `الطلب المجمع #${order.orderNumber}`,
    headerBadge: isEn ? 'Consolidated Check' : 'الطلب الأساسي المجمع',
    sections,
    cutAfter: true,
  };
}
