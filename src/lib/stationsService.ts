import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { getActiveLang } from '../data/translations';
import {
  cleanStationId,
  cleanStationIdList,
  DEFAULT_ALLOWED_ORDER_TYPES,
  DEFAULT_SEED_STATIONS,
  DEFAULT_STATUS_BUTTONS,
  screenToStationId,
  StationTemplate,
} from './stationUtils';
import {
  CaptainTableVisibilityScope,
  Category,
  KdsStatusButtonOption,
  MenuItem,
  Order,
  OrderType,
  RestaurantStation,
  StaffActorInfo,
  StaffAuditEventType,
  StaffMember,
  StationIconName,
  StationScreenType,
  ThermalPrintMode,
} from '../types/menu';

function makeStationDocId(name: string, nameEn?: string): string {
  const asciiSource = cleanStationId(nameEn || name);
  if (asciiSource && asciiSource.length >= 2) {
    return asciiSource;
  }
  return `st_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function makeAuditId(): string {
  return `slog_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function subscribeRestaurantStations(
  restaurantId: string,
  onData: (stations: RestaurantStation[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!restaurantId) {
    onData([]);
    return () => {};
  }
  const ref = collection(db, 'restaurants', restaurantId, 'stations');
  return onSnapshot(
    ref,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ ...(d.data() as RestaurantStation), id: d.id }))
        .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
      onData(list);
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

export async function seedStarterStationsForRestaurant(params: {
  restaurantId: string;
  ownerId: string;
  actor: StaffActorInfo;
  templates?: StationTemplate[];
}): Promise<RestaurantStation[]> {
  const { restaurantId, ownerId, actor, templates = DEFAULT_SEED_STATIONS } = params;
  try {
    const existingSnap = await getDocs(collection(db, 'restaurants', restaurantId, 'stations'));
    const existingIds = new Set(existingSnap.docs.map((d) => d.id));
    const batch = writeBatch(db);
    const created: RestaurantStation[] = [];
    let orderCounter = existingSnap.size;

    templates.forEach((tpl, idx) => {
      const stId = cleanStationId(tpl.suggestedId);
      if (!stId || existingIds.has(stId)) return;
      orderCounter += 1;
      const payload: RestaurantStation = {
        id: stId,
        stationId: stId,
        restaurantId,
        ownerId,
        name: tpl.name,
        nameEn: tpl.nameEn,
        color: tpl.color,
        icon: tpl.icon,
        screenType: 'prep',
        isActive: true,
        isArchived: false,
        isDefaultFallback: existingSnap.empty && idx === 0,
        showPrices: false,
        allowedOrderTypes: [...DEFAULT_ALLOWED_ORDER_TYPES],
        soundAlertEnabled: true,
        overdueAlertMinutes: 15,
        thermalPrintMode: 'manual',
        availableStatusButtons: [...DEFAULT_STATUS_BUTTONS],
        sortOrder: orderCounter,
        createdBy: actor.uid,
      };
      batch.set(doc(db, 'restaurants', restaurantId, 'stations', stId), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      created.push(payload);
    });

    if (created.length > 0) {
      const logId = makeAuditId();
      batch.set(doc(db, 'restaurants', restaurantId, 'staff_audit_logs', logId), {
        id: logId,
        restaurantId,
        ownerId,
        eventType: 'station_created' satisfies StaffAuditEventType,
        actorUid: actor.uid,
        actorName: actor.name.slice(0, 100),
        actorRole: actor.role,
        screen: 'stations',
        details:
          getActiveLang() === 'en'
            ? `Initialized ${created.length} core prep stations`
            : `تمت تهيئة ${created.length} محطة تحضير أساسية`,
        createdAt: serverTimestamp(),
      });
      await batch.commit();
    }
    return created;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `restaurants/${restaurantId}/stations`);
  }
}

export async function saveRestaurantStation(params: {
  restaurantId: string;
  ownerId: string;
  actor: StaffActorInfo;
  station: {
    id?: string;
    stationId?: string;
    name: string;
    nameEn?: string;
    color: string;
    icon: StationIconName;
    screenType?: StationScreenType;
    isActive: boolean;
    isArchived?: boolean;
    isDefaultFallback?: boolean;
    showPrices?: boolean;
    allowedOrderTypes?: OrderType[];
    soundAlertEnabled?: boolean;
    overdueAlertMinutes?: number;
    thermalPrintMode?: ThermalPrintMode;
    availableStatusButtons?: KdsStatusButtonOption[];
    assignedHallIds?: string[];
    assignedTableNumbers?: string[];
    tableVisibilityScope?: CaptainTableVisibilityScope;
    sortOrder: number;
  };
}): Promise<RestaurantStation> {
  const { restaurantId, ownerId, actor, station } = params;
  const cleanName = station.name.trim().slice(0, 80);
  if (cleanName.length < 2) {
    const isEn = getActiveLang() === 'en';
    throw new Error(
      isEn
        ? 'Screen / station name must be at least 2 characters.'
        : 'اسم الشاشة أو المحطة يجب أن لا يقل عن حرفين.'
    );
  }
  const cleanNameEn = (station.nameEn || '').trim().slice(0, 80);
  const screenType: StationScreenType = station.screenType === 'captain' ? 'captain' : 'prep';
  const defaultColor = screenType === 'captain' ? '#0D9488' : '#EA580C';
  const cleanColor = /^#[0-9a-fA-F]{6}$/.test(station.color) ? station.color : defaultColor;
  const isNew = !station.id;

  let stId = cleanStationId(
    station.id ||
      station.stationId ||
      (screenType === 'captain' ? `cap_${makeStationDocId(cleanName, cleanNameEn)}` : makeStationDocId(cleanName, cleanNameEn))
  );
  if (!stId) {
    stId = `${screenType === 'captain' ? 'cap' : 'st'}_${Date.now().toString(36)}`;
  }

  const existingSnap = await getDocs(collection(db, 'restaurants', restaurantId, 'stations'));
  if (isNew) {
    const existingIds = new Set(existingSnap.docs.map((d) => d.id));
    if (existingIds.has(stId)) {
      stId = `${stId}_${Math.random().toString(36).slice(2, 5)}`;
    }
  }

  const cleanOrderTypesRaw = Array.isArray(station.allowedOrderTypes)
    ? station.allowedOrderTypes.filter((t): t is OrderType => t === 'dine_in' || t === 'pickup' || t === 'delivery')
    : [];
  const allowedOrderTypes: OrderType[] =
    cleanOrderTypesRaw.length > 0 ? Array.from(new Set(cleanOrderTypesRaw)).slice(0, 3) : [...DEFAULT_ALLOWED_ORDER_TYPES];

  const cleanStatusButtonsRaw = Array.isArray(station.availableStatusButtons)
    ? station.availableStatusButtons.filter(
        (b): b is KdsStatusButtonOption => b === 'preparing' || b === 'ready' || b === 'served'
      )
    : [];
  const availableStatusButtons: KdsStatusButtonOption[] =
    cleanStatusButtonsRaw.length > 0 ? Array.from(new Set(cleanStatusButtonsRaw)).slice(0, 3) : [...DEFAULT_STATUS_BUTTONS];

  const assignedHallIds = Array.isArray(station.assignedHallIds)
    ? Array.from(new Set(station.assignedHallIds.map((h) => String(h).trim()).filter(Boolean))).slice(0, 30)
    : [];
  const assignedTableNumbers = Array.isArray(station.assignedTableNumbers)
    ? Array.from(new Set(station.assignedTableNumbers.map((t) => String(t).trim()).filter(Boolean))).slice(0, 200)
    : [];
  const tableVisibilityScope: CaptainTableVisibilityScope =
    station.tableVisibilityScope === 'assigned_only' ? 'assigned_only' : 'all';

  const isArchived = Boolean(station.isArchived);
  const isActive = isArchived ? false : Boolean(station.isActive);
  const isDefaultFallback = screenType === 'prep' && !isArchived ? Boolean(station.isDefaultFallback) : false;
  const showPrices = Boolean(station.showPrices);
  const soundAlertEnabled = station.soundAlertEnabled !== false;
  const overdueAlertMinutes = Math.max(
    1,
    Math.min(240, Math.round(Number(station.overdueAlertMinutes) || 15))
  );
  const thermalPrintMode: ThermalPrintMode =
    station.thermalPrintMode === 'auto' || station.thermalPrintMode === 'off'
      ? station.thermalPrintMode
      : 'manual';

  const ref = doc(db, 'restaurants', restaurantId, 'stations', stId);

  try {
    if (isDefaultFallback) {
      const siblingDefaults = existingSnap.docs.filter((d) => {
        const data = d.data() as RestaurantStation;
        return d.id !== stId && data.screenType !== 'captain' && data.isDefaultFallback === true;
      });
      if (siblingDefaults.length > 0) {
        const clearBatch = writeBatch(db);
        siblingDefaults.slice(0, 10).forEach((d) => {
          clearBatch.update(d.ref, {
            isDefaultFallback: false,
            updatedAt: serverTimestamp(),
          });
        });
        await clearBatch.commit();
      }
    }

    const commonFields = {
      name: cleanName,
      nameEn: cleanNameEn,
      color: cleanColor,
      icon: station.icon || (screenType === 'captain' ? 'user-check' : 'chef-hat'),
      screenType,
      isActive,
      isArchived,
      isDefaultFallback,
      showPrices,
      allowedOrderTypes,
      soundAlertEnabled,
      overdueAlertMinutes,
      thermalPrintMode,
      availableStatusButtons,
      assignedHallIds,
      assignedTableNumbers,
      tableVisibilityScope,
      sortOrder: Math.max(0, Math.min(10000, Number(station.sortOrder) || 1)),
      updatedAt: serverTimestamp(),
    };

    if (isNew) {
      await setDoc(ref, {
        id: stId,
        stationId: stId,
        restaurantId,
        ownerId,
        ...commonFields,
        createdBy: actor.uid,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, commonFields);
    }

    const logId = makeAuditId();
    await setDoc(doc(db, 'restaurants', restaurantId, 'staff_audit_logs', logId), {
      id: logId,
      restaurantId,
      ownerId,
      eventType: (isNew ? 'station_created' : 'station_updated') satisfies StaffAuditEventType,
      actorUid: actor.uid,
      actorName: actor.name.slice(0, 100),
      actorRole: actor.role,
      screen: stId,
      details:
        getActiveLang() === 'en'
          ? isNew
            ? `Created ${screenType === 'captain' ? 'captain screen' : 'prep station'}: ${cleanNameEn || cleanName} (${stId})`
            : `Updated ${screenType === 'captain' ? 'captain screen' : 'prep station'}: ${cleanNameEn || cleanName} (${isArchived ? 'archived' : isActive ? 'active' : 'paused'})`
          : isNew
            ? `تم إنشاء ${screenType === 'captain' ? 'شاشة كابتن' : 'محطة تحضير'} جديدة: ${cleanName} (${stId})`
            : `تم تحديث ${screenType === 'captain' ? 'شاشة الكابتن' : 'محطة التحضير'}: ${cleanName} (${isArchived ? 'مؤرشفة' : isActive ? 'نشطة' : 'متوقفة'})`,
      createdAt: serverTimestamp(),
    });

    return {
      id: stId,
      stationId: stId,
      restaurantId,
      ownerId,
      name: cleanName,
      nameEn: cleanNameEn,
      color: cleanColor,
      icon: commonFields.icon,
      screenType,
      isActive,
      isArchived,
      isDefaultFallback,
      showPrices,
      allowedOrderTypes,
      soundAlertEnabled,
      overdueAlertMinutes,
      thermalPrintMode,
      availableStatusButtons,
      assignedHallIds,
      assignedTableNumbers,
      tableVisibilityScope,
      sortOrder: commonFields.sortOrder,
      createdBy: actor.uid,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `restaurants/${restaurantId}/stations/${stId}`);
  }
}

export async function archiveRestaurantStation(params: {
  restaurantId: string;
  ownerId: string;
  station: RestaurantStation;
  actor: StaffActorInfo;
  archived: boolean;
}): Promise<void> {
  const { restaurantId, ownerId, station, actor, archived } = params;
  const stId = cleanStationId(station.stationId || station.id);
  const isEn = getActiveLang() === 'en';
  const stationLabel = isEn ? station.nameEn || station.name : station.name;

  try {
    await updateDoc(doc(db, 'restaurants', restaurantId, 'stations', station.id), {
      isArchived: archived,
      isActive: !archived,
      ...(archived ? { isDefaultFallback: false } : {}),
      updatedAt: serverTimestamp(),
    });

    const logId = makeAuditId();
    await setDoc(doc(db, 'restaurants', restaurantId, 'staff_audit_logs', logId), {
      id: logId,
      restaurantId,
      ownerId,
      eventType: 'station_updated' satisfies StaffAuditEventType,
      actorUid: actor.uid,
      actorName: actor.name.slice(0, 100),
      actorRole: actor.role,
      screen: stId,
      details: isEn
        ? `${archived ? 'Archived' : 'Restored'} screen/station: ${stationLabel}`
        : `${archived ? 'تمت أرشفة' : 'تمت استعادة'} الشاشة/المحطة: ${station.name}`,
      createdAt: serverTimestamp(),
    }).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `restaurants/${restaurantId}/stations/${station.id}`);
  }
}

export async function reorderRestaurantStations(
  restaurantId: string,
  stations: RestaurantStation[]
): Promise<void> {
  if (!restaurantId || stations.length === 0) return;
  try {
    const batch = writeBatch(db);
    stations.forEach((st, idx) => {
      batch.update(doc(db, 'restaurants', restaurantId, 'stations', st.id), {
        sortOrder: idx + 1,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `restaurants/${restaurantId}/stations`);
  }
}

export async function deleteRestaurantStationChecked(params: {
  restaurantId: string;
  ownerId: string;
  station: RestaurantStation;
  actor: StaffActorInfo;
}): Promise<void> {
  const { restaurantId, ownerId, station, actor } = params;
  const targetId = cleanStationId(station.stationId || station.id);
  const isCaptainScreen = station.screenType === 'captain';

  // Verify no open orders, linked categories, items, or staff members
  const [ordersSnap, catsSnap, itemsSnap, staffSnap] = await Promise.all([
    getDocs(query(collection(db, 'orders'), where('restaurantId', '==', restaurantId))),
    getDocs(query(collection(db, 'categories'), where('restaurantId', '==', restaurantId))),
    getDocs(query(collection(db, 'menu_items'), where('restaurantId', '==', restaurantId))),
    getDocs(collection(db, 'restaurants', restaurantId, 'staff')),
  ]);

  const isEn = getActiveLang() === 'en';
  const stationLabel = isEn ? station.nameEn || station.name : station.name;

  const openOrders = ordersSnap.docs
    .map((d) => d.data() as Order)
    .filter((o) => o.status !== 'completed' && o.status !== 'cancelled');

  const blockingOpenOrders = openOrders.filter((ord) => {
    if (isCaptainScreen) {
      if (ord.orderType !== 'dine_in') return false;
      const tables = (station.assignedTableNumbers || []).map((t) => String(t).trim()).filter(Boolean);
      const halls = (station.assignedHallIds || []).filter(Boolean);
      if (tables.length > 0 && ord.tableNumber) {
        return tables.includes(String(ord.tableNumber).trim());
      }
      if (halls.length > 0 && station.tableVisibilityScope === 'assigned_only') {
        return true;
      }
      return true;
    }
    return (ord.items || []).some((it) => {
      const list = cleanStationIdList(it.stationIds);
      if (list.includes(targetId)) return true;
      return cleanStationId(it.stationId || it.station) === targetId;
    });
  });

  if (blockingOpenOrders.length > 0) {
    throw new Error(
      isEn
        ? `Cannot delete "${stationLabel}" because there are ${blockingOpenOrders.length} open orders currently active on it. Close those orders first or choose "Archive" instead to preserve order history.`
        : `لا يمكن حذف "${station.name}" لوجود ${blockingOpenOrders.length} طلب مفتوح مرتبط بها حالياً. أغلق الطلبات أولاً أو اختر "أرشفة" بدلاً من الحذف للحفاظ على سجل الطلبات.`
    );
  }

  const linkedCategories = catsSnap.docs
    .map((d) => d.data() as Category)
    .filter((c) => {
      const list = cleanStationIdList(c.stationIds);
      if (list.includes(targetId)) return true;
      return cleanStationId(c.stationId || c.station) === targetId;
    });

  if (linkedCategories.length > 0) {
    throw new Error(
      isEn
        ? `Cannot delete "${stationLabel}" because it is linked to ${linkedCategories.length} menu categories (${linkedCategories
            .slice(0, 2)
            .map((c) => c.name_en || c.name)
            .join(', ')}). Reassign them or use "Archive" instead.`
        : `لا يمكن حذف "${station.name}" لأنه مرتبط بـ ${linkedCategories.length} قسم في المنيو (${linkedCategories
            .slice(0, 2)
            .map((c) => c.name)
            .join('، ')}). انقل تلك الأقسام لمحطة أخرى أو استخدم "أرشفة" بدلاً من الحذف.`
    );
  }

  const linkedItems = itemsSnap.docs
    .map((d) => d.data() as MenuItem)
    .filter((it) => {
      const list = cleanStationIdList(it.stationIds);
      if (list.includes(targetId)) return true;
      return cleanStationId(it.stationId || it.station) === targetId;
    });

  if (linkedItems.length > 0) {
    throw new Error(
      isEn
        ? `Cannot delete "${stationLabel}" because ${linkedItems.length} menu items are routed to it. Reassign those items or use "Archive" instead.`
        : `لا يمكن حذف "${station.name}" لوجود ${linkedItems.length} صنف من المنيو مرتبط به حالياً. عدّل توجيه الأصناف أو استخدم "أرشفة" بدلاً من الحذف.`
    );
  }

  const linkedStaff = staffSnap.docs
    .map((d) => d.data() as StaffMember)
    .filter((m) => {
      if (m.role === 'manager') return false;
      const explicitStations = (m.allowedStations || []).map((s) => cleanStationId(s));
      const explicitCaptain = (m.allowedCaptainScreens || []).map((s) => cleanStationId(s));
      const screenStations = (m.allowedScreens || [])
        .map((scr) => screenToStationId(scr))
        .filter((x): x is string => Boolean(x));
      return (
        explicitStations.includes(targetId) ||
        explicitCaptain.includes(targetId) ||
        screenStations.includes(targetId)
      );
    });

  if (linkedStaff.length > 0) {
    throw new Error(
      isEn
        ? `Cannot delete "${stationLabel}" because ${linkedStaff.length} staff members are assigned to it (${linkedStaff
            .slice(0, 2)
            .map((s) => s.name)
            .join(', ')}). Remove their access or use "Archive" instead.`
        : `لا يمكن حذف "${station.name}" لوجود ${linkedStaff.length} موظف مرتبط به (${linkedStaff
            .slice(0, 2)
            .map((s) => s.name)
            .join('، ')}). أزل الصلاحية عنهم أو استخدم "أرشفة" بدلاً من الحذف.`
    );
  }

  try {
    await deleteDoc(doc(db, 'restaurants', restaurantId, 'stations', station.id));
    const logId = makeAuditId();
    await setDoc(doc(db, 'restaurants', restaurantId, 'staff_audit_logs', logId), {
      id: logId,
      restaurantId,
      ownerId,
      eventType: 'station_deleted' satisfies StaffAuditEventType,
      actorUid: actor.uid,
      actorName: actor.name.slice(0, 100),
      actorRole: actor.role,
      screen: targetId,
      details: isEn
        ? `Deleted ${isCaptainScreen ? 'captain screen' : 'prep station'}: ${stationLabel}`
        : `تم حذف ${isCaptainScreen ? 'شاشة الكابتن' : 'القسم الرئيسي'}: ${station.name}`,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `restaurants/${restaurantId}/stations/${station.id}`);
  }
}

export async function syncStationMenuAssignments(params: {
  stationId: string;
  fallbackStationId: string;
  categories: Category[];
  menuItems: MenuItem[];
  selectedCategoryIds: string[];
  selectedItemIds: string[];
}): Promise<void> {
  const {
    stationId,
    fallbackStationId,
    categories,
    menuItems,
    selectedCategoryIds,
    selectedItemIds,
  } = params;
  const targetId = cleanStationId(stationId);
  if (!targetId) return;

  const safeFallback =
    cleanStationId(fallbackStationId) && cleanStationId(fallbackStationId) !== targetId
      ? cleanStationId(fallbackStationId)
      : 'kitchen';
  const selectedCatSet = new Set(selectedCategoryIds);
  const selectedItemSet = new Set(selectedItemIds);

  const catUpdates: Array<{ cat: Category; nextIds: string[] }> = [];
  const catNextMap = new Map<string, string[]>();

  categories.forEach((cat) => {
    const existingRaw = cleanStationIdList(
      cat.stationIds && cat.stationIds.length > 0
        ? cat.stationIds
        : [cat.stationId || cat.station].filter(Boolean)
    );
    const hasTarget = existingRaw.includes(targetId);
    const wantsTarget = selectedCatSet.has(cat.id);

    let nextIds = existingRaw;
    if (wantsTarget && !hasTarget) {
      nextIds = Array.from(new Set([...existingRaw, targetId])).slice(0, 20);
    } else if (!wantsTarget && hasTarget) {
      const remaining = existingRaw.filter((id) => id !== targetId);
      nextIds = remaining.length > 0 ? remaining : [safeFallback];
    }

    catNextMap.set(cat.id, nextIds);
    if (wantsTarget !== hasTarget) {
      catUpdates.push({ cat, nextIds });
    }
  });

  const itemUpdates: Array<{ item: MenuItem; nextIds: string[] }> = [];
  menuItems.forEach((item) => {
    const existingRaw = cleanStationIdList(
      item.stationIds && item.stationIds.length > 0
        ? item.stationIds
        : [item.stationId || item.station].filter(Boolean)
    );
    const hasTarget = existingRaw.includes(targetId);
    const wantsTarget = selectedItemSet.has(item.id);
    const catChanged = catUpdates.some((cu) => cu.cat.id === item.categoryId);

    let nextIds = existingRaw;
    if (wantsTarget && !hasTarget) {
      nextIds = Array.from(new Set([...existingRaw, targetId])).slice(0, 20);
    } else if (!wantsTarget && hasTarget) {
      const remaining = existingRaw.filter((id) => id !== targetId);
      const catFallback = (catNextMap.get(item.categoryId) || []).filter((id) => id !== targetId);
      nextIds = remaining.length > 0 ? remaining : catFallback.length > 0 ? catFallback : [safeFallback];
    }

    if (wantsTarget !== hasTarget || (catChanged && wantsTarget)) {
      itemUpdates.push({ item, nextIds });
    }
  });

  if (catUpdates.length === 0 && itemUpdates.length === 0) return;

  const writes: Array<{ ref: ReturnType<typeof doc>; data: Record<string, unknown> }> = [
    ...catUpdates.map(({ cat, nextIds }) => ({
      ref: doc(db, 'categories', cat.id),
      data: {
        station: nextIds[0] || safeFallback,
        stationId: nextIds[0] || safeFallback,
        stationIds: nextIds,
      },
    })),
    ...itemUpdates.map(({ item, nextIds }) => ({
      ref: doc(db, 'menu_items', item.id),
      data: {
        station: nextIds[0] || safeFallback,
        stationId: nextIds[0] || safeFallback,
        stationIds: nextIds,
        updatedAt: serverTimestamp(),
      },
    })),
  ];

  const CHUNK_SIZE = 400;
  for (let i = 0; i < writes.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    writes.slice(i, i + CHUNK_SIZE).forEach((w) => batch.update(w.ref, w.data));
    await batch.commit();
  }
}

